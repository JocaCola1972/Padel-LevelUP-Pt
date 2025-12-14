
import { Player, Registration, MatchRecord, AppState, Shift, CourtAllocation, MastersState, PasswordResetRequest, Message } from '../types';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

const KEYS = {
  PLAYERS: 'padel_players',
  REGISTRATIONS: 'padel_registrations',
  MATCHES: 'padel_matches',
  STATE: 'padel_state',
  MASTERS: 'padel_masters',
  MESSAGES: 'padel_messages'
};

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBQViWdYpS5ZklwY80kbFQC4EIX50NEe9Q",
  authDomain: "gen-lang-client-0961493660.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0961493660-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gen-lang-client-0961493660",
  storageBucket: "gen-lang-client-0961493660.firebasestorage.app",
  messagingSenderId: "806077355714",
  appId: "1:806077355714:web:a08852bfc6e4dd81390d5b",
  measurementId: "G-1CN7M2DH7Q"
};

// --- FIREBASE SYNC LOGIC ---
let db: Firestore | null = null;
let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let isConnected = false;

export const isFirebaseConnected = () => isConnected;

export const initCloudSync = () => {
    try {
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApps()[0];
        }
        db = getFirestore(app);
        analytics = getAnalytics(app); // Initialize Analytics
        console.log("🔥 Firebase initialized! Syncing...");
        isConnected = true;
        startListeners();
    } catch (e) {
        console.error("Firebase Init Error:", e);
        isConnected = false;
    }
};

const startListeners = () => {
    if (!db) return;

    // Listen to PLAYERS
    onSnapshot(collection(db, KEYS.PLAYERS), (snapshot) => {
        const remotePlayers: Player[] = [];
        snapshot.forEach(doc => remotePlayers.push(doc.data() as Player));
        // Only update local if we have data remote, or if we want to sync deletions (complex)
        // For simple sync, "server wins" on list updates is safest to propagate changes
        if (remotePlayers.length > 0 || snapshot.empty) {
            // Merge logic could be better, but replacement ensures consistency
            localStorage.setItem(KEYS.PLAYERS, JSON.stringify(remotePlayers));
        }
    }, (error) => {
        console.error("Sync Error Players:", error);
        isConnected = false;
    });

    // Listen to REGISTRATIONS
    onSnapshot(collection(db, KEYS.REGISTRATIONS), (snapshot) => {
        const remoteRegs: Registration[] = [];
        snapshot.forEach(doc => remoteRegs.push(doc.data() as Registration));
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(remoteRegs));
    });

    // Listen to MATCHES
    onSnapshot(collection(db, KEYS.MATCHES), (snapshot) => {
        const remoteMatches: MatchRecord[] = [];
        snapshot.forEach(doc => remoteMatches.push(doc.data() as MatchRecord));
        localStorage.setItem(KEYS.MATCHES, JSON.stringify(remoteMatches));
    });
    
    // Listen to MESSAGES
    onSnapshot(collection(db, KEYS.MESSAGES), (snapshot) => {
        const remoteMsgs: Message[] = [];
        snapshot.forEach(doc => remoteMsgs.push(doc.data() as Message));
        localStorage.setItem(KEYS.MESSAGES, JSON.stringify(remoteMsgs));
    });

    // Listen to APP STATE (Singleton Document)
    onSnapshot(doc(db, 'settings', 'appState'), (docSnap) => {
        if (docSnap.exists()) {
            localStorage.setItem(KEYS.STATE, JSON.stringify(docSnap.data()));
        }
    });
    
    // Listen to MASTERS (Singleton Document)
    onSnapshot(doc(db, 'settings', 'masters'), (docSnap) => {
        if (docSnap.exists()) {
            localStorage.setItem(KEYS.MASTERS, JSON.stringify(docSnap.data()));
        }
    });
};

const syncToCloud = (collectionName: string, id: string, data: any) => {
    if (!db) return;
    try {
        setDoc(doc(db, collectionName, id), data);
    } catch (e) {
        console.error(`Error syncing ${collectionName}:`, e);
    }
};

const syncSingletonToCloud = (docName: string, data: any) => {
    if (!db) return;
    try {
        setDoc(doc(db, 'settings', docName), data);
    } catch (e) {
        console.error(`Error syncing ${docName}:`, e);
    }
};

