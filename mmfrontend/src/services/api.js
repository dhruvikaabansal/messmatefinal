import axios from 'axios';

// Use environment variable for production, fallback to local for dev
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Derived base URL for absolute image paths (removes /api suffix if present)
export const BACKEND_URL = API_BASE.split('/api')[0];

const api = axios.create({
  baseURL: API_BASE,
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
