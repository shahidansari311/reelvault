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
    const response = await api.post('/download', { reelUrl });
    const data = {
      ...response.data,
      videoUrl: getProxyUrl(response.data.videoUrl)
    };
    await setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching reel:', error);
    throw error;
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
    throw error;
  }
};

export const fetchYouTubeInfo = async (url) => {
  try {
    const response = await api.post('/youtube/info', { url });
    return response.data;
  } catch (error) {
    console.error('Error fetching YouTube info:', error);
    throw error;
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
    throw error;
  }
};


export default api;

