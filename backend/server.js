require('dotenv').config();
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

// 🍪 Runtime Cookie Handler for Instagram
function getInstagramCookiesPath() {
  const COOKIE_FILE = '/tmp/instagram_cookies.txt';
  try {
    if (process.env.IG_COOKIES) {
      let content = process.env.IG_COOKIES;
      if (content.length > 100 && !content.includes('\t')) {
        content = Buffer.from(content, 'base64').toString('utf8');
      }
      fs.writeFileSync(COOKIE_FILE, content);
      return COOKIE_FILE;
    }
    const RENDER_SECRET = '/etc/secrets/instagram_cookies.txt';
    if (fs.existsSync(RENDER_SECRET)) {
      fs.copyFileSync(RENDER_SECRET, COOKIE_FILE);
      return COOKIE_FILE;
    }
  } catch (e) {
    console.error('Instagram Cookie Handler Error:', e.message);
  }
  const localPath = path.join(__dirname, 'instagram_cookies.txt');
  return fs.existsSync(localPath) ? localPath : null;
}

const COOKIES_PATH = getInstagramCookiesPath();
const YT_COOKIES_PATH = getCookiesPath();

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

// Feedback storage
const FEEDBACK_FILE = path.join(__dirname, 'feedback.json');
function loadFeedback() {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return [];
}
function saveFeedbackData(data) {
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save feedback:', e.message);
  }
}

const nodemailer = require('nodemailer');

