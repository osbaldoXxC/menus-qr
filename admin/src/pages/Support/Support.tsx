import React, { useState, useEffect, useRef } from 'react';
import './Support.css';
import { fetchWithAuth } from '../../services/api';

interface Restaurante {
  id: string;
  nombre_negocio: string;
  email: string;
  plan: string;
  estado: string;
}

export interface Conversation {
  id: string | null;
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  email: string;
  plan: string;
  lastMessageDate: string | null;
  state: 'pending' | 'active' | 'closed' | 'new';
  unreadMessages: number;
  rating?: number | null;
  feedback?: string | null;
}

interface Message {
  id: string;
  senderName: string;
  senderType: 'admin' | 'restaurant';
  content: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

interface MetricData {
  avgRating: number;
  ticketsClosed: number;
  avgTime: string | number;
  pendingTickets: number;
  activeTickets: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function Support() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'activos' | 'cerrados' | 'metricas'>('activos');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [closing, setClosing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isSending, setIsSending] = useState(false);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const isAtBottomRef = useRef(true);
  const selectedConvRef = useRef<Conversation | null>(null);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<MetricData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);



  const fetchAllData = async () => {
    try {
      setLoading(true);
      const resRest = await fetchWithAuth(`${API_BASE_URL}/admin/restaurants`);
      const restaurantes: Restaurante[] = await resRest.json();
      
      const resConv = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversaciones`);
      const convData = await resConv.json();
      const activeConvs = Array.isArray(convData) ? convData : (convData.conversations || []);

      const merged: Conversation[] = activeConvs.map((found: any) => {
        const r = restaurantes.find(rest => rest.id === found.restaurante_id || rest.email === found.email) || {} as Restaurante;
        return {
          id: found.id,
          restaurantId: r.id || found.restaurante_id,
          restaurantName: found.restaurantName || found.nombre_negocio || r.nombre_negocio || 'Desconocido',
          ownerName: found.ownerName || found.nombre_dueno || 'Dueño',
          email: found.email || r.email || '',
          plan: found.plan || r.plan || 'Free',
          lastMessageDate: found.fecha_actualizacion || found.updated_at || new Date().toISOString(),
          state: found.estado === 'pendiente' ? 'pending' : (found.estado === 'cerrada' || found.estado === 'resuelto' ? 'closed' : 'active'),
          unreadMessages: found.mensajes_sin_leer || 0,
          rating: found.calificacion || found.rating || null,
          feedback: found.comentario || found.feedback || null,
        };
      });

      setConversations(merged);
    } catch (err) {
      console.error('Error fetching data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchAllData();
  }, []);

  const fetchDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData({
          avgRating: data.avgRating || 0,
          ticketsClosed: data.ticketsClosed || 0,
          avgTime: data.avgTime || 'N/A',
          pendingTickets: data.pendingTickets || 0,
          activeTickets: data.activeTickets || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'metricas') {
      fetchDashboard();
    }
  }, [activeTab]);

  // --------------- SSE LOGIC ---------------
  useEffect(() => {
    const token = localStorage.getItem('admin_access_token');
    if (!token) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectSSE = () => {
      eventSource = new EventSource(`${API_BASE_URL}/support/stream?token=${token}`);

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);

          if (data.type === 'NEW_MESSAGE') {
            const convId = data.payload.conversacion_id;
            const msgData = data.payload.mensaje;

            setConversations(prev => prev.map(c => {
              if (c.id === convId) {
                return {
                  ...c,
                  lastMessageDate: msgData.created_at || new Date().toISOString(),
                  unreadMessages: selectedConvRef.current?.id === convId ? c.unreadMessages : (c.unreadMessages || 0) + 1,
                  state: c.state === 'closed' ? 'active' : c.state
                };
              }
              return c;
            }));

            if (selectedConvRef.current?.id === convId) {
              setMessages(prevMessages => {
                if (prevMessages.some(m => m.id === msgData.id)) {
                   return prevMessages.map(m => m.id === msgData.id ? { ...m, status: 'sent' as const } : m);
                }
                
                const newMsg: Message = {
                  id: msgData.id,
                  senderName: msgData.remitente_tipo === 'SOPORTE' || msgData.remitente_tipo === 'admin' ? 'Soporte Admin' : msgData.nombre_negocio || 'Restaurante',
                  senderType: msgData.remitente_tipo === 'SOPORTE' || msgData.remitente_tipo === 'admin' ? 'admin' : 'restaurant',
                  content: msgData.mensaje,
                  timestamp: msgData.created_at || new Date().toISOString(),
                  status: 'sent'
                };

                if (!isAtBottomRef.current) {
                  setShowNewMessageButton(true);
                }

                return [...prevMessages, newMsg];
              });
            }
          } else if (data.type === 'NEW_CONVERSATION') {
            fetchAllData(); 
          }
        } catch (err) {
          console.error('Error parsing SSE data', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error', err);
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------- CHAT LOGIC ---------------
  useEffect(() => {
    if (scrollRef.current && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
      if (isAtBottomRef.current) {
        setShowNewMessageButton(false);
      }
    }
  };
  
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setShowNewMessageButton(false);
      isAtBottomRef.current = true;
    }
  };

  const fetchMessages = async (convId: string) => {
    setLoadingChat(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversacion/${convId}`);
      if (res.ok) {
        const data = await res.json();
          const mapped = data.map((m: { id: string, remitente_tipo: string, mensaje: string, created_at: string }) => ({
            id: m.id,
            senderName: m.remitente_tipo === 'SOPORTE' ? 'Soporte Admin' : selectedConv?.restaurantName,
            senderType: m.remitente_tipo === 'SOPORTE' ? 'admin' : 'restaurant',
            content: m.mensaje || m.mensaje,
            timestamp: m.created_at || m.created_at,
            status: 'sent' as const
          }));
        setMessages(mapped);
      }
    } catch (err) {
      console.error('Error fetching messages', err);
    } finally {
      setLoadingChat(false);
    }
  };

  // Sincronización suave cada 3 segundos para la conversación activa del Admin
  useEffect(() => {
    if (!selectedConv?.id) return;
    const convId = selectedConv.id;
    const interval = setInterval(() => {
      fetchMessages(convId);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedConv?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || selectedConv?.state === 'closed' || selectedConv?.state === 'pending' || isSending) return;

    const text = newMessage;
    setNewMessage('');

    let targetConvId = selectedConv?.id;

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      senderName: 'Soporte Admin',
      senderType: 'admin',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    setMessages(prev => [...prev, tempMsg]);
    setIsSending(true);
    
    isAtBottomRef.current = true;
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 0);
    }

    try {
      if (targetConvId) {
        // Send message
        const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversacion/${targetConvId}/mensaje`, {
          method: 'POST',
          body: JSON.stringify({ mensaje: text })
        });
        
        if (res.ok) {
          const data = await res.json();
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id || tempId, status: 'sent' as const } : m));
        } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' as const } : m));
        }
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' as const } : m));
      }
    } catch (err) {
      console.error('Error sending message', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' as const } : m));
    } finally {
      setIsSending(false);
    }
  };

  const handleFinalizar = async () => {
    if (!selectedConv?.id || !window.confirm('¿Seguro que deseas finalizar esta conversación?')) return;
    
    setClosing(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversacion/${selectedConv.id}/cerrar`, {
        method: 'POST',
        body: JSON.stringify({ estado: 'cerrada' })
      });
      if (res.ok) {
        setSelectedConv({ ...selectedConv, state: 'closed' });
        fetchAllData();
      } else {
        alert('Error al cerrar la conversación');
      }
    } catch (err) {
      console.error('Error closing conversation', err);
    } finally {
      setClosing(false);
    }
  };

  const handleAceptar = async () => {
    if (!selectedConv?.id) return;
    setAccepting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/support/admin/conversacion/${selectedConv.id}/aceptar`, {
        method: 'POST'
      });
      if (res.ok) {
        setSelectedConv({ ...selectedConv, state: 'active' });
        fetchAllData();
      } else {
        alert('Error al aceptar el ticket');
      }
    } catch (err) {
      console.error('Error accepting ticket', err);
    } finally {
      setAccepting(false);
    }
  };

  // --------------- RENDERING ---------------
  let filteredConvs = conversations.filter(c => 
    c.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (activeTab === 'activos') {
    filteredConvs = filteredConvs.filter(c => c.state !== 'closed');
  } else if (activeTab === 'cerrados') {
    filteredConvs = filteredConvs.filter(c => c.state === 'closed');
  }

  filteredConvs.sort((a, b) => {
    const order = { 'pending': 1, 'active': 2, 'new': 3, 'closed': 4 };
    if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
    return 0;
  });

  return (
    <div className="support-container">
      
      {/* Sidebar List */}
      <div className="support-sidebar">
        <div className="support-sidebar-header flex flex-col gap-4">
          <h2 className="support-sidebar-title">Soporte</h2>
          
          <div className="flex space-x-2 bg-gray-100 dark:bg-[#1a1a1a] p-1 rounded-lg">
            <button 
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'activos' ? 'bg-white dark:bg-[#2a2a2a] shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
              onClick={() => { setActiveTab('activos'); setSelectedConv(null); }}
            >
              Activos
            </button>
            <button 
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'cerrados' ? 'bg-white dark:bg-[#2a2a2a] shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
              onClick={() => { setActiveTab('cerrados'); setSelectedConv(null); }}
            >
              Cerrados
            </button>
            <button 
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'metricas' ? 'bg-white dark:bg-[#2a2a2a] shadow text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
              onClick={() => { setActiveTab('metricas'); setSelectedConv(null); }}
            >
              Métricas
            </button>
          </div>

          {activeTab !== 'metricas' && (
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input 
                type="text" 
                placeholder="Buscar negocio..." 
                className="support-search pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>
        
        {activeTab !== 'metricas' && (
          <div className="support-list">
            {loading && <div className="p-5 text-center text-gray-500">Cargando...</div>}
            
            {!loading && filteredConvs.length === 0 && (
              <div className="p-5 text-center text-gray-400">No hay restaurantes</div>
            )}

            {!loading && filteredConvs.map(conv => (
              <div 
                key={conv.restaurantId} 
                className={`support-item ${selectedConv?.restaurantId === conv.restaurantId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedConv(conv);
                  if (conv.id) {
                    fetchMessages(conv.id);
                  } else {
                    setMessages([]);
                  }
                  if (conv.unreadMessages > 0) {
                    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadMessages: 0 } : c));
                  }
                }}
              >
                <div className="support-item-header">
                  <div className="support-item-name flex items-center gap-2">
                    {conv.restaurantName}
                    {conv.unreadMessages > 0 && (
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" title={`${conv.unreadMessages} mensajes sin leer`} />
                    )}
                  </div>
                  <span className={`support-badge badge-${conv.state}`}>
                    {conv.state === 'pending' ? 'Pendiente' : 
                     conv.state === 'active' ? 'Activo' : 
                     conv.state === 'closed' ? 'Cerrado' : 'Nuevo'}
                  </span>
                </div>
                <div className="support-item-email">{conv.email}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="support-chat-area relative">
        
        {activeTab === 'metricas' ? (
          <div className="p-8 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Dashboard de Soporte</h2>
            
            {loadingDashboard ? (
              <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
            ) : dashboardData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-[#222] shadow-sm">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Calificación Promedio</div>
                  <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    {dashboardData.avgRating.toFixed(1)}
                    <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-[#222] shadow-sm">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tickets Cerrados</div>
                  <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{dashboardData.ticketsClosed}</div>
                </div>
                
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-[#222] shadow-sm">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tickets Pendientes</div>
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{dashboardData.pendingTickets}</div>
                </div>
                
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-[#222] shadow-sm">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tickets Activos</div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{dashboardData.activeTickets}</div>
                </div>

                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-[#222] shadow-sm">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tiempo de Respuesta Promedio</div>
                  <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{dashboardData.avgTime}</div>
                </div>

              </div>
            ) : (
              <div className="text-gray-500">No se pudo cargar el dashboard.</div>
            )}
          </div>
        ) : !selectedConv ? (
          <div className="chat-empty space-y-4">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p className="text-lg font-medium">Selecciona una conversación del panel lateral</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-info">
                <h3>{selectedConv.restaurantName}</h3>
                <p>{selectedConv.email} • Plan {selectedConv.plan}</p>
              </div>
              
              <div className="flex items-center gap-3">
                {selectedConv.state !== 'closed' && selectedConv.id && (
                  <button 
                    className="btn-close-ticket flex items-center gap-2"
                    onClick={handleFinalizar} 
                    disabled={closing}
                  >
                    {closing ? 'Cerrando...' : 'Finalizar Ticket'}
                  </button>
                )}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
              
              {selectedConv.state === 'closed' && (
                <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-xl p-5 mb-6 shadow-sm mx-auto max-w-lg text-center">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2">Ticket Cerrado</h4>
                  {selectedConv.rating ? (
                    <div className="flex flex-col items-center">
                      <div className="flex gap-1 mb-2">
                        {[1,2,3,4,5].map(star => (
                          <svg key={star} className={`w-6 h-6 ${star <= (selectedConv.rating || 0) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                          </svg>
                        ))}
                      </div>
                      {selectedConv.feedback && <p className="text-gray-600 dark:text-gray-400 italic mt-2">"{selectedConv.feedback}"</p>}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">El restaurante no dejó calificación.</p>
                  )}
                </div>
              )}

              {loadingChat ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-400 py-10 italic">
                  No hay mensajes todavía. {selectedConv.id ? 'El restaurante no ha escrito.' : 'El restaurante no ha iniciado un ticket de soporte aún.'}
                </div>
              ) : (
                messages.map(msg => {
                  const date = new Date(msg.timestamp);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                  const dateString = isToday ? timeString : `${date.toLocaleDateString()} ${timeString}`;

                  return (
                    <div key={msg.id} className={`msg-bubble msg-${msg.senderType === 'admin' ? 'admin' : 'client'}`}>
                      {/* Nombre omitido en burbujas porque ya figura en el encabezado del chat */}
                      <div>{msg.content}</div>
                      <div className="msg-time">
                        {dateString}
                        {msg.status === 'sending' && ' (Enviando...)'}
                        {msg.status === 'error' && ' (Error)'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {showNewMessageButton && (
              <button 
                onClick={scrollToBottom}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg font-semibold text-sm flex items-center gap-2 hover:bg-blue-700 z-20"
              >
                <span>Nuevos mensajes</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
              </button>
            )}

            {/* Chat Input Area */}
            <div className="chat-input-area">
              {selectedConv.state === 'closed' ? (
                <div className="text-center p-3 bg-gray-100 dark:bg-[#1e1e1e] rounded-lg text-gray-500 dark:text-gray-400 text-sm font-medium flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  Conversación finalizada. Modo solo lectura.
                </div>
              ) : selectedConv.state === 'pending' ? (
                <div className="flex justify-center p-2">
                  <button 
                    onClick={handleAceptar}
                    disabled={accepting}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {accepting ? 'Aceptando...' : 'Aceptar Ticket para Responder'}
                  </button>
                </div>
              ) : (
                <form className="chat-form" onSubmit={handleSendMessage}>
                  <input 
                    type="text" 
                    className="chat-input"
                    placeholder="Escribe tu respuesta aquí..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    disabled={isSending}
                  />
                  <button 
                    type="submit" 
                    className="btn-send flex items-center gap-2"
                    disabled={!newMessage.trim() || isSending}
                  >
                    <span>{isSending ? 'Enviando...' : 'Enviar'}</span>
                    {!isSending && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    )}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
