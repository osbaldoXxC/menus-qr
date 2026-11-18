import axios from 'axios';

export interface ComensalQuota {
  plan: 'FREE' | 'PAID';
  isPaid: boolean;
  limit: number | null;
  used: number;
  reserved: number;
  remaining: number | null;
  availableNow: number | null;
  windowStartUtc: string;
  windowEndUtc: string;
  resetsAt: string;
  timezone: string;
}

export interface ComensalUser {
  id: string;
  nombre: string;
  email: string;
  rol: 'COMENSAL';
}

export interface ComensalSessionResponse {
  user: ComensalUser;
  quota: ComensalQuota;
  mensaje?: string;
}

const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const authClient = axios.create({
  baseURL: base,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'MexxicanMX-Client'
  }
});

const PENDING_CRAVING_KEY = 'mexxicanmx_pending_craving_draft';

export function formatMexicoRenewalDate(isoString?: string): string {
  if (!isoString) return 'el lunes a las 00:00 (CDMX)';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'el lunes a las 00:00 (CDMX)';
    const formatted = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
    return `${formatted} (CDMX)`;
  } catch (_) {
    return 'el lunes a las 00:00 (CDMX)';
  }
}

export const comensalAuthService = {
  async getSession(): Promise<ComensalSessionResponse | null> {
    try {
      const { data } = await authClient.get<ComensalSessionResponse>('/auth/comensal/me');
      return data;
    } catch (err: any) {
      if (err?.response?.status === 401 && err?.response?.data?.code === 'SESSION_EXPIRED') {
        try {
          const refreshed = await authClient.post<ComensalSessionResponse>('/auth/comensal/refresh', {});
          return refreshed.data;
        } catch (_) {
          return null;
        }
      }
      return null;
    }
  },

  async login(email: string, password: string): Promise<ComensalSessionResponse> {
    const { data } = await authClient.post<ComensalSessionResponse>('/auth/comensal/login', { email, password });
    return data;
  },

  async register(nombre: string, email: string, password: string): Promise<ComensalSessionResponse> {
    const { data } = await authClient.post<ComensalSessionResponse>('/auth/comensal/register', {
      nombre,
      email,
      password
    });
    return data;
  },

  async logout(): Promise<void> {
    await authClient.post('/auth/comensal/logout', {});
  },

  async forgotPassword(email: string): Promise<{ mensaje: string }> {
    const { data } = await authClient.post<{ mensaje: string }>('/auth/comensal/forgot-password', { email });
    return data;
  },

  async resetPassword(email: string, codigo: string, newPassword: string): Promise<{ mensaje: string }> {
    const { data } = await authClient.post<{ mensaje: string }>('/auth/comensal/reset-password', {
      email,
      codigo,
      newPassword
    });
    return data;
  },

  savePendingCravingDraft(text: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (text.trim()) {
          sessionStorage.setItem(PENDING_CRAVING_KEY, text);
        } else {
          sessionStorage.removeItem(PENDING_CRAVING_KEY);
        }
      }
    } catch (_) {
      // Ignore storage access errors in restricted environments
    }
  },

  consumePendingCravingDraft(): string | null {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const value = sessionStorage.getItem(PENDING_CRAVING_KEY);
        sessionStorage.removeItem(PENDING_CRAVING_KEY);
        return value;
      }
    } catch (_) {
      return null;
    }
    return null;
  }
};
