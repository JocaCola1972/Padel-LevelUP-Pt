
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

// --- CONFIGURAÇÃO SUPABASE ---
const SUPABASE_URL = "https://bjiyrvayymwojubafray.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaXlydmF5eW13b2p1YmFmcmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjQ3ODMsImV4cCI6MjA4MTI0MDc4M30.f1iIInDubbIm7rR5-gm6bEybTU3etOW5s1waX4P8hEo";

let supabase: SupabaseClient | null = null;
let isConnected = false;

// --- EVENT BUS FOR REALTIME UPDATES ---
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

export const isFirebaseConnected = () => isConnected; // Mantido nome para compatibilidade

export const initCloudSync = async () => {
    try {
        if (!supabase) {
            supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        
        console.log("⚡ Supabase initialized! Fetching initial data...");
        
        // Initial Fetch of all data to populate LocalStorage
        await fetchAllData();
        
        // Enable Realtime Subscriptions
        enableRealtimeSubscriptions();
        
        isConnected = true;
        notifyListeners(); // Notify UI that initial load is done
    } catch (e) {
        console.error("Supabase Init Error:", e);
        isConnected = false;
    }
};

const fetchAllData = async () => {
    if (!supabase) return;

    // 1. Players
    const { data: players } = await supabase.from('players').select('*');
    if (players) localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));

    // 2. Registrations
    const { data: regs } = await supabase.from('registrations').select('*');
    if (regs) localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));

    // 3. Matches
    const { data: matches } = await supabase.from('matches').select('*');
    if (matches) localStorage.setItem(KEYS.MATCHES, JSON.stringify(matches));

    // 4. Messages
    const { data: messages } = await supabase.from('messages').select('*');
    if (messages) localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));

    // 5. Settings (App State & Masters)
    const { data: settings } = await supabase.from('settings').select('*');
    if (settings) {
        settings.forEach((row: any) => {
            if (row.key === 'appState') localStorage.setItem(KEYS.STATE, JSON.stringify(row.value));
            if (row.key === 'masters') localStorage.setItem(KEYS.MASTERS, JSON.stringify(row.value));
        });
    }
    
    // Safety check for Admin Seeding immediately after fetch
    ensureAdminExists();
};

const enableRealtimeSubscriptions = () => {
    if (!supabase) return;

    const channel = supabase.channel('db-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            (payload) => {
                console.log('Change received!', payload);
                handleRealtimeUpdate(payload);
            }
        )
        .subscribe();
};

const handleRealtimeUpdate = (payload: any) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;

    if (table === 'settings') {
        const key = newRecord ? newRecord.key : oldRecord.key;
        const storageKey = key === 'appState' ? KEYS.STATE : (key === 'masters' ? KEYS.MASTERS : null);
        if (storageKey && newRecord) {
            localStorage.setItem(storageKey, JSON.stringify(newRecord.value));
        }
        notifyListeners(); // Notify UI
        return;
    }

    let storageKey = '';
    if (table === 'players') storageKey = KEYS.PLAYERS;
    else if (table === 'registrations') storageKey = KEYS.REGISTRATIONS;
    else if (table === 'matches') storageKey = KEYS.MATCHES;
    else if (table === 'messages') storageKey = KEYS.MESSAGES;
    else return;

    const currentDataStr = localStorage.getItem(storageKey);
    let currentData: any[] = currentDataStr ? JSON.parse(currentDataStr) : [];

    if (eventType === 'INSERT') {
        // Prevent duplicates
        if (!currentData.find(item => item.id === newRecord.id)) {
            currentData.push(newRecord);
        }
    } else if (eventType === 'UPDATE') {
        currentData = currentData.map(item => item.id === newRecord.id ? newRecord : item);
    } else if (eventType === 'DELETE') {
        currentData = currentData.filter(item => item.id !== oldRecord.id);
    }

    localStorage.setItem(storageKey, JSON.stringify(currentData));
    notifyListeners(); // Notify UI
};


