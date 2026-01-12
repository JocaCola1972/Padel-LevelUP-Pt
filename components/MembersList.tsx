
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player, AppState, Message } from '../types';
import { getPlayers, savePlayer, removePlayer, generateUUID, getAppState, approvePlayer, subscribeToChanges, fetchPlayersBatch, normalizePhone, savePlayersBulk } from '../services/storageService';
import { Button } from './Button';

declare const XLSX: any;

interface MembersListProps {
    currentUser?: Player;
}

export const MembersList: React.FC<MembersListProps> = ({ currentUser }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Infinite Scroll State
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLDivElement | null>(null);
  const BATCH_SIZE = 50;

  // Selection & Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadInitialData = useCallback(async () => {
      setIsLoadingMore(true);
      try {
          const initialBatch = await fetchPlayersBatch(0, BATCH_SIZE, debouncedSearch);
          setPlayers(initialBatch);
          setOffset(BATCH_SIZE);
          setHasMore(initialBatch.length === BATCH_SIZE);
      } catch (err) {
          console.error("Erro ao carregar membros:", err);
      } finally {
          setIsLoadingMore(false);
      }
  }, [debouncedSearch]);

  const loadMorePlayers = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
        const nextBatch = await fetchPlayersBatch(offset, BATCH_SIZE, debouncedSearch);
        if (nextBatch.length < BATCH_SIZE) setHasMore(false);
        setPlayers(prev => [...prev, ...nextBatch]);
        setOffset(prev => prev + BATCH_SIZE);
    } catch (err) {
        console.error("Erro ao carregar mais membros:", err);
    } finally {
        setIsLoadingMore(false);
    }
  }, [offset, hasMore, isLoadingMore, debouncedSearch]);

  useEffect(() => {
    loadInitialData();
    const unsubscribe = subscribeToChanges(loadInitialData);
    return () => unsubscribe();
  }, [loadInitialData]);

  useEffect(() => {
    if (isLoadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMorePlayers();
      }
    }, { threshold: 0.1 });

    if (lastElementRef.current) {
      observerRef.current.observe(lastElementRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loadMorePlayers, hasMore, isLoadingMore]);

  const isOnline = (player: Player) => {
      if (!player.lastActive) return false;
      return (Date.now() - player.lastActive) < (5 * 60 * 1000);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || newPhone.length < 9) return;
    const newPlayer: Player = {
        id: generateUUID(), name: newName, phone: normalizePhone(newPhone),
        totalPoints: 0, gamesPlayed: 0, participantNumber: 0,
        role: 'user', isApproved: true
    };
    await savePlayer(newPlayer);
    setNewName(''); setNewPhone(''); setIsAddModalOpen(false);
    loadInitialData();
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const data = evt.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            if (jsonData.length === 0) {
                alert("O ficheiro está vazio.");
                return;
            }

            const existingPlayers = getPlayers();
            const existingPhones = new Set(existingPlayers.map(p => p.phone));
            let nextParticipantNum = existingPlayers.length > 0 
                ? Math.max(...existingPlayers.map(p => p.participantNumber)) + 1 
                : 1;

            const newPlayersToImport: Player[] = [];
            let duplicatesCount = 0;

            jsonData.forEach((row: any) => {
                // Tenta encontrar as colunas por nome ou posição
                const name = row.Nome || row.name || row['Nome Completo'] || Object.values(row)[0];
                const rawPhone = row.Telemóvel || row.Telefone || row.phone || row.mobile || Object.values(row)[1];
                
                if (!name || !rawPhone) return;

                const cleanPhone = normalizePhone(String(rawPhone));
                const cleanName = String(name).trim();

                if (existingPhones.has(cleanPhone)) {
                    duplicatesCount++;
                    return;
                }

                newPlayersToImport.push({
                    id: generateUUID(),
                    name: cleanName,
                    phone: cleanPhone,
                    totalPoints: 0,
                    gamesPlayed: 0,
                    participantNumber: nextParticipantNum++,
                    role: 'user',
                    isApproved: true
                });
                existingPhones.add(cleanPhone);
            });

            if (newPlayersToImport.length > 0) {
                await savePlayersBulk(newPlayersToImport);
                alert(`Importação concluída!\n✅ ${newPlayersToImport.length} novos membros adicionados.\n⚠️ ${duplicatesCount} registos ignorados por duplicidade de telemóvel.`);
                loadInitialData();
            } else {
                alert(`Nenhum membro novo importado. Encontrados ${duplicatesCount} duplicados.`);
            }
        } catch (err) {
            console.error("Erro ao importar Excel:", err);
            alert("Erro ao processar o ficheiro. Verifica se o formato está correto.");
        } finally {
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };
    reader.readAsBinaryString(file);
  };

  const handleApprove = async (player: Player) => {
      await approvePlayer(player.id);
      loadInitialData();
  };

  const confirmDelete = async () => {
      if (playerToDelete) {
          await removePlayer(playerToDelete.id);
          setPlayers(prev => prev.filter(p => p.id !== playerToDelete.id));
          setPlayerToDelete(null);
          setTimeout(loadInitialData, 500);
      }
  };

  const isAnyAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-padel-blue">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-black text-gray-800 italic transform -skew-x-6">👥 GESTÃO DE <span className="text-padel">MEMBROS</span></h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Total listados: {players.length}</p>
            </div>
            {isAnyAdmin && (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <input 
                        type="file" 
                        ref={excelInputRef} 
                        className="hidden" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleImportExcel} 
                    />
                    <Button onClick={() => excelInputRef.current?.click()} variant="secondary" className="text-xs">
                        📥 Importar Excel
                    </Button>
                    <Button onClick={() => setIsAddModalOpen(true)} className="text-xs">
                        + Novo Jogador
                    </Button>
                </div>
            )}
        </div>
        <div className="mt-6 relative">
            <input 
                type="text" placeholder="Pesquisar por nome ou telemóvel..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-padel-blue outline-none transition-all font-bold"
            />
            {isLoadingMore && offset === 0 && (
                <div className="absolute right-4 top-4.5">
                    <div className="w-5 h-5 border-2 border-padel-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
      </div>

      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-white/20">
        <div className="divide-y divide-gray-100">
            {players.map((player) => (
                <div key={player.id} className={`p-4 hover:bg-gray-50 flex items-center justify-between transition-colors ${player.isApproved === false ? 'bg-red-50/50' : ''}`}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white overflow-hidden relative shadow-md border-2 border-padel">
                            {player.photoUrl ? (
                                <img 
                                    src={player.photoUrl} 
                                    loading="lazy" 
                                    className="w-full h-full object-cover" 
                                    alt={player.name}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center font-black text-padel-dark text-xs bg-gray-50">
                                    #{player.participantNumber}
                                </div>
                            )}
                            {isOnline(player) && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm animate-pulse"></div>
                            )}
                        </div>
                        <div>
                            <div className="font-black text-gray-800 text-sm flex items-center gap-2">
                                {player.name}
                                {player.role === 'admin' && <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Admin</span>}
                                {player.role === 'super_admin' && <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Super</span>}
                                {player.isApproved === false && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter animate-pulse">Pendente</span>}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                                <span>#{player.participantNumber}</span>
                                <span>•</span>
                                <span className="font-bold">{player.phone}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {isAnyAdmin && player.isApproved === false && (
                            <button 
                                onClick={() => handleApprove(player)}
                                className="p-2 text-green-500 hover:bg-green-100 rounded-full transition-all"
                                title="Aprovar utilizador"
                            >
                                ✅
                            </button>
                        )}
                        {isAnyAdmin && player.id !== currentUser?.id && (
                            <button 
                                onClick={() => setPlayerToDelete(player)} 
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                title="Eliminar utilizador"
                            >
                                🗑️
                            </button>
                        )}
                    </div>
                </div>
            ))}
            
            <div ref={lastElementRef} className="h-10 w-full flex items-center justify-center">
                 {isLoadingMore && (
                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                        A carregar...
                    </div>
                 )}
            </div>
        </div>
        
        {!hasMore && players.length > 0 && (
            <div className="p-6 bg-gray-50 text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] border-t border-gray-100">
                Fim da Base de Dados
            </div>
        )}
        
        {players.length === 0 && !isLoadingMore && (
            <div className="p-20 text-center text-gray-400 italic bg-gray-50 flex flex-col items-center">
                <span className="text-4xl mb-4">🔍</span>
                <p className="font-bold uppercase text-xs">Nenhum membro encontrado</p>
                <p className="text-[10px] mt-1">Verifica os termos da pesquisa.</p>
            </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {playerToDelete && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl border-t-8 border-red-600">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚠️</div>
                  <h3 className="font-black text-xl text-center text-gray-800 mb-2 uppercase italic tracking-tighter">Eliminar Jogador?</h3>
                  <p className="text-sm text-center text-gray-500 mb-8 leading-relaxed">
                      Esta ação apagará permanentemente a ficha de <span className="font-black text-gray-800">{playerToDelete.name}</span>, incluindo o seu histórico de mensagens e inscrições.
                  </p>
                  <div className="flex gap-3">
                      <Button variant="ghost" onClick={() => setPlayerToDelete(null)} className="flex-1 font-bold">Cancelar</Button>
                      <Button variant="danger" onClick={confirmDelete} className="flex-1 font-black shadow-lg shadow-red-200">ELIMINAR</Button>
                  </div>
              </div>
          </div>
      )}

      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl border-t-8 border-padel">
                  <h3 className="text-xl font-black text-gray-800 mb-6 italic uppercase transform -skew-x-6 tracking-tighter">Novo Membro (Admin)</h3>
                  <form onSubmit={handleManualAdd} className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Nome Completo</label>
                          <input placeholder="Ex: João Silva" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-padel font-bold" required />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase ml-1 tracking-widest">Telemóvel</label>
                          <input placeholder="9xx xxx xxx" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-padel font-mono font-bold" required />
                      </div>
                      <div className="flex gap-2 pt-4">
                          <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="flex-1 font-bold">Cancelar</Button>
                          <Button type="submit" className="flex-1 font-black shadow-lg">CRIAR FICHA</Button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
