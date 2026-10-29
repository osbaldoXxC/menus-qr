import React, { useState, useEffect, useRef } from 'react';
import type { Conversation } from './Support';
import { fetchWithAuth } from '../../services/api';

interface SupportChatProps {
  conversation: Conversation;
  onClose: () => void;
}

interface Message {
  id: string;
  senderName: string;
  senderType: 'admin' | 'restaurant';
  content: string;
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function SupportChat({ conversation, onClose }: SupportChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isClosed = conversation.state === 'closed';



  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    return () => clearInterval(interval);
  }, [conversation.id]); // We will define fetchMessages below using function keyword for hoisting

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function fetchMessages() {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversacion/${conversation.id}`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((m: { id: string, remitente_tipo: string, mensaje: string, created_at: string }) => ({
          id: m.id,
          senderName: m.remitente_tipo?.toUpperCase() === 'SOPORTE' || m.remitente_tipo?.toLowerCase() === 'admin' ? 'Soporte Admin' : conversation.restaurantName,
          senderType: m.remitente_tipo?.toUpperCase() === 'SOPORTE' || m.remitente_tipo?.toLowerCase() === 'admin' ? 'admin' : 'restaurant',
          content: m.mensaje,
          timestamp: m.created_at
        }));
        setMessages(mapped);
      }
    } catch (err) {
      console.error('Error fetching messages', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isClosed) return;

    const text = newMessage;
    setNewMessage('');

    // Optimistic UI
    const tempMsg: Message = {
      id: Date.now().toString(),
      senderName: 'Soporte Admin',
      senderType: 'admin',
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversacion/${conversation.id}/mensaje`, {
        method: 'POST',
        body: JSON.stringify({ mensaje: text })
      });
      if (!res.ok) {
        // Revert optimistic
        fetchMessages();
      }
    } catch (err) {
      console.error('Error sending message', err);
      fetchMessages();
    }
  };

  const handleFinalizar = async () => {
    if (!window.confirm('¿Seguro que deseas finalizar esta conversación?')) return;
    
    setClosing(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversacion/${conversation.id}/cerrar`, {
        method: 'POST',
        body: JSON.stringify({ estado: 'cerrada' })
      });
      if (res.ok) {
        onClose(); // Volver a la lista para ver el cambio
      } else {
        alert('Error al cerrar la conversación');
      }
    } catch (err) {
      console.error('Error closing conversation', err);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Volver"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <h3 className="font-bold text-lg text-gray-800">{conversation.restaurantName}</h3>
            <p className="text-sm text-gray-500">{conversation.ownerName} - {conversation.plan}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
            conversation.state === 'pending' ? 'bg-orange-100 text-orange-700' :
            conversation.state === 'active' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {conversation.state === 'pending' ? 'Pendiente' : conversation.state === 'active' ? 'Activo' : 'Cerrado'}
          </span>
          {!isClosed && (
            <button 
              onClick={handleFinalizar}
              disabled={closing}
              className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors border border-red-200 flex items-center gap-2"
            >
              {closing ? 'Cerrando...' : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  Finalizar conversación
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4"
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-10 italic">
            No hay mensajes en esta conversación.
          </div>
        ) : (
          messages.map(msg => {
            const date = new Date(msg.timestamp);
            const formattedDate = date.toLocaleDateString();
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[70%] ${msg.senderType === 'admin' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <div className="flex items-baseline gap-2 mb-1 px-1">
                  <span className="text-xs font-medium text-gray-500">{msg.senderName}</span>
                  <span className="text-[10px] text-gray-400">{formattedDate} {formattedTime}</span>
                </div>
                <div 
                  className={`p-3 rounded-2xl ${
                    msg.senderType === 'admin' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                  }`}
                  style={{ wordBreak: 'break-word' }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {isClosed ? (
          <div className="text-center p-3 bg-gray-100 rounded-lg text-gray-500 flex items-center justify-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Esta conversación está cerrada. No se pueden enviar más mensajes.
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje aquí..."
              className="flex-1 bg-gray-100 border-none focus:ring-2 focus:ring-blue-500 rounded-lg px-4 py-3 outline-none text-gray-700"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>Enviar</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
