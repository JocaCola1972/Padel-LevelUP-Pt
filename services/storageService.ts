
import { Player, Registration, MatchRecord, AppState, Shift, CourtAllocation, MastersState, PasswordResetRequest, Message, GameResult } from '../types';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const KEYS = {
  PLAYERS: 'padel_players',
  REGISTRATIONS: 'padel_registrations',
  MATCHES: 'padel_matches',
  STATE: 'padel_state',
  MASTERS: 'padel_masters',
  MESSAGES: 'padel_messages'
};

const SUPABASE_URL = "https://bjiyrvayymwojubafray.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaXlydmF5eW13b2p1YmFmcmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjQ3ODMsImV4cCI6MjA4MTI0MDc4M30.f1iIInDubbIm7rR5-gm6bEybTU3etOW5s1waX4P8hEo";

let supabase: SupabaseClient | null = null;
let syncChannel: RealtimeChannel | null = null;
let isConnected = false;
let isSyncing = false;

type DataChangeListener = () => void;
const listeners: DataChangeListener[] = [];

export const subscribeToChanges = (callback: DataChangeListener) => {
    listeners.push(callback);
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
    };
};

const notifyListeners = () => {
    listeners.forEach(cb => cb());
};

export const isFirebaseConnected = () => isConnected;
export const getIsSyncing = () => isSyncing;

export const initCloudSync = async () => {
    if (supabase && isConnected) return;

    try {
        if (!supabase) {
            supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false },
                realtime: { 
                    params: { eventsPerSecond: 40 },
                    heartbeatIntervalMs: 3000 // Intervalo mais curto para detetar quedas
                }
            });
        }
        
        await fetchAllData();
        enableRealtimeSubscriptions();
    } catch (e) {
        console.error("Erro ao iniciar sincronização:", e);
        setTimeout(initCloudSync, 5000);
    }
};

export const fetchAllData = async () => {
    if (!supabase) return;
    try {
        const [p, r, m, msg, s] = await Promise.all([
            supabase.from('players').select('*').order('participantNumber', { ascending: true }),
            supabase.from('registrations').select('*'),
            supabase.from('matches').select('*').order('timestamp', { ascending: false }),
            supabase.from('messages').select('*').order('timestamp', { ascending: false }).limit(100),
            supabase.from('settings').select('*')
        ]);

        if (p.data) localStorage.setItem(KEYS.PLAYERS, JSON.stringify(p.data));
        if (r.data) localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(r.data));
        if (m.data) localStorage.setItem(KEYS.MATCHES, JSON.stringify(m.data));
        if (msg.data) localStorage.setItem(KEYS.MESSAGES, JSON.stringify(msg.data));
        
        if (s.data) {
            s.data.forEach((row: any) => {
                if (row.key === 'appState') localStorage.setItem(KEYS.STATE, JSON.stringify(row.value));
                if (row.key === 'masters') localStorage.setItem(KEYS.MASTERS, JSON.stringify(row.value));
            });
        }
        notifyListeners();
    } catch (err) {
        console.error("Erro ao descarregar dados:", err);
    }
};

const enableRealtimeSubscriptions = () => {
    if (!supabase) return;
    
    if (syncChannel) {
        supabase.removeChannel(syncChannel);
    }

    syncChannel = supabase.channel('realtime-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, handleRealtimeUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, handleRealtimeUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, handleRealtimeUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handleRealtimeUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, handleRealtimeUpdate)
        .subscribe((status) => {
            console.log("Supabase Realtime Status:", status);
            isConnected = (status === 'SUBSCRIBED');
            notifyListeners();
            
            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                setTimeout(enableRealtimeSubscriptions, 5000);
            }
        });
};

