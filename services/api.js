import axios from 'axios';

// Replace with your actual backend URL
// 🌐 Dynamic Backend URL (Expo Environment Variable)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.5:5000'; // Fallback to local IP for physical devices

const api = axios.create({
  baseURL: API_URL,
  timeout: 45000, // Increased timeout to 45s since video extraction takes time
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchReelData = async (reelUrl) => {
  try {
    const response = await api.post('/download', { reelUrl });
    return response.data;
  } catch (error) {
    console.error('Error fetching reel:', error);
    throw error;
  }
};

export const fetchStories = async (username) => {
  try {
    const response = await api.get(`/stories/${username}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching stories:', error);
    throw error;
  }
};

export default api;
