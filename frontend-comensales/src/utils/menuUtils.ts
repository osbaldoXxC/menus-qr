/**
 * Retorna la URL pública del menú usando el slug o ID, priorizando el slug amigable.
 * Respeta VITE_PUBLIC_MENU_URL de las variables de entorno si existe.
 */
export function getPublicMenuUrl(identifier?: string, serverUrl?: string): string {
  if (serverUrl) return serverUrl;
  if (!identifier) return '';
  
  const envUrl = import.meta.env.VITE_PUBLIC_MENU_URL;
  if (envUrl) {
    const base = envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
    return `${base}${identifier}`;
  }
  
  return `${window.location.origin}/menu/${identifier}`;
}
