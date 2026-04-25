const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Essential for Render/Production environments

const COOKIES_LOCAL = path.join(__dirname, 'instagram_cookies.txt');
const COOKIES_RENDER = '/etc/secrets/instagram_cookies.txt';
const COOKIES_TMP = '/tmp/instagram_cookies.txt';

const YT_COOKIES_LOCAL = path.join(__dirname, 'youtube_cookies.txt');
const YT_COOKIES_RENDER = '/etc/secrets/youtube_cookies.txt';
const YT_COOKIES_TXT_RENDER = '/etc/secrets/cookies.txt';
const YT_COOKIES_TMP = '/tmp/youtube_cookies.txt';

// 🍪 Priority: Writable /tmp File (Copied from Render) > Local File
if (fs.existsSync(COOKIES_RENDER)) {
  // Copy to a writable directory because yt-dlp tries to save/update cookies on exit
  try {
    fs.copyFileSync(COOKIES_RENDER, COOKIES_TMP);
  } catch(e) {
    console.error('Failed to copy cookie file to tmp', e);
  }
}
const COOKIES_PATH = fs.existsSync(COOKIES_TMP) ? COOKIES_TMP : COOKIES_LOCAL;

if (fs.existsSync(YT_COOKIES_RENDER)) {
  try {
    fs.copyFileSync(YT_COOKIES_RENDER, YT_COOKIES_TMP);
  } catch (e) {
    console.error('Failed to copy YouTube cookie file to tmp', e);
  }
}
const YT_COOKIES_PATH = fs.existsSync(YT_COOKIES_TMP) ? YT_COOKIES_TMP : YT_COOKIES_LOCAL;

app.use(cors());
app.use(express.json());

const YT_DOWNLOADS_DIR = path.join(__dirname, 'downloads', 'youtube');
try {
  fs.mkdirSync(YT_DOWNLOADS_DIR, { recursive: true });
} catch (e) {
  console.error('Failed to create YouTube downloads dir', e);
}

app.use('/youtube/files', express.static(YT_DOWNLOADS_DIR, {
  setHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Logger Middleware for tracking requests in deployment logs
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    engine: 'SaveX Core',
    version: '1.2.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    message: 'High-fidelity archival services are active.'
  });
});

// Simple Ping for keep-alive services (e.g., cron-job.org)
app.get('/ping', (req, res) => res.status(200).send('pong'));

console.log('🔍 System Check: Cookie Source ->', COOKIES_PATH);
console.log('📁 Cookie File Exists?', fs.existsSync(COOKIES_PATH) ? 'YES' : 'NO');
console.log('🔍 YouTube Cookie Source ->', YT_COOKIES_PATH);
console.log('📁 YouTube Cookie File Exists?', fs.existsSync(YT_COOKIES_PATH) ? 'YES' : 'NO');

function secondsToDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function isValidYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u);
}

function extractYouTubeVideoId(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return u.pathname.replace(/^\//, '').split('/')[0] || '';
    }
    const v = u.searchParams.get('v');
    if (v) return v;
    const parts = u.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
  } catch (_) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{6,})/);
    if (m) return m[1];
  }
  return '';
}

function runYtDlp(args, { timeoutMs = 5 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { windowsHide: true });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject({ err, stdout, stderr });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve({ stdout, stderr });
      reject({ code, stdout, stderr });
    });
  });
}

