import { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../components/Logo';
import { ThemeContext } from '../../context/ThemeContext';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

const platillos = [
  { emoji: '🌮', nombre: 'Tacos al Pastor', lugar: 'El Tizoncito', precio: '$65' },
  { emoji: '🫔', nombre: 'Burrito XL', lugar: 'La Taquería Norte', precio: '$89' },
  { emoji: '🥘', nombre: 'Pozole Rojo', lugar: 'Casa Guerrero', precio: '$120' },
  { emoji: '🍖', nombre: 'Birria de Res', lugar: 'Birrería Central', precio: '$95' },
];

const pasos = [
  { num: '01', titulo: 'Dinos tu antojo', desc: 'Cuéntale a nuestra IA qué buscas hoy: picosito, reconfortante, rápido, caldoso o dulce.' },
  { num: '02', titulo: 'La IA analiza tus gustos', desc: 'Cruzamos miles de platillos con tu perfil de sabor y preferencias de comida al instante.' },
  { num: '03', titulo: 'Encuentra tu platillo', desc: 'Consulta el platillo, fotos reales, ingredientes y el restaurante donde pedirlo.' },
];

export function NoSabesQueComer() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] font-sans overflow-x-hidden transition-colors duration-500">

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl bg-white/80 dark:bg-black/80 transition-colors duration-300">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex items-center justify-between h-[60px]">
          <Link to="/" className="flex items-center gap-2 group select-none">
            <Logo size={22} className="group-hover:rotate-12 transition-transform duration-300" />
            <span className="text-[15px] font-semibold tracking-tight">MexxicanMX</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-[#FF4A00]/10 dark:bg-[#FF4A00]/20 text-[#FF4A00] rounded-full uppercase tracking-wide">Comensales</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/descubrir" className="px-4 py-2 text-[13px] font-medium text-[#86868B] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] rounded-lg transition-colors duration-200">
              Descubrir Platillos
            </Link>
            <Link to="/cuestionario" className="px-4 py-2 text-[13px] font-medium text-[#86868B] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] rounded-lg transition-colors duration-200">
              Cuestionario IA
            </Link>
            <Link to="/escanear" className="px-4 py-2 text-[13px] font-medium text-[#86868B] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] rounded-lg transition-colors duration-200">
              Escanear Menú QR
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-[#F5F5F7] rounded-lg transition-colors" aria-label="Tema">
              {isDark ? '☀️' : '🌙'}
            </button>
            <button 
              onClick={() => navigate('/cuestionario')}
              className="px-5 py-2 text-[13px] font-semibold bg-[#FF4A00] text-white rounded-full hover:bg-[#FF5722] transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,74,0,0.3)]"
            >
              ¿Qué comer hoy?
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Animated background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-[#FF2A54]/10 dark:bg-[#FF2A54]/[0.07] blur-[130px]"
            animate={{ x: [0, 80, 0], y: [0, 40, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#FF8C00]/10 dark:bg-[#FF8C00]/[0.07] blur-[150px]"
            animate={{ x: [0, -60, 0], y: [0, -50, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-[40%] left-[45%] w-[30%] h-[30%] rounded-full bg-[#FF4A00]/[0.06] dark:bg-[#FF4A00]/[0.05] blur-[100px]"
            animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Floating food elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {['🌮', '🥑', '🌶️', '🫔', '🍋'].map((emoji, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl md:text-4xl opacity-20 dark:opacity-10 select-none"
              style={{
                left: `${[8, 85, 15, 78, 50][i]}%`,
                top: `${[20, 15, 65, 60, 80][i]}%`,
              }}
              animate={{ y: [0, -15, 0], rotate: [0, 8, 0] }}
              transition={{ duration: 5 + i * 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
            >
              {emoji}
            </motion.div>
          ))}
        </div>

        <motion.div
          className="relative z-10 max-w-[900px] mx-auto px-6 text-center"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2.5 mb-8 px-5 py-2 rounded-full border border-black/[0.08] dark:border-white/[0.10] bg-black/[0.03] dark:bg-white/[0.05] backdrop-blur-xl"
          >
            <span className="w-2 h-2 rounded-full bg-[#FF4A00] animate-pulse" />
            <span className="text-[12px] font-semibold tracking-widest uppercase text-[#86868B] dark:text-[#A1A1A6]">IA Gastronómica · México</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-[4rem] sm:text-[5.5rem] md:text-[7.5rem] font-black leading-[0.88] tracking-tighter mb-8"
          >
            Tu próximo<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00]">
              gran antojo
            </span>
            <br />está aquí.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-[#86868B] dark:text-[#A1A1A6] font-light max-w-[600px] mx-auto mb-12 leading-relaxed"
          >
            Dinos qué se te antoja y nuestra IA cruzará sabores, texturas e ingredientes de los mejores platillos locales para darte la recomendación perfecta.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => navigate('/cuestionario')}
              className="px-10 py-4 bg-[#FF4A00] text-white text-[1rem] font-bold rounded-full transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:bg-[#FF5722] shadow-[0_20px_40px_rgba(255,74,0,0.2)] hover:shadow-[0_20px_50px_rgba(255,74,0,0.35)]"
            >
              🌮 Empezar a Descubrir
            </button>
            <button
              onClick={() => navigate('/descubrir')}
              className="px-10 py-4 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] text-[#1D1D1F] dark:text-[#F5F5F7] text-[1rem] font-semibold rounded-full transition-all duration-300 hover:bg-black/[0.07] dark:hover:bg-white/[0.10] backdrop-blur-xl"
            >
              Ver Feed de Platillos
            </button>
          </motion.div>

          <motion.p variants={fadeIn} className="mt-8 text-[12px] text-[#AEAEB2] dark:text-[#6E6E73] font-medium tracking-wide">
            Cientos de platillos disponibles y actualizados en tiempo real
          </motion.p>
        </motion.div>
      </section>

      {/* ── CÓMO FUNCIONA ─────────────────────────────────────────────────────── */}
      <section className="py-28 md:py-36 px-6 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#FF4A00] mb-4">Cómo funciona</p>
            <h2 className="text-[2.5rem] md:text-[3.5rem] font-bold tracking-tight leading-tight">
              De tu antojo al plato<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] to-[#FF8C00]">en 30 segundos.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {pasos.map((paso, i) => (
              <motion.div
                key={paso.num}
                className="relative p-8 rounded-[1.75rem] bg-[#F5F5F7] dark:bg-[#161617] border border-black/[0.05] dark:border-white/[0.06] hover:border-[#FF4A00]/30 transition-all duration-500 group"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
              >
                <div className="text-[3rem] font-black text-[#FF4A00]/20 dark:text-[#FF4A00]/15 leading-none mb-5 group-hover:text-[#FF4A00]/35 transition-colors duration-300">
                  {paso.num}
                </div>
                <h3 className="text-[1.1rem] font-bold mb-3 tracking-tight">{paso.titulo}</h3>
                <p className="text-[14px] text-[#86868B] dark:text-[#A1A1A6] leading-relaxed">{paso.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEED PREVIEW ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-[#F5F5F7] dark:bg-[#0A0A0A]">
        <div className="max-w-[1100px] mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#FF4A00] mb-4">Feed inteligente</p>
            <h2 className="text-[2.5rem] md:text-[3.5rem] font-bold tracking-tight">
              Platillos que ya están<br />esperándote.
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platillos.map((p, i) => (
              <motion.div
                key={p.nombre}
                className="rounded-[1.5rem] bg-white dark:bg-[#161617] border border-black/[0.06] dark:border-white/[0.06] overflow-hidden hover:shadow-xl dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] hover:border-[#FF4A00]/20 transition-all duration-400 group cursor-pointer"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6 }}
                onClick={() => navigate('/descubrir')}
              >
                <div className="h-36 bg-gradient-to-br from-[#FF4A00]/10 via-[#FF8C00]/10 to-[#FF2A54]/10 dark:from-[#FF4A00]/[0.08] dark:via-[#FF8C00]/[0.06] dark:to-[#FF2A54]/[0.08] flex items-center justify-center">
                  <span className="text-6xl group-hover:scale-110 transition-transform duration-300">{p.emoji}</span>
                </div>
                <div className="p-5">
                  <h4 className="font-bold text-[15px] tracking-tight mb-1">{p.nombre}</h4>
                  <p className="text-[12px] text-[#86868B] dark:text-[#A1A1A6] mb-3">{p.lugar}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-bold text-[#FF4A00]">{p.precio}</span>
                    <span className="text-[11px] text-[#AEAEB2] dark:text-[#6E6E73] font-medium">Ver platillo →</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={() => navigate('/descubrir')}
              className="px-8 py-3.5 border border-black/[0.10] dark:border-white/[0.10] text-[14px] font-semibold rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-all duration-200"
            >
              Ver todos los platillos →
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF2A54]/[0.06] via-transparent to-[#FF8C00]/[0.06] dark:from-[#FF2A54]/[0.08] dark:to-[#FF8C00]/[0.08]" />
        </div>
        <motion.div
          className="relative z-10 max-w-[700px] mx-auto text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[2.5rem] md:text-[4rem] font-black tracking-tighter leading-tight mb-6">
            ¿Listo para tu<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00]">próximo antojo?</span>
          </h2>
          <p className="text-[#86868B] dark:text-[#A1A1A6] text-lg mb-10 leading-relaxed">
            Únete a miles de personas que encuentran sus platillos y sabores favoritos sin complicaciones.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/cuestionario')}
              className="px-10 py-4 bg-[#FF4A00] text-white font-bold rounded-full hover:bg-[#FF5722] transition-all duration-300 hover:scale-[1.03] shadow-[0_20px_40px_rgba(255,74,0,0.25)]"
            >
              🌮 Descubrir con IA
            </button>
            <button
              onClick={() => navigate('/escanear')}
              className="px-10 py-4 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] font-semibold rounded-full hover:bg-black/[0.07] dark:hover:bg-white/[0.10] transition-all duration-200 text-center"
            >
              📷 Escanear Menú QR
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER MINIMAL COMENSALES ────────────────────────────────────────── */}
      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] py-8 px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <span className="text-[14px] font-semibold">MexxicanMX</span>
            <span className="text-[12px] text-[#AEAEB2] dark:text-[#6E6E73] ml-2">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/descubrir" className="text-[12px] text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white transition-colors">Descubrir Platillos</Link>
            <Link to="/cuestionario" className="text-[12px] text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white transition-colors">Cuestionario IA</Link>
            <Link to="/escanear" className="text-[12px] text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white transition-colors">Escanear Menú</Link>
          </div>
          <p className="text-[12px] text-[#AEAEB2] dark:text-[#6E6E73] font-medium">Hecho con 🌶️ en México · Antojos & Gastronomía</p>
        </div>
      </footer>
    </div>
  );
}
