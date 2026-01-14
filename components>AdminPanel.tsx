
import React, { useState, useEffect } from 'react';
import { AppState, Player, Registration, Shift, MatchRecord, GameResult, Message } from '../types';
import { getAppState, updateAppState, getRegistrations, getPlayers, removeRegistration, updateRegistration, getMatches, subscribeToChanges, deleteMatchesByDate, deleteRegistrationsByDate, addRegistration, generateUUID, approvePlayer, removePlayer, saveMessage, getCurrentUser } from '../services/storageService';
import { Button } from './Button';

declare const XLSX: any;

const DEFAULT_ORDER = ['approvals', 'broadcast', 'config', 'courts', 'report', 'registrations'];

export const AdminPanel: React.FC = () => {
  const [state, setState] = useState<AppState>(getAppState());
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentUser = getCurrentUser();

  // Broadcast State
  const [broadcastTarget, setBroadcastTarget] = useState<Shift | 'ALL'>('ALL');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  const [reportFilterDate, setReportFilterDate] = useState<string>(getAppState().nextSundayDate);
  const [regFilterDate, setRegFilterDate] = useState<string>(getAppState().nextSundayDate);

  const [isNewRegModalOpen, setIsNewRegModalOpen] = useState(false);
  const [newRegShift, setNewRegShift] = useState<Shift>(Shift.MORNING_1);
  const [newRegType, setNewRegType] = useState<'game' | 'training'>('game');
  const [newRegP1, setNewRegP1] = useState<Player | null>(null);
  const [newRegP2, setNewRegP2] = useState<Player | null>(null);
  const [p1Search, setP1Search] = useState('');
  const [p2Search, setP2Search] = useState('');

  const [regToDelete, setRegToDelete] = useState<{ reg: Registration, mainPlayerName: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRegResetConfirm, setShowRegResetConfirm] = useState(false);
  const [showEndTournament, setShowEndTournament] = useState(false);

  const loadData = () => {
    const appState = getAppState();
    let currentOrder = appState.adminSectionOrder || DEFAULT_ORDER;
    const missingSections = DEFAULT_ORDER.filter(s => !currentOrder.includes(s));
    if (missingSections.length > 0) {
        currentOrder = [...currentOrder, ...missingSections];
        updateAppState({ adminSectionOrder: currentOrder });
    }
    setState({ ...appState, adminSectionOrder: currentOrder });
    setRegistrations(getRegistrations());
    setPlayers(getPlayers());
    setMatches(getMatches());
    if (!reportFilterDate) setReportFilterDate(appState.nextSundayDate);
    if (!regFilterDate) setRegFilterDate(appState.nextSundayDate);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    return () => unsubscribe();
  }, []);

  const handleSendBroadcast = async () => {
      if (!broadcastContent.trim() || !currentUser) return;
      setIsSendingBroadcast(true);
      try {
          const msg: Message = {
              id: generateUUID(),
              senderId: currentUser.id,
              senderName: `ADMIN: ${currentUser.name}`,
              receiverId: broadcastTarget,
              content: broadcastContent,
              timestamp: Date.now(),
              read: false
          };
          await saveMessage(msg);
          setBroadcastContent('');
          alert("Mensagem enviada com sucesso!");
      } catch (err) {
          alert("Erro ao enviar mensagem.");
      } finally {
          setIsSendingBroadcast(false);
      }
  };

  const toggleRegistrations = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
        const newValue = !state.registrationsOpen;
        await updateAppState({ registrationsOpen: newValue });
        showMessageTemporarily();
    } finally {
        setIsLoading(false);
    }
  };

  const updateCourtConfig = async (shift: Shift, type: 'game' | 'training', value: number) => {
    const safeValue = Math.max(0, Math.min(15, value));
    const newConfig = { ...state.courtConfig, [shift]: { ...state.courtConfig[shift], [type]: safeValue } };
    await updateAppState({ courtConfig: newConfig });
    showMessageTemporarily();
  };

  const updateDate = async (dateStr: string) => {
    await updateAppState({ nextSundayDate: dateStr, isTournamentFinished: false });
    setReportFilterDate(dateStr);
    setRegFilterDate(dateStr);
    showMessageTemporarily();
  };

  const moveSection = async (key: string, direction: 'up' | 'down') => {
      const currentOrder = [...(state.adminSectionOrder || DEFAULT_ORDER)];
      const index = currentOrder.indexOf(key);
      if (index === -1) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= currentOrder.length) return;
      [currentOrder[index], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[index]];
      await updateAppState({ adminSectionOrder: currentOrder });
      showMessageTemporarily();
  };

  const confirmDeleteEntireRegistration = async () => {
      if (!regToDelete) return;
      await removeRegistration(regToDelete.reg.id);
      setRegToDelete(null);
  };

  const showMessageTemporarily = () => {
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 2000);
  };

  const getPlayerDetails = (id: string) => players.find(p => p.id === id);

  const handleSetStartingCourt = async (regId: string, court: number) => {
      await updateRegistration(regId, { startingCourt: court });
      showMessageTemporarily();
  };

  const handleAdminApprove = async (pid: string) => {
      await approvePlayer(pid);
      showMessageTemporarily();
  };

  const handleAdminReject = async (pid: string) => {
      if (confirm("Deseja ELIMINAR este utilizador?")) {
          await removePlayer(pid);
          showMessageTemporarily();
      }
  };

  const filteredRegistrations = registrations.filter(r => r.date === regFilterDate);

  const exportToExcel = () => {
      if (matches.filter(m => m.date === reportFilterDate).length === 0) return;
      const data = matches.filter(m => m.date === reportFilterDate).map(m => ({
          'Data': m.date, 'Turno': m.shift, 'Campo': m.courtNumber, 'Equipa': m.playerIds.map(pid => getPlayerDetails(pid)?.name).join(' & '), 'Resultado': m.result
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Resultados");
      XLSX.writeFile(wb, `Resultados_${reportFilterDate}.xlsx`);
  };

  const handleAdminNewReg = async () => {
      if (!newRegP1) return;
      await addRegistration({
          id: generateUUID(), playerId: newRegP1.id, shift: newRegShift, date: state.nextSundayDate,
          hasPartner: !!newRegP2, partnerId: newRegP2?.id, partnerName: newRegP2?.name, type: newRegType
      });
      setIsNewRegModalOpen(false);
  };

  const renderSection = (key: string) => {
      const order = state.adminSectionOrder || DEFAULT_ORDER;
      const index = order.indexOf(key);
      const isFirst = index === 0;
      const isLast = index === order.length - 1;
      const controls = (
          <div className="flex gap-1 ml-4">
              <button onClick={() => moveSection(key, 'up')} disabled={isFirst} className="w-8 h-8 flex items-center justify-center rounded-lg border bg-white shadow-sm transition-all">↑</button>
              <button onClick={() => moveSection(key, 'down')} disabled={isLast} className="w-8 h-8 flex items-center justify-center rounded-lg border bg-white shadow-sm transition-all">↓</button>
          </div>
      );

      switch (key) {
          case 'approvals':
              const pending = players.filter(p => p.isApproved === false);
              return (
                <div key="approvals" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-orange-500 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold">🛡️ Aprovações</h2>
                        {controls}
                    </div>
                    <div className="space-y-3">
                        {pending.map(p => (
                            <div key={p.id} className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl flex items-center justify-between">
                                <span className="font-black text-gray-800">{p.name} ({p.phone})</span>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAdminApprove(p.id)} className="bg-green-500 text-white px-4 py-2 rounded-full text-xs font-black">APROVAR</button>
                                    <button onClick={() => handleAdminReject(p.id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-full text-xs font-black">ELIMINAR</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              );
          case 'broadcast':
              return (
                <div key="broadcast" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-purple-500 animate-fade-in">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-bold">📢 Mensagem Coletiva</h2>
                        {controls}
                    </div>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Enviar Para:</label>
                            <select 
                                value={broadcastTarget} 
                                onChange={(e) => setBroadcastTarget(e.target.value as any)}
                                className="w-full p-3 bg-gray-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-purple-400"
                            >
                                <option value="ALL">🌎 Todos os Membros (Geral)</option>
                                {Object.values(Shift).map(s => <option key={s} value={s}>🎾 Inscritos no Turno: {s}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Conteúdo da Mensagem:</label>
                            <textarea 
                                value={broadcastContent}
                                onChange={(e) => setBroadcastContent(e.target.value)}
                                placeholder="Ex: Pessoal, o pequeno almoço amanhã é às 10h!"
                                className="w-full p-4 bg-gray-50 border rounded-xl min-h-[100px] outline-none focus:ring-2 focus:ring-purple-400 font-medium"
                            />
                        </div>
                        <Button 
                            onClick={handleSendBroadcast} 
                            disabled={isSendingBroadcast || !broadcastContent.trim()} 
                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 shadow-purple-100"
                            isLoading={isSendingBroadcast}
                        >
                            ENVIAR BROADCAST
                        </Button>
                    </div>
                </div>
              );
          case 'config':
              return (
                <div key="config" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-gray-800 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold">⚙️ Agendamento</h2>
                        {controls}
                    </div>
                    <div className="space-y-4">
                        <Button onClick={toggleRegistrations} className={state.registrationsOpen ? 'bg-red-500' : 'bg-green-500'}>
                            {state.registrationsOpen ? 'Fechar Inscrições' : 'Abrir Inscrições'}
                        </Button>
                        <input type="date" value={state.nextSundayDate} onChange={(e) => updateDate(e.target.value)} className="w-full p-3 border rounded-lg" />
                    </div>
                </div>
              );
          default: return null;
      }
  };

  return (
    <div className="space-y-8 pb-10">
      {(state.adminSectionOrder || DEFAULT_ORDER).map(key => renderSection(key))}
      {isNewRegModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold mb-4">Nova Inscrição</h3>
                  <Button onClick={handleAdminNewReg}>Gravar</Button>
                  <Button onClick={() => setIsNewRegModalOpen(false)}>Cancelar</Button>
              </div>
          </div>
      )}
    </div>
  );
};
