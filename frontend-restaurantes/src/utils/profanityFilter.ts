/**
 * Filtro de moderación de contenido y censura de groserías para la vista del restaurante.
 * Protege contra lenguaje altisonante sin afectar palabras legítimas (evita falsos positivos).
 */

const PALABRAS_OFENSIVAS: string[] = [
  'puto', 'puta', 'putos', 'putas', 'puton', 'putona',
  'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejada', 'pendejadas',
  'cabron', 'cabrona', 'cabrones', 'cabronas', 'cabronada',
  'cabrón', 'cabrona', 'cabrónes',
  'mierda', 'mierdas', 'mierdoso', 'mierdosa',
  'verga', 'vergas', 'vergazo', 'vergazos', 'valeverga',
  'culero', 'culera', 'culeros', 'culeras', 'culo', 'culos',
  'chingar', 'chinga', 'chingas', 'chingada', 'chingados', 'chingon', 'chingona', 'chingadera', 'chingaderas',
  'chingón',
  'mamon', 'mamona', 'mamones', 'mamadas', 'mamada', 'mamar',
  'mamón',
  'estupido', 'estupida', 'estupidos', 'estupidas',
  'estúpido', 'estúpida', 'estúpidos', 'estúpidas',
  'idiota', 'idiotas',
  'imbecil', 'imbeciles', 'imbécil', 'imbéciles',
  'zorra', 'zorras',
  'perra', 'perras',
  'madrazo', 'madrazos', 'desmadre',
  'pinche', 'pinches',
  'joto', 'jotos', 'jotozo',
  'maricon', 'maricones', 'maricón',
  'bastardo', 'bastarda', 'bastardos'
];

/**
 * Censura palabras altisonantes en un texto, reemplazando desde la segunda letra con asteriscos.
 * Ejemplo: "puto" -> "p***"
 */
export function censurarGroserias(texto: string): string {
  if (!texto || typeof texto !== 'string') return texto;

  let resultado = texto;

  for (const palabra of PALABRAS_OFENSIVAS) {
    // Escapar caracteres especiales si los hubiera
    const regex = new RegExp(`\\b${palabra}\\b`, 'gi');
    resultado = resultado.replace(regex, (match) => {
      if (match.length <= 1) return '*';
      return match[0] + '*'.repeat(match.length - 1);
    });
  }

  return resultado;
}

/**
 * Comprueba si un texto contiene palabras altisonantes
 */
export function contieneGroserias(texto: string): boolean {
  if (!texto || typeof texto !== 'string') return false;
  return PALABRAS_OFENSIVAS.some((palabra) => {
    const regex = new RegExp(`\\b${palabra}\\b`, 'i');
    return regex.test(texto);
  });
}
