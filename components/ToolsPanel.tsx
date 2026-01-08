
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Shift } from '../types';
import { getAppState, updateAppState, subscribeToChanges, clearAllMessages, clearAllRegistrations, clearMatchesByShift, uploadSiteAsset } from '../services/storageService';
import { Button } from './Button';

const DEFAULT_TOOLS_ORDER = ['visual', 'maintenance'];

export const ToolsPanel: React.FC = () => {
  const [state, setState] = useState<AppState>(getAppState());
  const [showMessage, setShowMessage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeUpload, setActiveUpload] = useState<'logo' | 'bg' | 'favicon' | null>(null);
  const [showClearMessagesConfirm, setShowClearMessagesConfirm] = useState(false);
  const [showClearRegistrationsConfirm, setShowClearRegistrationsConfirm] = useState(false);
  const [shiftToClear, setShiftToClear] = useState<Shift | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    const appState = getAppState();
    let currentOrder = appState.toolsSectionOrder || DEFAULT_TOOLS_ORDER;
    const missingSections = DEFAULT_TOOLS_ORDER.filter(s => !currentOrder.includes(s));
    
    if (missingSections.length > 0) {
        currentOrder = [...currentOrder, ...missingSections];
        updateAppState({ ...appState, toolsSectionOrder: currentOrder });
    }

    setState({ ...appState, toolsSectionOrder: currentOrder });
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    return () => unsubscribe();
  }, []);

  const showMessageTemporarily = () => {
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 2000);
  };

  const moveSection = (key: string, direction: 'up' | 'down') => {
      const currentOrder = [...(state.toolsSectionOrder || DEFAULT_TOOLS_ORDER)];
      const index = currentOrder.indexOf(key);
      if (index === -1) return;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= currentOrder.length) return;

      [currentOrder[index], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[index]];

      const newState = { ...state, toolsSectionOrder: currentOrder };
      updateAppState(newState);
      setState(newState);
      showMessageTemporarily();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'bg' | 'favicon') => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setActiveUpload(type);
      try {
          const publicUrl = await uploadSiteAsset(file, `site-${type}`);
          let updates: Partial<AppState> = {};
          if (type === 'logo') updates.customLogo = publicUrl;
          if (type === 'bg') updates.loginBackground = publicUrl;
          if (type === 'favicon') updates.faviconUrl = publicUrl;
          
          await updateAppState(updates);
          loadData();
          showMessageTemporarily();
      } catch (err: any) {
          alert("Erro no upload: " + err.message);
      } finally {
          setIsUploading(false);
          setActiveUpload(null);
      }
  };

  const handleReset = async (type: 'logo' | 'bg' | 'favicon') => {
      let updates: Partial<AppState> = {};
      if (type === 'logo') updates.customLogo = undefined;
      if (type === 'bg') updates.loginBackground = undefined;
      if (type === 'favicon') updates.faviconUrl = undefined;
      
      await updateAppState(updates);
      loadData();
      showMessageTemporarily();
  };

  const handleExecuteClearMessages = async () => {
      await clearAllMessages();
      setShowClearMessagesConfirm(false);
      alert("Todas as mensagens foram removidas.");
  };

  const handleExecuteClearRegistrations = async () => {
      await clearAllRegistrations();
      setShowClearRegistrationsConfirm(false);
      alert("Todas as inscrições foram eliminadas.");
  };

  const handleExecuteClearShift = async () => {
      if (!shiftToClear) return;
      await clearMatchesByShift(shiftToClear);
      alert(`Dados do turno ${shiftToClear} limpos.`);
      setShiftToClear(null);
  };

  const renderSection = (key: string) => {
      const order = state.toolsSectionOrder || DEFAULT_TOOLS_ORDER;
      const index = order.indexOf(key);
      const isFirst = index === 0;
      const isLast = index === order.length - 1;

      const controls = (
          <div className="flex gap-1 ml-4">
              <button 
                onClick={() => moveSection(key, 'up')} 
                disabled={isFirst}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border bg-white shadow-sm transition-all ${isFirst ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:text-padel hover:border-padel'}`}
              >↑</button>
              <button 
                onClick={() => moveSection(key, 'down')} 
                disabled={isLast}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border bg-white shadow-sm transition-all ${isLast ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:text-padel hover:border-padel'}`}
              >↓</button>
          </div>
      );

      switch (key) {
          case 'visual':
              return (
                <div key="visual" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-lime-600 animate-fade-in space-y-8">
                    <div className="flex justify-between items-start">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            🖼️ Identidade Visual
                        </h2>
                        {controls}
                    </div>

                    {/* Logo Config */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-widest">Logótipo do Clube</h3>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-24 h-24 rounded-full border-4 border-padel overflow-hidden bg-white shadow-md relative">
                                {activeUpload === 'logo' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                        <div className="w-6 h-6 border-4 border-padel border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                                <img src={state.customLogo || 'https://raw.githubusercontent.com/fabiolb/padel-levelup/main/logo.png'} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Button onClick={() => logoInputRef.current?.click()} className="text-xs py-1.5 px-3" isLoading={activeUpload === 'logo'}>Alterar Logo</Button>
                                <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
                                {state.customLogo && <button onClick={() => handleReset('logo')} className="block text-[10px] text-red-500 font-bold uppercase hover:underline">Repor Padrão</button>}
                            </div>
                        </div>
                    </div>

                    {/* Login Background Config */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-widest">Fundo do Ecrã de Login</h3>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-32 h-20 rounded-lg border-2 border-gray-300 overflow-hidden bg-gray-200 shadow-inner relative">
                                {activeUpload === 'bg' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                        <div className="w-6 h-6 border-4 border-padel border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                                <img src={state.loginBackground || 'https://img.freepik.com/free-vector/silhouette-padel-player-background_23-2150068894.jpg'} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Button onClick={() => bgInputRef.current?.click()} className="text-xs py-1.5 px-3" isLoading={activeUpload === 'bg'}>Alterar Fundo</Button>
                                <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'bg')} />
                                {state.loginBackground && <button onClick={() => handleReset('bg')} className="block text-[10px] text-red-500 font-bold uppercase hover:underline">Repor Padrão</button>}
                            </div>
                        </div>
                    </div>

                    {/* Favicon Config */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-black text-gray-700 mb-4 uppercase tracking-widest">Ícone do Navegador (Favicon)</h3>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-400 flex items-center justify-center bg-white shadow-sm relative">
                                {activeUpload === 'favicon' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                        <div className="w-4 h-4 border-2 border-padel border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                                {state.faviconUrl ? <img src={state.faviconUrl} className="w-8 h-8 object-contain" /> : <span className="text-xl">🎾</span>}
                            </div>
                            <div className="flex-1 space-y-2">
                                <Button onClick={() => faviconInputRef.current?.click()} className="text-xs py-1.5 px-3" isLoading={activeUpload === 'favicon'}>Alterar Favicon</Button>
                                <input type="file" ref={faviconInputRef} className="hidden" accept="image/x-icon,image/png,image/svg+xml" onChange={(e) => handleFileUpload(e, 'favicon')} />
                                {state.faviconUrl && <button onClick={() => handleReset('favicon')} className="block text-[10px] text-red-500 font-bold uppercase hover:underline">Repor Padrão</button>}
                            </div>
                        </div>
                    </div>
                </div>
              );
          case 'maintenance':
              return (
                <div key="maintenance" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-900 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            🛠️ Manutenção do Sistema
                        </h2>
                        {controls}
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="font-bold text-red-800">Limpeza de Mensagens</h3>
                                <p className="text-xs text-red-600">Elimina todas as mensagens do sistema.</p>
                            </div>
                            <Button onClick={() => setShowClearMessagesConfirm(true)} className="bg-red-800 text-white text-xs py-2">Limpar Mensagens</Button>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="font-bold text-red-800">Limpeza de Inscrições</h3>
                                <p className="text-xs text-red-600">Remove inscrições de todos os turnos e datas.</p>
                            </div>
                            <Button onClick={() => setShowClearRegistrationsConfirm(true)} className="bg-red-600 text-white text-xs py-2">Limpar Inscrições</Button>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-3">
                            <h3 className="font-bold text-orange-800">Resetar Rankings por Turno</h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.values(Shift).map(s => (
                                    <Button key={s} onClick={() => setShiftToClear(s)} className="bg-orange-600 text-[10px] py-2 px-3">Limpar {s}</Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              );
          default: return null;
      }
  };

  return (
    <div className="space-y-8 pb-10">
      {showMessage && (
        <div className="fixed top-20 right-4 p-3 bg-green-100 text-green-800 rounded-lg shadow-lg z-50 animate-slide-down border border-green-200">
          ✅ Alteração guardada!
        </div>
      )}
      {(state.toolsSectionOrder || DEFAULT_TOOLS_ORDER).map(key => renderSection(key))}

      {showClearMessagesConfirm && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm overflow-hidden border-t-8 border-red-900">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-red-100 text-red-900 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🗑️</div>
                      <h3 className="text-xl font-black text-red-900 mb-2 tracking-tight">Limpar Mensagens?</h3>
                      <p className="text-gray-800 font-bold mb-6">Todas as mensagens serão apagadas permanentemente.</p>
                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowClearMessagesConfirm(false)} className="flex-1 py-3">Não</Button>
                        <Button onClick={handleExecuteClearMessages} className="flex-1 py-3 bg-red-900 text-white">Sim, Apagar</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showClearRegistrationsConfirm && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm overflow-hidden border-t-8 border-red-600">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⚠️</div>
                      <h3 className="text-xl font-black text-red-600 mb-2 tracking-tight">Limpar Inscrições?</h3>
                      <p className="text-gray-800 font-bold mb-6">Todas as inscrições de todos os dias serão apagadas.</p>
                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowClearRegistrationsConfirm(false)} className="flex-1 py-3">Não</Button>
                        <Button onClick={handleExecuteClearRegistrations} className="flex-1 py-3 bg-red-600 text-white">Sim, Apagar</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {shiftToClear && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm overflow-hidden border-t-8 border-orange-600">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🧹</div>
                      <h3 className="text-xl font-black text-orange-600 mb-2 tracking-tight">Limpar Turno {shiftToClear}?</h3>
                      <p className="text-gray-800 font-bold mb-6">Todos os pontos e jogos deste turno serão removidos.</p>
                      <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShiftToClear(null)} className="flex-1 py-3">Cancelar</Button>
                        <Button onClick={handleExecuteClearShift} className="flex-1 py-3 bg-orange-600 text-white">Sim, Limpar</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
