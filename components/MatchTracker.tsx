
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
    return () => {
        unsubscribe();
    };
  }, [loadData]); 

  const getPlayerName = (id: string) => allPlayers.find(p => p.id === id)?.name || 'Jogador Desconhecido';

  const getLimitForShift = (shift: Shift) => {
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
          if (prevMatch.goldenPointWon === true) moveDirection = -1;
          else if (prevMatch.goldenPointWon === false) moveDirection = 1;
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
          
          if (nextGame <= limit) setSelectedGame(nextGame);
          else setSelectedGame(limit);

          if (nextGame === 1) {
              const myReg = registrations.find(r => 
                  (r.playerId === currentUser.id || r.partnerId === currentUser.id) && 
                  r.shift === selectedShift && r.date === appState.nextSundayDate && !r.isWaitingList
              );
              setSelectedCourt(myReg?.startingCourt || 1);
          } else if (nextGame > 1 && nextGame <= limit) {
              setSelectedCourt(calculateNextCourt(selectedShift, nextGame));
          }
      }
  }, [selectedShift, matches.length, viewMode, registrations, appState.nextSundayDate, currentUser.id]);

  const getGamesPlayedCount = (playerId: string, shift: Shift) => {
    const tournamentDate = appState.nextSundayDate;
    return matches.filter(m => m.date === tournamentDate && m.shift === shift && m.playerIds.includes(playerId)).length;
  };

  const checkResultConflict = (shift: Shift, game: number, court: number, myResult: GameResult, myGoldenPointWon?: boolean): { msg: string, sub: string } | null => {
      const tournamentDate = appState.nextSundayDate;
      const existingMatches = matches.filter(m => m.date === tournamentDate && m.shift === shift && m.courtNumber === court && m.gameNumber === game);

      const myTeamMatch = existingMatches.find(m => m.playerIds.includes(currentUser.id));
      if (myTeamMatch) {
          return { 
              msg: "Já registaste este resultado", 
              sub: "O teu registo já consta na base de dados." 
          };
      }

      for (const match of existingMatches) {
          const teamNames = match.playerIds.map(pid => getPlayerName(pid)).join(' & ');
          let conflictMsg = "";
          if (match.result === GameResult.WIN && myResult === GameResult.WIN) conflictMsg = "A equipa adversária já registou Vitória.";
          if (match.result === GameResult.DRAW && myResult === GameResult.DRAW) {
              if (match.goldenPointWon === myGoldenPointWon) conflictMsg = "Ambas as equipas reclamaram o mesmo resultado no Ponto de Ouro.";
          }
          if (conflictMsg) return { msg: conflictMsg, sub: `Conflito com a equipa de: ${teamNames}` };
      }
      return null;
  };

  const handleSubmitSelf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfResult || !selectedShift) return;
    if (selfResult === GameResult.DRAW && goldenPointWon === null) {
        setAlertConfig({ message: "Ponto de Ouro em Falta", subMessage: "Indica quem ganhou o Ponto de Ouro." });
        return;
    }

    const limit = getLimitForShift(selectedShift);
    if (getGamesPlayedCount(currentUser.id, selectedShift) >= limit) {
        setAlertConfig({ message: "Limite Atingido", subMessage: "Já completaste os jogos previstos." });
        return;
    }

    const conflict = checkResultConflict(selectedShift, selectedGame, selectedCourt, selfResult, goldenPointWon !== null ? goldenPointWon : undefined);
    if (conflict) {
        setAlertConfig({ message: conflict.msg, subMessage: conflict.sub });
        return;
    }

    const allRegs = getRegistrations();
    const myRegistration = allRegs.find(r => (r.playerId === currentUser.id || r.partnerId === currentUser.id) && r.shift === selectedShift && r.date === appState.nextSundayDate && !r.isWaitingList);

    if (!myRegistration) return;

    const playerIds = [myRegistration.playerId];
    if (myRegistration.partnerId) playerIds.push(myRegistration.partnerId);

    const record: MatchRecord = {
      id: generateUUID(),
      date: appState.nextSundayDate,
      shift: selectedShift,
      courtNumber: selectedCourt,
      gameNumber: selectedGame,
      playerIds: playerIds,
      result: selfResult,
      timestamp: Date.now(),
      goldenPointWon: selfResult === GameResult.DRAW ? (goldenPointWon === true) : undefined
    };

    addMatch(record, POINTS_MAP[selfResult]);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setSelfResult(null);
      setGoldenPointWon(null);
    }, 2000);
  };

  if (viewMode === 'history') {
      const dates = Array.from(new Set(matches.map(m => m.date))).sort().reverse();
      return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-blue-600 animate-fade-in">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">📜 Histórico</h2>
                    </div>
                    <Button variant="secondary" onClick={() => setViewMode('input')} className="text-xs px-3 py-1">Voltar</Button>
                </div>
                <div className="space-y-3">
                    {matches.filter(m => m.date === historyDate).length > 0 ? (
                        matches.filter(m => m.date === historyDate).map(match => (
                            <div key={match.id} className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center text-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">{match.shift}</span>
                                        <span className="text-gray-400 font-mono text-xs">C{match.courtNumber} • J{match.gameNumber}</span>
                                    </div>
                                    <div className="font-semibold text-gray-800">{match.playerIds.map(pid => getPlayerName(pid)).join(' & ')}</div>
                                </div>
                                <div className={`px-3 py-1 rounded font-bold text-xs ${match.result === GameResult.WIN ? 'bg-green-100 text-green-700' : match.result === GameResult.DRAW ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    {match.result}
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
                 <Button variant="ghost" onClick={() => setViewMode('history')} className="text-xs">📜 Histórico</Button>
              </div>
              <h2 className="text-xl font-bold text-gray-400 mb-2">Sem Inscrições</h2>
              <p className="text-gray-500">Não estás confirmado em jogos para {appState.nextSundayDate}.</p>
          </div>
      );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-padel-dark relative animate-fade-in">
      <div className="p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 mb-6">🥎 Registar Resultado</h2>

        {submitted ? (
          <div className="text-center py-10 animate-fade-in">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-800">Registado com Sucesso!</h3>
          </div>
        ) : (
          <form onSubmit={handleSubmitSelf} className="space-y-6">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Turno</label>
                <select value={selectedShift!} onChange={(e) => setSelectedShift(e.target.value as Shift)} className="w-full p-3 border rounded-lg bg-white font-bold">
                    {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Jogo Nº</label>
                    <input disabled value={`Jogo ${selectedGame}`} className="w-full p-3 border rounded-lg bg-gray-50 text-gray-600 font-bold" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-padel-blue uppercase mb-2">Campo</label>
                    <input disabled value={`Campo ${selectedCourt}`} className="w-full p-3 border border-padel rounded-lg bg-white font-bold text-padel-dark" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <button type="button" onClick={() => { setSelfResult(GameResult.WIN); setGoldenPointWon(null); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selfResult === GameResult.WIN ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100'}`}>
                    <span className="text-2xl">🏆</span><span className="font-bold">Ganhei</span>
                </button>
                <button type="button" onClick={() => { setSelfResult(GameResult.DRAW); setGoldenPointWon(null); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selfResult === GameResult.DRAW ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-100'}`}>
                    <span className="text-2xl">🤝</span><span className="font-bold">Empate</span>
                </button>
                <button type="button" onClick={() => { setSelfResult(GameResult.LOSS); setGoldenPointWon(null); }} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selfResult === GameResult.LOSS ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100'}`}>
                    <span className="text-2xl">📉</span><span className="font-bold">Perdi</span>
                </button>
            </div>

            {selfResult === GameResult.DRAW && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 animate-slide-down">
                    <p className="text-center text-yellow-800 font-bold text-sm mb-3">Ponto de Ouro?</p>
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setGoldenPointWon(true)} className={`flex-1 py-3 rounded-lg border-2 font-bold ${goldenPointWon === true ? 'bg-yellow-200 border-yellow-500' : 'bg-white'}`}>Ganhámos 🙋</button>
                        <button type="button" onClick={() => setGoldenPointWon(false)} className={`flex-1 py-3 rounded-lg border-2 font-bold ${goldenPointWon === false ? 'bg-yellow-200 border-yellow-500' : 'bg-white'}`}>Perdemos 🙅</button>
                    </div>
                </div>
            )}

            <Button type="submit" className="w-full py-3 text-lg" disabled={!selfResult || (selfResult === GameResult.DRAW && goldenPointWon === null)}>
              Confirmar Resultado
            </Button>
          </form>
        )}
      </div>

      {alertConfig && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm border-t-8 border-padel p-6 text-center">
                  <h3 className="text-xl font-black text-padel-dark mb-4">{alertConfig.message}</h3>
                  <p className="text-sm text-gray-500 mb-6">{alertConfig.subMessage}</p>
                  <Button onClick={() => setAlertConfig(null)} className="w-full">OK</Button>
              </div>
          </div>
      )}
    </div>
  );
};