// Utility for ID generation
export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Initial State
const defaultState: AppState = {
  registrationsOpen: false,
  courtConfig: {
    [Shift.MORNING_1]: { game: 7, training: 2 },
    [Shift.MORNING_2]: { game: 8, training: 1 },
    [Shift.MORNING_3]: { game: 9, training: 0 },
  },
  nextSundayDate: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
  gamesPerShift: {
    [Shift.MORNING_1]: 4,
    [Shift.MORNING_2]: 4,
    [Shift.MORNING_3]: 5
  },
  customLogo: undefined,
  isTournamentFinished: false,
  passwordResetRequests: [],
  adminSectionOrder: ['config', 'visual', 'finish', 'report', 'registrations']
};

const defaultMastersState: MastersState = {
  teams: [],
  matches: [],
  currentPhase: 1,
  pool: []
};

// --- DATA ACCESS LAYER ---

const ensureAdminExists = () => {
    const data = localStorage.getItem(KEYS.PLAYERS);
    let players: Player[] = data ? JSON.parse(data) : [];
    
    // --- ADMIN SEEDING (JocaCola) ---
    const adminUsername = "JocaCola";
    const adminIndex = players.findIndex(p => p.phone === adminUsername); 

    let needsSync = false;
    let adminPlayer: Player | null = null;

    if (adminIndex === -1) {
        adminPlayer = {
            id: generateUUID(),
            name: "JocaCola",
            phone: adminUsername, 
            password: "JocaADMINLuP25",
            role: 'super_admin',
            isApproved: true,
            totalPoints: 0,
            gamesPlayed: 0,
            participantNumber: 0, 
            photoUrl: undefined
        };
        players.push(adminPlayer);
        needsSync = true;
    } else {
        if (players[adminIndex].password !== "JocaADMINLuP25" || players[adminIndex].role !== 'super_admin') {
            players[adminIndex].password = "JocaADMINLuP25";
            players[adminIndex].role = "super_admin";
            players[adminIndex].isApproved = true;
            adminPlayer = players[adminIndex];
            needsSync = true;
        }
    }

    if (needsSync && adminPlayer && supabase) {
        localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
        // Use upsert for admin
        supabase.from('players').upsert(adminPlayer).then(({ error }) => {
            if (error) console.error("Error seeding admin:", error);
        });
    }
}

// --- Players ---

export const getPlayers = (): Player[] => {
  const data = localStorage.getItem(KEYS.PLAYERS);
  return data ? JSON.parse(data) : [];
};

export const savePlayer = async (player: Player): Promise<void> => {
  const players = getPlayers();
  
  // Validation Logic (Local)
  let index = players.findIndex(p => p.id === player.id);
  if (index === -1) {
      index = players.findIndex(p => p.phone === player.phone);
  } else {
      const conflictIndex = players.findIndex(p => p.phone === player.phone && p.id !== player.id);
      if (conflictIndex >= 0) {
          throw new Error("Este número de telemóvel já está a ser usado por outro jogador.");
      }
  }
  
  let finalPlayer = { ...player };

  if (index >= 0) {
    // Update existing
    if (!players[index].participantNumber) {
        const maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
        players[index].participantNumber = maxNum + 1;
    }
    const currentRole = players[index].role || 'user';
    const currentApproved = players[index].isApproved ?? true;

    finalPlayer = { 
        ...players[index], 
        ...player, 
        participantNumber: players[index].participantNumber, 
        role: player.role || currentRole,
        isApproved: player.isApproved !== undefined ? player.isApproved : currentApproved
    };
    players[index] = finalPlayer;
  } else {
    // New Player
    const maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
    finalPlayer.participantNumber = maxNum + 1;
    finalPlayer.role = 'user';
    if (finalPlayer.isApproved === undefined) {
            finalPlayer.isApproved = false;
    }
    if (!finalPlayer.id) finalPlayer.id = generateUUID();
    players.push(finalPlayer);
  }
  
  // Optimistic Update
  localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
  notifyListeners();
  
  // Cloud Sync
  if (supabase) {
      await supabase.from('players').upsert(finalPlayer);
  }
};

export const approvePlayer = async (playerId: string): Promise<void> => {
    const players = getPlayers();
    const index = players.findIndex(p => p.id === playerId);
    if (index >= 0) {
        players[index].isApproved = true;
        localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
        notifyListeners();
        if (supabase) await supabase.from('players').update({ isApproved: true }).eq('id', playerId);
    }
};

