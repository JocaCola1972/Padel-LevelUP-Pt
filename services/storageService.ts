
import { Player, Registration, MatchRecord, AppState, Shift, CourtAllocation, MastersState, PasswordResetRequest, Message, GameResult } from '../types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
let isConnected = false;

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

export const initCloudSync = async () => {
    try {
        if (!supabase) {
            supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        await fetchAllData();
        enableRealtimeSubscriptions();
        isConnected = true;
        notifyListeners();
    } catch (e) {
        console.error("Erro ao conectar à nuvem:", e);
        isConnected = false;
    }
};

export const fetchAllData = async () => {
    if (!supabase) return;
    try {
        const [p, r, m, msg, s] = await Promise.all([
            supabase.from('players').select('*'),
            supabase.from('registrations').select('*'),
            supabase.from('matches').select('*'),
            supabase.from('messages').select('*'),
            supabase.from('settings').select('*')
        ]);

        if (p.data) mergeAndSave(KEYS.PLAYERS, p.data);
        if (r.data) mergeAndSave(KEYS.REGISTRATIONS, r.data);
        if (m.data) mergeAndSave(KEYS.MATCHES, m.data);
        if (msg.data) mergeAndSave(KEYS.MESSAGES, msg.data);
        
        if (s.data) {
            s.data.forEach((row: any) => {
                if (row.key === 'appState') localStorage.setItem(KEYS.STATE, JSON.stringify(row.value));
                if (row.key === 'masters') localStorage.setItem(KEYS.MASTERS, JSON.stringify(row.value));
            });
        }
        notifyListeners();
    } catch (err) {
        console.error("Erro ao sincronizar dados:", err);
    }
};

const mergeAndSave = (key: string, cloudData: any[]) => {
    const localData = JSON.parse(localStorage.getItem(key) || '[]');
    const merged = [...cloudData];
    localData.forEach((l: any) => {
        if (!merged.find(c => c.id === l.id)) {
            merged.push(l);
        }
    });
    localStorage.setItem(key, JSON.stringify(merged));
};

const enableRealtimeSubscriptions = () => {
    if (!supabase) return;
    supabase.removeAllChannels();
    supabase.channel('global-sync')
        .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeUpdate)
        .subscribe();
};

const handleRealtimeUpdate = (payload: any) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    const tableName = table.toLowerCase();
    let key = '';

    if (tableName === 'settings') {
        if (newRecord) {
            const sKey = newRecord.key === 'appState' ? KEYS.STATE : (newRecord.key === 'masters' ? KEYS.MASTERS : null);
            if (sKey) localStorage.setItem(sKey, JSON.stringify(newRecord.value));
        }
        notifyListeners();
        return;
    }

    switch(tableName) {
        case 'players': key = KEYS.PLAYERS; break;
        case 'registrations': key = KEYS.REGISTRATIONS; break;
        case 'matches': key = KEYS.MATCHES; break;
        case 'messages': key = KEYS.MESSAGES; break;
        default: return;
    }

    let data = JSON.parse(localStorage.getItem(key) || '[]');
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const idx = data.findIndex((i: any) => i.id === newRecord.id);
        if (idx >= 0) data[idx] = newRecord;
        else data.push(newRecord);
    } else if (eventType === 'DELETE') {
        data = data.filter((i: any) => i.id !== oldRecord.id);
    }
    localStorage.setItem(key, JSON.stringify(data));
    notifyListeners();
};

export const generateUUID = () => crypto.randomUUID?.() || Math.random().toString(36).substring(2);

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

export const getPlayers = (): Player[] => JSON.parse(localStorage.getItem(KEYS.PLAYERS) || '[]');
export const savePlayer = async (player: Player): Promise<void> => {
    const players = getPlayers();
    const idx = players.findIndex(p => p.id === player.id || p.phone === player.phone);
    if (idx >= 0) players[idx] = { ...players[idx], ...player };
    else players.push(player);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
    if (supabase) {
        const { error } = await supabase.from('players').upsert(player);
        if (error) console.error("Erro Supabase Player Upsert:", error);
    }
};

