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
    engine: 'ReelVault Core',
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

function pickAvailableMp4Qualities(info) {
  const allowed = [360, 720, 1080];
  const heights = new Set();
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  for (const f of formats) {
    const h = Number(f?.height);
    if (!h || !Number.isFinite(h)) continue;
    // Only consider formats that contain video
    if (f?.vcodec && f.vcodec !== 'none') {
      heights.add(h);
    }
  }
  const available = allowed.filter((a) => Array.from(heights).some((h) => h === a || h > a));
  // If video has only e.g. 480p, reflect that by enabling 360p only.
  if (available.length === 0) {
    const maxH = Math.max(0, ...Array.from(heights));
    if (maxH > 0) {
      return allowed.filter((a) => a <= maxH).map((h) => `${h}p`);
    }
  }
  return available.map((h) => `${h}p`);
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

// YouTube: Fetch Info (yt-dlp)
app.post('/youtube/info', async (req, res) => {
  const { url } = req.body || {};
  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid link', message: 'Please paste a valid YouTube link.' });
  }

  try {
    const authArgs = fs.existsSync(YT_COOKIES_PATH) ? ['--cookies', YT_COOKIES_PATH] : [];
    const { stdout } = await runYtDlp(['--dump-json', '--no-playlist', '--skip-download', ...authArgs, url.trim()], { timeoutMs: 30000 });
    const info = JSON.parse(stdout.trim());
    return res.json({
      title: info.title || '',
      thumbnail: info.thumbnail || '',
      duration: info.duration_string || secondsToDuration(info.duration),
      availableMp4Qualities: pickAvailableMp4Qualities(info),
    });
  } catch (e) {
    const details = (e && (e.stderr || e.err?.message || '')) || '';
    console.error('YouTube info error:', details);
    if (looksLikeYouTubeBotCheck(details)) {
      return res.status(403).json({
        error: 'YouTube Requires Sign-in',
        message: 'YouTube is blocking this server. Add YouTube cookies to the backend (Render Secret: youtube_cookies.txt) and try again.',
        details: process.env.NODE_ENV === 'development' ? details : undefined
      });
    }
    return res.status(500).json({
      error: 'Extraction Failed',
      message: 'Could not fetch YouTube info. Please try again.',
      details: process.env.NODE_ENV === 'development' ? details : undefined
    });
  }
});

// YouTube: Download to server + return file URL
app.post('/youtube/download', async (req, res) => {
  const { url, format, quality } = req.body || {};

  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid link', message: 'Please paste a valid YouTube link.' });
  }
  if (format !== 'mp4' && format !== 'mp3') {
    return res.status(400).json({ error: 'Invalid format', message: 'format must be mp4 or mp3.' });
  }

  const q = String(quality || '').trim();
  const mp4Qualities = new Set(['360p', '720p', '1080p']);
  const mp3Qualities = new Set(['128', '192', '320']);
  if (format === 'mp4' && !mp4Qualities.has(q)) {
    return res.status(400).json({ error: 'Invalid quality', message: 'For mp4, quality must be 360p, 720p, or 1080p.' });
  }
  if (format === 'mp3' && !mp3Qualities.has(q)) {
    return res.status(400).json({ error: 'Invalid quality', message: 'For mp3, quality must be 128, 192, or 320.' });
  }

  const cleanUrl = url.trim();

  // Always extract metadata first for preview response fields
  let title = '';
  let thumbnail = '';
  let duration = '';
  let infoJson = null;
  try {
    const authArgs = fs.existsSync(YT_COOKIES_PATH) ? ['--cookies', YT_COOKIES_PATH] : [];
    const { stdout } = await runYtDlp(['--dump-json', '--no-playlist', '--skip-download', ...authArgs, cleanUrl], { timeoutMs: 30000 });
    const info = JSON.parse(stdout.trim());
    infoJson = info;
    title = info.title || '';
    thumbnail = info.thumbnail || '';
    duration = info.duration_string || secondsToDuration(info.duration);
  } catch (e) {
    // Non-fatal: still attempt download
    console.warn('YouTube metadata fetch failed; continuing to download');
  }

  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const ext = format === 'mp4' ? 'mp4' : 'mp3';
  const baseName = `reelvault_youtube_${id}`;
  const fileName = `${baseName}.${ext}`;
  const outputTemplate = path.join(YT_DOWNLOADS_DIR, `${baseName}.%(ext)s`);
  const outputPath = path.join(YT_DOWNLOADS_DIR, fileName);

  try {
    const commonArgs = ['--no-playlist', '--no-warnings', '--no-check-certificates', '--geo-bypass'];
    const authArgs = fs.existsSync(YT_COOKIES_PATH) ? ['--cookies', YT_COOKIES_PATH] : [];

    let args;
    if (format === 'mp4') {
      const requested = Number(q.replace('p', ''));
      const height = infoJson ? resolveHeightForRequest(requested, infoJson) : requested;
      args = [
        ...commonArgs,
        ...authArgs,
        '-f', `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best/bestvideo+bestaudio/best`,
        '--merge-output-format', 'mp4',
        '-o', outputTemplate,
        cleanUrl
      ];
    } else {
      args = [
        ...commonArgs,
        ...authArgs,
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', `${q}K`,
        '-o', outputTemplate,
        cleanUrl
      ];
    }

    await runYtDlp(args, { timeoutMs: 10 * 60 * 1000 });

    if (!fs.existsSync(outputPath)) {
      // Fallback: try to find any file matching the baseName (yt-dlp can vary extension)
      const candidates = fs.readdirSync(YT_DOWNLOADS_DIR).filter(f => f.startsWith(`${baseName}.`));
      const picked = candidates.find(f => f.endsWith(`.${ext}`)) || candidates[0];
      if (picked) {
        const finalName = picked;
        const downloadUrl = makePublicDownloadUrl(req, finalName);
        return res.json({ downloadUrl, title, thumbnail, duration });
      }
      return res.status(500).json({ error: 'Download Failed', message: 'The file could not be generated.' });
    }

    const downloadUrl = makePublicDownloadUrl(req, fileName);
    return res.json({ downloadUrl, title, thumbnail, duration });
  } catch (e) {
    const details = (e && (e.stderr || e.err?.message || '')) || '';
    console.error('YouTube download error:', details);
    if (looksLikeFfmpegMissing(details)) {
      return res.status(500).json({
        error: 'Server Missing ffmpeg',
        message: 'This server needs ffmpeg to merge MP4 or convert MP3. Install ffmpeg and try again.',
        details: process.env.NODE_ENV === 'development' ? details : undefined
      });
    }
    if (looksLikeYouTubeBotCheck(details)) {
      return res.status(403).json({
        error: 'YouTube Requires Sign-in',
        message: 'YouTube is blocking this server. Add YouTube cookies to the backend (Render Secret: youtube_cookies.txt) and try again.',
        details: process.env.NODE_ENV === 'development' ? details : undefined
      });
    }
    return res.status(500).json({
      error: 'Download Failed',
      message: 'Could not download this video with the selected settings. Please try again.',
      details: process.env.NODE_ENV === 'development' ? details : undefined
    });
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
        authStatus: fs.existsSync(COOKIES_PATH) ? 'Authenticated (File)' : 'Auto-Auth (Warning: Browser auth is disabled on servers)',
        environment: process.env.NODE_ENV || 'production',
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        engine: 'yt-dlp Core'
      });
    });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`REELVAULT Server active on ${HOST}:${PORT}`);
});
