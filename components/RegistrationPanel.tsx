import React, { useState, useEffect } from 'react';
import { AppState, Player, Registration, Shift } from '../types';
import { getAppState, addRegistration, getRegistrations, removeRegistration, getPlayers, savePlayer, updateRegistration, generateUUID } from '../services/storageService';
import { Button } from './Button';

interface RegistrationPanelProps {
  currentUser: Player;
}

type SearchStatus = 'idle' | 'searching' | 'found' | 'not_found';

export const RegistrationPanel: React.FC<RegistrationPanelProps> = ({ currentUser }) => {
  const [appState, setAppState] = useState<AppState>(getAppState());
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  
  // Partner logic (New Registration)
  const [registerMode, setRegisterMode] = useState<'individual' | 'partner'>('individual');
  
  // New unified partner flow state
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Fields for NEW player creation
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newPartnerName, setNewPartnerName] = useState('');
  
  const [partnerSearchStatus, setPartnerSearchStatus] = useState<SearchStatus>('idle');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedPartnerName, setSelectedPartnerName] = useState('');
  const [selectedPartnerPhoto, setSelectedPartnerPhoto] = useState<string | undefined>(undefined);
  
  // Edit Mode (Adding partner to existing registration)
  const [editingRegId, setEditingRegId] = useState<string | null>(null);

  // Cancel Confirmation State
  const [cancelTarget, setCancelTarget] = useState<{ type: 'single', reg: Registration } | { type: 'all' } | null>(null);

  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = () => {
    const currentState = getAppState();
    setAppState(currentState);
    const allRegs = getRegistrations();
    
    // Filter: Current User AND Current Tournament Date only
    const activeRegs = allRegs.filter(r => 
        r.playerId === currentUser.id && 
        r.date === currentState.nextSundayDate
    );

    // Show newest first
    setMyRegistrations(activeRegs.reverse());
    
    setAllPlayers(getPlayers().filter(p => p.id !== currentUser.id)); // Exclude self
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000); // Poll for updates
    return () => clearInterval(interval);
  }, [currentUser.id]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;

    if (registerMode === 'partner' && !selectedPartnerId) {
        alert("Por favor verifica e seleciona a tua dupla antes de confirmar.");
        return;
    }

    const newReg: Registration = {
      id: generateUUID(),
      playerId: currentUser.id,
      shift: selectedShift,
      date: appState.nextSundayDate,
      hasPartner: registerMode === 'partner',
      partnerName: registerMode === 'partner' ? selectedPartnerName : undefined,
      partnerId: registerMode === 'partner' ? selectedPartnerId : undefined
    };

    addRegistration(newReg);
    setSuccessMsg('Inscrição confirmada!');
    setTimeout(() => setSuccessMsg(''), 3000);
    
    // Reset form
    setSelectedShift(null);
    setRegisterMode('individual');
    resetPartnerForm();
    loadData();
  };

  const resetPartnerForm = () => {
      setPartnerSearchTerm('');
      setShowSuggestions(false);
      setNewPartnerPhone('');
      setNewPartnerName('');
      setPartnerSearchStatus('idle');
      setSelectedPartnerId('');
      setSelectedPartnerName('');
      setSelectedPartnerPhoto(undefined);
  };

  // Search Logic (Auto-complete)
  const filteredCandidates = partnerSearchTerm.length > 0 
    ? allPlayers.filter(p => 
        p.name.toLowerCase().includes(partnerSearchTerm.toLowerCase()) || 
        p.phone.includes(partnerSearchTerm)
      ).slice(0, 5) 
    : [];

  const handleSelectPartner = (player: Player) => {
      setSelectedPartnerId(player.id);
      setSelectedPartnerName(player.name);
      setSelectedPartnerPhoto(player.photoUrl);
      setPartnerSearchStatus('found');
      setPartnerSearchTerm(player.name);
      setShowSuggestions(false);
  };

  const handleManualNotFound = () => {
      setPartnerSearchStatus('not_found');
      // If the search term looks like a phone number, pre-fill it
      if (/^\d+$/.test(partnerSearchTerm)) {
          setNewPartnerPhone(partnerSearchTerm);
      } else {
          setNewPartnerName(partnerSearchTerm);
      }
      setShowSuggestions(false);
  };

  const registerNewPartner = (isEditing = false) => {
      if (!newPartnerName.trim() || newPartnerPhone.length < 9) {
          alert("Preenche o nome e telemóvel corretamente.");
          return;
      }

      const newPlayer: Player = {
        id: generateUUID(),
        name: newPartnerName,
        phone: newPartnerPhone,
        totalPoints: 0,
        gamesPlayed: 0,
        participantNumber: 0 // Will be assigned in savePlayer
     };

     savePlayer(newPlayer);
     setAllPlayers(getPlayers().filter(p => p.id !== currentUser.id));
     
     // Auto select
     setSelectedPartnerId(newPlayer.id);
     setSelectedPartnerName(newPlayer.name);
     setSelectedPartnerPhoto(undefined);
     setPartnerSearchStatus('found');

     // If we are in edit mode, and user clicked "Register & Associate", we can trigger save immediately
     if (isEditing && editingRegId) {
         confirmAddPartnerToExisting(editingRegId, newPlayer.id, newPlayer.name);
     }
  };

  // --- Logic for Adding/Changing Partner ---

  const handleEditPartner = (regId: string) => {
      setEditingRegId(regId);
      resetPartnerForm();
  };

  const confirmAddPartnerToExisting = (regId: string, partnerId: string, partnerName: string) => {
      updateRegistration(regId, {
          hasPartner: true,
          partnerId: partnerId,
          partnerName: partnerName
      });
      setSuccessMsg('Dupla atualizada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
      setEditingRegId(null);
      resetPartnerForm();
      loadData();
  };

  const handleSaveEditPartner = () => {
      if (!editingRegId || !selectedPartnerId) {
          alert("Nenhuma dupla selecionada.");
          return;
      }
      confirmAddPartnerToExisting(editingRegId, selectedPartnerId, selectedPartnerName);
  };

  // --- Cancellation Logic ---

  const initiateCancelSingle = (reg: Registration, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCancelTarget({ type: 'single', reg });
  };

  const initiateCancelAll = () => {
    setCancelTarget({ type: 'all' });
  };

  const confirmCancellation = () => {
      if (!cancelTarget) return;

      if (cancelTarget.type === 'single') {
          removeRegistration(cancelTarget.reg.id);
          setSuccessMsg('Inscrição cancelada com sucesso.');
      } else {
          // Remove all active registrations for this user/date
          myRegistrations.forEach(r => removeRegistration(r.id));
          setSuccessMsg('Todas as inscrições foram canceladas.');
      }

      setCancelTarget(null);
      setTimeout(() => setSuccessMsg(''), 3000);
      setTimeout(loadData, 100);
  };

  const getPartnerPhoto = (partnerId?: string) => {
      if (!partnerId) return undefined;
      return allPlayers.find(p => p.id === partnerId)?.photoUrl;
  }

  const renderMyRegistrations = () => {
    if (myRegistrations.length === 0) return <p className="text-sm text-gray-400 italic">Nenhuma inscrição ativa.</p>;

    return (
        <div className="space-y-4">
            <ul className="space-y-3">
                {myRegistrations.map(r => {
                    const isFinished = appState.isTournamentFinished;
                    const partnerPhoto = getPartnerPhoto(r.partnerId);

                    return (
                        <li key={r.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                {/* Shift Badge */}
                                <div className="bg-padel-light/20 text-padel-dark text-xs font-bold px-2 py-1 rounded">
                                    {r.shift}
                                </div>
                                
                                <div>
                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{r.date}</div>
                                    <div className="text-xs text-gray-700 mt-1 flex items-center gap-2">
                                        {r.hasPartner ? (
                                            <>
                                                <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                                                    {partnerPhoto ? (
                                                        <img src={partnerPhoto} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>
                                                    )}
                                                </div>
                                                <span className="font-semibold">{r.partnerName}</span>
                                            </>
                                        ) : (
                                            <span className="italic text-gray-400">Individual</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {/* Edit/Add Partner Button */}
                                <button
                                    type="button"
                                    disabled={isFinished}
                                    onClick={() => handleEditPartner(r.id)}
                                    className={`p-2 rounded-full transition-colors ${
                                        isFinished 
                                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                        : 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                                    }`}
                                    title={isFinished ? "Torneio Finalizado" : (r.hasPartner ? "Alterar Parceiro" : "Adicionar Parceiro")}
                                >
                                    {isFinished ? '🔒' : (r.hasPartner ? '🔄' : '➕👤')}
                                </button>
                                
                                {/* Cancel Button (Single) */}
                                <button 
                                    type="button"
                                    disabled={isFinished}
                                    onClick={(e) => initiateCancelSingle(r, e)}
                                    className={`p-2 rounded-full transition-colors ${
                                        isFinished 
                                        ? 'text-gray-200 cursor-not-allowed'
                                        : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                                    }`}
                                    title={isFinished ? "Torneio Finalizado" : "Cancelar Inscrição"}
                                >
                                    <span className="sr-only">Cancelar</span>
                                    {isFinished ? '🔒' : '🗑️'}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Cancel All Button (Visible if multiple registrations) */}
            {myRegistrations.length > 1 && !appState.isTournamentFinished && (
                <div className="pt-2 text-center border-t border-gray-100">
                    <button 
                        onClick={initiateCancelAll}
                        className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                    >
                        Cancelar Todas as Inscrições
                    </button>
                </div>
            )}
        </div>
    );
  };

  if (!appState.registrationsOpen) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-xl border-dashed border-2 border-gray-300">
        <h3 className="text-xl font-bold text-gray-400 mb-2">Inscrições Fechadas</h3>
        <p className="text-gray-600 font-medium">As inscrições abrem todos os Domingos, às 15h00m.</p>
        <p className="text-xs text-gray-400 mt-2 italic">A hora de inscrição pode ser alterada pela organização.</p>
        <div className="mt-8 text-left">
            <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">As tuas inscrições</h4>
             {renderMyRegistrations()}
        </div>
        {/* Render confirmation modal even when closed if user needs to cancel */}
        {renderCancelModal()}
      </div>
    );
  }

  // --- Shared Search UI Component ---
  const renderSearchUI = (isModal: boolean) => (
      <div className="space-y-4">
          {partnerSearchStatus !== 'found' && (
              <div className="relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pesquisar Parceiro (Nome ou Telemóvel)</label>
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                          <input
                              type="text"
                              placeholder="Começa a escrever..."
                              value={partnerSearchTerm}
                              onChange={(e) => {
                                  setPartnerSearchTerm(e.target.value);
                                  setShowSuggestions(true);
                                  setPartnerSearchStatus('idle');
                              }}
                              className="w-full p-2 border border-gray-300 rounded focus:border-padel focus:ring-1 outline-none"
                              autoComplete="off"
                          />
                          {/* Suggestions Dropdown */}
                          {showSuggestions && partnerSearchTerm.length > 0 && (
                              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                  {filteredCandidates.map(player => (
                                      <li 
                                          key={player.id}
                                          onClick={() => handleSelectPartner(player)}
                                          className="p-2 hover:bg-padel-light/20 cursor-pointer flex justify-between items-center text-sm border-b border-gray-50 last:border-0"
                                      >
                                          <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden">
                                                  {player.photoUrl ? (
                                                      <img src={player.photoUrl} className="w-full h-full object-cover" />
                                                  ) : (
                                                      <div className="w-full h-full flex items-center justify-center text-[8px]">👤</div>
                                                  )}
                                              </div>
                                              <span className="font-medium text-gray-800">{player.name}</span>
                                          </div>
                                          <span className="text-xs text-gray-500">{player.phone}</span>
                                      </li>
                                  ))}
                                  {filteredCandidates.length === 0 && (
                                      <li className="p-3 text-center text-sm text-gray-500 italic">
                                          Nenhum jogador encontrado.
                                      </li>
                                  )}
                              </ul>
                          )}
                      </div>
                  </div>
                   {/* Manual Add Button if not found */}
                   {partnerSearchStatus !== 'not_found' && (
                      <div className="mt-2 text-right">
                          <button 
                              type="button" 
                              onClick={handleManualNotFound}
                              className="text-xs text-padel-dark font-bold hover:underline"
                          >
                              Não encontras? Registar Novo Jogador
                          </button>
                      </div>
                   )}
              </div>
          )}

          {partnerSearchStatus === 'found' && (
              <div className="bg-green-100 p-3 rounded border border-green-200 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-green-200 overflow-hidden">
                          {selectedPartnerPhoto ? (
                              <img src={selectedPartnerPhoto} className="w-full h-full object-cover" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center text-green-500">👤</div>
                          )}
                      </div>
                      <div>
                          <span className="block text-xs text-green-700 font-bold uppercase tracking-wide">Dupla Confirmada</span>
                          <div className="text-green-900 font-bold text-lg">
                              {selectedPartnerName}
                          </div>
                      </div>
                  </div>
                  <button 
                      type="button" 
                      onClick={resetPartnerForm}
                      className="text-gray-400 hover:text-red-500 p-2 transition-colors font-bold text-xl leading-none"
                      title="Remover dupla"
                  >
                      &times;
                  </button>
              </div>
          )}

          {/* Not Found - Register New Section */}
          {partnerSearchStatus === 'not_found' && (
              <div className="animate-slide-down bg-white p-4 rounded-lg border-l-4 border-yellow-400 shadow-sm mt-2">
                  <div className="mb-3">
                      <p className="text-sm text-gray-800 font-bold">⚠️ Novo Jogador</p>
                      <p className="text-xs text-gray-500">Cria a ficha rápida para associar à inscrição.</p>
                  </div>
                  
                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Nome Completo</label>
                          <input
                              type="text"
                              placeholder="Ex: Maria Santos"
                              value={newPartnerName}
                              onChange={(e) => setNewPartnerName(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded focus:border-padel focus:ring-1 focus:ring-padel outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Telemóvel</label>
                          <input
                              type="tel"
                              placeholder="Ex: 912345678"
                              value={newPartnerPhone}
                              onChange={(e) => setNewPartnerPhone(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded focus:border-padel focus:ring-1 focus:ring-padel outline-none"
                          />
                      </div>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                      <button 
                          type="button" 
                          onClick={() => setPartnerSearchStatus('idle')}
                          className="flex-1 py-2 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                      >
                          Cancelar
                      </button>
                      <Button 
                          type="button" 
                          onClick={() => registerNewPartner(isModal)}
                          className="flex-1 py-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-white border-none shadow-none"
                      >
                          Criar e Associar
                      </Button>
                  </div>
              </div>
          )}
      </div>
  );

  function renderCancelModal() {
      if (!cancelTarget) return null;

      const isAll = cancelTarget.type === 'all';
      
      return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">
                        🗑️
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {isAll ? 'Cancelar Todas?' : 'Cancelar Inscrição?'}
                    </h3>
                    <p className="text-sm text-gray-600">
                        {isAll 
                            ? `Vais remover todas as tuas ${myRegistrations.length} inscrições para este dia.`
                            : `Vais remover a tua inscrição no turno ${cancelTarget.reg.shift}.`
                        }
                    </p>
                    <p className="text-xs text-red-500 font-bold mt-2">Esta ação liberta o teu lugar.</p>
                </div>
                
                <div className="flex gap-3">
                    <Button 
                        variant="secondary" 
                        onClick={() => setCancelTarget(null)} 
                        className="flex-1"
                    >
                        Não, manter
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={confirmCancellation} 
                        className="flex-1"
                    >
                        Sim, cancelar
                    </Button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-padel relative">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">📝 Inscrição Semanal</h2>
        
        {successMsg && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg flex items-center gap-2 animate-pulse">
            ✅ {successMsg}
            </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
            <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Escolhe o Turno</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.values(Shift).map((shift) => {
                const isRegistered = myRegistrations.some(r => r.shift === shift && r.date === appState.nextSundayDate);
                return (
                    <button
                    key={shift}
                    type="button"
                    disabled={isRegistered}
                    onClick={() => setSelectedShift(shift)}
                    className={`p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                        selectedShift === shift
                        ? 'border-padel bg-padel/10 text-padel-dark'
                        : isRegistered 
                            ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                            : 'border-gray-200 hover:border-padel/50 text-gray-600'
                    }`}
                    >
                    {shift}
                    {isRegistered && <div className="text-xs font-normal mt-1 text-green-600">Já inscrito</div>}
                    </button>
                );
                })}
            </div>
            </div>

            <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Inscrição</label>
            <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    checked={registerMode === 'individual'} 
                    onChange={() => { setRegisterMode('individual'); resetPartnerForm(); }}
                    className="text-padel focus:ring-padel"
                />
                <span>Individual</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    checked={registerMode === 'partner'} 
                    onChange={() => setRegisterMode('partner')}
                    className="text-padel focus:ring-padel"
                />
                <span>Com Dupla</span>
                </label>
            </div>

            {registerMode === 'partner' && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 animate-fade-in space-y-4 relative">
                    <h4 className="font-bold text-blue-800 text-sm">Identificar Dupla</h4>
                    {renderSearchUI(false)}
                </div>
            )}
            </div>

            <Button 
                type="submit" 
                className="w-full py-3 text-lg" 
                disabled={!selectedShift || (registerMode === 'partner' && !selectedPartnerId)}
            >
            Confirmar Inscrição
            </Button>
        </form>

        {/* Edit Partner Modal */}
        {editingRegId && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                    <h3 className="text-xl font-bold mb-4 text-gray-800">
                        {myRegistrations.find(r => r.id === editingRegId)?.hasPartner ? 'Alterar Parceiro' : 'Adicionar Parceiro'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">Associa um novo jogador à tua equipa.</p>

                    {renderSearchUI(true)}

                    <div className="flex gap-2 mt-6">
                        <Button variant="ghost" className="flex-1" onClick={() => { setEditingRegId(null); resetPartnerForm(); }}>Cancelar</Button>
                        <Button 
                            className="flex-1" 
                            disabled={!selectedPartnerId}
                            onClick={handleSaveEditPartner}
                        >
                            Gravar
                        </Button>
                    </div>
                </div>
            </div>
        )}

        </div>

        {/* List of registrations always visible */}
        <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-white/40">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">As tuas Inscrições Ativas</h3>
            {renderMyRegistrations()}
        </div>

        {/* Cancel Confirmation Modal */}
        {renderCancelModal()}
    </div>
  );
};