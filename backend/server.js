const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const COOKIES_PATH = path.join(__dirname, 'instagram_cookies.txt');

app.use(cors());
app.use(express.json());

// 1. Download Reel Endpoint (Powered by yt-dlp)
app.post('/download', async (req, res) => {
  const { reelUrl } = req.body;

  if (!reelUrl) {
    return res.status(400).json({ error: 'Reel URL is required' });
  }

  // 1. Sanitize the URL
  const cleanUrl = reelUrl.split('?')[0];
  console.log('Starting Reel extraction for:', cleanUrl);

  // 2. Check for Authentication (Priority: Manual File > Local Browser Auto-Auth)
  const authFlag = fs.existsSync(COOKIES_PATH) 
    ? `--cookies "${COOKIES_PATH}"` 
    : `--cookies-from-browser chrome --cookies-from-browser edge --cookies-from-browser brave`;

  // 3. Execute yt-dlp with "Stealth" and "Performance" flags
  const command = `yt-dlp -g ${authFlag} --no-playlist --no-warnings --no-check-certificates --geo-bypass --format "mp4" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --referer "https://www.instagram.com/" "${cleanUrl}"`;
  console.log('Running Performance Command:', command);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Extraction Error:', stderr);
      
      let errorMsg = 'Oops! Broken Link';
      let subMsg = 'We couldn\'t find a video at this link. Please check it and try again.';
      let statusCode = 500;

      if (stderr.includes('Login required') || stderr.includes('Private')) {
        errorMsg = 'Private Account';
        subMsg = 'This account is private, so we can\'t download from it.';
        statusCode = 403;
      } else if (stderr.includes('404')) {
        errorMsg = 'Video Missing';
        subMsg = 'This video might have been deleted or moved.';
        statusCode = 404;
      }

      return res.status(statusCode).json({ error: errorMsg, message: subMsg });
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

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.warn('Story Extraction Issue:', stderr || error.message);
      
      let errorMsg = 'No Stories Found';
      let subMsg = 'This user hasn\'t posted any stories in the last 24 hours.';
      let statusCode = 404;

      if (stderr.includes('Login required') || stderr.includes('Private')) {
        errorMsg = 'Private Account';
        subMsg = 'This profile is private, so we can\'t see their stories.';
        statusCode = 403; // Forbidden
      } else if (stderr.includes('404')) {
        errorMsg = 'User Not Found';
        subMsg = 'We couldn\'t find anyone with that username.';
        statusCode = 404;
      }

      return res.status(statusCode).json({ error: errorMsg, message: subMsg });
    }

    // Split stdout by lines to get multiple story URLs
    const urls = stdout.trim().split(/\s+/).filter(url => url.startsWith('http'));
    
    if (urls.length > 0) {
      const results = urls.map(url => ({
        type: url.includes('.mp4') || url.includes('video') ? 'video' : 'image',
        url: url,
        thumbnail: url // yt-dlp for stories usually returns the direct CDN link
      }));
      return res.json(results);
    } else {
      return res.status(404).json({ error: 'No active stories detected.' });
    }
  });
});

// 3. Server Health & Dependency Check
app.get('/status', (req, res) => {
  const authStatus = fs.existsSync(COOKIES_PATH) ? 'Authenticated (PRO)' : 'Anonymous (Guest)';
  
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
      authStatus: fs.existsSync(COOKIES_PATH) ? 'Authenticated (File)' : 'Auto-Auth (Browser Enabled)',
      timestamp: new Date().toISOString(),
      engine: 'yt-dlp Core'
    });
  });
});

app.listen(PORT, () => {
  console.log(`REELVAULT Server active on port ${PORT}`);
});