export const getRegistrations = (): Registration[] => JSON.parse(localStorage.getItem(KEYS.REGISTRATIONS) || '[]');

const cleanRegistrationForDB = (reg: Registration) => {
    return {
        ...reg,
        partnerId: reg.partnerId || null,
        partnerName: reg.partnerName || null,
        type: reg.type || 'game',
        isWaitingList: !!reg.isWaitingList,
        startingCourt: reg.startingCourt || null
    };
};

export const addRegistration = async (reg: Registration): Promise<void> => {
    const regs = getRegistrations();
    if (!regs.find(r => r.id === reg.id)) {
        regs.push(reg);
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
        notifyListeners();

        try {
            if (supabase) {
                const cleanReg = cleanRegistrationForDB(reg);
                const { error } = await supabase.from('registrations').insert(cleanReg);
                if (error) {
                    console.error("Erro Supabase Inscrição Insert:", error.message, error.details, error.hint);
                }
            }
        } catch (e) {
            console.error("Falha crítica ao sincronizar inscrição:", e);
        }
    }
};

export const updateRegistration = async (id: string, updates: Partial<Registration>): Promise<void> => {
    const regs = getRegistrations();
    const idx = regs.findIndex(r => r.id === id);
    if (idx >= 0) {
        regs[idx] = { ...regs[idx], ...updates };
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
        notifyListeners();
        if (supabase) {
            const { error } = await supabase.from('registrations').update(updates).eq('id', id);
            if (error) console.error("Erro Supabase Inscrição Update:", error);
        }
    }
};

export const removeRegistration = async (id: string): Promise<void> => {
    const regs = getRegistrations().filter(r => r.id !== id);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
    notifyListeners();
    if (supabase) {
        const { error } = await supabase.from('registrations').delete().eq('id', id);
        if (error) console.error("Erro Supabase Inscrição Delete:", error);
    }
};

export const clearAllRegistrations = async (): Promise<void> => {
    localStorage.setItem(KEYS.REGISTRATIONS, '[]');
    notifyListeners();
    if (supabase) {
        const { error } = await supabase.from('registrations').delete().neq('id', '0');
        if (error) console.error("Erro ao limpar inscrições na nuvem:", error);
    }
};

export const getMatches = (): MatchRecord[] => JSON.parse(localStorage.getItem(KEYS.MATCHES) || '[]');
export const addMatch = async (match: MatchRecord, points: number): Promise<void> => {
    const matches = getMatches();
    matches.push(match);
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(matches));
    
    const players = getPlayers();
    match.playerIds.forEach(pid => {
        const p = players.find(x => x.id === pid);
        if (p) { p.totalPoints += points; p.gamesPlayed += 1; }
    });
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
    
    if (supabase) {
        await supabase.from('matches').insert(match);
        await supabase.from('players').upsert(players.filter(p => match.playerIds.includes(p.id)));
    }
};

export const getMessages = (): Message[] => JSON.parse(localStorage.getItem(KEYS.MESSAGES) || '[]');
export const saveMessage = async (msg: Message): Promise<void> => {
    const m = getMessages(); m.push(msg);
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m));
    notifyListeners();
    if (supabase) await supabase.from('messages').insert(msg);
};

export const getAppState = (): AppState => {
    const data = localStorage.getItem(KEYS.STATE);
    return data ? { ...defaultState, ...JSON.parse(data) } : defaultState;
};

export const updateAppState = async (updates: Partial<AppState>): Promise<void> => {
    const merged = { ...getAppState(), ...updates };
    localStorage.setItem(KEYS.STATE, JSON.stringify(merged));
    notifyListeners();
    if (supabase) await supabase.from('settings').upsert({ key: 'appState', value: merged });
};