// Submit Feedback
app.post('/feedback', async (req, res) => {
  const { name, email, message, rating, timestamp } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Missing feedback message.' });
  }

  const entry = {
    id: Date.now().toString(),
    name: (name || 'Anonymous').trim().slice(0, 100),
    email: (email || '').trim().slice(0, 200),
    message: message.trim().slice(0, 2000),
    rating: Math.min(5, Math.max(0, Number(rating) || 0)),
    timestamp: timestamp || new Date().toISOString(),
  };

  const feedback = loadFeedback();
  feedback.unshift(entry);
  saveFeedbackData(feedback.slice(0, 500)); // Keep latest 500

  console.log(`📝 New Feedback from ${entry.name}: "${entry.message.slice(0, 50)}..."`);

  // Send Email Notification
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      const mailOptions = {
        from: `"SaveX Feedback" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER, // Send to yourself
        subject: `New Feedback from ${entry.name} - ${entry.rating}⭐`,
        text: `New Feedback Received:\n\nName: ${entry.name}\nEmail: ${entry.email || 'N/A'}\nRating: ${entry.rating} Stars\nMessage:\n${entry.message}\n\nTime: ${new Date(entry.timestamp).toLocaleString()}`,
        html: `
          <h3>New SaveX Feedback</h3>
          <p><strong>Name:</strong> ${entry.name}</p>
          <p><strong>Email:</strong> ${entry.email || 'N/A'}</p>
          <p><strong>Rating:</strong> ${entry.rating} / 5 ⭐</p>
          <hr/>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap; background: #f4f4f4; padding: 10px; border-radius: 5px;">${entry.message}</p>
          <hr/>
          <p><small>Time: ${new Date(entry.timestamp).toLocaleString()}</small></p>
        `,
      };

      // Send email asynchronously without blocking the response
      transporter.sendMail(mailOptions).catch(err => {
        console.error('Failed to send feedback email:', err.message);
      });
    } catch (err) {
      console.error('Error setting up nodemailer:', err.message);
    }
  }

  return res.json({ success: true, message: 'Feedback received!' });
});

// Get Feedback (for developer)
app.get('/feedback', (req, res) => {
  const feedback = loadFeedback();
  return res.json({ feedback, total: feedback.length });
});

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
    s.includes('too many requests') ||
    s.includes('only images are available') ||
    s.includes('requested format is not available')
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
      const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
      const response = await axios.post(`${instance}/`, {
        url: videoUrl,
        videoQuality: videoQuality,
        ...(isYouTube ? { youtubeVideoCodec: 'h264' } : {}),
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
    '--retries', '3',
    '--no-check-certificates'
  ];
  
  // Automatically try to use node for javascript runtimes if available (fixes n-sig challenges)
  args.push('--js-runtimes', 'node');
  
  // Explicitly allow remote component for External JS challenge solver (fixes new YouTube algo)
  args.push('--remote-components', 'ejs:github');

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

// YouTube Info Endpoint — Direct yt-dlp (fastest path)
app.post('/youtube/info', async (req, res) => {
  const { url } = req.body || {};
  if (!isValidYouTubeUrl(url)) return res.status(400).json({ error: 'Not a YouTube Link', message: 'That doesn\'t look like a YouTube link. Please paste a link from youtube.com or youtu.be.' });

  const cleanUrl = url.trim();
  const videoId = extractYouTubeVideoId(cleanUrl);

  // Direct yt-dlp extraction (Cobalt & Innertube are currently dead)
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
    
    // Immediate Error Handling as requested
    if (details.includes('Only images are available') || details.includes('Requested format is not available')) {
       return res.status(400).json({ 
         error: 'Video Not Supported', 
         message: 'This link cannot be processed because it either contains only images or the requested format is not available on YouTube.' 
       });
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

const ytdl = require('@distube/ytdl-core');

// Proxy Streaming Endpoint — Avoids IP restrictions by streaming directly through our server!
app.get('/youtube/stream', async (req, res) => {
  const { url, kind, h } = req.query || {};
  if (!url) return res.status(400).send('No URL provided');

  try {
    const isValid = ytdl.validateURL(url);
    if (!isValid) return res.status(400).send('Invalid YouTube URL');

    const info = await ytdl.getInfo(url);
    let format;

    if (kind === 'audio') {
      format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
      res.setHeader('Content-Type', 'audio/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="youtube_audio_${Date.now()}.m4a"`);
    } else {
      const height = parseInt(h) || 720;
      format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: (f) => f.container === 'mp4' && f.hasAudio && f.hasVideo && f.height <= height });
      if (!format) {
        format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: (f) => f.container === 'mp4' && f.hasAudio && f.hasVideo });
      }
      if (!format) {
        format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'audioandvideo' });
      }
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="youtube_video_${Date.now()}.mp4"`);
    }

    if (format && format.contentLength) {
      res.setHeader('Content-Length', format.contentLength);
    }

    ytdl(url, { format }).pipe(res);

  } catch (err) {
    console.error('ytdl-core streaming error:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Streaming failed.');
    }
  }
});

// YouTube Download Endpoint — Returns the proxy URL to the client
app.post('/youtube/download', async (req, res) => {
  const { url, kind, maxHeight, quality, format } = req.body || {};
  if (!isValidYouTubeUrl(url)) return res.status(400).json({ error: 'Not a YouTube Link', message: 'That doesn\'t look like a YouTube link. Please paste a link from youtube.com or youtu.be.' });

  const dlKind = kind || (format === 'mp3' ? 'audio' : 'video');
  const h = Number(maxHeight || (String(quality).replace('p', '')) || 720);

  // Construct our own proxy URL
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const proxyUrl = `${protocol}://${host}/youtube/stream?url=${encodeURIComponent(url.trim())}&kind=${dlKind}&h=${h}`;

  return res.json({
    downloadUrl: proxyUrl,
    title: 'YouTube Download',
    success: true,
    source: 'proxy'
  });
});

