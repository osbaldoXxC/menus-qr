const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: string | null) => void, reject: (reason?: any) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('admin_access_token');
  
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const newOptions = { ...options, headers };
  
  let response = await fetch(url, newOptions);

  if ((response.status === 401 || response.status === 403) && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
    if (isRefreshing) {
      return new Promise<string | null>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(newToken => {
        if (newToken) {
          headers.set('Authorization', `Bearer ${newToken}`);
        }
        return fetch(url, { ...newOptions, headers });
      }).catch(err => {
        return Promise.reject(err);
      });
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!refreshRes.ok) {
        throw new Error('Refresh token inválido o expirado');
      }

      const refreshData = await refreshRes.json();
      const newAccessToken = refreshData.access_token;
      
      localStorage.setItem('admin_access_token', newAccessToken);
      
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      
      processQueue(null, newAccessToken);
      
      // Reintentar la solicitud original
      response = await fetch(url, { ...newOptions, headers });
    } catch (error) {
      processQueue(error as Error, null);
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_rol');
      window.location.reload();
      throw error;
    } finally {
      isRefreshing = false;
    }
  }

  return response;
};
