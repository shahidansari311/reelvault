require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

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
    // Local fallback with copy to /tmp to prevent snap permission denied errors
    const localPath = path.join(__dirname, 'instagram_cookies.txt');
    if (fs.existsSync(localPath)) {
      fs.copyFileSync(localPath, COOKIE_FILE);
      return COOKIE_FILE;
    }
  } catch (e) {
    console.error('Instagram Cookie Handler Error:', e.message);
  }
  return null;
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

const IG_DOWNLOADS_DIR = path.join(__dirname, 'downloads', 'instagram');
try {
  fs.mkdirSync(IG_DOWNLOADS_DIR, { recursive: true });
} catch (e) {
  console.error('Failed to create Instagram downloads dir', e);
}

app.use('/instagram/files', express.static(IG_DOWNLOADS_DIR, {
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

// ─── Email Transporter (created once, verified on startup) ─────────
let emailTransporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    // Pool connections for reliability
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });

  // Verify credentials on startup — this catches bad App Passwords immediately
  emailTransporter.verify()
    .then(() => console.log('✅ Email transporter ready (Gmail authenticated)'))
    .catch((err) => {
      console.error('❌ Email transporter FAILED to verify:', err.message);
      console.error('   → Check GMAIL_USER and GMAIL_PASS in .env');
      console.error('   → If using Gmail, you MUST use an App Password (not your real password)');
      console.error('   → Generate one at: https://myaccount.google.com/apppasswords');
      emailTransporter = null; // Disable email so the route doesn't hang
    });
} else {
  console.warn('⚠️  Email notifications disabled: GMAIL_USER or GMAIL_PASS not set in .env');
}