export const approveAllPendingPlayers = async (): Promise<void> => {
    const players = getPlayers();
    const pendingIds: string[] = [];
    
    players.forEach(p => {
        if (p.isApproved === false) {
            p.isApproved = true;
            pendingIds.push(p.id);
        }
    });
    
    if (pendingIds.length === 0) return;

    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
    
    if (supabase) {
        await supabase.from('players').update({ isApproved: true }).in('id', pendingIds);
    }
};

export const removePlayer = async (playerId: string): Promise<void> => {
    // Optimistic Delete
    let players = getPlayers();
    players = players.filter(p => p.id !== playerId);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    
    // Also remove registrations locally for UI feel
    let regs = getRegistrations();
    regs = regs.filter(r => r.playerId !== playerId && r.partnerId !== playerId);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
    
    notifyListeners();

    // Cloud Sync
    if (supabase) {
        await supabase.from('players').delete().eq('id', playerId);
        // Cascading delete on DB handled by SQL, but explicit doesn't hurt if cascade missing
    }
};

export const savePlayersBulk = (newPlayers: Partial<Player>[]): { added: number, updated: number } => {
    const players = getPlayers();
    let added = 0;
    let updated = 0;
    let maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
    
    const playersToUpsert: Player[] = [];

    newPlayers.forEach(np => {
        if (!np.phone || !np.name) return;

        const cleanPhone = np.phone.replace(/\s+/g, '');
        const index = players.findIndex(p => p.phone === cleanPhone);

        if (index >= 0) {
            if (np.name && players[index].name !== np.name) {
                players[index].name = np.name;
                updated++;
                playersToUpsert.push(players[index]);
            }
        } else {
            maxNum++;
            const newP: Player = {
                id: generateUUID(),
                name: np.name,
                phone: cleanPhone,
                totalPoints: 0,
                gamesPlayed: 0,
                participantNumber: maxNum,
                role: 'user', 
                isApproved: true
            };
            players.push(newP);
            playersToUpsert.push(newP);
            added++;
        }
    });

    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    notifyListeners();
    
    if (supabase && playersToUpsert.length > 0) {
        supabase.from('players').upsert(playersToUpsert).then(({error}) => {
             if(error) console.error("Bulk save error", error);
        });
    }
    
    return { added, updated };
};

export const getPlayerByPhone = (phone: string): Player | undefined => {
  return getPlayers().find(p => p.phone === phone);
};

// --- Registrations ---

export const getRegistrations = (): Registration[] => {
  const data = localStorage.getItem(KEYS.REGISTRATIONS);
  return data ? JSON.parse(data) : [];
};

export const addRegistration = async (reg: Registration): Promise<void> => {
  const regs = getRegistrations();
  // Double check locally to avoid UI glitch
  if (!regs.find(r => r.playerId === reg.playerId && r.shift === reg.shift && r.date === reg.date)) {
    regs.push(reg);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
    notifyListeners();
    if (supabase) await supabase.from('registrations').insert(reg);
  }
};

export const updateRegistration = async (id: string, updates: Partial<Registration>): Promise<void> => {
    const regs = getRegistrations();
    const index = regs.findIndex(r => r.id === id);
    if (index >= 0) {
        regs[index] = { ...regs[index], ...updates };
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
        notifyListeners();
        if (supabase) await supabase.from('registrations').update(updates).eq('id', id);
    }
};

export const removeRegistration = async (id: string): Promise<void> => {
  let regs = getRegistrations();
  regs = regs.filter(r => r.id !== id);
  localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
  notifyListeners();
  if (supabase) await supabase.from('registrations').delete().eq('id', id);
};

export const deleteRegistrationsByDate = async (date: string): Promise<void> => {
    let regs = getRegistrations();
    const updatedRegs = regs.filter(r => r.date !== date);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(updatedRegs));
    notifyListeners();
    if (supabase) {
        await supabase.from('registrations').delete().eq('date', date);
    }
};

// --- Matches & Points ---

