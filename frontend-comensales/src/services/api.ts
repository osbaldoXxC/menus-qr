import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  withCredentials: true,
});

// ── Refresh token logic ────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// ── Request interceptor ────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    // Let the browser set multipart boundary
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  } else {
    config.headers['Content-Type'] = 'application/json';
  }

  if (import.meta.env.DEV) {
    console.log('📤', config.method?.toUpperCase(), config.url);
  }
  return config;
});

// ── Response interceptor (401 auto-refresh) ───────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 403) {
      const msg = error.response?.data?.mensaje || '';
      if (msg.includes('suspendida') || msg.includes('cancelada')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('rol');
        localStorage.removeItem('restaurante_id');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // Only attempt refresh on 401 and if we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      const token = localStorage.getItem('access_token');
      if (token === 'mock-token') {
        console.warn('⚠️ 401 detectado con mock-token. Continuando con fallbacks.');
        return Promise.reject(error);
      }
      // Don't try to refresh if the failing call IS the refresh call or the login call itself
      if (originalRequest.url?.endsWith('/auth/refresh') || originalRequest.url?.endsWith('/auth/login')) {
        if (originalRequest.url?.endsWith('/auth/refresh')) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('rol');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = data.access_token;
        localStorage.setItem('access_token', newToken);

        // Retry all queued requests with the new token
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('rol');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (import.meta.env.DEV) {
      console.error('❌', error.response?.status, error.response?.data);
    }
    return Promise.reject(error);
  }
);

export default api;