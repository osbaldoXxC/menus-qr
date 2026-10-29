import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { comensalService } from '../../services/comensal';

// ── Layout renderers ──────────────────────────────────────────────
function SimpleList({ platillos, colorPrimario }: { platillos: any[]; colorPrimario: string }) {
  return (
    <div className="space-y-1">
      {platillos.map((p: any) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center py-3 px-4 border-b border-white/[0.06]"
        >
          <div>
            <h4 className="font-semibold text-[#F5F5F7]">{p.nombre}</h4>
            <p className="text-xs text-[#A1A1A6]">{p.descripcion?.substring(0, 50)}</p>
          </div>
          <span className="font-bold text-[#F5F5F7]">${p.precio}</span>
        </motion.div>
      ))}
    </div>
  );
}

function PhotoGrid({ platillos, colorPrimario }: { platillos: any[]; colorPrimario: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {platillos.map((p: any) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-apple-lg overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-[#2997FF]/30 transition"
        >
          <div className="h-28 flex items-center justify-center text-4xl bg-gradient-to-br from-white/[0.03] to-white/[0.06]">
            🍽️
          </div>
          <div className="p-3">
            <h4 className="font-semibold text-sm text-[#F5F5F7] truncate">{p.nombre}</h4>
            <span className="font-bold text-sm text-[#F5F5F7]">${p.precio}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function DetailedCards({ platillos, colorPrimario }: { platillos: any[]; colorPrimario: string }) {
  return (
    <div className="space-y-4">
      {platillos.map((p: any) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-apple-lg overflow-hidden bg-white/[0.03] border border-white/[0.05]"
        >
          <div className="h-40 flex items-center justify-center text-5xl bg-gradient-to-br from-white/[0.03] to-white/[0.06]">
            🌮
          </div>
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-[#F5F5F7] text-lg">{p.nombre}</h4>
              <span
                className="px-3 py-1 rounded-apple-full text-sm font-bold text-white"
                style={{ backgroundColor: colorPrimario || '#2997FF' }}
              >
                ${p.precio}
              </span>
            </div>
            <p className="text-[#A1A1A6] text-sm leading-relaxed">
              {p.descripcion || 'Delicioso platillo preparado con ingredientes frescos.'}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Layout switcher ───────────────────────────────────────────────
function LayoutRenderer({
  type,
  platillos,
  colorPrimario,
}: {
  type: string;
  platillos: any[];
  colorPrimario: string;
}) {
  switch (type) {
    case 'LISTA_SIMPLE':
      return <SimpleList platillos={platillos} colorPrimario={colorPrimario} />;
    case 'CUADRICULA_FOTOS':
      return <PhotoGrid platillos={platillos} colorPrimario={colorPrimario} />;
    case 'TARJETAS_DETALLADAS':
    default:
      return <DetailedCards platillos={platillos} colorPrimario={colorPrimario} />;
  }
}

// ── Main component ────────────────────────────────────────────────
export function EscanearQR() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (id) {
      // Si ya hay un ID en la URL, redirigimos al menú público real
      navigate(`/menu/${id}`, { replace: true });
    }
  }, [id, navigate]);

  const handleSimularEscaneo = () => {
    setScanning(true);
    setTimeout(() => {
      // Simulamos que encontró un ID de restaurante real
      navigate('/menu/1');
    }, 1500);
  };

  return (
    <div className="bg-[#000000] text-[#F5F5F7] min-h-screen flex flex-col items-center justify-center px-4">
      <Header />
      
      <div className="text-center max-w-sm w-full pt-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative glass rounded-[2.5rem] overflow-hidden border border-white/[0.06] mb-10 mx-auto group shadow-2xl"
        >
          <div className="aspect-square flex flex-col items-center justify-center bg-gradient-to-br from-[#1D1D1F] to-[#050505]">
            <div className="relative w-48 h-48">
              {/* Esquinas del scanner */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#FF4A00] rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#FF4A00] rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#FF4A00] rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#FF4A00] rounded-br-2xl" />
              
              {/* Animación de escaneo */}
              <motion.div 
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF4A00] to-transparent shadow-[0_0_15px_#FF4A00]"
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span 
                  className="text-6xl" 
                  animate={scanning ? { scale: [1, 1.2, 0], opacity: [1, 1, 0] } : { scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  {scanning ? '✨' : '📷'}
                </motion.span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-black mb-4"
        >
          Escanea para comer
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[#A1A1A6] mb-10 leading-relaxed px-4"
        >
          Apunta con tu cámara al código QR de la mesa para ver el menú digital al instante.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleSimularEscaneo}
          disabled={scanning}
          className="w-full py-5 bg-white text-black rounded-full font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl"
        >
          {scanning ? 'Validando QR...' : 'Simular Escaneo 📷'}
        </motion.button>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[#6E6E73] text-[10px] uppercase tracking-[0.2em] mt-8"
        >
          Seguro • Rápido • Sin Contacto
        </motion.p>
      </div>

      <Footer />
    </div>
  );
}
