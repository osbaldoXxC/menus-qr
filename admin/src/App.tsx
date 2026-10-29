import { useState, useEffect } from 'react';
import './App.css';
import Support from './pages/Support/Support';
import { fetchWithAuth } from './services/api';

interface Restaurante {
  id: string;
  nombre_negocio: string;
  email: string;
  estado: 'pendiente' | 'aprobado' | 'suspendido';
  suscripcion_activa: boolean;
  plan: string;
  suscripcion_expira_en: string | null;
  dias_licencia: number;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Premium Inline SVGs for elegant look
const TacoIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12a10 10 0 0 1 20 0Z" />
    <path d="M5 12c0-1.5.5-3 1.5-4" />
    <path d="M19 12c0-1.5-.5-3-1.5-4" />
    <path d="M12 12a2 2 0 0 0 0-4" />
  </svg>
);

const StoreIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'pendientes' | 'aprobados' | 'suspendidos' | 'soporte'>('todos');
  const [daysInput, setDaysInput] = useState<{ [id: string]: number }>({});
  const [planInput, setPlanInput] = useState<{ [id: string]: string }>({});
  
  // Modal de confirmación para el Kill Switch
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [selectedRestaurante, setSelectedRestaurante] = useState<Restaurante | null>(null);
  const [suspendingLoading, setSuspendingLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_access_token');
    const rol = localStorage.getItem('admin_rol');
    if (token && rol === 'SUPER_ADMIN') {
      setIsAuthenticated(true);
      fetchRestaurantes(token);
    } else {
      if (rol && rol !== 'SUPER_ADMIN') {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_rol');
      }
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        credentials: 'include', // Necesario para guardar cookie en login
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.mensaje || 'Error al iniciar sesión');
      }

      if (data.rol !== 'SUPER_ADMIN') {
        throw new Error('Acceso denegado: Se requiere rol de Super Administrador.');
      }

      localStorage.setItem('admin_access_token', data.access_token);
      localStorage.setItem('admin_rol', data.rol);
      setIsAuthenticated(true);
      fetchRestaurantes(data.access_token);
    } catch (err: any) {
      setLoginError(err.message || 'Error de conexión con el servidor');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetchWithAuth(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_rol');
    setIsAuthenticated(false);
    setRestaurants([]);
  };

  const fetchRestaurantes = async (tokenOverride?: string) => {
    setLoading(true);
    try {
      const headers: any = {};
      if (tokenOverride) headers['Authorization'] = `Bearer ${tokenOverride}`;

      const res = await fetchWithAuth(`${API_BASE_URL}/admin/restaurants`, {
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.mensaje || 'Error al obtener restaurantes');
      }

      setRestaurants(data);
      // Inicializar el input de días y plan para cada restaurante
      const initialDays: { [id: string]: number } = {};
      const initialPlans: { [id: string]: string } = {};
      data.forEach((r: Restaurante) => {
        initialDays[r.id] = r.dias_licencia > 0 ? r.dias_licencia : 30;
        initialPlans[r.id] = r.plan || 'basico';
      });
      setDaysInput(initialDays);
      setPlanInput(initialPlans);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const dias = daysInput[id] || 30;
    const plan = planInput[id] || 'basico';
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/restaurants/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ dias_licencia: dias, plan }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.mensaje || 'Error al aprobar restaurante');
        return;
      }

      alert('Restaurante aprobado correctamente.');
      fetchRestaurantes();
    } catch (err) {
      console.error(err);
      alert('Error en el servidor al aprobar restaurante');
    }
  };

  const handleConfirmSuspend = async () => {
    if (!selectedRestaurante) return;
    setSuspendingLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/restaurants/${selectedRestaurante.id}/suspend`, {
        method: 'PUT',
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.mensaje || 'Error al suspender restaurante');
        return;
      }

      setShowSuspendModal(false);
      setSelectedRestaurante(null);
      alert('Kill Switch ejecutado: Acceso cancelado, platillos pausados y caché eliminada.');
      fetchRestaurantes();
    } catch (err) {
      console.error(err);
      alert('Error en el servidor al ejecutar Kill Switch');
    } finally {
      setSuspendingLoading(false);
    }
  };

  const openSuspendModal = (restaurante: Restaurante) => {
    setSelectedRestaurante(restaurante);
    setShowSuspendModal(true);
  };

  const updateDaysInputValue = (id: string, value: number) => {
    setDaysInput(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const updatePlanInputValue = (id: string, value: string) => {
    setPlanInput(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Filtrado y búsqueda
  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = r.nombre_negocio.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'todos') return matchesSearch;
    if (activeTab === 'pendientes') return matchesSearch && r.estado === 'pendiente';
    if (activeTab === 'aprobados') return matchesSearch && r.estado === 'aprobado';
    if (activeTab === 'suspendidos') return matchesSearch && r.estado === 'suspendido';
    return matchesSearch;
  });

  // KPIs calculados
  const totalCount = restaurants.length;
  const pendingCount = restaurants.filter(r => r.estado === 'pendiente').length;
  const approvedCount = restaurants.filter(r => r.estado === 'aprobado').length;
  const suspendedCount = restaurants.filter(r => r.estado === 'suspendido').length;

  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'soporte'>('dashboard');

  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper">
        <div className="login-blob blob-1"></div>
        <div className="login-blob blob-2"></div>
        <div className="login-blob blob-3"></div>

        <div className="login-card">
          <div className="login-header">
            <div className="login-logo-container">
              <TacoIcon className="login-logo-svg" />
            </div>
            <h2 className="login-title">MexxicanMX</h2>
            <p className="login-subtitle">Panel de SuperAdministrador</p>
          </div>

          {loginError && (
            <div className="login-error">
              <AlertIcon className="login-error-icon" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <div className="form-input-container">
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="ejemplo@mexxican.mx"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div className="form-input-container">
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-login" disabled={loginLoading}>
              {loginLoading ? (
                <span className="btn-loading-flex">
                  <span className="spinner-small"></span>
                  Iniciando sesión...
                </span>
              ) : 'Ingresar al sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      {/* Background blobs for luxury ambient blur */}
      <div className="app-blob blob-1"></div>
      <div className="app-blob blob-2"></div>

      {/* Main Layout wrapper */}
      <div className="admin-layout">
        
        {/* Sidebar Menu */}
        <aside className="admin-sidebar">
          <div className="sidebar-brand">
            <div className="navbar-logo-container">
              <TacoIcon className="navbar-logo-svg" />
            </div>
            <div>
              <h1 className="navbar-title" style={{ fontSize: '18px' }}>MexxicanMX</h1>
              <span className="navbar-badge" style={{ fontSize: '9px', padding: '2px 6px', marginTop: '2px', display: 'inline-block' }}>Super Admin</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`sidebar-menu-item ${activeMenu === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveMenu('dashboard')}
            >
              <StoreIcon className="menu-icon" />
              Restaurantes
            </button>
            <button 
              className={`sidebar-menu-item ${activeMenu === 'soporte' ? 'active' : ''}`}
              onClick={() => setActiveMenu('soporte')}
            >
              <svg className="menu-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Soporte Premium
            </button>
          </nav>

          <div className="sidebar-footer">
            <button className="btn-logout-sidebar" onClick={handleLogout}>
              <LogoutIcon className="btn-logout-icon" />
              Cerrar Sesión
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="admin-content-area">
          {activeMenu === 'soporte' ? (
            <div className="p-8 h-full">
              <div className="dashboard-header-section mb-6">
                <h2 className="dashboard-title">Soporte Premium</h2>
                <p className="dashboard-subtitle">Bandeja de entrada y atención al cliente.</p>
              </div>
              <Support />
            </div>
          ) : (
            <div className="p-8">
              <div className="dashboard-header-section mb-6">
                <h2 className="dashboard-title">Panel de Control Central</h2>
                <p className="dashboard-subtitle">Control de restaurantes, asignación de licencias y activación de planes.</p>
              </div>

              {/* Stats Section */}
              <section className="stats-grid">
                <div className="stat-card stat-card-total">
                  <div className="stat-header">
                    <h3 className="stat-title">Registrados</h3>
                    <span className="stat-icon-wrapper">
                      <StoreIcon />
                    </span>
                  </div>
                  <p className="stat-value">{totalCount}</p>
                </div>
                
                <div className="stat-card stat-card-pending">
                  <div className="stat-header">
                    <h3 className="stat-title">Pendientes</h3>
                    <span className="stat-icon-wrapper">
                      <ClockIcon />
                    </span>
                  </div>
                  <p className="stat-value">{pendingCount}</p>
                </div>

                <div className="stat-card stat-card-approved">
                  <div className="stat-header">
                    <h3 className="stat-title">Aprobados</h3>
                    <span className="stat-icon-wrapper">
                      <CheckIcon />
                    </span>
                  </div>
                  <p className="stat-value">{approvedCount}</p>
                </div>

                <div className="stat-card stat-card-suspended">
                  <div className="stat-header">
                    <h3 className="stat-title">Suspendidos</h3>
                    <span className="stat-icon-wrapper">
                      <LockIcon />
                    </span>
                  </div>
                  <p className="stat-value">{suspendedCount}</p>
                </div>
              </section>

              {/* Search & Tabs Controls */}
              <section className="controls-bar">
                <div className="search-wrapper">
                  <span className="search-icon-wrapper">
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar negocio por nombre o email..."
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="filter-tabs">
                  <button 
                    className={`filter-tab ${activeTab === 'todos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('todos')}
                  >
                    Todos
                  </button>
                  <button 
                    className={`filter-tab ${activeTab === 'pendientes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pendientes')}
                  >
                    Pendientes <span className="tab-count">{pendingCount}</span>
                  </button>
                  <button 
                    className={`filter-tab ${activeTab === 'aprobados' ? 'active' : ''}`}
                    onClick={() => setActiveTab('aprobados')}
                  >
                    Aprobados <span className="tab-count">{approvedCount}</span>
                  </button>
                  <button 
                    className={`filter-tab ${activeTab === 'suspendidos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suspendidos')}
                  >
                    Suspendidos <span className="tab-count">{suspendedCount}</span>
                  </button>
                </div>
              </section>

              <section className="restaurants-list">
                {loading ? (
                  <div className="loading-spinner-container">
                    <span className="loading-spinner"></span>
                    <p className="loading-text">Cargando restaurantes...</p>
                  </div>
                ) : filteredRestaurants.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon-wrapper">
                      <StoreIcon />
                    </div>
                    <h3 className="empty-state-title">No hay restaurantes</h3>
                    <p className="empty-state-desc">No se encontraron negocios con los filtros actuales.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Negocio</th>
                          <th>Plan</th>
                          <th>Estado</th>
                          <th>Vencimiento</th>
                          <th>Licencia</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRestaurants.map((r) => {
                          const isApproved = r.estado === 'aprobado';
                          const isSuspended = r.estado === 'suspendido';

                          return (
                            <tr key={r.id} className={`row-state-${r.estado}`}>
                              <td>
                                <div className="restaurant-name-cell">
                                  <span className="restaurant-name">{r.nombre_negocio}</span>
                                  <span className="restaurant-email">{r.email}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`badge badge-plan-${r.plan}`}>
                                  {r.plan}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-${r.estado}`}>
                                  {r.estado}
                                </span>
                              </td>
                              <td>
                                {r.suscripcion_expira_en ? (
                                  <span className="date-text">
                                    {new Date(r.suscripcion_expira_en).toLocaleDateString('es-MX', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                ) : (
                                  <span className="no-date-text">Sin asignar</span>
                                )}
                              </td>
                              <td>
                                {r.dias_licencia > 0 ? (
                                  <span className="days-text">{r.dias_licencia} días</span>
                                ) : (
                                  <span className="no-days-text">—</span>
                                )}
                              </td>
                              <td>
                                <div className="actions-cell flex gap-2 items-center">
                                  <div className="approve-box flex items-center gap-2">
                                    <select
                                      className="approve-input-days"
                                      style={{ width: 'auto', padding: '0 8px' }}
                                      value={planInput[r.id] || 'basico'}
                                      onChange={(e) => updatePlanInputValue(r.id, e.target.value)}
                                      title="Plan"
                                    >
                                      <option value="prueba">Prueba</option>
                                      <option value="estandar">Estándar</option>
                                      <option value="premium">Premium</option>
                                    </select>
                                    <input
                                      type="number"
                                      min="1"
                                      max="365"
                                      className="approve-input-days"
                                      value={daysInput[r.id] || 30}
                                      onChange={(e) => updateDaysInputValue(r.id, parseInt(e.target.value) || 0)}
                                      title="Días de acceso"
                                    />
                                    <button className="btn-approve" onClick={() => handleApprove(r.id)}>
                                      {isApproved ? 'Guardar Tiempo' : isSuspended ? 'Reactivar' : 'Aprobar'}
                                    </button>
                                  </div>
                                  {isApproved && (
                                    <button className="btn-suspend" onClick={() => openSuspendModal(r)}>
                                      <AlertIcon className="btn-suspend-icon" />
                                      <span>Cancelar Acceso</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Kill Switch Warning Modal */}
      {showSuspendModal && selectedRestaurante && (
        <div className="modal-overlay">
          <div className="modal-card modal-killswitch">
            <div className="modal-header-danger">
              <div className="danger-icon-pulse">
                <AlertIcon />
              </div>
              <h3 className="modal-title">⚠️ Confirmar Kill Switch</h3>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Estás a punto de cancelar el acceso de <strong>{selectedRestaurante.nombre_negocio}</strong> de forma inmediata.
              </p>
              <div className="consequences-card">
                <p className="consequences-title">
                  Consecuencias en tiempo real:
                </p>
                <ul className="consequences-list">
                  <li>
                    <span className="list-bullet">⚡</span>
                    <span>Se revocan todos los tokens de sesión activa del restaurante.</span>
                  </li>
                  <li>
                    <span className="list-bullet">⚡</span>
                    <span>El panel privado del dueño cerrará sesión inmediatamente.</span>
                  </li>
                  <li>
                    <span className="list-bullet">⚡</span>
                    <span>Se inactivarán todos los platillos (bulk update a <code>activo = false</code>).</span>
                  </li>
                  <li>
                    <span className="list-bullet">⚡</span>
                    <span>Se eliminará el caché de Redis.</span>
                  </li>
                  <li>
                    <span className="list-bullet">⚡</span>
                    <span>El código QR público quedará desactivado, arrojando error a los comensales.</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={() => { setShowSuspendModal(false); setSelectedRestaurante(null); }}
                disabled={suspendingLoading}
              >
                Volver
              </button>
              <button 
                className="btn-confirm-suspend" 
                onClick={handleConfirmSuspend}
                disabled={suspendingLoading}
              >
                {suspendingLoading ? (
                  <span className="btn-loading-flex">
                    <span className="spinner-small"></span>
                    Cancelando acceso...
                  </span>
                ) : 'Confirmar Apagado (Kill Switch)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
