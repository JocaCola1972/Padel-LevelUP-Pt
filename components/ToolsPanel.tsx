
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Shift } from '../types';
import { getAppState, updateAppState, subscribeToChanges, clearAllMessages, clearAllRegistrations, clearMatchesByShift } from '../services/storageService';
import { Button } from './Button';

const DEFAULT_TOOLS_ORDER = ['visual', 'maintenance'];

export const ToolsPanel: React.FC = () => {
  const [state, setState] = useState<AppState>(getAppState());
  const [showMessage, setShowMessage] = useState(false);
  const [showClearMessagesConfirm, setShowClearMessagesConfirm] = useState(false);
  const [showClearRegistrationsConfirm, setShowClearRegistrationsConfirm] = useState(false);
  const [shiftToClear, setShiftToClear] = useState<Shift | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    const appState = getAppState();
    
    // Garantir que a ordem existe
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result as string;
          const newState = { ...state, customLogo: base64String };
          updateAppState(newState);
          setState(newState);
          showMessageTemporarily();
      };
      reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
      const newState = { ...state, customLogo: undefined };
      updateAppState(newState);
      setState(newState);
      showMessageTemporarily();
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExecuteClearMessages = async () => {
      await clearAllMessages();
      setShowClearMessagesConfirm(false);
      alert("Todas as mensagens foram removidas do sistema.");
  };

  const handleExecuteClearRegistrations = async () => {
      await clearAllRegistrations();
      setShowClearRegistrationsConfirm(false);
      alert("Todas as inscrições foram eliminadas do sistema.");
  };

  const handleExecuteClearShift = async () => {
      if (!shiftToClear) return;
      await clearMatchesByShift(shiftToClear);
      alert(`Todos os resultados e pontos do turno ${shiftToClear} foram removidos.`);
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
                title="Mover para cima"
              >
                  ↑
              </button>
              <button 
                onClick={() => moveSection(key, 'down')} 
                disabled={isLast}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border bg-white shadow-sm transition-all ${isLast ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:text-padel hover:border-padel'}`}
                title="Mover para baixo"
              >
                  ↓
              </button>
          </div>
      );

      switch (key) {
          case 'visual':
              return (
                <div key="visual" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-lime-600 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            🖼️ Configuração Visual
                        </h2>
                        {controls}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-bold text-gray-700 mb-4">Logótipo e Ícone (Favicon)</h3>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-32 h-32 rounded-full border-4 border-padel overflow-hidden bg-white flex-shrink-0 relative shadow-inner">
                                <img 
                                    src={state.customLogo || '/logo.png'} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 space-y-3">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Esta imagem substitui o logótipo no ecrã inicial e serve como o ícone (favicon) da aplicação.
                                </p>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleLogoUpload}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-padel-light/20 file:text-padel-dark hover:file:bg-padel-light/30 transition-all cursor-pointer"
                                />
                                {state.customLogo && (
                                    <button 
                                        onClick={handleResetLogo}
                                        className="text-xs text-red-500 font-bold hover:underline block"
                                    >
                                        Restaurar logótipo padrão
                                    </button>
                                )}
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
                                <p className="text-xs text-red-600">Elimina todas as mensagens (Directas e Broadcasts) do sistema para todos os utilizadores.</p>
                            </div>
                            <Button 
                                onClick={() => setShowClearMessagesConfirm(true)}
                                className="bg-red-800 hover:bg-red-900 text-white text-xs py-2 shadow-red-200 whitespace-nowrap"
                            >
                                Limpar Mensagens
                            </Button>
                        </div>

                        <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="font-bold text-red-800">Limpeza de Inscrições</h3>
                                <p className="text-xs text-red-600 font-medium">Remove ABSOLUTAMENTE TODAS as inscrições de todos os turnos e datas.</p>
                            </div>
                            <Button 
                                onClick={() => setShowClearRegistrationsConfirm(true)}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs py-2 shadow-red-200 whitespace-nowrap"
                            >
                                Limpar Inscrições
                            </Button>
                        </div>

                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-3">
                            <h3 className="font-bold text-orange-800">Resetar Rankings por Turno</h3>
                            <p className="text-xs text-orange-600">Elimina todos os resultados e pontos acumulados de um turno específico em todas as datas.</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.values(Shift).map(s => (
                                    <Button 
                                        key={s} 
                                        onClick={() => setShiftToClear(s)} 
                                        className="bg-orange-600 hover:bg-orange-700 text-[10px] py-2 px-3 font-black uppercase tracking-tighter"
                                    >
                                        Limpar {s}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              );
          default:
              return null;
      }
  };

  return (
    <div className="space-y-8 pb-10">
      {showMessage && (
        <div className="fixed top-20 right-4 p-3 bg-green-100 text-green-800 rounded-lg shadow-lg z-50 animate-slide-down border border-green-200">
          ✅ Alteração guardada!
        </div>
      )}

      {/* Render Dynamic Sections Order */}
      {(state.toolsSectionOrder || DEFAULT_TOOLS_ORDER).map(key => renderSection(key))}

      {/* CLEAR MESSAGES CONFIRMATION MODAL */}
      {showClearMessagesConfirm && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm overflow-hidden border-t-8 border-red-900">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-red-100 text-red-900 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                          🗑️
                      </div>
                      <h3 className="text-xl font-black text-red-900 mb-2 tracking-tight">Mensagem do LevelUP</h3>
                      <div className="space-y-4">
                        <p className="text-gray-800 font-bold leading-tight">
                            Tens a certeza que desejas apagar TODAS as mensagens do sistema?
                        </p>
                        <div className="text-xs text-gray-500 leading-relaxed space-y-2 p-3 bg-gray-50 rounded-lg text-left italic">
                            <p>• Todas as mensagens diretas entre utilizadores serão removidas.</p>
                            <p>• Todos os avisos globais (Broadcasts) serão eliminados.</p>
                            <p>• Esta limpeza aplica-se a todos os dispositivos em tempo real.</p>
                        </div>
                        <p className="text-xs font-black text-red-600 uppercase">Atenção: Esta ação é irreversível!</p>
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50 flex gap-3">
                      <Button 
                        variant="secondary"
                        onClick={() => setShowClearMessagesConfirm(false)} 
                        className="flex-1 py-3 font-bold"
                      >
                          Não, Cancelar
                      </Button>
                      <Button 
                        onClick={handleExecuteClearMessages} 
                        className="flex-1 py-3 bg-red-900 hover:bg-black font-black text-white"
                      >
                          Sim, Apagar Tudo
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* CLEAR REGISTRATIONS CONFIRMATION MODAL */}
      {showClearRegistrationsConfirm && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm overflow-hidden border-t-8 border-red-600">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                          🎾
                      </div>
                      <h3 className="text-xl font-black text-red-600 mb-2 tracking-tight">Mensagem do LevelUP</h3>
                      <div className="space-y-4">
                        <p className="text-gray-800 font-bold leading-tight">
                            Tens a certeza que desejas apagar TODAS as INSCRIÇÕES do sistema?
                        </p>
                        <div className="text-xs text-gray-500 leading-relaxed space-y-2 p-3 bg-gray-50 rounded-lg text-left italic">
                            <p>• Serão removidas inscrições de todas as datas futuras e passadas.</p>
                            <p>• Esta ação afeta todos os turnos e atividades (Jogos e Treinos).</p>
                            <p>• Os resultados de jogos (MatchRecord) NÃO serão afetados.</p>
                        </div>
                        <p className="text-xs font-black text-red-600 uppercase">Atenção: Esta ação é irreversível!</p>
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50 flex gap-3">
                      <Button 
                        variant="secondary"
                        onClick={() => setShowClearRegistrationsConfirm(false)} 
                        className="flex-1 py-3 font-bold"
                      >
                          Não, Cancelar
                      </Button>
                      <Button 
                        onClick={handleExecuteClearRegistrations} 
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 font-black text-white"
                      >
                          Sim, Apagar Tudo
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* CLEAR SHIFT POINTS CONFIRMATION MODAL */}
      {shiftToClear && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm overflow-hidden border-t-8 border-orange-600">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                          🏅
                      </div>
                      <h3 className="text-xl font-black text-orange-600 mb-2 tracking-tight">Limpeza de Ranking</h3>
                      <div className="space-y-4">
                        <p className="text-gray-800 font-bold leading-tight">
                            Limpar todos os pontos do turno: <br/>
                            <span className="text-padel-dark text-lg uppercase">{shiftToClear}</span>?
                        </p>
                        <div className="text-xs text-gray-500 leading-relaxed space-y-2 p-3 bg-gray-50 rounded-lg text-left italic">
                            <p>• Todos os resultados (MatchRecord) deste turno em todas as datas serão apagados.</p>
                            <p>• A pontuação total dos jogadores será recalculada e diminuída.</p>
                            <p>• As inscrições (Registrations) NÃO serão afetadas.</p>
                        </div>
                        <p className="text-xs font-black text-orange-600 uppercase">Esta ação afetará o Ranking Geral!</p>
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50 flex gap-3">
                      <Button 
                        variant="secondary"
                        onClick={() => setShiftToClear(null)} 
                        className="flex-1 py-3 font-bold"
                      >
                          Voltar
                      </Button>
                      <Button 
                        onClick={handleExecuteClearShift} 
                        className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 font-black text-white"
                      >
                          Sim, Limpar Turno
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
