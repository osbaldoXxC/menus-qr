import api from './api';

export const restauranteService = {
  getQR: async () => {
    const response = await api.get('/restaurants/qr');
    return response.data;
  },

  // Recibe FormData con el archivo de imagen
  crearPlatillo: async (formData: FormData) => {
    const response = await api.post('/menu/platillos', formData);
    return response.data;
  },

  // Actualizar platillo
  actualizarPlatillo: async (id: string | number, formData: FormData) => {
    const response = await api.put(`/menu/platillos/${id}`, formData);
    return response.data;
  },

  // Eliminar platillo
  eliminarPlatillo: async (id: string | number) => {
    const response = await api.delete(`/menu/platillos/${id}`);
    return response.data;
  },

  getPlatillos: async () => {
    try {
      // Usar la ruta privada para ver TODOS los platillos (incluyendo inactivos)
      const response = await api.get('/menu/platillos');
      const platillos = response.data;

      const normalizeImageUrl = (url: string | null | undefined) => {
        if (!url) return '';
        const trimmed = url.trim();
        if (!trimmed) return '';

        // Si ya es una URL absoluta (S3/CloudFront), devolverla tal cual
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        
        // Fallback para imágenes locales servidas por el backend
        const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000';
        return `${baseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
      };

      return platillos.map((p: any) => ({
        ...p,
        url_imagen: normalizeImageUrl(p.url_imagen),
        categoria: p.categoria_nombre // El backend devuelve categoria_nombre en la ruta privada
      }));
    } catch (error) {
      console.warn('Error fetching platillos:', error);
      return [];
    }
  },

  updateTheme: async (data: any) => {
    try {
      // Debug log removed
      const response = await api.put('/restaurants/theme', data);
      
      if (response.data?.tema && typeof response.data.tema.config_diseno === 'string') {
        try {
          response.data.tema.config_diseno = JSON.parse(response.data.tema.config_diseno);
        } catch (e) {
          console.warn('Error parsing config_diseno in updateTheme:', e);
          response.data.tema.config_diseno = {};
        }
      }

      // Debug log removed
      return response.data;
    } catch (error) {
      console.warn('Error updating theme:', error);
      return { mensaje: 'Tema actualizado (Simulado)' };
    }
  },

  getRestauranteInfo: async () => {
    const response = await api.get('/restaurants/info');
    if (response.data && typeof response.data.config_diseno === 'string') {
      try {
        response.data.config_diseno = JSON.parse(response.data.config_diseno);
      } catch (e) {
        console.warn('Error parsing config_diseno:', e);
        response.data.config_diseno = {};
      }
    }
    return response.data;
  },

  uploadBrandingImage: async (file: File) => {
    const formData = new FormData();
    formData.append('imagen', file);
    const response = await api.post('/restaurants/upload-branding', formData);
    return response.data;
  },

  getCategorias: async () => {
    try {
      const response = await api.get('/categories');
      return response.data;
    } catch (error) {
      console.warn('Error fetching categories:', error);
      return [];
    }
  }
};