// Utility for ID generation (Compatible with all browsers)
export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
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
  passwordResetRequests: []
};

const defaultMastersState: MastersState = {
  teams: [],
  matches: [],
  currentPhase: 1,
  pool: []
};

// --- Players ---

export const getPlayers = (): Player[] => {
  const data = localStorage.getItem(KEYS.PLAYERS);
  let players: Player[] = data ? JSON.parse(data) : [];
  let needsSave = false;
  
  // --- ADMIN SEEDING (JocaCola) ---
  const adminUsername = "JocaCola";
  const adminIndex = players.findIndex(p => p.phone === adminUsername); 

  if (adminIndex === -1) {
      players.push({
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
      });
      needsSave = true;
  } else {
      if (players[adminIndex].password !== "JocaADMINLuP25" || players[adminIndex].role !== 'super_admin') {
          players[adminIndex].password = "JocaADMINLuP25";
          players[adminIndex].role = "super_admin";
          players[adminIndex].isApproved = true;
          needsSave = true;
      }
  }

  if (players.length > 0) {
      players.forEach(p => {
          if (p.isApproved === undefined) {
              p.isApproved = true;
              needsSave = true;
          }
      });
  }

  if (needsSave) {
      localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
      // Trigger a sync if we modified seeding locally
      if(db) players.forEach(p => syncToCloud(KEYS.PLAYERS, p.id, p));
  }

  return players;
};

export const savePlayer = (player: Player): void => {
  const players = getPlayers();
  
  let index = players.findIndex(p => p.id === player.id);
  if (index === -1) {
      index = players.findIndex(p => p.phone === player.phone);
  } else {
      const conflictIndex = players.findIndex(p => p.phone === player.phone && p.id !== player.id);
      if (conflictIndex >= 0) {
          throw new Error("Este número de telemóvel já está a ser usado por outro jogador.");
      }
  }
  
  let finalPlayer = player;

  if (index >= 0) {
    if (!players[index].participantNumber) {
        const maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
        players[index].participantNumber = maxNum + 1;
    }
    const currentRole = players[index].role || 'user';
    const currentApproved = players[index].isApproved ?? true;

    players[index] = { 
        ...players[index], 
        ...player, 
        participantNumber: players[index].participantNumber, 
        role: player.role || currentRole,
        isApproved: player.isApproved !== undefined ? player.isApproved : currentApproved
    };
    finalPlayer = players[index];
  } else {
    const maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
    player.participantNumber = maxNum + 1;
    player.role = 'user';
    if (player.isApproved === undefined) {
            player.isApproved = false;
    }
    if (!player.id) player.id = generateUUID();
    players.push(player);
    finalPlayer = player;
  }
  
  localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
  syncToCloud(KEYS.PLAYERS, finalPlayer.id, finalPlayer);
};

export const approvePlayer = (playerId: string): void => {
    const players = getPlayers();
    const index = players.findIndex(p => p.id === playerId);
    if (index >= 0) {
        players[index].isApproved = true;
        localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
        syncToCloud(KEYS.PLAYERS, players[index].id, players[index]);
    }
};

export const removePlayer = (playerId: string): void => {
    let players = getPlayers();
    players = players.filter(p => p.id !== playerId);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    
    let regs = getRegistrations();
    regs = regs.filter(r => r.playerId !== playerId && r.partnerId !== playerId);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
    
    // In a real app we would call deleteDoc here
};

