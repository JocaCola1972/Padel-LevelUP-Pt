
import { Player, Registration, MatchRecord, AppState, Shift, CourtAllocation, MastersState } from '../types';

const KEYS = {
  PLAYERS: 'padel_players',
  REGISTRATIONS: 'padel_registrations',
  MATCHES: 'padel_matches',
  STATE: 'padel_state',
  MASTERS: 'padel_masters'
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
    [Shift.MORNING_1]: { game: 4, training: 0 },
    [Shift.MORNING_2]: { game: 4, training: 0 },
    [Shift.MORNING_3]: { game: 4, training: 0 },
  },
  nextSundayDate: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
  gamesPerShift: {
    [Shift.MORNING_1]: 5,
    [Shift.MORNING_2]: 5,
    [Shift.MORNING_3]: 5
  },
  customLogo: undefined,
  isTournamentFinished: false
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
  
  // Migration: Ensure at least one SUPER admin exists if there are players
  if (players.length > 0) {
      const hasSuperAdmin = players.some(p => p.role === 'super_admin');
      
      if (!hasSuperAdmin) {
          // If no super admin, try to promote the first 'admin'
          const adminIndex = players.findIndex(p => p.role === 'admin');
          if (adminIndex >= 0) {
              players[adminIndex].role = 'super_admin';
          } else {
              // If no admins at all, promote the very first user
              players[0].role = 'super_admin';
          }
          localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
      }
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
    // Preserve existing role if not specified in update, unless explicitly changed in the object passed
    // NOTE: When updating profile from ProfileModal, role might be undefined, so keep current.
    // When updating from MembersList (admin action), role will be set.
    const currentRole = players[index].role || 'user';
    players[index] = { 
        ...players[index], 
        ...player, 
        participantNumber: players[index].participantNumber, 
        role: player.role || currentRole 
    };
  } else {
    // New player
    const maxNum = players.reduce((max, p) => Math.max(max, p.participantNumber || 0), 0);
    player.participantNumber = maxNum + 1;
    
    // First player ever becomes Super Admin
    if (players.length === 0) {
        player.role = 'super_admin';
    } else {
        player.role = 'user';
    }

    // Ensure ID is generated if not present (although passed in, let's be safe)
    if (!player.id) player.id = generateUUID();

    players.push(player);
  }
  
  localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));
};

export const removePlayer = (playerId: string): void => {
    // 1. Remove Player
    let players = getPlayers();
    players = players.filter(p => p.id !== playerId);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));

    // 2. Remove FUTURE registrations for this player
    // We keep past data or matches for history integrity, but remove active registrations
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
            // Update existing? Just skip or update name? Let's update name if provided
            // We do not overwrite points or existing participant number
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
                role: isFirst ? 'super_admin' : 'user'
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
  // Avoid duplicates for same shift
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

  // Update player points immediately
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

// --- App State ---

export const getAppState = (): AppState => {
  const data = localStorage.getItem(KEYS.STATE);
  if (data) {
    const parsed = JSON.parse(data);
    
    // Migration 1: Handle old numeric gamesPerShift
    let gamesPerShift = parsed.gamesPerShift;
    if (typeof gamesPerShift === 'number' || !gamesPerShift) {
        const val = typeof gamesPerShift === 'number' ? gamesPerShift : 5;
        gamesPerShift = {
            [Shift.MORNING_1]: val,
            [Shift.MORNING_2]: val,
            [Shift.MORNING_3]: val
        };
    }

    // Migration 2: Handle old activeCourts (global number) -> new courtConfig (per shift object)
    let courtConfig = parsed.courtConfig;
    if (!courtConfig) {
        // If we have 'activeCourts' from old state, use it, otherwise default to 4
        const oldActive = parsed.activeCourts || 4;
        courtConfig = {
            [Shift.MORNING_1]: { game: oldActive, training: 0 },
            [Shift.MORNING_2]: { game: oldActive, training: 0 },
            [Shift.MORNING_3]: { game: oldActive, training: 0 },
        };
    }

    return { ...defaultState, ...parsed, gamesPerShift, courtConfig };
  }
  return defaultState;
};

export const updateAppState = (newState: Partial<AppState>): void => {
  const current = getAppState();
  localStorage.setItem(KEYS.STATE, JSON.stringify({ ...current, ...newState }));
};

// --- MASTERS LUP ---

export const getMastersState = (): MastersState => {
  const data = localStorage.getItem(KEYS.MASTERS);
  return data ? JSON.parse(data) : defaultMastersState;
};

export const saveMastersState = (state: MastersState): void => {
  localStorage.setItem(KEYS.MASTERS, JSON.stringify(state));
};
