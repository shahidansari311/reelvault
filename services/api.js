import axios from 'axios';

// Replace with your actual backend URL
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000'; // Uses .env or defaults to localhost

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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
