import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminService } from '../../services/admin';
import { authService } from '../../services/auth';
import { ShieldCheck, Search, RefreshCw, LogOut, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';

interface Restaurante {
  id: string;
  nombre_negocio: string;
  nombre_dueño?: string;
  email: string;
  plan: string;
  estado: 'pendiente' | 'aprobado' | 'suspendido' | string;
  suscripcion_activa: boolean;
  suscripcion_expira_en?: string;
  dias_licencia?: number;
  created_at: string;
  total_platillos?: number;
}

export function AdminPanel() {
  const navigate = useNavigate();
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'pendiente' | 'aprobado' | 'suspendido'>('todos');
  const [diasInput, setDiasInput] = useState<{ [key: string]: number }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  const fetchRestaurantes = async () => {
    setLoading(true);
    try {
      const data = await adminService.getRestaurantes();
      if (Array.isArray(data)) {
        setRestaurantes(data);
      }
    } catch (error) {
      console.error('Error cargando restaurantes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurantes();
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleAprobar = async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const dias = diasInput[id] || 30;
      await adminService.aprobarRestaurante(id, dias);
      setRestaurantes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, estado: 'aprobado', suscripcion_activa: true, dias_licencia: dias } : r
        )
      );
    } catch (error) {
      console.error('Error aprobando restaurante:', error);
      alert('Error al aprobar el restaurante.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCancelarAcceso = async (id: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await adminService.cancelarAcceso(id);
      setRestaurantes((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, estado: 'suspendido', suscripcion_activa: false } : r
        )
      );
    } catch (error) {
      console.error('Error cancelando acceso:', error);
      alert('Error al suspender el acceso.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Filtrado y búsqueda
  const filteredRestaurantes = restaurantes.filter((r) => {
    const matchesSearch =
      r.nombre_negocio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'todos') return matchesSearch;
    return matchesSearch && r.estado?.toLowerCase() === activeTab;
  });

  const totalRegistrados = restaurantes.length;
  const countPendientes = restaurantes.filter((r) => r.estado?.toLowerCase() === 'pendiente').length;
  const countAprobados = restaurantes.filter((r) => r.estado?.toLowerCase() === 'aprobado').length;
  const countSuspendidos = restaurantes.filter((r) => r.estado?.toLowerCase() === 'suspendido').length;

  return (
    <div className="min-h-screen bg-apple-bg dark:bg-apple-dark-bg text-apple-text dark:text-apple-dark-text py-8 px-6 lg:px-12 max-w-[1400px] mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-apple-border dark:border-apple-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-apple-blue flex items-center justify-center text-white font-bold text-xl shadow-apple-glow">
            🇲🇽
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight">MexxicanMX</span>
            <span className="block text-xs font-bold text-amber-500 uppercase tracking-widest">Super Admin</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-apple-border dark:border-apple-dark-border text-sm font-bold hover:bg-apple-bg-secondary dark:hover:bg-apple-dark-bg-secondary transition-all cursor-pointer"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>

      {/* Main Title Section */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Panel de Control Central</h1>
        <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary text-base font-medium">
          Control de restaurantes, asignación de licencias y activación de planes en tiempo real.
        </p>
      </motion.div>

      {/* Counter KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-6 rounded-3xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border">
          <p className="text-xs font-black uppercase tracking-wider text-apple-text-tertiary mb-1">Registrados</p>
          <p className="text-3xl font-extrabold">{totalRegistrados}</p>
        </div>
        <div className="p-6 rounded-3xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border">
          <p className="text-xs font-black uppercase tracking-wider text-amber-500 mb-1">Pendientes</p>
          <p className="text-3xl font-extrabold text-amber-500">{countPendientes}</p>
        </div>
        <div className="p-6 rounded-3xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-500 mb-1">Aprobados</p>
          <p className="text-3xl font-extrabold text-emerald-500">{countAprobados}</p>
        </div>
        <div className="p-6 rounded-3xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border">
          <p className="text-xs font-black uppercase tracking-wider text-rose-500 mb-1">Suspendidos</p>
          <p className="text-3xl font-extrabold text-rose-500">{countSuspendidos}</p>
        </div>
      </div>

      {/* Controls: Search & Tabs */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-text-tertiary" size={18} />
          <input
            type="text"
            placeholder="Buscar negocio por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-apple-blue"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'todos'
                ? 'bg-apple-blue text-white shadow-apple-glow'
                : 'bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border'
            }`}
          >
            Todos ({totalRegistrados})
          </button>
          <button
            onClick={() => setActiveTab('pendiente')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pendiente'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-amber-500'
            }`}
          >
            Pendientes ({countPendientes})
          </button>
          <button
            onClick={() => setActiveTab('aprobado')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'aprobado'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-emerald-500'
            }`}
          >
            Aprobados ({countAprobados})
          </button>
          <button
            onClick={() => setActiveTab('suspendido')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'suspendido'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-rose-500'
            }`}
          >
            Suspendidos ({countSuspendidos})
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-3xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-apple-border dark:border-apple-dark-border text-xs font-black uppercase text-apple-text-tertiary bg-apple-bg-tertiary/40">
                <th className="py-4 px-6">Negocio</th>
                <th className="py-4 px-6">Plan</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6">Vencimiento</th>
                <th className="py-4 px-6">Licencia</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-border dark:divide-apple-dark-border text-sm font-medium">
              {filteredRestaurantes.map((r) => {
                const est = (r.estado || 'pendiente').toLowerCase();
                const isLoadingThis = actionLoading[r.id];

                return (
                  <tr key={r.id} className="hover:bg-apple-bg-tertiary/30 transition-colors">
                    {/* Negocio */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-base">{r.nombre_negocio}</div>
                      <div className="text-xs text-apple-text-tertiary font-mono">{r.email}</div>
                    </td>

                    {/* Plan */}
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-apple-blue/10 text-apple-blue uppercase border border-apple-blue/20">
                        {r.plan || 'basico'}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="py-4 px-6">
                      {est === 'aprobado' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={14} />
                          aprobado
                        </span>
                      )}
                      {est === 'pendiente' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock size={14} />
                          pendiente
                        </span>
                      )}
                      {est === 'suspendido' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle size={14} />
                          suspendido
                        </span>
                      )}
                    </td>

                    {/* Vencimiento */}
                    <td className="py-4 px-6 text-apple-text-secondary text-xs">
                      {r.suscripcion_expira_en ? (
                        new Date(r.suscripcion_expira_en).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Licencia */}
                    <td className="py-4 px-6 text-xs font-bold">
                      {r.dias_licencia ? `${r.dias_licencia} días` : 'Sin asignar'}
                    </td>

                    {/* Acciones */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Enlace al menú del restaurante */}
                        <a
                          href={`/menu/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl border border-apple-border dark:border-apple-dark-border text-apple-text-tertiary hover:text-apple-blue transition-colors cursor-pointer"
                          title="Ver Menú Público"
                        >
                          <ExternalLink size={16} />
                        </a>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={diasInput[r.id] || 30}
                            onChange={(e) =>
                              setDiasInput({
                                ...diasInput,
                                [r.id]: parseInt(e.target.value) || 30,
                              })
                            }
                            className="w-16 px-2 py-1.5 rounded-xl border border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-xs font-bold text-center"
                            title="Días de acceso"
                          />
                          <button
                            onClick={() => handleAprobar(r.id)}
                            disabled={isLoadingThis}
                            className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 shadow-sm transition-all cursor-pointer"
                          >
                            {isLoadingThis ? 'Guardando...' : est === 'aprobado' ? 'Guardar Tiempo' : est === 'suspendido' ? 'Reactivar' : 'Aprobar'}
                          </button>

                          {est === 'aprobado' && (
                            <button
                              onClick={() => handleCancelarAcceso(r.id)}
                              disabled={isLoadingThis}
                              className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 font-bold text-xs transition-all cursor-pointer"
                            >
                              Cancelar Acceso
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRestaurantes.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-apple-text-tertiary font-medium">
                    No se encontraron registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
