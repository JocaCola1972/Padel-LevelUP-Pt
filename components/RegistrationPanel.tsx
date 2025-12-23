
import React, { useState, useEffect } from 'react';
import { AppState, Player, Registration, Shift } from '../types';
import { getAppState, addRegistration, getRegistrations, removeRegistration, getPlayers, savePlayer, updateRegistration, generateUUID, subscribeToChanges } from '../services/storageService';
import { Button } from './Button';

interface RegistrationPanelProps {
  currentUser: Player;
}

type SearchStatus = 'idle' | 'searching' | 'found' | 'not_found';

export const RegistrationPanel: React.FC<RegistrationPanelProps> = ({ currentUser }) => {
  const [appState, setAppState] = useState<AppState>(getAppState());
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  
  // Registration Type (Game vs Training)
  const [regType, setRegType] = useState<'game' | 'training'>('game');

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

  // Waiting List confirmation modal
  const [waitingListPrompt, setWaitingListPrompt] = useState<{ shift: Shift, type: 'game' | 'training', asPartner: boolean } | null>(null);

  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  // Store ALL registrations to calculate availability
  const [allTournamentRegistrations, setAllTournamentRegistrations] = useState<Registration[]>([]);
  
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

  // Define filteredCandidates
  const filteredCandidates = allPlayers.filter(p => 
    p.name.toLowerCase().includes(partnerSearchTerm.toLowerCase()) || 
    p.phone.includes(partnerSearchTerm)
  ).slice(0, 5);

  const loadData = () => {
    const currentState = getAppState();
    setAppState(currentState);
    const allRegs = getRegistrations();
    const playersList = getPlayers();
    setAllPlayers(playersList.filter(p => p.id !== currentUser.id));

    // Filter: Todas as inscrições para a data atual para cálculo de vagas
    const regsForDate = allRegs.filter(r => r.date === currentState.nextSundayDate);
    setAllTournamentRegistrations(regsForDate);

    // Filter: Inscrições do utilizador logado (Como Jogador OU Como Parceiro)
    // CRÍTICO: Verificar se o utilizador logado é parceiro numa inscrição de outrem
    const activeRegs = regsForDate.filter(r => r.playerId === currentUser.id || r.partnerId === currentUser.id);

    // Mostrar as mais recentes primeiro
    setMyRegistrations(activeRegs.reverse());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    const interval = setInterval(loadData, 5000); 
    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, [currentUser.id]);

  const handleRegister = (e?: React.FormEvent, forceWaitingList = false) => {
    if (e) e.preventDefault();
    if (!selectedShift) return;

    // 1. Verificar se o utilizador já está inscrito neste turno
    const myConflict = allTournamentRegistrations.find(r => 
        r.shift === selectedShift && 
        (r.playerId === currentUser.id || r.partnerId === currentUser.id)
    );

    if (myConflict) {
        const conflictType = myConflict.type === 'training' ? 'TREINO' : 'JOGOS';
        alert(`Já tens uma inscrição ativa neste turno em ${conflictType}! Não podes inscrever-te em duas atividades ao mesmo tempo.`);
        return;
    }

    if (registerMode === 'partner' && !selectedPartnerId) {
        alert("Por favor verifica e seleciona a tua dupla antes de confirmar.");
        return;
    }

    // 2. Verificar Capacidade
    if (!forceWaitingList) {
        const { remaining } = getShiftAvailability(selectedShift, regType);
        const needed = registerMode === 'partner' ? 2 : 1;
        
        if (remaining < needed) {
            setWaitingListPrompt({ shift: selectedShift, type: regType, asPartner: registerMode === 'partner' });
            return;
        }
    }

    // 3. Verificar Conflito do Parceiro
    if (registerMode === 'partner' && selectedPartnerId) {
        const partnerConflict = allTournamentRegistrations.find(r => 
            r.shift === selectedShift && 
            (r.playerId === selectedPartnerId || r.partnerId === selectedPartnerId)
        );

        if (partnerConflict) {
            alert(`⚠️ IMPOSSÍVEL INSCREVER: O jogador ${selectedPartnerName} já está inscrito neste turno.`);
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
      partnerId: registerMode === 'partner' ? selectedPartnerId : undefined,
      type: regType,
      isWaitingList: forceWaitingList
    };

    addRegistration(newReg);
    setSuccessMsg(forceWaitingList ? 'Colocado em lista de suplentes!' : 'Inscrição confirmada!');
    setWaitingListPrompt(null);
    
    setTimeout(() => setSuccessMsg(''), 3000);
    setSelectedShift(null);
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

      const cleanPhone = newPartnerPhone.replace(/\s+/g, '');
      const existingPlayer = allPlayers.find(p => p.phone.replace(/\s+/g, '') === cleanPhone);

      let effectiveId = existingPlayer ? existingPlayer.id : generateUUID();
      let effectiveName = existingPlayer ? existingPlayer.name : newPartnerName;

      if (!existingPlayer) {
         const newPlayer: Player = {
            id: effectiveId,
            name: effectiveName,
            phone: cleanPhone,
            totalPoints: 0,
            gamesPlayed: 0,
            participantNumber: 0 
         };
         savePlayer(newPlayer);
      }
     
     setSelectedPartnerId(effectiveId);
     setSelectedPartnerName(effectiveName);
     setPartnerSearchStatus('found');

     if (isEditing && editingRegId) {
         confirmAddPartnerToExisting(editingRegId, effectiveId, effectiveName);
     }
  };

  const getShiftAvailability = (shift: Shift, type: 'game' | 'training') => {
      const config = appState.courtConfig[shift];
      if (!config) return { total: 0, used: 0, remaining: 0, percentage: 100 };
      const numCourts = config[type];
      const totalSlots = numCourts * 4;
      
      // Sincronizar contagem: Tratar nulo como 'game'
      const usedSlots = allTournamentRegistrations
          .filter(r => 
            r.shift === shift && 
            (r.type === type || (!r.type && type === 'game')) && 
            !r.isWaitingList
          )
          .reduce((acc, r) => acc + (r.hasPartner ? 2 : 1), 0);
          
      const remaining = Math.max(0, totalSlots - usedSlots);
      const percentage = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 100;
      return { total: totalSlots, used: usedSlots, remaining, percentage };
  };

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
      if (!editingRegId || !selectedPartnerId) return;
      confirmAddPartnerToExisting(editingRegId, selectedPartnerId, selectedPartnerName);
  };

  const initiateCancelSingle = (reg: Registration, e: React.MouseEvent) => {
    e.preventDefault();
    setCancelTarget({ type: 'single', reg });
  };

  const confirmCancellation = () => {
      if (!cancelTarget) return;
      if (cancelTarget.type === 'single') {
          removeRegistration(cancelTarget.reg.id);
          setSuccessMsg('Inscrição cancelada com sucesso.');
      } else {
          myRegistrations.forEach(r => removeRegistration(r.id));
          setSuccessMsg('Todas as inscrições foram canceladas.');
      }
      setCancelTarget(null);
      setTimeout(() => setSuccessMsg(''), 3000);
      loadData();
  };

  const handleClaimSlot = (reg: Registration) => {
    updateRegistration(reg.id, { isWaitingList: false });
    setSuccessMsg('Lugar confirmado!');
    setTimeout(() => setSuccessMsg(''), 3000);
    loadData();
  };

  const renderMyRegistrations = () => {
    if (myRegistrations.length === 0) return <p className="text-sm text-gray-400 italic">Nenhuma inscrição ativa.</p>;

    return (
        <div className="space-y-4">
            <ul className="space-y-3">
                {myRegistrations.map(r => {
                    const isFinished = appState.isTournamentFinished;
                    const isTraining = r.type === 'training';
                    const isWaiting = r.isWaitingList;
                    const { remaining } = getShiftAvailability(r.shift, r.type || 'game');
                    const canPromote = isWaiting && remaining >= (r.hasPartner ? 2 : 1);

                    // Determinar quem é o parceiro (independente de quem inscreveu quem)
                    const companionId = r.playerId === currentUser.id ? r.partnerId : r.playerId;
                    const companionData = getPlayers().find(p => p.id === companionId);
                    const companionName = r.playerId === currentUser.id ? (r.partnerName || '...') : (companionData?.name || 'Parceiro');
                    const companionPhoto = companionData?.photoUrl;

                    return (
                        <li key={r.id} className={`bg-white p-3 rounded-lg shadow-sm border flex items-center justify-between group transition-all ${canPromote ? 'ring-2 ring-yellow-400 border-yellow-200' : 'border-gray-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`text-xs font-bold px-2 py-1 rounded border flex flex-col items-center min-w-[60px] ${
                                    isWaiting 
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200' 
                                    : isTraining 
                                        ? 'bg-orange-50 text-orange-700 border-orange-100' 
                                        : 'bg-padel-light/20 text-padel-dark border-transparent'
                                }`}>
                                    <span className="text-[10px] leading-none mb-1">{isWaiting ? '⏳ SUPLENTE' : isTraining ? '🎓 TREINO' : '🎾 JOGO'}</span>
                                    <span>{r.shift.split(' - ')[0]}</span>
                                </div>
                                
                                <div>
                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{r.date}</div>
                                    <div className="text-xs text-gray-700 mt-1 flex items-center gap-2">
                                        {r.hasPartner ? (
                                            <>
                                                <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden border border-gray-100">
                                                    {companionPhoto ? (
                                                        <img src={companionPhoto} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>
                                                    )}
                                                </div>
                                                <span className="font-semibold">{companionName}</span>
                                                {r.partnerId === currentUser.id && (
                                                    <span className="text-[8px] bg-blue-50 text-blue-600 px-1 rounded font-black">CONVIDADO</span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="italic text-gray-400">Individual</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {canPromote && (
                                    <button
                                        onClick={() => handleClaimSlot(r)}
                                        className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-3 py-1 rounded-full animate-pulse hover:bg-yellow-500 shadow-sm"
                                    >
                                        OCUPAR VAGA ⚡
                                    </button>
                                )}
                                {!isTraining && r.playerId === currentUser.id && (
                                    <button
                                        type="button"
                                        disabled={isFinished}
                                        onClick={() => handleEditPartner(r.id)}
                                        className={`p-2 rounded-full transition-colors ${
                                            isFinished 
                                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                            : 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                                        }`}
                                    >
                                        {isFinished ? '🔒' : (r.hasPartner ? '🔄' : '➕👤')}
                                    </button>
                                )}
                                <button 
                                    type="button"
                                    disabled={isFinished}
                                    onClick={(e) => initiateCancelSingle(r, e)}
                                    className="p-2 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                    {isFinished ? '🔒' : '🗑️'}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
  };

  if (!appState.registrationsOpen) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-xl border-dashed border-2 border-gray-300">
        <h3 className="text-xl font-bold text-gray-400 mb-2">Inscrições Fechadas</h3>
        <p className="text-gray-600 font-medium">As inscrições abrem todos os Domingos, às 15h00m.</p>
        <div className="mt-8 text-left">
            <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">As tuas inscrições</h4>
             {renderMyRegistrations()}
        </div>
      </div>
    );
  }

  const renderSearchUI = (isModal: boolean) => (
      <div className="space-y-4">
          {partnerSearchStatus !== 'found' && (
              <div className="relative">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pesquisar Parceiro</label>
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                          <input
                              type="text"
                              placeholder="Nome ou Telemóvel..."
                              value={partnerSearchTerm}
                              onChange={(e) => {
                                  setPartnerSearchTerm(e.target.value);
                                  setShowSuggestions(true);
                                  setPartnerSearchStatus('idle');
                              }}
                              className="w-full p-2 border border-gray-300 rounded focus:border-padel focus:ring-1 outline-none"
                              autoComplete="off"
                          />
                          {showSuggestions && partnerSearchTerm.length > 0 && (
                              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-b-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                                  {filteredCandidates.map(player => (
                                      <li key={player.id} onClick={() => handleSelectPartner(player)} className="p-2 hover:bg-padel-light/20 cursor-pointer flex justify-between items-center text-sm border-b border-gray-50 last:border-0">
                                          <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden">
                                                  {player.photoUrl ? <img src={player.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px]">👤</div>}
                                              </div>
                                              <span className="font-medium text-gray-800">{player.name}</span>
                                          </div>
                                          <span className="text-xs text-gray-500">{player.phone}</span>
                                      </li>
                                  ))}
                              </ul>
                          )}
                      </div>
                  </div>
                   {partnerSearchStatus !== 'not_found' && (
                      <div className="mt-2 text-right">
                          <button type="button" onClick={handleManualNotFound} className="text-xs text-padel-dark font-bold hover:underline">Registar Novo Jogador</button>
                      </div>
                   )}
              </div>
          )}

          {partnerSearchStatus === 'found' && (
              <div className="bg-green-100 p-3 rounded border border-green-200 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white overflow-hidden">
                          {selectedPartnerPhoto ? <img src={selectedPartnerPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-green-500">👤</div>}
                      </div>
                      <div className="text-green-900 font-bold">{selectedPartnerName}</div>
                  </div>
                  <button type="button" onClick={resetPartnerForm} className="text-gray-400 hover:text-red-500 font-bold text-xl">&times;</button>
              </div>
          )}

          {partnerSearchStatus === 'not_found' && (
              <div className="animate-slide-down bg-white p-4 rounded-lg border-l-4 border-yellow-400 shadow-sm mt-2">
                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Nome Completo</label>
                          <input type="text" value={newPartnerName} onChange={(e) => setNewPartnerName(e.target.value)} className="w-full p-2 border border-gray-300 rounded outline-none" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Telemóvel</label>
                          <input type="tel" value={newPartnerPhone} onChange={(e) => setNewPartnerPhone(e.target.value)} className="w-full p-2 border border-gray-300 rounded outline-none" />
                      </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setPartnerSearchStatus('idle')} className="flex-1 py-2 text-xs border rounded">Cancelar</button>
                      <Button type="button" onClick={() => registerNewPartner(isModal)} className="flex-1 py-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-white">Criar e Associar</Button>
                  </div>
              </div>
          )}
      </div>
  );

  return (
    <div className="space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-padel relative">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-baseline flex-wrap gap-2">
            <span>📝 Inscrição Semanal</span>
            <span className="text-sm font-medium text-gray-400 whitespace-nowrap">({appState.nextSundayDate})</span>
        </h2>
        
        {successMsg && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg flex items-center gap-2 animate-pulse">
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
                                    {isRegistered ? '✅ Já inscrito' : isFull ? '⚠️ Vagas Esgotadas (Suplentes)' : `Vagas: ${remaining} de ${total}`}
                                </div>
                            </div>
                            {!isRegistered && (
                                <div className={`text-xs font-bold px-2 py-1 rounded ${isFull ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                    {isFull ? 'SUPLENTES' : `${remaining} vagas`}
                                </div>
                            )}
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
                    {registerMode === 'partner' && <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4">{renderSearchUI(false)}</div>}
                </div>
            )}

            <Button type="submit" className="w-full py-3 text-lg" disabled={!selectedShift || (registerMode === 'partner' && !selectedPartnerId)}>
                Confirmar Inscrição
            </Button>
        </form>

        {waitingListPrompt && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-sm border-t-4 border-yellow-500">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">⏳</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Turno Completo</h3>
                        <p className="text-sm text-gray-600">Desejas ficar na lista de SUPLENTES para este turno?</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setWaitingListPrompt(null)} className="flex-1">Não, voltar</Button>
                        <Button onClick={() => handleRegister(undefined, true)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white border-none">Sim, suplente</Button>
                    </div>
                </div>
            </div>
        )}

        {editingRegId && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-sm">
                    <h3 className="text-xl font-bold mb-4 text-gray-800">Alterar Dupla</h3>
                    {renderSearchUI(true)}
                    <div className="flex gap-2 mt-6">
                        <Button variant="ghost" className="flex-1" onClick={() => { setEditingRegId(null); resetPartnerForm(); }}>Fechar</Button>
                        <Button className="flex-1" disabled={!selectedPartnerId} onClick={handleSaveEditPartner}>Gravar</Button>
                    </div>
                </div>
            </div>
        )}
        </div>

        <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-white/40">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">As tuas Inscrições</h3>
            {renderMyRegistrations()}
        </div>
        
        {cancelTarget && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-sm border-t-4 border-red-500">
                    <div className="text-center mb-6">
                        <h3 className="text-xl font-bold mb-2">Cancelar Inscrição?</h3>
                        <p className="text-sm text-gray-600">Vais libertar o teu lugar para outros jogadores.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setCancelTarget(null)} className="flex-1">Manter</Button>
                        <Button variant="danger" onClick={confirmCancellation} className="flex-1">Confirmar</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
