import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

const fadeUp = (i = 0) => ({
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
});

const scaleIn = (i = 0) => ({
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
});

const slideInLeft = (i = 0) => ({
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
});

const slideInRight = (i = 0) => ({
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
});

const planes = [
  {
    nombre: 'Estándar',
    precio: '$100',
    periodo: ' MXN / mes',
    descripcion: 'Pensado para pequeños negocios que únicamente necesitan mostrar su menú digital.',
    features: [
      'Hasta 50 platillos',
      'Imagen para cada platillo',
      'Nombre',
      'Descripción',
      'Precio',
      'Ingredientes',
      'Etiquetas',
      'Posición del platillo',
      'Configuración de categorías',
      'Código QR del menú',
      'Descarga del código QR',
      'Personalización de colores',
      'Selección de tipografía (las disponibles)',
      'Logo del negocio',
      'Horarios',
      'Información del restaurante',
    ],
    notIncluded: [
      'Imagen de fondo personalizada',
      'Banners promocionales',
      'Personalización avanzada del diseño',
    ],
    role: 'restaurante',
    destacado: false,
    cta: 'Elegir Estándar',
    icon: '📋',
  },
  {
    nombre: 'Premium',
    precio: '$150',
    periodo: ' MXN / mes',
    descripcion: 'Diseñado para restaurantes que desean un menú mucho más atractivo y completamente personalizable.',
    features: [
      'Hasta 70 platillos',
      'Imagen de fondo personalizada',
      'Banners promocionales',
      'Configuración completa del diseño',
      'Mayor nivel de personalización visual',
      'Acceso prioritario a nuevas funciones',
      'Soporte prioritario',
    ],
    includesStandard: true,
    role: 'restaurante',
    destacado: true,
    cta: 'Elegir Premium',
    icon: '🚀',
  },
  {
    nombre: 'Prueba Gratuita',
    precio: '15',
    periodo: ' días',
    descripcion: 'Durante la prueba gratuita el usuario tendrá acceso a todas las funciones del Plan Premium, permitiéndole utilizar la plataforma sin restricciones y evaluar todas sus características antes de contratar una suscripción.',
    features: [],
    notIncluded: [],
    role: 'restaurante',
    destacado: false,
    cta: 'Iniciar prueba gratis',
    icon: '🎁',
    isTrial: true,
  },
];

