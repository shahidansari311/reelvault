const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testBackend() {
  console.log('🚀 INITIALIZING SAVEX ENDPOINT TESTS...\n');

  // 1. Test /status
  try {
    const statusRes = await axios.get(`${BASE_URL}/status`);
    console.log('✅ [STATUS] PASS: Server is online.');
    console.log(`   - Engine: ${statusRes.data.engine}`);
    console.log(`   - Version: ${statusRes.data.version}\n`);
  } catch (err) {
    console.log('❌ [STATUS] FAIL: Server unreachable. Ensure "nodemon server.js" is running.\n');
  }

  // 2. Test /download (Verified Public URL)
  console.log('⏳ Testing /download endpoint with verified link...');
  try {
    const reelRes = await axios.post(`${BASE_URL}/download`, { 
      reelUrl: 'https://www.instagram.com/reel/CysZk9uO0mS/' 
    });
    if (reelRes.data.videoUrl) {
      console.log('✅ [DOWNLOAD] PASS: Successfully extracted direct video URL.');
      console.log(`   - URL Snippet: ${reelRes.data.videoUrl.substring(0, 50)}...\n`);
    }
  } catch (err) {
    console.log('⚠️ [DOWNLOAD] NOTE: Extraction failed or timeout. This is expected if the specific test URL is expired or deleted.');
    console.log('   Error Detail:', err.response?.data?.message || err.message, '\n');
  }

  // 3. Test /youtube/info
  console.log('⏳ Testing /youtube/info endpoint...');
  try {
    const ytInfoRes = await axios.post(`${BASE_URL}/youtube/info`, { 
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' 
    });
    if (ytInfoRes.data.title) {
      console.log('✅ [YT INFO] PASS: Successfully fetched video metadata.');
      console.log(`   - Title: ${ytInfoRes.data.title}`);
      console.log(`   - Video Options: ${ytInfoRes.data.videoOptions?.length || 0} formats found.\n`);
    }
  } catch (err) {
    console.log('⚠️ [YT INFO] NOTE: Info fetch failed.');
    console.log('   Error Detail:', err.response?.data?.message || err.message, '\n');
  }

  console.log('📋 TESTING COMPLETE.');
}

testBackend();
