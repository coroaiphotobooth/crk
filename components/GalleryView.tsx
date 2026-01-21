import React, { useEffect, useState, useCallback } from 'react';
import { Trash2, Copy, Calendar, Monitor, Maximize2, FlaskConical, RefreshCw, CloudOff, AlertTriangle } from 'lucide-react';
import { GalleryItem, AspectRatio, ModelChoice } from '../types';
import { getGalleryItems, deleteGalleryItem } from '../services/storageService';
import { MODEL_LABELS, RATIO_LABELS } from '../constants';

interface GalleryViewProps {
  onCopyToast: (msg: string) => void;
  onNavigateToSample: (data: { prompt: string; aspectRatio: AspectRatio; modelChoice: ModelChoice }) => void;
  // Props untuk State Management (Caching)
  items: GalleryItem[];
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>;
  isLoaded: boolean;
  setIsLoaded: React.Dispatch<React.SetStateAction<boolean>>;
}

// Komponen Tombol Delete dengan Konfirmasi Internal
const DeleteButton = ({ id, onDelete }: { id: string, onDelete: (id: string) => void }) => {
    const [step, setStep] = useState<'idle' | 'confirm'>('idle');

    useEffect(() => {
        if (step === 'confirm') {
            const timer = setTimeout(() => setStep('idle'), 3000); // Reset after 3s
            return () => clearTimeout(timer);
        }
    }, [step]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (step === 'idle') {
            setStep('confirm');
        } else {
            onDelete(id);
            setStep('idle');
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`py-1.5 px-2 rounded border transition-all flex items-center justify-center gap-1.5 text-[10px] font-medium w-full
                ${step === 'confirm' 
                    ? 'bg-red-600 text-white border-red-500 animate-pulse' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/80 hover:text-white hover:border-red-500'}`}
        >
            {step === 'confirm' ? (
                <>
                    <AlertTriangle size={10} /> Yakin?
                </>
            ) : (
                <>
                    <Trash2 size={10} /> Hapus
                </>
            )}
        </button>
    );
};

