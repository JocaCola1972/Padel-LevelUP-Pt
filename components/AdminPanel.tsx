
import React, { useState, useEffect } from 'react';
import { AppState, Player, Registration, Shift, MatchRecord, GameResult } from '../types';
import { getAppState, updateAppState, getRegistrations, getPlayers, removeRegistration, updateRegistration, getMatches, subscribeToChanges, deleteMatchesByDate, deleteRegistrationsByDate, addRegistration, generateUUID, approvePlayer, removePlayer } from '../services/storageService';
import { Button } from './Button';

// Declare XLSX for sheetjs
declare const XLSX: any;

const DEFAULT_ORDER = ['approvals', 'config', 'courts', 'report', 'registrations'];

export const AdminPanel: React.FC = () => {
  const [state, setState] = useState<AppState>(getAppState());
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter state for the report section
  const [reportFilterDate, setReportFilterDate] = useState<string>(getAppState().nextSundayDate);
  
  // Filter state for the registrations section
  const [regFilterDate, setRegFilterDate] = useState<string>(getAppState().nextSundayDate);

  // Edit Registration (Add Partner) State
  const [editRegId, setEditRegId] = useState<string | null>(null);
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [selectedPartnerForReg, setSelectedPartnerForReg] = useState<Player | null>(null);

  // New Registration Modal State (Admin)
  const [isNewRegModalOpen, setIsNewRegModalOpen] = useState(false);
  const [newRegShift, setNewRegShift] = useState<Shift>(Shift.MORNING_1);
  const [newRegType, setNewRegType] = useState<'game' | 'training'>('game');
  const [newRegP1, setNewRegP1] = useState<Player | null>(null);
  const [newRegP2, setNewRegP2] = useState<Player | null>(null);
  const [p1Search, setP1Search] = useState('');
  const [p2Search, setP2Search] = useState('');

  // Delete Confirmation State
  const [regToDelete, setRegToDelete] = useState<{ reg: Registration, mainPlayerName: string } | null>(null);

  // Reset Results Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Reset Registrations Confirmation State
  const [showRegResetConfirm, setShowRegResetConfirm] = useState(false);

  // End Tournament Modal State
  const [showEndTournament, setShowEndTournament] = useState(false);

  const loadData = () => {
    const appState = getAppState();
    
    // Migration Logic
    let currentOrder = appState.adminSectionOrder || DEFAULT_ORDER;
    const missingSections = DEFAULT_ORDER.filter(s => !currentOrder.includes(s));
    
    if (missingSections.length > 0) {
        currentOrder = [...currentOrder, ...missingSections];
        updateAppState({ adminSectionOrder: currentOrder });
    }

    // Ensure 'finish' is removed if it somehow still exists in order
    if (currentOrder.includes('finish')) {
        currentOrder = currentOrder.filter(s => s !== 'finish');
        updateAppState({ adminSectionOrder: currentOrder });
    }

    setState({ ...appState, adminSectionOrder: currentOrder });
    setRegistrations(getRegistrations());
    setPlayers(getPlayers());
    setMatches(getMatches());
    
    if (!reportFilterDate) {
        setReportFilterDate(appState.nextSundayDate);
    }
    if (!regFilterDate) {
        setRegFilterDate(appState.nextSundayDate);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    return () => unsubscribe();
  }, []);

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
    const newConfig = {
      ...state.courtConfig,
      [shift]: {
        ...state.courtConfig[shift],
        [type]: safeValue
      }
    };
    await updateAppState({ courtConfig: newConfig });
    showMessageTemporarily();
  };

  const updateGamesPerShift = async (shift: Shift, count: number) => {
    const newLimits = {
        ...state.gamesPerShift,
        [shift]: count
    };
    await updateAppState({ gamesPerShift: newLimits });
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

  const initiateDeleteRegistration = (reg: Registration, playerName: string) => {
      setRegToDelete({ reg, mainPlayerName: playerName });
  };

  const confirmDeleteEntireRegistration = async () => {
      if (!regToDelete) return;
      await removeRegistration(regToDelete.reg.id);
      setRegToDelete(null);
  };

  const handleExecuteResetResults = async () => {
      if (!reportFilterDate) return;
      await deleteMatchesByDate(reportFilterDate);
      setShowResetConfirm(false);
      alert("Resultados eliminados e pontos revertidos com sucesso.");
  };
  
  const handleExecuteResetRegistrations = async () => {
      if (!regFilterDate) return;
      await deleteRegistrationsByDate(regFilterDate);
      setShowRegResetConfirm(false);
      alert("Inscrições eliminadas com sucesso.");
  };

  const showMessageTemporarily = () => {
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 2000);
  };

  const getPlayerDetails = (id: string) => {
    return players.find(player => player.id === id);
  };

  const handleSetStartingCourt = async (regId: string, court: number) => {
      await updateRegistration(regId, { startingCourt: court });
      showMessageTemporarily();
  };

  const handleAdminApprove = async (pid: string) => {
      await approvePlayer(pid);
      showMessageTemporarily();
  };

  const handleAdminReject = async (pid: string) => {
      if (confirm("Tens a certeza que desejas ELIMINAR este utilizador pendente? (Ação irreversível)")) {
          await removePlayer(pid);
          showMessageTemporarily();
      }
  };

  const filteredRegistrations = registrations.filter(r => r.date === regFilterDate);

  const openPartnerModal = (regId: string) => {
      setEditRegId(regId);
      setPartnerSearchTerm('');
      setSelectedPartnerForReg(null);
  };

  const closePartnerModal = () => {
      setEditRegId(null);
  };

  const handleAssociatePartner = async () => {
      if (!editRegId || !selectedPartnerForReg) return;
      await updateRegistration(editRegId, {
          hasPartner: true,
          partnerId: selectedPartnerForReg.id,
          partnerName: selectedPartnerForReg.name
      });
      closePartnerModal();
  };

  const filteredPartnerCandidates = players.filter(p => 
      (p.name.toLowerCase().includes(partnerSearchTerm.toLowerCase()) || 
       p.phone.includes(partnerSearchTerm)) 
  ).slice(0, 5);

  const getPointsForResult = (result: GameResult) => {
      switch (result) {
          case GameResult.WIN: return 4;
          case GameResult.DRAW: return 2;
          case GameResult.LOSS: return 1;
          default: return 0;
      }
  };

  const filteredMatches = matches.filter(m => m.date === reportFilterDate);

  const exportToExcel = () => {
      if (filteredMatches.length === 0) {
          alert("Não existem dados de jogos para esta data.");
          return;
      }
      const data = prepareExportData();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Resultados");
      XLSX.writeFile(wb, `PadelLevelUp_Resultados_${reportFilterDate}.xlsx`);
  };

  const prepareExportData = () => {
      const dataToExport = filteredMatches.map(m => {
          const teamNames = m.playerIds.map(pid => getPlayerDetails(pid)?.name || 'Unknown').join(' & ');
          return {
              'Data': m.date,
              'Turno': m.shift,
              'Campo': m.courtNumber,
              'Jogo Nº': m.gameNumber,
              'Equipa': teamNames,
              'Resultado': m.result === GameResult.WIN ? 'Vitória' : m.result === GameResult.DRAW ? 'Empate' : 'Derrota',
              'Pontos': getPointsForResult(m.result)
          };
      });
      dataToExport.sort((a, b) => {
          if (a.Turno !== b.Turno) return a.Turno.localeCompare(b.Turno);
          if (a.Campo !== b.Campo) return a.Campo - b.Campo;
          return a['Jogo Nº'] - b['Jogo Nº'];
      });
      return dataToExport;
  };

  const handleEndTournament = async () => {
      await updateAppState({ isTournamentFinished: true });
      setShowEndTournament(true);
  };

  const handleDownloadTournamentReport = (format: 'xlsx' | 'xls' | 'csv') => {
      const data = prepareExportData();
      if (data.length === 0) {
          alert("Sem dados para exportar.");
          return;
      }
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Final_Tournament");
      const fileName = `PadelLevelUp_Final_${reportFilterDate}.${format}`;
      if (format === 'csv') {
          XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      } else if (format === 'xls') {
          XLSX.writeFile(wb, fileName, { bookType: 'biff8' });
      } else {
          XLSX.writeFile(wb, fileName);
      }
  };

  const handleAdminNewReg = async () => {
      if (!newRegP1) return;
      
      const newReg: Registration = {
          id: generateUUID(),
          playerId: newRegP1.id,
          shift: newRegShift,
          date: state.nextSundayDate,
          hasPartner: !!newRegP2,
          partnerId: newRegP2?.id,
          partnerName: newRegP2?.name,
          type: newRegType,
          isWaitingList: false
      };

      await addRegistration(newReg);
      alert("Inscrição criada com sucesso pelo Administrador.");
      setIsNewRegModalOpen(false);
      setNewRegP1(null);
      setNewRegP2(null);
  };

  const renderSection = (key: string) => {
      const order = state.adminSectionOrder || DEFAULT_ORDER;
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
              >↑</button>
              <button 
                onClick={() => moveSection(key, 'down')} 
                disabled={isLast}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border bg-white shadow-sm transition-all ${isLast ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:text-padel hover:border-padel'}`}
                title="Mover para baixo"
              >↓</button>
          </div>
      );

      switch (key) {
          case 'approvals':
              const pending = players.filter(p => p.isApproved === false);
              return (
                <div key="approvals" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-orange-500 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                🛡️ Aprovação de Utilizadores
                            </h2>
                            <p className="text-xs text-gray-400 mt-1 font-bold uppercase tracking-widest">Novos registos que aguardam acesso</p>
                        </div>
                        {controls}
                    </div>
                    <div className="space-y-3">
                        {pending.length > 0 ? (
                            pending.map(p => (
                                <div key={p.id} className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl flex items-center justify-between group hover:bg-orange-50 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="font-black text-gray-800 tracking-tighter">{p.name}</span>
                                        <span className="font-mono text-xs text-orange-700">{p.phone}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleAdminApprove(p.id)}
                                            className="px-4 py-2 bg-green-500 text-white rounded-full text-xs font-black shadow-sm hover:bg-green-600 transition-all"
                                        >
                                            APROVAR
                                        </button>
                                        <button 
                                            onClick={() => handleAdminReject(p.id)}
                                            className="px-4 py-2 bg-red-100 text-red-600 rounded-full text-xs font-black hover:bg-red-200 transition-all"
                                        >
                                            ELIMINAR
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                Nenhum utilizador aguarda aprovação.
                            </div>
                        )}
                    </div>
                </div>
              );
          case 'config':
              return (
                <div key="config" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-gray-800 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            ⚙️ Agendamento de Jogos
                        </h2>
                        {controls}
                    </div>
                    <div className="space-y-6">
                        <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-700">Estado das Inscrições</h3>
                                    <p className="text-sm text-gray-500">
                                        {state.registrationsOpen ? 'Abertas (Permite novas inscrições)' : 'Fechadas (Bloqueado)'}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={toggleRegistrations}
                                        disabled={isLoading}
                                        className={`px-6 py-2 rounded-full font-bold transition-all ${
                                            isLoading ? 'opacity-50 grayscale' : ''
                                        } ${
                                            state.registrationsOpen 
                                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200' 
                                                : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'
                                        }`}
                                    >
                                        {isLoading ? 'A gravar...' : state.registrationsOpen ? 'Fechar Inscrições' : 'Abrir Inscrições'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-bold text-gray-700 mb-2">Data do Próximo Jogo (Inscrições)</h3>
                            <div className="flex gap-4 items-center">
                                <input 
                                    type="date" 
                                    value={state.nextSundayDate}
                                    onChange={(e) => updateDate(e.target.value)}
                                    className="flex-1 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-padel"
                                />
                                {state.isTournamentFinished && (
                                    <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded border border-purple-200">
                                        🔒 Finalizado
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 mt-4">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-purple-800">🏁 Finalizar Torneio</h3>
                                    <p className="text-[10px] text-purple-600 leading-tight uppercase font-bold tracking-wider">Bloqueia inscrições, resultados e gera o relatório final do dia.</p>
                                </div>
                                <Button 
                                    onClick={handleEndTournament}
                                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200 text-xs py-2 px-4 whitespace-nowrap"
                                >
                                    Terminar Agora
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
              );
          case 'courts':
              return (
                <div key="courts" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-800 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            🎾 Gestão de Jogos e Campos
                        </h2>
                        {controls}
                    </div>
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-bold text-gray-700 mb-4 uppercase text-xs tracking-widest">Alocação de Campos por Turno</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {Object.values(Shift).map(shift => {
                                    const config = state.courtConfig[shift] || { game: 4, training: 0 };
                                    return (
                                        <div key={shift} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <span className="font-bold text-gray-800 uppercase text-xs w-24">{shift}</span>
                                            <div className="flex items-center gap-6 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-gray-500 font-bold uppercase">Jogos</label>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        max="15"
                                                        value={config.game}
                                                        onChange={(e) => updateCourtConfig(shift, 'game', parseInt(e.target.value) || 0)}
                                                        className="w-16 p-2 border rounded text-center font-bold"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-gray-500 font-bold uppercase">Treino</label>
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        max="15"
                                                        value={config.training}
                                                        onChange={(e) => updateCourtConfig(shift, 'training', parseInt(e.target.value) || 0)}
                                                        className="w-16 p-2 border rounded text-center font-bold"
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                Total: <span className="font-bold">{config.game + config.training}</span> campos
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
              );
          case 'report':
              return (
                <div key="report" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-green-600 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div className="flex items-center gap-1">
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                📊 Relatório Diário
                            </h2>
                            {controls}
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Button 
                                onClick={() => setShowResetConfirm(true)} 
                                disabled={filteredMatches.length === 0} 
                                className="bg-red-500 hover:bg-red-600 text-white px-3 text-xs"
                                title="Limpar todos os resultados desta data"
                            >
                                🗑️ Limpar Resultados
                            </Button>
                            <Button onClick={exportToExcel} disabled={filteredMatches.length === 0} className="bg-green-600 hover:bg-green-700 text-xs">
                                📥 Exportar Excel
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center mb-6 bg-gray-50 p-4 rounded-lg">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Data:</label>
                            <input 
                                type="date" 
                                value={reportFilterDate}
                                onChange={(e) => setReportFilterDate(e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-padel-blue"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                                <tr>
                                    <th className="px-4 py-3">Turno</th>
                                    <th className="px-4 py-3">Campo</th>
                                    <th className="px-4 py-3">Jogo</th>
                                    <th className="px-4 py-3">Equipa</th>
                                    <th className="px-4 py-3">Resultado</th>
                                    <th className="px-4 py-3 text-right">Pts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredMatches.length > 0 ? (
                                    filteredMatches
                                        .sort((a, b) => {
                                            if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
                                            if (a.courtNumber !== b.courtNumber) return a.courtNumber - b.courtNumber;
                                            return a.gameNumber - b.gameNumber;
                                        })
                                        .map((match) => {
                                            const teamNames = match.playerIds.map(pid => getPlayerDetails(pid)?.name || '...').join(' & ');
                                            const points = getPointsForResult(match.result);
                                            return (
                                                <tr key={match.id} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{match.shift}</td>
                                                    <td className="px-4 py-2 text-center">{match.courtNumber}</td>
                                                    <td className="px-4 py-2 text-center">{match.gameNumber}</td>
                                                    <td className="px-4 py-2 font-semibold text-gray-700">{teamNames}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                            match.result === GameResult.WIN ? 'bg-green-100 text-green-800' :
                                                            match.result === GameResult.DRAW ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                            {match.result === GameResult.WIN ? 'Vitória' : match.result === GameResult.DRAW ? 'Empate' : 'Derrota'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-bold">{points}</td>
                                                </tr>
                                            );
                                        })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500 italic">
                                            Nenhum jogo registado para esta data ({reportFilterDate}).
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
              );
          case 'registrations':
              return (
                <div key="registrations" className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-500 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div className="flex items-center gap-1">
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                🗑️ Gestão de Inscrições
                            </h2>
                            {controls}
                        </div>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button
                                onClick={() => setIsNewRegModalOpen(true)}
                                className="px-6 py-2 rounded-full font-bold bg-padel-blue text-white hover:bg-blue-800 shadow-sm text-sm"
                            >
                                ➕ Nova Inscrição (Admin)
                            </button>
                            <Button 
                                onClick={() => setShowRegResetConfirm(true)} 
                                disabled={filteredRegistrations.length === 0} 
                                className="bg-red-500 hover:bg-red-600 text-white px-3 text-xs"
                                title="Limpar todas as inscrições desta data"
                            >
                                🗑️ Limpar Inscrições
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center mb-6 bg-gray-50 p-4 rounded-lg">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Data:</label>
                            <input 
                                type="date" 
                                value={regFilterDate}
                                onChange={(e) => setRegFilterDate(e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-padel-blue"
                            />
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-tighter">
                        Inscritos para <span className="font-bold text-gray-900">{regFilterDate}</span>:
                    </p>
                    {Object.values(Shift).map(shift => {
                        const shiftRegs = filteredRegistrations
                            .filter(r => r.shift === shift)
                            .sort((a, b) => {
                                const pointsA = (getPlayerDetails(a.playerId)?.totalPoints || 0) + 
                                               (a.partnerId ? (getPlayerDetails(a.partnerId)?.totalPoints || 0) : 0);
                                const pointsB = (getPlayerDetails(b.playerId)?.totalPoints || 0) + 
                                               (b.partnerId ? (getPlayerDetails(b.partnerId)?.totalPoints || 0) : 0);
                                return pointsB - pointsA;
                            });
                        if (shiftRegs.length === 0) return null;
                        
                        const numCourts = state.courtConfig[shift]?.game || 0;
                        const courtOptions = Array.from({ length: numCourts }, (_, i) => i + 1);

                        return (
                            <div key={shift} className="mb-6 last:mb-0">
                                <h3 className="bg-gray-100 p-2 rounded-t-lg font-bold text-gray-700 text-sm uppercase tracking-wide border-b border-gray-200">
                                    {shift} ({shiftRegs.length})
                                </h3>
                                <div className="border border-gray-200 rounded-b-lg divide-y divide-gray-100">
                                    {shiftRegs.map(reg => {
                                        const player = getPlayerDetails(reg.playerId);
                                        const partner = reg.partnerId ? getPlayerDetails(reg.partnerId) : null;
                                        const p1Points = player?.totalPoints || 0;
                                        const p2Points = partner?.totalPoints || 0;
                                        const totalPoints = p1Points + p2Points;

                                        return (
                                            <div key={reg.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors group">
                                                <div className="flex-1 min-0">
                                                    <div className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                                                        <span>{player?.name || 'Desconhecido'}</span>
                                                        {reg.hasPartner && <span className="text-gray-400 font-medium">&</span>}
                                                        {reg.hasPartner && <span>{reg.partnerName}</span>}
                                                        <span className="text-[10px] font-normal text-gray-400 font-mono">
                                                            #{player?.participantNumber}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {!reg.isWaitingList && reg.type === 'game' && courtOptions.length > 0 && (
                                                        <div className="flex flex-col items-end">
                                                            <label className="text-[8px] font-bold text-gray-400 uppercase leading-none mb-1">Campo Inicial</label>
                                                            <select 
                                                                value={reg.startingCourt || ''} 
                                                                onChange={(e) => handleSetStartingCourt(reg.id, parseInt(e.target.value))}
                                                                className="text-xs p-1 border rounded bg-white font-bold text-padel-blue outline-none"
                                                            >
                                                                <option value="">N/A</option>
                                                                {courtOptions.map(n => <option key={n} value={n}>Campo {n}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => initiateDeleteRegistration(reg, player?.name || 'Jogador')}
                                                            className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-100 transition-all border border-transparent hover:border-red-200"
                                                            title="Cancelar Inscrição"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
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

      {(state.adminSectionOrder || DEFAULT_ORDER).map(key => renderSection(key))}

      {isNewRegModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md overflow-y-auto max-h-[90vh]">
                  <h3 className="text-xl font-bold mb-4">Nova Inscrição (Admin)</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Turno</label>
                          <select 
                            value={newRegShift} 
                            onChange={(e) => setNewRegShift(e.target.value as Shift)}
                            className="w-full p-2 border rounded"
                          >
                              {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Jogador 1</label>
                          <input 
                            type="text" 
                            placeholder="Pesquisar..." 
                            value={p1Search}
                            onChange={(e) => setP1Search(e.target.value)}
                            className="w-full p-2 border rounded text-sm mb-1"
                          />
                          {p1Search && !newRegP1 && (
                              <div className="border rounded bg-gray-50 max-h-32 overflow-y-auto">
                                  {players.filter(p => p.name.toLowerCase().includes(p1Search.toLowerCase())).slice(0, 5).map(p => (
                                      <div key={p.id} onClick={() => { setNewRegP1(p); setP1Search(p.name); }} className="p-2 text-sm hover:bg-blue-100 cursor-pointer">
                                          {p.name} (#{p.participantNumber})
                                      </div>
                                  ))}
                              </div>
                          )}
                          {newRegP1 && (
                              <div className="bg-blue-50 p-2 rounded border border-blue-200 flex justify-between items-center">
                                  <span className="text-sm font-bold">{newRegP1.name}</span>
                                  <button onClick={() => { setNewRegP1(null); setP1Search(''); }} className="text-red-500">&times;</button>
                              </div>
                          )}
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <Button variant="ghost" onClick={() => setIsNewRegModalOpen(false)} className="flex-1">Cancelar</Button>
                      <Button onClick={handleAdminNewReg} disabled={!newRegP1} className="flex-1">Gravar Inscrição</Button>
                  </div>
              </div>
          </div>
      )}

      {regToDelete && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                  <div className="text-center mb-4">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">🗑️</div>
                      <h3 className="text-lg font-bold text-gray-800">Remover Inscrição</h3>
                      <p className="text-sm font-semibold mt-2">{regToDelete.mainPlayerName}</p>
                  </div>
                  <div className="space-y-3">
                      <button
                          onClick={confirmDeleteEntireRegistration}
                          className="w-full py-3 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600 shadow-md"
                      >
                          Confirmar Remoção
                      </button>
                      <button 
                          onClick={() => setRegToDelete(null)}
                          className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm"
                      >
                          Cancelar
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