const handleRealtimeUpdate = (payload: any) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    const tableName = table.toLowerCase();
    
    console.debug(`Realtime Update: ${tableName} (${eventType})`);

    // Casos especiais de Configuração (Settings)
    if (tableName === 'settings') {
        if (newRecord) {
            const sKey = newRecord.key === 'appState' ? KEYS.STATE : (newRecord.key === 'masters' ? KEYS.MASTERS : null);
            if (sKey) {
                // Atualização ATÓMICA para evitar que o estado local "atropele" o servidor
                localStorage.setItem(sKey, JSON.stringify(newRecord.value));
            }
        }
        notifyListeners();
        return;
    }

    let storageKey = '';
    switch(tableName) {
        case 'players': storageKey = KEYS.PLAYERS; break;
        case 'registrations': storageKey = KEYS.REGISTRATIONS; break;
        case 'matches': storageKey = KEYS.MATCHES; break;
        case 'messages': storageKey = KEYS.MESSAGES; break;
        default: return;
    }

    let data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (eventType === 'INSERT') {
        if (!data.find((i: any) => i.id === newRecord.id)) {
            data.push(newRecord);
        }
    } else if (eventType === 'UPDATE') {
        const idx = data.findIndex((i: any) => i.id === newRecord.id);
        if (idx >= 0) data[idx] = newRecord;
        else data.push(newRecord);
    } else if (eventType === 'DELETE') {
        data = data.filter((i: any) => i.id !== oldRecord.id);
    }

    // Persistência local imediata
    localStorage.setItem(storageKey, JSON.stringify(data));
    
    // Notifica UI para re-renderizar
    notifyListeners();
};

export const generateUUID = () => crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);

const defaultState: AppState = {
  registrationsOpen: false,
  courtConfig: {
    [Shift.MORNING_1]: { game: 7, training: 2 },
    [Shift.MORNING_2]: { game: 8, training: 1 },
    [Shift.MORNING_3]: { game: 9, training: 0 },
  },
  nextSundayDate: new Date().toISOString().split('T')[0], 
  gamesPerShift: { [Shift.MORNING_1]: 4, [Shift.MORNING_2]: 4, [Shift.MORNING_3]: 5 },
  passwordResetRequests: [],
  adminSectionOrder: ['config', 'courts', 'report', 'registrations'],
  toolsSectionOrder: ['visual', 'maintenance'],
  autoOpenTime: '15:00'
};

const syncAction = async (task: Promise<any>) => {
    isSyncing = true;
    notifyListeners();
    try {
        const result = await task;
        if (result.error) throw result.error;
        return result;
    } catch (e) {
        console.error("Erro na ação de sincronização:", e);
        throw e;
    } finally {
        isSyncing = false;
        notifyListeners();
    }
};

export const getPlayers = (): Player[] => JSON.parse(localStorage.getItem(KEYS.PLAYERS) || '[]');

export const savePlayer = async (player: Player): Promise<void> => {
    const players = getPlayers();
    if (!player.participantNumber || player.participantNumber === 0) {
        const maxId = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
        player.participantNumber = maxId + 1;
    }
    
    // Update local primeiro para feedback instantâneo (Optmistic UI)
    const idx = players.findIndex(p => p.id === player.id || p.phone === player.phone);
    if (idx >= 0) players[idx] = { ...players[idx], ...player };
    else players.push(player);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();

    if (supabase) await syncAction(supabase.from('players').upsert(player));
};

export const savePlayersBulk = async (ps: Partial<Player>[]): Promise<{ added: number, updated: number }> => {
    const current = getPlayers();
    let maxParticipantId = current.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
    const newPlayers: Player[] = [];
    
    ps.forEach(p => { 
        if(!current.find(c => c.phone === p.phone)) {
            maxParticipantId++;
            const fullPlayer: Player = {
                id: generateUUID(),
                name: p.name || 'Jogador',
                phone: p.phone || '',
                totalPoints: 0,
                gamesPlayed: 0,
                participantNumber: maxParticipantId,
                isApproved: true,
                role: 'user',
                ...p
            };
            current.push(fullPlayer);
            newPlayers.push(fullPlayer);
        }
    });
    
    if (newPlayers.length === 0) return { added: 0, updated: 0 };
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(current));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('players').insert(newPlayers));
    return { added: newPlayers.length, updated: 0 };
};

export const updatePresence = async (playerId: string) => {
    if (supabase) await supabase.from('players').update({ lastActive: Date.now() }).eq('id', playerId);
};

