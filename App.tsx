import React, { useState, useEffect } from 'react';
import { LayoutGrid, PlusSquare, AlertTriangle, CheckCircle, FlaskConical, Lock, User, ArrowRight, Settings, Link as LinkIcon, Save } from 'lucide-react';
import CreateView from './components/CreateView';
import GalleryView from './components/GalleryView';
import SampleView from './components/SampleView';
import { AspectRatio, ModelChoice, GalleryItem } from './types';
import { getApiUrl, setApiUrl } from './services/storageService';

const App = () => {
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App State
  const [activeTab, setActiveTab] = useState<'create' | 'gallery' | 'sample'>('create');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Gallery Cache State (Lifting State Up)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isGalleryLoaded, setIsGalleryLoaded] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');

  // State to pass data
  const [sampleInitData, setSampleInitData] = useState<{
    prompt: string;
    aspectRatio: AspectRatio;
    modelChoice: ModelChoice;
  } | null>(null);

  const BG_IMAGE_URL = "https://lh3.googleusercontent.com/pw/AP1GczPehmtvnU2JsBugCFOC43m8HGhHABCbevbsBgBBJ0Z6KQ9Q278FgJnzycN-xIkTAPOW63-MukGDxAo5boVtc-hg43tr3_Xyg5tJ35Z-6XGQIRmdD89ZuoZRLt-utQ8UPc1ajLDp8JKknzjlutAH6TNlXw=w1850-h1033-s-no-gm?authuser=0";

  useEffect(() => {
      const stored = getApiUrl();
      if (stored) setScriptUrl(stored);
      // Auto open settings if logged in but no URL
      if (isLoggedIn && !stored) {
          setShowSettings(true);
      }
  }, [isLoggedIn]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'coroai' && password === '321654') {
        setIsLoggedIn(true);
        setLoginError('');
    } else {
        setLoginError('Username atau Password salah');
    }
  };

  const saveSettings = () => {
      if (!scriptUrl.includes("script.google.com")) {
          showToast("URL tidak valid. Harus link Google Script.", "error");
          return;
      }
      setApiUrl(scriptUrl);
      setShowSettings(false);
      setIsGalleryLoaded(false); 
      showToast("Koneksi Database Tersimpan!", "success");
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaved = (newItem?: GalleryItem) => {
    if (newItem) {
        setGalleryItems(prev => [newItem, ...prev]);
        // Note: We do NOT set isGalleryLoaded(false) here. 
        // We trust our local update. This prevents a race condition where fetching immediately
        // after saving might return old data if the server is eventually consistent.
    } else {
        setIsGalleryLoaded(false); // Fallback if no item passed
    }
    showToast("Berhasil disimpan ke Cloud Database!", "success");
  };

  const handleNavigateToSample = (data: { prompt: string; aspectRatio: AspectRatio; modelChoice: ModelChoice }) => {
    setSampleInitData(data);
    setActiveTab('sample');
    showToast("Data disalin ke Buat Sample.", "success");
  };

  const handleTabChange = (tab: 'create' | 'gallery' | 'sample') => {
    if (tab === 'sample') setSampleInitData(null); 
    setActiveTab(tab);
  };

  // 1. LOGIN SCREEN
  if (!isLoggedIn) {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-cyber-900 text-white p-4 relative overflow-hidden font-sans">
            <div className="absolute inset-0 z-0">
                <img src={BG_IMAGE_URL} alt="Background" className="w-full h-full object-cover opacity-80"/>
                <div className="absolute inset-0 bg-cyber-900/60 backdrop-blur-sm"></div>
            </div>

            <div className="relative z-10 w-full max-w-sm">
                <div className="bg-cyber-800/60 backdrop-blur-md border border-cyber-500/30 rounded-2xl p-8 shadow-2xl shadow-cyber-500/10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-black tracking-wider text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            <span className="text-cyber-500">COROAI</span> CREATOR
                        </h1>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-cyber-400 mt-2 font-medium opacity-80">
                            creative intelligence studio
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyber-500">
                                    <User size={16} />
                                </div>
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Username"
                                    className="w-full pl-10 pr-4 py-3 bg-cyber-900/50 border border-cyber-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-cyber-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyber-500">
                                    <Lock size={16} />
                                </div>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full pl-10 pr-4 py-3 bg-cyber-900/50 border border-cyber-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-cyber-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {loginError && (
                            <div className="text-red-400 text-xs text-center flex items-center justify-center gap-1 bg-red-900/20 py-2 rounded">
                                <AlertTriangle size={12} /> {loginError}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full py-3 bg-gradient-to-r from-cyber-600 to-cyber-500 hover:from-cyber-500 hover:to-cyber-400 text-white font-bold rounded-lg shadow-lg shadow-cyber-500/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-4 group"
                        >
                            LOGIN
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
  }

  // 2. MAIN APP SCREEN
  return (
    <div className="h-screen w-screen overflow-hidden text-slate-50 font-sans selection:bg-cyber-500 selection:text-white flex flex-col relative bg-cyber-900">
      
      <div className="absolute inset-0 z-0 pointer-events-none">
         <img src={BG_IMAGE_URL} alt="App Background" className="w-full h-full object-cover" />
      </div>

      <div className="relative z-10 flex flex-col h-full w-full">
          {/* HEADER */}
          <header className="h-16 flex-none bg-cyber-900/60 backdrop-blur-md border-b border-cyber-700/50">
            <div className="container mx-auto px-4 h-full flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-md">
                  <span className="text-cyber-500">COROAI</span> CREATOR
                </h1>
                <p className="text-[8px] sm:text-[10px] text-cyber-400/80 tracking-widest uppercase mt-0.5 font-medium">
                    creative intelligence studio
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <nav className="flex items-center gap-1 bg-cyber-900/70 p-1 rounded-lg border border-cyber-700/50 backdrop-blur-sm shadow-lg overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
                  <button onClick={() => handleTabChange('create')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'create' ? 'bg-cyber-500 text-white' : 'text-slate-300 hover:text-white'}`}>
                    <PlusSquare size={16} /> <span className="hidden sm:inline">CREATE CONCEPT</span>
                  </button>
                   <button onClick={() => handleTabChange('sample')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'sample' ? 'bg-cyber-500 text-white' : 'text-slate-300 hover:text-white'}`}>
                    <FlaskConical size={16} /> <span className="hidden sm:inline">CREATE SAMPLE</span>
                  </button>
                  <button onClick={() => handleTabChange('gallery')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'gallery' ? 'bg-cyber-500 text-white' : 'text-slate-300 hover:text-white'}`}>
                    <LayoutGrid size={16} /> <span className="hidden sm:inline">GALLERY</span>
                  </button>
                </nav>
                <button 
                    onClick={() => setShowSettings(true)}
                    className="p-2.5 bg-cyber-800 text-cyber-400 hover:text-white rounded-lg border border-cyber-700 hover:bg-cyber-700 transition-colors"
                    title="Database Settings"
                >
                    <Settings size={18} />
                </button>
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="flex-1 overflow-hidden relative">
            <div className="h-full w-full container mx-auto px-4 py-4 md:py-6">
              {activeTab === 'create' ? (
                <CreateView 
                  onSaved={handleSaved} 
                  onError={(msg) => showToast(msg, 'error')}
                  onNavigateToSample={handleNavigateToSample}
                />
              ) : activeTab === 'sample' ? (
                <SampleView onError={(msg) => showToast(msg, 'error')} initialData={sampleInitData} />
              ) : (
                <GalleryView 
                  onCopyToast={(msg) => showToast(msg, 'success')} 
                  onNavigateToSample={handleNavigateToSample}
                  items={galleryItems}
                  setItems={setGalleryItems}
                  isLoaded={isGalleryLoaded}
                  setIsLoaded={setIsGalleryLoaded}
                />
              )}
            </div>
          </main>
          
          {/* FOOTER */}
          <footer className="flex-none py-2 bg-cyber-900/80 border-t border-cyber-700/30 text-center z-20 backdrop-blur-sm">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                © 2026 CoroAI System. creative intelligence studio
            </p>
          </footer>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 border backdrop-blur-md
          ${toast.type === 'success' ? 'bg-cyber-900/90 border-cyber-500 text-cyber-400' : 'bg-red-950/90 border-red-500 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
                 <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white p-2"
                 >
                     ✕
                 </button>
                 <div className="flex items-center gap-3 mb-4 text-cyber-500">
                     <div className="p-2 bg-cyber-900 rounded-lg border border-cyber-700"><Settings size={24}/></div>
                     <div>
                        <h3 className="text-xl font-bold text-white">Setup Database</h3>
                        <p className="text-[10px] text-slate-400">Google Apps Script Configuration</p>
                     </div>
                 </div>
                 
                 <div className="space-y-4">
                     <div className="bg-blue-900/20 p-3 rounded border border-blue-500/30 text-xs text-blue-200 leading-relaxed">
                        Data akan disimpan di Google Drive & Sheets Anda.
                        Paste URL <strong>Web App Exec</strong> dari Google Script yang sudah di-deploy.
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-cyber-400 flex items-center gap-1">
                            <LinkIcon size={12} /> Google Script URL
                        </label>
                        <input 
                            type="text" 
                            value={scriptUrl}
                            onChange={(e) => setScriptUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/..../exec"
                            className="w-full bg-black/40 border border-cyber-700 rounded p-3 text-sm text-white focus:border-cyber-500 outline-none font-mono"
                        />
                     </div>
                     <button 
                        onClick={saveSettings}
                        className="w-full py-3 bg-cyber-600 hover:bg-cyber-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2"
                     >
                        <Save size={16} /> SIMPAN KONEKSI
                     </button>
                 </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default App;