export const getMastersState = (): MastersState => JSON.parse(localStorage.getItem(KEYS.MASTERS) || '{"teams":[], "matches":[], "currentPhase":1, "pool":[]}');
export const saveMastersState = async (state: MastersState): Promise<void> => {
    localStorage.setItem(KEYS.MASTERS, JSON.stringify(state));
    notifyListeners();
    if (supabase) await supabase.from('settings').upsert({ key: 'masters', value: state });
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
    if (supabase) await supabase.from('players').update({ isApproved: true }).eq('isApproved', false);
};
export const removePlayer = async (id: string) => {
    const p = getPlayers().filter(x => x.id !== id);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(p));
    notifyListeners();
    if (supabase) await supabase.from('players').delete().eq('id', id);
};
export const requestPasswordReset = (phone: string) => {
    const p = getPlayers().find(x => x.phone === phone);
    if (!p) return false;
    const req: PasswordResetRequest = { id: generateUUID(), playerId: p.id, playerName: p.name, playerPhone: p.phone, timestamp: Date.now() };
    updateAppState({ passwordResetRequests: [...getAppState().passwordResetRequests, req] });
    return true;
};
export const resolvePasswordReset = async (id: string, approve: boolean) => {
    const s = getAppState();
    const req = s.passwordResetRequests.find(x => x.id === id);
    if (req && approve) {
        const p = getPlayers();
        const i = p.find(x => x.id === req.playerId);
        if (i) { i.password = undefined; await savePlayer(i); }
    }
    updateAppState({ passwordResetRequests: s.passwordResetRequests.filter(x => x.id !== id) });
};
export const deleteMatchesByDate = async (d: string) => {
    const m = getMatches().filter(x => x.date !== d);
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(m));
    notifyListeners();
    if (supabase) await supabase.from('matches').delete().eq('date', d);
};
export const deleteRegistrationsByDate = async (d: string) => {
    const r = getRegistrations().filter(x => x.date !== d);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(r));
    notifyListeners();
    if (supabase) await supabase.from('registrations').delete().eq('date', d);
};
export const markMessageAsRead = async (id: string) => {
    const m = getMessages();
    const i = m.find(x => x.id === id);
    if (i) { i.read = true; localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m)); notifyListeners(); if (supabase) await supabase.from('messages').update({ read: true }).eq('id', id); }
};
export const deleteMessageForUser = async (id: string) => {
    const m = getMessages().filter(x => x.id !== id);
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m));
    notifyListeners();
    if (supabase) await supabase.from('messages').delete().eq('id', id);
};
export const deleteAllMessagesForUser = async (uid: string) => {
    const m = getMessages().filter(x => x.receiverId !== uid && x.receiverId !== 'ALL');
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(m));
    notifyListeners();
    if (supabase) await supabase.from('messages').delete().eq('receiverId', uid);
};
export const getUnreadCount = (uid: string) => getMessages().filter(m => (m.receiverId === uid || m.receiverId === 'ALL') && !m.read).length;
export const getPlayerByPhone = (ph: string) => getPlayers().find(p => p.phone === ph);
export const savePlayersBulk = (ps: any[]) => {
    const current = getPlayers();
    ps.forEach(p => { if(!current.find(c => c.phone === p.phone)) current.push({...p, id: generateUUID(), totalPoints:0, gamesPlayed:0, participantNumber: current.length + 1}); });
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(current));
    notifyListeners();
    if (supabase) supabase.from('players').upsert(current);
    return { added: ps.length, updated: 0 };
};
export const clearAllMessages = async () => {
    localStorage.setItem(KEYS.MESSAGES, '[]');
    notifyListeners();
    if (supabase) await supabase.from('messages').delete().neq('id', '0');
};
export const getMessagesForUser = (uid: string) => getMessages().filter(m => m.receiverId === uid || m.receiverId === 'ALL');