function makePublicDownloadUrl(req, fileName) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/youtube/files/${encodeURIComponent(fileName)}`;
}

function looksLikeFfmpegMissing(stderr) {
  const s = (stderr || '').toLowerCase();
  return s.includes('ffmpeg') && (s.includes('not found') || s.includes('ffprobe') || s.includes('not recognized'));
}

function looksLikeYouTubeBotCheck(stderr) {
  const s = (stderr || '').toLowerCase();
  return (
    s.includes('sign in to confirm') ||
    s.includes('not a bot') ||
    s.includes('confirm you') ||
    s.includes('captcha') ||
    s.includes('verify that you') ||
    s.includes('rate limit') ||
    s.includes('429') ||
    s.includes('too many requests')
  );
}

// 🍪 Runtime Cookie Handler for Render
function getCookiesPath() {
  const COOKIE_FILE = '/tmp/youtube_cookies.txt';
  try {
    // Priority 1: Environment Variable (Base64 or Raw Netscape text)
    if (process.env.YT_COOKIES) {
      let content = process.env.YT_COOKIES;
      // Detect if base64 encoded
      if (content.length > 100 && !content.includes('\t')) {
        content = Buffer.from(content, 'base64').toString('utf8');
      }
      fs.writeFileSync(COOKIE_FILE, content);
      return COOKIE_FILE;
    }
    // Priority 2: Uploaded Secret File (Render) - cookies.txt or youtube_cookies.txt
    const RENDER_SECRET_1 = '/etc/secrets/cookies.txt';
    const RENDER_SECRET_2 = '/etc/secrets/youtube_cookies.txt';
    
    if (fs.existsSync(RENDER_SECRET_1)) {
      fs.copyFileSync(RENDER_SECRET_1, COOKIE_FILE);
      return COOKIE_FILE;
    }
    if (fs.existsSync(RENDER_SECRET_2)) {
      fs.copyFileSync(RENDER_SECRET_2, COOKIE_FILE);
      return COOKIE_FILE;
    }
  } catch (e) {
    console.error('Cookie Handler Error:', e.message);
  }
  return null;
}

// Cobalt Instance Pool (ordered by reliability score)
const COBALT_INSTANCES = [
  'https://cobalt-api.meowing.de',
  'https://cobalt-backend.canine.tools',
  'https://capi.3kh0.net',
  'https://kityune.imput.net',
  'https://nachos.imput.net',
  'https://sunny.imput.net',
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cobalt-based Download Strategy (Multi-instance fallback for reliability)
async function downloadWithCobalt(videoUrl, videoQuality = '1080', downloadMode = 'auto') {
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying Cobalt instance: ${instance}`);
      const response = await axios.post(`${instance}/`, {
        url: videoUrl,
        videoQuality: videoQuality,
        youtubeVideoCodec: 'h264',
        filenameStyle: 'pretty',
        downloadMode: downloadMode,
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'SaveX-Client/1.3',
        },
        timeout: 25000,
      });

      const data = response.data;
      
      if (data.status === 'tunnel' || data.status === 'redirect') {
        console.log(`Cobalt success via ${instance} (${data.status})`);
        return data.url;
      }
      
      if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
        console.log(`Cobalt picker response via ${instance}, using first item`);
        return data.picker[0].url;
      }
      
      if (data.status === 'error') {
        console.warn(`Cobalt ${instance} returned logic error:`, data.error?.code || 'unknown');
        await sleep(1000);
        continue;
      }
    } catch (err) {
      const status = err.response?.status;
      console.warn(`Cobalt ${instance} failed (HTTP ${status || 'timeout'}):`, err.message);
      
      // If 400 or 403, it's likely a block or bad request, wait a bit and move on
      if (status === 400 || status === 403 || status === 429) {
        console.log(`Gracefully skipping ${instance} due to ${status}`);
        await sleep(1000);
      }
      continue;
    }
  }
  return null;
}

// 🎥 Production Single-Strategy Config (Web Client + Anti-Blocking)
const getCommonArgs = () => {
  const args = [
    '--force-ipv4',
    '--no-check-certificates',
    '--geo-bypass',
    '--sleep-interval', '2', 
    '--max-sleep-interval', '5',
    '--retries', '5',
    '--extractor-args', 'youtube:player_client=android,web;player_skip=configs,webpage'
  ];
  
  // Set Node path for solving n-challenges
  if (process.env.NODE_PATH) {
     args.push('--javascript-delay', '2');
  }

  const cookies = getCookiesPath();
  if (cookies) {
    console.log(`Using cookies from: ${cookies}`);
    args.push('--cookies', cookies);
  }
  
  return args;
};

function buildYoutubeVideoOptions(info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const heights = new Set([360, 720, 1080]); // Standard production targets
  // Also collect actual available heights
  for (const f of formats) {
    const h = Number(f?.height);
    if (h && h > 0 && f.vcodec !== 'none') heights.add(h);
  }
  return Array.from(heights)
    .sort((a, b) => b - a)
    .map(h => ({ key: String(h), label: h >= 1080 ? `${h}p Premium` : `${h}p`, maxHeight: h }));
}

