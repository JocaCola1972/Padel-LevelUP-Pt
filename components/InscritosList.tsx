
import React, { useEffect, useState } from 'react';
import { Player, Registration, AppState, Shift } from '../types';
import { getPlayers, getRegistrations, getAppState, subscribeToChanges } from '../services/storageService';

export const InscritosList: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [appState, setAppState] = useState<AppState>(getAppState());

  const loadData = () => {
    setAppState(getAppState());
    setPlayers(getPlayers());
    setRegistrations(getRegistrations());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    const interval = setInterval(loadData, 5000); 
    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, []);

  const activeRegistrations = registrations.filter(r => r.date === appState.nextSundayDate);
  const getPlayer = (id: string) => players.find(p => p.id === id);
  const shifts = Object.values(Shift);

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-sm border-l-4 border-padel">
        <h2 className="text-xl font-bold text-gray-800">📋 Inscritos Confirmados</h2>
        <p className="text-sm text-gray-500">Para o dia: <span className="font-mono font-bold text-padel-dark">{appState.nextSundayDate}</span></p>
      </div>

      {shifts.map(shift => {
        const shiftRegs = activeRegistrations.filter(r => r.shift === shift);
        if (shiftRegs.length === 0) return null;

        const confirmed = shiftRegs.filter(r => !r.isWaitingList)
            .map(reg => ({ reg, player: getPlayer(reg.playerId) }))
            .sort((a, b) => (b.player?.totalPoints || 0) - (a.player?.totalPoints || 0));

        const waiting = shiftRegs.filter(r => r.isWaitingList)
            .map(reg => ({ reg, player: getPlayer(reg.playerId) }));

        return (
            <div key={shift} className="bg-white/95 backdrop-blur-sm rounded-xl shadow overflow-hidden">
                <div className="bg-padel-blue text-white p-3 flex justify-between items-center">
                    <h3 className="font-bold">{shift}</h3>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{confirmed.length} Inscritos</span>
                </div>
                
                <div className="divide-y divide-gray-100">
                    {confirmed.map((item, idx) => (
                        <div key={item.reg.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-padel text-white text-[10px] flex items-center justify-center font-bold">
                                    {idx + 1}
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                                        {item.player?.name || '...'}
                                        {item.reg.type === 'training' && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded font-bold">AULA</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-500">{item.reg.hasPartner ? `Dupla: ${item.reg.partnerName}` : 'Individual'}</div>
                                </div>
                            </div>
                            <div className="text-right font-bold text-padel-dark">{item.player?.totalPoints || 0} pts</div>
                        </div>
                    ))}
                </div>

                {waiting.length > 0 && (
                    <div className="bg-yellow-50/50 p-3 border-t border-yellow-100">
                        <h4 className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <span>⏳ Lista de Suplentes ({waiting.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 gap-1">
                            {waiting.map(item => (
                                <div key={item.reg.id} className="text-xs text-gray-600 flex justify-between items-center bg-white/50 p-2 rounded">
                                    <span className="font-medium">{item.player?.name || '...'} {item.reg.hasPartner ? <span className="text-[9px] text-gray-400">& {item.reg.partnerName}</span> : ''}</span>
                                    {item.reg.type === 'training' && <span className="text-[8px] opacity-60">TREINO</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
      })}
    </div>
  );
};
