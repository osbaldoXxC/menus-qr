import api from './api';

export interface ConversacionSoporte {
  id: string;
  restaurante_id: string;
  estado: 'abierta' | 'pendiente' | 'en_atencion' | 'cerrada';
  mensajes_restaurante_count: number;
  calificacion: number | null;
  comentario_calificacion: string | null;
  agente_nombre?: string;
  fecha_creacion: string;
  ultima_actividad: string;
  asunto?: string;
  created_at?: string;
  updated_at?: string;
  mensajes?: MensajeSoporte[];
}

export interface MensajeSoporte {
  id: string;
  conversacion_id: string;
  remitente_tipo: 'restaurante' | 'admin' | 'SOPORTE' | 'sistema';
  mensaje: string;
  leido: boolean;
  created_at: string;
}

export const soporteService = {
  getConversaciones: async () => {
    const { data } = await api.get<ConversacionSoporte[]>('/support/my-conversations');
    const activas = data.filter(c => c.estado !== 'cerrada');
    const cerradas = data.filter(c => c.estado === 'cerrada');
    return { activas, cerradas };
  },

  enviarMensaje: async (mensaje: string) => {
    const { data } = await api.post<{ 
      mensaje: MensajeSoporte; 
      conversacion_id: string; 
      mensajes_restaurante_count?: number;
      autoMensaje?: MensajeSoporte 
    }>('/support/my-conversations/messages', { mensaje });
    return data;
  },

  calificarConversacion: async (conversacionId: string, calificacion: number, comentario?: string) => {
    const { data } = await api.post<{ success: boolean }>(`/support/my-conversations/${conversacionId}/rate`, { calificacion, comentario });
    return data;
  }
};
