import { useEffect, useRef } from 'react';
import { NaturalSearch } from '../../features/recommendations/NaturalSearch';

interface RecommendationWizardProps {
  restaurantId: string;
  restaurantName?: string;
  restaurantLogoUrl?: string;
  primaryColor?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RecommendationWizard({ restaurantId, isOpen, onClose }: RecommendationWizardProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!isOpen && dialog.current?.open) dialog.current.close();
  }, [isOpen]);
  return <dialog ref={dialog} onCancel={onClose} aria-label="Buscar platillos" className="w-full max-w-4xl max-h-[95vh] rounded-2xl backdrop:bg-black/70 p-0">
    <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full border border-current px-3 py-2 bg-white text-black dark:bg-[#242120] dark:text-white focus-visible:outline focus-visible:outline-2" aria-label="Cerrar búsqueda">Cerrar</button>
    <NaturalSearch restaurantId={restaurantId} />
  </dialog>;
}