function resolveHeightForRequest(requestedHeight, info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const videoHeights = Array.from(
    new Set(
      formats
        .map((f) => Number(f?.height))
        .filter((h) => Number.isFinite(h) && h > 0)
    )
  ).sort((a, b) => a - b);

  if (!videoHeights.length) return requestedHeight;

  // Pick highest height <= requested; if none, pick the lowest available.
  const bestUnder = videoHeights.filter((h) => h <= requestedHeight).pop();
  return bestUnder || videoHeights[0];
}

// 🚀 --- NATIVE INNERTUBE & FFMPEG HELPERS --- 🚀

// Native Innertube API Strategy (Android Client trick, bypasses Deciphering)
async function fetchNativeInnertube(videoId) {
  if (!videoId) return null;
  try {
    const response = await axios.post(
      "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      {
        videoId: videoId,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "18.11.34",
            androidSdkVersion: 30,
            hl: "en",
            gl: "US"
          }
        }
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000
      }
    );

    const data = response.data;
    if (!data.streamingData) return null;
    return data;
  } catch (err) {
    console.error("Innertube API Error:", err.message);
    return null;
  }
}

// Spawns and awaits FFmpeg
function runFfmpeg(args, { timeoutMs = 5 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-y', ...args], { windowsHide: true });
    let stderr = '';
    const timeout = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, timeoutMs);

    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

// YouTube Info Endpoint
app.post('/youtube/info', async (req, res) => {
  const { url } = req.body || {};
  if (!isValidYouTubeUrl(url)) return res.status(400).json({ error: 'Not a YouTube Link', message: 'That doesn\'t look like a YouTube link. Please paste a link from youtube.com or youtu.be.' });

  const cleanUrl = url.trim();
  const videoId = extractYouTubeVideoId(cleanUrl);

  // 🏁 Strategy 1: Native Innertube API (Fastest, zero deps)
  if (videoId) {
    console.log('Attempting Native Innertube API info fetch...');
    const innertubeData = await fetchNativeInnertube(videoId);
    if (innertubeData && innertubeData.videoDetails) {
      console.log('Native Innertube Info Success!');
      const details = innertubeData.videoDetails;
      
      const heights = new Set([360, 720]);
      if (innertubeData.streamingData && innertubeData.streamingData.adaptiveFormats) {
        innertubeData.streamingData.adaptiveFormats.forEach(f => {
          if (f.height) heights.add(f.height);
        });
      }
      const videoOptions = Array.from(heights)
        .sort((a, b) => b - a)
        .map(h => ({ key: String(h), label: h >= 1080 ? `${h}p Premium` : `${h}p`, maxHeight: h }))
        .concat([{ key: 'audio', label: 'MP3 Audio', maxHeight: 0 }]);

      return res.json({
        title: details.title || '',
        thumbnail: details.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: secondsToDuration(details.lengthSeconds || 0),
        videoId: videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        videoOptions: videoOptions,
      });
    }
  }

  // 🏁 Strategy 2: Local yt-dlp Fallback
  try {
    console.log('Fetching YouTube info locally (yt-dlp)...');
    const { stdout } = await runYtDlp([
      '--dump-json',
      '--no-playlist',
      ...getCommonArgs(),
      cleanUrl
    ], { timeoutMs: 180000 });

    const info = JSON.parse(stdout.trim());
    const videoId = info.id || extractYouTubeVideoId(cleanUrl);
    return res.json({
      title: info.title || '',
      thumbnail: info.thumbnail || '',
      duration: info.duration_string || secondsToDuration(info.duration),
      videoId: videoId,
      embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : '',
      videoOptions: buildYoutubeVideoOptions(info),
    });
  } catch (e) {
    const details = e.stderr || e.err?.message || '';
    console.error('Local YouTube info error:', details);
    
    // 🏁 Strategy 2: Attempt Cobalt for Info Fallback
    console.log('Attempting Cobalt Info fallback...');
    try {
      const cobaltUrl = await downloadWithCobalt(cleanUrl, '720');
      
      if (cobaltUrl) {
        const videoId = extractYouTubeVideoId(cleanUrl);
        return res.json({
          title: 'YouTube Video',
          thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '',
          duration: 'Premium Quality',
          videoId: videoId,
          embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : '',
          videoOptions: [
            { key: '1080', label: '1080p Premium', maxHeight: 1080 },
            { key: '720', label: '720p Premium', maxHeight: 720 },
            { key: 'audio', label: 'MP3 Audio', maxHeight: 0 }
          ],
        });
      }
    } catch (cobaltErr) {
      console.error('Cobalt Info Fallback Failed:', cobaltErr.message);
    }

    if (looksLikeYouTubeBotCheck(details)) {
      return res.status(429).json({
        error: 'YouTube is Busy',
        message: 'YouTube thinks we\'re sending too many requests right now. Please wait a minute or two and try again.'
      });
    }

    return res.status(503).json({
      error: 'Could Not Load Video',
      message: 'We\'re having trouble getting this video right now. This usually fixes itself — please try again in a moment.',
      details: process.env.NODE_ENV === 'development' ? details : undefined
    });
  }
});

// YouTube: Download to server + return file URL
// YouTube Download Endpoint
app.post('/youtube/download', async (req, res) => {
  const { url, kind, maxHeight, quality, format } = req.body || {};
  if (!isValidYouTubeUrl(url)) return res.status(400).json({ error: 'Not a YouTube Link', message: 'That doesn\'t look like a YouTube link. Please paste a link from youtube.com or youtu.be.' });

  const dlKind = kind || (format === 'mp3' ? 'audio' : 'video');
  const targetExt = dlKind === 'video' ? 'mp4' : 'mp3';
  const h = Number(maxHeight || (String(quality).replace('p', '')) || 720);

  // 🏁 Strategy 1: Try Cobalt first (multi-instance, most reliable)
  console.log(`Trying Cobalt for ${dlKind} (${h}p)...`);
  const cobaltMode = dlKind === 'audio' ? 'audio' : 'auto';
  const cobaltUrl = await downloadWithCobalt(url.trim(), String(h), cobaltMode);
  if (cobaltUrl) {
    console.log('Cobalt success!');
    return res.json({
      downloadUrl: cobaltUrl,
      title: 'YouTube Download (Premium)',
      success: true,
      source: 'cobalt'
    });
  }
  console.log('Cobalt failed or rate-limited, falling back to next engines.');

  const videoId = extractYouTubeVideoId(url.trim());
  const id = `${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  const baseName = `savex_${id}`;
  const finalPath = path.join('/tmp', `${baseName}.${targetExt}`);

  // 🏁 Strategy 2: Native Android Innertube + FFmpeg
  console.log('Attempting Native Innertube direct download...');
  const innertubeData = await fetchNativeInnertube(videoId);
  if (innertubeData && innertubeData.streamingData) {
    try {
      const streaming = innertubeData.streamingData;
      let videoUrl = null;
      let audioUrl = null;

      const audioStreams = (streaming.adaptiveFormats || []).filter(f => f.mimeType?.includes('audio') && f.url);
      if (audioStreams.length > 0) {
        audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        audioUrl = audioStreams[0].url;
      } else {
        const formats = (streaming.formats || []).filter(f => f.url);
        if (formats.length > 0) audioUrl = formats[0].url;
      }

      if (dlKind === 'audio' && audioUrl) {
         await runFfmpeg([
            '-i', audioUrl,
            '-vn',
            '-ab', '192k',
            '-ar', '44100',
            finalPath
         ]);
      } else if (dlKind === 'video') {
         const videoStreams = (streaming.adaptiveFormats || []).filter(f => f.mimeType?.includes('video') && f.url && f.height <= h);
         if (videoStreams.length > 0) {
            videoStreams.sort((a, b) => (b.height || 0) - (a.height || 0));
            videoUrl = videoStreams[0].url;
         } else {
            const formats = (streaming.formats || []).filter(f => f.url && f.height <= h);
            if (formats.length > 0) {
               formats.sort((a, b) => (b.height || 0) - (a.height || 0));
               videoUrl = formats[0].url;
            } else if (audioUrl) {
               // Fallback: Just grab any format with a valid URL if nothing matches criteria
               const anyVids = (streaming.formats || []).filter(f => f.url);
               if (anyVids.length > 0) videoUrl = anyVids[0].url;
            }
         }

         if (videoUrl && audioUrl && videoUrl !== audioUrl) {
             console.log('Muxing Innertube separate streams via FFmpeg...');
             await runFfmpeg([
                 '-i', videoUrl,
                 '-i', audioUrl,
                 '-c:v', 'copy',
                 '-c:a', 'aac',
                 finalPath
             ]);
         } else if (videoUrl) {
             console.log('Saving Innertube pre-muxed stream via FFmpeg...');
             await runFfmpeg([
                 '-i', videoUrl,
                 '-c:v', 'copy',
                 '-c:a', 'copy',
                 finalPath
             ]);
         }
      }

      if (fs.existsSync(finalPath)) {
         const publicPath = path.join(YT_DOWNLOADS_DIR, `${baseName}.${targetExt}`);
         fs.renameSync(finalPath, publicPath);
         console.log('Innertube + FFmpeg download success!');
         return res.json({
            downloadUrl: makePublicDownloadUrl(req, `${baseName}.${targetExt}`),
            title: 'YouTube Download',
            success: true,
            source: 'innertube'
         });
      }
    } catch (e) {
      console.error('Native Innertube Download Failed:', e.message);
    }
  }

  // 🏁 Strategy 3: Local yt-dlp
  const outputTemplate = path.join('/tmp', `${baseName}.%(ext)s`);

  try {
    let args = ['--no-playlist', ...getCommonArgs(), '-o', outputTemplate];

    if (dlKind === 'video') {
      // Hardened format selection for server stability
      args.push('-f', `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${h}][ext=mp4]/bestvideo+bestaudio/best`);
      args.push('--merge-output-format', 'mp4');
    } else {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '192K');
    }

    args.push(url.trim());

    console.log('Starting Local Download:', baseName);
    await runYtDlp(args, { timeoutMs: 300000 });

    if (!fs.existsSync(finalPath)) {
      // Emergency fallback: Find any file generated with the basename
      const files = fs.readdirSync('/tmp').filter(f => f.startsWith(baseName));
      if (files.length === 0) throw new Error('File generation failed');
      const tempFile = path.join('/tmp', files[0]);
      fs.renameSync(tempFile, finalPath);
    }

    // Move to public directory for serving
    const publicPath = path.join(YT_DOWNLOADS_DIR, `${baseName}.${targetExt}`);
    fs.renameSync(finalPath, publicPath);

    return res.json({
      downloadUrl: makePublicDownloadUrl(req, `${baseName}.${targetExt}`),
      title: 'YouTube Download',
      success: true
    });
  } catch (e) {
    const details = e.stderr || e.err?.message || 'Download Error';
    console.error('YouTube download error:', details);
    
    // Final Strategy: Attempt Cobalt as absolute fallback even for lower qualities
    const fallbackUrl = await downloadWithCobalt(url.trim(), String(h));
    if (fallbackUrl) {
      return res.json({
        downloadUrl: fallbackUrl,
        title: 'YouTube Download (Fallback)',
        success: true,
        source: 'cobalt'
      });
    }

    return res.status(500).json({ error: 'Download Did Not Work', message: 'We tried everything but couldn\'t download this video. YouTube may be blocking it. Please try again later or try a different video.' });
  }
});

// 1. Download Reel Endpoint (Powered by yt-dlp)
app.post('/download', async (req, res) => {
  const { reelUrl } = req.body;

  if (!reelUrl) {
    return res.status(400).json({ error: 'No Link Provided', message: 'Please paste an Instagram Reel link first.' });
  }

  // 1. Sanitize the URL (Removed truncation as it breaks some valid links)
  const cleanUrl = reelUrl.trim();
  console.log('Starting Reel extraction for:', cleanUrl);

  // 2. Check for Authentication (Priority: Manual File > Local Browser Auto-Auth)
  const authFlag = fs.existsSync(COOKIES_PATH) 
    ? `--cookies "${COOKIES_PATH}"` 
    : `--cookies-from-browser chrome --cookies-from-browser edge --cookies-from-browser brave`;

  // 3. Execute yt-dlp with "best" combined format to avoid split audio/video
  const command = `yt-dlp -g ${authFlag} --no-playlist --no-warnings --no-check-certificates --geo-bypass --format "best[ext=mp4]/best" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --referer "https://www.instagram.com/" "${cleanUrl}"`;
  
  // Added timeout (30s) to prevent hanging processes
  exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Extraction Error Details:', stderr || error.message);
      
      let errorMsg = 'Something Went Wrong';
      let subMsg = 'We couldn\'t get this video. The link might be broken or the post may no longer exist. Please check the link and try again.';
      let statusCode = 500;

      if (stderr.includes('Login required') || stderr.includes('Private') || stderr.includes('private') || stderr.includes('login_required')) {
        errorMsg = 'This Account is Private';
        subMsg = 'This Reel belongs to a private account. We can only download Reels from public accounts.';
        statusCode = 403;
      } else if (stderr.includes('404') || stderr.includes('Not Found') || stderr.includes('does not exist')) {
        errorMsg = 'Reel Not Found';
        subMsg = 'This Reel has been deleted or the link is wrong. Please double-check the link and try again.';
        statusCode = 404;
      } else if (error.killed) {
        errorMsg = 'Taking Too Long';
        subMsg = 'The request is taking too long. This can happen with large videos or when Instagram is slow. Please try again.';
        statusCode = 504;
      } else if (stderr.includes('Sign in') || stderr.includes('Rate limit') || stderr.includes('429') || stderr.includes('too many')) {
        errorMsg = 'Too Many Requests';
        subMsg = 'Instagram is temporarily limiting our access. Please wait a minute or two and try again.';
        statusCode = 429;
      }

      return res.status(statusCode).json({ 
        error: errorMsg, 
        message: subMsg,
        details: process.env.NODE_ENV === 'development' ? stderr : undefined
      });
    }
    
    const videoUrl = stdout.trim();
    if (!videoUrl) {
      return res.status(404).json({ 
        error: 'Could Not Get Video', 
        message: 'We couldn\'t find a downloadable video at this link. Instagram might be blocking us right now — please try again in a few minutes.' 
      });
    }

    res.json({ videoUrl });
  });
});

// 2. View Stories Endpoint (Robust yt-dlp extraction)
app.get('/stories/:username', async (req, res) => {
  const { username } = req.params;
  const target = username.trim().replace('@', '');
  
  console.log(`Starting Story extraction for user: ${target}`);
  
  // 2. Check for Authentication
  const authFlag = fs.existsSync(COOKIES_PATH) 
    ? `--cookies "${COOKIES_PATH}"` 
    : `--cookies-from-browser chrome --cookies-from-browser edge --cookies-from-browser brave`;

  // 3. Use yt-dlp with "best" format to ensure combined audio/video
  const storyUrl = `https://www.instagram.com/stories/${target}/`;
  const command = `yt-dlp -g ${authFlag} --no-playlist --no-warnings --no-check-certificates --geo-bypass --format "best[ext=mp4]/best" --add-header "Accept-Language: en-US,en;q=0.9" --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" --referer "https://www.instagram.com/" "${storyUrl}"`;

  exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
    if (error) {
      console.warn('Story Extraction Issue:', stderr || error.message);
      
      let errorMsg = 'No Stories Right Now';
      let subMsg = 'This user hasn\'t posted any stories in the last 24 hours. Stories only last 24 hours, so check back later!';
      let statusCode = 404;

      if (stderr.includes('Login required') || stderr.includes('login_required') || stderr.includes('Private') || stderr.includes('private')) {
        errorMsg = 'This Account is Private';
        subMsg = 'This is a private account, so their stories are hidden. You can only view stories from public accounts.';
        statusCode = 403;
      } else if (stderr.includes('404') || stderr.includes('Not Found') || stderr.includes('does not exist') || stderr.includes('User not found')) {
        errorMsg = 'User Does Not Exist';
        subMsg = 'We couldn\'t find anyone with that username on Instagram. Please check the spelling and try again.';
        statusCode = 404;
      } else if (stderr.includes('Sign in') || stderr.includes('Rate limit') || stderr.includes('429') || stderr.includes('too many')) {
        errorMsg = 'Too Many Requests';
        subMsg = 'Instagram is temporarily limiting our access. Please wait a minute or two and try again.';
        statusCode = 429;
      } else if (error.killed) {
        errorMsg = 'Taking Too Long';
        subMsg = 'The request is taking too long. Instagram might be slow right now. Please try again.';
        statusCode = 504;
      }

      return res.status(statusCode).json({ error: errorMsg, message: subMsg });
    }

    const urls = stdout.trim().split(/\s+/).filter(url => url.startsWith('http'));
    
    if (urls.length > 0) {
      const results = urls.map(url => ({
        type: url.includes('.mp4') || url.includes('video') ? 'video' : 'image',
        url: url,
        thumbnail: url 
      }));
      return res.json(results);
    } else {
      return res.status(404).json({ 
        error: 'No Stories Right Now', 
        message: 'This user hasn\'t posted any stories in the last 24 hours. Stories only last 24 hours, so check back later!' 
      });
    }
  });
});

