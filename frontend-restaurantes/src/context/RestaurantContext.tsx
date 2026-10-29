import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authService } from '../services/auth';
import api from '../services/api';

interface RestaurantInfo {
  id: string;
  slug?: string;
  nombre_negocio: string;
  plan: string;
  estado: string;
  suscripcion_activa: boolean;
  dias_licencia: number;
  dias_restantes: number;
}

interface Limits {
  maxMenus: number;
  maxCategorias: number;
  maxPlatillos: number;
  maxImagenes: number;
  soportePremium: boolean;
  personalizacionAvanzada: boolean;
  bannerPromocional: boolean;
}

interface RestaurantContextValue {
  restaurant: RestaurantInfo | null;
  limits: Limits;
  loading: boolean;
  refreshRestaurant: () => Promise<void>;
  isPremium: boolean;
}

const defaultLimits: Limits = {
  maxMenus: 1,
  maxCategorias: 5,
  maxPlatillos: 50,
  maxImagenes: 10,
  soportePremium: false,
  personalizacionAvanzada: false,
  bannerPromocional: false
};

export const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant: null,
  limits: defaultLimits,
  loading: true,
  refreshRestaurant: async () => {},
  isPremium: false
});

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [limits, setLimits] = useState<Limits>(defaultLimits);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const refreshRestaurant = async () => {
    const user = authService.getCurrentUser();
    if (!user.isAuthenticated || (user.rol !== 'RESTAURANTE' && user.rol !== 'SUPER_ADMIN')) {
      setRestaurant(null);
      setLimits(defaultLimits);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const res = await api.get('/restaurants/info');
      const data = res.data;
      if (data) {
        setRestaurant({
          id: data.id,
          slug: data.slug,
          nombre_negocio: data.nombre_negocio,
          plan: data.plan || 'basico',
          estado: data.estado,
          suscripcion_activa: data.suscripcion_activa,
          dias_licencia: data.dias_licencia,
          dias_restantes: data.stats?.dias_restantes || 0
        });

        // Set limits dynamically from backend response
        if (data.stats) {
          setLimits({
            maxMenus: data.stats.plan === 'premium' ? 10 : (data.stats.plan === 'prueba' ? 2 : 1), // Optional mapping if backend doesn't send max_menus
            maxCategorias: data.stats.platillos?.maximo ? Math.floor(data.stats.platillos.maximo / 10) : 5, // Fallback if backend doesn't send explicit maxCategorias
            maxPlatillos: data.stats.platillos?.maximo || 50,
            maxImagenes: data.stats.plan === 'premium' ? 500 : (data.stats.plan === 'prueba' ? 100 : 10),
            soportePremium: !!data.stats.features?.soporte_premium,
            personalizacionAvanzada: !!data.stats.features?.configuracion_diseno,
            bannerPromocional: !!data.stats.features?.banner_promocional
          });
        }
      } else {
        setRestaurant(null);
        setLimits(defaultLimits);
      }
    } catch (err) {
      console.error('Error fetching restaurant info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshRestaurant();
    
    // Listen for auth changes to refetch
    const unsub = authService.onAuthChange(() => {
      refreshRestaurant();
    });
    
    return () => unsub();
  }, []);

  const isPremium = !!limits.soportePremium;

  return (
    <RestaurantContext.Provider value={{ restaurant, limits, loading, refreshRestaurant, isPremium }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export const useRestaurant = () => useContext(RestaurantContext);
