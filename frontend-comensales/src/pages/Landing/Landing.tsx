import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';

const fadeUpVariant = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

const features = [
  { icon: '🤖', title: 'IA que te conoce', desc: 'Aprende de tus gustos y recomienda platillos que realmente quieres probar.' },
  { icon: '📱', title: 'Experiencia inmersiva', desc: 'Formato vertical tipo TikTok. Un platillo a la vez, sin distracciones.' },
  { icon: '⚡', title: 'QR instantáneo', desc: 'Menús digitales que cargan en milisegundos. Sin apps, sin fricción.' },
  { icon: '🔒', title: 'Privacidad total', desc: 'Tus datos protegidos. Sin anuncios, sin trackers invasivos.' },
];

const stats = [
  { value: '10K+', label: 'Comensales activos' },
  { value: '500+', label: 'Restaurantes' },
  { value: '50K+', label: 'Platillos recomendados' },
  { value: '98%', label: 'Satisfacción' },
];

export function Landing() {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const opacityHero = useTransform(scrollY, [0, 400], [1, 0]);
  const scaleHero = useTransform(scrollY, [0, 400], [1, 0.95]);

  return (
    <div className="text-apple-text dark:text-apple-dark-text min-h-screen font-sans selection:bg-apple-blue/20">

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden py-20">
        <motion.div 
          style={{ opacity: opacityHero, scale: scaleHero }} 
          className="relative z-10 max-w-[1200px] mx-auto px-6 text-center"
        >
          <motion.div
            className="inline-flex items-center gap-3 mb-8 px-5 py-2.5 rounded-full border border-apple-border dark:border-apple-dark-border bg-apple-bg-secondary/50 dark:bg-apple-dark-bg-secondary/50 backdrop-blur-xl shadow-apple-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-apple-blue animate-pulse shadow-apple-glow" />
            <span className="text-sm font-medium tracking-wide">Plataforma para Restaurantes V3</span>
          </motion.div>

          <motion.h1
            className="text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] font-bold leading-[1.05] tracking-tight mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Tu menú digital <br/>
            <span className="text-apple-blue dark:text-apple-blue-hover">
              inteligente y veloz
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-apple-text-secondary dark:text-apple-dark-text-secondary leading-relaxed max-w-[650px] mx-auto mb-12 font-medium"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Crea el menú digital más rápido y elegante para tu restaurante. Genera QRs, gestiona platillos y deja que nuestra IA los recomiende.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-apple-blue text-white text-[1.05rem] font-bold rounded-2xl shadow-apple-md hover:bg-apple-blue-hover transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              🚀 Registrar mi Restaurante
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary text-apple-text dark:text-apple-dark-text border border-apple-border dark:border-apple-dark-border text-[1.05rem] font-semibold rounded-2xl hover:bg-apple-bg-tertiary transition-all duration-300"
            >
              🔑 Acceso Negocios
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── BENEFICIOS ──────────────────────────────────────── */}
      <section className="relative py-32 border-t border-apple-border dark:border-apple-dark-border bg-apple-bg-secondary/30 dark:bg-apple-dark-bg-secondary/30 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            className="text-center mb-24"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUpVariant}
            custom={0}
          >
            <h2 className="text-[2.5rem] md:text-[4rem] font-bold tracking-tight mb-4">
              Más que un simple QR.
            </h2>
            <p className="text-xl text-apple-text-secondary font-medium">Una herramienta de ventas diseñada para la era moderna.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '⚡', title: 'Velocidad Apple', desc: 'Interfaz fluida y carga instantánea. Sin esperas para tus clientes.' },
              { icon: '🪄', title: 'IA Recomendadora', desc: 'Tus platillos aparecen en el Feed Inteligente de miles de usuarios.' },
              { icon: '📊', title: 'Control Total', desc: 'Gestiona precios, fotos y disponibilidad en tiempo real desde tu móvil.' }
            ].map((step, i) => (
              <motion.div
                key={step.title}
                className="group relative p-10 rounded-[2.5rem] bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border hover:border-apple-blue transition-all duration-500 shadow-apple hover:shadow-apple-lg"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={fadeUpVariant}
                custom={i + 1}
              >
                <div className="text-5xl mb-8 transform group-hover:scale-110 transition-transform duration-500">{step.icon}</div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{step.title}</h3>
                <p className="text-apple-text-secondary text-lg leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}