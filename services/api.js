import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.5:5000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const getCache = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
};

const setCache = async (key, data) => {
  try {
    const cacheData = JSON.stringify({ data, timestamp: Date.now() });
    await AsyncStorage.setItem(key, cacheData);
  } catch (e) {}
};

export const getProxyUrl = (originalUrl) => {
  if (!originalUrl || originalUrl.includes('/proxy?url=')) return originalUrl;
  return `${API_URL}/proxy?url=${encodeURIComponent(originalUrl)}`;
};

export const fetchReelData = async (reelUrl) => {
  const cacheKey = `reel_${reelUrl}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await api.post('/download/reel', { reelUrl });
    const data = {
      ...response.data,
      videoUrl: getProxyUrl(response.data.videoUrl)
    };
    await setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching reel:', error);
    const serverError = error.response?.data;
    const status = error.response?.status;
    const err = new Error(
      serverError?.message ||
      (status === 403 ? 'This Reel belongs to a private account. We can only download from public accounts.' :
       status === 404 ? 'This Reel was not found. It may have been deleted or the link is wrong.' :
       status === 429 ? 'Instagram is limiting our access right now. Please wait a minute and try again.' :
       status === 504 ? 'The request took too long. Please try again.' :
       !error.response ? 'Could not connect to the server. Please check your internet connection.' :
       'Something went wrong while getting this Reel. Please try again.')
    );
    err.response = error.response;
    throw err;
  }
};

export const fetchPostData = async (postUrl) => {
  const cacheKey = `post_${postUrl}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await api.post('/download/post', { reelUrl: postUrl });
    const data = {
      ...response.data,
      images: (response.data.images || []).map(url => getProxyUrl(url)),
    };
    await setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching post:', error);
    const serverError = error.response?.data;
    const status = error.response?.status;
    const err = new Error(
      serverError?.message ||
      (status === 403 ? 'This post belongs to a private account. We can only download from public accounts.' :
       status === 404 ? 'This post was not found. It may have been deleted or the link is wrong.' :
       status === 429 ? 'Instagram is limiting our access right now. Please wait a minute and try again.' :
       status === 504 ? 'The request took too long. Please try again.' :
       !error.response ? 'Could not connect to the server. Please check your internet connection.' :
       'Something went wrong while getting this post. Please try again.')
    );
    err.response = error.response;
    throw err;
  }
};

export const fetchStories = async (username) => {
  const cacheKey = `stories_${username}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await api.get(`/stories/${username}`);
    const data = response.data.map(item => ({
      ...item,
      url: getProxyUrl(item.url),
      thumbnail: getProxyUrl(item.thumbnail)
    }));
    await setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching stories:', error);
    const serverError = error.response?.data;
    const status = error.response?.status;
    const err = new Error(
      serverError?.message ||
      (status === 403 ? 'This is a private account. You can only view stories from public accounts.' :
       status === 404 ? 'No stories found for this user. They may not have posted any recently.' :
       status === 429 ? 'Instagram is limiting our access right now. Please wait a minute and try again.' :
       status === 504 ? 'The request took too long. Please try again.' :
       !error.response ? 'Could not connect to the server. Please check your internet connection.' :
       'Something went wrong while getting stories. Please try again.')
    );
    err.response = error.response;
    throw err;
  }
};

export const fetchYouTubeInfo = async (url) => {
  try {
    const response = await api.post('/youtube/info', { url });
    return response.data;
  } catch (error) {
    console.error('Error fetching YouTube info:', error);
    const serverError = error.response?.data;
    const status = error.response?.status;
    const err = new Error(
      serverError?.message ||
      (status === 400 ? 'That doesn\'t look like a YouTube link. Please check and try again.' :
       status === 429 ? 'YouTube is busy right now. Please wait a minute and try again.' :
       !error.response ? 'Could not connect to the server. Please check your internet connection.' :
       'We couldn\'t get info about this video. Please try again.')
    );
    err.response = error.response;
    throw err;
  }
};

export const requestYouTubeDownload = async ({ url, kind, maxHeight, audioBitrate, format, quality }) => {
  try {
    const response = await api.post('/youtube/download', {
      url,
      kind,
      maxHeight,
      audioBitrate,
      format,
      quality,
    });
    return response.data;
  } catch (error) {
    console.error('Error requesting YouTube download:', error);
    const serverError = error.response?.data;
    const status = error.response?.status;
    const err = new Error(
      serverError?.message ||
      (status === 429 ? 'YouTube is busy right now. Please wait a minute and try again.' :
       !error.response ? 'Could not connect to the server. Please check your internet connection.' :
       'We couldn\'t download this video. Please try again.')
    );
    err.response = error.response;
    throw err;
  }
};


export default api;