export const getMatches = (): MatchRecord[] => {
  const data = localStorage.getItem(KEYS.MATCHES);
  return data ? JSON.parse(data) : [];
};

export const addMatch = async (match: MatchRecord, points: number): Promise<void> => {
  const matches = getMatches();
  matches.push(match);
  localStorage.setItem(KEYS.MATCHES, JSON.stringify(matches));
  
  if (supabase) await supabase.from('matches').insert(match);

  // Update Players Points
  const players = getPlayers();
  const playersToUpdate: Player[] = [];
  
  match.playerIds.forEach(pid => {
    const pIndex = players.findIndex(p => p.id === pid);
    if (pIndex >= 0) {
      players[pIndex].totalPoints += points;
      players[pIndex].gamesPlayed += 1;
      playersToUpdate.push(players[pIndex]);
    }
  });
  
  localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
  notifyListeners();
  
  if (supabase && playersToUpdate.length > 0) {
      await supabase.from('players').upsert(playersToUpdate);
  }
};

/**
 * Removes all matches for a specific date and reverts player points.
 */
export const deleteMatchesByDate = async (date: string): Promise<void> => {
    let matches = getMatches();
    const players = getPlayers();
    
    const matchesToDelete = matches.filter(m => m.date === date);
    if (matchesToDelete.length === 0) return;

    const pointsMap = {
        [GameResult.WIN]: 4,
        [GameResult.DRAW]: 2,
        [GameResult.LOSS]: 1
    };

    const playersToUpdateMap: Record<string, Player> = {};

    // Revert points for each player in each match being deleted
    matchesToDelete.forEach(match => {
        const pts = pointsMap[match.result] || 0;
        match.playerIds.forEach(pid => {
            const player = playersToUpdateMap[pid] || players.find(p => p.id === pid);
            if (player) {
                player.totalPoints = Math.max(0, player.totalPoints - pts);
                player.gamesPlayed = Math.max(0, player.gamesPlayed - 1);
                playersToUpdateMap[pid] = player;
            }
        });
    });

    // Filter out matches for this date
    const updatedMatches = matches.filter(m => m.date !== date);
    
    // Update LocalStorage
    localStorage.setItem(KEYS.MATCHES, JSON.stringify(updatedMatches));
    
    // Update affected players in LocalStorage
    const updatedPlayers = players.map(p => playersToUpdateMap[p.id] || p);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(updatedPlayers));
    
    notifyListeners();

    // Cloud Sync
    if (supabase) {
        // 1. Delete matches in Supabase
        await supabase.from('matches').delete().eq('date', date);
        
        // 2. Update all affected players in Supabase
        const playersToUpsert = Object.values(playersToUpdateMap);
        if (playersToUpsert.length > 0) {
            await supabase.from('players').upsert(playersToUpsert);
        }
    }
};

// --- Messaging System ---

export const getMessages = (): Message[] => {
    const data = localStorage.getItem(KEYS.MESSAGES);
    return data ? JSON.parse(data) : [];
};

export const saveMessage = async (msg: Message): Promise<void> => {
    const messages = getMessages();
    messages.push(msg);
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
    notifyListeners();
    if (supabase) await supabase.from('messages').insert(msg);
};

export const getMessagesForUser = (userId: string): Message[] => {
    const messages = getMessages();
    return messages
        .filter(m => m.receiverId === userId || m.receiverId === 'ALL')
        .sort((a, b) => b.timestamp - a.timestamp);
};

export const markMessageAsRead = async (messageId: string, userId: string): Promise<void> => {
    const messages = getMessages();
    const msgIndex = messages.findIndex(m => m.id === messageId);
    
    if (msgIndex >= 0) {
        const msg = messages[msgIndex];
        if (msg.receiverId === userId) {
            messages[msgIndex].read = true;
            localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
            notifyListeners();
            if (supabase) await supabase.from('messages').update({ read: true }).eq('id', messageId);
        } else if (msg.receiverId === 'ALL') {
            const readKey = `padel_read_broadcasts_${userId}`;
            const readListData = localStorage.getItem(readKey);
            const readList: string[] = readListData ? JSON.parse(readListData) : [];
            if (!readList.includes(messageId)) {
                readList.push(messageId);
                localStorage.setItem(readKey, JSON.stringify(readList));
                notifyListeners();
            }
        }
    }
};