const GalleryView: React.FC<GalleryViewProps> = ({ 
    onCopyToast, 
    onNavigateToSample,
    items,
    setItems,
    isLoaded,
    setIsLoaded
}) => {
  // Local loading state (hanya visual spinner internal)
  const [loading, setLoading] = useState(!isLoaded);

  const loadItems = useCallback(async (force = false) => {
    // Jika sudah loaded dan tidak dipaksa refresh, jangan load ulang
    if (isLoaded && !force) {
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
      const galleryData = await getGalleryItems();
      const sorted = galleryData.sort((a, b) => b.createdAt - a.createdAt);
      setItems(sorted);
      setIsLoaded(true); // Tandai global state sebagai loaded
    } catch (e) {
      console.error("Failed loading gallery", e);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, setItems, setIsLoaded]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDeleteItem = async (id: string) => {
    // --- OPTIMISTIC UI UPDATE ---
    const originalItems = [...items];
    // Update global state via props
    setItems(prev => prev.filter(item => item.id !== id));
    onCopyToast("Menghapus item...");

    try {
        await deleteGalleryItem(id);
    } catch (err: any) {
        console.error("Gagal menghapus:", err);
        setItems(originalItems); // Rollback global state
        alert("Gagal menghapus dari server. Data dikembalikan.\nError: " + (err.message || "Network Error"));
    }
  };

  const handleCopyPrompt = (e: React.MouseEvent, prompt: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt);
    onCopyToast("Prompt berhasil disalin!");
  };

  const openImage = (dataUrl: string) => {
    const win = window.open();
    if (win) {
        win.document.write(`<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body>`);
    }
  };

  const getAspectRatioClass = (ratio: AspectRatio) => {
    switch (ratio) {
      case AspectRatio.PORTRAIT: return 'aspect-[9/16]';
      case AspectRatio.LANDSCAPE: return 'aspect-[16/9]';
      case AspectRatio.PRINT_PORTRAIT: return 'aspect-[3/4]';
      case AspectRatio.PRINT_LANDSCAPE: return 'aspect-[4/3]';
      default: return 'aspect-square';
    }
  };

  const safeRatioLabel = (ratio: AspectRatio) => {
      const label = RATIO_LABELS[ratio];
      return label ? label.split('(')[0].trim() : "Unknown";
  };

  const safeModelLabel = (model: ModelChoice) => {
      const label = MODEL_LABELS[model];
      return label ? label.replace('Gemini ', '') : "Unknown";
  };

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar relative flex flex-col">
      {/* Refresh Button */}
      <div className="absolute top-0 right-2 z-20">
        <button 
            onClick={() => loadItems(true)} // Force Refresh
            className="p-2 bg-cyber-800/80 rounded-full text-cyber-400 hover:text-white hover:bg-cyber-600 transition-all shadow-lg backdrop-blur-sm"
            title="Refresh dari Cloud"
        >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
         <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
            <div className="animate-spin w-8 h-8 border-2 border-cyber-500 border-t-transparent rounded-full"></div>
            <p className="text-xs text-cyber-400 animate-pulse">Menghubungkan ke Database...</p>
         </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-300">
          <div className="w-20 h-20 bg-cyber-800/60 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 shadow-xl">
            <CloudOff size={32} className="text-cyber-500 opacity-50" />
          </div>
          <h3 className="text-lg font-bold text-white drop-shadow-md">Gallery Kosong</h3>
          <p className="mt-1 text-sm bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm text-center max-w-xs mb-4">
             Belum ada konsep tersimpan.
          </p>
          <button onClick={() => loadItems(true)} className="px-3 py-2 text-xs text-cyber-400 underline hover:text-white">
            Coba Refresh
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20 pt-8">
          {items.map((item) => (
            <div key={item.id} className="bg-cyber-800/50 backdrop-blur-md border border-cyber-700/50 rounded-lg overflow-hidden flex flex-col group hover:border-cyber-500/50 transition-all hover:shadow-lg hover:shadow-cyber-500/10 h-full relative">
              <div className={`relative w-full ${getAspectRatioClass(item.aspectRatio)} bg-black overflow-hidden border-b border-cyber-700/30`}>
                 <img 
                   src={item.resultDataUrl} 
                   alt={item.title || "Concept"} 
                   /* object-contain memastikan gambar fit sempurna tanpa terpotong (full visibility) */
                   className="w-full h-full object-contain bg-black/50"
                 />
                 <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                    <button 
                        onClick={() => onNavigateToSample({
                            prompt: item.prompt,
                            aspectRatio: item.aspectRatio,
                            modelChoice: item.modelChoice
                        })}
                        className="p-1.5 bg-cyber-600/80 rounded-md text-white hover:bg-cyber-500 border border-cyber-400/30 backdrop-blur-md transition-all shadow-lg"
                        title="Buat Sample"
                    >
                        <FlaskConical size={14} />
                    </button>
                    <button 
                        onClick={() => openImage(item.resultDataUrl)}
                        className="p-1.5 bg-black/60 rounded-md text-cyber-400 hover:text-white hover:bg-cyber-600 border border-white/10 backdrop-blur-md transition-all shadow-lg"
                        title="Lihat Fullscreen"
                    >
                        <Maximize2 size={14} />
                    </button>
                 </div>
                 <div className="absolute top-2 left-2 pointer-events-none">
                     <span className="text-[8px] font-bold text-white/90 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-sm border border-white/10 shadow-sm">
                        {safeRatioLabel(item.aspectRatio)}
                     </span>
                 </div>
              </div>
              <div className="p-2.5 flex flex-col flex-1 gap-2">
                <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm leading-tight truncate drop-shadow-sm">
                        {item.title || "Untitled"}
                    </h3>
                    <div className="flex items-center gap-2 text-[9px] text-cyber-300 mt-1 font-mono opacity-80">
                        <span className="flex items-center gap-1 truncate">
                            <Monitor size={8} /> {safeModelLabel(item.modelChoice)}
                        </span>
                        <span className="w-0.5 h-0.5 bg-cyber-500 rounded-full"></span>
                        <span className="flex items-center gap-1">
                            <Calendar size={8} /> {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div className="bg-cyber-900/40 p-2 rounded border border-cyber-700/30 flex-1 group/text">
                    <p className="text-[10px] text-slate-300 italic line-clamp-2 group-hover/text:line-clamp-4 transition-all leading-relaxed">
                        "{item.prompt}"
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-auto">
                  <button
                    onClick={(e) => handleCopyPrompt(e, item.prompt)}
                    className="py-1.5 px-2 rounded bg-cyber-700/30 text-cyber-300 border border-cyber-700/50 hover:bg-cyber-500/20 hover:border-cyber-500 hover:text-white transition-all flex items-center justify-center gap-1.5 text-[10px] font-medium"
                  >
                    <Copy size={10} /> Copy
                  </button>
                  {/* Custom Delete Button Component */}
                  <DeleteButton id={item.id} onDelete={handleDeleteItem} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryView;