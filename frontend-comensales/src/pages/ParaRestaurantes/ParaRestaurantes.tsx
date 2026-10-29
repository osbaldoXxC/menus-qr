import { useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../components/Logo';

const fadeUp = (i = 0) => ({
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const } },
});

const beneficios = [
  { icon: '📊', titulo: 'Control en tiempo real', desc: 'Actualiza precios, fotos y disponibilidad desde tu celular en segundos, sin técnicos.' },
  { icon: '🤖', titulo: 'IA que vende por ti', desc: 'Tu menú aparece recomendado a los comensales ideales automáticamente.' },
  { icon: '📱', titulo: 'QR sin contacto', desc: 'Un código por mesa. Tus clientes ven el menú digital en su propio teléfono.' },
  { icon: '📈', titulo: 'Datos que importan', desc: 'Descubre tus platillos más vistos, horas pico y qué hace volver a tus clientes.' },
  { icon: '💰', titulo: 'Sin comisiones', desc: 'Paga solo tu suscripción fija. Sin sorpresas, sin porcentaje por pedido.' },
  { icon: '💬', titulo: 'Soporte real 24/7', desc: 'Un equipo humano listo para ayudarte cuando más lo necesitas.' },
];

const stats = [
  { valor: '+40%', label: 'más visitas al menú' },
  { valor: '500+', label: 'restaurantes activos' },
  { valor: '0%', label: 'comisión por venta' },
  { valor: '4.9⭐', label: 'calificación promedio' },
];

const fadeUpVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function ParaRestaurantes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const navItems = [
    { label: 'Precios', to: '/precios' },
    { label: 'Comensales', to: '/' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] font-sans overflow-x-hidden transition-colors duration-500">

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl bg-white/80 dark:bg-black/80 transition-colors duration-300">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex items-center justify-between h-[60px]">
          <Link to="/para-restaurantes" className="flex items-center gap-2 group select-none">
            <Logo size={22} className="group-hover:rotate-12 transition-transform duration-300" />
            <span className="text-[15px] font-semibold tracking-tight">MexxicanMX</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-[#0071E3]/10 dark:bg-[#2997FF]/15 text-[#0071E3] dark:text-[#2997FF] rounded-full uppercase tracking-wide">Negocios</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors duration-200 ${location.pathname === item.to ? 'text-[#0071E3] dark:text-[#2997FF]' : 'text-[#86868B] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'}`}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-[#F5F5F7] rounded-lg transition-colors" aria-label="Tema">
              {isDark ? '☀️' : '🌙'}
            </button>
            <Link to="/login" className="hidden sm:block px-4 py-2 text-[13px] font-medium text-[#86868B] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors">
              Iniciar sesión
            </Link>
            <button
              onClick={() => navigate('/register')}
              className="px-5 py-2 text-[13px] font-semibold bg-[#0071E3] dark:bg-[#2997FF] text-white rounded-full hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,113,227,0.3)]"
            >
              Empezar gratis
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background aurora */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-[-20%] right-[-5%] w-[55%] h-[65%] rounded-full bg-[#0071E3]/[0.08] dark:bg-[#2997FF]/[0.08] blur-[140px]"
            animate={{ x: [0, -60, 0], y: [0, 40, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[55%] rounded-full bg-[#FF6B35]/[0.07] dark:bg-[#FF6B35]/[0.07] blur-[120px]"
            animate={{ x: [0, 70, 0], y: [0, -40, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <motion.div
          className="relative z-10 max-w-[900px] mx-auto px-6 text-center"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={fadeUp(0)} className="inline-flex items-center gap-2.5 mb-8 px-5 py-2 rounded-full border border-black/[0.08] dark:border-white/[0.10] bg-black/[0.03] dark:bg-white/[0.05] backdrop-blur-xl">
            <span className="w-2 h-2 rounded-full bg-[#0071E3] dark:bg-[#2997FF] animate-pulse" />
            <span className="text-[12px] font-semibold tracking-widest uppercase text-[#86868B] dark:text-[#A1A1A6]">Plataforma para Restaurantes</span>
          </motion.div>

          <motion.h1 variants={fadeUp(1)} className="text-[3.5rem] sm:text-[5rem] md:text-[6.5rem] font-black leading-[0.9] tracking-tighter mb-8">
            Llega a más<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0071E3] via-[#2997FF] to-[#40A9FF]">
              comensales
            </span>
            <br />cada día.
          </motion.h1>

          <motion.p variants={fadeUp(2)} className="text-lg md:text-xl text-[#86868B] dark:text-[#A1A1A6] font-light max-w-[580px] mx-auto mb-12 leading-relaxed">
            La plataforma que conecta tu restaurante con los clientes ideales mediante IA. Sin comisiones. Sin complicaciones.
          </motion.p>

          <motion.div variants={fadeUp(3)} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => navigate('/register')}
              className="px-10 py-4 bg-[#0071E3] dark:bg-[#2997FF] text-white text-[1rem] font-bold rounded-full transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] shadow-[0_20px_40px_rgba(0,113,227,0.25)] hover:shadow-[0_20px_50px_rgba(0,113,227,0.4)]"
            >
              🚀 Registrar mi Restaurante
            </button>
            <Link
              to="/como-funciona"
              className="px-10 py-4 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] text-[1rem] font-semibold rounded-full hover:bg-black/[0.07] dark:hover:bg-white/[0.10] transition-all duration-200 backdrop-blur-xl"
            >
              Ver cómo funciona
            </Link>
          </motion.div>

          <motion.p variants={fadeUp(4)} className="mt-8 text-[12px] text-[#AEAEB2] dark:text-[#6E6E73]">
            Sin tarjeta de crédito · Listo en 5 minutos
          </motion.p>
        </motion.div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────────── */}
      <section className="py-16 border-y border-black/[0.06] dark:border-white/[0.06] bg-[#F5F5F7] dark:bg-[#0A0A0A]">
        <div className="max-w-[1000px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-[2rem] md:text-[2.5rem] font-black text-[#0071E3] dark:text-[#2997FF] tracking-tighter mb-1">{stat.valor}</div>
              <div className="text-[13px] text-[#86868B] dark:text-[#A1A1A6] font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── STORYTELLING ──────────────────────────────────────────────────────── */}
      <section className="py-28 md:py-36 px-6">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0071E3] dark:text-[#2997FF] mb-4">Lo que cambia</p>
            <h2 className="text-[2.5rem] md:text-[3.5rem] font-bold tracking-tight leading-tight">
              No vendemos software.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0071E3] to-[#40A9FF]">Vendemos resultados.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Antes */}
            <motion.div
              className="p-8 rounded-[1.75rem] bg-[#F5F5F7] dark:bg-[#161617] border border-black/[0.05] dark:border-white/[0.06]"
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#AEAEB2] dark:text-[#6E6E73] mb-6">Antes</p>
              <ul className="space-y-4">
                {['Menú en papel desactualizado', 'Clientes que no te conocen', 'Sin datos de qué platillos venden', 'Llamadas para tomar pedidos'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[15px] text-[#86868B] dark:text-[#A1A1A6]">
                    <span className="text-[#AEAEB2] dark:text-[#6E6E73] text-lg">✕</span> {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Después */}
            <motion.div
              className="p-8 rounded-[1.75rem] bg-[#0071E3]/[0.05] dark:bg-[#2997FF]/[0.07] border border-[#0071E3]/20 dark:border-[#2997FF]/20"
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0071E3] dark:text-[#2997FF] mb-6">Con MexxicanMX</p>
              <ul className="space-y-4">
                {['Menú digital siempre actualizado', 'La IA te lleva nuevos clientes', 'Analytics de tus platillos estrella', 'QR en la mesa, sin fricción'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[15px] font-medium">
                    <span className="text-[#0071E3] dark:text-[#2997FF] text-lg">✓</span> {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── BENEFICIOS ────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-[#F5F5F7] dark:bg-[#0A0A0A]">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0071E3] dark:text-[#2997FF] mb-4">Todo incluido</p>
            <h2 className="text-[2.5rem] md:text-[3.5rem] font-bold tracking-tight">Todo lo que necesitas.</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {beneficios.map((b, i) => (
              <motion.div
                key={b.titulo}
                className="p-7 rounded-[1.5rem] bg-white dark:bg-[#161617] border border-black/[0.05] dark:border-white/[0.06] hover:border-[#0071E3]/25 dark:hover:border-[#2997FF]/25 transition-all duration-400 group"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
              >
                <div className="text-4xl mb-5 group-hover:scale-110 transition-transform duration-300">{b.icon}</div>
                <h3 className="text-[16px] font-bold mb-2 tracking-tight">{b.titulo}</h3>
                <p className="text-[13px] text-[#86868B] dark:text-[#A1A1A6] leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#0071E3]/[0.05] via-transparent to-[#2997FF]/[0.05] dark:from-[#2997FF]/[0.08] dark:to-[#0071E3]/[0.05]" />
        <motion.div
          className="relative z-10 max-w-[680px] mx-auto text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[2.5rem] md:text-[4rem] font-black tracking-tighter leading-tight mb-6">
            Empieza hoy.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0071E3] via-[#2997FF] to-[#40A9FF]">Es gratis.</span>
          </h2>
          <p className="text-[#86868B] dark:text-[#A1A1A6] text-lg mb-10 leading-relaxed">
            Configura tu menú digital en 5 minutos. Sin conocimientos técnicos. Sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-10 py-4 bg-[#0071E3] dark:bg-[#2997FF] text-white font-bold rounded-full hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] transition-all duration-300 hover:scale-[1.03] shadow-[0_20px_40px_rgba(0,113,227,0.25)]"
            >
              🚀 Registrar mi Restaurante
            </button>
            <Link
              to="/precios"
              className="px-10 py-4 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] font-semibold rounded-full hover:bg-black/[0.07] dark:hover:bg-white/[0.10] transition-all duration-200 text-center"
            >
              Ver precios →
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] py-8 px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span className="text-[14px] font-semibold">MexxicanMX</span>
            <span className="text-[12px] text-[#AEAEB2] dark:text-[#6E6E73] ml-2">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-[12px] text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white transition-colors">Para Comensales</Link>
            <Link to="/como-funciona" className="text-[12px] text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white transition-colors">Cómo funciona</Link>
            <Link to="/precios" className="text-[12px] text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white transition-colors">Precios</Link>
          </div>
          <p className="text-[12px] text-[#AEAEB2] dark:text-[#6E6E73] font-medium">Hecho con 🌶️ en México</p>
        </div>
      </footer>
    </div>
  );
}
