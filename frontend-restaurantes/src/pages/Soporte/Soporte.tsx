import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, AlertCircle, Plus, Star, X } from 'lucide-react';
import { soporteService, ConversacionSoporte, MensajeSoporte } from '../../services/soporte';
import { useRestaurant } from '../../context/RestaurantContext';
import { censurarGroserias } from '../../utils/profanityFilter';

export function Soporte() {
  const { isPremium } = useRestaurant();
  const [conversacionActiva, setConversacionActiva] = useState<ConversacionSoporte | null>(null);
  const [conversacionesCerradas, setConversacionesCerradas] = useState<ConversacionSoporte[]>([]);
  const [mensajes, setMensajes] = useState<MensajeSoporte[]>([]);
  
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'activa' | 'historial' | 'crear' | 'detalle_cerrada'>('activa');
  const [conversacionSeleccionada, setConversacionSeleccionada] = useState<ConversacionSoporte | null>(null);
  
  // Rating states
  const [rating, setRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  
  // Real-time & Scroll states
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Referencia para la conversación activa dentro de los callbacks de EventSource
  const activeConvRef = useRef<ConversacionSoporte | null>(null);
  useEffect(() => {
    activeConvRef.current = conversacionActiva;
  }, [conversacionActiva]);

  const fetchDatos = async () => {
    if (!isPremium) return;
    try {
      setLoading(true);
      const res = await soporteService.getConversaciones();
      setConversacionesCerradas(res.cerradas || []);
      
      if (res.activas && res.activas.length > 0) {
        setConversacionActiva(res.activas[0]);
        setMensajes(res.activas[0].mensajes || []);
        setVista('activa');
        setTimeout(() => scrollToBottom(), 100);
      } else {
        setConversacionActiva(null);
        setVista('crear');
      }
    } catch (err: any) {
      setError('Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPremium) {
      fetchDatos();
    }
  }, [isPremium]);

  // SSE Setup
  useEffect(() => {
    if (!isPremium) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    let eventSource = new EventSource(`${API_BASE_URL}/support/stream?token=${token}`);

    const connectSSE = () => {
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'NEW_MESSAGE' && data.payload) {
            const convId = data.payload.conversacion_id;
            const newMsgObj = data.payload.mensaje;
            
            // Revisa si es para la conversación activa (o seleccionada para cerrar, pero normalmente es activa)
            if (activeConvRef.current && convId === activeConvRef.current.id) {
              setMensajes((prev) => {
                // Deduplicate
                if (prev.some(m => m.id === newMsgObj.id || (m as any).tempId === newMsgObj.id)) return prev;
                
                // Si no estamos en el fondo, aumentamos conteo de no leídos
                if (!isAtBottomRef.current) {
                  setUnreadCount(c => c + 1);
                } else {
                  // Si estamos en el fondo, scrolleamos automáticamente
                  setTimeout(() => scrollToBottom(), 100);
                }
                
                return [...prev, newMsgObj];
              });
              }
            } else if (data.type === 'CONVERSATION_CLOSED') {
              const closedConvId = data.payload.conversacion_id;
              if (activeConvRef.current && closedConvId === activeConvRef.current.id) {
                setConversacionActiva(prev => prev ? { ...prev, estado: 'cerrada' } : prev);
              }
            } else if (data.type === 'CONVERSATION_UPDATED') {
              const updatedConvId = data.payload.conversacion_id;
              if (activeConvRef.current && updatedConvId === activeConvRef.current.id) {
                setConversacionActiva(prev => prev ? { ...prev, estado: data.payload.estado, agente_nombre: data.payload.agente_nombre || prev.agente_nombre } : prev);
              }
            }
          } catch (err) {
          console.error('Error parsing SSE message', err);
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error. Trying to reconnect...');
        eventSource.close();
        setTimeout(() => {
          eventSource = new EventSource(`${API_BASE_URL}/support/stream?token=${token}`);
          connectSSE();
        }, 5000); // Intento de reconexión manual si falla (aunque EventSource suele hacerlo)
      };
    };

    connectSSE();

    return () => {
      eventSource.close();
    };
  }, [isPremium]);

  // Sincronización automática de respaldo cada 3 segundos
  useEffect(() => {
    if (!isPremium || vista !== 'activa' || !conversacionActiva) return;

    const interval = setInterval(async () => {
      try {
        const res = await soporteService.getConversaciones();
        if (res.activas && res.activas.length > 0) {
          const actual = res.activas[0];
          setConversacionActiva(actual);
          if (actual.mensajes && actual.mensajes.length > 0) {
            setMensajes(prev => {
              const prevIds = new Set(prev.map(m => m.id));
              const nuevos = actual.mensajes!.filter(m => !prevIds.has(m.id));
              if (nuevos.length > 0) {
                if (isAtBottomRef.current) {
                  setTimeout(() => scrollToBottom(), 100);
                } else {
                  setUnreadCount(c => c + nuevos.length);
                }
                return [...prev.filter(m => !(m as any).tempId), ...nuevos];
              }
              return prev;
            });
          }
        } else if (res.cerradas && res.cerradas.some(c => c.id === conversacionActiva.id)) {
          setConversacionActiva(prev => prev ? { ...prev, estado: 'cerrada' } : prev);
        }
      } catch (e) {
        // Silencioso
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPremium, vista, conversacionActiva?.id]);

  // Usamos un ref para leer el estado dentro del evento de SSE
  const isAtBottomRef = useRef(true);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  if (!isPremium) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 text-center bg-white dark:bg-apple-dark-bg-secondary rounded-3xl border border-apple-border dark:border-apple-dark-border">
        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Star size={32} className="fill-current" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Soporte Exclusivo Premium</h2>
        <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary">
          El módulo de soporte con agentes en tiempo real está disponible únicamente para usuarios con plan Premium. 
          Mejora tu plan para acceder a asistencia prioritaria.
        </p>
      </div>
    );
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAtBottom(true);
      setUnreadCount(0);
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
      setIsAtBottom(isBottom);
      if (isBottom) {
        setUnreadCount(0);
      }
    }
  };

  const verConversacionCerrada = (conv: ConversacionSoporte) => {
    setConversacionSeleccionada(conv);
    setMensajes(conv.mensajes || []);
    setVista('detalle_cerrada');
  };

  const iniciarNuevaConversacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;

    try {
      setLoading(true);
      const res = await soporteService.enviarMensaje(nuevoMensaje);
      setNuevoMensaje('');
      await fetchDatos();
      setVista('activa');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar la conversación');
    } finally {
      setLoading(false);
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = nuevoMensaje.trim();
    if (!texto || !conversacionActiva || sending) return;

    setNuevoMensaje('');
    setSending(true);
    
    // Add optimistic message
    const tempId = `temp-${Date.now()}`;
    const tempMsg: MensajeSoporte & { isSending?: boolean; tempId?: string } = {
      id: tempId,
      tempId,
      conversacion_id: conversacionActiva.id,
      remitente_tipo: 'restaurante',
      mensaje: texto,
      leido: false,
      created_at: new Date().toISOString(),
      isSending: true
    };
    
    setMensajes(prev => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const res = await soporteService.enviarMensaje(texto);
      if (res.mensaje) {
        setMensajes(prev => {
          let updated = prev.map(m => (m as any).tempId === tempId ? { ...res.mensaje, tempId: undefined } : m);
          if ((res as any).autoMensaje && !updated.some(m => m.id === (res as any).autoMensaje.id)) {
            updated.push((res as any).autoMensaje);
          }
          return updated;
        });
        
        // Actualizar contador de mensajes del restaurante
        setConversacionActiva(prev => prev ? {
          ...prev,
          mensajes_restaurante_count: res.mensajes_restaurante_count ?? ((prev.mensajes_restaurante_count || 0) + 1)
        } : prev);

        if (!conversacionActiva) {
          fetchDatos();
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || '';
      const esLimite = err.response?.status === 403 || /l[íi]mite/i.test(errorMsg);

      setMensajes(prev => prev.filter(m => (m as any).tempId !== tempId));

      if (esLimite) {
        // Al llegar al límite, fijar el contador para mostrar el aviso amarillo sin error rojo
        setConversacionActiva(prev => prev ? { ...prev, mensajes_restaurante_count: 5 } : prev);
        setNuevoMensaje('');
      } else {
        setError('Error al enviar. Intenta de nuevo.');
        setNuevoMensaje(texto); // restore
      }
    } finally {
      setSending(false);
    }
  };

  const enviarCalificacion = async (conv: ConversacionSoporte) => {
    if (rating === 0) return;
    try {
      setEnviandoCalificacion(true);
      const trimmedComment = ratingComment.trim();
      await soporteService.calificarConversacion(conv.id, rating, trimmedComment);
      // Update local state
      const updated = { ...conv, calificacion: rating, comentario_calificacion: trimmedComment };
      
      if (conversacionSeleccionada?.id === conv.id) {
        setConversacionSeleccionada(updated);
      }
      if (conversacionActiva?.id === conv.id) {
        setConversacionActiva(updated);
      }
      setConversacionesCerradas(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err) {
      setError('Error al enviar calificación');
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  const renderEvaluationForm = (conv: ConversacionSoporte) => {
    if (conv.calificacion) {
      return (
        <div className="p-4 border-t border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg flex flex-col items-center">
          <div className="flex items-center gap-4 justify-center bg-white dark:bg-apple-dark-bg-secondary p-4 rounded-xl border border-apple-border dark:border-apple-dark-border mb-4 w-full">
            <span className="font-medium">Tu calificación:</span>
            <div className="flex text-yellow-500">
              {[1, 2, 3, 4, 5].map(star => (
                <Star key={star} size={20} className={star <= conv.calificacion! ? 'fill-current' : 'text-gray-300 dark:text-gray-600'} />
              ))}
            </div>
            {conv.comentario_calificacion && (
               <span className="text-sm text-apple-text-secondary italic">"{conv.comentario_calificacion}"</span>
            )}
          </div>
          <p className="text-sm text-apple-text-secondary text-center">
            Esta conversación ha sido finalizada. Gracias por contactar con soporte. 
            {conv.agente_nombre && ` Fuiste atendido por: ${conv.agente_nombre}`}
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 border-t border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg">
        <div className="bg-white dark:bg-apple-dark-bg-secondary p-4 rounded-xl border border-apple-border dark:border-apple-dark-border mb-4">
          <h4 className="font-medium text-center mb-3">¿Qué tal te pareció nuestra atención?</h4>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map(star => (
              <button 
                key={star} 
                onClick={() => setRating(star)}
                className={`transition-colors ${star <= rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'}`}
              >
                <Star size={32} className={star <= rating ? 'fill-current' : ''} />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div className="flex flex-col gap-2">
              <textarea 
                maxLength={250}
                placeholder="Comentario opcional (máx 250 caracteres)..." 
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg outline-none resize-none h-20"
              />
              <button 
                onClick={() => enviarCalificacion(conv)}
                disabled={enviandoCalificacion}
                className="px-4 py-2 bg-apple-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 self-end"
              >
                Enviar Calificación
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-apple-text-secondary text-center">
          Esta conversación ha sido finalizada. Gracias por contactar con soporte. 
          {conv.agente_nombre && ` Fuiste atendido por: ${conv.agente_nombre}`}
        </p>
      </div>
    );
  };



  const renderMensajes = () => (
    <div className="relative flex-1 overflow-hidden flex flex-col bg-apple-bg dark:bg-apple-dark-bg">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="chat-messages flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
      >
      {loading && mensajes.length === 0 ? (
        <div className="space-y-4 animate-pulse">
          <div className="flex justify-start">
            <div className="w-64 h-14 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm blur-[1px]" />
          </div>
          <div className="flex justify-end">
            <div className="w-52 h-12 bg-apple-blue/20 rounded-2xl rounded-br-sm blur-[1px]" />
          </div>
          <div className="flex justify-start">
            <div className="w-72 h-16 bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm blur-[1px]" />
          </div>
        </div>
      ) : mensajes.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-apple-text-secondary">
          <MessageSquare size={48} className="mb-4 opacity-20" />
          <p>No hay mensajes en esta conversación.</p>
        </div>
      ) : (
        mensajes.map(msg => {
          const remitente = msg.remitente_tipo?.toLowerCase() || '';
          const isMine = remitente === 'restaurante';
          const isSystem = remitente === 'sistema';
          
          if (isSystem) {
             return (
               <div key={msg.id} className="flex justify-center my-2">
                 <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                   {msg.mensaje}
                 </span>
               </div>
             );
          }

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] p-3 px-4 rounded-2xl text-sm ${
                  isMine 
                    ? 'bg-apple-blue text-white rounded-br-sm' 
                    : 'bg-white dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-bl-sm'
                } ${(msg as any).isSending ? 'opacity-70' : ''}`}
              >
                <p className="whitespace-pre-wrap">{censurarGroserias(msg.mensaje)}</p>
                <div className={`text-[10px] flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-white/70' : 'text-apple-text-tertiary'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMine && (msg as any).isSending && <span>Enviando...</span>}
                </div>
              </div>
            </div>
          );
        })
      )}
      
      {!isAtBottom && unreadCount > 0 && (
        <button 
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-apple-blue text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors z-10"
        >
          <span>Nuevos mensajes ({unreadCount})</span>
        </button>
      )}
    </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto h-[calc(100vh-80px)] flex gap-6">
      
      {/* Sidebar para historial */}
      <div className="w-1/3 flex flex-col gap-4">
        <div className="bg-white dark:bg-apple-dark-bg-secondary p-4 rounded-2xl shadow-sm border border-apple-border dark:border-apple-dark-border">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-apple-blue" />
            Soporte
          </h2>
          <button 
            onClick={() => conversacionActiva ? setVista('activa') : setVista('crear')}
            className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-colors ${vista === 'activa' || vista === 'crear' ? 'bg-apple-blue text-white' : 'hover:bg-apple-bg dark:hover:bg-apple-dark-bg'}`}
          >
            <span className="font-medium">Conversación Actual</span>
            {!conversacionActiva && vista !== 'crear' && <Plus size={16} />}
          </button>
        </div>

        <div className="bg-white dark:bg-apple-dark-bg-secondary p-4 rounded-2xl shadow-sm border border-apple-border dark:border-apple-dark-border flex-1 flex flex-col overflow-hidden">
          <h3 className="font-bold text-sm text-apple-text-secondary mb-3 uppercase tracking-wider">
            Historial
          </h3>
          <div className="overflow-y-auto flex-1 space-y-2 pr-2">
            {conversacionesCerradas.length === 0 ? (
              <p className="text-sm text-apple-text-secondary italic">No hay conversaciones previas.</p>
            ) : (
              conversacionesCerradas.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => verConversacionCerrada(conv)}
                  className={`w-full p-3 rounded-xl text-left border ${conversacionSeleccionada?.id === conv.id && vista === 'detalle_cerrada' ? 'border-apple-blue bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-apple-bg dark:hover:bg-apple-dark-bg'}`}
                >
                  <div className="font-medium text-sm truncate">{conv.asunto || 'Consulta de Soporte'}</div>
                  <div className="text-xs text-apple-text-secondary mt-1 flex justify-between">
                    <span>{new Date(conv.created_at || conv.fecha_creacion || Date.now()).toLocaleDateString()}</span>
                    {conv.calificacion && (
                      <span className="flex items-center text-yellow-500">
                        <Star size={10} className="fill-current mr-1" /> {conv.calificacion}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Área Principal */}
      <div className="w-2/3 flex flex-col bg-white dark:bg-apple-dark-bg-secondary rounded-2xl shadow-sm border border-apple-border dark:border-apple-dark-border overflow-hidden relative">
        
        {error && (
          <div className="absolute top-4 left-4 right-4 z-10 bg-red-50 text-red-500 p-3 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div>
            <button onClick={() => setError('')}><X size={16} /></button>
          </div>
        )}

        {vista === 'crear' && (
          <div className="p-8 h-full flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-apple-bg dark:bg-apple-dark-bg p-6 rounded-2xl border border-apple-border dark:border-apple-dark-border">
              <h2 className="text-xl font-bold mb-4 text-center">Nueva Consulta de Soporte</h2>
              <form onSubmit={iniciarNuevaConversacion} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Mensaje Inicial</label>
                  <textarea
                    required
                    value={nuevoMensaje}
                    onChange={e => setNuevoMensaje(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 rounded-xl border border-apple-border dark:border-apple-dark-border bg-white dark:bg-apple-dark-bg-secondary focus:border-apple-blue outline-none resize-none"
                    placeholder="Describe detalladamente tu problema o duda..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-apple-blue text-white py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Iniciar Conversación'}
                </button>
              </form>
            </div>
          </div>
        )}

        {vista === 'activa' && conversacionActiva && (
          <>
            <div className="p-4 border-b border-apple-border dark:border-apple-dark-border flex justify-between items-center bg-apple-bg dark:bg-apple-dark-bg">
              <div>
                <h3 className="font-bold text-lg">{conversacionActiva.asunto || 'Consulta de Soporte'}</h3>
                <span className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${
                  conversacionActiva.estado === 'en_atencion' || conversacionActiva.estado === 'abierta' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                  conversacionActiva.estado === 'cerrada' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {conversacionActiva.estado === 'en_atencion' || conversacionActiva.estado === 'abierta' ? 
                    (conversacionActiva.agente_nombre ? `En atención por ${conversacionActiva.agente_nombre}` : 'En atención - Agente respondiendo') : 
                   conversacionActiva.estado === 'cerrada' ? `Cerrada el ${new Date(conversacionActiva.updated_at || conversacionActiva.created_at || conversacionActiva.fecha_creacion || Date.now()).toLocaleDateString()}` :
                   'Pendiente - Esperando agente'}
                </span>
              </div>
            </div>
            
            {renderMensajes()}

            {conversacionActiva.estado === 'cerrada' ? (
              renderEvaluationForm(conversacionActiva)
            ) : (
              <form onSubmit={enviarMensaje} className="p-4 bg-apple-bg dark:bg-apple-dark-bg border-t border-apple-border dark:border-apple-dark-border flex gap-2">
                {conversacionActiva.estado === 'pendiente' && conversacionActiva.mensajes_restaurante_count >= 5 ? (
                  <div className="flex-1 px-4 py-3 rounded-xl bg-yellow-50 text-yellow-700 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    Has alcanzado el límite de mensajes. Espera a que un agente de soporte responda para continuar la conversación.
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={nuevoMensaje}
                      onChange={(e) => setNuevoMensaje(e.target.value)}
                      placeholder="Escribe tu duda o problema aquí..."
                      className="flex-1 px-4 py-3 rounded-xl border border-apple-border dark:border-apple-dark-border bg-white dark:bg-apple-dark-bg-secondary focus:border-apple-blue outline-none"
                    />
                    <button 
                      type="submit"
                      disabled={!nuevoMensaje.trim() || sending}
                      className="bg-apple-blue text-white w-12 h-12 flex items-center justify-center rounded-xl disabled:opacity-50 transition-colors shrink-0"
                    >
                      <Send size={20} />
                    </button>
                  </>
                )}
              </form>
            )}
          </>
        )}

        {vista === 'detalle_cerrada' && conversacionSeleccionada && (
          <>
            <div className="p-4 border-b border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{conversacionSeleccionada.asunto || 'Consulta de Soporte'}</h3>
                <span className="text-xs px-2 py-1 rounded-full mt-1 inline-block bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  Cerrada el {new Date(conversacionSeleccionada.updated_at || conversacionSeleccionada.created_at || conversacionSeleccionada.fecha_creacion || Date.now()).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            {renderMensajes()}

            {renderEvaluationForm(conversacionSeleccionada)}
          </>
        )}

      </div>
    </div>
  );
}
