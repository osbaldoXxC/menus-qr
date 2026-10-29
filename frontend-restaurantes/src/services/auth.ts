import api from './api';

const AUTH_CHANGE_EVENT = 'auth_change';

export const authService = {
  register: async (data: {
    nombre_dueño: string;
    email: string;
    password: string;
    nombre_negocio: string;
  }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('rol', response.data.rol);
      localStorage.setItem('restaurante_id', response.data.restaurante_id);
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    }
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.warn('Error al llamar logout en backend:', e);
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('rol');
    localStorage.removeItem('restaurante_id');
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    window.location.href = '/';
  },

  getCurrentUser: () => {
    return {
      rol: localStorage.getItem('rol'),
      restaurante_id: localStorage.getItem('restaurante_id'),
      isAuthenticated: !!localStorage.getItem('access_token'),
    };
  },

  onAuthChange: (callback: () => void) => {
    window.addEventListener(AUTH_CHANGE_EVENT, callback);
    window.addEventListener('storage', callback); // For cross-tab sync
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, callback);
      window.removeEventListener('storage', callback);
    };
  },

  // Actualizar perfil
  updatePerfil: async (data: { nombre: string; email: string; telefono: string }) => {
    const response = await api.put('/auth/perfil', data);
    return response.data;
  },

  // Cambiar contraseña
  changePassword: async (data: { actual: string; nueva: string }) => {
    const response = await api.put('/auth/password', data);
    return response.data;
  },

  verifyEmail: async (email: string, codigo: string) => {
    const response = await api.post('/auth/verify-email', { email, codigo });
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: { email: string; codigo: string; newPassword: string }) => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },
};