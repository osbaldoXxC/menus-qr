import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border-t border-apple-border dark:border-apple-dark-border backdrop-blur-xl transition-colors duration-500">
      <div className="mx-auto max-w-[1400px] px-5 md:px-6 lg:px-8">
        {/* Main grid */}
        <div className="py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <Logo size={28} />
              <span className="text-[17px] font-bold text-apple-text dark:text-apple-dark-text">MexxicanMX</span>
            </div>
            <p className="text-[13px] text-apple-text-secondary leading-relaxed max-w-[240px] font-medium">
              Motor de descubrimiento gastronómico impulsado por IA. Encuentra tu platillo perfecto.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[11px] font-black text-apple-text dark:text-apple-dark-text mb-4 uppercase tracking-[0.1em]">
              Producto
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/como-funciona"
                  className="text-[13px] text-apple-text-secondary hover:text-apple-blue transition-colors duration-200 font-medium"
                >
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link
                  to="/precios"
                  className="text-[13px] text-apple-text-secondary hover:text-apple-blue transition-colors duration-200 font-medium"
                >
                  Precios
                </Link>
              </li>
              <li>
                <Link
                  to="/para-restaurantes"
                  className="text-[13px] text-apple-text-secondary hover:text-apple-blue transition-colors duration-200 font-medium"
                >
                  Para restaurantes
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[11px] font-black text-apple-text dark:text-apple-dark-text mb-4 uppercase tracking-[0.1em]">
              Compañía
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/landing"
                  className="text-[13px] text-apple-text-secondary hover:text-apple-blue transition-colors duration-200 font-medium"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  to="/landing"
                  className="text-[13px] text-apple-text-secondary hover:text-apple-blue transition-colors duration-200 font-medium"
                >
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[11px] font-black text-apple-text dark:text-apple-dark-text mb-4 uppercase tracking-[0.1em]">
              Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/landing"
                  className="text-[13px] text-apple-text-secondary hover:text-apple-blue transition-colors duration-200 font-medium"
                >
                  Privacidad
                </Link>
              </li>
              <li>
                <Link
                  to="/landing"
                  className="text-[13px] text-apple-text-secondary hover:text-apple-blue transition-colors duration-200 font-medium"
                >
                  Términos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-5 border-t border-apple-border dark:border-apple-dark-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-apple-text-tertiary font-medium">
            © {new Date().getFullYear()} MexxicanMX. Todos los derechos reservados.
          </p>
          <p className="text-[12px] text-apple-text-tertiary font-bold">
            Hecho con 🌶️ en México
          </p>
        </div>
      </div>
    </footer>
  );
}