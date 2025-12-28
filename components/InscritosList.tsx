
import React, { useEffect, useState } from 'react';
import { Player, Registration, AppState, Shift } from '../types';
import { getPlayers, getRegistrations, getAppState, subscribeToChanges, isFirebaseConnected } from '../services/storageService';

export const InscritosList: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [appState, setAppState] = useState<AppState>(getAppState());
  const [isLive, setIsLive] = useState(isFirebaseConnected());
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const loadData = () => {
    setAppState(getAppState());
    setPlayers(getPlayers());
    setRegistrations(getRegistrations());
    setIsLive(isFirebaseConnected());
    setLastUpdate(Date.now());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    // Removemos o polling de 10s porque o subscribeToChanges já apanha os updates do Realtime
    return () => unsubscribe();
  }, []);

  const activeRegistrations = registrations.filter(r => r.date === appState.nextSundayDate);
  const getPlayer = (id: string) => players.find(p => p.id === id);
  const shifts = Object.values(Shift);

  const getActivityCapacity = (shift: Shift, type: 'game' | 'training') => {
    const config = appState.courtConfig[shift];
    if (!config) return 0;
    return (config[type] || 0) * 4;
  };

  const getActivityOccupancy = (shift: Shift, type: 'game' | 'training') => {
    return activeRegistrations
      .filter(r => 
        r.shift === shift && 
        (r.type === type || (!r.type && type === 'game')) && 
        !r.isWaitingList
      )
      .reduce((acc, r) => acc + (r.hasPartner ? 2 : 1), 0);
  };

  const renderPlayerList = (list: { reg: Registration, player: Player | undefined }[]) => {
    return list.map((item, idx) => (
      <div key={item.reg.id} className="p-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 animate-fade-in">
          <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-padel-blue/10 text-padel-blue text-[10px] flex items-center justify-center font-black italic border border-padel-blue/20">
                  {idx + 1}º
              </div>
              <div>
                  <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                      {item.player?.name || 'Jogador...'}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                      {item.reg.hasPartner ? (
                          <>
                            <span className="text-padel">👥 Dupla:</span>
                            <span className="text-gray-600 truncate max-w-[120px]">{item.reg.partnerName}</span>
                          </>
                      ) : (
                          <span className="italic">👤 Individual</span>
                      )}
                  </div>
              </div>
          </div>
          <div className="text-right">
              <div className="text-xs font-black text-padel-dark">{item.player?.totalPoints || 0}</div>
              <div className="text-[8px] text-gray-400 uppercase font-bold">Pontos</div>
          </div>
      </div>
    ));
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-lg border-l-8 border-padel relative overflow-hidden">
        <div className="flex justify-between items-center relative z-10">
            <div>
            <h2 className="text-2xl font-black text-gray-800 italic transform -skew-x-6">
                LISTA DE <span className="text-padel">INSCRITOS</span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">
                    Domingo, {appState.nextSundayDate}
                </p>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded-full border border-gray-200">
                    <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-[8px] font-black uppercase text-gray-500">{isLive ? 'Tempo Real' : 'Desligado'}</span>
                </div>
            </div>
            </div>
            <div className="text-right">
                <span className="block text-[10px] font-black text-gray-400 uppercase">Confirmados</span>
                <span className="text-2xl font-black text-padel-blue">
                    {activeRegistrations.filter(r => !r.isWaitingList).reduce((acc, r) => acc + (r.hasPartner ? 2 : 1), 0)}
                </span>
            </div>
        </div>
        <div key={lastUpdate} className="absolute inset-0 bg-padel/5 animate-[shimmer_1s_ease-out_infinite] pointer-events-none opacity-0"></div>
      </div>

      <div className="space-y-8">
        {shifts.map(shift => {
          const gameCap = getActivityCapacity(shift, 'game');
          const gameOcc = getActivityOccupancy(shift, 'game');
          const trainCap = getActivityCapacity(shift, 'training');
          const trainOcc = getActivityOccupancy(shift, 'training');

          const shiftRegs = activeRegistrations.filter(r => r.shift === shift && !r.isWaitingList);
          const gamesList = shiftRegs.filter(r => r.type === 'game' || !r.type)
              .map(reg => ({ reg, player: getPlayer(reg.playerId) }))
              .sort((a, b) => (b.player?.totalPoints || 0) - (a.player?.totalPoints || 0));

          const trainingList = shiftRegs.filter(r => r.type === 'training')
              .map(reg => ({ reg, player: getPlayer(reg.playerId) }))
              .sort((a, b) => (b.player?.totalPoints || 0) - (a.player?.totalPoints || 0));

          const waitingList = activeRegistrations.filter(r => r.shift === shift && r.isWaitingList)
              .map(reg => ({ reg, player: getPlayer(reg.playerId) }));

          return (
              <div key={shift} className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-white/20 transition-all duration-300">
                  <div className="bg-gray-800 text-white p-4">
                      <h3 className="font-black italic text-lg tracking-tight uppercase">{shift}</h3>
                  </div>

                  <div className="p-4 space-y-6">
                      {gameCap > 0 && (
                          <div className="space-y-3">
                              <div className="flex justify-between items-end">
                                  <h4 className="text-xs font-black text-padel-dark uppercase tracking-widest flex items-center gap-2">
                                      <span className="text-lg">🎾</span> JOGOS
                                  </h4>
                                  <div className="text-right">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase block">{gameOcc} / {gameCap} Vagas</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${gameOcc >= gameCap ? 'bg-red-500/20 text-red-500' : 'bg-padel/20 text-padel-dark'}`}>
                                          {gameOcc >= gameCap ? 'Esgotado' : 'Disponível'}
                                      </span>
                                  </div>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                      className={`h-full transition-all duration-1000 ${gameOcc >= gameCap ? 'bg-red-500' : 'bg-padel'}`}
                                      style={{ width: `${Math.min((gameOcc/gameCap)*100, 100)}%` }}
                                  ></div>
                              </div>
                              <div className="bg-white/50 rounded-xl border border-gray-100 overflow-hidden">
                                  {gamesList.length > 0 ? renderPlayerList(gamesList) : (
                                      <p className="p-4 text-center text-[10px] text-gray-400 font-bold uppercase italic">Sem inscritos em jogos</p>
                                  )}
                              </div>
                          </div>
                      )}

                      {trainCap > 0 && (
                          <div className="space-y-3 pt-4 border-t border-gray-100">
                              <div className="flex justify-between items-end">
                                  <h4 className="text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                                      <span className="text-lg">🎓</span> TREINO
                                  </h4>
                                  <div className="text-right">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase block">{trainOcc} / {trainCap} Vagas</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${trainOcc >= trainCap ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-600'}`}>
                                          {trainOcc >= trainCap ? 'Esgotado' : 'Disponível'}
                                      </span>
                                  </div>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                      className={`h-full transition-all duration-1000 ${trainOcc >= trainCap ? 'bg-red-500' : 'bg-orange-500'}`}
                                      style={{ width: `${Math.min((trainOcc/trainCap)*100, 100)}%` }}
                                  ></div>
                              </div>
                              <div className="bg-white/50 rounded-xl border border-gray-100 overflow-hidden">
                                  {trainingList.length > 0 ? renderPlayerList(trainingList) : (
                                      <p className="p-4 text-center text-[10px] text-gray-400 font-bold uppercase italic">Sem inscritos em treino</p>
                                  )}
                              </div>
                          </div>
                      )}

                      {waitingList.length > 0 && (
                          <div className="bg-yellow-50/80 p-4 rounded-xl border border-yellow-100 mt-4">
                              <h4 className="text-[10px] font-black text-yellow-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                  <span className="animate-pulse">⏳</span> Suplentes ({waitingList.length})
                              </h4>
                              <div className="space-y-2">
                                  {waitingList.map(item => (
                                      <div key={item.reg.id} className="text-[11px] font-bold text-yellow-900 flex justify-between items-center bg-white/60 p-2 rounded-lg border border-yellow-200/50 shadow-sm">
                                          <div className="flex items-center gap-2">
                                            <span>
                                                {item.player?.name || '...'} 
                                                {item.reg.hasPartner && <span className="text-yellow-600/70 font-medium italic"> & {item.reg.partnerName}</span>}
                                            </span>
                                          </div>
                                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${item.reg.type === 'training' ? 'bg-orange-100 text-orange-600' : 'bg-padel/10 text-padel-dark'}`}>
                                              {item.reg.type === 'training' ? 'TREINO' : 'JOGO'}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          );
        })}
      </div>
    </div>
  );
};
