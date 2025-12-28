
import React, { useEffect, useState, useMemo } from 'react';
import { Player, MatchRecord, Shift, GameResult } from '../types';
import { getPlayers, getMatches, subscribeToChanges } from '../services/storageService';
import { generateRankingAnalysis } from '../services/geminiService';
import { Button } from './Button';

export const RankingTable: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<Shift | 'ALL'>('ALL');

  const loadData = () => {
    setPlayers(getPlayers());
    setMatches(getMatches());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    return () => unsubscribe();
  }, []);

  const getPoints = (result: GameResult) => {
    switch (result) {
        case GameResult.WIN: return 4;
        case GameResult.DRAW: return 2;
        case GameResult.LOSS: return 1;
        default: return 0;
    }
  };

  const rankingData = useMemo(() => {
    if (selectedFilter === 'ALL') {
        return players
            .map(p => ({ ...p, displayPoints: p.totalPoints, displayGames: p.gamesPlayed }))
            .sort((a, b) => b.displayPoints - a.displayPoints);
    } else {
        const shiftMatches = matches.filter(m => m.shift === selectedFilter);
        const pointsMap: Record<string, number> = {};
        const gamesMap: Record<string, number> = {};

        players.forEach(p => { pointsMap[p.id] = 0; gamesMap[p.id] = 0; });
        shiftMatches.forEach(match => {
            const pts = getPoints(match.result);
            match.playerIds.forEach(pid => {
                if (pointsMap[pid] !== undefined) {
                    pointsMap[pid] += pts;
                    gamesMap[pid] += 1;
                }
            });
        });

        return players
            .map(p => ({ ...p, displayPoints: pointsMap[p.id] || 0, displayGames: gamesMap[p.id] || 0 }))
            .sort((a, b) => b.displayPoints - a.displayPoints || b.displayGames - a.displayGames);
    }
  }, [players, matches, selectedFilter]);

  const handleGenerateAnalysis = async () => {
    setLoadingAi(true);
    const top5 = rankingData.slice(0, 5);
    const text = await generateRankingAnalysis(top5.map(p => ({ ...p, totalPoints: p.displayPoints, gamesPlayed: p.displayGames })));
    setAnalysis(text);
    setLoadingAi(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        <button onClick={() => setSelectedFilter('ALL')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedFilter === 'ALL' ? 'bg-padel text-white' : 'bg-white text-gray-600'}`}>🌍 Geral</button>
        {Object.values(Shift).map(shift => (
            <button key={shift} onClick={() => setSelectedFilter(shift)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedFilter === shift ? 'bg-padel-blue text-white' : 'bg-white text-gray-600'}`}>{shift}</button>
        ))}
      </div>

      <div className="bg-gradient-to-r from-blue-900 to-padel-dark text-white rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">{selectedFilter === 'ALL' ? '🥇 Ranking Geral' : '🏅 Ranking Turno'}</h2>
            <p className="text-blue-100 text-sm">{selectedFilter === 'ALL' ? 'Pontuação acumulada' : `Classificação das ${selectedFilter}`}</p>
          </div>
          <Button onClick={handleGenerateAnalysis} disabled={loadingAi} variant="secondary" className="text-xs" isLoading={loadingAi}>🤖 Comentar</Button>
        </div>
        {analysis && <div className="bg-white/10 p-4 rounded-lg text-sm border border-white/20 animate-fade-in">🎙️ {analysis}</div>}
      </div>

      <div className="bg-white/95 rounded-xl shadow overflow-hidden border">
        <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase">Pos</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase">Jogador</th>
                <th className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase">Jogos</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-500 uppercase">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankingData.map((player, index) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{index < 3 ? ['🥇','🥈','🥉'][index] : `${index + 1}º`}</td>
                  <td className="px-4 py-3"><div className="flex flex-col"><span className="text-sm font-bold text-gray-900">{player.name}</span><span className="text-[10px] text-gray-400"># {player.participantNumber}</span></div></td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">{player.displayGames}</td>
                  <td className="px-4 py-3 text-right"><span className="px-2 py-1 text-xs font-bold rounded-full bg-padel/10 text-padel-dark">{player.displayPoints}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
};
