import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/** Backend origin, for resolving locally-stored /uploads paths. */
export const BACKEND_URL = API_BASE.replace(/\/api\/?$/, '');

const TOKEN_KEY = 'mm_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Everything here is per-user and slot-sensitive; never let a proxy or the
  // browser hand back a stale deck.
  config.headers['Cache-Control'] = 'no-cache';
  return config;
});

/**
 * A dead session should log you out once, quietly — not leave you staring at a
 * screen that silently fails every request.
 */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register');

    if (status === 401 && !isAuthCall) {
      clearToken();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?expired=1');
      }
    }
    return Promise.reject(err);
  }
);

/** Turn any thrown error into something worth showing a person. */
export const errorMessage = (err, fallback = 'Something went wrong. Try again.') => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'That took too long. Check your connection.';
  if (err?.message === 'Network Error') return "Can't reach MessMate right now.";
  return fallback;
};

export const errorCode = (err) => err?.response?.data?.code || null;

export default api;
