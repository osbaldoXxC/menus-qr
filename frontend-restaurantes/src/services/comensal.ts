import api from './api';

export const comensalService = {
  getMenuByQR: async (restaurante_id: string) => {
    const response = await api.get(`/public/menu/${restaurante_id}`);
    return response.data;
  },

  searchMatches: async (data: {
    sabor_antojo: string;
    dieta: string;
    alergias: string[];
    ocasion: string;
  }) => {
    const response = await api.post('/search/matches', data);
    return response.data;
  },

  registrarInteraccion: async (platillo_id: string, accion: 'like' | 'dislike') => {
    const response = await api.post('/search/interactions', { platillo_id, accion });
    return response.data;
  },
};