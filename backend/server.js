const express = require('express');
const cors = require('cors');
const instagramGetUrl = require('instagram-url-direct');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Download Reel Endpoint
app.post('/download', async (req, res) => {
  const { reelUrl } = req.body;

  if (!reelUrl) {
    return res.status(400).json({ error: 'Reel URL is required' });
  }

  try {
    const data = await instagramGetUrl(reelUrl);
    
    if (data && data.url_list && data.url_list.length > 0) {
      // Find the first video URL or direct link
      return res.json({ videoUrl: data.url_list[0] });
    } else {
      return res.status(404).json({ error: 'Could not find media for this link' });
    }
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. View Stories Endpoint (Public Accounts Only)
// NOTE: This is a placeholder. Real story fetching usually requires an Instagram session/cookie.
// For a "free" version, we recommend using a third-party scraper API or a dedicated library with session support.
app.get('/stories/:username', async (req, res) => {
  const { username } = req.params;

  // DEMO MODE: If username is 'demo', return mock data to show the UI works
  if (username.toLowerCase() === 'demo') {
    return res.json([
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1611162147701-a64dc77589ed?w=800',
        thumbnail: 'https://images.unsplash.com/photo-1611162147701-a64dc77589ed?w=200'
      },
      {
        type: 'video',
        url: 'https://www.w3schools.com/html/mov_bbb.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200'
      }
    ]);
  }

  try {
    // NOTE: Real story fetching requires a session cookie or a scraper API.
    // For now, we return a helpful error message that the frontend can display.
    res.status(403).json({ 
      error: 'Story fetching (Public Only)',
      message: 'This feature currently requires an Instagram Session Cookie on the backend to bypass restriction. Type "demo" to see how it works!'
    });
  } catch (error) {
    console.error('Stories Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
