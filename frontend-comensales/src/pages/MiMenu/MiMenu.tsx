import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { restauranteService } from '../../services/restaurante';
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Utensils } from 'lucide-react';

export function MiMenu() {
  const navigate = useNavigate();
  const [platillos, setPlatillos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  useEffect(() => {
    cargarPlatillos();
  }, []);

  const cargarPlatillos = async () => {
    try {
      const data = await restauranteService.getPlatillos();
      setPlatillos(data);
    } catch (error) {
      console.error('Error cargando platillos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id: string | number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este platillo?')) return;
    
    setDeletingId(id);
    try {
      await restauranteService.eliminarPlatillo(id);
      setPlatillos(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error eliminando platillo:', error);
      alert('No se pudo eliminar el platillo');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (platillo: any) => {
    try {
      const formData = new FormData();
      formData.append('activo', (!platillo.activo).toString());
      await restauranteService.actualizarPlatillo(platillo.id, formData);
      
      setPlatillos(prev => prev.map(p => 
        p.id === platillo.id ? { ...p, activo: !platillo.activo } : p
      ));
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  };

  const filteredPlatillos = platillos.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.categoria && p.categoria.toLowerCase().includes(searchTerm.toLowerCase()))
  );



  return (
    <div className="py-12 px-6 lg:px-12 max-w-[1400px] mx-auto min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">Mi Menú</h1>
          <p className="text-lg text-apple-text-secondary dark:text-apple-dark-text-secondary font-medium">
            Administra tus platillos, precios y disponibilidad.
          </p>
        </div>
        <Link
          to="/dashboard/platillos/nuevo"
          className="flex items-center gap-2 px-6 py-4 bg-apple-blue text-white font-bold rounded-2xl shadow-apple-md hover:bg-apple-blue-hover transition-all active:scale-95 text-center justify-center"
        >
          <Plus size={20} />
          Nuevo Platillo
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-text-tertiary" size={20} />
          <input 
            type="text" 
            placeholder="Buscar platillo o categoría..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-2xl focus:ring-2 focus:ring-apple-blue outline-none transition-all font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div 
              key={n} 
              className="flex flex-col overflow-hidden rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border p-6 animate-pulse"
            >
              <div className="h-48 rounded-2xl bg-white/5 mb-6 blur-[1px]" />
              <div className="h-6 w-3/4 rounded-lg bg-white/10 mb-3" />
              <div className="h-4 w-1/2 rounded-lg bg-white/5 mb-6" />
              <div className="h-10 rounded-xl bg-white/5 mt-auto" />
            </div>
          ))}
        </div>
      ) : filteredPlatillos.length === 0 ? (
        <motion.div
          className="py-24 text-center rounded-[3rem] bg-apple-bg-secondary/50 dark:bg-apple-dark-bg-secondary/50 border-2 border-dashed border-apple-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-20 h-20 bg-apple-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={32} className="text-apple-text-tertiary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No se encontraron platillos</h2>
          <p className="text-apple-text-secondary mb-8 font-medium">Prueba con otro término o agrega uno nuevo.</p>
          <Link
            to="/dashboard/platillos/nuevo"
            className="text-apple-blue font-bold text-lg hover:underline"
          >
            Agregar platillo ahora →
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode='popLayout'>
            {filteredPlatillos.map((platillo, i) => (
              <motion.div
                key={platillo.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className={`group flex flex-col overflow-hidden rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm transition-all duration-500 hover:shadow-apple-xl hover:border-apple-blue/30 ${!platillo.activo ? 'opacity-75 grayscale-[0.5]' : ''}`}
              >
                <div className="relative h-64 overflow-hidden bg-apple-bg-tertiary">
                  {platillo.url_imagen ? (
                    <img
                      src={platillo.url_imagen}
                      alt={platillo.nombre}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-apple-text-tertiary bg-apple-bg-tertiary">
                      <Utensils size={64} />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => navigate(`/dashboard/platillos/editar/${platillo.id}`)}
                      className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md text-white border border-white/20 hover:bg-apple-blue transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleEliminar(platillo.id)}
                      disabled={deletingId === platillo.id}
                      className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md text-white border border-white/20 hover:bg-red-500 transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <span className="px-3 py-1.5 rounded-lg bg-apple-blue text-white text-[12px] font-bold tracking-wider uppercase shadow-apple-glow">
                      {platillo.categoria || 'General'}
                    </span>
                  </div>
                </div>

                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <h3 className="text-2xl font-bold tracking-tight group-hover:text-apple-blue transition-colors">{platillo.nombre}</h3>
                    <div className="flex flex-col items-end">
                      {platillo.precio_original && Number(platillo.precio_original) > Number(platillo.precio) && (
                        <span className="text-xs font-semibold text-apple-text-tertiary line-through">
                          {Number(platillo.precio_original).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-black text-apple-blue whitespace-nowrap">
                          {Number(platillo.precio).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </span>
                        {platillo.precio_original && Number(platillo.precio_original) > Number(platillo.precio) && (
                          <span className="px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-wider">
                            -{Math.round((1 - Number(platillo.precio) / Number(platillo.precio_original)) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary font-medium leading-relaxed mb-8 flex-1 line-clamp-3">
                    {platillo.descripcion || 'Sin descripción disponible.'}
                  </p>

                  <div className="flex items-center justify-between pt-6 border-t border-apple-border dark:border-apple-dark-border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${platillo.activo !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-[13px] font-bold uppercase tracking-wider text-apple-text-tertiary">
                        {platillo.activo !== false ? 'Disponible' : 'Pausado'}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleToggleStatus(platillo)}
                      className={`flex items-center gap-2 font-bold text-sm transition-colors ${platillo.activo !== false ? 'text-apple-text-secondary hover:text-red-500' : 'text-apple-blue hover:text-apple-blue-hover'}`}
                    >
                      {platillo.activo !== false ? <EyeOff size={16} /> : <Eye size={16} />}
                      {platillo.activo !== false ? 'Pausar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}