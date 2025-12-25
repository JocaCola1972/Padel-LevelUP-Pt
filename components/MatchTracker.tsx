
import React, { useState, useEffect, useCallback } from 'react';
import { Player, Shift, GameResult, AppState, MatchRecord, Registration } from '../types';
import { addMatch, getAppState, getMatches, generateUUID, getRegistrations, getPlayers, subscribeToChanges } from '../services/storageService';
import { Button } from './Button';

interface MatchTrackerProps {
  currentUser: Player;
}

const POINTS_MAP = {
  [GameResult.WIN]: 4,
  [GameResult.DRAW]: 2,
  [GameResult.LOSS]: 1
};

export const MatchTracker: React.FC<MatchTrackerProps> = ({ currentUser }) => {
  const [appState, setAppState] = useState<AppState>(getAppState());
  const [viewMode, setViewMode] = useState<'input' | 'history'>('input');
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [isSubstituteOnly, setIsSubstituteOnly] = useState(false); 
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedGame, setSelectedGame] = useState(1);
  const [selectedCourt, setSelectedCourt] = useState(1); 
  const [submitted, setSubmitted] = useState(false);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [alertConfig, setAlertConfig] = useState<{ message: string; subMessage?: string } | null>(null);
  const [historyDate, setHistoryDate] = useState<string>('');
  const [historyShift, setHistoryShift] = useState<Shift | 'ALL'>('ALL');
  const [selfResult, setSelfResult] = useState<GameResult | null>(null);
  const [goldenPointWon, setGoldenPointWon] = useState<boolean | null>(null);

  const loadData = useCallback(() => {
    const currentMatches = getMatches();
    const currentState = getAppState();
    const currentRegistrations = getRegistrations();
    const players = getPlayers();
    
    setMatches(currentMatches);
    setAppState(currentState);
    setAllPlayers(players);
    setRegistrations(currentRegistrations);

    const myRegs = currentRegistrations.filter(r => 
      (r.playerId === currentUser.id || r.partnerId === currentUser.id) && 
      r.date === currentState.nextSundayDate && 
      (r.type === 'game' || !r.type)
    );

    const confirmedRegs = myRegs.filter(r => !r.isWaitingList);
    const uniqueConfirmedShifts = Array.from(new Set(confirmedRegs.map(r => r.shift)));
    setAvailableShifts(uniqueConfirmedShifts);

    setIsSubstituteOnly(myRegs.length > 0 && confirmedRegs.length === 0);

    if (uniqueConfirmedShifts.length > 0) {
        if (!selectedShift || !uniqueConfirmedShifts.includes(selectedShift)) {
            setSelectedShift(uniqueConfirmedShifts[0]);
        }
    } else {
        setSelectedShift(null);
    }
    
    if (!historyDate) {
        setHistoryDate(currentState.nextSundayDate);
    }

  }, [currentUser.id, selectedShift, historyDate]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    const interval = setInterval(loadData, 5000); 
    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, [loadData]); 

  const getPlayerName = (id: string) => allPlayers.find(p => p.id === id)?.name || 'Jogador Desconhecido';

  const getLimitForShift = (shift: Shift) => {
      if (typeof appState.gamesPerShift === 'number') return appState.gamesPerShift;
      return appState.gamesPerShift[shift] || 5;
  };

  const getCourtsForShift = (shift: Shift) => {
      const config = appState.courtConfig[shift];
      return config ? config.game : 4;
  };

  const getNextLogicalGame = (shift: Shift) => {
      const tournamentDate = appState.nextSundayDate;
      const myMatches = matches.filter(m => 
          m.date === tournamentDate && 
          m.shift === shift && 
          m.playerIds.includes(currentUser.id)
      );
      const maxGame = myMatches.reduce((max, m) => Math.max(max, m.gameNumber), 0);
      return maxGame + 1;
  };

  const calculateNextCourt = (shift: Shift, targetGame: number) => {
      if (targetGame <= 1) return 1;

      const tournamentDate = appState.nextSundayDate;
      const prevGameNum = targetGame - 1;
      
      const prevMatch = matches.find(m => 
          m.date === tournamentDate &&
          m.shift === shift &&
          m.playerIds.includes(currentUser.id) &&
          m.gameNumber === prevGameNum
      );

      if (!prevMatch) return 1;

      const currentCourt = prevMatch.courtNumber;
      const maxCourts = getCourtsForShift(shift);
      let moveDirection = 0;

      if (prevMatch.result === GameResult.WIN) {
          moveDirection = -1;
      } else if (prevMatch.result === GameResult.LOSS) {
          moveDirection = 1;
      } else if (prevMatch.result === GameResult.DRAW) {
          if (prevMatch.goldenPointWon === true) {
              moveDirection = -1;
          } else if (prevMatch.goldenPointWon === false) {
              moveDirection = 1;
          }
      }

      let nextCourt = currentCourt + moveDirection;
      if (nextCourt < 1) nextCourt = 1;
      if (nextCourt > maxCourts) nextCourt = maxCourts;

      return nextCourt;
  };

  useEffect(() => {
      if (selectedShift && viewMode === 'input') {
          const nextGame = getNextLogicalGame(selectedShift);
          const limit = getLimitForShift(selectedShift);
          
          if (nextGame <= limit) {
              setSelectedGame(nextGame);
          } else {
              setSelectedGame(limit);
          }

          if (nextGame === 1) {
              // Verificação de Campo Inicial definido pelo Admin
              const myReg = registrations.find(r => 
                  (r.playerId === currentUser.id || r.partnerId === currentUser.id) && 
                  r.shift === selectedShift && 
                  r.date === appState.nextSundayDate && 
                  !r.isWaitingList
              );
              if (myReg?.startingCourt) {
                  setSelectedCourt(myReg.startingCourt);
              } else {
                  setSelectedCourt(1);
              }
          } else if (nextGame > 1 && nextGame <= limit) {
              const calculatedCourt = calculateNextCourt(selectedShift, nextGame);
              setSelectedCourt(calculatedCourt);
          }
      }
  }, [selectedShift, matches.length, viewMode, registrations, appState.nextSundayDate, currentUser.id]);

  const getGamesPlayedCount = (playerId: string, shift: Shift) => {
    const tournamentDate = appState.nextSundayDate;
    return matches.filter(m => 
      m.date === tournamentDate && 
      m.shift === shift && 
      m.playerIds.includes(playerId)
    ).length;
  };

  const checkResultConflict = (shift: Shift, game: number, court: number, myResult: GameResult, myGoldenPointWon?: boolean): { msg: string, sub: string } | null => {
      const tournamentDate = appState.nextSundayDate;
      const existingMatches = matches.filter(m => 
          m.date === tournamentDate && 
          m.shift === shift && 
          m.courtNumber === court &&
          m.gameNumber === game
      );

      // 1. Verificar se a MINHA equipa (eu ou parceiro) já submeteu
      const myTeamMatch = existingMatches.find(m => m.playerIds.includes(currentUser.id));
      if (myTeamMatch) {
          const myReg = getRegistrations().find(r => 
              (r.playerId === currentUser.id || r.partnerId === currentUser.id) && 
              r.shift === shift && 
              r.date === tournamentDate
          );
          
          if (myReg?.hasPartner) {
              return { 
                  msg: "Resultado já submetido pelo parceiro ou parceira", 
                  sub: "O teu parceiro ou parceira já inseriu o resultado (incluindo o Ponto de Ouro) para este jogo. Não é necessário submeter novamente." 
              };
          } else {
              return { 
                  msg: "Já registaste este resultado", 
                  sub: "Já inseriste o resultado para este jogo e campo." 
              };
          }
      }

      // 2. Verificar conflito com a equipa ADVERSÁRIA
      for (const match of existingMatches) {
          // Nota: Já garantimos acima que não somos nós, mas por segurança mantemos a verificação de exclusão
          if (match.playerIds.includes(currentUser.id)) continue;

          const teamNames = match.playerIds.map(pid => getPlayerName(pid)).join(' & ');
          
          let conflictMsg = "";
          if (match.result === GameResult.WIN && myResult === GameResult.WIN) conflictMsg = "A equipa adversária já registou Vitória.";
          if (match.result === GameResult.WIN && myResult === GameResult.DRAW) conflictMsg = "A equipa adversária registou Vitória, não pode haver Empate.";
          if (match.result === GameResult.LOSS && myResult === GameResult.DRAW) conflictMsg = "A equipa adversária registou Derrota, não pode haver Empate.";
          if (match.result === GameResult.DRAW && myResult !== GameResult.DRAW) conflictMsg = "A equipa adversária registou Empate.";
          
          if (match.result === GameResult.DRAW && myResult === GameResult.DRAW) {
              if (match.goldenPointWon === myGoldenPointWon) {
                  conflictMsg = myGoldenPointWon 
                    ? "Ambas as equipas reclamaram a vitória no Ponto de Ouro." 
                    : "Ambas as equipas reclamaram a derrota no Ponto de Ouro.";
              }
          }

          if (conflictMsg) {
              return {
                  msg: conflictMsg,
                  sub: `Conflito detectado com a equipa de: ${teamNames}`
              };
          }
      }

      return null;
  };

  const handleSubmitSelf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfResult || !selectedShift) return;
    
    if (selfResult === GameResult.DRAW && goldenPointWon === null) {
        setAlertConfig({ message: "Ponto de Ouro em Falta", subMessage: "Em caso de empate, tens de indicar quem ganhou o Ponto de Ouro." });
        return;
    }

    const tournamentDate = appState.nextSundayDate;

    if (selectedGame > 1) {
        const previousGame = selectedGame - 1;
        const hasPreviousMatch = matches.some(m => 
            m.date === tournamentDate && 
            m.shift === selectedShift && 
            m.playerIds.includes(currentUser.id) && 
            m.gameNumber === previousGame
        );

        if (!hasPreviousMatch) {
            setAlertConfig({ message: "Sequência Incorreta", subMessage: `Primeiro tens de registar o resultado do Jogo ${previousGame}.` });
            return;
        }
    }

    const limit = getLimitForShift(selectedShift);
    const playedCount = getGamesPlayedCount(currentUser.id, selectedShift);
    if (playedCount >= limit) {
        setAlertConfig({ message: "Limite Atingido", subMessage: "Já completaste todos os jogos previstos para este turno." });
        return;
    }

    const conflict = checkResultConflict(
        selectedShift, 
        selectedGame, 
        selectedCourt, 
        selfResult, 
        goldenPointWon !== null ? goldenPointWon : undefined
    );

    if (conflict) {
        setAlertConfig({ message: conflict.msg, subMessage: conflict.sub });
        return;
    }

    const allRegs = getRegistrations();
    const myRegistration = allRegs.find(r => 
        (r.playerId === currentUser.id || r.partnerId === currentUser.id) && 
        r.shift === selectedShift && 
        r.date === tournamentDate &&
        !r.isWaitingList
    );

    if (!myRegistration) {
        setAlertConfig({ message: "Erro de Registo", subMessage: "Não foi possível encontrar a tua inscrição CONFIRMADA para este turno." });
        return;
    }

    const playerIds = [myRegistration.playerId];
    if (myRegistration.partnerId) {
        playerIds.push(myRegistration.partnerId);
    }

    const points = POINTS_MAP[selfResult];
    const record: MatchRecord = {
      id: generateUUID(),
      date: tournamentDate,
      shift: selectedShift,
      courtNumber: selectedCourt,
      gameNumber: selectedGame,
      playerIds: playerIds,
      result: selfResult,
      timestamp: Date.now(),
      goldenPointWon: selfResult === GameResult.DRAW ? (goldenPointWon === true) : undefined
    };

    addMatch(record, points);
    finishSubmit();
  };

  const finishSubmit = () => {
    loadData();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setSelfResult(null);
      setGoldenPointWon(null);
    }, 2500);
  };

  const filteredHistoryMatches = matches
    .filter(m => m.date === historyDate)
    .filter(m => historyShift === 'ALL' || m.shift === historyShift)
    .sort((a, b) => {
        if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
        if (a.courtNumber !== b.courtNumber) return a.courtNumber - b.courtNumber;
        return a.gameNumber - b.gameNumber;
    });

  if (viewMode === 'history') {
      const dates = Array.from(new Set(matches.map(m => m.date))).sort().reverse();
      return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-blue-600 animate-fade-in">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">📜 Histórico</h2>
                        <p className="text-xs text-gray-500">Consulta resultados anteriores</p>
                    </div>
                    <Button variant="secondary" onClick={() => setViewMode('input')} className="text-xs px-3 py-1">Voltar</Button>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                        <select value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="w-full p-2 border rounded text-sm outline-none">
                            {dates.length === 0 && <option value="">Sem dados</option>}
                            {dates.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Turno</label>
                        <select value={historyShift} onChange={(e) => setHistoryShift(e.target.value as any)} className="w-full p-2 border rounded text-sm outline-none">
                            <option value="ALL">Todos</option>
                            {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <div className="space-y-3">
                    {filteredHistoryMatches.length > 0 ? (
                        filteredHistoryMatches.map(match => (
                            <div key={match.id} className="border border-gray-100 rounded-lg p-3 hover:shadow-sm bg-white flex justify-between items-center text-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">{match.shift}</span>
                                        <span className="text-gray-400 font-mono text-xs">C{match.courtNumber} • J{match.gameNumber}</span>
                                    </div>
                                    <div className="font-semibold text-gray-800">{match.playerIds.map(pid => getPlayerName(pid)).join(' & ')}</div>
                                </div>
                                <div className={`px-3 py-1 rounded font-bold text-xs ${match.result === GameResult.WIN ? 'bg-green-100 text-green-700' : match.result === GameResult.DRAW ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    {match.result}
                                    {match.result === GameResult.DRAW && match.goldenPointWon !== undefined && (
                                        <span className="block text-[8px] opacity-75">{match.goldenPointWon ? '(PO: Ganhou)' : '(PO: Perdeu)'}</span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : <div className="text-center py-8 text-gray-400 italic">Sem resultados.</div>}
                </div>
            </div>
        </div>
      );
  }

  if (availableShifts.length === 0) {
      return (
          <div className="bg-white rounded-xl shadow p-8 text-center border-t-4 border-gray-300 animate-fade-in">
              <div className="flex justify-end mb-2">
                 <Button variant="ghost" onClick={() => setViewMode('history')} className="text-xs">📜 Ver Histórico</Button>
              </div>
              {isSubstituteOnly ? (
                  <div className="space-y-4">
                      <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto text-3xl">⏳</div>
                      <h2 className="text-xl font-bold text-yellow-700">Lugar em Suplente</h2>
                      <p className="text-gray-500 text-sm leading-relaxed">
                          Estás na lista de suplentes para <strong>{appState.nextSundayDate}</strong>. <br/>
                          Apenas jogadores com lugar confirmado podem registar resultados de jogos.
                      </p>
                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 text-[10px] text-yellow-800 uppercase font-black tracking-widest">
                          Vai ao separador "INSCREVER" para verificar o teu estado
                      </div>
                  </div>
              ) : (
                  <>
                    <h2 className="text-xl font-bold text-gray-400 mb-2">Sem Inscrições Ativas</h2>
                    <p className="text-gray-500">Não estás inscrito para <strong>{appState.nextSundayDate}</strong> (Jogos).</p>
                  </>
              )}
          </div>
      );
  }

  if (!selectedShift) return null;

  const currentShiftLimit = getLimitForShift(selectedShift);
  const myGamesPlayed = getGamesPlayedCount(currentUser.id, selectedShift);
  const isLimitReached = myGamesPlayed >= currentShiftLimit;
  const numCourts = getCourtsForShift(selectedShift);
  const availableCourts = Array.from({ length: numCourts }, (_, i) => i + 1);
  const availableGames = Array.from({ length: currentShiftLimit }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-padel-dark relative animate-fade-in">
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">🥎 Registar Resultado</h2>
              <p className="text-xs text-gray-500">Torneio: {appState.nextSundayDate}</p>
            </div>
            <Button variant="secondary" onClick={() => setViewMode('history')} className="text-xs px-3 py-1">Ver Histórico</Button>
        </div>

        {submitted ? (
          <div className="text-center py-10 animate-fade-in">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-800">Resultado Registado!</h3>
            <p className="text-gray-500">A atualizar classificação...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmitSelf} className="space-y-6">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">O teu Turno</label>
                <select 
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as Shift)}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white font-bold text-gray-700 outline-none"
                >
                    {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Jogo Nº</label>
                    <select 
                        value={selectedGame}
                        onChange={(e) => setSelectedGame(Number(e.target.value))}
                        disabled={true}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed outline-none"
                    >
                        {availableGames.map(n => <option key={n} value={n}>Jogo {n}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-padel-blue uppercase tracking-wide mb-2">
                        {selectedGame === 1 ? 'Em que campo começou?' : 'Campo Calculado'}
                    </label>
                    <select 
                        value={selectedCourt}
                        onChange={(e) => setSelectedCourt(Number(e.target.value))}
                        disabled={selectedGame > 1}
                        className={`w-full p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-padel ${selectedGame > 1 ? 'bg-gray-100 text-gray-600' : 'border-padel shadow-sm'}`}
                    >
                        {availableCourts.length > 0 
                            ? availableCourts.map(n => <option key={n} value={n}>Campo {n}</option>)
                            : <option value={1}>Campo 1</option>
                        }
                    </select>
                    {selectedGame > 1 && (
                         <p className="text-[10px] text-gray-400 mt-1 italic text-right">Baseado no jogo anterior (Sobe e Desce)</p>
                    )}
                </div>
            </div>

            <div>
                <div className="mb-6 bg-gray-100 p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-600 uppercase">Progresso</span>
                        <span className={`text-xs font-bold ${isLimitReached ? 'text-red-500' : 'text-padel-dark'}`}>{myGamesPlayed} / {currentShiftLimit}</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${isLimitReached ? 'bg-red-500' : 'bg-padel'}`} style={{ width: `${Math.min((myGamesPlayed / currentShiftLimit) * 100, 100)}%` }}></div>
                    </div>
                </div>

                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">O teu Resultado</label>
                <div className="grid grid-cols-3 gap-3">
                    <button
                        type="button"
                        onClick={() => { setSelfResult(GameResult.WIN); setGoldenPointWon(null); }}
                        disabled={isLimitReached}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selfResult === GameResult.WIN ? 'border-green-500 bg-green-50 text-green-700 scale-105' : 'border-gray-100 hover:border-green-200'}`}
                    >
                        <span className="text-2xl">🏆</span><span className="font-bold">Vitória</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setSelfResult(GameResult.DRAW); setGoldenPointWon(null); }}
                        disabled={isLimitReached}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selfResult === GameResult.DRAW ? 'border-yellow-500 bg-yellow-50 text-yellow-700 scale-105' : 'border-gray-100 hover:border-yellow-200'}`}
                    >
                        <span className="text-2xl">🤝</span><span className="font-bold">Empate</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setSelfResult(GameResult.LOSS); setGoldenPointWon(null); }}
                        disabled={isLimitReached}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selfResult === GameResult.LOSS ? 'border-red-400 bg-red-50 text-red-700 scale-105' : 'border-gray-100 hover:border-red-200'}`}
                    >
                        <span className="text-2xl">📉</span><span className="font-bold">Derrota</span>
                    </button>
                </div>

                {selfResult === GameResult.DRAW && (
                    <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 animate-slide-down">
                        <p className="text-center text-yellow-800 font-bold text-sm mb-3">Quem ganhou o Ponto de Ouro?</p>
                        <div className="flex gap-4">
                            <button 
                                type="button"
                                onClick={() => setGoldenPointWon(true)}
                                className={`flex-1 py-3 rounded-lg border-2 text-sm font-bold transition-all ${goldenPointWon === true ? 'bg-yellow-200 border-yellow-500 text-yellow-900' : 'bg-white border-yellow-100 text-gray-500 hover:bg-yellow-100'}`}
                            >
                                Nós Ganhámos 🙋
                            </button>
                            <button 
                                type="button"
                                onClick={() => setGoldenPointWon(false)}
                                className={`flex-1 py-3 rounded-lg border-2 text-sm font-bold transition-all ${goldenPointWon === false ? 'bg-yellow-200 border-yellow-500 text-yellow-900' : 'bg-white border-yellow-100 text-gray-500 hover:bg-yellow-100'}`}
                            >
                                Eles Ganharam 🙅
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <Button type="submit" className="w-full py-3 text-lg" disabled={!selfResult || isLimitReached || (selfResult === GameResult.DRAW && goldenPointWon === null)}>
              Confirmar Resultado
            </Button>
          </form>
        )}
      </div>

      {alertConfig && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm overflow-hidden border-t-8 border-padel">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-padel/10 text-padel-dark rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                          🥎
                      </div>
                      <h3 className="text-xl font-black text-padel-dark mb-2 tracking-tight">Mensagem do LevelUP</h3>
                      <div className="space-y-3">
                        <p className="text-gray-800 font-bold leading-tight">
                            {alertConfig.message}
                        </p>
                        {alertConfig.subMessage && (
                            <p className="text-sm text-gray-500 leading-relaxed italic border-t border-gray-100 pt-3">
                                {alertConfig.subMessage}
                            </p>
                        )}
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50">
                      <Button 
                        onClick={() => setAlertConfig(null)} 
                        className="w-full py-3 font-black uppercase tracking-widest text-sm"
                      >
                          OK, Entendido
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
