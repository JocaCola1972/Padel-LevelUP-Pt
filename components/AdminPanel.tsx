
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Player, Registration, Shift, MatchRecord, GameResult } from '../types';
import { getAppState, updateAppState, getRegistrations, getPlayers, removeRegistration, updateRegistration, getMatches, saveFirebaseConfig, getFirebaseConfig } from '../services/storageService';
import { Button } from './Button';

// Declare XLSX for sheetjs
declare const XLSX: any;

export const AdminPanel: React.FC = () => {
  const [state, setState] = useState<AppState>(getAppState());
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [showMessage, setShowMessage] = useState(false);

  // Edit Registration (Add Partner) State
  const [editRegId, setEditRegId] = useState<string | null>(null);
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [selectedPartnerForReg, setSelectedPartnerForReg] = useState<Player | null>(null);

  // Delete Confirmation State
  const [regToDelete, setRegToDelete] = useState<{ reg: Registration, mainPlayerName: string } | null>(null);

  // End Tournament Modal State
  const [showEndTournament, setShowEndTournament] = useState(false);

  // Firebase Config State
  const [firebaseConfigInput, setFirebaseConfigInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Logo Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setState(getAppState());
    setRegistrations(getRegistrations());
    setPlayers(getPlayers());
    setMatches(getMatches());
  };

  useEffect(() => {
    loadData();
    // Auto-refresh data every few seconds to see new registrations coming in
    const interval = setInterval(loadData, 5000);
    const existingConfig = getFirebaseConfig();
    if(existingConfig) setFirebaseConfigInput(existingConfig);
    return () => clearInterval(interval);
  }, []);

  const toggleRegistrations = () => {
    const newState = { ...state, registrationsOpen: !state.registrationsOpen };
    updateAppState(newState);
    setState(newState);
    showMessageTemporarily();
  };

  const updateCourtConfig = (shift: Shift, type: 'game' | 'training', value: number) => {
    const safeValue = Math.max(0, Math.min(15, value));
    const newState = {
      ...state,
      courtConfig: {
        ...state.courtConfig,
        [shift]: {
          ...state.courtConfig[shift],
          [type]: safeValue
        }
      }
    };
    updateAppState(newState);
    setState(newState);
    showMessageTemporarily();
  };

  const updateGamesPerShift = (shift: Shift, count: number) => {
    const newState = { 
        ...state, 
        gamesPerShift: {
            ...state.gamesPerShift,
            [shift]: count
        } 
    };
    updateAppState(newState);
    setState(newState);
    showMessageTemporarily();
  };

  const updateDate = (dateStr: string) => {
    // When date changes, we must reset the tournament finished status to allow editing
    const newState = { ...state, nextSundayDate: dateStr, isTournamentFinished: false };
    updateAppState(newState);
    setState(newState);
    showMessageTemporarily();
    // Reload registrations because they depend on the date
    setTimeout(loadData, 100); 
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

  const handleSaveFirebaseConfig = () => {
      if(!firebaseConfigInput.trim()) return;
      try {
          // Validate JSON
          JSON.parse(firebaseConfigInput);
          saveFirebaseConfig(firebaseConfigInput);
          alert("Configuração Cloud gravada! A app tentará sincronizar.");
          window.location.reload(); // Reload to start sync cleanly
      } catch (e) {
          alert("JSON Inválido. Verifique o formato.");
      }
  };

  const handleShareConfig = () => {
      const config = getFirebaseConfig();
      if (!config) {
          alert("Configure o Firebase primeiro.");
          return;
      }
      try {
          // Create Base64 Encoded Config URL
          const encoded = btoa(config);
          const url = `${window.location.origin}${window.location.pathname}?cfg=${encoded}`;
          
          if (navigator.share) {
              navigator.share({
                  title: 'Configuração Padel LevelUp',
                  text: 'Abre este link para ligar a app ao servidor:',
                  url: url
              });
          } else {
              navigator.clipboard.writeText(url);
              alert("Link copiado para a área de transferência! Envia aos outros utilizadores.");
          }
      } catch (e) {
          alert("Erro ao gerar link.");
      }
  };

  // Trigger Delete Modal
  const initiateDeleteRegistration = (reg: Registration, playerName: string) => {
      setRegToDelete({ reg, mainPlayerName: playerName });
  };

  // Execute Delete Entirely
  const confirmDeleteEntireRegistration = () => {
      if (!regToDelete) return;
      removeRegistration(regToDelete.reg.id);
      setRegToDelete(null);
      loadData();
  };

  // Execute Remove Partner Only
  const confirmRemovePartnerOnly = () => {
      if (!regToDelete) return;
      updateRegistration(regToDelete.reg.id, {
          hasPartner: false,
          partnerId: undefined,
          partnerName: undefined
      });
      setRegToDelete(null);
      loadData();
  };

  const showMessageTemporarily = () => {
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 2000);
  };

  const getPlayerDetails = (id: string) => {
    const p = players.find(player => player.id === id);
    return p;
  };

  const activeRegistrations = registrations.filter(r => r.date === state.nextSundayDate);

  // --- Partner Association Logic ---

  const openPartnerModal = (regId: string) => {
      setEditRegId(regId);
      setPartnerSearchTerm('');
      setSelectedPartnerForReg(null);
  };

  const closePartnerModal = () => {
      setEditRegId(null);
  };

  const handleAssociatePartner = () => {
      if (!editRegId || !selectedPartnerForReg) return;

      updateRegistration(editRegId, {
          hasPartner: true,
          partnerId: selectedPartnerForReg.id,
          partnerName: selectedPartnerForReg.name
      });
      
      closePartnerModal();
      loadData();
  };

  const filteredPartnerCandidates = players.filter(p => 
      (p.name.toLowerCase().includes(partnerSearchTerm.toLowerCase()) || 
       p.phone.includes(partnerSearchTerm)) 
  ).slice(0, 5);


  // --- Report & Export Logic ---

  const getPointsForResult = (result: GameResult) => {
      switch (result) {
          case GameResult.WIN: return 4;
          case GameResult.DRAW: return 2;
          case GameResult.LOSS: return 1;
          default: return 0;
      }
  };

  const filteredMatches = matches.filter(m => m.date === state.nextSundayDate);

  const prepareExportData = () => {
      // Prepare data for Excel
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

      // Sort by Shift, then Court, then Game
      dataToExport.sort((a, b) => {
          if (a.Turno !== b.Turno) return a.Turno.localeCompare(b.Turno);
          if (a.Campo !== b.Campo) return a.Campo - b.Campo;
          return a['Jogo Nº'] - b['Jogo Nº'];
      });

      return dataToExport;
  };

  const exportToExcel = () => {
      if (filteredMatches.length === 0) {
          alert("Não existem dados de jogos para esta data.");
          return;
      }
      const data = prepareExportData();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Resultados");
      XLSX.writeFile(wb, `PadelLevelUp_Resultados_${state.nextSundayDate}.xlsx`);
  };

  // --- End Tournament Logic ---
  const handleEndTournament = () => {
      // Lock tournament
      const newState = { ...state, isTournamentFinished: true };
      updateAppState(newState);
      setState(newState);
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
      
      const fileName = `PadelLevelUp_Final_${state.nextSundayDate}.${format}`;
      
      if (format === 'csv') {
          XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      } else if (format === 'xls') {
          XLSX.writeFile(wb, fileName, { bookType: 'biff8' });
      } else {
          XLSX.writeFile(wb, fileName);
      }
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Configuration Card */}
      <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-gray-800">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          ⚙️ Painel de Administração
        </h2>

        {showMessage && (
          <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg animate-fade-in">
            ✅ Configurações guardadas!
          </div>
        )}

        <div className="space-y-6">
          
          {/* Cloud Sync Config */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold text-blue-900 flex items-center gap-2">
                    ☁️ Sincronização Cloud (Multidispositivo)
                 </h3>
                 <button onClick={() => setShowConfig(!showConfig)} className="text-xs text-blue-600 underline">
                     {showConfig ? 'Ocultar' : 'Configurar'}
                 </button>
             </div>
             
             {showConfig ? (
                 <div className="space-y-2 animate-slide-down">
                     <p className="text-xs text-blue-800 mb-2">
                         Cole aqui o JSON do Firebase Console {'>'} Project Settings {'>'} General {'>'} Your apps.
                     </p>
                     <textarea
                        rows={6}
                        value={firebaseConfigInput}
                        onChange={(e) => setFirebaseConfigInput(e.target.value)}
                        placeholder='{"apiKey": "...", "authDomain": "...", "projectId": "..."}'
                        className="w-full p-2 text-xs font-mono border rounded bg-white"
                     />
                     <Button onClick={handleSaveFirebaseConfig} className="bg-blue-600 hover:bg-blue-700 w-full text-xs">
                         Gravar Configuração e Conectar
                     </Button>
                 </div>
             ) : (
                 <div className="flex items-center gap-3">
                     <div className="text-xs text-blue-800 flex-1">
                         Para que outros utilizadores sincronizem, partilhe o "Link Mágico".
                     </div>
                     <Button onClick={handleShareConfig} className="bg-green-600 hover:bg-green-700 text-xs shadow-sm">
                         🔗 Copiar Link de Partilha
                     </Button>
                 </div>
             )}
          </div>

          {/* Registration Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-bold text-gray-700">Estado das Inscrições</h3>
              <p className="text-sm text-gray-500">
                {state.registrationsOpen ? 'Abertas (Permite novas inscrições)' : 'Fechadas (Bloqueado)'}
              </p>
            </div>
            <button
              onClick={toggleRegistrations}
              className={`px-6 py-2 rounded-full font-bold transition-colors ${
                state.registrationsOpen 
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200' 
                  : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'
              }`}
            >
              {state.registrationsOpen ? 'Fechar Inscrições' : 'Abrir Inscrições'}
            </button>
          </div>

          {/* Date Picker */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-2">Data do Próximo Jogo</h3>
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

          {/* Visual Configuration (Logo) */}
          <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-bold text-gray-700 mb-4">Configuração Visual (Logótipo)</h3>
              <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full border-4 border-padel overflow-hidden bg-white flex-shrink-0 relative">
                      <img 
                          src={state.customLogo || '/logo.png'} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                      />
                  </div>
                  <div className="flex-1 space-y-2">
                      <p className="text-xs text-gray-500">Carrega uma imagem para substituir o logótipo no ecrã inicial.</p>
                      <input 
                          type="file" 
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-padel-light/20 file:text-padel-dark hover:file:bg-padel-light/30"
                      />
                      {state.customLogo && (
                          <button 
                              onClick={handleResetLogo}
                              className="text-xs text-red-500 font-bold hover:underline"
                          >
                              Restaurar logótipo padrão
                          </button>
                      )}
                  </div>
              </div>
          </div>

          {/* Court Configuration Per Shift */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-4">Gestão de Campos por Turno</h3>
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

          {/* Games per Shift Configuration */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-gray-700 mb-4">Limite de Jogos por Jogador (Sobe e Desce)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.values(Shift).map(shift => {
                    const currentLimit = state.gamesPerShift[shift] || 5;
                    return (
                        <div key={shift} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">{shift}</p>
                            <div className="flex flex-wrap gap-1">
                                {[3, 4, 5, 6, 7, 8].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => updateGamesPerShift(shift, num)}
                                        className={`w-8 h-8 text-sm rounded font-bold transition-all ${
                                            currentLimit === num 
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>

        </div>
      </div>

      {/* End Tournament Section */}
      <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-purple-600">
           <div className="flex justify-between items-center">
              <div>
                  <h2 className="text-2xl font-bold text-gray-800">🏁 Finalizar Evento</h2>
                  <p className="text-sm text-gray-500">Bloquear inscrições/resultados e gerar relatório final.</p>
              </div>
              <Button 
                onClick={handleEndTournament}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200"
              >
                  Terminar Torneio
              </Button>
           </div>
      </div>

      {/* Report & Export Card (Simple View) */}
      <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-green-600">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  📊 Relatório Diário
              </h2>
              <Button onClick={exportToExcel} disabled={filteredMatches.length === 0} className="bg-green-600 hover:bg-green-700">
                  📥 Exportar Excel
              </Button>
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
              Resultados registados para a data <span className="font-bold">{state.nextSundayDate}</span>.
          </p>

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
                                // Sort by Shift, then Court, then Game
                                if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
                                if (a.courtNumber !== b.courtNumber) return a.courtNumber - b.courtNumber;
                                return a.gameNumber - b.gameNumber;
                            })
                            .map((match) => {
                              const teamNames = match.playerIds.map(pid => getPlayerDetails(pid)?.name || '...').join(' & ');
                              const points = getPointsForResult(match.result);
                              
                              return (
                                  <tr key={match.id} className="hover:bg-gray-50">
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
                                  Nenhum jogo registado para esta data.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Registrations Management Card */}
      <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-500">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            🗑️ Gestão de Inscrições
        </h2>
        <p className="text-sm text-gray-500 mb-4">
            Lista de inscritos para <span className="font-bold">{state.nextSundayDate}</span>.
        </p>

        {Object.values(Shift).map(shift => {
            const shiftRegs = activeRegistrations.filter(r => r.shift === shift);
            if (shiftRegs.length === 0) return null;

            return (
                <div key={shift} className="mb-6 last:mb-0">
                    <h3 className="bg-gray-100 p-2 rounded-t-lg font-bold text-gray-700 text-sm uppercase tracking-wide border-b border-gray-200">
                        {shift} ({shiftRegs.length})
                    </h3>
                    <div className="border border-gray-200 rounded-b-lg divide-y divide-gray-100">
                        {shiftRegs.map(reg => {
                            const player = getPlayerDetails(reg.playerId);
                            return (
                                <div key={reg.id} className="p-3 flex justify-between items-center hover:bg-red-50 transition-colors group">
                                    <div>
                                        <div className="font-bold text-gray-800 flex items-center gap-2">
                                            {player ? player.name : 'Desconhecido'}
                                            {reg.type === 'training' && (
                                                <span className="text-[9px] bg-orange-100 text-orange-800 px-1 rounded uppercase font-bold tracking-wide">
                                                    Treino
                                                </span>
                                            )}
                                            <span className="text-xs font-normal text-gray-500">
                                              #{player?.participantNumber} • {player?.phone}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {reg.hasPartner ? (
                                              <span className="flex items-center gap-1">
                                                <span>Dupla com:</span>
                                                <span className="font-semibold">{reg.partnerName}</span>
                                              </span>
                                            ) : (
                                              <span className="italic">Individual</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {!reg.hasPartner && (
                                            <button 
                                                onClick={() => openPartnerModal(reg.id)}
                                                className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-100 transition-all border border-transparent hover:border-blue-200"
                                                title="Adicionar Parceiro"
                                            >
                                                ➕👤
                                            </button>
                                        )}
                                        <button
                                            onClick={() => initiateDeleteRegistration(reg, player?.name || 'Jogador')}
                                            className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-100 transition-all border border-transparent hover:border-red-200"
                                            title="Cancelar Inscrição"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}

        {activeRegistrations.length === 0 && (
            <div className="text-center py-8 text-gray-400 italic">
                Nenhuma inscrição encontrada para esta data.
            </div>
        )}
      </div>

      {/* Admin Partner Selection Modal */}
      {editRegId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                  <h3 className="text-xl font-bold mb-4">Associar Parceiro (Admin)</h3>
                  
                  <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Pesquisar Jogador</label>
                      <input 
                          type="text" 
                          placeholder="Nome ou Telemóvel"
                          value={partnerSearchTerm}
                          onChange={(e) => setPartnerSearchTerm(e.target.value)}
                          className="w-full p-2 border rounded"
                      />
                  </div>

                  <div className="mb-4 max-h-40 overflow-y-auto space-y-2 border border-gray-100 p-2 rounded">
                      {partnerSearchTerm && filteredPartnerCandidates.map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => setSelectedPartnerForReg(p)}
                            className={`p-2 rounded cursor-pointer flex justify-between items-center text-sm ${selectedPartnerForReg?.id === p.id ? 'bg-padel-blue text-white' : 'hover:bg-gray-100'}`}
                          >
                              <span>{p.name}</span>
                              <span className="text-xs opacity-70">{p.phone}</span>
                          </div>
                      ))}
                  </div>

                  <div className="flex gap-2">
                      <Button variant="ghost" onClick={closePartnerModal} className="flex-1">Cancelar</Button>
                      <Button onClick={handleAssociatePartner} disabled={!selectedPartnerForReg} className="flex-1">Associar</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal (Admin) */}
      {regToDelete && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                  <div className="text-center mb-4">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">
                          🗑️
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Remover Inscrição</h3>
                      <p className="text-sm font-semibold mt-2">{regToDelete.mainPlayerName}</p>
                      {regToDelete.reg.hasPartner && (
                          <p className="text-xs text-gray-500">+ {regToDelete.reg.partnerName}</p>
                      )}
                  </div>
                  
                  <div className="space-y-3">
                      {regToDelete.reg.hasPartner && (
                          <button
                              onClick={confirmRemovePartnerOnly}
                              className="w-full py-3 bg-blue-50 text-blue-800 rounded-lg font-bold text-sm hover:bg-blue-100 border border-blue-200"
                          >
                              Remover Apenas Parceiro
                              <span className="block text-[10px] font-normal opacity-70">(Mantém {regToDelete.mainPlayerName} inscrito)</span>
                          </button>
                      )}

                      <button
                          onClick={confirmDeleteEntireRegistration}
                          className="w-full py-3 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600 shadow-md"
                      >
                          {regToDelete.reg.hasPartner ? 'Eliminar Inscrição Completa' : 'Eliminar Inscrição'}
                          {regToDelete.reg.hasPartner && (
                              <span className="block text-[10px] font-normal opacity-90">(Remove ambos os jogadores)</span>
                          )}
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

      {/* End Tournament Modal */}
      {showEndTournament && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                      <div>
                          <h2 className="text-2xl font-black text-gray-800">🏆 Resumo Final do Torneio</h2>
                          <p className="text-sm text-gray-500 font-mono mt-1">Data: {state.nextSundayDate}</p>
                      </div>
                      <button onClick={() => setShowEndTournament(false)} className="text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none">&times;</button>
                  </div>

                  {/* Modal Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                      
                      {/* Export Buttons */}
                      <div className="flex flex-wrap gap-4 justify-end p-4 bg-purple-50 rounded-xl border border-purple-100">
                          <span className="flex items-center font-bold text-purple-800 mr-auto">📥 Exportar Relatório Final:</span>
                          <button 
                            onClick={() => handleDownloadTournamentReport('xlsx')}
                            className="px-4 py-2 bg-green-600 text-white rounded font-bold text-sm hover:bg-green-700 shadow"
                          >
                            .XLSX (Excel)
                          </button>
                          <button 
                            onClick={() => handleDownloadTournamentReport('xls')}
                            className="px-4 py-2 bg-green-500 text-white rounded font-bold text-sm hover:bg-green-600 shadow"
                          >
                            .XLS (Antigo)
                          </button>
                          <button 
                            onClick={() => handleDownloadTournamentReport('csv')}
                            className="px-4 py-2 bg-blue-500 text-white rounded font-bold text-sm hover:bg-blue-600 shadow"
                          >
                            .CSV
                          </button>
                      </div>

                      {/* Tables Per Shift */}
                      {Object.values(Shift).map(shift => {
                          const shiftMatches = filteredMatches.filter(m => m.shift === shift)
                              .sort((a, b) => {
                                  if (a.courtNumber !== b.courtNumber) return a.courtNumber - b.courtNumber;
                                  return a.gameNumber - b.gameNumber;
                              });

                          return (
                              <div key={shift} className="border rounded-xl overflow-hidden shadow-sm">
                                  <div className="bg-gray-800 text-white p-3 font-bold flex justify-between">
                                      <span>{shift}</span>
                                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">{shiftMatches.length} Jogos</span>
                                  </div>
                                  <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                          <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                                              <tr>
                                                  <th className="px-4 py-2 text-center w-16">Campo</th>
                                                  <th className="px-4 py-2 text-center w-16">Jogo</th>
                                                  <th className="px-4 py-2 text-left">Equipa</th>
                                                  <th className="px-4 py-2 text-center w-24">Resultado</th>
                                                  <th className="px-4 py-2 text-right w-16">Pts</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                              {shiftMatches.length > 0 ? (
                                                  shiftMatches.map(m => {
                                                      const teamNames = m.playerIds.map(pid => getPlayerDetails(pid)?.name || '...').join(' & ');
                                                      return (
                                                          <tr key={m.id} className="hover:bg-gray-50">
                                                              <td className="px-4 py-2 text-center font-bold text-gray-500">{m.courtNumber}</td>
                                                              <td className="px-4 py-2 text-center font-mono text-gray-400">#{m.gameNumber}</td>
                                                              <td className="px-4 py-2 font-semibold text-gray-800">{teamNames}</td>
                                                              <td className="px-4 py-2 text-center">
                                                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                      m.result === GameResult.WIN ? 'bg-green-100 text-green-800' :
                                                                      m.result === GameResult.DRAW ? 'bg-yellow-100 text-yellow-800' :
                                                                      'bg-red-100 text-red-800'
                                                                  }`}>
                                                                      {m.result}
                                                                  </span>
                                                              </td>
                                                              <td className="px-4 py-2 text-right font-bold text-padel-dark">{getPointsForResult(m.result)}</td>
                                                          </tr>
                                                      );
                                                  })
                                              ) : (
                                                  <tr>
                                                      <td colSpan={5} className="p-6 text-center text-gray-400 italic">Sem jogos registados neste turno.</td>
                                                  </tr>
                                              )}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl text-right">
                      <Button onClick={() => setShowEndTournament(false)} variant="secondary">Fechar</Button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
