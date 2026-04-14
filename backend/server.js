const express = require('express');
const cors = require('cors');
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
    s.includes('this helps protect our community')
  );
}

function looksLikeYouTubeSignatureIssue(stderr) {
  const s = (stderr || '').toLowerCase();
  return (
    (s.includes('signature') && s.includes('failed')) ||
    s.includes('nsig') ||
    s.includes('some formats may be missing') ||
    s.includes('only images are available') ||
    s.includes('requested format is not available') ||
    s.includes('challenge solving failed')
  );
}

// 🎥 YouTube Recommended Combined Fix (Bypass n-Challenge)
const YT_COMMON_ARGS = [
  '--extractor-args', 'youtube:player_client=android,ios',
  '--force-ipv4',
  '--no-check-certificates',
  '--geo-bypass',
  '--user-agent', 'com.google.android.youtube/17.31.35 (Linux; U; Android 11)',
  '--add-header', 'Accept-Language:en-US,en;q=0.9'
];

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
    .map(h => ({ key: String(h), label: `${h}p`, maxHeight: h }));
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

// YouTube Info Endpoint
app.post('/youtube/info', async (req, res) => {
  const { url } = req.body || {};
  if (!isValidYouTubeUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

  try {
    // Single robust attempt with extended timeout
    const { stdout } = await runYtDlp([
      '--dump-json',
      '--no-playlist',
      ...YT_COMMON_ARGS,
      url.trim()
    ], { timeoutMs: 180000 }); // 3 min timeout for Render concurrency

    const info = JSON.parse(stdout.trim());
    return res.json({
      title: info.title || '',
      thumbnail: info.thumbnail || '',
      duration: info.duration_string || secondsToDuration(info.duration),
      videoId: info.id || '',
      videoOptions: buildYoutubeVideoOptions(info),
    });
  } catch (e) {
    const details = e.stderr || e.err?.message || 'Extraction Timed Out';
    console.error('YouTube info error:', details);
    return res.status(503).json({
      error: 'Extraction Failed',
      message: 'YouTube is currently restricting server access. Please try again or check server health.',
      details: process.env.NODE_ENV === 'development' ? details : undefined
    });
  }
});

// YouTube: Download to server + return file URL
// YouTube Download Endpoint
app.post('/youtube/download', async (req, res) => {
  const { url, kind, maxHeight, quality, format } = req.body || {};
  if (!isValidYouTubeUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

  const dlKind = kind || (format === 'mp3' ? 'audio' : 'video');
  const targetExt = dlKind === 'video' ? 'mp4' : 'mp3';
  const id = `${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  const baseName = `savex_${id}`;
  const outputTemplate = path.join('/tmp', `${baseName}.%(ext)s`);
  const finalPath = path.join('/tmp', `${baseName}.${targetExt}`);

  try {
    let args = ['--no-playlist', ...YT_COMMON_ARGS, '-o', outputTemplate];

    if (dlKind === 'video') {
      const h = Number(maxHeight || (String(quality).replace('p', '')) || 720);
      // Combined Fix Format: Priority to mp4 merged best
      args.push('-f', `best[height<=${h}][ext=mp4]/bestvideo[height<=${h}]+bestaudio/best`);
      args.push('--merge-output-format', 'mp4');
    } else {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '192K');
    }

    args.push(url.trim());

    console.log('Starting Download:', baseName);
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
    return res.status(500).json({ error: 'Download Failed', message: 'Could not process video. YouTube might be blocking the request.' });
  }
});

// 1. Download Reel Endpoint (Powered by yt-dlp)
app.post('/download', async (req, res) => {
  const { reelUrl } = req.body;

  if (!reelUrl) {
    return res.status(400).json({ error: 'Reel URL is required' });
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
      
      let errorMsg = 'Extraction Failed';
      let subMsg = 'We couldn\'t process this link. It might be broken or private.';
      let statusCode = 500;

      if (stderr.includes('Login required') || stderr.includes('Private')) {
        errorMsg = 'Private Account';
        subMsg = 'This account is private. We need authenticated access to download this.';
        statusCode = 403;
      } else if (stderr.includes('404') || stderr.includes('Not Found')) {
        errorMsg = 'Video Not Found';
        subMsg = 'This Reel might have been deleted or the link is incorrect.';
        statusCode = 404;
      } else if (error.killed) {
        errorMsg = 'Server Timeout';
        subMsg = 'Render taking too long to process. The video might be too large or Instagram is slow.';
        statusCode = 504;
      } else if (stderr.includes('Sign in') || stderr.includes('Rate limit')) {
        errorMsg = 'Instagram Blocked Us';
        subMsg = 'Instagram is temporarily blocking our server. Please try again later.';
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
        error: 'Engine Busy', 
        message: 'Instagram is blocking us right now. Please try again in a few minutes!' 
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
      
      let errorMsg = 'No Stories Found';
      let subMsg = 'This user hasn\'t posted any stories in the last 24 hours.';
      let statusCode = 404;

      if (stderr.includes('Login required') || stderr.includes('Private')) {
        errorMsg = 'Private Account';
        subMsg = 'This profile is private, so we can\'t see their stories.';
        statusCode = 403;
      } else if (stderr.includes('404')) {
        errorMsg = 'User Not Found';
        subMsg = 'We couldn\'t find anyone with that username.';
        statusCode = 404;
      } else if (error.killed) {
        errorMsg = 'Engine Timeout';
        subMsg = 'The story extraction engine timed out. Please try again.';
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
      return res.status(404).json({ error: 'No active stories detected.' });
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
        authStatus: fs.existsSync(COOKIES_PATH) ? 'Authenticated (File)' : 'Auto-Auth',
        ytQueries: {
          mobile: YT_MOBILE_ARGS.join(' '),
          web: YT_WEB_ARGS.join(' ')
        },
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
