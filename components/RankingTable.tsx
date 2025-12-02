import React, { useEffect, useState, useMemo } from 'react';
import { Player, MatchRecord, Shift, GameResult } from '../types';
import { getPlayers, getMatches } from '../services/storageService';
import { generateRankingAnalysis } from '../services/geminiService';
import { Button } from './Button';

export const RankingTable: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Filter State: 'ALL' or specific Shift
  const [selectedFilter, setSelectedFilter] = useState<Shift | 'ALL'>('ALL');

  useEffect(() => {
    setPlayers(getPlayers());
    setMatches(getMatches());
  }, []);

  // Helper to get points from result
  const getPoints = (result: GameResult) => {
    switch (result) {
        case GameResult.WIN: return 4;
        case GameResult.DRAW: return 2;
        case GameResult.LOSS: return 1;
        default: return 0;
    }
  };

  // Compute Ranking Data based on selection
  const rankingData = useMemo(() => {
    if (selectedFilter === 'ALL') {
        // Return global ranking based on stored totalPoints
        return players
            .map(p => ({
                ...p,
                displayPoints: p.totalPoints,
                displayGames: p.gamesPlayed
            }))
            .sort((a, b) => b.displayPoints - a.displayPoints);
    } else {
        // Calculate points specifically for the selected shift
        const shiftMatches = matches.filter(m => m.shift === selectedFilter);
        
        // Maps to store calculated data
        const pointsMap: Record<string, number> = {};
        const gamesMap: Record<string, number> = {};

        // Initialize maps for all players (so everyone appears even with 0 points)
        players.forEach(p => {
            pointsMap[p.id] = 0;
            gamesMap[p.id] = 0;
        });

        // Iterate matches and distribute points
        shiftMatches.forEach(match => {
            const pts = getPoints(match.result);
            match.playerIds.forEach(pid => {
                if (pointsMap[pid] !== undefined) {
                    pointsMap[pid] += pts;
                    gamesMap[pid] += 1;
                }
            });
        });

        // Map back to player structure and sort
        return players
            .map(p => ({
                ...p,
                displayPoints: pointsMap[p.id] || 0,
                displayGames: gamesMap[p.id] || 0
            }))
            .sort((a, b) => {
                // Sort by Points DESC, then Games DESC (more games = better tie breaker? or fewer? usually points matter most)
                if (b.displayPoints !== a.displayPoints) return b.displayPoints - a.displayPoints;
                return b.displayGames - a.displayGames;
            });
    }
  }, [players, matches, selectedFilter]);

  const handleGenerateAnalysis = async () => {
    setLoadingAi(true);
    const top5 = rankingData.slice(0, 5);
    const contextText = selectedFilter === 'ALL' ? 'Ranking Geral' : `Ranking do turno ${selectedFilter}`;
    
    // We pass the calculated displayPoints to the AI service context if needed, 
    // but the current service takes Player objects. We can map them temporarily.
    const tempPlayersForAi = top5.map(p => ({
        ...p,
        totalPoints: p.displayPoints,
        gamesPlayed: p.displayGames
    }));

    // We might need to adjust the prompt in the service to handle context, 
    // but for now let's use the existing function which expects Player[]
    const text = await generateRankingAnalysis(tempPlayersForAi);
    setAnalysis(`[${contextText}] ${text}`);
    setLoadingAi(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Filters / Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        <button
            onClick={() => setSelectedFilter('ALL')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedFilter === 'ALL' 
                ? 'bg-padel text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
        >
            🌍 Geral
        </button>
        {Object.values(Shift).map(shift => (
            <button
                key={shift}
                onClick={() => setSelectedFilter(shift)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedFilter === shift 
                    ? 'bg-padel-blue text-white shadow-md' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
                {shift}
            </button>
        ))}
      </div>

      {/* AI Header Section */}
      <div className="bg-gradient-to-r from-blue-900 to-padel-dark text-white rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">
                {selectedFilter === 'ALL' ? '🥇 Ranking Geral' : '🏅 Ranking Turno'}
            </h2>
            <p className="text-blue-100 text-sm">
                {selectedFilter === 'ALL' ? 'Pontuação acumulada de todos os turnos' : `Classificação específica das ${selectedFilter}`}
            </p>
          </div>
          <Button 
            onClick={handleGenerateAnalysis} 
            disabled={loadingAi}
            variant="secondary"
            className="text-xs"
            isLoading={loadingAi}
          >
            🤖 Comentar Top 5
          </Button>
        </div>

        {analysis && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-sm leading-relaxed border border-white/20 animate-fade-in">
            <span className="text-xl mr-2">🎙️</span>
            {analysis}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white/95 backdrop-blur rounded-xl shadow overflow-hidden border border-white/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12">Pos</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Jogador</th>
                <th className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Jogos</th>
                <th className="px-4 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rankingData.map((player, index) => (
                <tr key={player.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `${index + 1}º`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{player.name}</span>
                        <span className="text-[10px] text-gray-400">ID: #{player.participantNumber}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                    {player.displayGames}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-padel-light/20 text-padel-dark">
                      {player.displayPoints}
                    </span>
                  </td>
                </tr>
              ))}
              {rankingData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Ainda não há registos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};