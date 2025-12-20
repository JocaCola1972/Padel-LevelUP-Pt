
export enum Shift {
  MORNING_1 = "08:00 - 09:30",
  MORNING_2 = "09:30 - 11:00",
  MORNING_3 = "11:00 - 13:00"
}

export enum GameResult {
  WIN = "WIN",
  DRAW = "DRAW",
  LOSS = "LOSS"
}

export interface Player {
  id: string;
  name: string;
  phone: string;
  password?: string; // Optional password for login
  totalPoints: number;
  gamesPlayed: number;
  participantNumber: number; // New permanent ID
  role?: 'super_admin' | 'admin' | 'user';
  photoUrl?: string; // Base64 profile photo string
  isApproved?: boolean; // New: Requires admin approval to login
}

export interface Registration {
  id: string;
  playerId: string;
  partnerName?: string; // Optional: name of partner if signing up as dupla
  partnerId?: string;
  shift: Shift;
  date: string;
  hasPartner: boolean;
  type?: 'game' | 'training'; // New field: distinguish activity
}

export interface MatchRecord {
  id: string;
  date: string;
  shift: Shift;
  courtNumber: number;
  gameNumber: number; // Added: Which game in the sequence (1, 2, 3...)
  playerIds: string[]; // Who played in this team (or just the submitter)
  result: GameResult;
  timestamp: number;
  goldenPointWon?: boolean; // Added: True if this team won the golden point in a draw
}

export interface CourtAllocation {
  game: number;
  training: number;
}

export interface PasswordResetRequest {
  id: string;
  playerId: string;
  playerName: string;
  playerPhone: string;
  timestamp: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string; // 'ALL' for broadcast, or UUID for specific user
  content: string;
  timestamp: number;
  read: boolean; // Only relevant for individual messages logic essentially, but stored here
}

export interface AppState {
  registrationsOpen: boolean;
  courtConfig: Record<Shift, CourtAllocation>; // Replaces activeCourts with per-shift config
  nextSundayDate: string;
  gamesPerShift: Record<Shift, number>; // Updated to map each shift to a number
  customLogo?: string; // Base64 string of the custom uploaded logo
  isTournamentFinished?: boolean;
  passwordResetRequests: PasswordResetRequest[]; // List of pending requests
  adminSectionOrder?: string[]; // Ordem das secções no painel admin
}

// --- MASTERS LUP TYPES ---

export interface MastersTeam {
  id: string;
  player1Name: string;
  player2Name: string;
  group: 'I' | 'II' | 'III' | 'IV';
  points: number;
  gamesWon: number;
  gamesLost: number;
  setsWon: number; // For Golden Point tie breaker logic if needed, simplify to "victories"
}

export interface MastersMatch {
  id: string;
  phase: 1 | 2 | 3; // 1=Groups, 2=Semis/Cross, 3=Finals
  courtNumber: number;
  team1Id: string;
  team2Id: string;
  winnerId?: string;
  score?: string; // e.g. "6-4"
  group?: string; // For phase 1
}

export interface MastersState {
  teams: MastersTeam[];
  matches: MastersMatch[];
  currentPhase: 1 | 2 | 3;
  pool: string[]; // List of eligible player names imported from Excel
}
