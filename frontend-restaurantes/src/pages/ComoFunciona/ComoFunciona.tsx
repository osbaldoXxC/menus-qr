import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

const fadeUp = (i = 0) => ({
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
});

const pasos = [
  {
    step: '01',
    icon: '🎯',
    title: 'Configura tus gustos',
    desc: 'Cuéntale a la IA qué se te antoja, tus alergias y preferencias. Tarda menos de un minuto.',
    detalle: 'Picante, caldoso, rápido, saludable — en tus propias palabras.',
  },
  {
    step: '02',
    icon: '🤖',
    title: 'La IA analiza',
    desc: 'Cruzamos tu perfil con miles de platillos reales de restaurantes activos en tu ciudad.',
    detalle: 'Sin algoritmos genéricos. Resultados personalizados para ti.',
  },
  {
    step: '03',
    icon: '❤️',
    title: 'Desliza y descubre',
    desc: 'Ve los platillos uno a uno. Dale like a los que te gustan, descarta los que no.',
    detalle: 'Como TikTok, pero para comida. Cada swipe mejora tu siguiente recomendación.',
  },
  {
    step: '04',
    icon: '🍽️',
    title: 'Disfruta tu elección',
    desc: 'Encuentra tu match perfecto, ve el menú del restaurante y ve directamente a ordenar.',
    detalle: 'Sin llamadas. Sin confusión. Solo el platillo que querías.',
  },
];

const beneficios = [
  { icon: '⚡', title: 'Resultados en segundos', desc: 'No más scrollear apps por 20 minutos sin decidirte.' },
  { icon: '🧠', title: 'IA que te conoce', desc: 'Cada interacción mejora tus recomendaciones futuras.' },
  { icon: '📍', title: 'Restaurantes reales', desc: 'Solo lugares activos y verificados en tu ciudad.' },
  { icon: '🔒', title: 'Sin registro obligatorio', desc: 'Descubre platillos sin crear cuenta. Regístrate cuando quieras.' },
];

export function ComoFunciona() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-300">
      <Header />

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-[#FF4A00]/[0.05] dark:bg-[#FF4A00]/[0.07] blur-[120px] pointer-events-none" />
        <motion.div
          initial="hidden" animate="visible" variants={fadeUp(0)}
          className="max-w-[660px] mx-auto relative z-10"
        >
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#FF4A00] mb-4">
            Cómo funciona
          </p>
          <h1 className="text-[3rem] md:text-[4.5rem] font-black tracking-tighter leading-tight mb-5">
            Tu platillo perfecto<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00]">
              en 30 segundos.
            </span>
          </h1>
          <p className="text-[17px] text-[#86868B] dark:text-[#A1A1A6] leading-relaxed">
            Cuatro pasos simples, una experiencia gastronómica impulsada por IA.
          </p>
        </motion.div>
      </section>

      {/* ── PASOS ── */}
      <section className="pb-28 px-6">
        <div className="max-w-[860px] mx-auto space-y-6">
          {pasos.map((item, i) => (
            <motion.div
              key={item.step}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp(i * 0.5)}
              className="flex flex-col sm:flex-row items-start gap-6 p-8 rounded-[1.75rem] bg-[#F5F5F7] dark:bg-[#161617] border border-black/[0.05] dark:border-white/[0.06] hover:border-[#FF4A00]/20 transition-all duration-300"
            >
              <div className="flex-shrink-0 flex items-center gap-4">
                <span className="text-[2.2rem] font-black text-[#FF4A00]/20 dark:text-[#FF4A00]/15 w-10 leading-none">
                  {item.step}
                </span>
                <div className="w-14 h-14 rounded-2xl bg-[#FF4A00]/[0.08] dark:bg-[#FF4A00]/[0.12] flex items-center justify-center text-3xl flex-shrink-0">
                  {item.icon}
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-[1.2rem] font-bold mb-2 tracking-tight">{item.title}</h2>
                <p className="text-[#86868B] dark:text-[#A1A1A6] text-[14px] leading-relaxed mb-3">{item.desc}</p>
                <p className="text-[12px] font-semibold text-[#FF4A00]/70 dark:text-[#FF4A00]/60">{item.detalle}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── BENEFICIOS ── */}
      <section className="py-24 px-6 bg-[#F5F5F7] dark:bg-[#0A0A0A] border-y border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-[860px] mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#FF4A00] mb-3">Por qué MexxicanMX</p>
            <h2 className="text-[2rem] md:text-[2.8rem] font-black tracking-tighter">Sin vueltas. Sin perder tiempo.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-5">
            {beneficios.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex items-start gap-4 p-6 rounded-[1.5rem] bg-white dark:bg-[#161617] border border-black/[0.05] dark:border-white/[0.06]"
              >
                <div className="w-11 h-11 rounded-xl bg-[#FF4A00]/[0.08] dark:bg-[#FF4A00]/[0.12] flex items-center justify-center text-xl flex-shrink-0">
                  {b.icon}
                </div>
                <div>
                  <h3 className="font-bold text-[15px] mb-1">{b.title}</h3>
                  <p className="text-[13px] text-[#86868B] dark:text-[#A1A1A6] leading-relaxed">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6 text-center">
        <motion.div
          className="max-w-[560px] mx-auto"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7 }}
        >
          <h2 className="text-[2.5rem] md:text-[3.5rem] font-black tracking-tighter mb-5">
            ¿Listo para tu<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00]">próximo antojo?</span>
          </h2>
          <p className="text-[#86868B] dark:text-[#A1A1A6] mb-10 text-[16px]">
            Es gratis. Sin registro obligatorio. Empieza en segundos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/cuestionario')}
              className="px-10 py-4 bg-[#FF4A00] text-white font-bold rounded-full hover:bg-[#FF5722] transition-all hover:scale-[1.03] shadow-[0_20px_40px_rgba(255,74,0,0.25)]"
            >
              🌮 Empezar ahora
            </button>
            <button
              onClick={() => navigate('/descubrir')}
              className="px-10 py-4 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] font-semibold rounded-full hover:bg-black/[0.07] dark:hover:bg-white/[0.10] transition-all"
            >
              Ver el feed →
            </button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