export const getUnreadCount = (userId: string): number => {
    const allMsgs = getMessagesForUser(userId);
    const readKey = `padel_read_broadcasts_${userId}`;
    const readListData = localStorage.getItem(readKey);
    const readBroadcasts: string[] = readListData ? JSON.parse(readListData) : [];

    return allMsgs.reduce((count, msg) => {
        if (msg.receiverId === 'ALL') {
            return readBroadcasts.includes(msg.id) ? count : count + 1;
        } else {
            return msg.read ? count : count + 1;
        }
    }, 0);
};

// --- App State ---

export const getAppState = (): AppState => {
  const data = localStorage.getItem(KEYS.STATE);
  if (data) {
    const parsed = JSON.parse(data);
    let gamesPerShift = parsed.gamesPerShift;
    if (typeof gamesPerShift === 'number' || !gamesPerShift) {
        const val = typeof gamesPerShift === 'number' ? gamesPerShift : 5;
        gamesPerShift = {
            [Shift.MORNING_1]: val,
            [Shift.MORNING_2]: val,
            [Shift.MORNING_3]: val
        };
    }
    let courtConfig = parsed.courtConfig;
    if (!courtConfig) {
        const oldActive = parsed.activeCourts || 4;
        courtConfig = {
            [Shift.MORNING_1]: { game: oldActive, training: 0 },
            [Shift.MORNING_2]: { game: oldActive, training: 0 },
            [Shift.MORNING_3]: { game: oldActive, training: 0 },
        };
    }
    let passwordResetRequests = parsed.passwordResetRequests || [];
    let adminSectionOrder = parsed.adminSectionOrder || defaultState.adminSectionOrder;
    return { ...defaultState, ...parsed, gamesPerShift, courtConfig, passwordResetRequests, adminSectionOrder };
  }
  return defaultState;
};

export const updateAppState = async (newState: Partial<AppState>): Promise<void> => {
  const current = getAppState();
  const merged = { ...current, ...newState };
  localStorage.setItem(KEYS.STATE, JSON.stringify(merged));
  notifyListeners();
  if (supabase) await supabase.from('settings').upsert({ key: 'appState', value: merged });
};

// --- Auth & Password Recovery ---

export const requestPasswordReset = (phone: string): boolean => {
    const player = getPlayerByPhone(phone);
    if (!player) return false;
    const state = getAppState();
    if (state.passwordResetRequests.find(r => r.playerId === player.id)) {
        return true;
    }
    const newRequest: PasswordResetRequest = {
        id: generateUUID(),
        playerId: player.id,
        playerName: player.name,
        playerPhone: player.phone,
        timestamp: Date.now()
    };
    // This calls updateAppState which handles cloud sync
    updateAppState({
        passwordResetRequests: [...state.passwordResetRequests, newRequest]
    });
    return true;
};

export const resolvePasswordReset = async (requestId: string, approve: boolean): Promise<void> => {
    const state = getAppState();
    const req = state.passwordResetRequests.find(r => r.id === requestId);
    if (req && approve) {
        const players = getPlayers();
        const pIndex = players.findIndex(p => p.id === req.playerId);
        if (pIndex >= 0) {
            players[pIndex].password = undefined; 
            localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
            notifyListeners();
            if (supabase) await supabase.from('players').update({ password: null }).eq('id', players[pIndex].id);
        }
    }
    const updatedRequests = state.passwordResetRequests.filter(r => r.id !== requestId);
    updateAppState({ passwordResetRequests: updatedRequests });
};


// --- MASTERS LUP ---

export const getMastersState = (): MastersState => {
  const data = localStorage.getItem(KEYS.MASTERS);
  return data ? JSON.parse(data) : defaultMastersState;
};

export const saveMastersState = async (state: MastersState): Promise<void> => {
  localStorage.setItem(KEYS.MASTERS, JSON.stringify(state));
  notifyListeners();
  if (supabase) await supabase.from('settings').upsert({ key: 'masters', value: state });
};
