import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { restauranteService } from '../../services/restaurante';
import { useRestaurant } from '../../context/RestaurantContext';
import { LayoutDashboard, QrCode, Utensils, Zap, ExternalLink, Copy, Download, PlusCircle, ChevronRight } from 'lucide-react';
import { getPublicMenuUrl } from '../../utils/menuUtils';

export function DashboardRestaurante() {
  const navigate = useNavigate();
  const { restaurant, limits, isPremium, loading: contextLoading } = useRestaurant();
  const [platillos, setPlatillos] = useState<any[]>([]);
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [platillosData, qrRes] = await Promise.all([
          restauranteService.getPlatillos(),
          restauranteService.getQR().catch(() => null),
        ]);
        setPlatillos(platillosData);
        setQrData(qrRes);
      } catch (error) {
        console.error('Error cargando dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (!contextLoading) {
      fetchData();
    }
  }, [contextLoading]);

  const handleDescargarQR = () => {
    if (!qrData?.qr_base64) return;
    const a = document.createElement('a');
    a.href = qrData.qr_base64;
    a.download = `qr-${restaurant?.nombre_negocio || 'restaurante'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isWaitingData = contextLoading || loading;

  const stats = [
    { label: 'Platillos en menú', value: isWaitingData ? '...' : platillos.length, icon: Utensils, color: 'text-apple-blue', bg: 'bg-apple-blue/10' },
    { label: `Suscripción ${restaurant?.plan || 'estándar'}`, value: isWaitingData ? '...' : `${restaurant?.dias_restantes || 0} ${restaurant?.dias_restantes === 1 ? 'día restante' : 'días restantes'}`, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="py-12 px-6 lg:px-12 max-w-[1400px] mx-auto min-h-screen">
      <motion.div
        className="mb-12"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
          Hola, {restaurant?.nombre_negocio || 'Chef'} 👋
        </h1>
        <p className="text-lg text-apple-text-secondary dark:text-apple-dark-text-secondary font-medium">
          Todo listo para gestionar <span className="text-apple-text dark:text-apple-dark-text font-bold">{restaurant?.nombre_negocio || 'tu restaurante'}</span>
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* QR Section - Priority 1 */}
        <motion.div 
          className="lg:col-span-2 group relative p-10 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm hover:shadow-apple-xl transition-all duration-500 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-apple-blue/5 blur-[100px] group-hover:bg-apple-blue/10 transition-all duration-500" />
          
          <div className="flex flex-col md:flex-row gap-10 items-center relative z-10">
            <div className="w-56 h-56 bg-white p-4 rounded-[2.5rem] shadow-apple-xl flex-shrink-0 group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
              {qrData?.qr_base64 ? (
                <img src={qrData.qr_base64} alt="Código QR" className="w-full h-full object-contain rounded-2xl" />
              ) : (
                <div className="w-full h-full bg-apple-bg-secondary rounded-2xl flex items-center justify-center border-2 border-dashed border-apple-border animate-pulse">
                  <QrCode size={64} className="text-apple-text-tertiary blur-[1px]" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold mb-4 tracking-tight">Tu Puerta Digital</h2>
              <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary text-lg mb-8 leading-relaxed font-medium">
                Tus clientes pueden ver tu menú escaneando este código. Colócalo en tus mesas para una experiencia premium.
              </p>
              
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Link 
                  to="/dashboard/qr"
                  className="flex items-center gap-2 px-6 py-3 bg-apple-blue text-white font-bold rounded-2xl hover:bg-apple-blue-hover shadow-apple-glow transition-all active:scale-95"
                >
                  <ExternalLink size={18} />
                  Ver QR
                </Link>
                <button 
                  onClick={handleDescargarQR}
                  className="flex items-center gap-2 px-6 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border font-bold rounded-2xl hover:bg-apple-bg-tertiary transition-all active:scale-95 cursor-pointer"
                >
                  <Download size={18} />
                  Descargar
                </button>
                <button 
                  onClick={() => {
                    const identifier = qrData?.slug || restaurant?.slug || restaurant?.id;
                    const menuUrl = getPublicMenuUrl(identifier, qrData?.url_menu);
                    navigator.clipboard.writeText(menuUrl);
                    alert('URL copiada al portapapeles: ' + menuUrl);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border font-bold rounded-2xl hover:bg-apple-bg-tertiary transition-all active:scale-95 cursor-pointer"
                >
                  <Copy size={18} />
                  Copiar URL
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats & Actions */}
        <div className="space-y-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="p-8 rounded-[2rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border flex items-center gap-6 shadow-apple-sm group hover:shadow-apple-md transition-all duration-300"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
            >
              <div className={`w-16 h-16 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-500`}>
                <stat.icon size={28} />
              </div>
              <div>
                <p className="text-[11px] text-apple-text-tertiary mb-0.5 font-black uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
              </div>
            </motion.div>
          ))}

          <Link
            to="/dashboard/platillos/nuevo"
            className="block p-8 rounded-[2rem] bg-apple-blue text-white shadow-apple-glow group hover:scale-[1.02] transition-all active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <PlusCircle size={24} />
              </div>
              <ChevronRight className="opacity-60" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-1">Nuevo Platillo</h3>
            <p className="text-white/80 font-medium">Agrega algo nuevo hoy</p>
          </Link>
        </div>
      </div>

      {/* Quick Menu Overview */}
      <motion.div
        className="mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8 px-4">
          <h2 className="text-2xl font-bold tracking-tight">Actividad reciente</h2>
          <Link 
            to="/dashboard/platillos"
            className="text-apple-blue font-bold text-sm hover:underline flex items-center gap-1"
          >
            Ver todo el menú
            <ChevronRight size={16} />
          </Link>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {platillos.slice(0, 3).map((platillo, i) => (
            <div key={platillo.id} className="p-6 rounded-[2.5rem] bg-apple-bg-secondary/50 dark:bg-apple-dark-bg-secondary/50 border border-apple-border dark:border-apple-dark-border backdrop-blur-sm group hover:bg-apple-bg-secondary dark:hover:bg-apple-dark-bg-secondary transition-all">
              <div className="w-full aspect-square rounded-2xl bg-apple-bg-tertiary mb-4 overflow-hidden border border-apple-border dark:border-apple-dark-border">
                {platillo.url_imagen ? (
                  <img src={platillo.url_imagen} alt={platillo.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-apple-text-tertiary">
                    <Utensils size={32} />
                  </div>
                )}
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-lg mb-0.5">{platillo.nombre}</h4>
                  <p className="text-apple-text-tertiary text-xs font-bold uppercase tracking-wider">{platillo.categoria}</p>
                </div>
                <p className="text-apple-blue font-black">{platillo.precio.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
              </div>
            </div>
          ))}
          {platillos.length === 0 && (
            <div className="col-span-3 py-20 text-center rounded-[3rem] border-2 border-dashed border-apple-border bg-apple-bg-secondary/20">
               <Utensils size={48} className="mx-auto text-apple-text-tertiary mb-4" />
               <p className="text-apple-text-secondary text-lg font-medium">Aún no tienes platillos registrados.</p>
               <Link 
                to="/dashboard/platillos/nuevo"
                className="mt-4 text-apple-blue font-bold inline-block hover:underline"
               >
                 Empieza agregando uno aquí →
               </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}