// ============================================================
// 1A. Download REEL Endpoint — Strictly VIDEO extraction
// ============================================================
app.post('/download/reel', async (req, res) => {
  const { reelUrl } = req.body;

  if (!reelUrl) {
    return res.status(400).json({ error: 'No Link Provided', message: 'Please paste an Instagram Reel link first.' });
  }

  const cleanUrl = reelUrl.trim();
  console.log('Starting REEL (video) extraction for:', cleanUrl);

  // Direct yt-dlp extraction (Cobalt instances are currently dead)
  const args = [
    '-g',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--geo-bypass',
    '--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best',
    '--add-header', 'Sec-Ch-Ua: "Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    '--referer', 'https://www.instagram.com/'
  ];

  if (COOKIES_PATH) {
    args.push('--cookies', COOKIES_PATH);
  } else {
    args.push('--cookies-from-browser', 'chrome', '--cookies-from-browser', 'edge', '--cookies-from-browser', 'brave');
  }

  args.push(cleanUrl);

  try {
    const { stdout } = await runYtDlp(args, { timeoutMs: 30000 });
    const videoUrl = stdout.trim().split('\n')[0];

    if (!videoUrl || !videoUrl.startsWith('http')) {
      return res.status(404).json({
        error: 'Could Not Get Video',
        message: 'We couldn\'t extract the video from this Reel. Instagram might be blocking us — please try again in a few minutes.'
      });
    }

    res.json({ videoUrl, type: 'video' });
  } catch (error) {
    const stderr = error.stderr || '';
    const message = error.err?.message || '';
    console.error('Reel Extraction Error:', stderr || message);

    let errorMsg = 'Something Went Wrong';
    let subMsg = 'We couldn\'t get this Reel. The link might be broken or the reel may no longer exist.';
    let statusCode = 500;

    if (stderr.includes('Login required') || stderr.includes('Private') || stderr.includes('private') || stderr.includes('login_required') || stderr.includes('login required')) {
      errorMsg = 'This Account is Private';
      subMsg = 'This Reel belongs to a private account. We can only download Reels from public accounts.';
      statusCode = 403;
    } else if (stderr.includes('404') || stderr.includes('Not Found') || stderr.includes('does not exist')) {
      errorMsg = 'Reel Not Found';
      subMsg = 'This Reel has been deleted or the link is wrong. Please double-check the link and try again.';
      statusCode = 404;
    } else if (error.err?.killed || message.includes('timeout')) {
      errorMsg = 'Taking Too Long';
      subMsg = 'The request is taking too long. This can happen with large videos or when Instagram is slow. Please try again.';
      statusCode = 504;
    } else if (stderr.includes('Sign in') || stderr.includes('Rate limit') || stderr.includes('429') || stderr.includes('too many') || stderr.includes('login required')) {
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
});

// ============================================================
// 1B. Download POST Endpoint — Strictly IMAGE/PHOTO extraction
// ============================================================
app.post('/download/post', async (req, res) => {
  const { reelUrl } = req.body;

  if (!reelUrl) {
    return res.status(400).json({ error: 'No Link Provided', message: 'Please paste an Instagram Post link first.' });
  }

  const cleanUrl = reelUrl.trim();
  console.log('Starting POST (image) extraction for:', cleanUrl);

  // Direct yt-dlp extraction (Cobalt instances are currently dead)
  const args = [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--geo-bypass',
    '--ignore-no-formats-error',
    '--add-header', 'Sec-Ch-Ua: "Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    '--referer', 'https://www.instagram.com/'
  ];

  if (COOKIES_PATH) {
    args.push('--cookies', COOKIES_PATH);
  } else {
    args.push('--cookies-from-browser', 'chrome', '--cookies-from-browser', 'edge', '--cookies-from-browser', 'brave');
  }

  args.push(cleanUrl);

  try {
    const { stdout } = await runYtDlp(args, { timeoutMs: 45000 });

    // yt-dlp may output multiple JSON lines for carousel posts
    const jsonLines = stdout.trim().split('\n').filter(line => {
      try { JSON.parse(line); return true; } catch { return false; }
    });

    const images = [];
    for (const line of jsonLines) {
      const info = JSON.parse(line);
      // Priority: url > thumbnail > thumbnails array
      if (info.url && !info.url.includes('.mp4')) {
        images.push(info.url);
      } else if (info.thumbnail) {
        images.push(info.thumbnail);
      } else if (info.thumbnails && info.thumbnails.length > 0) {
        // Pick the highest resolution thumbnail
        const sorted = [...info.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
        images.push(sorted[0].url);
      } else if (info.url) {
        // Even if it's mp4, still offer it
        images.push(info.url);
      }
    }

    if (images.length === 0) {
      return res.status(404).json({
        error: 'Could Not Get Photos',
        message: 'We couldn\'t find any downloadable images at this link. The post may have been deleted or is from a private account.'
      });
    }

    res.json({ images, type: 'image' });
  } catch (error) {
    const stderr = error.stderr || '';
    const message = error.err?.message || '';
    console.error('Post Extraction Error:', stderr || message);

    let errorMsg = 'Something Went Wrong';
    let subMsg = 'We couldn\'t get this post. The link might be broken or the post may no longer exist.';
    let statusCode = 500;

    if (stderr.includes('Login required') || stderr.includes('Private') || stderr.includes('private') || stderr.includes('login_required') || stderr.includes('login required')) {
      errorMsg = 'This Account is Private';
      subMsg = 'This post belongs to a private account. We can only download from public accounts.';
      statusCode = 403;
    } else if (stderr.includes('404') || stderr.includes('Not Found') || stderr.includes('does not exist')) {
      errorMsg = 'Post Not Found';
      subMsg = 'This post has been deleted or the link is wrong. Please double-check the link and try again.';
      statusCode = 404;
    } else if (error.err?.killed || message.includes('timeout')) {
      errorMsg = 'Taking Too Long';
      subMsg = 'The request is taking too long. Please try again.';
      statusCode = 504;
    } else if (stderr.includes('Sign in') || stderr.includes('Rate limit') || stderr.includes('429') || stderr.includes('too many') || stderr.includes('login required')) {
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
});

// Legacy compat: old /download route redirects to /download/reel
app.post('/download', async (req, res) => {
  // Forward to the reel endpoint for backward compatibility
  req.url = '/download/reel';
  app.handle(req, res);
});

// 2. View Stories Endpoint (Robust yt-dlp extraction)
app.get('/stories/:username', async (req, res) => {
  const { username } = req.params;
  const target = username.trim().replace('@', '');
  
  console.log(`Starting Story extraction for user: ${target}`);
  
  const storyUrl = `https://www.instagram.com/stories/${target}/`;

  // Direct yt-dlp extraction (Cobalt instances are currently dead)
  const args = [
    '-g',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--geo-bypass',
    '--format', 'best[ext=mp4]/best',
    '--add-header', 'Accept-Language: en-US,en;q=0.9',
    '--add-header', 'Sec-Ch-Ua: "Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    '--referer', 'https://www.instagram.com/'
  ];

  if (COOKIES_PATH && fs.existsSync(COOKIES_PATH)) {
    args.push('--cookies', COOKIES_PATH);
  } else {
    args.push('--cookies-from-browser', 'chrome', '--cookies-from-browser', 'edge', '--cookies-from-browser', 'brave');
  }

  args.push(storyUrl);

  try {
    const { stdout } = await runYtDlp(args, { timeoutMs: 60000 });
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
  } catch (error) {
    const stderr = error.stderr || '';
    const message = error.err?.message || '';
    console.warn('Story Extraction Issue:', stderr || message);
    
    let errorMsg = 'No Stories Right Now';
    let subMsg = 'This user hasn\'t posted any stories in the last 24 hours. Stories only last 24 hours, so check back later!';
    let statusCode = 404;

    if (stderr.includes('Login required') || stderr.includes('login_required') || stderr.includes('Private') || stderr.includes('private') || stderr.includes('login required')) {
      errorMsg = 'This Account is Private';
      subMsg = 'This is a private account, so their stories are hidden. You can only view stories from public accounts.';
      statusCode = 403;
    } else if (stderr.includes('404') || stderr.includes('Not Found') || stderr.includes('does not exist') || stderr.includes('User not found')) {
      errorMsg = 'User Does Not Exist';
      subMsg = 'We couldn\'t find anyone with that username on Instagram. Please check the spelling and try again.';
      statusCode = 404;
    } else if (stderr.includes('Sign in') || stderr.includes('Rate limit') || stderr.includes('429') || stderr.includes('too many') || stderr.includes('login required')) {
      errorMsg = 'Too Many Requests';
      subMsg = 'Instagram is temporarily limiting our access. Please wait a minute or two and try again.';
      statusCode = 429;
    } else if (error.err?.killed || message.includes('timeout')) {
      errorMsg = 'Taking Too Long';
      subMsg = 'The request is taking too long. Instagram might be slow right now. Please try again.';
      statusCode = 504;
    }

    return res.status(statusCode).json({ error: errorMsg, message: subMsg });
  }
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
