import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { restauranteService } from '../../services/restaurante';

export function NuevoPlatillo() {
  const navigate = useNavigate();
  const { id } = useParams(); // ID para edición
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState('');
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    precio_original: '',
    categoria: '',
    porcion: '',
    nivel_picante: 0,
    etiquetas_dieteticas: [] as string[],
    ingredientes_principales: [''],
    complementos: [''],
  });

  useEffect(() => {
    const init = async () => {
      try {
        // Cargar categorías
        const cats = await restauranteService.getCategorias();
        if (Array.isArray(cats)) setCategorias(cats);

        // Si es edición, cargar datos del platillo
        if (isEdit) {
          const platillos = await restauranteService.getPlatillos();
          const platillo = platillos.find((p: any) => p.id === id);
          
          if (platillo) {
            setFormData({
              nombre: platillo.nombre || '',
              descripcion: platillo.descripcion || '',
              precio: platillo.precio ? platillo.precio.toString() : '',
              precio_original: platillo.precio_original ? platillo.precio_original.toString() : '',
              categoria: platillo.categoria || platillo.categoria_nombre || '',
              porcion: platillo.porcion || '',
              nivel_picante: Number(platillo.nivel_picante) || 0,
              etiquetas_dieteticas: Array.isArray(platillo.etiquetas_dieteticas) ? platillo.etiquetas_dieteticas : [],
              ingredientes_principales: Array.isArray(platillo.ingredientes_principales) && platillo.ingredientes_principales.length > 0 
                ? platillo.ingredientes_principales 
                : [''],
              complementos: Array.isArray(platillo.complementos) && platillo.complementos.length > 0 
                ? platillo.complementos 
                : [''],
            });
            if (platillo.url_imagen) setImagenPreview(platillo.url_imagen);
          } else {
            setError('No se encontró el platillo para editar.');
          }
        }
      } catch (err) {
        console.error('Error al inicializar:', err);
      } finally {
        setFetching(false);
      }
    };
    init();
  }, [id, isEdit]);

  // ── Drag & drop zone ──────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setImagenFile(file);
    const preview = URL.createObjectURL(file);
    setImagenPreview(preview);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
  });

  const addIngrediente = () => {
    setFormData({ ...formData, ingredientes_principales: [...formData.ingredientes_principales, ''] });
  };

  const removeIngrediente = (index: number) => {
    const nuevos = formData.ingredientes_principales.filter((_, i) => i !== index);
    setFormData({ ...formData, ingredientes_principales: nuevos.length ? nuevos : [''] });
  };

  const updateIngrediente = (index: number, value: string) => {
    const nuevos = [...formData.ingredientes_principales];
    nuevos[index] = value;
    setFormData({ ...formData, ingredientes_principales: nuevos });
  };

  const addComplemento = () => {
    setFormData({ ...formData, complementos: [...formData.complementos, ''] });
  };

  const removeComplemento = (index: number) => {
    const nuevos = formData.complementos.filter((_, i) => i !== index);
    setFormData({ ...formData, complementos: nuevos.length ? nuevos : [''] });
  };

  const updateComplemento = (index: number, value: string) => {
    const nuevos = [...formData.complementos];
    nuevos[index] = value;
    setFormData({ ...formData, complementos: nuevos });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();
      submitData.append('nombre', formData.nombre);
      submitData.append('descripcion', formData.descripcion);
      submitData.append('precio', formData.precio);
      submitData.append('precio_original', formData.precio_original);
      submitData.append('categoria', formData.categoria);
      submitData.append('porcion', formData.porcion);
      submitData.append('nivel_picante', formData.nivel_picante.toString());
      submitData.append('etiquetas_dieteticas', JSON.stringify(formData.etiquetas_dieteticas));
      submitData.append('ingredientes_principales', JSON.stringify(formData.ingredientes_principales.filter(i => i.trim())));
      submitData.append('complementos', JSON.stringify(formData.complementos.filter(c => c.trim())));

      if (imagenFile) {
        submitData.append('imagen', imagenFile);
      }

      if (isEdit && id) {
        await restauranteService.actualizarPlatillo(id, submitData);
      } else {
        await restauranteService.crearPlatillo(submitData);
      }

      navigate('/dashboard/platillos');
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.response?.data?.mensaje || `Error al ${isEdit ? 'actualizar' : 'crear'} el platillo`);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-14 h-14 p-2 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_25px_rgba(210,35,35,0.3)] animate-pulse flex items-center justify-center">
          <img src="/favicon.svg" alt="MexxicanMX" className="w-10 h-10 object-contain" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent text-apple-text dark:text-apple-dark-text min-h-[calc(100vh-64px)]">
      <div className="pt-10 pb-20 px-4 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">{isEdit ? 'Editar platillo' : 'Nuevo platillo'}</h1>
          <p className="text-apple-text-secondary dark:text-apple-dark-text-secondary text-base">
            {isEdit ? 'Actualiza los detalles de tu platillo' : 'Agrega un platillo a tu menú digital'}
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <motion.div
              className="p-4 rounded-apple-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[14px] text-center font-medium"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {error}
            </motion.div>
          )}

          {/* Drag & Drop de imagen */}
          <div>
            <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">
              Imagen del platillo
            </label>

            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-[2rem] p-6 transition-all cursor-pointer text-center ${
                isDragActive
                  ? 'border-apple-blue bg-apple-blue/5'
                  : 'border-apple-border dark:border-apple-dark-border bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary hover:border-apple-blue/30 active:scale-[0.98]'
              }`}
            >
              <input {...getInputProps()} />

              {imagenPreview ? (
                <div className="space-y-4">
                  <motion.img
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    src={imagenPreview}
                    alt="Preview"
                    className="w-full max-h-56 object-cover rounded-[1.5rem] mx-auto shadow-apple-md"
                  />
                  <p className="text-xs font-medium text-apple-text-secondary">
                    Arrastra otra imagen o haz clic para cambiar
                  </p>
                </div>
              ) : (
                <div className="py-8">
                  <motion.div
                    className="text-5xl mb-4"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    🖼️
                  </motion.div>
                  <p className="text-apple-text font-bold mb-1">
                    Arrastra y suelta tu imagen aquí
                  </p>
                  <p className="text-apple-text-secondary text-sm">
                    o haz clic para seleccionar
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">Nombre del platillo</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-5 py-4 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-2xl text-[15px] focus:border-apple-blue/40 focus:ring-4 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200"
              placeholder="Ej: Tacos al Pastor"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows={3}
              className="w-full px-5 py-4 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-2xl text-[15px] focus:border-apple-blue/40 focus:ring-4 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200 resize-none"
              placeholder="Describe el platillo..."
              required
            />
          </div>

          {/* Precios, Oferta, Porción y Categoría */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">
                  Precio de Venta <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-apple-text-secondary font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    className="w-full pl-9 pr-5 py-4 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-2xl text-[15px] focus:border-apple-blue/40 focus:ring-4 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary">
                    Precio Original / Regular <span className="text-xs font-normal text-apple-text-tertiary">(Opcional)</span>
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-apple-text-secondary font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_original}
                    onChange={(e) => setFormData({ ...formData, precio_original: e.target.value })}
                    className="w-full pl-9 pr-5 py-4 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-2xl text-[15px] focus:border-apple-blue/40 focus:ring-4 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200"
                    placeholder="Ej: 180.00 (para mostrar oferta)"
                  />
                </div>
              </div>
            </div>

            {/* Banner de previsualización de oferta en vivo si aplica */}
            {Number(formData.precio_original) > Number(formData.precio) && Number(formData.precio) > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-orange-500/20 flex items-center justify-between text-xs text-orange-600 dark:text-orange-400 font-bold"
              >
                <div className="flex items-center gap-2">
                  <span>🔥 ¡Oferta activada!</span>
                  <span className="font-normal text-apple-text-secondary">Se mostrará el precio regular tachado en el menú:</span>
                  <span className="line-through opacity-75">${formData.precio_original}</span>
                  <span className="text-orange-600 dark:text-orange-400 font-black">${formData.precio}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-orange-500 text-white text-[11px] font-black uppercase tracking-wider">
                  -{Math.round((1 - Number(formData.precio) / Number(formData.precio_original)) * 100)}% OFF
                </span>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">Porción / Cantidad</label>
                <input
                  type="text"
                  value={formData.porcion}
                  onChange={(e) => setFormData({ ...formData, porcion: e.target.value })}
                  className="w-full px-5 py-4 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-2xl text-[15px] focus:border-apple-blue/40 focus:ring-4 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200"
                  placeholder='Ej: "350g", "3 piezas", "1 persona"'
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">Categoría</label>
                <input
                  type="text"
                  list="categorias-existentes"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  className="w-full px-5 py-4 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-2xl text-[15px] focus:border-apple-blue/40 focus:ring-4 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200"
                  placeholder="Escribe o selecciona..."
                  required
                />
                <datalist id="categorias-existentes">
                  {categorias.map((cat, i) => (
                    <option key={i} value={cat.nombre} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Nivel de Picante */}
          <div>
            <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">Nivel de Picante</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { val: 0, label: 'Sin picante', icon: '🍃' },
                { val: 1, label: 'Suave', icon: '🌶️' },
                { val: 2, label: 'Medio', icon: '🌶️🌶️' },
                { val: 3, label: 'Muy picoso', icon: '🌶️🌶️🌶️' },
                { val: 4, label: 'Extremo', icon: '🌶️🌶️🌶️🌶️' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setFormData({ ...formData, nivel_picante: item.val })}
                  className={`p-3.5 rounded-2xl border text-center transition-all text-xs font-bold flex flex-col items-center gap-1.5 ${
                    formData.nivel_picante === item.val
                      ? 'border-apple-blue bg-apple-blue/10 text-apple-blue dark:border-apple-blue dark:bg-apple-blue/20'
                      : 'border-apple-border dark:border-apple-dark-border bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary text-apple-text-secondary hover:border-apple-blue/50'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Etiquetas Dietéticas */}
          <div>
            <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-2">Etiquetas Dietéticas</label>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'sin_gluten', label: 'Sin Gluten', icon: '🌾' },
                { id: 'vegano', label: 'Vegano', icon: '🌱' },
                { id: 'vegetariano', label: 'Vegetariano', icon: '🥗' },
                { id: 'sin_lactosa', label: 'Sin Lactosa', icon: '🥛' },
                { id: 'keto', label: 'Keto', icon: '🥑' },
              ].map((tag) => {
                const active = formData.etiquetas_dieteticas.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? formData.etiquetas_dieteticas.filter((t) => t !== tag.id)
                        : [...formData.etiquetas_dieteticas, tag.id];
                      setFormData({ ...formData, etiquetas_dieteticas: next });
                    }}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-apple-border dark:border-apple-dark-border bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary text-apple-text-secondary hover:border-emerald-500/50'
                    }`}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ingredientes Principales */}
          <div className="pt-4">
            <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">Ingredientes principales</label>
            <div className="space-y-3">
              {formData.ingredientes_principales.map((ing, index) => (
                <div key={index} className="flex gap-3">
                  <input
                    type="text"
                    value={ing}
                    onChange={(e) => updateIngrediente(index, e.target.value)}
                    className="flex-1 px-5 py-3.5 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-xl text-[15px] focus:border-apple-blue/40 focus:ring-2 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200"
                    placeholder={`Ingrediente ${index + 1}`}
                  />
                  {formData.ingredientes_principales.length > 1 && (
                    <button type="button" onClick={() => removeIngrediente(index)} className="px-4 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold">✖</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addIngrediente} className="mt-4 text-sm font-bold text-apple-blue hover:text-apple-blue-hover transition-colors inline-flex items-center gap-1">
              + Agregar ingrediente
            </button>
          </div>

          {/* Complementos */}
          <div className="pt-4">
            <label className="block text-sm font-bold text-apple-text-secondary dark:text-apple-dark-text-secondary mb-3">Complementos</label>
            <div className="space-y-3">
              {formData.complementos.map((comp, index) => (
                <div key={index} className="flex gap-3">
                  <input
                    type="text"
                    value={comp}
                    onChange={(e) => updateComplemento(index, e.target.value)}
                    className="flex-1 px-5 py-3.5 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border rounded-xl text-[15px] focus:border-apple-blue/40 focus:ring-2 focus:ring-apple-blue/10 focus:outline-none transition-all duration-200"
                    placeholder={`Complemento ${index + 1}`}
                  />
                  {formData.complementos.length > 1 && (
                    <button type="button" onClick={() => removeComplemento(index)} className="px-4 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold">✖</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addComplemento} className="mt-4 text-sm font-bold text-apple-blue hover:text-apple-blue-hover transition-colors inline-flex items-center gap-1">
              + Agregar complemento
            </button>
          </div>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-apple-border dark:border-apple-dark-border">
            <button
              type="button"
              onClick={() => navigate('/dashboard/platillos')}
              className="flex-1 py-4 rounded-full border-2 border-apple-border dark:border-apple-dark-border font-bold text-apple-text-secondary hover:border-apple-text-secondary hover:text-apple-text transition-all duration-200"
            >
              Cancelar
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="flex-1 py-4 bg-apple-blue text-white rounded-full font-bold hover:bg-apple-blue-hover transition-all duration-200 shadow-apple-md hover:shadow-apple-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : (isEdit ? 'Actualizar platillo' : 'Guardar platillo')}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}