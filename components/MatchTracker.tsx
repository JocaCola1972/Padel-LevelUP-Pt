
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
  const [alertConfig, setAlertConfig] = useState<{ message: string; subMessage?: string } | null>(null);
  const [historyDate, setHistoryDate] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
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
    return () => unsubscribe();
  }, [loadData]); 

  const handleSearchHistory = async () => {
      setIsLoadingHistory(true);
      try {
          const historicalMatches = await fetchMatchesByDate(historyDate);
          // Faz merge com os locais mas apenas para exibição
          setMatches(historicalMatches);
      } catch (err) {
          alert("Erro ao buscar histórico.");
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const getPlayerName = (id: string) => allPlayers.find(p => p.id === id)?.name || 'Jogador...';

  const handleSubmitSelf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfResult || !selectedShift) return;
    if (selfResult === GameResult.DRAW && goldenPointWon === null) {
        setAlertConfig({ message: "Ponto de Ouro?", subMessage: "Indica quem ganhou o ponto final." });
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

    addMatch(record, POINTS_MAP[selfResult]);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setSelfResult(null); setGoldenPointWon(null); }, 2000);
  };

  if (viewMode === 'history') {
      return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-blue-600 animate-fade-in">
            <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-bold text-gray-800">📜 Histórico</h2>
                    <Button variant="ghost" onClick={() => setViewMode('input')} className="text-xs">Voltar</Button>
                </div>
                
                <div className="flex gap-2 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <input 
                        type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                        className="flex-1 p-2 border rounded text-sm outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <Button onClick={handleSearchHistory} isLoading={isLoadingHistory} className="text-xs px-4">Ver</Button>
                </div>

                <div className="space-y-3">
                    {matches.length > 0 ? (
                        matches.map(match => (
                            <div key={match.id} className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center text-sm shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-blue-100">{match.shift}</span>
                                        <span className="text-gray-400 font-mono text-xs">C{match.courtNumber} • J{match.gameNumber}</span>
                                    </div>
                                    <div className="font-bold text-gray-700">{match.playerIds.map(pid => getPlayerName(pid)).join(' & ')}</div>
                                </div>
                                <div className={`px-2 py-1 rounded font-black text-[10px] uppercase ${match.result === GameResult.WIN ? 'bg-green-100 text-green-700' : match.result === GameResult.DRAW ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    {match.result}
                                </div>
                            </div>
                        ))
                    ) : <div className="text-center py-10 text-gray-400 italic">Sem resultados para esta data.</div>}
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-padel-dark relative animate-fade-in">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">🥎 Registar Resultado</h2>
            <button onClick={() => setViewMode('history')} className="text-xs text-blue-600 font-bold hover:underline">Ver Histórico</button>
        </div>

        {submitted ? (
          <div className="text-center py-10 animate-fade-in">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-800">Guardado com sucesso!</h3>
          </div>
        ) : (
          <form onSubmit={handleSubmitSelf} className="space-y-6">
            {/* Formulario já funcional... */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Turno</label>
                <select value={selectedShift!} onChange={(e) => setSelectedShift(e.target.value as Shift)} className="w-full p-3 border rounded-lg bg-white font-bold">
                    {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Jogo</label><input disabled value={`Jogo ${selectedGame}`} className="w-full p-3 border rounded-lg bg-gray-50 font-bold" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Campo</label><input disabled value={`Campo ${selectedCourt}`} className="w-full p-3 border rounded-lg bg-gray-50 font-bold" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => {setSelfResult(GameResult.WIN); setGoldenPointWon(null);}} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${selfResult === GameResult.WIN ? 'border-green-500 bg-green-50 text-green-700' : 'bg-gray-50 border-transparent'}`}>🏆<span className="font-bold text-xs uppercase">Ganhei</span></button>
                <button type="button" onClick={() => {setSelfResult(GameResult.DRAW); setGoldenPointWon(null);}} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${selfResult === GameResult.DRAW ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'bg-gray-50 border-transparent'}`}>🤝<span className="font-bold text-xs uppercase">Empate</span></button>
                <button type="button" onClick={() => {setSelfResult(GameResult.LOSS); setGoldenPointWon(null);}} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${selfResult === GameResult.LOSS ? 'border-red-400 bg-red-50 text-red-700' : 'bg-gray-50 border-transparent'}`}>📉<span className="font-bold text-xs uppercase">Perdi</span></button>
            </div>
            <Button type="submit" disabled={!selfResult} className="w-full py-4 text-lg">Confirmar</Button>
          </form>
        )}
      </div>
    </div>
  );
};
