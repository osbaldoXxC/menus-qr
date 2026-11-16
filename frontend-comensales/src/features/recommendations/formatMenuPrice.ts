export function formatMenuPrice(price: number | undefined): string {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return 'Precio no disponible';
  return `$${price.toFixed(2)} MXN`;
}
