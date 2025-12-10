
import { Player, Registration, MatchRecord, AppState, Shift, CourtAllocation, MastersState, PasswordResetRequest, Message } from '../types';

const KEYS = {
  PLAYERS: 'padel_players',
  REGISTRATIONS: 'padel_registrations',
  MATCHES: 'padel_matches',
  STATE: 'padel_state',
  MASTERS: 'padel_masters',
  MESSAGES: 'padel_messages'
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
  const adminIndex = players.findIndex(p => p.phone === adminUsername); // We use phone field as username identifier

  if (adminIndex === -1) {
      // Create Hardcoded Admin if not exists
      players.push({
          id: generateUUID(),
          name: "JocaCola",
          phone: adminUsername, // Identifier for login
          password: "JocaADMINLuP25",
          role: 'super_admin',
          isApproved: true,
          totalPoints: 0,
          gamesPlayed: 0,
          participantNumber: 0, // Special number
          photoUrl: undefined
      });
      needsSave = true;
  } else {
      // Enforce credentials and role if exists (in case they were changed accidentally)
      if (players[adminIndex].password !== "JocaADMINLuP25" || players[adminIndex].role !== 'super_admin') {
          players[adminIndex].password = "JocaADMINLuP25";
          players[adminIndex].role = "super_admin";
          players[adminIndex].isApproved = true;
          needsSave = true;
      }
  }
  // --------------------------------

  // Migration: Ensure at least one SUPER admin exists if there are players
  // (The JocaCola logic above guarantees this, but we keep this for legacy safety)
  if (players.length > 0) {
      // Migration: Ensure 'isApproved' exists for everyone. Default true for existing users (legacy support)
      players.forEach(p => {
          if (p.isApproved === undefined) {
              p.isApproved = true;
              needsSave = true;
          }
      });
  }

  if (needsSave) {
      localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
  }

  return players;
};

export const savePlayer = (player: Player): void => {
  const players = getPlayers();
  
  // 1. Try to find by ID first (Editing Profile)
  let index = players.findIndex(p => p.id === player.id);

  // 2. If not found by ID, try finding by Phone (New Registration check)
  if (index === -1) {
      index = players.findIndex(p => p.phone === player.phone);
  } else {
      // If found by ID, ensure the NEW phone doesn't conflict with SOMEONE ELSE
      const conflictIndex = players.findIndex(p => p.phone === player.phone && p.id !== player.id);
      if (conflictIndex >= 0) {
          throw new Error("Este número de telemóvel já está a ser usado por outro jogador.");
      }
  }
  
  if (index >= 0) {
    // Update existing
    // Ensure existing player has a number if it was missing (migration)
    if (!players[index].participantNumber) {
        const maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
        players[index].participantNumber = maxNum + 1;
    }
    
    // Preserve existing role and approval status unless explicit logic elsewhere changes it
    const currentRole = players[index].role || 'user';
    const currentApproved = players[index].isApproved ?? true;

    players[index] = { 
        ...players[index], 
        ...player, 
        participantNumber: players[index].participantNumber, 
        role: player.role || currentRole,
        isApproved: player.isApproved !== undefined ? player.isApproved : currentApproved
    };
  } else {
    // New player
    const maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
    player.participantNumber = maxNum + 1;
    
    // Default role
    player.role = 'user';
    
    // New users default to FALSE (Pending) unless manually created by admin logic elsewhere
    if (player.isApproved === undefined) {
            player.isApproved = false;
    }

    // Ensure ID is generated if not present
    if (!player.id) player.id = generateUUID();

    players.push(player);
  }
  
  localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
};

export const approvePlayer = (playerId: string): void => {
    const players = getPlayers();
    const index = players.findIndex(p => p.id === playerId);
    if (index >= 0) {
        players[index].isApproved = true;
        localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
    }
};

export const removePlayer = (playerId: string): void => {
    // 1. Remove Player
    let players = getPlayers();
    players = players.filter(p => p.id !== playerId);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));

    // 2. Remove FUTURE registrations for this player
    let regs = getRegistrations();
    regs = regs.filter(r => r.playerId !== playerId && r.partnerId !== playerId);
    localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
};

export const savePlayersBulk = (newPlayers: Partial<Player>[]): { added: number, updated: number } => {
    const players = getPlayers();
    let added = 0;
    let updated = 0;
    let maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);

    newPlayers.forEach(np => {
        if (!np.phone || !np.name) return;

        // Clean phone number (remove spaces)
        const cleanPhone = np.phone.replace(/\s+/g, '');
        const index = players.findIndex(p => p.phone === cleanPhone);

        if (index >= 0) {
            if (np.name && players[index].name !== np.name) {
                players[index].name = np.name;
                updated++;
            }
        } else {
            // Create new
            maxNum++;
            const isFirst = players.length === 0 && added === 0;
            
            players.push({
                id: generateUUID(),
                name: np.name,
                phone: cleanPhone,
                totalPoints: 0,
                gamesPlayed: 0,
                participantNumber: maxNum,
                role: 'user', // Bulk import defaults to user
                isApproved: true // Imported users are considered "Admin-approved" by default
            });
            added++;
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
  }
};

export const updateRegistration = (id: string, updates: Partial<Registration>): void => {
    const regs = getRegistrations();
    const index = regs.findIndex(r => r.id === id);
    if (index >= 0) {
        regs[index] = { ...regs[index], ...updates };
        localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
    }
};

export const removeRegistration = (id: string): void => {
  let regs = getRegistrations();
  regs = regs.filter(r => r.id !== id);
  localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(regs));
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

  const players = getPlayers();
  match.playerIds.forEach(pid => {
    const pIndex = players.findIndex(p => p.id === pid);
    if (pIndex >= 0) {
      players[pIndex].totalPoints += points;
      players[pIndex].gamesPlayed += 1;
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
};

export const getMessagesForUser = (userId: string): Message[] => {
    const messages = getMessages();
    // Return messages specifically for this user OR broadcast messages ('ALL')
    // Sort by timestamp descending
    return messages
        .filter(m => m.receiverId === userId || m.receiverId === 'ALL')
        .sort((a, b) => b.timestamp - a.timestamp);
};

export const markMessageAsRead = (messageId: string, userId: string): void => {
    // Note: For broadcast messages, marking as "read" in a simple localstorage array is tricky 
    // because one message object is shared by all.
    // For simplicity in this prototype:
    // 1. Direct messages: Update the 'read' flag on the message.
    // 2. Broadcast messages: We will store a separate "read_broadcasts" list in LocalStorage for the user.
    
    const messages = getMessages();
    const msgIndex = messages.findIndex(m => m.id === messageId);
    
    if (msgIndex >= 0) {
        const msg = messages[msgIndex];
        if (msg.receiverId === userId) {
            // Direct message
            messages[msgIndex].read = true;
            localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
        } else if (msg.receiverId === 'ALL') {
            // Broadcast message - Use a separate key to track reads for this user
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
    
    // Get read broadcasts
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
  localStorage.setItem(KEYS.STATE, JSON.stringify({ ...current, ...newState }));
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
};
