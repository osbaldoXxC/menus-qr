import React, { useState, useEffect, useRef } from 'react';
import './AdminSupport.css';
import { fetchWithAuth } from '../services/api';

interface Conversacion {
  id: string;
  restaurante_id: string;
  estado: string;
  created_at: string;
  updated_at: string;
  restaurante_nombre?: string;
  mensajes_sin_leer?: number;
}

interface Mensaje {
  id: string;
  conversacion_id: string;
  remitente_tipo: 'restaurante' | 'admin';
  mensaje: string;
  leido: boolean;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function AdminSupport() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);



  const fetchConversaciones = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversaciones(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConversaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectConversacion = async (conv_id: string) => {
    setActiveConv(conv_id);
    setMensajes([]);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversations/${conv_id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMensajes(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !activeConv) return;
    
    const texto = nuevoMensaje;
    setNuevoMensaje('');

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversations/${activeConv}/messages`, {
        method: 'POST',
        body: JSON.stringify({ mensaje: texto })
      });

      if (res.ok) {
        const data = await res.json();
        setMensajes(prev => [...prev, data.mensaje_obj]);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resolverConversacion = async (conv_id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversations/${conv_id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ estado: 'resuelto' })
      });
      if (res.ok) {
        fetchConversaciones();
        if (activeConv === conv_id) setActiveConv(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="admin-support-container">
      <div className="support-sidebar">
        <h3>Conversaciones</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : conversaciones.length === 0 ? (
          <p>No hay mensajes</p>
        ) : (
          <div className="conv-list">
            {conversaciones.map(c => (
              <div 
                key={c.id} 
                className={`conv-item ${activeConv === c.id ? 'active' : ''}`}
                onClick={() => selectConversacion(c.id)}
              >
                <h4>{c.restaurante_nombre || 'Restaurante'}</h4>
                <p>{c.estado}</p>
                {c.estado !== 'resuelto' && (
                  <button onClick={(e) => { e.stopPropagation(); resolverConversacion(c.id); }}>Resolver</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="support-main">
        {!activeConv ? (
          <div className="no-conv">Selecciona una conversación</div>
        ) : (
          <div className="chat-container">
            <div className="chat-messages" ref={scrollRef}>
              {mensajes.map(m => (
                <div key={m.id} className={`chat-message ${m.remitente_tipo === 'admin' ? 'admin' : 'rest'}`}>
                  <p>{m.mensaje}</p>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <form className="chat-input" onSubmit={enviarMensaje}>
              <input 
                type="text" 
                value={nuevoMensaje}
                onChange={e => setNuevoMensaje(e.target.value)}
                placeholder="Escribe una respuesta..."
              />
              <button type="submit">Enviar</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