export const savePlayersBulk = (newPlayers: Partial<Player>[]): { added: number, updated: number } => {
    const players = getPlayers();
    let added = 0;
    let updated = 0;
    let maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);

    newPlayers.forEach(np => {
        if (!np.phone || !np.name) return;

        const cleanPhone = np.phone.replace(/\s+/g, '');
        const index = players.findIndex(p => p.phone === cleanPhone);

        if (index >= 0) {
            if (np.name && players[index].name !== np.name) {
                players[index].name = np.name;
                updated++;
                syncToCloud(KEYS.PLAYERS, players[index].id, players[index]);
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
            added++;
            syncToCloud(KEYS.PLAYERS, newP.id, newP);
        }
    });

    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
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

export const addRegistration = (reg: Registration): void => {
  const regs = getRegistrations();
  if (!regs.find(r => r.playerId === reg.playerId && r.shift === reg.shift && r.date === reg.date)) {
    regs.push(reg);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
    syncToCloud(KEYS.REGISTRATIONS, reg.id, reg);
  }
};

export const updateRegistration = (id: string, updates: Partial<Registration>): void => {
    const regs = getRegistrations();
    const index = regs.findIndex(r => r.id === id);
    if (index >= 0) {
        regs[index] = { ...regs[index], ...updates };
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
        syncToCloud(KEYS.REGISTRATIONS, regs[index].id, regs[index]);
    }
};

export const removeRegistration = (id: string): void => {
  let regs = getRegistrations();
  regs = regs.filter(r => r.id !== id);
  localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
  // In a real app we would call deleteDoc here
};

// --- Matches & Points ---

export const getMatches = (): MatchRecord[] => {
  const data = localStorage.getItem(KEYS.MATCHES);
  return data ? JSON.parse(data) : [];
};

export const addMatch = (match: MatchRecord, points: number): void => {
  const matches = getMatches();
  matches.push(match);
  localStorage.setItem(KEYS.MATCHES, JSON.stringify(matches));
  syncToCloud(KEYS.MATCHES, match.id, match);

  const players = getPlayers();
  match.playerIds.forEach(pid => {
    const pIndex = players.findIndex(p => p.id === pid);
    if (pIndex >= 0) {
      players[pIndex].totalPoints += points;
      players[pIndex].gamesPlayed += 1;
      syncToCloud(KEYS.PLAYERS, players[pIndex].id, players[pIndex]);
    }
  });
  localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
};

// --- Messaging System ---

export const getMessages = (): Message[] => {
    const data = localStorage.getItem(KEYS.MESSAGES);
    return data ? JSON.parse(data) : [];
};

export const saveMessage = (msg: Message): void => {
    const messages = getMessages();
    messages.push(msg);
    localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
    syncToCloud(KEYS.MESSAGES, msg.id, msg);
};

export const getMessagesForUser = (userId: string): Message[] => {
    const messages = getMessages();
    return messages
        .filter(m => m.receiverId === userId || m.receiverId === 'ALL')
        .sort((a, b) => b.timestamp - a.timestamp);
};

export const markMessageAsRead = (messageId: string, userId: string): void => {
    const messages = getMessages();
    const msgIndex = messages.findIndex(m => m.id === messageId);
    
    if (msgIndex >= 0) {
        const msg = messages[msgIndex];
        if (msg.receiverId === userId) {
            messages[msgIndex].read = true;
            localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
            syncToCloud(KEYS.MESSAGES, msg.id, messages[msgIndex]);
        } else if (msg.receiverId === 'ALL') {
            const readKey = `padel_read_broadcasts_${userId}`;
            const readListData = localStorage.getItem(readKey);
            const readList: string[] = readListData ? JSON.parse(readListData) : [];
            if (!readList.includes(messageId)) {
                readList.push(messageId);
                localStorage.setItem(readKey, JSON.stringify(readList));
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
    return { ...defaultState, ...parsed, gamesPerShift, courtConfig, passwordResetRequests };
  }
  return defaultState;
};

export const updateAppState = (newState: Partial<AppState>): void => {
  const current = getAppState();
  const merged = { ...current, ...newState };
  localStorage.setItem(KEYS.STATE, JSON.stringify(merged));
  syncSingletonToCloud('appState', merged);
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
    updateAppState({
        passwordResetRequests: [...state.passwordResetRequests, newRequest]
    });
    return true;
};

export const resolvePasswordReset = (requestId: string, approve: boolean): void => {
    const state = getAppState();
    const req = state.passwordResetRequests.find(r => r.id === requestId);
    if (req && approve) {
        const players = getPlayers();
        const pIndex = players.findIndex(p => p.id === req.playerId);
        if (pIndex >= 0) {
            players[pIndex].password = undefined; 
            localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
            syncToCloud(KEYS.PLAYERS, players[pIndex].id, players[pIndex]);
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

export const saveMastersState = (state: MastersState): void => {
  localStorage.setItem(KEYS.MASTERS, JSON.stringify(state));
  syncSingletonToCloud('masters', state);
};