// Simple HTML escaping to prevent XSS in email body
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Submit Feedback
app.post('/feedback', async (req, res) => {
  const { name, email, message, rating, timestamp } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, error: 'Missing feedback message.' });
  }

  const entry = {
    id: Date.now().toString(),
    name: (name || 'Anonymous').trim().slice(0, 100),
    email: (email || '').trim().slice(0, 200),
    message: message.trim().slice(0, 2000),
    rating: Math.min(5, Math.max(0, Number(rating) || 0)),
    timestamp: timestamp || new Date().toISOString(),
  };

  // Always save to JSON file first (never lose feedback even if email fails)
  const feedback = loadFeedback();
  feedback.unshift(entry);
  saveFeedbackData(feedback.slice(0, 500));

  console.log(`📝 New Feedback from ${entry.name}: "${entry.message.slice(0, 50)}..."`);

  // Send Email Notification (awaited so we can report failure to user)
  let emailSent = false;
  if (emailTransporter) {
    const safeName = escapeHtml(entry.name);
    const safeEmail = escapeHtml(entry.email);
    const safeMessage = escapeHtml(entry.message);
    const starIcons = '⭐'.repeat(entry.rating) + '☆'.repeat(5 - entry.rating);
    const recipientEmail = process.env.FEEDBACK_TO || process.env.GMAIL_USER;

    const mailOptions = {
      from: `"SaveX Feedback" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      replyTo: entry.email || undefined,
      subject: `[SaveX] ${entry.rating > 0 ? `${starIcons} ` : ''}Feedback from ${entry.name}`,
      text: [
        `New Feedback Received`,
        ``,
        `Name: ${entry.name}`,
        `Email: ${entry.email || 'N/A'}`,
        `Rating: ${entry.rating}/5`,
        ``,
        `Message:`,
        entry.message,
        ``,
        `Time: ${new Date(entry.timestamp).toLocaleString()}`,
      ].join('\n'),
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #fafafa; border-radius: 16px; overflow: hidden; border: 1px solid #e0e0e0;">
          <div style="background: linear-gradient(135deg, #B4B9FF 0%, #8B5CF6 100%); padding: 24px 28px;">
            <h2 style="margin: 0; color: #000; font-size: 20px; font-weight: 800;">📩 New Feedback</h2>
            <p style="margin: 4px 0 0; color: rgba(0,0,0,0.6); font-size: 13px;">SaveX App Feedback Form</p>
          </div>
          <div style="padding: 24px 28px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600; width: 80px; vertical-align: top;">Name</td>
                <td style="padding: 10px 0; color: #111; font-weight: 500;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600; vertical-align: top;">Email</td>
                <td style="padding: 10px 0; color: #111;">
                  ${safeEmail ? `<a href="mailto:${safeEmail}" style="color: #8B5CF6; text-decoration: none;">${safeEmail}</a>` : '<span style="color: #999;">Not provided</span>'}
                </td>
              </tr>
              ${entry.rating > 0 ? `
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600; vertical-align: top;">Rating</td>
                <td style="padding: 10px 0; font-size: 18px;">${starIcons} <span style="font-size: 13px; color: #666;">(${entry.rating}/5)</span></td>
              </tr>
              ` : ''}
            </table>
            <div style="margin-top: 16px; padding: 16px; background: #f0f0f0; border-radius: 12px; border-left: 4px solid #8B5CF6;">
              <p style="margin: 0 0 6px; color: #666; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Message</p>
              <p style="margin: 0; color: #222; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
            </div>
            <p style="margin: 20px 0 0; color: #aaa; font-size: 11px; text-align: center;">
              ${new Date(entry.timestamp).toLocaleString()} · SaveX v1.3.0
            </p>
          </div>
        </div>
      `,
    };

    try {
      const info = await emailTransporter.sendMail(mailOptions);
      console.log('✅ Feedback email sent:', info.messageId);
      emailSent = true;
    } catch (err) {
      console.error('❌ Failed to send feedback email:', err.message);
      // Don't fail the whole request — feedback is already saved to JSON
    }
  }

  return res.json({
    success: true,
    message: 'Feedback received!',
    emailSent,
  });
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
    // Priority 3: Local file fallback with copy to /tmp to prevent snap permission denied errors
    const localPath = path.join(__dirname, 'youtube_cookies.txt');
    if (fs.existsSync(localPath)) {
      fs.copyFileSync(localPath, COOKIE_FILE);
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
      '--extractor-args', 'youtube:player_client=android',
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

// Proxy Streaming Endpoint — Avoids IP restrictions by streaming directly through our server using yt-dlp
app.get('/youtube/stream', (req, res) => {
  const { url, kind, h } = req.query || {};
  if (!url) return res.status(400).send('No URL provided');

  try {
    const height = parseInt(h) || 720;
    const format = kind === 'audio' 
      ? 'bestaudio[ext=m4a]/bestaudio/best'
      : `best[height<=${height}][ext=mp4]/best[ext=mp4]/best`;

    res.setHeader('Content-Type', kind === 'audio' ? 'audio/mp4' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="youtube_${Date.now()}.${kind === 'audio' ? 'm4a' : 'mp4'}"`);

    const args = [
      '-q', // quiet (no progress output in stdout)
      '--no-warnings', // strictly suppress warnings
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=android',
      '--buffer-size', '16K',
      ...getCommonArgs(),
      '-f', format,
      '-o', '-', // Output directly to stdout
      url.trim()
    ];

    console.log(`Piping stream: yt-dlp ${args.join(' ')}`);

    const child = spawn('yt-dlp', args);

    child.stdout.pipe(res);

    child.stderr.on('data', (data) => {
      // yt-dlp might send warnings to stderr, we just log them
      console.log(`[yt-dlp proxy] ${data.toString().trim()}`);
    });

    child.on('error', (err) => {
      console.error('Failed to start yt-dlp proxy:', err);
      if (!res.headersSent) res.status(500).send('Stream error');
    });

    req.on('close', () => {
      // If the client aborts the download, kill the yt-dlp process
      if (!child.killed) {
        console.log('Client aborted download. Killing yt-dlp stream.');
        child.kill();
      }
    });

  } catch (err) {
    console.error('Stream setup error:', err.message);
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
// Fallback chain: Method0 (RapidAPI PRIMARY) → Method1 (yt-dlp+headers)
//                 → Method2 (embed scrape) → Method3 (yt-dlp+cookies)
// ============================================================

// Helper: extract shortcode from any Instagram reel/post/p URL
function extractIgShortcode(url) {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Helper: build a clean success payload from yt-dlp JSON stdout
function parseYtDlpReelOutput(stdout) {
  let info = {};
  try { info = JSON.parse(stdout.trim()); } catch (_) {}
  const videoUrl = info.url || stdout.trim().split('\n')[0];
  let thumbnailUrl = info.thumbnail;
  if (!thumbnailUrl && Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
    thumbnailUrl = info.thumbnails[info.thumbnails.length - 1].url;
  }
  return { videoUrl, thumbnailUrl, title: info.title || '' };
}

// Helper: build public URL for a saved Instagram file
function makeIgFileUrl(req, fileName) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/instagram/files/${encodeURIComponent(fileName)}`;
}

// Helper: download a remote video URL and save it to IG_DOWNLOADS_DIR
async function downloadVideoToDisk(cdnUrl, fileName) {
  const outputPath = path.join(IG_DOWNLOADS_DIR, fileName);
  const response = await axios.get(cdnUrl, {
    responseType: 'stream',
    timeout: 60000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  return outputPath;
}

app.post('/download/reel', async (req, res) => {
  const { reelUrl } = req.body;

  if (!reelUrl) {
    return res.status(400).json({ error: 'No Link Provided', message: 'Please paste an Instagram Reel link first.' });
  }

  const cleanUrl = reelUrl.trim();
  console.log('Starting REEL (video) extraction for:', cleanUrl);

  // ── Shared browser-like headers for yt-dlp ──────────────────────────────
  const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const BASE_YTDLP_ARGS = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--geo-bypass',
    '--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best',
    '--user-agent', BROWSER_UA,
    '--add-header', 'Accept-Language: en-US,en;q=0.9',
    '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '--referer', 'https://www.instagram.com/',
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD 0 — RapidAPI Instagram Reels Downloader (PRIMARY)
  // ══════════════════════════════════════════════════════════════════════════
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '1a41f14e48mshc781d925569c851p1ab0d0jsn1571078ce222';
  const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'instagram-reels-downloader-api.p.rapidapi.com';
  try {
    console.log('[Reel] Method 0 (PRIMARY): RapidAPI Instagram Reels Downloader');
    const rapidRes = await axios.get(`https://${RAPIDAPI_HOST}/download`, {
      params: { url: cleanUrl },
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
      timeout: 25000,
    });

    const data = rapidRes.data;
    console.log('[Reel] Method 0: RapidAPI raw response keys:', Object.keys(data || {}));

    // Extract the video CDN URL from the response
    // Common shapes: { url }, { video }, { download_url }, { media }, { result: { url } }, array of items
    let cdnUrl = null;
    if (typeof data === 'string' && data.startsWith('http')) {
      cdnUrl = data;
    } else if (Array.isArray(data) && data.length > 0) {
      cdnUrl = data[0]?.url || data[0]?.download_url || data[0]?.video || data[0];
    } else if (data && typeof data === 'object') {
      cdnUrl =
        data.url ||
        data.download_url ||
        data.video ||
        data.media ||
        data.VideoURL ||
        data.result?.url ||
        data.result?.download_url ||
        (Array.isArray(data.result) && data.result[0]?.url) ||
        null;
    }

    if (cdnUrl && typeof cdnUrl === 'string' && cdnUrl.startsWith('http')) {
      // Download the video file to disk and serve it
      const fileName = `reel_${Date.now()}.mp4`;
      try {
        await downloadVideoToDisk(cdnUrl, fileName);
        const videoUrl = makeIgFileUrl(req, fileName);
        const thumbnailUrl = data?.thumbnail || data?.thumbnail_url || null;
        console.log('[Reel] Method 0 succeeded — saved as:', fileName);
        return res.json({ videoUrl, type: 'video', title: data?.title || '', thumbnailUrl });
      } catch (dlErr) {
        console.warn('[Reel] Method 0: RapidAPI CDN URL retrieved but file download failed:', dlErr.message);
        // Still return the CDN URL directly so the client can attempt it
        return res.json({ videoUrl: cdnUrl, type: 'video', title: data?.title || '', thumbnailUrl: data?.thumbnail || null });
      }
    }
    console.warn('[Reel] Method 0: RapidAPI returned no usable video URL — falling through');
  } catch (err0) {
    console.warn('[Reel] Method 0 failed:', (err0.response?.data ? JSON.stringify(err0.response.data).slice(0, 200) : err0.message?.slice(0, 200)));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD 1 — yt-dlp with browser headers (no login required)
  // ══════════════════════════════════════════════════════════════════════════
  try {
    console.log('[Reel] Method 1: yt-dlp + browser headers');
    const args = [...BASE_YTDLP_ARGS, cleanUrl];
    const { stdout } = await runYtDlp(args, { timeoutMs: 30000 });
    const { videoUrl, thumbnailUrl, title } = parseYtDlpReelOutput(stdout);

    if (videoUrl && videoUrl.startsWith('http')) {
      console.log('[Reel] Method 1 succeeded');
      return res.json({ videoUrl, type: 'video', title, thumbnailUrl });
    }
    console.warn('[Reel] Method 1: parsed empty video URL — falling through');
  } catch (err1) {
    console.warn('[Reel] Method 1 failed:', (err1.stderr || err1.err?.message || '').slice(0, 200));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD 2 — Instagram embed page scrape (no API key needed)
  // ══════════════════════════════════════════════════════════════════════════
  try {
    console.log('[Reel] Method 2: Instagram embed page scrape');
    const shortcode = extractIgShortcode(cleanUrl);
    if (!shortcode) throw new Error('Could not extract shortcode from URL');

    const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/`;
    const embedRes = await axios.get(embedUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.instagram.com/',
      },
      timeout: 15000,
    });

    const html = embedRes.data || '';
    // Try multiple patterns Instagram uses for the video src
    const patterns = [
      /video_url":"(https:[^"]+\.mp4[^"]*)"/,
      /"contentUrl":"(https:[^"]+\.mp4[^"]*)"/,
      /src="(https:\/\/[^"]+\.mp4[^"]*)"/,
      /property="og:video" content="(https:[^"]+)"/,
    ];

    let videoUrl = null;
    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m) {
        videoUrl = m[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
        break;
      }
    }

    // Thumbnail from og:image
    let thumbnailUrl = null;
    const thumbMatch = html.match(/property="og:image" content="([^"]+)"/);
    if (thumbMatch) thumbnailUrl = thumbMatch[1];

    if (videoUrl && videoUrl.startsWith('http')) {
      console.log('[Reel] Method 2 succeeded (embed scrape)');
      return res.json({ videoUrl, type: 'video', title: '', thumbnailUrl });
    }
    console.warn('[Reel] Method 2: no video URL found in embed HTML');
  } catch (err2) {
    console.warn('[Reel] Method 2 failed:', err2.message?.slice(0, 200));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // METHOD 3 — yt-dlp with cookies file (full auth fallback)
  // ══════════════════════════════════════════════════════════════════════════
  try {
    console.log('[Reel] Method 3: yt-dlp + cookies file');
    const cookiesFile = COOKIES_PATH || '/tmp/instagram_cookies.txt';

    if (!fs.existsSync(cookiesFile)) throw new Error(`Cookies file not found at ${cookiesFile}`);

    const args = [
      ...BASE_YTDLP_ARGS,
      '--cookies', cookiesFile,
      cleanUrl,
    ];
    const { stdout } = await runYtDlp(args, { timeoutMs: 45000 });
    const { videoUrl, thumbnailUrl, title } = parseYtDlpReelOutput(stdout);

    if (videoUrl && videoUrl.startsWith('http')) {
      console.log('[Reel] Method 3 succeeded (cookies)');
      return res.json({ videoUrl, type: 'video', title, thumbnailUrl });
    }
    console.warn('[Reel] Method 3: parsed empty video URL');
  } catch (err3) {
    console.warn('[Reel] Method 3 failed:', (err3.stderr || err3.err?.message || err3.message || '').slice(0, 200));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ALL METHODS EXHAUSTED — return a structured error
  // ══════════════════════════════════════════════════════════════════════════
  console.error('[Reel] All extraction methods failed for:', cleanUrl);
  return res.status(503).json({
    error: 'Could Not Download Reel',
    message: 'We tried multiple methods to download this Reel but all failed. Instagram may be rate-limiting us, the reel might be private, or the link could be invalid. Please try again later.',
  });
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
  
  if (!COOKIES_PATH || !fs.existsSync(COOKIES_PATH)) {
    return res.status(401).json({
      error: 'Instagram Session Required',
      message: 'Story downloads require a valid Instagram session cookie. Please configure `IG_COOKIES` in your environment variables or upload `instagram_cookies.txt`.'
    });
  }

  const storyUrl = `https://www.instagram.com/stories/${target}/`;

  // Direct yt-dlp extraction (Cobalt instances are currently dead)
  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--geo-bypass',
    '--format', 'best[ext=mp4]/best',
    '--cookies', COOKIES_PATH,
    '--add-header', 'Accept-Language: en-US,en;q=0.9',
    '--add-header', 'Sec-Ch-Ua: "Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    '--referer', 'https://www.instagram.com/',
    storyUrl
  ];

  try {
    const { stdout } = await runYtDlp(args, { timeoutMs: 60000 });
    
    // Parse json lines
    const jsonLines = stdout.trim().split('\n').filter(line => {
      try { JSON.parse(line); return true; } catch { return false; }
    });

    if (jsonLines.length > 0) {
      const results = jsonLines.map(line => {
        const info = JSON.parse(line);
        const url = info.url;
        let thumbnail = info.thumbnail;
        if (!thumbnail && info.thumbnails && info.thumbnails.length > 0) {
           thumbnail = info.thumbnails[info.thumbnails.length - 1].url;
        }
        return {
          type: (url && (url.includes('.mp4') || url.includes('video'))) ? 'video' : 'image',
          url: url,
          thumbnail: thumbnail || url,
          title: info.title || ''
        };
      }).filter(item => item.url);
      
      if (results.length > 0) return res.json(results);
    } 
    
    return res.status(404).json({ 
      error: 'No Stories Right Now', 
      message: 'This user hasn\'t posted any stories in the last 24 hours. Stories only last 24 hours, so check back later!' 
    });
  } catch (error) {
    const stderr = error.stderr || '';
    const message = error.err?.message || '';
    console.warn('Story Extraction Issue:', stderr || message);
    
    let errorMsg = 'No Stories Right Now';
    let subMsg = 'This user hasn\'t posted any stories in the last 24 hours. Stories only last 24 hours, so check back later!';
    let statusCode = 404;

    if (stderr.includes('Login required') || stderr.includes('login_required') || stderr.includes('login required')) {
      errorMsg = 'Instagram Session Expired';
      subMsg = 'The Instagram login session cookie has expired or the account has been limited. Please generate new cookies and update the backend settings.';
      statusCode = 401;
    } else if (stderr.includes('Private') || stderr.includes('private')) {
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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://www.instagram.com/',
      'Accept': '*/*',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: url,
      headers: headers,
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 20000,
      validateStatus: () => true // Allow any status code to pass through
    });

    res.status(response.status);
    
    const responseHeaders = {
      'Content-Type': response.headers['content-type'] || 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    };

    if (response.headers['content-length']) responseHeaders['Content-Length'] = response.headers['content-length'];
    if (response.headers['content-range']) responseHeaders['Content-Range'] = response.headers['content-range'];
    if (response.headers['accept-ranges']) responseHeaders['Accept-Ranges'] = response.headers['accept-ranges'];

    res.set(responseHeaders);
    
    response.data.pipe(res);
    
    response.data.on('error', (err) => {
      console.error('Stream Error:', err);
      if (!res.headersSent) res.status(500).send('Stream interrupted');
    });

  } catch (e) {
    console.error('Proxy logic crash:', e.message);
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

const deleteOldFiles = (dir) => {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > oneHour) {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Deleted file: ${filePath}`);
      }
    }
  } catch (err) {
    console.error(`[Cleanup] Error cleaning directory ${dir}:`, err.message);
  }
};

// Keep-Alive Self-Ping Cron Job (every 14 minutes)
cron.schedule('*/14 * * * *', async () => {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) {
    console.log('[Keep-Alive] RENDER_EXTERNAL_URL env var not set. Skipping self-ping.');
    return;
  }
  try {
    console.log(`[Keep-Alive] Sending ping to self: ${url}/ping`);
    const res = await axios.get(`${url}/ping`);
    console.log(`[Keep-Alive] Self-ping response: ${res.status}`);
  } catch (err) {
    console.error('[Keep-Alive] Self-ping failed:', err.message);
  }
});

// Cleanup Cron Job (every hour)
cron.schedule('0 * * * *', () => {
  console.log('[Cleanup] Running hourly download folder cleanup...');
  deleteOldFiles(YT_DOWNLOADS_DIR);
  deleteOldFiles(IG_DOWNLOADS_DIR);
});

app.listen(PORT, HOST, () => {
  console.log(`SaveX Server active on ${HOST}:${PORT}`);
  
  // Initial cleanup on launch
  deleteOldFiles(YT_DOWNLOADS_DIR);
  deleteOldFiles(IG_DOWNLOADS_DIR);
  
  // Diagnostics
  exec('yt-dlp --version', (err, stdout) => console.log('YT-DLP Version:', stdout?.trim()));
  exec('yt-dlp -v', (err, stdout, stderr) => {
    const jsProviders = (stderr || '').split('\n').find(l => l.includes('JS Challenge Providers'));
    if (jsProviders) console.log('🔍 Extraction Support:', jsProviders.trim());
  });
});