// 3. Media Proxy (Crucial for bypassing Instagram IP-locking & Connection Reset)
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Url is required');

  console.log('Proxying request for:', url.substring(0, 50) + '...');

  try {
    const protocol = url.startsWith('https') ? require('https') : require('http');
    
    // Forward the Range header if present
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://www.instagram.com/',
      'Accept': '*/*',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const options = { headers, timeout: 20000 };

    protocol.get(url, options, (proxyRes) => {
      // Forward status and essential headers
      res.status(proxyRes.statusCode);
      
      const responseHeaders = {
        'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      };

      if (proxyRes.headers['content-length']) responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
      if (proxyRes.headers['content-range']) responseHeaders['Content-Range'] = proxyRes.headers['content-range'];
      if (proxyRes.headers['accept-ranges']) responseHeaders['Accept-Ranges'] = proxyRes.headers['accept-ranges'];

      res.set(responseHeaders);
      
      proxyRes.pipe(res);
      
      proxyRes.on('error', (err) => {
        console.error('Stream Error:', err);
        if (!res.headersSent) res.status(500).send('Stream interrupted');
      });
    }).on('error', (e) => {
      console.error('Proxy Request Error:', e);
      if (!res.headersSent) res.status(500).send('Proxying failed');
    });
  } catch (e) {
    console.error('Proxy logic crash:', e);
    if (!res.headersSent) res.status(500).send('Internal Server Error');
  }
});



