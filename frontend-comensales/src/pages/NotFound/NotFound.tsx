import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { authService } from '../../services/auth';

export function NotFound() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const isRestaurante = user.rol?.toLowerCase() === 'restaurante';

  return (
    <div className="bg-[#000000] text-[#F5F5F7] min-h-screen">
      <Header />
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] pt-20 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-8xl mb-6">🔍</div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Página no encontrada</h1>
          <p className="text-[#A1A1A6] text-lg mb-8 max-w-md mx-auto">
            La página que buscas no existe o fue movida.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(isRestaurante ? '/dashboard/restaurante' : '/landing')}
              className="btn-apple btn-apple-primary text-sm py-3 px-6"
            >
              {isRestaurante ? 'Ir al dashboard' : 'Ir al inicio'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="btn-apple-outline text-sm py-3 px-6 rounded-apple-full"
            >
              Volver atrás
            </button>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}