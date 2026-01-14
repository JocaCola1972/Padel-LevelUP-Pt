
import React, { useState, useEffect, useCallback } from 'react';
import { Player, Shift, GameResult, AppState, MatchRecord, Registration } from '../types';
import { addMatch, getAppState, getMatches, generateUUID, getRegistrations, getPlayers, subscribeToChanges, fetchMatchesByDate } from '../services/storageService';
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
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedGame, setSelectedGame] = useState(1);
  const [selectedCourt, setSelectedCourt] = useState(1); 
  const [submitted, setSubmitted] = useState(false);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [historyDate, setHistoryDate] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selfResult, setSelfResult] = useState<GameResult | null>(null);
  const [goldenPointWon, setGoldenPointWon] = useState<boolean | null>(null);

  const loadData = useCallback(() => {
    const currentState = getAppState();
    setMatches(getMatches());
    setAppState(currentState);
    setAllPlayers(getPlayers());
    const currentRegistrations = getRegistrations();
    setRegistrations(currentRegistrations);

    const myRegs = currentRegistrations.filter(r => 
      (r.playerId === currentUser.id || r.partnerId === currentUser.id) && 
      r.date === currentState.nextSundayDate && !r.isWaitingList
    );
    const uniqueShifts = Array.from(new Set(myRegs.map(r => r.shift)));
    setAvailableShifts(uniqueShifts);
    if (uniqueShifts.length > 0 && !selectedShift) setSelectedShift(uniqueShifts[0]);
    if (!historyDate) setHistoryDate(currentState.nextSundayDate);
  }, [currentUser.id, selectedShift, historyDate]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    return () => unsubscribe();
  }, [loadData]);

  const handleSubmitSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfResult || !selectedShift) return;
    
    // Validação estrita do Ponto de Ouro em caso de empate
    if (selfResult === GameResult.DRAW && goldenPointWon === null) {
        alert("Em caso de Empate, tens de indicar quem ganhou o PONTO DE OURO!");
        return;
    }

    const myRegistration = registrations.find(r => (r.playerId === currentUser.id || r.partnerId === currentUser.id) && r.shift === selectedShift && r.date === appState.nextSundayDate && !r.isWaitingList);
    if (!myRegistration) return;

    const playerIds = [myRegistration.playerId];
    if (myRegistration.partnerId) playerIds.push(myRegistration.partnerId);

    const record: MatchRecord = {
      id: generateUUID(), date: appState.nextSundayDate, shift: selectedShift,
      courtNumber: selectedCourt, gameNumber: selectedGame, playerIds: playerIds,
      result: selfResult, timestamp: Date.now(),
      goldenPointWon: selfResult === GameResult.DRAW ? (goldenPointWon === true) : undefined
    };

    await addMatch(record, POINTS_MAP[selfResult]);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setSelfResult(null); setGoldenPointWon(null); }, 2000);
  };

  const handleSearchHistory = async () => {
    setIsLoadingHistory(true);
    try {
        const h = await fetchMatchesByDate(historyDate);
        setMatches(h);
    } finally {
        setIsLoadingHistory(false);
    }
  };

  if (viewMode === 'history') {
      return (
        <div className="bg-white rounded-xl shadow-lg border-t-4 border-blue-600 animate-fade-in p-6">
            <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold">📜 Histórico</h2>
                <Button variant="ghost" onClick={() => setViewMode('input')} className="text-xs">Voltar</Button>
            </div>
            <div className="flex gap-2 mb-6 bg-gray-50 p-3 rounded-lg">
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="flex-1 p-2 border rounded text-sm" />
                <Button onClick={handleSearchHistory} isLoading={isLoadingHistory} className="text-xs px-4">Ver</Button>
            </div>
            <div className="space-y-3">
                {matches.map(m => (
                    <div key={m.id} className="border p-3 rounded-lg flex justify-between items-center text-sm">
                        <div className="font-bold">{m.playerIds.map(pid => allPlayers.find(p => p.id === pid)?.name).join(' & ')}</div>
                        <div className={`px-2 py-1 rounded font-black text-[10px] ${m.result === GameResult.WIN ? 'bg-green-100' : 'bg-red-100'}`}>{m.result}</div>
                    </div>
                ))}
            </div>
        </div>
      );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border-t-4 border-padel-dark p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">🥎 Registar Resultado</h2>
          <button onClick={() => setViewMode('history')} className="text-xs text-blue-600 font-bold">Histórico</button>
      </div>
      {submitted ? (
          <div className="text-center py-10">✅ Guardado!</div>
      ) : (
          <form onSubmit={handleSubmitSelf} className="space-y-6">
            <select value={selectedShift!} onChange={(e) => setSelectedShift(e.target.value as Shift)} className="w-full p-3 border rounded-lg font-bold">
                {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => {setSelfResult(GameResult.WIN); setGoldenPointWon(null);}} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 ${selfResult === GameResult.WIN ? 'border-green-500 bg-green-50' : 'bg-gray-50'}`}>🏆<span className="font-bold text-xs">VENCEU</span></button>
                <button type="button" onClick={() => {setSelfResult(GameResult.DRAW); setGoldenPointWon(null);}} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 ${selfResult === GameResult.DRAW ? 'border-yellow-500 bg-yellow-50' : 'bg-gray-50'}`}>🤝<span className="font-bold text-xs">EMPATE</span></button>
                <button type="button" onClick={() => {setSelfResult(GameResult.LOSS); setGoldenPointWon(null);}} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 ${selfResult === GameResult.LOSS ? 'border-red-400 bg-red-50' : 'bg-gray-50'}`}>📉<span className="font-bold text-xs">PERDEU</span></button>
            </div>
            {selfResult === GameResult.DRAW && (
                <div className="animate-slide-down p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest text-center mb-3">Quem ganhou o Ponto de Ouro?</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setGoldenPointWon(true)} className={`p-3 rounded-lg border-2 font-black text-[10px] uppercase transition-all ${goldenPointWon === true ? 'bg-yellow-400 border-yellow-600 text-yellow-900' : 'bg-white border-gray-200'}`}>Minha Equipa</button>
                        <button type="button" onClick={() => setGoldenPointWon(false)} className={`p-3 rounded-lg border-2 font-black text-[10px] uppercase transition-all ${goldenPointWon === false ? 'bg-gray-300 border-gray-400 text-gray-700' : 'bg-white border-gray-200'}`}>Adversários</button>
                    </div>
                </div>
            )}
            <Button type="submit" disabled={!selfResult || (selfResult === GameResult.DRAW && goldenPointWon === null)} className="w-full py-4 text-lg">Confirmar</Button>
          </form>
      )}
    </div>
  );
};
