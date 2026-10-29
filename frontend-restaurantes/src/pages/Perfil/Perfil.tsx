import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth';
import { restauranteService } from '../../services/restaurante';
import { User, Mail, Phone, Store, CreditCard, Lock, LogOut, ChevronRight, MapPin, Navigation, Map, CheckCircle2, DollarSign } from 'lucide-react';

export function Perfil() {
  const navigate = useNavigate();
  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    restaurante: '',
    plan: 'Estándar',
    estado: 'Activo',
    dias_restantes: 0,
    expira_en: '',
  });
  const [passwordData, setPasswordData] = useState({
    actual: '',
    nueva: '',
    confirmar: '',
  });
  const [error, setError] = useState('');

  // Estado para Datos del Establecimiento (Dirección y Ambiente)
  const [establecimiento, setEstablecimiento] = useState({
    direccion: '',
    ambiente: 'Familiar',
  });
  const [configDisenoFull, setConfigDisenoFull] = useState<any>({});
  const [savingEstablecimiento, setSavingEstablecimiento] = useState(false);
  const [establecimientoSuccess, setEstablecimientoSuccess] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Estado para Moneda y Formato de Precios
  const [moneda, setMoneda] = useState({
    simbolo: '$',
    posicion: 'prefijo',
  });
  const [savingMoneda, setSavingMoneda] = useState(false);
  const [monedaSuccess, setMonedaSuccess] = useState(false);

  useEffect(() => {
    cargarPerfil();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const cargarPerfil = async () => {
    try {
      const info = await restauranteService.getRestauranteInfo();
      setUserData({
        nombre: info.nombre_dueño || '',
        email: info.email || '',
        telefono: info.telefono || '',
        restaurante: info.nombre_negocio || '',
        plan: info.stats?.nombre_plan || info.plan || 'Estándar',
        estado: info.suscripcion_activa ? 'Activo' : 'Inactivo',
        dias_restantes: info.stats?.dias_restantes || 0,
        expira_en: info.stats?.expira_en ? new Date(info.stats.expira_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A',
      });
      if (info.config_diseno) {
        setConfigDisenoFull(info.config_diseno);
        setEstablecimiento({
          direccion: info.config_diseno.informacion?.direccion || '',
          ambiente: info.config_diseno.informacion?.ambiente || 'Familiar',
        });
        if (info.config_diseno.moneda) {
          setMoneda({
            simbolo: info.config_diseno.moneda.simbolo || '$',
            posicion: info.config_diseno.moneda.posicion || 'prefijo',
          });
        }
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarLeaflet = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).L) {
        resolve((window as any).L);
        return;
      }

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        resolve((window as any).L);
      };
      script.onerror = (err) => {
        reject(err);
      };
      document.body.appendChild(script);
    });
  };

  const inicializarMapa = async (latDefault = 19.4326, lonDefault = -99.1332) => {
    try {
      setLoadingMap(true);
      const L = await cargarLeaflet();
      
      setTimeout(() => {
        const mapContainer = document.getElementById('map-perfil-establecimiento');
        if (!mapContainer) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const map = L.map('map-perfil-establecimiento').setView([latDefault, lonDefault], 15);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        const marker = L.marker([latDefault, lonDefault], {
          draggable: true
        }).addTo(map);
        markerRef.current = marker;

        const actualizarDireccionDesdeCoordenadas = async (lat: number, lng: number) => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              {
                headers: {
                  "Accept-Language": "es"
                }
              }
            );
            const data = await response.json();
            if (data && data.display_name) {
              setEstablecimiento(prev => ({ ...prev, direccion: data.display_name }));
            }
          } catch (error) {
            console.error("Error en reverse geocoding al mover marcador:", error);
          }
        };

        marker.on('dragend', function () {
          const position = marker.getLatLng();
          actualizarDireccionDesdeCoordenadas(position.lat, position.lng);
        });

        map.on('click', function (e: any) {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          actualizarDireccionDesdeCoordenadas(lat, lng);
        });

        setLoadingMap(false);
      }, 100);

    } catch (error) {
      console.error("Error al inicializar Leaflet:", error);
      alert("No se pudo cargar el mapa. Verifica tu conexión a internet.");
      setLoadingMap(false);
    }
  };

  const buscarDireccionYAbrirMapa = async () => {
    if (showMap) {
      setShowMap(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }
    
    setShowMap(true);
    const direccionActual = establecimiento.direccion;
    
    if (direccionActual && direccionActual.trim() !== '') {
      try {
        setLoadingMap(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccionActual)}&limit=1`
        );
        const data = await response.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          inicializarMapa(lat, lon);
          return;
        }
      } catch (error) {
        console.error("Error al buscar coordenadas de dirección existente:", error);
      }
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          inicializarMapa(position.coords.latitude, position.coords.longitude);
        },
        () => {
          inicializarMapa();
        }
      );
    } else {
      inicializarMapa();
    }
  };

  const obtenerUbicacionActual = () => {
    if (!navigator.geolocation) {
      alert("La geolocalización no está soportada por tu navegador.");
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                "Accept-Language": "es"
              }
            }
          );
          const data = await response.json();
          if (data && data.display_name) {
            setEstablecimiento(prev => ({ ...prev, direccion: data.display_name }));
            if (mapInstanceRef.current && markerRef.current) {
              const newLatLng = [latitude, longitude] as [number, number];
              mapInstanceRef.current.setView(newLatLng, 16);
              markerRef.current.setLatLng(newLatLng);
            }
          } else {
            alert("No pudimos obtener la dirección exacta, pero puedes buscarla en el mapa.");
          }
        } catch (error) {
          console.error("Error en reverse geocoding:", error);
          alert("Error al obtener la dirección escrita. Por favor escríbela manualmente.");
        } finally {
          setLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Error de geolocalización:", error);
        setLoadingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          alert("Permiso de ubicación denegado. Por favor, actívalo o escribe tu dirección manualmente.");
        } else {
          alert("No pudimos obtener tu ubicación actual.");
        }
      }
    );
  };

  const handleGuardarEstablecimiento = async (e?: React.FormEvent, ambienteOverride?: string) => {
    if (e) e.preventDefault();
    setSavingEstablecimiento(true);
    setEstablecimientoSuccess(false);
    try {
      const nuevoConfigDiseno = {
        ...configDisenoFull,
        informacion: {
          ...(configDisenoFull?.informacion || {}),
          direccion: establecimiento.direccion,
          ambiente: ambienteOverride !== undefined ? ambienteOverride : establecimiento.ambiente,
        }
      };
      await restauranteService.updateTheme({
        config_diseno: nuevoConfigDiseno
      });
      setConfigDisenoFull(nuevoConfigDiseno);
      if (ambienteOverride !== undefined) {
        setEstablecimiento(prev => ({ ...prev, ambiente: ambienteOverride }));
      }
      setEstablecimientoSuccess(true);
      setTimeout(() => setEstablecimientoSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error al guardar datos del establecimiento:', err);
      alert(err.response?.data?.mensaje || 'Error al guardar los datos del establecimiento.');
    } finally {
      setSavingEstablecimiento(false);
    }
  };

  const handleGuardarMoneda = async (nuevoSimbolo?: string, nuevaPosicion?: string) => {
    setSavingMoneda(true);
    setMonedaSuccess(false);
    const simboloFinal = nuevoSimbolo !== undefined ? nuevoSimbolo : moneda.simbolo;
    const posicionFinal = nuevaPosicion !== undefined ? nuevaPosicion : moneda.posicion;

    try {
      const nuevoConfigDiseno = {
        ...configDisenoFull,
        moneda: {
          simbolo: simboloFinal,
          posicion: posicionFinal,
        }
      };
      await restauranteService.updateTheme({
        config_diseno: nuevoConfigDiseno
      });
      setConfigDisenoFull(nuevoConfigDiseno);
      setMoneda({
        simbolo: simboloFinal,
        posicion: posicionFinal,
      });
      setMonedaSuccess(true);
      setTimeout(() => setMonedaSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error al guardar configuración de moneda:', err);
      alert(err.response?.data?.mensaje || 'Error al guardar la moneda.');
    } finally {
      setSavingMoneda(false);
    }
  };

  const handleGuardarPerfil = async () => {
    setSaving(true);
    setError('');
    try {
      await authService.updatePerfil({
        nombre: userData.nombre,
        email: userData.email,
        telefono: userData.telefono,
      });
      setEditando(false);
      alert('Perfil actualizado correctamente');
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.nueva !== passwordData.confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await authService.changePassword({
        actual: passwordData.actual,
        nueva: passwordData.nueva,
      });
      setPasswordData({ actual: '', nueva: '', confirmar: '' });
      alert('Contraseña actualizada correctamente');
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-12 max-w-4xl mx-auto min-h-screen">
      <motion.div
        className="mb-8 sm:mb-12 flex flex-col md:flex-row items-center gap-6 sm:gap-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-[2rem] sm:rounded-[2.5rem] bg-apple-blue/10 border border-apple-blue/20 flex items-center justify-center text-4xl sm:text-5xl shadow-apple-md">
          👤
        </div>
        <div className="text-center md:text-left min-w-0 w-full">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 break-words">{userData.nombre}</h1>
          <div className="flex flex-col sm:flex-row flex-wrap items-center md:items-start justify-center md:justify-start gap-3 sm:gap-4">
            <span className="flex items-center justify-center md:justify-start gap-1.5 text-apple-text-secondary font-medium break-all sm:break-words w-full sm:w-auto">
              <Mail size={16} className="shrink-0" /> 
              <span className="break-all sm:break-words">{userData.email}</span>
            </span>
            {userData.telefono && (
              <span className="flex items-center justify-center md:justify-start gap-1.5 text-apple-text-secondary font-medium w-full sm:w-auto">
                <Phone size={16} className="shrink-0" /> 
                <span>{userData.telefono}</span>
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[14px] text-center font-bold"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {error}
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        {/* Información Personal */}
        <motion.div
          className="p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm flex flex-col"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-8 gap-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <User size={20} className="text-apple-blue shrink-0" />
              Datos del Dueño
            </h3>
            {!editando && (
              <button
                onClick={() => setEditando(true)}
                className="text-apple-blue font-bold text-sm hover:underline shrink-0"
              >
                Editar
              </button>
            )}
          </div>

          {editando ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-apple-text-tertiary ml-1">Nombre</label>
                <input
                  type="text"
                  value={userData.nombre}
                  onChange={(e) => setUserData({ ...userData, nombre: e.target.value })}
                  className="w-full px-5 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border rounded-2xl focus:ring-2 focus:ring-apple-blue outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-apple-text-tertiary ml-1">Email</label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="w-full px-5 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border rounded-2xl focus:ring-2 focus:ring-apple-blue outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-apple-text-tertiary ml-1">Teléfono</label>
                <input
                  type="tel"
                  value={userData.telefono}
                  onChange={(e) => setUserData({ ...userData, telefono: e.target.value })}
                  className="w-full px-5 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border rounded-2xl focus:ring-2 focus:ring-apple-blue outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditando(false)}
                  className="flex-1 py-3 rounded-xl border border-apple-border dark:border-apple-dark-border font-bold text-sm hover:bg-apple-bg transition-all"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarPerfil}
                  disabled={saving}
                  className="flex-1 py-3 bg-apple-blue text-white rounded-xl font-bold text-sm shadow-apple-glow hover:bg-apple-blue-hover transition-all disabled:opacity-50"
                >
                  {saving ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
                <span className="text-apple-text-secondary font-medium whitespace-nowrap">Nombre</span>
                <span className="font-bold text-left sm:text-right break-words">{userData.nombre}</span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
                <span className="text-apple-text-secondary font-medium whitespace-nowrap">Correo</span>
                <span className="font-bold text-left sm:text-right break-all sm:break-words">{userData.email}</span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
                <span className="text-apple-text-secondary font-medium whitespace-nowrap">Teléfono</span>
                <span className="font-bold text-left sm:text-right">{userData.telefono || '—'}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Restaurante & Plan */}
        <motion.div
          className="p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm flex flex-col"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xl font-bold flex items-center gap-2 mb-8">
            <Store size={20} className="text-apple-blue shrink-0" />
            Negocio
          </h3>
          
          <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-10">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
              <span className="text-apple-text-secondary font-medium whitespace-nowrap">Nombre</span>
              <span className="font-bold text-left sm:text-right break-words">{userData.restaurante}</span>
            </div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
              <span className="text-apple-text-secondary font-medium whitespace-nowrap">Plan Actual</span>
              <span className="px-3 py-1 bg-apple-blue/10 text-apple-blue rounded-full text-xs font-black uppercase tracking-widest w-fit">{userData.plan}</span>
            </div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
              <span className="text-apple-text-secondary font-medium whitespace-nowrap">Estado</span>
              <span className="font-bold text-left sm:text-right">{userData.estado}</span>
            </div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
              <span className="text-apple-text-secondary font-medium whitespace-nowrap">Días restantes</span>
              <span className="font-bold text-left sm:text-right">{userData.dias_restantes} días</span>
            </div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center py-3 border-b border-apple-border dark:border-apple-dark-border gap-1">
              <span className="text-apple-text-secondary font-medium whitespace-nowrap">Fecha de vencimiento</span>
              <span className="font-bold text-left sm:text-right">{userData.expira_en}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/precios')}
            className="w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border hover:border-apple-blue transition-all group mt-auto"
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="p-3 bg-apple-blue/10 rounded-xl text-apple-blue shrink-0">
                <CreditCard size={20} />
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-sm truncate">Mejorar Plan</p>
                <p className="text-xs text-apple-text-tertiary truncate">Obtén más funciones</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-apple-text-tertiary group-hover:text-apple-blue transition-colors shrink-0 ml-2" />
          </button>
        </motion.div>

        {/* Datos del Establecimiento */}
        <motion.div
          className="md:col-span-2 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm flex flex-col space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-apple-border dark:border-apple-dark-border pb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Store size={20} className="text-apple-blue shrink-0" />
              Datos del Establecimiento
            </h3>
            {establecimientoSuccess && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full"
              >
                <CheckCircle2 size={14} /> Guardado correctamente
              </motion.span>
            )}
          </div>

          {/* Dirección Física */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-apple-text-secondary ml-1 flex items-center gap-1.5">
              <MapPin size={16} className="text-apple-blue" /> Dirección física del restaurante
            </label>
            
            <form onSubmit={handleGuardarEstablecimiento} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={establecimiento.direccion}
                onChange={(e) => setEstablecimiento({ ...establecimiento, direccion: e.target.value })}
                placeholder="Ej. Av. Reforma 123, Col. Centro, CDMX"
                className="flex-1 px-5 py-3.5 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border text-sm font-medium focus:border-apple-blue outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingEstablecimiento}
                  className="px-6 py-3.5 bg-apple-blue text-white rounded-2xl font-bold text-sm hover:bg-apple-blue-hover active:scale-95 transition-all shadow-apple-sm flex-shrink-0 disabled:opacity-50"
                >
                  {savingEstablecimiento ? 'Guardando...' : 'Guardar'}
                </button>
                {establecimiento.direccion && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(establecimiento.direccion)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3.5 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border text-apple-text-secondary rounded-2xl font-bold text-sm hover:bg-apple-border-hover dark:hover:bg-apple-dark-border-hover active:scale-95 transition-all shadow-apple-xs flex items-center justify-center gap-2"
                    title="Probar en Google Maps"
                  >
                    <MapPin size={16} className="text-red-500 flex-shrink-0" />
                    <span>Maps</span>
                  </a>
                )}
              </div>
            </form>

            {/* Botones de ubicación */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={obtenerUbicacionActual}
                disabled={loadingLocation}
                className="flex items-center gap-1.5 px-4 py-2 bg-apple-blue/10 hover:bg-apple-blue/20 text-apple-blue rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
              >
                {loadingLocation ? (
                  <span className="w-3.5 h-3.5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation size={12} className="flex-shrink-0" />
                )}
                <span>Usar mi ubicación actual</span>
              </button>
              <button
                type="button"
                onClick={buscarDireccionYAbrirMapa}
                className="flex items-center gap-1.5 px-4 py-2 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border text-apple-text-secondary hover:bg-apple-border-hover dark:hover:bg-apple-dark-border-hover rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                <Map size={12} className="text-apple-blue flex-shrink-0" />
                <span>{showMap ? 'Ocultar Mapa' : 'Buscar en el Mapa'}</span>
              </button>
            </div>

            {/* Contenedor del Mapa */}
            <AnimatePresence>
              {showMap && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden pt-2"
                >
                  <div className="relative rounded-2xl overflow-hidden border border-apple-border dark:border-apple-dark-border shadow-inner bg-apple-bg dark:bg-apple-dark-bg">
                    {loadingMap && (
                      <div className="absolute inset-0 bg-black/10 dark:bg-black/35 backdrop-blur-xs flex items-center justify-center z-[1000] text-xs font-bold text-apple-text">
                        Cargando mapa interactivo...
                      </div>
                    )}
                    <div 
                      id="map-perfil-establecimiento" 
                      className="w-full h-64 z-10" 
                    />
                  </div>
                  <p className="text-[10px] text-apple-text-tertiary ml-1">
                    💡 Arrastra el marcador rojo o haz clic en cualquier punto del mapa para seleccionar tu ubicación exacta y rellenar tu dirección automáticamente.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
            <p className="text-[10px] text-apple-text-tertiary ml-1">Esta dirección se mostrará de forma destacada en el pie de página de tu menú digital.</p>
          </div>

          {/* Ambiente del Restaurante */}
          <div className="space-y-4 pt-4 border-t border-apple-border dark:border-apple-dark-border">
            <label className="text-sm font-bold text-apple-text-secondary ml-1">Ambiente / Concepto del Restaurante</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { value: 'Familiar', icon: '👨‍👩‍👧‍👦', label: 'Familiar' },
                { value: 'Citas Románticas', icon: '💖', label: 'Romántico / Parejas' },
                { value: 'Negocios', icon: '💼', label: 'Negocios / Trabajo' },
                { value: 'Amigos y Grupos', icon: '🍻', label: 'Amigos / Grupos' },
                { value: 'Rápido', icon: '⚡', label: 'Rápido / Express' },
                { value: 'Premium', icon: '✨', label: 'Premium / Gourmet' }
              ].map((amb) => (
                <button
                  key={amb.value}
                  type="button"
                  onClick={() => handleGuardarEstablecimiento(undefined, amb.value)}
                  className={`p-4 rounded-2xl border transition-all text-center flex flex-col items-center gap-2 active:scale-95 ${
                    establecimiento.ambiente === amb.value
                      ? 'border-apple-blue bg-apple-blue/5 text-apple-blue shadow-apple-glow'
                      : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary hover:border-apple-blue/30'
                  }`}
                >
                  <span className="text-2xl">{amb.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-wider">{amb.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-apple-text-tertiary ml-1">Selecciona el ambiente que mejor represente tu establecimiento para que tus clientes lo identifiquen.</p>
          </div>
        </motion.div>

        {/* Moneda y Formato de Precios */}
        <motion.div
          className="md:col-span-2 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm flex flex-col space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-apple-border dark:border-apple-dark-border pb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <DollarSign size={20} className="text-apple-blue shrink-0" />
              Moneda y Formato de Precios
            </h3>
            {monedaSuccess && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full"
              >
                <CheckCircle2 size={14} /> Guardado correctamente
              </motion.span>
            )}
          </div>

          {/* Símbolo de Divisa */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-apple-text-secondary ml-1">
              Símbolo de Divisa
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { symbol: '$', label: '$ (MXN/USD/CLP)' },
                { symbol: 'USD $', label: 'USD $' },
                { symbol: '€', label: '€ (EUR)' },
                { symbol: 'S/', label: 'S/ (PEN)' },
                { symbol: 'Q', label: 'Q (GTQ)' },
                { symbol: '₡', label: '₡ (CRC)' },
                { symbol: 'Bs', label: 'Bs (BOB)' },
                { symbol: '£', label: '£ (GBP)' },
              ].map((cur) => (
                <button
                  key={cur.symbol}
                  type="button"
                  onClick={() => handleGuardarMoneda(cur.symbol, undefined)}
                  className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                    moneda.simbolo === cur.symbol
                      ? 'border-apple-blue bg-apple-blue/10 text-apple-blue font-bold shadow-apple-xs'
                      : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text hover:border-apple-blue/30'
                  }`}
                >
                  <span className="block text-base font-black">{cur.symbol}</span>
                  <span className="text-[10px] opacity-75">{cur.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ubicación del Símbolo y Previsualización */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-apple-text-secondary ml-1">
                Ubicación del Símbolo
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleGuardarMoneda(undefined, 'prefijo')}
                  className={`flex-1 p-3.5 rounded-2xl border text-center transition-all active:scale-95 ${
                    moneda.posicion === 'prefijo'
                      ? 'border-apple-blue bg-apple-blue/10 text-apple-blue font-bold shadow-apple-xs'
                      : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text'
                  }`}
                >
                  <p className="text-xs font-bold">Prefijo</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Ej: {moneda.simbolo} 150</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleGuardarMoneda(undefined, 'sufijo')}
                  className={`flex-1 p-3.5 rounded-2xl border text-center transition-all active:scale-95 ${
                    moneda.posicion === 'sufijo'
                      ? 'border-apple-blue bg-apple-blue/10 text-apple-blue font-bold shadow-apple-xs'
                      : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text'
                  }`}
                >
                  <p className="text-xs font-bold">Sufijo</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Ej: 150 {moneda.simbolo}</p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-apple-text-secondary ml-1">
                Previsualización de Precio
              </label>
              <div className="p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-apple-text-tertiary">En el menú digital:</p>
                  <p className="text-2xl font-black text-apple-blue tracking-tight">
                    {moneda.posicion === 'prefijo' ? `${moneda.simbolo} 150.00` : `150.00 ${moneda.simbolo}`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingMoneda}
                  onClick={() => handleGuardarMoneda()}
                  className="px-5 py-2.5 bg-apple-blue text-white rounded-xl text-xs font-bold hover:bg-apple-blue-hover active:scale-95 transition-all shadow-apple-sm disabled:opacity-50"
                >
                  {savingMoneda ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Seguridad */}
        <motion.div
          className="p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm flex flex-col"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-xl font-bold flex items-center gap-2 mb-8">
            <Lock size={20} className="text-apple-blue shrink-0" />
            Seguridad
          </h3>
          
          <form onSubmit={handleCambiarPassword} className="space-y-4">
            <input
              type="password"
              placeholder="Contraseña actual"
              value={passwordData.actual}
              onChange={(e) => setPasswordData({ ...passwordData, actual: e.target.value })}
              className="w-full px-5 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border rounded-2xl focus:ring-2 focus:ring-apple-blue outline-none transition-all"
              required
            />
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={passwordData.nueva}
              onChange={(e) => setPasswordData({ ...passwordData, nueva: e.target.value })}
              className="w-full px-5 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border rounded-2xl focus:ring-2 focus:ring-apple-blue outline-none transition-all"
              required
            />
            <input
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={passwordData.confirmar}
              onChange={(e) => setPasswordData({ ...passwordData, confirmar: e.target.value })}
              className="w-full px-5 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border rounded-2xl focus:ring-2 focus:ring-apple-blue outline-none transition-all"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 mt-2 rounded-2xl border-2 border-dashed border-apple-border dark:border-apple-dark-border font-bold text-apple-text-secondary hover:border-apple-blue hover:text-apple-blue transition-all disabled:opacity-50"
            >
              {saving ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </motion.div>

        {/* Sesión */}
        <motion.div
          className="p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm flex flex-col justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LogOut size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">Cerrar Sesión</h3>
            <p className="text-apple-text-secondary text-sm mb-8 font-medium">¿Seguro que quieres salir de tu cuenta?</p>
            
            <button
              onClick={() => authService.logout()}
              className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-95 transition-all"
            >
              Salir ahora
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}