export const getRegistrations = (): Registration[] => JSON.parse(localStorage.getItem(KEYS.REGISTRATIONS) || '[]');

export const addRegistration = async (reg: Registration): Promise<void> => {
    const regs = getRegistrations();
    if (!regs.find(r => r.id === reg.id)) {
        regs.push(reg);
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
        notifyListeners();
        if (supabase) await syncAction(supabase.from('registrations').insert(reg));
    }
};

export const updateRegistration = async (id: string, updates: Partial<Registration>): Promise<void> => {
    const regs = getRegistrations();
    const idx = regs.findIndex(r => r.id === id);
    if (idx >= 0) {
        regs[idx] = { ...regs[idx], ...updates };
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
        notifyListeners();
        if (supabase) await syncAction(supabase.from('registrations').update(updates).eq('id', id));
    }
};

export const removeRegistration = async (id: string): Promise<void> => {
    const regs = getRegistrations().filter(r => r.id !== id);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('registrations').delete().eq('id', id));
};

export const clearAllRegistrations = async (): Promise<void> => {
    localStorage.setItem(KEYS.REGISTRATIONS, '[]');
    notifyListeners();
    if (supabase) await syncAction(supabase.from('registrations').delete().neq('id', '0'));
};

export const getMatches = (): MatchRecord[] => JSON.parse(localStorage.getItem(KEYS.MATCHES) || '[]');
export const addMatch = async (match: MatchRecord, points: number): Promise<void> => {
    const matches = getMatches();
    matches.unshift(match);
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(matches));
    
    const players = getPlayers();
    match.playerIds.forEach(pid => {
        const p = players.find(x => x.id === pid);
        if (p) { p.totalPoints += points; p.gamesPlayed += 1; }
    });
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
    
    if (supabase) await syncAction(Promise.all([
        supabase.from('matches').insert(match),
        supabase.from('players').upsert(players.filter(p => match.playerIds.includes(p.id)))
    ]));
};

export const getMessages = (): Message[] => JSON.parse(localStorage.getItem(KEYS.MESSAGES) || '[]');
export const saveMessage = async (msg: Message): Promise<void> => {
    const m = getMessages(); m.unshift(msg);
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('messages').insert(msg));
};

export const getAppState = (): AppState => {
    const data = localStorage.getItem(KEYS.STATE);
    return data ? { ...defaultState, ...JSON.parse(data) } : defaultState;
};

export const updateAppState = async (updates: Partial<AppState>): Promise<void> => {
    const current = getAppState();
    const merged = { ...current, ...updates };
    
    // Atualização local imediata
    localStorage.setItem(KEYS.STATE, JSON.stringify(merged));
    notifyListeners();

    if (supabase) {
        // ESSENCIAL: onConflict: 'key' garante que o Supabase atualiza a linha correta sem duplicar ou reverter
        await syncAction(supabase.from('settings').upsert({ key: 'appState', value: merged }, { onConflict: 'key' }));
    }
};

export const saveMastersState = async (state: MastersState): Promise<void> => {
    localStorage.setItem(KEYS.MASTERS, JSON.stringify(state));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('settings').upsert({ key: 'masters', value: state }, { onConflict: 'key' }));
};

export const approvePlayer = async (id: string) => {
    const p = getPlayers();
    const i = p.find(x => x.id === id);
    if(i) { i.isApproved = true; await savePlayer(i); }
};
export const approveAllPendingPlayers = async () => {
    const p = getPlayers();
    p.forEach(x => x.isApproved = true);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(p));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('players').update({ isApproved: true }).eq('isApproved', false));
};
export const removePlayer = async (id: string) => {
    const p = getPlayers().filter(x => x.id !== id);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(p));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('players').delete().eq('id', id));
};

export const resolvePasswordReset = async (id: string, approve: boolean) => {
    const s = getAppState();
    const req = s.passwordResetRequests.find(x => x.id === id);
    if (req && approve) {
        const p = getPlayers();
        const i = p.find(x => x.id === req.playerId);
        if (i) { i.password = undefined; await savePlayer(i); }
    }
    await updateAppState({ passwordResetRequests: s.passwordResetRequests.filter(x => x.id !== id) });
};

