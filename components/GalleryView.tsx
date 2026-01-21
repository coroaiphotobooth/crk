import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Trash2, Copy, Calendar, Monitor, Maximize2, FlaskConical, RefreshCw, CloudOff, AlertTriangle, FolderPlus, Folder, Filter, X, Plus, ArrowLeft, LayoutGrid, Image as ImageIcon, FolderOpen, Pencil, Loader2 } from 'lucide-react';
import { GalleryItem, AspectRatio, ModelChoice } from '../types';
import { getGalleryItems, deleteGalleryItem, saveGalleryItem } from '../services/storageService';
import { MODEL_LABELS, RATIO_LABELS } from '../constants';

interface GalleryViewProps {
  onCopyToast: (msg: string) => void;
  onNavigateToSample: (data: { prompt: string; aspectRatio: AspectRatio; modelChoice: ModelChoice }) => void;
  items: GalleryItem[];
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>;
  isLoaded: boolean;
  setIsLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  availableGroups: string[];
  onAddGroup: (name: string) => void;
  onDeleteGroup: (name: string) => void;
}

// Helper untuk batch processing agar tidak spam request sekaligus
const processInBatches = async <T,>(items: T[], batchSize: number, fn: (item: T) => Promise<void>) => {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(fn));
    }
};

const DeleteButton = ({ id, onDelete }: { id: string, onDelete: (id: string) => void }) => {
    const [step, setStep] = useState<'idle' | 'confirm'>('idle');

    useEffect(() => {
        if (step === 'confirm') {
            const timer = setTimeout(() => setStep('idle'), 3000);
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
            {step === 'confirm' ? <><AlertTriangle size={10} /> Yakin?</> : <><Trash2 size={10} /> Hapus</>}
        </button>
    );
};

const GalleryView: React.FC<GalleryViewProps> = ({ 
    onCopyToast, 
    onNavigateToSample,
    items,
    setItems,
    isLoaded,
    setIsLoaded,
    availableGroups,
    onAddGroup,
    onDeleteGroup
}) => {
  // --- STATE ---
  const [loading, setLoading] = useState(!isLoaded);
  const [processingMsg, setProcessingMsg] = useState<string | null>(null); // Untuk Rename/Delete Folder process
  
  // View Modes
  const [activeTab, setActiveTab] = useState<'main' | 'all'>('main');
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  // Progressive Rendering State
  // Kita mulai dengan menampilkan sedikit item, lalu bertambah seiring waktu
  const [visibleLimit, setVisibleLimit] = useState(12);

  // Modals
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [groupToRename, setGroupToRename] = useState<{old: string, new: string} | null>(null);
  const [itemToMove, setItemToMove] = useState<GalleryItem | null>(null);

  const [newGroupName, setNewGroupName] = useState('');

  // --- PROGRESSIVE LOADING EFFECT ---
  // Setiap kali items berubah atau tab berubah, reset limit lalu naikkan perlahan
  useEffect(() => {
      setVisibleLimit(12);
  }, [items, activeTab, openFolder]);

  useEffect(() => {
      // Jika masih ada item yang belum tampil, tambahkan limit setiap 50ms
      // Ini menciptakan efek "muncul satu per satu" tanpa memblokir UI browser
      const totalItems = activeTab === 'all' 
          ? items.length 
          : (openFolder ? items.filter(i => (openFolder === '__uncategorized__' ? !i.group : i.group === openFolder)).length : 0);

      if (visibleLimit < totalItems) {
          const timer = setTimeout(() => {
              setVisibleLimit(prev => prev + 8); 
          }, 50);
          return () => clearTimeout(timer);
      }
  }, [visibleLimit, items, activeTab, openFolder]);


  // --- DATA LOADING ---
  const loadItems = useCallback(async (force = false) => {
    if (isLoaded && !force) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      const galleryData = await getGalleryItems();
      const sorted = galleryData.sort((a, b) => b.createdAt - a.createdAt);
      setItems(sorted);
      setIsLoaded(true);
    } catch (e) {
      console.error("Failed loading gallery", e);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, setItems, setIsLoaded]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // --- ACTIONS ---
  const handleDeleteItem = async (id: string) => {
    const originalItems = [...items];
    setItems(prev => prev.filter(item => item.id !== id));
    onCopyToast("Menghapus item...");

    try {
        await deleteGalleryItem(id);
    } catch (err: any) {
        console.error("Gagal menghapus:", err);
        setItems(originalItems);
        alert("Gagal menghapus dari server. Data dikembalikan.");
    }
  };

  const handleCreateGroup = () => {
      if(newGroupName.trim()) {
          onAddGroup(newGroupName.trim());
          setNewGroupName('');
          setShowAddGroupModal(false);
      }
  };

  const handleRenameFolderInit = (oldName: string) => {
      setGroupToRename({ old: oldName, new: oldName });
      setShowRenameGroupModal(true);
  };

  const handleRenameFolderConfirm = async () => {
      if (!groupToRename || !groupToRename.new.trim() || groupToRename.old === groupToRename.new) {
          setShowRenameGroupModal(false);
          return;
      }

      const oldName = groupToRename.old;
      const newName = groupToRename.new.trim();
      const itemsToUpdate = items.filter(i => i.group === oldName);

      setShowRenameGroupModal(false);
      setProcessingMsg(`Memindahkan ${itemsToUpdate.length} foto ke folder baru...`);

      try {
          // 1. Tambah Group Baru ke Local Storage (via App logic passed as prop logic simulasi)
          onAddGroup(newName);
          
          // 2. Optimistic Update UI
          setItems(prev => prev.map(i => i.group === oldName ? { ...i, group: newName } : i));

          // 3. Hapus Group Lama dari Local Storage
          onDeleteGroup(oldName);

          // 4. Update Server (Batch processing)
          // Kita harus save ulang setiap item dengan nama group baru
          await processInBatches(itemsToUpdate, 3, async (item) => {
              await saveGalleryItem({ ...item, group: newName });
          });

          onCopyToast(`Berhasil mengubah nama folder menjadi "${newName}"`);
      } catch (e) {
          console.error(e);
          alert("Terjadi kesalahan saat menyimpan perubahan ke server. Refresh halaman untuk sinkronisasi.");
      } finally {
          setProcessingMsg(null);
      }
  };

  const handleDeleteFolderDeep = async (groupName: string) => {
      const itemsToDelete = items.filter(i => i.group === groupName);
      
      if (!confirm(`PERINGATAN KERAS:\nAnda akan menghapus folder "${groupName}".\n\n${itemsToDelete.length} foto di dalamnya AKAN IKUT TERHAPUS PERMANEN.\n\nLanjutkan?`)) {
          return;
      }

      setProcessingMsg(`Menghapus ${itemsToDelete.length} foto dari server...`);

      try {
          // 1. Optimistic Update UI
          setItems(prev => prev.filter(i => i.group !== groupName));
          onDeleteGroup(groupName);

          // 2. Delete from Server (Batch processing)
          await processInBatches(itemsToDelete, 5, async (item) => {
              await deleteGalleryItem(item.id);
          });

          onCopyToast(`Folder "${groupName}" dan isinya telah dihapus.`);
      } catch (e) {
          console.error(e);
          alert("Gagal menghapus sebagian data dari server.");
      } finally {
          setProcessingMsg(null);
      }
  };

  const handleMoveItem = async (targetGroup: string) => {
      if (!itemToMove) return;
      const updatedItem = { ...itemToMove, group: targetGroup === '' ? undefined : targetGroup };
      setItems(prev => prev.map(i => i.id === itemToMove.id ? updatedItem : i));
      setItemToMove(null);
      onCopyToast("Memindahkan item...");
      try {
          await saveGalleryItem(updatedItem);
          onCopyToast("Item berhasil dipindahkan!");
      } catch (err) {
          console.error("Move failed:", err);
          alert("Gagal memindahkan di server.");
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

  // --- HELPERS ---
  const getAspectRatioClass = (ratio: AspectRatio) => {
    switch (ratio) {
      case AspectRatio.PORTRAIT: return 'aspect-[9/16]';
      case AspectRatio.LANDSCAPE: return 'aspect-[16/9]';
      case AspectRatio.PRINT_PORTRAIT: return 'aspect-[3/4]';
      case AspectRatio.PRINT_LANDSCAPE: return 'aspect-[4/3]';
      default: return 'aspect-square';
    }
  };

  const safeModelLabel = (model: ModelChoice) => {
      const label = MODEL_LABELS[model];
      return label ? label.replace('Gemini ', '') : "Unknown";
  };

  // --- RENDER LOGIC ---

  // 1. ITEMS GRID COMPONENT (Reusable)
  const ItemsGrid = ({ displayItems }: { displayItems: GalleryItem[] }) => {
      if (displayItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 opacity-60">
                 <CloudOff size={48} className="mb-2"/>
                 <p className="text-sm">Tidak ada foto</p>
            </div>
        );
      }

      // PROGRESSIVE SLICE
      const visibleItems = displayItems.slice(0, visibleLimit);

      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20">
            {visibleItems.map((item, index) => (
                <div 
                    key={item.id} 
                    className="bg-cyber-800/50 backdrop-blur-md border border-cyber-700/50 rounded-lg overflow-hidden flex flex-col group hover:border-cyber-500/50 transition-all hover:shadow-lg hover:shadow-cyber-500/10 h-full relative animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
                    style={{ animationDelay: `${(index % 12) * 50}ms` }} // Staggered animation effect
                >
                    <div className={`relative w-full ${getAspectRatioClass(item.aspectRatio)} bg-black overflow-hidden border-b border-cyber-700/30`}>
                        <img 
                            src={item.resultDataUrl} 
                            alt={item.title || "Concept"} 
                            loading="lazy"
                            className="w-full h-full object-contain bg-black/50 transition-opacity duration-300"
                            onLoad={(e) => e.currentTarget.classList.add('opacity-100')}
                        />
                        {/* Actions Overlay */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                            <button 
                                onClick={() => setItemToMove(item)}
                                className="p-1.5 bg-cyber-600/80 rounded-md text-white hover:bg-cyber-500 border border-cyber-400/30 backdrop-blur-md transition-all shadow-lg"
                                title="Pindahkan Group"
                            >
                                <FolderPlus size={14} />
                            </button>
                            <button 
                                onClick={() => onNavigateToSample({ prompt: item.prompt, aspectRatio: item.aspectRatio, modelChoice: item.modelChoice })}
                                className="p-1.5 bg-cyber-600/80 rounded-md text-white hover:bg-cyber-500 border border-cyber-400/30 backdrop-blur-md transition-all shadow-lg"
                                title="Buat Sample"
                            >
                                <FlaskConical size={14} />
                            </button>
                            <button 
                                onClick={() => openImage(item.resultDataUrl)}
                                className="p-1.5 bg-black/60 rounded-md text-cyber-400 hover:text-white hover:bg-cyber-600 border border-white/10 backdrop-blur-md transition-all shadow-lg"
                                title="Fullscreen"
                            >
                                <Maximize2 size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="p-2.5 flex flex-col flex-1 gap-2">
                         <div>
                            <h3 className="font-bold text-white text-xs sm:text-sm leading-tight truncate">{item.title || "Untitled"}</h3>
                            <div className="flex items-center gap-2 text-[9px] text-cyber-300 mt-1 font-mono opacity-80">
                                <span className="truncate"><Monitor size={8} className="inline mr-1"/>{safeModelLabel(item.modelChoice)}</span>
                            </div>
                         </div>
                         <div className="bg-cyber-900/40 p-2 rounded border border-cyber-700/30 flex-1">
                            <p className="text-[10px] text-slate-300 italic line-clamp-2">"{item.prompt}"</p>
                         </div>
                         <div className="grid grid-cols-2 gap-1.5 mt-auto">
                            <button onClick={(e) => handleCopyPrompt(e, item.prompt)} className="py-1.5 px-2 rounded bg-cyber-700/30 text-cyber-300 border border-cyber-700/50 hover:bg-cyber-500/20 hover:text-white flex items-center justify-center gap-1.5 text-[10px] font-medium"><Copy size={10} /> Copy</button>
                            <DeleteButton id={item.id} onDelete={handleDeleteItem} />
                         </div>
                    </div>
                </div>
            ))}
            {/* Show loading indicator at bottom if more items exist */}
            {visibleLimit < displayItems.length && (
                 <div className="col-span-full flex justify-center py-4">
                     <Loader2 size={24} className="text-cyber-500 animate-spin opacity-50" />
                 </div>
            )}
        </div>
      );
  };

  // 2. FOLDER GRID VIEW
  const renderFolderGrid = () => {
      const uncategorizedItems = items.filter(i => !i.group);
      const uncategorizedCount = uncategorizedItems.length;
      const uncategorizedPreview = uncategorizedItems.length > 0 ? uncategorizedItems[0].resultDataUrl : null;

      return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 pt-4">
               {/* Create New Folder Card */}
               <button 
                  onClick={() => setShowAddGroupModal(true)}
                  className="aspect-[4/3] rounded-xl border-2 border-dashed border-cyber-700/50 hover:border-cyber-500 hover:bg-cyber-900/30 transition-all flex flex-col items-center justify-center gap-2 group text-slate-500 hover:text-cyber-400"
               >
                   <div className="p-3 rounded-full bg-cyber-900 border border-cyber-700 group-hover:border-cyber-500 transition-colors">
                       <Plus size={24} />
                   </div>
                   <span className="text-xs font-bold uppercase tracking-widest">Buat Folder</span>
               </button>

               {/* Render User Folders */}
               {availableGroups.map(group => {
                   const groupItems = items.filter(i => i.group === group);
                   const count = groupItems.length;
                   const previewImage = groupItems.length > 0 ? groupItems[0].resultDataUrl : null;

                   return (
                       <div 
                          key={group} 
                          onClick={() => setOpenFolder(group)}
                          className="relative aspect-[4/3] rounded-xl border border-cyber-700 bg-cyber-800/50 overflow-hidden cursor-pointer group hover:border-cyber-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all animate-in fade-in zoom-in-95 duration-300"
                       >
                           {/* Preview Image Background */}
                           {previewImage ? (
                               <img src={previewImage} alt={group} loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500" />
                           ) : (
                               <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                   <Folder size={48} className="text-slate-400"/>
                               </div>
                           )}
                           
                           {/* Gradient Overlay */}
                           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                           {/* Content */}
                           <div className="absolute bottom-0 left-0 right-0 p-4">
                               <div className="flex items-center justify-between mb-1">
                                   <h3 className="text-white font-bold text-lg truncate flex items-center gap-2">
                                       <FolderOpen size={18} className="text-cyber-500" />
                                       {group}
                                   </h3>
                               </div>
                               <p className="text-xs text-slate-300 font-mono flex items-center gap-2">
                                   <span className="bg-cyber-900/80 px-2 py-0.5 rounded text-cyber-400 border border-cyber-500/30">
                                       {count} items
                                   </span>
                               </p>
                           </div>

                           {/* Folder Actions (Top Right) */}
                           <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                               <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameFolderInit(group);
                                  }}
                                  className="p-1.5 rounded-lg bg-black/60 text-slate-400 hover:text-white hover:bg-cyber-600 border border-white/10 transition-colors"
                                  title="Ganti Nama Folder"
                               >
                                   <Pencil size={14} />
                               </button>
                               <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteFolderDeep(group);
                                  }}
                                  className="p-1.5 rounded-lg bg-black/60 text-slate-400 hover:text-red-400 hover:bg-red-950 border border-white/10 transition-colors"
                                  title="Hapus Folder & Isinya"
                               >
                                   <Trash2 size={14} />
                               </button>
                           </div>
                       </div>
                   )
               })}

               {/* Uncategorized Folder */}
               {uncategorizedCount > 0 && (
                   <div 
                      onClick={() => setOpenFolder('__uncategorized__')}
                      className="relative aspect-[4/3] rounded-xl border border-dashed border-slate-700 bg-slate-900/30 overflow-hidden cursor-pointer group hover:border-slate-500 transition-all animate-in fade-in zoom-in-95 duration-300"
                   >
                        {uncategorizedPreview ? (
                            <img src={uncategorizedPreview} alt="Uncategorized" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500 grayscale group-hover:grayscale-0" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                <CloudOff size={64} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                        <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="text-slate-400 font-bold text-lg flex items-center gap-2">
                                <Filter size={18} /> Uncategorized
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">{uncategorizedCount} items</p>
                        </div>
                   </div>
               )}
          </div>
      );
  };

  // --- MAIN RENDER ---
  return (
    <div className="h-full overflow-hidden flex flex-col relative">
      
      {/* PROCESSING OVERLAY */}
      {processingMsg && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in duration-200">
              <Loader2 size={48} className="text-cyber-500 animate-spin mb-4" />
              <h3 className="text-lg font-bold">Sedang Memproses...</h3>
              <p className="text-sm text-cyber-400">{processingMsg}</p>
          </div>
      )}

      {/* 1. TOP TABS */}
      <div className="flex-none pb-4 border-b border-cyber-700/30 mb-4">
          <div className="flex items-center gap-4">
              <button 
                 onClick={() => { setActiveTab('main'); setOpenFolder(null); }}
                 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider pb-1 transition-all border-b-2
                    ${activeTab === 'main' 
                        ? 'text-cyber-400 border-cyber-500' 
                        : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                  <FolderOpen size={16} /> Main Page
              </button>
              <button 
                 onClick={() => { setActiveTab('all'); setOpenFolder(null); }}
                 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider pb-1 transition-all border-b-2
                    ${activeTab === 'all' 
                        ? 'text-cyber-400 border-cyber-500' 
                        : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                  <LayoutGrid size={16} /> All Photos
              </button>

              <div className="ml-auto">
                 <button 
                    onClick={() => loadItems(true)} 
                    className="p-1.5 text-slate-500 hover:text-cyber-400 transition-colors"
                    title="Refresh Data"
                 >
                     <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                 </button>
              </div>
          </div>
      </div>

      {/* 2. CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative">
        {loading ? (
             <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-3">
                <div className="animate-spin w-8 h-8 border-2 border-cyber-500 border-t-transparent rounded-full"></div>
                <p className="text-xs text-cyber-400 animate-pulse">Memuat Data...</p>
             </div>
        ) : (
             <>
                {activeTab === 'main' && !openFolder && renderFolderGrid()}

                {activeTab === 'main' && openFolder && (
                    <div className="animate-in slide-in-from-right-5 fade-in duration-300">
                        <div className="flex items-center gap-3 mb-4 sticky top-0 bg-cyber-900/90 z-20 py-2 backdrop-blur-sm border-b border-cyber-700/30">
                            <button 
                                onClick={() => setOpenFolder(null)}
                                className="p-2 rounded-full hover:bg-cyber-800 text-cyber-400 transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FolderOpen size={20} className="text-cyber-500" />
                                    {openFolder === '__uncategorized__' ? 'Uncategorized' : openFolder}
                                </h2>
                                <p className="text-[10px] text-slate-400">
                                    Folder Gallery View
                                </p>
                            </div>
                        </div>
                        <ItemsGrid 
                            displayItems={
                                openFolder === '__uncategorized__' 
                                ? items.filter(i => !i.group) 
                                : items.filter(i => i.group === openFolder)
                            } 
                        />
                    </div>
                )}

                {activeTab === 'all' && (
                    <ItemsGrid displayItems={items} />
                )}
             </>
        )}
      </div>

      {/* MODAL CREATE GROUP */}
      {showAddGroupModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-4 w-full max-w-xs shadow-2xl">
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                        <FolderPlus size={16} className="text-cyber-500"/> Buat Group Baru
                    </h3>
                    <input 
                        type="text" 
                        autoFocus
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Nama Group..."
                        className="w-full bg-cyber-800 border border-cyber-700 rounded-lg p-2 text-sm text-white focus:border-cyber-500 outline-none mb-3"
                    />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddGroupModal(false)} className="px-3 py-1.5 rounded text-xs text-slate-400">Batal</button>
                        <button onClick={handleCreateGroup} className="px-4 py-1.5 rounded text-xs bg-cyber-500 text-white font-bold">
                            Buat
                        </button>
                    </div>
               </div>
          </div>
      )}

      {/* MODAL RENAME GROUP */}
      {showRenameGroupModal && groupToRename && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-4 w-full max-w-xs shadow-2xl">
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                        <Pencil size={16} className="text-cyber-500"/> Ganti Nama Folder
                    </h3>
                    <div className="mb-3 text-xs text-slate-400 bg-cyber-900/50 p-2 rounded border border-cyber-700/50">
                        Proses ini akan mengubah nama group pada semua foto di dalamnya.
                    </div>
                    <input 
                        type="text" 
                        autoFocus
                        value={groupToRename.new}
                        onChange={(e) => setGroupToRename({...groupToRename, new: e.target.value})}
                        placeholder="Nama Baru..."
                        className="w-full bg-cyber-800 border border-cyber-700 rounded-lg p-2 text-sm text-white focus:border-cyber-500 outline-none mb-3"
                    />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowRenameGroupModal(false)} className="px-3 py-1.5 rounded text-xs text-slate-400">Batal</button>
                        <button onClick={handleRenameFolderConfirm} className="px-4 py-1.5 rounded text-xs bg-cyber-500 text-white font-bold">
                            Simpan Perubahan
                        </button>
                    </div>
               </div>
          </div>
      )}

      {/* MODAL MOVE ITEM */}
      {itemToMove && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-4 w-full max-w-xs shadow-2xl">
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2 truncate">
                        <Folder size={16} className="text-cyber-500"/> Pindahkan Item
                    </h3>
                    <p className="text-[10px] text-slate-400 mb-3 truncate">"{itemToMove.title}"</p>
                    
                    <div className="space-y-1 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                         <button 
                            onClick={() => handleMoveItem('')}
                            className={`w-full text-left px-3 py-2 rounded text-xs hover:bg-cyber-800 flex items-center gap-2
                                ${!itemToMove.group ? 'text-cyber-400 font-bold bg-cyber-900' : 'text-slate-300'}`}
                         >
                             <CloudOff size={12}/> Tanpa Group
                         </button>
                         {availableGroups.map(g => (
                             <button 
                                key={g}
                                onClick={() => handleMoveItem(g)}
                                className={`w-full text-left px-3 py-2 rounded text-xs hover:bg-cyber-800 flex items-center gap-2
                                    ${itemToMove.group === g ? 'text-cyber-400 font-bold bg-cyber-900' : 'text-slate-300'}`}
                             >
                                 <Folder size={12}/> {g}
                             </button>
                         ))}
                    </div>

                    <button onClick={() => setItemToMove(null)} className="w-full px-3 py-1.5 rounded text-xs text-slate-400 border border-cyber-800 hover:text-white">Batal</button>
               </div>
          </div>
      )}

    </div>
  );
};

export default GalleryView;