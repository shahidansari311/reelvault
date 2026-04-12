const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Essential for Render/Production environments

const COOKIES_LOCAL = path.join(__dirname, 'instagram_cookies.txt');
const COOKIES_RENDER = '/etc/secrets/instagram_cookies.txt';
const COOKIES_TMP = '/tmp/instagram_cookies.txt';

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

app.use(cors());
app.use(express.json());

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

  // 3. Execute yt-dlp with "Stealth" and "Performance" flags
  const command = `yt-dlp -g ${authFlag} --no-playlist --no-warnings --no-check-certificates --geo-bypass --format "mp4" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --referer "https://www.instagram.com/" "${cleanUrl}"`;
  
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
  
  // 2. Check for Authentication (Priority: Manual File > Local Browser Auto-Auth)
  const authFlag = fs.existsSync(COOKIES_PATH) 
    ? `--cookies "${COOKIES_PATH}"` 
    : `--cookies-from-browser chrome --cookies-from-browser edge --cookies-from-browser brave`;

  // 3. Use yt-dlp to fetch all active stories (Mobile Spoofing Mode)
  const storyUrl = `https://www.instagram.com/stories/${target}/`;
  const command = `yt-dlp -g ${authFlag} --no-playlist --no-warnings --no-check-certificates --geo-bypass --flat-playlist --add-header "Accept-Language: en-US,en;q=0.9" --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" --referer "https://www.instagram.com/" "${storyUrl}"`;

  exec(command, { timeout: 45000 }, (error, stdout, stderr) => {
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

// 3. Server Health & Dependency Check
app.get('/status', (req, res) => {
  exec('yt-dlp --version', (error, stdout) => {
    if (error) {
      return res.status(500).json({ 
        status: 'degraded', 
        error: 'yt-dlp not found',
        solution: 'Execute: pip install yt-dlp'
      });
    }
    
    res.json({ 
      status: 'online', 
      version: stdout.trim(),
      authStatus: fs.existsSync(COOKIES_PATH) ? 'Authenticated (File)' : 'Auto-Auth (Warning: Browser auth is disabled on servers)',
      environment: process.env.NODE_ENV || 'production',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      engine: 'yt-dlp Core'
    });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`REELVAULT Server active on ${HOST}:${PORT}`);
});
