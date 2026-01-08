
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player, AppState, Message } from '../types';
import { getPlayers, savePlayer, savePlayersBulk, removePlayer, generateUUID, getAppState, resolvePasswordReset, approvePlayer, approveAllPendingPlayers, saveMessage, subscribeToChanges, fetchPlayersBatch } from '../services/storageService';
import { Button } from './Button';

declare const XLSX: any;

interface MembersListProps {
    currentUser?: Player;
}

export const MembersList: React.FC<MembersListProps> = ({ currentUser }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [appState, setAppState] = useState<AppState>(getAppState());
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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState<'ALL' | Player | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          setAppState(getAppState());
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
  }, [loadInitialData]);

  // Setup IntersectionObserver for infinite scroll
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
        id: generateUUID(), name: newName, phone: newPhone,
        totalPoints: 0, gamesPlayed: 0, participantNumber: 0,
        role: 'user', isApproved: true
    };
    await savePlayer(newPlayer);
    setNewName(''); setNewPhone(''); setIsAddModalOpen(false);
    loadInitialData();
  };

  const confirmDelete = async () => {
      if (playerToDelete) {
          await removePlayer(playerToDelete.id);
          setPlayers(prev => prev.filter(p => p.id !== playerToDelete.id));
          setPlayerToDelete(null);
      }
  };

  const isAnyAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-padel-blue">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">👥 Base de Dados</h2>
                <p className="text-sm text-gray-500">Gestão inteligente de utilizadores ({players.length} listados).</p>
            </div>
            {isAnyAdmin && (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button onClick={() => setIsAddModalOpen(true)}>+ Novo</Button>
                    <input type="file" ref={fileInputRef} className="hidden" />
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>📥 Importar</Button>
                </div>
            )}
        </div>
        <div className="mt-6 relative">
            <input 
                type="text" placeholder="Pesquisar por nome ou telemóvel..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-padel-blue outline-none transition-all"
            />
            {isLoadingMore && offset === 0 && (
                <div className="absolute right-3 top-3.5">
                    <div className="w-5 h-5 border-2 border-padel-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden border">
        <div className="divide-y divide-gray-100">
            {players.filter(p => p.isApproved !== false).map((player, index) => (
                <div key={player.id} className="p-4 hover:bg-gray-50 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden relative shadow-sm border border-gray-200">
                            {player.photoUrl ? (
                                <img 
                                    src={player.photoUrl} 
                                    loading="lazy" 
                                    className="w-full h-full object-cover" 
                                    alt={player.name}
                                    style={{ imageRendering: 'auto' }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-xs">
                                    #{player.participantNumber}
                                </div>
                            )}
                            {isOnline(player) && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                            )}
                        </div>
                        <div>
                            <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                {player.name}
                                {player.role === 'admin' && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-black uppercase">Admin</span>}
                                {player.role === 'super_admin' && <span className="text-[8px] bg-purple-100 text-purple-700 px-1 rounded font-black uppercase">Super</span>}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">#{player.participantNumber} • {player.phone}</div>
                        </div>
                    </div>
                    {isAnyAdmin && player.id !== currentUser?.id && (
                        <button onClick={() => setPlayerToDelete(player)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                            🗑️
                        </button>
                    )}
                </div>
            ))}
            
            {/* Scroll Observer Target */}
            <div ref={lastElementRef} className="h-4 w-full"></div>
        </div>
        
        {isLoadingMore && players.length > 0 && (
            <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                    A CARREGAR MAIS...
                </div>
            </div>
        )}
        
        {!hasMore && players.length > 0 && (
            <div className="p-4 bg-gray-50 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest border-t">
                Fim da lista
            </div>
        )}
        
        {players.length === 0 && !isLoadingMore && (
            <div className="p-12 text-center text-gray-400 italic bg-gray-50">
                Nenhum membro encontrado com "{searchTerm}".
            </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {playerToDelete && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border-t-4 border-red-500">
                  <h3 className="font-bold text-lg mb-2">Eliminar Membro?</h3>
                  <p className="text-sm text-gray-500 mb-6">Esta ação apagará permanentemente a ficha de <span className="font-bold text-gray-800">{playerToDelete.name}</span>.</p>
                  <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setPlayerToDelete(null)} className="flex-1">Cancelar</Button>
                      <Button variant="danger" onClick={confirmDelete} className="flex-1">Eliminar</Button>
                  </div>
              </div>
          </div>
      )}

      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                  <h3 className="text-xl font-bold mb-4 italic">Novo Membro (Admin)</h3>
                  <form onSubmit={handleManualAdd} className="space-y-4">
                      <input placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 border rounded-lg" required />
                      <input placeholder="Telemóvel" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-3 border rounded-lg font-mono" required />
                      <div className="flex gap-2">
                          <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="flex-1">Cancelar</Button>
                          <Button type="submit" className="flex-1">Criar Membro</Button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
