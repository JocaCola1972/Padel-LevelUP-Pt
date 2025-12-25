
import React, { useState, useEffect } from 'react';
import { AppState, Player, Registration, Shift } from '../types';
import { getAppState, addRegistration, getRegistrations, removeRegistration, getPlayers, savePlayer, updateRegistration, generateUUID, subscribeToChanges, updateAppState } from '../services/storageService';
import { Button } from './Button';

interface RegistrationPanelProps {
  currentUser: Player;
}

type SearchStatus = 'idle' | 'searching' | 'found' | 'not_found';

export const RegistrationPanel: React.FC<RegistrationPanelProps> = ({ currentUser }) => {
  const [appState, setAppState] = useState<AppState>(getAppState());
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [regType, setRegType] = useState<'game' | 'training'>('game');
  const [registerMode, setRegisterMode] = useState<'individual' | 'partner'>('individual');
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newPartnerName, setNewPartnerName] = useState('');
  const [partnerSearchStatus, setPartnerSearchStatus] = useState<SearchStatus>('idle');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedPartnerName, setSelectedPartnerName] = useState('');
  const [selectedPartnerPhoto, setSelectedPartnerPhoto] = useState<string | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<{ type: 'single', reg: Registration } | null>(null);
  const [showCancelSplitModal, setShowCancelSplitModal] = useState(false);
  const [waitingListPrompt, setWaitingListPrompt] = useState<{ shift: Shift, type: 'game' | 'training', asPartner: boolean } | null>(null);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [allTournamentRegistrations, setAllTournamentRegistrations] = useState<Registration[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

  // New state for adding/changing partner to an existing registration
  const [isAddingPartnerToRegId, setIsAddingPartnerToRegId] = useState<string | null>(null);
  const [addPartnerSearchTerm, setAddPartnerSearchTerm] = useState('');
  const [showAddPartnerSuggestions, setShowAddPartnerSuggestions] = useState(false);

  // Added: filteredCandidates logic to fix compilation error and provide partner search results
  const filteredCandidates = allPlayers.filter(p => 
      p.id !== currentUser.id && (
      p.name.toLowerCase().includes(partnerSearchTerm.toLowerCase()) || 
      p.phone.includes(partnerSearchTerm))
  ).slice(0, 5);

  const filteredAddPartnerCandidates = allPlayers.filter(p => 
      p.id !== currentUser.id && (
      p.name.toLowerCase().includes(addPartnerSearchTerm.toLowerCase()) || 
      p.phone.includes(addPartnerSearchTerm))
  ).slice(0, 5);

  const checkAutoOpen = (state: AppState) => {
    if (state.registrationsOpen) return;
    if (!state.autoOpenTime) return;

    const now = new Date();
    const day = now.getDay(); // 0 = Domingo
    
    if (day === 0) {
      const [hours, minutes] = state.autoOpenTime.split(':').map(Number);
      const openTime = new Date();
      openTime.setHours(hours, minutes, 0, 0);

      if (now >= openTime) {
        updateAppState({ registrationsOpen: true });
      }
    }
  };

  const loadData = () => {
    const currentState = getAppState();
    checkAutoOpen(currentState);
    setAppState(currentState);
    
    const allRegs = getRegistrations();
    const playersList = getPlayers();
    setAllPlayers(playersList); // Store all players to easily find self and partners
    
    const regsForDate = allRegs.filter(r => r.date === currentState.nextSundayDate);
    setAllTournamentRegistrations(regsForDate);
    
    const activeRegs = regsForDate.filter(r => r.playerId === currentUser.id || r.partnerId === currentUser.id);
    setMyRegistrations([...activeRegs].reverse());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    const interval = setInterval(loadData, 30000); // Check every 30s for auto-open
    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, [currentUser.id]);

  const handleRegister = async (e?: React.FormEvent, forceWaitingList = false) => {
    if (e) e.preventDefault();
    if (!appState.registrationsOpen) {
        alert("As inscrições estão fechadas de momento.");
        return;
    }
    if (!selectedShift) return;

    const myConflict = allTournamentRegistrations.find(r => 
        r.shift === selectedShift && (r.playerId === currentUser.id || r.partnerId === currentUser.id)
    );

    if (myConflict) {
        alert(`Já tens uma inscrição ativa neste turno!`);
        return;
    }

    if (!forceWaitingList) {
        const { remaining } = getShiftAvailability(selectedShift, regType);
        const needed = registerMode === 'partner' ? 2 : 1;
        if (remaining < needed) {
            setWaitingListPrompt({ shift: selectedShift, type: regType, asPartner: registerMode === 'partner' });
            return;
        }
    }

    const newReg: Registration = {
      id: generateUUID(),
      playerId: currentUser.id,
      shift: selectedShift,
      date: appState.nextSundayDate,
      hasPartner: registerMode === 'partner',
      partnerName: registerMode === 'partner' ? selectedPartnerName : undefined,
      partnerId: (registerMode === 'partner' && selectedPartnerId) ? selectedPartnerId : undefined,
      type: regType,
      isWaitingList: forceWaitingList
    };

    await addRegistration(newReg);
    setSuccessMsg(forceWaitingList ? 'Colocado em lista de suplentes!' : 'Inscrição confirmada!');
    setWaitingListPrompt(null);
    setSelectedShift(null);
    resetPartnerForm();
    loadData();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddPartnerToExisting = async (partner: Player) => {
    if (!isAddingPartnerToRegId) return;

    // Check if partner is already playing in this shift
    const reg = myRegistrations.find(r => r.id === isAddingPartnerToRegId);
    if (!reg) return;

    const partnerConflict = allTournamentRegistrations.find(r => 
        r.shift === reg.shift && (r.playerId === partner.id || r.partnerId === partner.id)
    );

    if (partnerConflict) {
        alert(`${partner.name} já tem uma inscrição ativa neste turno!`);
        return;
    }

    // Update the registration
    await updateRegistration(isAddingPartnerToRegId, {
        hasPartner: true,
        partnerId: partner.id,
        partnerName: partner.name
    });

    setSuccessMsg(reg.hasPartner ? 'Parceiro alterado com sucesso!' : 'Parceiro adicionado com sucesso!');
    setIsAddingPartnerToRegId(null);
    setAddPartnerSearchTerm('');
    loadData();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const getShiftAvailability = (shift: Shift, type: 'game' | 'training') => {
      const config = appState.courtConfig[shift];
      if (!config) return { total: 0, used: 0, remaining: 0, percentage: 100 };
      const numCourts = config[type] || 0;
      const totalSlots = numCourts * 4;
      const usedSlots = allTournamentRegistrations
          .filter(r => r.shift === shift && (r.type === type || (!r.type && type === 'game')) && !r.isWaitingList)
          .reduce((acc, r) => acc + (r.hasPartner ? 2 : 1), 0);
      const remaining = Math.max(0, totalSlots - usedSlots);
      const percentage = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 100;
      return { total: totalSlots, used: usedSlots, remaining, percentage };
  };

  const resetPartnerForm = () => {
      setPartnerSearchTerm('');
      setShowSuggestions(false);
      setNewPartnerPhone('');
      setNewPartnerName('');
      setPartnerSearchStatus('idle');
      setSelectedPartnerId('');
      setSelectedPartnerName('');
  };

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
      if (/^\d+$/.test(partnerSearchTerm)) setNewPartnerPhone(partnerSearchTerm);
      else setNewPartnerName(partnerSearchTerm);
      setShowSuggestions(false);
  };

  const registerNewPartner = async () => {
      if (!newPartnerName.trim() || newPartnerPhone.length < 9) {
          alert("Preenche os dados corretamente.");
          return;
      }
      const cleanPhone = newPartnerPhone.replace(/\s+/g, '');
      const id = generateUUID();
      const newP: Player = { id, name: newPartnerName, phone: cleanPhone, totalPoints: 0, gamesPlayed: 0, participantNumber: 0 };
      await savePlayer(newP);
      setSelectedPartnerId(id);
      setSelectedPartnerName(newPartnerName);
      setPartnerSearchStatus('found');
  };

  const handleCancelOnlyMe = async () => {
      if (!cancelTarget) return;
      const reg = cancelTarget.reg;
      if (reg.playerId === currentUser.id && reg.partnerId) {
          await updateRegistration(reg.id, { playerId: reg.partnerId, hasPartner: false, partnerId: undefined, partnerName: undefined });
      } else {
          await updateRegistration(reg.id, { hasPartner: false, partnerId: undefined, partnerName: undefined });
      }
      setSuccessMsg('Cancelado com sucesso.');
      setCancelTarget(null);
      setShowCancelSplitModal(false);
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCancelEntireDupla = async () => {
      if (!cancelTarget) return;
      await removeRegistration(cancelTarget.reg.id);
      setSuccessMsg('Inscrição removida.');
      setCancelTarget(null);
      setShowCancelSplitModal(false);
      loadData();
      setTimeout(() => setSuccessMsg(''), 3000);
  };

  const renderMyRegistrationsList = () => (
    <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-white/40 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2">
            <span>✅ As tuas Inscrições</span>
            <span className="text-[10px] bg-padel/20 text-padel-dark px-2 py-0.5 rounded-full">Ativas</span>
        </h3>
        <ul className="space-y-3">
            {myRegistrations.map(r => {
                const isMyPartner = r.partnerId === currentUser.id;
                const partnerId = isMyPartner ? r.playerId : r.partnerId;
                const partnerObj = allPlayers.find(p => p.id === partnerId);
                const displayPartnerName = isMyPartner ? (partnerObj?.name || '...') : r.partnerName;
                const canAddPartner = !r.hasPartner && r.type === 'game' && !r.isWaitingList;
                const canChangePartner = r.hasPartner && r.type === 'game' && !r.isWaitingList;

                // Points calculation
                const myFreshPoints = allPlayers.find(p => p.id === currentUser.id)?.totalPoints || 0;
                const partnerPoints = partnerObj?.totalPoints || 0;
                const totalSum = myFreshPoints + partnerPoints;

                return (
                    <li key={r.id} className="p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                  <span className="font-black text-gray-800 italic">{r.shift}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${r.type === 'training' ? 'bg-orange-100 text-orange-600' : 'bg-padel/10 text-padel-dark'}`}>
                                      {r.type === 'training' ? '🎓 Treino' : '🎾 Jogo'}
                                  </span>
                              </div>
                              <div className="flex flex-col">
                                  {r.hasPartner ? (
                                      <div className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
                                          <span className="text-padel">👥 Dupla com:</span>
                                          <span className="text-gray-900">{displayPartnerName}</span>
                                      </div>
                                  ) : (
                                      <span className="text-[10px] text-gray-400 font-medium italic">👤 Inscrição Individual</span>
                                  )}
                                  {r.isWaitingList && (
                                      <span className="text-[10px] font-black text-yellow-600 uppercase mt-1">⏳ Lista de Suplentes</span>
                                  )}
                              </div>
                          </div>
                          <button 
                              onClick={(e) => { 
                                  e.preventDefault(); 
                                  setCancelTarget({ type: 'single', reg: r }); 
                                  if (r.hasPartner) setShowCancelSplitModal(true); 
                                  else handleCancelEntireDupla(); 
                              }} 
                              className="text-red-400 hover:text-red-600 p-2 text-xs font-bold transition-colors"
                              title="Desistir"
                          >
                              Desistir
                          </button>
                        </div>
                        
                        {/* Ranking Points Info Section */}
                        <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-100 flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-gray-400 flex items-center gap-1">
                                    👤 Eu: <span className="text-gray-700">{myFreshPoints} pts</span>
                                </span>
                                {r.hasPartner && (
                                    <span className="text-gray-400 flex items-center gap-1">
                                        👤 Parceiro: <span className="text-gray-700">{partnerPoints} pts</span>
                                    </span>
                                )}
                            </div>
                            {r.hasPartner && (
                                <div className="pt-1.5 border-t border-gray-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-padel-dark uppercase tracking-wider">Soma Total Dupla:</span>
                                    <span className="bg-padel text-white px-2 py-0.5 rounded text-xs font-black shadow-sm">
                                        {totalSum} pts
                                    </span>
                                </div>
                            )}
                        </div>

                        {(canAddPartner || canChangePartner) && (
                          <div className="pt-2 border-t border-gray-50">
                            <button 
                              onClick={() => {
                                setIsAddingPartnerToRegId(r.id);
                                setAddPartnerSearchTerm('');
                                setShowAddPartnerSuggestions(false);
                              }}
                              className={`w-full py-2 ${canChangePartner ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-padel/10 text-padel-dark hover:bg-padel/20'} text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2`}
                            >
                              <span>{canChangePartner ? '🔄 Trocar Parceiro' : '➕ Adicionar Parceiro'}</span>
                            </button>
                          </div>
                        )}
                    </li>
                );
            })}
            {myRegistrations.length === 0 && (
                <li className="text-center py-4 text-gray-400 text-xs italic">
                    Ainda não tens inscrições para esta data.
                </li>
            )}
        </ul>
    </div>
  );

  // --- CLOSED STATE UI ---
  if (!appState.registrationsOpen) {
      return (
          <div className="space-y-6">
              <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-gray-300 text-center animate-fade-in">
                  <div className="w-20 h-20 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                      🔒
                  </div>
                  <h2 className="text-2xl font-black text-gray-800 italic uppercase transform -skew-x-6 mb-2">
                      Inscrições <span className="text-gray-400">Fechadas</span>
                  </h2>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                      <p className="text-sm text-blue-800 font-bold leading-relaxed">
                          As inscrições para o próximo evento abrem automaticamente todos os Domingos às <span className="text-padel-dark text-lg font-black">{appState.autoOpenTime || '15:00'}h</span>.
                      </p>
                  </div>
                  <p className="text-xs text-gray-500 italic">
                      Excecionalmente, a organização poderá abrir as inscrições noutra hora definida. Fica atento às notificações!
                  </p>
              </div>

              {/* Existing registrations view */}
              {myRegistrations.length > 0 && renderMyRegistrationsList()}

              {showCancelSplitModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl border-t-8 border-padel">
                        <h3 className="font-black text-gray-800 mb-2 uppercase italic">Cancelar Inscrição</h3>
                        <p className="text-sm text-gray-500 mb-6">Como tens um parceiro associado, como desejas proceder?</p>
                        <div className="space-y-3">
                            <Button onClick={handleCancelOnlyMe} className="w-full py-3">Remover apenas EU</Button>
                            <Button onClick={handleCancelEntireDupla} variant="danger" className="w-full py-3">Remover AMBOS (Dupla)</Button>
                            <Button onClick={() => setShowCancelSplitModal(false)} variant="ghost" className="w-full">Voltar</Button>
                        </div>
                    </div>
                </div>
              )}
          </div>
      );
  }

  return (
    <div className="space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-padel relative">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-baseline flex-wrap gap-2">
            <span>📝 Inscrição Semanal</span>
            <span className="text-sm font-medium text-gray-400 whitespace-nowrap">({appState.nextSundayDate})</span>
        </h2>
        
        {successMsg && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-3 bg-green-100 text-green-800 rounded-lg flex items-center gap-2 animate-bounce border border-green-200 shadow-lg">
            ✅ {successMsg}
            </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Atividade</label>
                <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => { setRegType('game'); setSelectedShift(null); }} className={`p-3 rounded-lg border-2 text-sm font-bold flex flex-col items-center gap-1 transition-all ${regType === 'game' ? 'border-padel bg-padel/10 text-padel-dark' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <span className="text-2xl">🎾</span>
                        <span>Jogos</span>
                    </button>
                    <button type="button" onClick={() => { setRegType('training'); setSelectedShift(null); setRegisterMode('individual'); }} className={`p-3 rounded-lg border-2 text-sm font-bold flex flex-col items-center gap-1 transition-all ${regType === 'training' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <span className="text-2xl">🎓</span>
                        <span>Treino</span>
                    </button>
                </div>
            </div>

            <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Turno</label>
            <div className="grid grid-cols-1 gap-3">
                {Object.values(Shift).map((shift) => {
                const isRegistered = myRegistrations.some(r => r.shift === shift);
                const { remaining, total, percentage } = getShiftAvailability(shift, regType);
                const isFull = remaining === 0;

                return (
                    <button key={shift} type="button" disabled={isRegistered} onClick={() => setSelectedShift(shift)} className={`relative p-3 rounded-lg border-2 text-left transition-all overflow-hidden ${selectedShift === shift ? 'border-padel bg-padel/5' : isRegistered ? 'bg-gray-50 border-gray-100 opacity-80 cursor-not-allowed' : 'border-gray-200 hover:border-padel/50 bg-white'}`}>
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <div className={`font-bold ${isRegistered ? 'text-green-600' : 'text-gray-700'}`}>{shift}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {isRegistered ? '✅ Já inscrito' : isFull ? '⚠️ Esgotado' : `Vagas: ${remaining} de ${total}`}
                                </div>
                            </div>
                        </div>
                        {!isRegistered && <div className={`absolute bottom-0 left-0 h-1 transition-all duration-500 ${isFull ? 'bg-yellow-400' : 'bg-green-500'}`} style={{ width: `${percentage}%` }} />}
                    </button>
                );
                })}
            </div>
            </div>

            {regType === 'game' && (
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Modo</label>
                    <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={registerMode === 'individual'} onChange={() => { setRegisterMode('individual'); resetPartnerForm(); }} className="text-padel focus:ring-padel" />
                            <span>Individual</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" checked={registerMode === 'partner'} onChange={() => setRegisterMode('partner')} className="text-padel focus:ring-padel" />
                            <span>Com Dupla</span>
                        </label>
                    </div>
                    {registerMode === 'partner' && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4">
                            {partnerSearchStatus !== 'found' ? (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Pesquisar Parceiro..."
                                        value={partnerSearchTerm}
                                        onChange={(e) => { setPartnerSearchTerm(e.target.value); setShowSuggestions(true); }}
                                        className="w-full p-2 border border-gray-300 rounded outline-none"
                                    />
                                    {showSuggestions && partnerSearchTerm && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow-lg">
                                            {filteredCandidates.map(p => (
                                                <li key={p.id} onClick={() => handleSelectPartner(p)} className="p-2 hover:bg-gray-100 cursor-pointer text-sm">
                                                    {p.name} ({p.phone})
                                                </li>
                                            ))}
                                            <li onClick={handleManualNotFound} className="p-2 text-blue-500 font-bold text-xs cursor-pointer">+ Registar Novo</li>
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                <div className="flex justify-between items-center bg-white p-2 rounded border">
                                    <span className="font-bold">{selectedPartnerName}</span>
                                    <button type="button" onClick={resetPartnerForm} className="text-red-500">Remover</button>
                                </div>
                            )}
                            {partnerSearchStatus === 'not_found' && (
                                <div className="p-3 bg-white rounded border space-y-2">
                                    <input placeholder="Nome" value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)} className="w-full p-2 border rounded" />
                                    <input placeholder="Telemóvel" value={newPartnerPhone} onChange={e => setNewPartnerPhone(e.target.value)} className="w-full p-2 border rounded" />
                                    <Button type="button" onClick={registerNewPartner} className="w-full py-1 text-xs">Criar Parceiro</Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Button type="submit" className="w-full py-3 text-lg" disabled={!selectedShift || (registerMode === 'partner' && !selectedPartnerId)}>
                Confirmar Inscrição
            </Button>
        </form>
        </div>

        {/* Improved my registrations section for the main view */}
        {renderMyRegistrationsList()}

        {/* ADD / CHANGE PARTNER MODAL */}
        {isAddingPartnerToRegId && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl border-t-8 border-padel">
                <h3 className="font-black text-gray-800 mb-2 uppercase italic">
                  {myRegistrations.find(r => r.id === isAddingPartnerToRegId)?.hasPartner ? "Trocar Parceiro" : "Adicionar Parceiro"}
                </h3>
                <p className="text-xs text-gray-500 mb-4 italic">
                  {myRegistrations.find(r => r.id === isAddingPartnerToRegId)?.hasPartner 
                    ? "Escolhe um novo parceiro para substituir o atual." 
                    : "Associa um parceiro à tua inscrição individual para formar dupla."}
                </p>
                
                <div className="relative mb-6">
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou telemóvel..."
                        value={addPartnerSearchTerm}
                        onChange={(e) => {
                          setAddPartnerSearchTerm(e.target.value);
                          setShowAddPartnerSuggestions(true);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-padel transition-all text-sm"
                        autoFocus
                    />
                    {showAddPartnerSuggestions && addPartnerSearchTerm && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-100 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto overflow-x-hidden">
                            {filteredAddPartnerCandidates.map(p => (
                                <li 
                                  key={p.id} 
                                  onClick={() => handleAddPartnerToExisting(p)} 
                                  className="p-3 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-50 last:border-0 flex justify-between items-center"
                                >
                                    <span className="font-bold text-gray-700">{p.name}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">{p.phone}</span>
                                </li>
                            ))}
                            {filteredAddPartnerCandidates.length === 0 && (
                                <li className="p-4 text-center text-xs text-gray-400 italic">Nenhum jogador encontrado.</li>
                            )}
                        </ul>
                    )}
                </div>

                <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setIsAddingPartnerToRegId(null);
                        setAddPartnerSearchTerm('');
                      }} 
                      className="w-full font-bold"
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
          </div>
        )}

        {showCancelSplitModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-2xl border-t-8 border-padel">
                    <h3 className="font-black text-gray-800 mb-2 uppercase italic">Cancelar Inscrição</h3>
                    <p className="text-sm text-gray-500 mb-6">Como tens um parceiro associado, como desejas proceder?</p>
                    <div className="space-y-3">
                        <Button onClick={handleCancelOnlyMe} className="w-full py-3">Remover apenas EU</Button>
                        <Button onClick={handleCancelEntireDupla} variant="danger" className="w-full py-3">Remover AMBOS (Dupla)</Button>
                        <Button onClick={() => setShowCancelSplitModal(false)} variant="ghost" className="w-full">Voltar</Button>
                    </div>
                </div>
            </div>
        )}

        {waitingListPrompt && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-xl max-w-sm w-full">
                    <h3 className="font-bold mb-4">Turno Completo</h3>
                    <p className="mb-4 text-sm">Ficar na lista de suplentes?</p>
                    <div className="flex gap-2">
                        <Button onClick={() => handleRegister(undefined, true)} className="flex-1">Sim</Button>
                        <Button onClick={() => setWaitingListPrompt(null)} variant="ghost" className="flex-1">Não</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
