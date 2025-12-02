import React, { useEffect, useState } from 'react';
import { Player, Registration, AppState, Shift } from '../types';
import { getPlayers, getRegistrations, getAppState } from '../services/storageService';

export const InscritosList: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [appState, setAppState] = useState<AppState>(getAppState());

  useEffect(() => {
    setAppState(getAppState());
    setPlayers(getPlayers());
    setRegistrations(getRegistrations());
  }, []);

  // Filter registrations for the active date
  const activeRegistrations = registrations.filter(r => r.date === appState.nextSundayDate);

  // Helper to get player details
  const getPlayer = (id: string) => players.find(p => p.id === id);

  // Group by Shift
  const shifts = Object.values(Shift);

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-sm border-l-4 border-padel">
        <h2 className="text-xl font-bold text-gray-800">📋 Inscritos Confirmados</h2>
        <p className="text-sm text-gray-500">Para o dia: <span className="font-mono font-bold text-padel-dark">{appState.nextSundayDate}</span></p>
        <p className="text-xs text-gray-400 mt-1">Ranking baseado na pontuação atual para organização de campos.</p>
      </div>

      {shifts.map(shift => {
        const shiftRegs = activeRegistrations.filter(r => r.shift === shift);
        
        // Enhance with player data and sort by total points (Descending)
        const sortedInscritos = shiftRegs.map(reg => {
            const p = getPlayer(reg.playerId);
            return { reg, player: p };
        }).sort((a, b) => (b.player?.totalPoints || 0) - (a.player?.totalPoints || 0));

        if (sortedInscritos.length === 0) return null;

        return (
            <div key={shift} className="bg-white/95 backdrop-blur-sm rounded-xl shadow overflow-hidden">
                <div className="bg-padel-blue text-white p-3 flex justify-between items-center">
                    <h3 className="font-bold">{shift}</h3>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{sortedInscritos.length} Jogadores</span>
                </div>
                <div className="divide-y divide-gray-100">
                    {sortedInscritos.map((item, idx) => (
                        <div key={item.reg.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 relative">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                                        {item.player?.photoUrl ? (
                                            <img src={item.player.photoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">
                                                {item.player?.participantNumber}
                                            </div>
                                        )}
                                    </div>
                                    <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-padel text-white text-[10px] flex items-center justify-center font-bold shadow-sm">
                                        {idx + 1}
                                    </span>
                                </div>
                                
                                <div>
                                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                                        {item.player?.name || 'Desconhecido'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {item.reg.hasPartner ? `Dupla: ${item.reg.partnerName}` : 'Individual'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-padel-dark">{item.player?.totalPoints || 0}</span>
                                <span className="text-xs text-gray-400 ml-1">pts</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
      })}

      {activeRegistrations.length === 0 && (
          <div className="text-center py-10 bg-white/50 rounded-xl">
              <p className="text-gray-500">Ainda não há inscritos para esta data.</p>
          </div>
      )}
    </div>
  );
};