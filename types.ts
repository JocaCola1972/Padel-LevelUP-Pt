
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
  password?: string;
  totalPoints: number;
  gamesPlayed: number;
  participantNumber: number;
  role?: 'super_admin' | 'admin' | 'user';
  photoUrl?: string;
  isApproved?: boolean;
  lastActive?: number;
}

export interface Registration {
  id: string;
  playerId: string;
  partnerName?: string;
  partnerId?: string;
  shift: Shift;
  date: string;
  hasPartner: boolean;
  type?: 'game' | 'training';
  isWaitingList?: boolean;
  startingCourt?: number;
}

export interface MatchRecord {
  id: string;
  date: string;
  shift: Shift;
  courtNumber: number;
  gameNumber: number;
  playerIds: string[];
  result: GameResult;
  timestamp: number;
  goldenPointWon?: boolean;
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
  receiverId: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export interface AppState {
  registrationsOpen: boolean;
  courtConfig: Record<Shift, CourtAllocation>;
  nextSundayDate: string;
  gamesPerShift: Record<Shift, number>;
  customLogo?: string;
  loginBackground?: string;
  faviconUrl?: string;
  isTournamentFinished?: boolean;
  passwordResetRequests: PasswordResetRequest[];
  adminSectionOrder?: string[];
  toolsSectionOrder?: string[];
  autoOpenTime?: string;
  dailyTip?: string;          // Dica partilhada por todos
  dailyTipDate?: string;      // Data da última atualização da dica
}

export interface MastersTeam {
  id: string;
  player1Name: string;
  player2Name: string;
  group: 'I' | 'II' | 'III' | 'IV';
  points: number;
  gamesWon: number;
  gamesLost: number;
  setsWon: number;
}

export interface MastersMatch {
  id: string;
  phase: 1 | 2 | 3;
  courtNumber: number;
  team1Id: string;
  team2Id: string;
  winnerId?: string;
  score?: string;
  group?: string;
}

export interface MastersState {
  teams: MastersTeam[];
  matches: MastersMatch[];
  currentPhase: 1 | 2 | 3;
  pool: string[];
}
