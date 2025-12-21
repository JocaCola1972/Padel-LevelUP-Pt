
import React, { useState, useEffect, useRef } from 'react';
import { MastersState, MastersTeam, MastersMatch, Player, AppState } from '../types';
import { getMastersState, saveMastersState, getPlayers, generateUUID, getAppState, subscribeToChanges } from '../services/storageService';
import { Button } from './Button';

// Declare XLSX for sheetjs
declare const XLSX: any;

interface MastersLupProps {
  isAdmin: boolean;
}

export const MastersLup: React.FC<MastersLupProps> = ({ isAdmin }) => {
  const [state, setState] = useState<MastersState>(getMastersState());
  const [appState, setAppState] = useState<AppState>(getAppState());
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Admin Setup State
  const [newTeamP1, setNewTeamP1] = useState('');
  const [newTeamP2, setNewTeamP2] = useState('');
  const [newTeamGroup, setNewTeamGroup] = useState<'I' | 'II' | 'III' | 'IV'>('I');

  // Delete Confirmation State
  const [teamToDelete, setTeamToDelete] = useState<MastersTeam | null>(null);

  // Result Update Confirmation State
  const [pendingUpdate, setPendingUpdate] = useState<{ matchId: string, winnerId: string, currentWinnerId?: string } | null>(null);

  // Reset Confirmation State
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  // Auto Fill Confirmation State
  const [showAutoFillConfirmation, setShowAutoFillConfirmation] = useState(false);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setState(getMastersState());
    setAppState(getAppState());
    setPlayers(getPlayers());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges(loadData);
    return () => unsubscribe();
  }, []);

  const save = (newState: MastersState) => {
    saveMastersState(newState);
    setState(newState);
  };

  // --- POOL IMPORT LOGIC ---

  const handleImportPool = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const data = evt.target?.result;
              const workbook = XLSX.read(data, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const sheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

              const importedNames: string[] = [];
              // Assume Name is in the first column (index 0)
              jsonData.forEach((row: any[]) => {
                  if (row[0]) {
                      const name = String(row[0]).trim();
                      if (name && name.toLowerCase() !== 'nome') {
                           importedNames.push(name);
                      }
                  }
              });

              if (importedNames.length > 0) {
                  // Merge with existing pool, remove duplicates
                  const currentPool = state.pool || [];
                  const newPool = Array.from(new Set([...currentPool, ...importedNames]));
                  save({ ...state, pool: newPool });
                  alert(`${importedNames.length} jogadores carregados para a lista de elegíveis.`);
              } else {
                  alert("Não foram encontrados nomes válidos na primeira coluna.");
              }
          } catch (err) {
              console.error(err);
              alert("Erro ao ler ficheiro.");
          } finally {
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsBinaryString(file);
  };

  // --- HELPER: GET COMBINED POOL (Excel + Members) ---
  const getCombinedPool = () => {
      const excelPool = state.pool || [];
      // Fetch fresh players list or use state
      const memberNames = getPlayers().map(p => p.name);
      // Combine and remove duplicates
      return Array.from(new Set([...excelPool, ...memberNames]));
  };

  // --- SETUP LOGIC ---

  const addTeam = () => {
    if (!newTeamP1 || !newTeamP2) {
      alert("Selecione os dois jogadores da lista.");
      return;
    }
    if (newTeamP1 === newTeamP2) {
        alert("O jogador 1 e 2 não podem ser a mesma pessoa.");
        return;
    }

    // STRICT VALIDATION: Check Group Size
    const teamsInGroup = state.teams.filter(t => t.group === newTeamGroup).length;
    if (teamsInGroup >= 4) {
      alert(`O Grupo ${newTeamGroup} está completo (4 equipas). Tem de adicionar as equipas em grupos que não estejam completos.`);
      return;
    }

    const newTeam: MastersTeam = {
      id: generateUUID(),
      player1Name: newTeamP1,
      player2Name: newTeamP2,
      group: newTeamGroup,
      points: 0,
      gamesWon: 0,
      gamesLost: 0,
      setsWon: 0
    };

    const updatedTeams = [...state.teams, newTeam];
    save({ ...state, teams: updatedTeams });
    setNewTeamP1('');
    setNewTeamP2('');
  };

  const handleAutoFillRequest = () => {
      const combinedPool = getCombinedPool();
      
      // 1. Identify used players
      const usedPlayers = new Set<string>();
      state.teams.forEach(t => {
          usedPlayers.add(t.player1Name);
          usedPlayers.add(t.player2Name);
      });

      // 2. Filter available players
      let availablePool = combinedPool.filter(p => !usedPlayers.has(p));

      // Check if we have enough players roughly
      if (availablePool.length < 2) {
          alert("Não há jogadores suficientes na lista (Importados + Membros) para criar mais equipas.");
          return;
      }

      setShowAutoFillConfirmation(true);
  };

  const executeAutoFill = () => {
      const groups = ['I', 'II', 'III', 'IV'] as const;
      const combinedPool = getCombinedPool();
      
      // 1. Identify used players
      const usedPlayers = new Set<string>();
      state.teams.forEach(t => {
          usedPlayers.add(t.player1Name);
          usedPlayers.add(t.player2Name);
      });

      // 2. Filter available players
      let availablePool = combinedPool.filter(p => !usedPlayers.has(p));

      // 3. Shuffle Pool (Fisher-Yates)
      for (let i = availablePool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availablePool[i], availablePool[j]] = [availablePool[j], availablePool[i]];
      }

      const newTeams: MastersTeam[] = [];
      let poolIndex = 0;

      // 4. Fill gaps in each group
      for (const group of groups) {
          const currentCount = state.teams.filter(t => t.group === group).length + newTeams.filter(t => t.group === group).length;
          const needed = 4 - currentCount;

          for (let k = 0; k < needed; k++) {
              if (poolIndex + 1 >= availablePool.length) {
                  // Not enough players left for a full team
                  break;
              }

              const p1 = availablePool[poolIndex++];
              const p2 = availablePool[poolIndex++];

              newTeams.push({
                  id: generateUUID(),
                  player1Name: p1,
                  player2Name: p2,
                  group: group,
                  points: 0,
                  gamesWon: 0,
                  gamesLost: 0,
                  setsWon: 0
              });
          }
      }

      if (newTeams.length > 0) {
          save({ ...state, teams: [...state.teams, ...newTeams] });
      }
      
      setShowAutoFillConfirmation(false);
  };

  const confirmRemoveTeam = () => {
    if (!teamToDelete) return;
    save({ ...state, teams: state.teams.filter(t => t.id !== teamToDelete.id) });
    setTeamToDelete(null);
  };

  const startTournament = () => {
    if (state.teams.length < 16) {
      if(!confirm("Atenção: O torneio deve ter 16 equipas (4 por grupo). Deseja iniciar mesmo assim?")) return;
    }
    
    // Generate Group Matches (Round Robin within groups)
    const matches: MastersMatch[] = [];
    const groups = ['I', 'II', 'III', 'IV'] as const;
    const groupCourts = { 'I': [1, 2], 'II': [3, 4], 'III': [5, 6], 'IV': [7, 8] };

    groups.forEach(group => {
       const groupTeams = state.teams.filter(t => t.group === group);
       // Create simple round robin
       for (let i = 0; i < groupTeams.length; i++) {
         for (let j = i + 1; j < groupTeams.length; j++) {
            matches.push({
              id: generateUUID(),
              phase: 1,
              courtNumber: groupCourts[group][matches.length % 2], // Simple distribution
              team1Id: groupTeams[i].id,
              team2Id: groupTeams[j].id,
              group: group
            });
         }
       }
    });

    save({ ...state, matches, currentPhase: 1 });
  };

  const executeReset = () => {
    save({ teams: [], matches: [], currentPhase: 1, pool: state.pool }); // Keep the pool
    setShowResetConfirmation(false);
  };

  // --- GAME LOGIC ---

  const initiateMatchResultUpdate = (matchId: string, winnerId: string) => {
    const match = state.matches.find(m => m.id === matchId);
    if (!match) return;
    
    setPendingUpdate({
        matchId,
        winnerId,
        currentWinnerId: match.winnerId
    });
  };

  const confirmMatchResultUpdate = () => {
    if (!pendingUpdate) return;
    
    const { matchId, winnerId } = pendingUpdate;
    const matchIndex = state.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return;

    const match = state.matches[matchIndex];
    const updatedMatches = [...state.matches];
    updatedMatches[matchIndex] = { ...match, winnerId };

    // Update Standings if Phase 1
    let updatedTeams = [...state.teams];
    
    if (state.currentPhase === 1) {
        updatedTeams = updatedTeams.map(team => {
            // Reset stats to recalculate all from scratch for safety
            return { ...team, points: 0, gamesWon: 0, gamesLost: 0 };
        });

        // Re-tally all matches
        updatedMatches.forEach(m => {
            if (m.phase === 1 && m.winnerId) {
                const winner = updatedTeams.find(t => t.id === m.winnerId);
                const loser = updatedTeams.find(t => t.id === (m.team1Id === m.winnerId ? m.team2Id : m.team1Id));
                
                if (winner) {
                    winner.points += 1;
                    winner.gamesWon += 1;
                }
                if (loser) {
                    loser.gamesLost += 1;
                }
            }
        });
    }

    save({ ...state, matches: updatedMatches, teams: updatedTeams });
    setPendingUpdate(null);
  };

  // --- PHASE MANAGEMENT ---

  const getSortedGroupTeams = (group: string) => {
      return state.teams
        .filter(t => t.group === group)
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const diffA = a.gamesWon - a.gamesLost;
            const diffB = b.gamesWon - b.gamesLost;
            if (diffB !== diffA) return diffB - diffA;
            return b.gamesWon - a.gamesWon;
        });
  };

  const startPhase2 = () => {
     // Generate Phase 2 Matches
     const g1 = getSortedGroupTeams('I');
     const g2 = getSortedGroupTeams('II');
     const g3 = getSortedGroupTeams('III');
     const g4 = getSortedGroupTeams('IV');

     if (g1.length<4 || g2.length<4 || g3.length<4 || g4.length<4) {
         if(!confirm("Alguns grupos não têm 4 equipas. Isso pode causar problemas. Continuar?")) return;
     }

     const newMatches: MastersMatch[] = [];

     // Pos 1 (Semis)
     if(g1[0] && g3[0]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 1, team1Id: g1[0].id, team2Id: g3[0].id });
     if(g2[0] && g4[0]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 2, team1Id: g2[0].id, team2Id: g4[0].id });

     // Pos 2
     if(g1[1] && g3[1]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 3, team1Id: g1[1].id, team2Id: g3[1].id });
     if(g2[1] && g4[1]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 4, team1Id: g2[1].id, team2Id: g4[1].id });

     // Pos 3
     if(g1[2] && g3[2]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 5, team1Id: g1[2].id, team2Id: g3[2].id });
     if(g2[2] && g4[2]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 6, team1Id: g2[2].id, team2Id: g4[2].id });

     // Pos 4
     if(g1[3] && g3[3]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 7, team1Id: g1[3].id, team2Id: g3[3].id });
     if(g2[3] && g4[3]) newMatches.push({ id: generateUUID(), phase: 2, courtNumber: 8, team1Id: g2[3].id, team2Id: g4[3].id });

     save({ ...state, matches: [...state.matches, ...newMatches], currentPhase: 2 });
  };

  const startPhase3 = () => {
      const p2Matches = state.matches.filter(m => m.phase === 2);
      const newMatches: MastersMatch[] = [];

      const getResult = (court: number) => {
          const m = p2Matches.find(m => m.courtNumber === court);
          if (!m || !m.winnerId) return null;
          return {
              winnerId: m.winnerId,
              loserId: m.team1Id === m.winnerId ? m.team2Id : m.team1Id
          };
      };

      const c1 = getResult(1);
      const c2 = getResult(2);
      if (c1 && c2) {
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 1, team1Id: c1.winnerId, team2Id: c2.winnerId }); // Final
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 2, team1Id: c1.loserId, team2Id: c2.loserId }); 
      }

      const c3 = getResult(3);
      const c4 = getResult(4);
      if (c3 && c4) {
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 3, team1Id: c3.winnerId, team2Id: c4.winnerId });
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 4, team1Id: c3.loserId, team2Id: c4.loserId });
      }

      const c5 = getResult(5);
      const c6 = getResult(6);
      if (c5 && c6) {
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 5, team1Id: c5.winnerId, team2Id: c6.winnerId });
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 6, team1Id: c5.loserId, team2Id: c6.loserId });
      }

      const c7 = getResult(7);
      const c8 = getResult(8);
      if (c7 && c8) {
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 7, team1Id: c7.winnerId, team2Id: c8.winnerId });
          newMatches.push({ id: generateUUID(), phase: 3, courtNumber: 8, team1Id: c7.loserId, team2Id: c8.loserId });
      }

      save({ ...state, matches: [...state.matches, ...newMatches], currentPhase: 3 });
  };

  const renderMatchCard = (m: MastersMatch) => {
      const t1 = state.teams.find(t => t.id === m.team1Id);
      const t2 = state.teams.find(t => t.id === m.team2Id);
      const isFinished = !!m.winnerId;

      return (
          <div key={m.id} className={`bg-white p-3 rounded-lg shadow border-l-4 ${isFinished ? 'border-green-500' : 'border-gray-300'}`}>
              <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Campo {m.courtNumber}</span>
                  {m.phase === 1 && <span className="text-xs bg-gray-100 px-2 rounded text-gray-600">Grupo {m.group}</span>}
                  {m.phase === 3 && m.courtNumber === 1 && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 rounded font-bold">FINAL</span>}
                  {m.phase === 3 && m.courtNumber === 2 && <span className="text-xs bg-orange-100 text-orange-800 px-2 rounded font-bold">3º e 4º</span>}
              </div>
              
              <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => initiateMatchResultUpdate(m.id, m.team1Id)}
                    className={`p-2 rounded text-left text-sm font-semibold transition-all ${m.winnerId === m.team1Id ? 'bg-green-100 text-green-900 ring-2 ring-green-500' : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                      {t1?.player1Name} & {t1?.player2Name}
                  </button>
                  <div className="text-center text-xs text-gray-400 font-bold">VS</div>
                  <button 
                    onClick={() => initiateMatchResultUpdate(m.id, m.team2Id)}
                    className={`p-2 rounded text-left text-sm font-semibold transition-all ${m.winnerId === m.team2Id ? 'bg-green-100 text-green-900 ring-2 ring-green-500' : 'bg-gray-50 hover:bg-gray-100'}`}
                  >
                      {t2?.player1Name} & {t2?.player2Name}
                  </button>
              </div>
          </div>
      );
  };

  const combinedPool = getCombinedPool();
  const usedPlayers = new Set<string>();
  state.teams.forEach(t => {
      if(t.player1Name) usedPlayers.add(t.player1Name);
      if(t.player2Name) usedPlayers.add(t.player2Name);
  });

  const availablePlayers = combinedPool.filter(p => !usedPlayers.has(p)).sort((a, b) => a.localeCompare(b));
  const availableForP2 = availablePlayers.filter(p => p !== newTeamP1);

  // --- PODIUM CALCULATION ---
  const phase3Matches = state.matches.filter(m => m.phase === 3);
  const finalMatch = phase3Matches.find(m => m.courtNumber === 1);
  const thirdPlaceMatch = phase3Matches.find(m => m.courtNumber === 2);
  const hasPodiumResults = finalMatch?.winnerId && thirdPlaceMatch?.winnerId;

  let firstPlace: MastersTeam | undefined;
  let secondPlace: MastersTeam | undefined;
  let thirdPlace: MastersTeam | undefined;

  if (hasPodiumResults) {
      firstPlace = state.teams.find(t => t.id === finalMatch!.winnerId);
      const secondPlaceId = finalMatch!.team1Id === finalMatch!.winnerId ? finalMatch!.team2Id : finalMatch!.team1Id;
      secondPlace = state.teams.find(t => t.id === secondPlaceId);
      thirdPlace = state.teams.find(t => t.id === thirdPlaceMatch!.winnerId);
  }

  return (
    <div className="space-y-8 pb-20">
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-yellow-500">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-gray-800 italic">🏆 Masters LUP</h2>
                {isAdmin && (
                    <div className="space-x-2">
                        {state.teams.length > 0 && state.currentPhase === 1 && state.matches.length === 0 && (
                            <Button onClick={startTournament} className="bg-green-600">Iniciar Torneio</Button>
                        )}
                         {state.currentPhase === 1 && state.matches.length > 0 && (
                            <Button onClick={startPhase2}>Iniciar Fase 2 (Meias)</Button>
                        )}
                        {state.currentPhase === 2 && (
                            <Button onClick={startPhase3}>Iniciar Finais</Button>
                        )}
                        <Button variant="danger" onClick={() => setShowResetConfirmation(true)} className="text-xs">Reset</Button>
                    </div>
                )}
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
                Torneio Especial de Natal • Earlybirds + Breakfast Club + Family Brunch
            </p>
            
            {/* PODIUM DISPLAY */}
            {hasPodiumResults && (
                <>
                    <div className="relative overflow-hidden rounded-3xl shadow-2xl border-4 border-yellow-500/50 bg-[#0f172a] mb-8 animate-fade-in">
                        
                        {/* Background Effects */}
                        <div className="absolute inset-0 opacity-40" style={{
                            background: 'radial-gradient(circle at 50% 100%, #1e3a8a 0%, #0f172a 70%)'
                        }}></div>
                        <div className="absolute top-0 left-0 right-0 h-full opacity-20 bg-[repeating-conic-gradient(#1e40af_0_15deg,transparent_15deg_30deg)] animate-spin-slow origin-bottom"></div>

                        <div className="relative z-10 p-6 md:p-10 pt-16 text-center">
                            <h2 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 tracking-[0.2em] uppercase mb-1 drop-shadow-lg">
                                MASTERS LEVELUP
                            </h2>
                            <div className="flex flex-col items-center mb-8">
                                <h3 className="text-xl font-bold text-blue-200 uppercase tracking-widest">Quadro de Honra</h3>
                                <div className="mt-1 px-4 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
                                    <span className="text-yellow-400 font-mono text-sm font-bold">{appState.nextSundayDate}</span>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-6 mt-4">
                                
                                {/* 2nd Place */}
                                <div className="order-2 md:order-1 flex flex-col items-center w-full md:w-1/3">
                                    <div className="bg-gradient-to-b from-gray-300 to-gray-400 w-full rounded-t-lg p-1 shadow-lg transform translate-y-2">
                                        <div className="bg-slate-800 rounded p-3 border border-gray-400/30">
                                            <div className="text-gray-300 font-bold text-xs uppercase mb-1">2º Lugar</div>
                                            <div className="text-white font-bold text-xs md:text-sm leading-tight">{secondPlace?.player1Name}</div>
                                            <div className="text-white font-bold text-xs md:text-sm leading-tight">{secondPlace?.player2Name}</div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-b from-gray-400 to-gray-600 w-full h-24 flex items-center justify-center text-4xl shadow-inner border-t border-gray-300/50">
                                        🥈
                                    </div>
                                </div>

                                {/* 1st Place */}
                                <div className="order-1 md:order-2 flex flex-col items-center w-full md:w-1/3 z-20">
                                    <div className="absolute -top-16 animate-bounce">
                                        <span className="text-5xl drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">👑</span>
                                    </div>
                                    
                                    <div className="text-yellow-300 font-black text-sm md:text-base uppercase tracking-[0.2em] mb-2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                                        Campeões
                                    </div>

                                    <div className="bg-gradient-to-b from-yellow-300 to-yellow-500 w-full rounded-t-lg p-1.5 shadow-2xl transform scale-105">
                                        <div className="bg-slate-900 rounded p-4 border border-yellow-200/50 flex flex-col justify-center min-h-[70px]">
                                            <div className="text-white font-black text-sm md:text-lg leading-tight">{firstPlace?.player1Name}</div>
                                            <div className="text-white font-black text-sm md:text-lg leading-tight">{firstPlace?.player2Name}</div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 w-full h-32 flex items-center justify-center text-6xl shadow-inner border-t border-yellow-300/50 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-white/20 skew-x-12 translate-x-[-100%] animate-shimmer"></div>
                                        🏆
                                    </div>
                                </div>

                                {/* 3rd Place */}
                                <div className="order-3 flex flex-col items-center w-full md:w-1/3">
                                    <div className="bg-gradient-to-b from-orange-300 to-orange-400 w-full rounded-t-lg p-1 shadow-lg transform translate-y-4">
                                        <div className="bg-slate-800 rounded p-3 border border-orange-400/30">
                                            <div className="text-orange-300 font-bold text-xs uppercase mb-1">3º Lugar</div>
                                            <div className="text-white font-bold text-xs md:text-sm leading-tight">{thirdPlace?.player1Name}</div>
                                            <div className="text-white font-bold text-xs md:text-sm leading-tight">{thirdPlace?.player2Name}</div>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-b from-orange-500 to-orange-700 w-full h-20 flex items-center justify-center text-4xl shadow-inner border-t border-orange-300/50">
                                        🥉
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="text-center mb-10 animate-fade-in">
                             <Button 
                                onClick={() => setShowResetConfirmation(true)}
                                className="bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 py-3 px-8 text-lg rounded-full shadow-lg transform hover:scale-105 transition-transform"
                             >
                                🔄 Reiniciar Masters LevelUP
                             </Button>
                        </div>
                    )}
                </>
            )}

            {/* SETUP PHASE */}
            {state.matches.length === 0 && (
                <div className="space-y-6">
                    {isAdmin && (
                        <>
                            {/* IMPORT TOOL */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <h3 className="font-bold text-blue-800 mb-2">📥 Importar Lista de Elegíveis</h3>
                                <p className="text-xs text-blue-600 mb-3">Carregue um ficheiro Excel/CSV com os nomes dos jogadores na primeira coluna.</p>
                                <div className="flex gap-4 items-center">
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls, .csv" 
                                        ref={fileInputRef}
                                        onChange={handleImportPool}
                                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                                    />
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    Total elegíveis (Importados + Membros): <strong>{combinedPool.length}</strong> jogadores.
                                    <span className="ml-2 bg-gray-200 px-2 py-0.5 rounded text-gray-700">Disponíveis: {availablePlayers.length}</span>
                                </div>
                            </div>

                            {/* ADD TEAM */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-700">Adicionar Equipa</h3>
                                    {availablePlayers.length >= 2 && (
                                        <button 
                                            onClick={handleAutoFillRequest}
                                            className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-full hover:bg-purple-700 shadow-sm flex items-center gap-1 font-bold"
                                        >
                                            🎲 Preenchimento Automático
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <select 
                                        value={newTeamP1} 
                                        onChange={e => setNewTeamP1(e.target.value)} 
                                        className="p-2 border rounded bg-white"
                                    >
                                        <option value="">Selecionar Jogador 1</option>
                                        {availablePlayers.map((p, i) => <option key={`${p}_1_${i}`} value={p}>{p}</option>)}
                                    </select>

                                    <select 
                                        value={newTeamP2} 
                                        onChange={e => setNewTeamP2(e.target.value)} 
                                        className="p-2 border rounded bg-white"
                                        disabled={!newTeamP1}
                                    >
                                        <option value="">Selecionar Jogador 2</option>
                                        {availableForP2.map((p, i) => <option key={`${p}_2_${i}`} value={p}>{p}</option>)}
                                    </select>

                                    <select value={newTeamGroup} onChange={e => setNewTeamGroup(e.target.value as any)} className="p-2 border rounded bg-white">
                                        <option value="I">Grupo I</option>
                                        <option value="II">Grupo II</option>
                                        <option value="III">Grupo III</option>
                                        <option value="IV">Grupo IV</option>
                                    </select>
                                    <Button onClick={addTeam} disabled={!newTeamP1 || !newTeamP2}>Adicionar</Button>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {['I', 'II', 'III', 'IV'].map(group => (
                            <div key={group} className="border rounded-lg p-3">
                                <h4 className="font-bold bg-gray-100 p-2 rounded text-center mb-2 flex justify-between">
                                    <span>Grupo {group}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${state.teams.filter(t => t.group === group).length === 4 ? 'bg-green-200 text-green-800' : 'bg-gray-200'}`}>
                                        {state.teams.filter(t => t.group === group).length}/4
                                    </span>
                                </h4>
                                <ul className="space-y-1">
                                    {state.teams.filter(t => t.group === group).map(t => (
                                        <li key={t.id} className="text-sm flex justify-between p-2 bg-white border rounded">
                                            <span>{t.player1Name} & {t.player2Name}</span>
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => setTeamToDelete(t)} 
                                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                                    title="Eliminar Equipa"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                    {state.teams.filter(t => t.group === group).length === 0 && <li className="text-xs text-gray-400 italic text-center">Vazio</li>}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PHASE 1: GROUPS */}
            {state.currentPhase === 1 && state.matches.length > 0 && (
                <div className="space-y-8 animate-fade-in">
                    <h3 className="text-xl font-bold text-gray-700 border-b pb-2">Fase 1: Grupos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {['I', 'II', 'III', 'IV'].map(group => (
                            <div key={group} className="border rounded-lg overflow-hidden">
                                <h4 className="font-bold bg-gray-800 text-white p-2 text-center text-sm">Classificação Grupo {group}</h4>
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-100 font-bold">
                                        <tr>
                                            <th className="p-2 text-left">Equipa</th>
                                            <th className="p-2">V</th>
                                            <th className="p-2">D</th>
                                            <th className="p-2">Pts</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {getSortedGroupTeams(group).map((t, i) => (
                                            <tr key={t.id} className={`${i < 1 ? 'bg-yellow-50 font-semibold' : ''}`}>
                                                <td className="p-2">{t.player1Name} / {t.player2Name}</td>
                                                <td className="p-2 text-center">{t.gamesWon}</td>
                                                <td className="p-2 text-center">{t.gamesLost}</td>
                                                <td className="p-2 text-center font-bold">{t.points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {state.matches.filter(m => m.phase === 1).map(renderMatchCard)}
                    </div>
                </div>
            )}

            {/* PHASE 2 & 3 */}
            {state.currentPhase >= 2 && (
                <div className="space-y-8 animate-fade-in">
                     <div className="flex items-center gap-4 border-b pb-2">
                         <h3 className={`text-xl font-bold cursor-pointer ${state.currentPhase === 2 ? 'text-padel-dark underline' : 'text-gray-400'}`}>Fase 2: Meias/Cruzamentos</h3>
                         {state.currentPhase === 3 && <h3 className="text-xl font-bold text-padel-dark underline">Fase 3: Finais</h3>}
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {state.matches.filter(m => m.phase === state.currentPhase).sort((a,b) => a.courtNumber - b.courtNumber).map(renderMatchCard)}
                     </div>
                </div>
            )}
        </div>

        {/* Modal Components */}
        {pendingUpdate && (
             <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-blue-500">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">✅</div>
                        <h3 className="text-xl font-bold text-gray-800">Confirmar Resultado?</h3>
                        {pendingUpdate.currentWinnerId && pendingUpdate.currentWinnerId !== pendingUpdate.winnerId && (
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                ⚠️ Atenção: Este jogo já tinha um vencedor registado. Deseja alterar?
                            </div>
                        )}
                        <div className="mt-4">
                            <p className="text-xs text-gray-500 uppercase font-bold">Vencedor Selecionado:</p>
                            <p className="text-lg font-bold text-green-700">
                                {(() => {
                                    const team = state.teams.find(t => t.id === pendingUpdate.winnerId);
                                    return team ? `${team.player1Name} & ${team.player2Name}` : 'Equipa desconhecida';
                                })()}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setPendingUpdate(null)} className="flex-1">Cancelar</Button>
                        <Button onClick={confirmMatchResultUpdate} className="flex-1 bg-green-600 hover:bg-green-700">Confirmar</Button>
                    </div>
                </div>
            </div>
        )}

        {teamToDelete && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-800">Eliminar Equipa?</h3>
                        <p className="text-sm text-gray-600 mt-2">Vai remover a equipa <br/><span className="font-bold text-gray-800">{teamToDelete.player1Name} & {teamToDelete.player2Name}</span><br/> do Grupo {teamToDelete.group}.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setTeamToDelete(null)} className="flex-1">Cancelar</Button>
                        <Button variant="danger" onClick={confirmRemoveTeam} className="flex-1">Eliminar</Button>
                    </div>
                </div>
            </div>
        )}

        {showResetConfirmation && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">💣</div>
                        <h3 className="text-xl font-bold text-red-600">Reiniciar Torneio?</h3>
                        <p className="text-sm text-gray-700 mt-2 font-bold">Esta ação é irreversível.</p>
                        <p className="text-xs text-gray-500 mt-2">Todas as equipas, jogos, resultados e classificações do Masters serão apagados permanentemente.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowResetConfirmation(false)} className="flex-1">Cancelar</Button>
                        <Button variant="danger" onClick={executeReset} className="flex-1">Sim, Reiniciar</Button>
                    </div>
                </div>
            </div>
        )}

        {showAutoFillConfirmation && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-purple-600">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto text-3xl">🎲</div>
                        <h3 className="text-xl font-bold text-purple-800">Preenchimento Automático</h3>
                        <p className="text-sm text-gray-600 mt-2">O sistema vai distribuir aleatoriamente <strong>32 jogadores</strong> (ou os restantes necessários) pelos grupos até completar 16 equipas.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setShowAutoFillConfirmation(false)} className="flex-1">Cancelar</Button>
                        <Button onClick={executeAutoFill} className="flex-1 bg-purple-600 hover:bg-purple-700">Confirmar</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