// 4. Server Health & Dependency Check
app.get('/status', (req, res) => {
  exec('yt-dlp --version', (error, stdout) => {
    if (error) {
      return res.status(500).json({ 
        status: 'degraded', 
        error: 'yt-dlp not found',
        solution: 'Execute: pip install yt-dlp'
      });
    }

    exec('ffmpeg -version', (ffErr, ffStdout) => {
      const ffmpeg = ffErr ? null : (ffStdout || '').split('\n')[0].trim();

      res.json({ 
        status: 'online', 
        version: stdout.trim(),
        ffmpeg: ffmpeg || 'missing',
        authStatus: getCookiesPath() ? 'Cookie-Loaded (Anti-Bot Active)' : 'No-Auth (High risk of block)',
        ytConfig: getCommonArgs().join(' '),
        environment: process.env.NODE_ENV || 'production',
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        engine: 'yt-dlp Core'
      });
    });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`SaveX Server active on ${HOST}:${PORT}`);
  // Diagnostics
  exec('yt-dlp --version', (err, stdout) => console.log('YT-DLP Version:', stdout?.trim()));
  exec('yt-dlp -v', (err, stdout, stderr) => {
    const jsProviders = (stderr || '').split('\n').find(l => l.includes('JS Challenge Providers'));
    if (jsProviders) console.log('🔍 Extraction Support:', jsProviders.trim());
  });
});