const faqs = [
  { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, sin penalizaciones ni contratos de permanencia.' },
  { q: '¿La prueba gratuita tiene límite de tiempo?', a: 'Sí, son 15 días completos con acceso a todas las funciones del Plan Premium. Al finalizar, puedes elegir el plan que mejor se adapte a tu negocio.' },
  { q: '¿Cobran comisión por venta?', a: 'Nunca. Solo pagas tu suscripción fija mensual.' },
  { q: '¿Puedo cambiar de plan después?', a: 'Sí, puedes subir o bajar de plan cuando quieras.' },
];

export function Precios() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-300">
      <Header />

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#0071E3]/[0.06] dark:bg-[#2997FF]/[0.08] blur-[100px] pointer-events-none" />

        <motion.div
          initial="hidden" animate="visible" variants={fadeUp(0)}
          className="max-w-[680px] mx-auto relative z-10"
        >
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0071E3] dark:text-[#2997FF] mb-4">
            Precios simples
          </p>
          <h1 className="text-[3rem] md:text-[4.5rem] font-black tracking-tighter leading-tight mb-5">
            El plan perfecto<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0071E3] to-[#40A9FF]">
              para cada uno.
            </span>
          </h1>
          <p className="text-[17px] text-[#86868B] dark:text-[#A1A1A6] leading-relaxed">
            Sin contratos. Sin sorpresas. Cancela cuando quieras.
          </p>
        </motion.div>
      </section>

      {/* ── PLANES ── */}
      <section className="pb-24 px-6">
        <div className="max-w-[1000px] mx-auto grid md:grid-cols-3 gap-5">
          {planes.map((plan, i) => (
            <motion.div
              key={plan.nombre}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={scaleIn(i + 1)}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className={`relative flex flex-col rounded-[1.75rem] p-7 border transition-all duration-300 overflow-hidden group ${
                plan.destacado
                  ? 'bg-[#0071E3] dark:bg-[#2997FF] border-transparent shadow-[0_20px_60px_rgba(0,113,227,0.3)] dark:shadow-[0_20px_60px_rgba(41,151,255,0.25)] hover:shadow-[0_30px_80px_rgba(0,113,227,0.5)] dark:hover:shadow-[0_30px_80px_rgba(41,151,255,0.4)]'
                  : 'bg-[#F5F5F7] dark:bg-[#161617] border-black/[0.06] dark:border-white/[0.07] hover:border-[#0071E3]/30 dark:hover:border-[#2997FF]/30 hover:shadow-[0_15px_40px_rgba(0,113,227,0.1)] dark:hover:shadow-[0_15px_40px_rgba(41,151,255,0.1)]'
              }`}
            >
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              {plan.destacado && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: -10 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.1 + 0.2, duration: 0.4 }}
                  viewport={{ once: true }}
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-white rounded-full text-[11px] font-bold text-[#0071E3] tracking-wide shadow-md"
                >
                  ⭐ Más popular
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.1, duration: 0.4 }}
                viewport={{ once: true }}
                className="text-3xl mb-5 group-hover:scale-125 transition-transform duration-300"
              >
                {plan.icon}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.15, duration: 0.4 }}
                viewport={{ once: true }}
                className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ${plan.destacado ? 'text-white/70' : 'text-[#86868B] dark:text-[#6E6E73]'}`}
              >
                {plan.nombre}
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.2, duration: 0.4 }}
                viewport={{ once: true }}
                className="flex items-baseline gap-1 mb-2"
              >
                <span className={`text-[3rem] font-black tracking-tighter leading-none ${plan.destacado ? 'text-white' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}`}>
                  {plan.precio}
                </span>
                {plan.periodo && (
                  <span className={`text-[15px] font-medium ${plan.destacado ? 'text-white/60' : 'text-[#86868B] dark:text-[#A1A1A6]'}`}>
                    {plan.periodo}
                  </span>
                )}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.25, duration: 0.4 }}
                viewport={{ once: true }}
                className={`text-[13px] mb-6 leading-relaxed ${plan.destacado ? 'text-white/80' : 'text-[#86868B] dark:text-[#A1A1A6]'}`}
              >
                {plan.descripcion}
              </motion.p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.includesStandard && (
                  <motion.li
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.3, duration: 0.4 }}
                    viewport={{ once: true }}
                    className={`text-[12px] font-semibold italic ${plan.destacado ? 'text-white/80' : 'text-[#6E6E73] dark:text-[#A1A1A6]'}`}
                  >
                    — Todo lo del Plan Estándar, además de:
                  </motion.li>
                )}
                {plan.features.map((f, featureIdx) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.3 + featureIdx * 0.05, duration: 0.4 }}
                    viewport={{ once: true }}
                    className={`flex items-start gap-2.5 text-[13px] ${plan.destacado ? 'text-white/90' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}`}
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      transition={{ delay: i * 0.1 + 0.3 + featureIdx * 0.05 + 0.1, duration: 0.3, type: 'spring', stiffness: 200 }}
                      viewport={{ once: true }}
                      className={`mt-0.5 flex-shrink-0 text-[15px] ${plan.destacado ? 'text-white' : 'text-[#0071E3] dark:text-[#2997FF]'}`}
                    >
                      ✓
                    </motion.span>
                    {f}
                  </motion.li>
                ))}
                {plan.notIncluded && plan.notIncluded.length > 0 && (
                  <>
                    <motion.li
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ delay: i * 0.1 + 0.4, duration: 0.4 }}
                      viewport={{ once: true }}
                      className={`pt-3 text-[12px] font-semibold ${plan.destacado ? 'text-white/60' : 'text-[#AEAEB2] dark:text-[#6E6E73]'}`}
                    >
                      No incluye:
                    </motion.li>
                    {plan.notIncluded.map((f, notIncludedIdx) => (
                      <motion.li
                        key={f}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 + 0.45 + notIncludedIdx * 0.05, duration: 0.4 }}
                        viewport={{ once: true }}
                        className={`flex items-start gap-2.5 text-[13px] ${plan.destacado ? 'text-white/60' : 'text-[#86868B] dark:text-[#6E6E73]'}`}
                      >
                        <span className="mt-0.5 flex-shrink-0 text-[15px] text-[#AEAEB2] dark:text-[#6E6E73]">✕</span>
                        {f}
                      </motion.li>
                    ))}
                  </>
                )}
                {plan.isTrial && (
                  <motion.li
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 + 0.3, duration: 0.4 }}
                    viewport={{ once: true }}
                    className={`pt-3 text-[13px] leading-relaxed ${plan.destacado ? 'text-white/90' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}`}
                  >
                    Al finalizar la prueba podrá elegir entre:<br />
                    <span className="font-semibold">Plan Estándar</span> o{' '}
                    <span className="font-semibold">Plan Premium</span>
                  </motion.li>
                )}
              </ul>

              <motion.button
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.5, duration: 0.4 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/register?role=${plan.role}`)}
                className={`w-full py-3.5 rounded-full font-bold text-[14px] transition-all duration-200 active:scale-[0.97] ${
                  plan.destacado
                    ? 'bg-white text-[#0071E3] hover:bg-white/90 shadow-lg hover:shadow-xl'
                    : 'bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] hover:opacity-90'
                }`}
              >
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="text-center mt-10 text-[13px] text-[#86868B] dark:text-[#6E6E73]"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          ¿Necesitas algo diferente?{' '}
          <button className="text-[#0071E3] dark:text-[#2997FF] font-semibold hover:underline transition-colors">
            Contáctanos
          </button>
        </motion.p>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-6 border-t border-black/[0.06] dark:border-white/[0.06] bg-[#F5F5F7] dark:bg-[#0A0A0A]">
        <div className="max-w-[680px] mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0071E3] dark:text-[#2997FF] mb-3">FAQ</p>
            <h2 className="text-[2rem] md:text-[2.8rem] font-black tracking-tighter">Preguntas frecuentes.</h2>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                className="p-6 rounded-[1.5rem] bg-white dark:bg-[#161617] border border-black/[0.06] dark:border-white/[0.07] hover:border-[#0071E3]/20 dark:hover:border-[#2997FF]/20 transition-all duration-300 cursor-pointer group"
              >
                <motion.div
                  initial={false}
                  className="flex items-center gap-3"
                >
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-[#0071E3] dark:bg-[#2997FF] group-hover:scale-150 transition-transform duration-300"
                  />
                  <p className="font-bold text-[15px] flex-1 group-hover:text-[#0071E3] dark:group-hover:text-[#2997FF] transition-colors">{faq.q}</p>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  whileInView={{ opacity: 1, marginTop: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.08 + 0.1 }}
                  viewport={{ once: true }}
                  className="text-[14px] text-[#86868B] dark:text-[#A1A1A6] leading-relaxed mt-2"
                >
                  {faq.a}
                </motion.p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#0071E3]/[0.08] dark:bg-[#2997FF]/[0.08] blur-[100px] rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <motion.div
          className="max-w-[560px] mx-auto relative z-10"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7 }}
        >
          <h2 className="text-[2.5rem] md:text-[3.5rem] font-black tracking-tighter mb-5">
            Empieza hoy.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0071E3] to-[#40A9FF]">Es gratis.</span>
          </h2>
          <motion.p
            className="text-[#86868B] dark:text-[#A1A1A6] mb-10 text-[16px]"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            viewport={{ once: true }}
          >
            Sin tarjeta de crédito. Listo en 5 minutos.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            viewport={{ once: true }}
          >
            <motion.button
              onClick={() => navigate('/register')}
              whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-4 bg-[#0071E3] dark:bg-[#2997FF] text-white font-bold rounded-full hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] transition-all hover:shadow-[0_20px_50px_rgba(0,113,227,0.4)] dark:hover:shadow-[0_20px_50px_rgba(41,151,255,0.3)] shadow-[0_20px_40px_rgba(0,113,227,0.25)]"
            >
              Registrarme gratis
            </motion.button>
            <motion.button
              onClick={() => navigate('/para-restaurantes')}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              className="px-10 py-4 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] font-semibold rounded-full hover:bg-black/[0.07] dark:hover:bg-white/[0.10] transition-all hover:border-[#0071E3]/30 dark:hover:border-[#2997FF]/30"
            >
              Ver más detalles
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
