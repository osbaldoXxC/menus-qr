import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders,
  Copy,
  ClipboardCheck,
  RotateCcw,
  Sparkles,
  Layers,
  Eye,
  Maximize2,
  Move,
  Check,
  Info
} from 'lucide-react';
import {
  BreakpointKey,
  ImageBreakpointConfig,
  ResponsiveImageMap,
  BREAKPOINTS_LIST,
  BREAKPOINT_GROUPS,
  getResolvedBreakpointConfig,
  sanitizeBreakpointConfig,
  ObjectFitValue
} from '../../utils/responsiveImageUtils';

interface ResponsiveImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  horizontalImageUrl?: string;
  verticalImageUrl?: string;
  apariencia: any;
  onSave: (updatedApariencia: any) => void;
}

export const ResponsiveImageEditor: React.FC<ResponsiveImageEditorProps> = ({
  isOpen,
  onClose,
  imageUrl,
  horizontalImageUrl,
  verticalImageUrl,
  apariencia,
  onSave
}) => {
  const [responsiveMap, setResponsiveMap] = useState<ResponsiveImageMap>({});
  const [activeBp, setActiveBp] = useState<BreakpointKey>('desktop');
  const [copiedConfig, setCopiedConfig] = useState<ImageBreakpointConfig | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Guías y Reglas
  const [showGuides, setShowGuides] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [snapActive, setSnapActive] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  // Dragging states
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isResizingImage, setIsResizingImage] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [initialImagePos, setInitialImagePos] = useState({ x: 0, y: 0 });
  const [initialImageDim, setInitialImageDim] = useState({ w: 300, h: 300 });

  // Historial de cambios para Undo / Redo
  const [history, setHistory] = useState<ResponsiveImageMap[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [scaleFactor, setScaleFactor] = useState(1);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Cargar estado inicial al abrir modal
  // Solo recargar si apariencia.responsive_imagen cambió realmente (no en cada render)
  useEffect(() => {
    if (isOpen) {
      // Debug log removed
      const initialMap = apariencia?.responsive_imagen
        ? { ...apariencia.responsive_imagen }
        : {};

      // Solo actualizar si es significativamente diferente (no solo cambios en otros campos)
      setResponsiveMap((prevMap) => {
        // Comparar si responsive_imagen realmente cambió
        const prevJson = JSON.stringify(prevMap);
        const newJson = JSON.stringify(initialMap);

        if (prevJson !== newJson) {
          // Debug log removed
          setHistory([initialMap]);
          setHistoryIndex(0);
          setActiveBp('desktop');
          return initialMap;
        }
        return prevMap;
      });
    }
  }, [isOpen, apariencia?.responsive_imagen]); // Depender solo de responsive_imagen, no de todo apariencia

  // Obtener la configuración resuelta actual (con herencia) para el breakpoint seleccionado
  const { config: currentConfig, inheritedFrom } = getResolvedBreakpointConfig(
    responsiveMap,
    activeBp,
    apariencia
  );

  const isHorizontalActive = BREAKPOINT_GROUPS.HORIZONTAL.includes(activeBp);
  const activeImageUrl = isHorizontalActive
    ? (horizontalImageUrl || apariencia?.fondo_imagen_horizontal_url || (!verticalImageUrl && !apariencia?.fondo_imagen_vertical_url ? (imageUrl || apariencia?.fondo_imagen_url) : '') || '')
    : (verticalImageUrl || apariencia?.fondo_imagen_vertical_url || (!horizontalImageUrl && !apariencia?.fondo_imagen_horizontal_url ? (imageUrl || apariencia?.fondo_imagen_url) : '') || '');

  const activeBpMeta = BREAKPOINTS_LIST.find(b => b.key === activeBp) || BREAKPOINTS_LIST[1];
  const isCustomized = inheritedFrom === activeBp;

  // Listen for native DOM change/input events on selects (for Playwright compatibility)
  useEffect(() => {
    if (!isOpen) return;

    const handleNativeSelectChange = (e: Event) => {
      const select = e.target as HTMLSelectElement;
      console.warn('⚠️ Native select event:', e.type, 'for', select.name);
      if (select.name === 'object-fit' || select.getAttribute('data-testid') === 'object-fit-select') {
        // Debug log removed
        updateActiveConfig({ object_fit: select.value as ObjectFitValue });
      }
    };

    // Listen for both change and input events on capture phase
    document.addEventListener('change', handleNativeSelectChange, true);
    document.addEventListener('input', handleNativeSelectChange, true);
    // Debug logs removed
    return () => {
      document.removeEventListener('change', handleNativeSelectChange, true);
      document.removeEventListener('input', handleNativeSelectChange, true);
    };
  }, [isOpen, responsiveMap, activeBp]);

  // Actualizar escala
  useEffect(() => {
    const updateScale = () => {
      if (canvasContainerRef.current) {
        const containerW = canvasContainerRef.current.clientWidth - 48; // padding
        const containerH = canvasContainerRef.current.clientHeight - 48;
        const scaleW = containerW / activeBpMeta.defaultW;
        const scaleH = containerH / activeBpMeta.defaultH;
        setScaleFactor(Math.min(scaleW, scaleH, 1));
      }
    };
    // timeout for layout paint
    setTimeout(updateScale, 50);
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [activeBpMeta, isOpen]);

  const pushToHistory = (newMap: ResponsiveImageMap) => {
    const nextHist = history.slice(0, historyIndex + 1);
    nextHist.push(newMap);
    setHistory(nextHist);
    setHistoryIndex(nextHist.length - 1);
  };

  // Actualizar cualquier propiedad del breakpoint activo (marca custom=true para esa resolución únicamente)
  const updateActiveConfig = (updates: Partial<ImageBreakpointConfig>) => {
    // Debug log removed
    const updatedBpConfig: ImageBreakpointConfig = sanitizeBreakpointConfig(
      {
        ...currentConfig,
        ...updates,
        custom: true
      },
      activeBp
    );
    // Debug log removed

    const nextMap: ResponsiveImageMap = {
      ...responsiveMap,
      [activeBp]: updatedBpConfig
    };
    // Debug log removed

    setResponsiveMap(nextMap);
    pushToHistory(nextMap);
  };

  // Restaurar resolución activa para heredar automáticamente de la superior
  const handleRestoreBreakpoint = () => {
    const nextMap = { ...responsiveMap };
    delete nextMap[activeBp];
    setResponsiveMap(nextMap);
    pushToHistory(nextMap);
  };

  // Copiar configuración
  const handleCopyConfig = () => {
    setCopiedConfig({ ...currentConfig });
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Pegar configuración
  const handlePasteConfig = () => {
    if (!copiedConfig) return;
    updateActiveConfig({
      ...copiedConfig,
      custom: true
    });
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setResponsiveMap(history[prevIdx]);
      setHistoryIndex(prevIdx);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setResponsiveMap(history[nextIdx]);
      setHistoryIndex(nextIdx);
    }
  };

  // Centrar Imagen
  const handleCenterImage = () => {
    updateActiveConfig({ position_x: 0, position_y: 0 });
  };

  // Drag Mover Imagen
  const handleMouseDownImage = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingImage(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setDragStartPos({ x: clientX, y: clientY });
    setInitialImagePos({ x: currentConfig.position_x, y: currentConfig.position_y });
  };

  // Drag Redimensionar Imagen (Esquina inferior derecha)
  const handleMouseDownResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsResizingImage(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setDragStartPos({ x: clientX, y: clientY });
    setInitialImageDim({ w: currentConfig.width, h: currentConfig.height });
  };

  // Listener Global de Drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingImage && !isResizingImage) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - dragStartPos.x;
      const deltaY = clientY - dragStartPos.y;

      if (isDraggingImage) {
        let rawX = initialImagePos.x + (deltaX / scaleFactor);
        let rawY = initialImagePos.y + (deltaY / scaleFactor);

        // Auto-snap a centro (X=0, Y=0) si está a menos de 12px
        let isSnappedX = false;
        let isSnappedY = false;

        if (Math.abs(rawX) < 12) {
          rawX = 0;
          isSnappedX = true;
        }
        if (Math.abs(rawY) < 12) {
          rawY = 0;
          isSnappedY = true;
        }

        setSnapActive({ x: isSnappedX, y: isSnappedY });

        // Limitar desbordamiento visible
        const clampedX = Math.max(-2000, Math.min(2000, Math.round(rawX)));
        const clampedY = Math.max(-2000, Math.min(2000, Math.round(rawY)));

        updateActiveConfig({ position_x: clampedX, position_y: clampedY });
      }

      if (isResizingImage) {
        const newW = Math.max(20, Math.min(3000, Math.round(initialImageDim.w + (deltaX / scaleFactor))));
        const newH = Math.max(20, Math.min(3000, Math.round(initialImageDim.h + (deltaY / scaleFactor))));
        updateActiveConfig({ width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingImage(false);
      setIsResizingImage(false);
      setSnapActive({ x: false, y: false });
    };

    if (isDraggingImage || isResizingImage) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingImage, isResizingImage, dragStartPos, initialImagePos, initialImageDim, currentConfig]);

  // Guardar Cambios
  const handleApplyChanges = () => {
    try {
      // Debug logs removed
      // Build responsive_imagen from current responsiveMap + any DOM values that differ
      let finalMap = { ...responsiveMap };

      // Read all current input values from DOM to capture Playwright E2E changes
      const selectElement = document.querySelector('select[data-testid="object-fit-select"]') as HTMLSelectElement;
      const posXInput = document.querySelector('input[data-testid="position-x"]') as HTMLInputElement;
      const posYInput = document.querySelector('input[data-testid="position-y"]') as HTMLInputElement;

      // Debug logs removed

      if (selectElement && selectElement.value) {
        // Debug log removed
        const currentBpConfig = finalMap[activeBp] || { ...currentConfig };
        finalMap[activeBp] = {
          ...currentBpConfig,
          object_fit: selectElement.value as ObjectFitValue,
          custom: true
        };
        // Debug log removed
      }

      if (posXInput) {
        // Fallback a currentConfig si finalMap[activeBp] es undefined para evitar TS error por spread de undefined
        const existing = finalMap[activeBp] || currentConfig;
        finalMap[activeBp] = { ...existing, position_x: parseInt(posXInput.value) || 0 };
      }
      if (posYInput) {
        const existing = finalMap[activeBp] || currentConfig;
        finalMap[activeBp] = { ...existing, position_y: parseInt(posYInput.value) || 0 };
      }

      // Debug logs removed

      const updatedApariencia = {
        ...apariencia,
        responsive_imagen: finalMap,
        fondo_tipo: 'imagen'
      };
      // Debug log removed
      onSave(updatedApariencia);
    } catch (error) {
      console.error('🔴 ERROR in handleApplyChanges:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full flex flex-col xl:flex-row gap-8 items-start">
      
      {/* SIDEBAR: HERRAMIENTAS Y BREAKPOINTS */}
      <div className="w-full xl:w-[350px] flex-shrink-0 flex flex-col gap-6">
        
        {/* 1. VISUALIZAR DISPOSITIVO */}
        <div className="bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border p-5 rounded-3xl shadow-apple-sm flex flex-col gap-4">
          <h4 className="text-[11px] font-bold text-apple-text-secondary uppercase tracking-widest flex items-center justify-between">
            Visualizar Dispositivo
            <button
              type="button"
              onClick={handleRestoreBreakpoint}
              disabled={!isCustomized}
              className="text-amber-500 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-amber-500 transition-colors"
              title="Restaurar para heredar automáticamente de la resolución superior"
            >
              <RotateCcw size={14} />
            </button>
          </h4>
          
          <div className="space-y-4">
            
            {/* HORIZONTALES */}
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold text-apple-blue uppercase pl-1 border-l-2 border-apple-blue">Pantallas Horizontales (Anchas)</h5>
              <div className="grid grid-cols-2 gap-2">
                {BREAKPOINTS_LIST.filter(bp => BREAKPOINT_GROUPS.HORIZONTAL.includes(bp.key)).map((bp) => {
                  const isActive = bp.key === activeBp;
                  const isCustom = !!responsiveMap[bp.key]?.custom;
                  return (
                    <button
                      key={bp.key}
                      type="button"
                      onClick={() => setActiveBp(bp.key)}
                      className={`relative flex flex-col items-start gap-1 p-3 rounded-2xl text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-apple-blue text-white border-apple-blue shadow-apple-sm z-10'
                          : 'bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary text-apple-text-secondary border-apple-border dark:border-apple-dark-border hover:border-apple-blue/50 hover:text-apple-text'
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span>{bp.icon}</span>
                        <span className="truncate">{bp.label}</span>
                      </div>
                      <span className={`text-[9px] font-mono opacity-80 ${isActive ? 'text-white/80' : ''}`}>
                        {bp.maxWidth ? `${bp.minWidth}-${bp.maxWidth}` : `+${bp.minWidth}`}
                      </span>
                      {/* Badge Indicador Custom */}
                      <span
                        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                          isCustom ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* VERTICALES */}
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold text-emerald-500 uppercase pl-1 border-l-2 border-emerald-500">Pantallas Verticales (Angostas)</h5>
              <div className="grid grid-cols-2 gap-2">
                {BREAKPOINTS_LIST.filter(bp => BREAKPOINT_GROUPS.VERTICAL.includes(bp.key)).map((bp) => {
                  const isActive = bp.key === activeBp;
                  const isCustom = !!responsiveMap[bp.key]?.custom;
                  return (
                    <button
                      key={bp.key}
                      type="button"
                      onClick={() => setActiveBp(bp.key)}
                      className={`relative flex flex-col items-start gap-1 p-3 rounded-2xl text-xs font-bold transition-all border ${
                        isActive
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-apple-sm z-10'
                          : 'bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary text-apple-text-secondary border-apple-border dark:border-apple-dark-border hover:border-emerald-500/50 hover:text-apple-text'
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span>{bp.icon}</span>
                        <span className="truncate">{bp.label}</span>
                      </div>
                      <span className={`text-[9px] font-mono opacity-80 ${isActive ? 'text-white/80' : ''}`}>
                        {bp.maxWidth ? `${bp.minWidth}-${bp.maxWidth}` : `+${bp.minWidth}`}
                      </span>
                      {/* Badge Indicador Custom */}
                      <span
                        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                          isCustom ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 2. PROPIEDADES DE TRANSFORMACIÓN */}
        <div className="bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border p-5 rounded-3xl shadow-apple-sm flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-apple-text-secondary uppercase tracking-widest">
              Tamaño y Posición
            </h4>
            <button
              type="button"
              onClick={handleCenterImage}
              className="text-apple-blue hover:text-blue-600 font-bold text-[10px] uppercase transition-colors"
            >
              Centrar
            </button>
          </div>

          {/* Slider de Escala */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-apple-text-secondary">Tamaño (Zoom)</span>
              <span className="text-apple-blue font-mono">{currentConfig.scale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={currentConfig.scale}
              onChange={(e) => updateActiveConfig({ scale: parseFloat(e.target.value) })}
              className="w-full accent-apple-blue bg-apple-border dark:bg-apple-dark-border h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Modo de Ajuste */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-apple-text-secondary">Acomodo de Imagen</label>
            <select
              name="object-fit"
              data-testid="object-fit-select"
              value={currentConfig.object_fit}
              onChange={(e) => {
                // Debug log removed
                updateActiveConfig({ object_fit: e.target.value as ObjectFitValue });
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-apple-text dark:text-apple-dark-text text-xs font-bold outline-none focus:border-apple-blue cursor-pointer"
            >
              <option value="cover">Cubrir Todo (Cover)</option>
              <option value="contain">Contener (Contain)</option>
              <option value="fill">Estirar (Fill)</option>
              <option value="none">Original (None)</option>
            </select>
          </div>

          {/* Entradas manuales X e Y */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-apple-text-secondary uppercase">Posición X</label>
              <input
                type="number"
                data-testid="position-x"
                value={currentConfig.position_x}
                onChange={(e) => updateActiveConfig({ position_x: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-apple-text dark:text-apple-dark-text text-xs font-bold font-mono outline-none focus:border-apple-blue"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-apple-text-secondary uppercase">Posición Y</label>
              <input
                type="number"
                data-testid="position-y"
                value={currentConfig.position_y}
                onChange={(e) => updateActiveConfig({ position_y: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-apple-text dark:text-apple-dark-text text-xs font-bold font-mono outline-none focus:border-apple-blue"
              />
            </div>
          </div>
        </div>

        {/* 3. HERRAMIENTAS AVANZADAS */}
        <div className="bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border p-5 rounded-3xl shadow-apple-sm flex flex-col gap-6">
          <h4 className="text-[11px] font-bold text-apple-text-secondary uppercase tracking-widest">
            Avanzado
          </h4>

          {/* Opacidad */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-apple-text-secondary">Opacidad</span>
              <span className="text-emerald-500 font-mono">{currentConfig.opacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={currentConfig.opacity}
              onChange={(e) => updateActiveConfig({ opacity: parseInt(e.target.value) || 0 })}
              className="w-full accent-emerald-500 bg-apple-border dark:bg-apple-dark-border h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Border Radius */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-apple-text-secondary">Bordes Redondeados</span>
              <span className="text-apple-blue font-mono">{currentConfig.border_radius}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={currentConfig.border_radius}
              onChange={(e) => updateActiveConfig({ border_radius: parseInt(e.target.value) || 0 })}
              className="w-full accent-apple-blue bg-apple-border dark:bg-apple-dark-border h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* SIDEBAR SAVE BUTTON (redundancy for E2E tests) */}
        <div className="pt-4 border-t border-apple-border dark:border-apple-dark-border mt-2">
          <button
            type="button"
            onClick={handleApplyChanges}
            data-testid="save-responsive-config-sidebar"
            className="w-full px-4 py-3 rounded-xl bg-apple-blue text-white text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all shadow-apple-sm flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Guardar Configuración
          </button>
        </div>
      </div>

      {/* MAIN AREA: CANVAS */}
      <div className="flex-1 flex flex-col w-full min-w-0 gap-6">
        
        {/* HEADER DEL LIENZO */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border px-5 py-4 rounded-3xl shadow-apple-sm gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">{activeBpMeta.icon}</span>
            <div>
              <h3 className="text-sm font-bold text-apple-text dark:text-apple-dark-text">Vista Previa: {activeBpMeta.label}</h3>
              <p className="text-[10px] text-apple-text-secondary font-mono">{activeBpMeta.defaultW} x {activeBpMeta.defaultH} px</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border-r border-apple-border dark:border-apple-dark-border pr-4">
              <label className="flex items-center gap-1.5 text-apple-text-secondary cursor-pointer text-xs font-bold hover:text-apple-blue transition-colors">
                <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} className="rounded border-apple-border text-apple-blue focus:ring-0 cursor-pointer" />
                Guías
              </label>
              <label className="flex items-center gap-1.5 text-apple-text-secondary cursor-pointer text-xs font-bold hover:text-apple-blue transition-colors">
                <input type="checkbox" checked={showRules} onChange={(e) => setShowRules(e.target.checked)} className="rounded border-apple-border text-apple-blue focus:ring-0 cursor-pointer" />
                Tercios
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 text-apple-text-secondary hover:text-apple-text disabled:opacity-30" title="Deshacer"><RotateCcw size={16} /></button>
              <button onClick={handleCopyConfig} className="p-2 text-apple-text-secondary hover:text-apple-blue" title="Copiar configuración">{copySuccess ? <ClipboardCheck size={16} className="text-emerald-500" /> : <Copy size={16} />}</button>
              <button onClick={handlePasteConfig} disabled={!copiedConfig} className="p-2 text-apple-text-secondary hover:text-apple-blue disabled:opacity-30" title="Pegar configuración"><Layers size={16} /></button>
            </div>

            {/* SAVE & CANCEL BUTTONS */}
            <div className="flex items-center gap-2 border-l border-apple-border dark:border-apple-dark-border pl-4">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-lg bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border text-apple-text dark:text-apple-dark-text text-xs font-bold hover:bg-apple-bg-tertiary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyChanges}
                data-testid="save-responsive-config"
                className="px-3 py-2 rounded-lg bg-apple-blue text-white text-xs font-bold hover:bg-blue-600 active:scale-95 transition-all shadow-apple-sm flex items-center gap-1.5"
              >
                <Check size={14} />
                Guardar
              </button>
            </div>
          </div>
        </div>

        {/* CONTENEDOR DEL LIENZO INTERACTIVO */}
        <div 
          ref={canvasContainerRef}
          className="relative w-full flex justify-center items-center p-6 bg-[#E5E7EB] dark:bg-[#111111] border border-apple-border dark:border-apple-dark-border rounded-3xl overflow-hidden min-h-[500px] shadow-inner"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.02) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.02)), repeating-linear-gradient(45deg, rgba(0,0,0,0.02) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.02) 75%, rgba(0,0,0,0.02))',
            backgroundPosition: '0 0, 10px 10px',
            backgroundSize: '20px 20px',
          }}
        >
          {/* Marco de resolución activa */}
          <div
            className="relative flex-shrink-0 bg-white dark:bg-black border border-apple-border dark:border-apple-dark-border shadow-2xl overflow-hidden flex items-center justify-center origin-center transition-transform duration-200"
            style={{
              width: `${activeBpMeta.defaultW}px`,
              height: `${activeBpMeta.defaultH}px`,
              transform: `scale(${scaleFactor})`,
            }}
          >
            {/* Guías y Tercios */}
            {showGuides && (
              <div className="absolute inset-0 pointer-events-none z-30">
                <div className={`absolute inset-x-0 top-1/2 h-[1px] border-t border-dashed transition-all ${snapActive.y ? 'border-pink-500 opacity-100 border-solid' : 'border-pink-500/30 opacity-40'}`} />
                <div className={`absolute inset-y-0 left-1/2 w-[1px] border-l border-dashed transition-all ${snapActive.x ? 'border-pink-500 opacity-100 border-solid' : 'border-pink-500/30 opacity-40'}`} />
              </div>
            )}
            {showRules && (
              <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between">
                <div className="absolute top-1/3 left-0 right-0 h-[1px] bg-black/10 dark:bg-white/10" />
                <div className="absolute top-2/3 left-0 right-0 h-[1px] bg-black/10 dark:bg-white/10" />
                <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-black/10 dark:bg-white/10" />
                <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-black/10 dark:bg-white/10" />
              </div>
            )}

            {/* IMAGEN DE CONFIGURACIÓN INTERACTIVA */}
            {activeImageUrl ? (
              <div
                className="absolute select-none cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-apple-blue/50 rounded-lg transition-all group"
                style={{
                  width: `${currentConfig.width}px`,
                  height: `${currentConfig.height}px`,
                  transform: `translate3d(${currentConfig.position_x}px, ${currentConfig.position_y}px, 0px) scale(${currentConfig.scale}) rotate(${currentConfig.rotation}deg)`,
                  transformOrigin: 'center center',
                  zIndex: currentConfig.z_index,
                  opacity: currentConfig.opacity / 100,
                  borderRadius: `${currentConfig.border_radius}px`,
                }}
                onMouseDown={handleMouseDownImage}
                onTouchStart={handleMouseDownImage}
              >
                <img
                  src={activeImageUrl}
                  alt="Fondo interactivo"
                  className="w-full h-full pointer-events-none max-w-none"
                  style={{
                    objectFit: currentConfig.object_fit,
                    borderRadius: `${currentConfig.border_radius}px`,
                  }}
                />

                {/* MANIJA DE REDIMENSIONAMIENTO */}
                <div
                  className="absolute bottom-[-8px] right-[-8px] w-5 h-5 bg-apple-blue border-2 border-white rounded-full cursor-nwse-resize shadow-lg z-50 flex items-center justify-center hover:scale-125 transition-transform opacity-0 group-hover:opacity-100"
                  onMouseDown={handleMouseDownResize}
                  onTouchStart={handleMouseDownResize}
                >
                  <Maximize2 size={10} className="text-white" />
                </div>
              </div>
            ) : (
              <div className="text-black/30 dark:text-white/30 text-xs font-bold">Sin imagen cargada</div>
            )}
          </div>
        </div>

        {/* BARRA DE MÉTRICAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border p-4 rounded-3xl font-mono text-[11px]">
          <div className="flex flex-col items-center">
            <span className="text-apple-text-secondary uppercase font-sans font-bold">Zoom</span>
            <span className="text-apple-blue font-bold">{currentConfig.scale.toFixed(2)}x</span>
          </div>
          <div className="flex flex-col items-center border-l border-apple-border dark:border-apple-dark-border">
            <span className="text-apple-text-secondary uppercase font-sans font-bold">Posición X</span>
            <span className="text-apple-text font-bold">{currentConfig.position_x}px</span>
          </div>
          <div className="flex flex-col items-center border-l border-apple-border dark:border-apple-dark-border">
            <span className="text-apple-text-secondary uppercase font-sans font-bold">Posición Y</span>
            <span className="text-apple-text font-bold">{currentConfig.position_y}px</span>
          </div>
          <div className="flex flex-col items-center border-l border-apple-border dark:border-apple-dark-border">
            <span className="text-apple-text-secondary uppercase font-sans font-bold">Rotación</span>
            <span className="text-apple-text font-bold">{currentConfig.rotation}°</span>
          </div>
        </div>
      </div>
    </div>
  );
};
