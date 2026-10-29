import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Precarga proactiva en segundo plano de las rutas principales
if (typeof window !== 'undefined') {
  setTimeout(() => {
    import('./pages/DashboardRestaurante/DashboardRestaurante');
    import('./pages/MiMenu/MiMenu');
    import('./pages/CodigoQR/CodigoQR');
    import('./pages/Configuracion/Configuracion');
    import('./pages/Perfil/Perfil');
    import('./pages/NuevoPlatillo/NuevoPlatillo');
  }, 100);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