export const requestPasswordReset = async (phone: string): Promise<boolean> => {
    const player = getPlayerByPhone(phone);
    if (!player) return false;
    const state = getAppState();
    const newRequest: PasswordResetRequest = {
        id: generateUUID(),
        playerId: player.id,
        playerName: player.name,
        playerPhone: player.phone,
        timestamp: Date.now()
    };
    const requests = [...(state.passwordResetRequests || []), newRequest];
    await updateAppState({ passwordResetRequests: requests });
    return true;
};

export const deleteMatchesByDate = async (d: string) => {
    const matches = getMatches();
    const toRemove = matches.filter(x => x.date === d);
    const remaining = matches.filter(x => x.date !== d);
    const players = getPlayers();
    toRemove.forEach(match => {
        const pts = match.result === GameResult.WIN ? 4 : (match.result === GameResult.DRAW ? 2 : 1);
        match.playerIds.forEach(pid => {
            const p = players.find(x => x.id === pid);
            if (p) {
                p.totalPoints = Math.max(0, p.totalPoints - pts);
                p.gamesPlayed = Math.max(0, p.gamesPlayed - 1);
            }
        });
    });
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(remaining));
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
    if (supabase) await syncAction(Promise.all([
        supabase.from('matches').delete().eq('date', d),
        supabase.from('players').upsert(players)
    ]));
};

export const clearMatchesByShift = async (shift: Shift) => {
    const matches = getMatches();
    const toRemove = matches.filter(x => x.shift === shift);
    const remaining = matches.filter(x => x.shift !== shift);
    const players = getPlayers();
    toRemove.forEach(match => {
        const pts = match.result === GameResult.WIN ? 4 : (match.result === GameResult.DRAW ? 2 : 1);
        match.playerIds.forEach(pid => {
            const p = players.find(x => x.id === pid);
            if (p) {
                p.totalPoints = Math.max(0, p.totalPoints - pts);
                p.gamesPlayed = Math.max(0, p.gamesPlayed - 1);
            }
        });
    });
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(remaining));
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
    if (supabase) await syncAction(Promise.all([
        supabase.from('matches').delete().eq('shift', shift),
        supabase.from('players').upsert(players)
    ]));
};

export const deleteRegistrationsByDate = async (d: string) => {
    const r = getRegistrations().filter(x => x.date !== d);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(r));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('registrations').delete().eq('date', d));
};

export const markMessageAsRead = async (id: string) => {
    const m = getMessages();
    const i = m.find(x => x.id === id);
    if (i) { i.read = true; localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m)); notifyListeners(); if (supabase) await supabase.from('messages').update({ read: true }).eq('id', id); }
};

export const deleteMessageForUser = async (id: string): Promise<void> => {
    let m = getMessages().filter(x => x.id !== id);
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('messages').delete().eq('id', id));
};

export const deleteAllMessagesForUser = async (uid: string) => {
    const m = getMessages().filter(x => x.receiverId !== uid && x.receiverId !== 'ALL');
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m));
    notifyListeners();
    if (supabase) await syncAction(supabase.from('messages').delete().eq('receiverId', uid));
};

export const clearAllMessages = async () => {
    localStorage.setItem(KEYS.MESSAGES, '[]');
    notifyListeners();
    if (supabase) await syncAction(supabase.from('messages').delete().neq('id', '0'));
};

export const getUnreadCount = (uid: string) => getMessages().filter(m => (m.receiverId === uid || m.receiverId === 'ALL') && !m.read).length;
export const getPlayerByPhone = (ph: string) => getPlayers().find(p => p.phone === ph);
export const getMastersState = (): MastersState => JSON.parse(localStorage.getItem(KEYS.MASTERS) || '{"teams":[], "matches":[], "currentPhase":1, "pool":[]}');
export const getMessagesForUser = (uid: string) => getMessages().filter(m => m.receiverId === uid || m.receiverId === 'ALL');
