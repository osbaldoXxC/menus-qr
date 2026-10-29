import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';

// Importaciones directas para navegación instantánea (0ms de pantalla en blanco)
import { NoSabesQueComer as HomeDiners } from './pages/Landing/NoSabesQueComer';
import { Descubrir } from './pages/Descubrir/Descubrir';
import { CuestionarioIA } from './pages/CuestionarioIA/CuestionarioIA';
import { PublicMenu } from './pages/PublicMenu/PublicMenu';
import { EscanearQR } from './pages/EscanearQR/EscanearQR';
import { NotFound } from './pages/NotFound/NotFound';

function DinerRoutes() {
  return (
    <Routes>
      {/* Experiencia B2C Comensales */}
      <Route path="/" element={<HomeDiners />} />
      <Route path="/descubrir" element={<Descubrir />} />
      <Route path="/cuestionario" element={<CuestionarioIA />} />
      <Route path="/menu/:restaurant_id" element={<PublicMenu />} />
      <Route path="/escanear/:id?" element={<EscanearQR />} />

      {/* 404 Not Found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-apple-bg dark:bg-apple-dark-bg text-apple-text dark:text-apple-dark-text transition-colors duration-300">
          <DinerRoutes />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
