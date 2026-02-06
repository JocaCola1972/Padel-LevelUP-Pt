
import { Player, Registration, MatchRecord, AppState, Shift, CourtAllocation, MastersState, PasswordResetRequest, Message, GameResult } from '../types';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const KEYS = {
  PLAYERS: 'padel_players',
  REGISTRATIONS: 'padel_registrations',
  MATCHES: 'padel_matches',
  STATE: 'padel_state',
  MASTERS: 'padel_masters',
  MESSAGES: 'padel_messages',
  SESSION: 'padel_user_session'
};

const SUPABASE_URL = "https://bjiyrvayymwojubafray.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqaXlydmF5eW13b2p1YmFmcmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjQ3ODMsImV4cCI6MjA4MTI0MDc4M30.f1iIInDubbIm7rR5-gm6bEybTU3etOW5s1waX4P8hEo";

let supabase: SupabaseClient | null = null;
let syncChannel: RealtimeChannel | null = null;
let isConnected = false;
let isSyncing = false;

type DataChangeListener = () => void;
const listeners: DataChangeListener[] = [];

export const normalizePhone = (phone: string): string => {
    if (!phone) return "";
    const p = phone.toLowerCase().trim();
    if (p === 'jocacola') return 'JocaCola';
    return phone.replace(/[^0-9]/g, "").trim();
};

const isAdminPhone = (phone: string): boolean => {
    const clean = normalizePhone(phone);
    return clean === '917772010' || clean === 'JocaCola';
};

export const getSupabase = () => {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false },
        });
    }
    return supabase;
};

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

export const isSupabaseConnected = () => isConnected;
export const getIsSyncing = () => isSyncing;

export const initCloudSync = async () => {
    await fetchAllData();
    enableRealtimeSubscriptions();
};

export const fetchAllData = async () => {
    isSyncing = true;
    notifyListeners();
    
    const client = getSupabase();
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        const [p, r, m, msg, config, settings] = await Promise.all([
            client.from('players').select('*').order('participantNumber', { ascending: true }).limit(1000),
            client.from('registrations').select('*'),
            client.from('matches').select('*').gte('date', thirtyDaysAgoStr).order('timestamp', { ascending: false }),
            client.from('messages').select('*').order('timestamp', { ascending: false }).limit(100),
            client.from('app_config').select('*').eq('id', 1).maybeSingle(),
            client.from('settings').select('*')
        ]);

        if (p.data) localStorage.setItem(KEYS.PLAYERS, JSON.stringify(p.data));
        if (r.data) localStorage.setItem(KEYS.REGISTRATIONS, JSON.stringify(r.data));
        if (m.data) localStorage.setItem(KEYS.MATCHES, JSON.stringify(m.data));
        if (msg.data) localStorage.setItem(KEYS.MESSAGES, JSON.stringify(msg.data));
        
        if (config.data) {
            const stateFromDb: AppState = {
                registrationsOpen: config.data.registrations_open,
                nextSundayDate: config.data.next_sunday_date,
                isTournamentFinished: config.data.is_tournament_finished,
                customLogo: config.data.custom_logo,
                loginBackground: config.data.login_background,
                faviconUrl: config.data.favicon_url,
                courtConfig: config.data.court_config,
                gamesPerShift: config.data.games_per_shift,
                passwordResetRequests: config.data.password_reset_requests || [],
                adminSectionOrder: config.data.admin_section_order,
                toolsSectionOrder: config.data.tools_section_order,
                dailyTip: config.data.daily_tip,
                dailyTipDate: config.data.daily_tip_date
            };
            localStorage.setItem(KEYS.STATE, JSON.stringify(stateFromDb));
        }

        if (settings.data) {
            const mastersRow = settings.data.find((row: any) => row.key === 'masters');
            if (mastersRow) localStorage.setItem(KEYS.MASTERS, JSON.stringify(mastersRow.value));
        }
    } catch (err) {
        console.error("Erro ao sincronizar dados:", err);
    } finally {
        isSyncing = false;
        notifyListeners();
    }
};

const enableRealtimeSubscriptions = () => {
    const client = getSupabase();
    syncChannel = client.channel('realtime-sync')
        .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeUpdate)
        .subscribe((status) => {
            isConnected = (status === 'SUBSCRIBED');
            notifyListeners();
        });
};

const handleRealtimeUpdate = (payload: any) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    const tableName = table.toLowerCase();
    
    if (tableName === 'app_config') {
        if (newRecord) {
            const currentLocal = getAppState();
            const updatedState: AppState = {
                ...currentLocal,
                registrationsOpen: newRecord.registrations_open ?? currentLocal.registrationsOpen,
                nextSundayDate: newRecord.next_sunday_date ?? currentLocal.nextSundayDate,
                isTournamentFinished: newRecord.is_tournament_finished ?? currentLocal.isTournamentFinished,
                customLogo: newRecord.custom_logo ?? currentLocal.customLogo,
                loginBackground: newRecord.login_background ?? currentLocal.loginBackground,
                faviconUrl: newRecord.favicon_url ?? currentLocal.faviconUrl,
                courtConfig: newRecord.court_config ?? currentLocal.courtConfig,
                gamesPerShift: newRecord.games_per_shift ?? currentLocal.gamesPerShift,
                passwordResetRequests: newRecord.password_reset_requests ?? currentLocal.passwordResetRequests,
                adminSectionOrder: newRecord.admin_section_order ?? currentLocal.adminSectionOrder,
                toolsSectionOrder: newRecord.tools_section_order ?? currentLocal.toolsSectionOrder,
                dailyTip: newRecord.daily_tip ?? currentLocal.dailyTip,
                dailyTipDate: newRecord.daily_tip_date ?? currentLocal.dailyTipDate,
            };
            localStorage.setItem(KEYS.STATE, JSON.stringify(updatedState));
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
        case 'settings': 
            if (newRecord?.key === 'masters') {
                localStorage.setItem(KEYS.MASTERS, JSON.stringify(newRecord.value));
            } 
            notifyListeners(); 
            return;
        default: return;
    }

    let data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (eventType === 'INSERT') {
        if (!data.find((i: any) => i.id === newRecord.id)) data.push(newRecord);
    } else if (eventType === 'UPDATE') {
        const idx = data.findIndex((i: any) => i.id === newRecord.id);
        if (idx >= 0) data[idx] = newRecord;
        else data.push(newRecord);
    } else if (eventType === 'DELETE') {
        data = data.filter((i: any) => i.id !== oldRecord.id);
    }
    localStorage.setItem(storageKey, JSON.stringify(data));
    notifyListeners();
};

export const signUp = async (name: string, phone: string, password?: string) => {
    const client = getSupabase();
    const cleanPhone = normalizePhone(phone);
    const { data: existing } = await client.from('players').select('id').eq('phone', cleanPhone).maybeSingle();
    if (existing) throw new Error("Este número já está registado.");
    
    const { count } = await client.from('players').select('*', { count: 'exact', head: true });
    const nextId = (count || 0) + 1;
    
    const isSuperAdmin = isAdminPhone(cleanPhone);
    
    const newPlayer: Player = {
        id: generateUUID(), 
        name: name.trim(), 
        phone: cleanPhone, 
        password: password || '',
        participantNumber: nextId, 
        totalPoints: 0, 
        gamesPlayed: 0,
        isApproved: isSuperAdmin, 
        role: isSuperAdmin ? 'super_admin' : 'user'
    };
    
    const { error } = await client.from('players').insert(newPlayer);
    if (error) throw error;
    return newPlayer;
};

export const signIn = async (phone: string, password?: string) => {
    const client = getSupabase();
    const cleanPhone = normalizePhone(phone);
    const inputPassword = (password || '').trim();

    // Verificação de credenciais mestre de ADMIN
    const isMasterAdmin = isAdminPhone(cleanPhone) && inputPassword === '123';

    let { data: user, error } = await client.from('players').select('*').eq('phone', cleanPhone).maybeSingle();
    
    if (error) throw error;

    // Se as credenciais de Admin forem usadas e o utilizador não existir, cria-o agora
    if (!user && isMasterAdmin) {
        const { count } = await client.from('players').select('*', { count: 'exact', head: true });
        const nextId = (count || 0) + 1;
        const adminPlayer: Player = {
            id: generateUUID(),
            name: "Administrador Geral",
            phone: cleanPhone,
            password: '123',
            participantNumber: nextId,
            totalPoints: 0,
            gamesPlayed: 0,
            isApproved: true,
            role: 'super_admin'
        };
        const { data: inserted, error: insertError } = await client.from('players').insert(adminPlayer).select().single();
        if (insertError) throw insertError;
        user = inserted;
    }

    if (!user) {
        throw new Error("Utilizador não encontrado. Se é o seu primeiro acesso, registe-se primeiro.");
    }
    
    // Verificação de Password
    if (user.password && user.password !== '' && user.password !== inputPassword) {
        throw new Error("Password incorreta.");
    }

    // Garantir que o Admin tem permissões corretas
    if (isAdminPhone(cleanPhone) && user.role !== 'super_admin') {
        await client.from('players').update({ role: 'super_admin', isApproved: true, password: '123' }).eq('id', user.id);
        user.role = 'super_admin';
        user.isApproved = true;
        user.password = '123';
    }

    localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    notifyListeners();
    return user;
};

export const getCurrentUser = (): Player | null => {
    const session = localStorage.getItem(KEYS.SESSION);
    return session ? JSON.parse(session) : null;
};

export const signOut = async () => {
    localStorage.removeItem(KEYS.SESSION);
    notifyListeners();
};

export const getPlayers = (): Player[] => JSON.parse(localStorage.getItem(KEYS.PLAYERS) || '[]');
export const getAppState = (): AppState => JSON.parse(localStorage.getItem(KEYS.STATE) || '{"registrationsOpen":false,"courtConfig":{},"nextSundayDate":"","gamesPerShift":{},"passwordResetRequests":[]}');

export const savePlayer = async (player: Player): Promise<void> => {
    const client = getSupabase();
    const current = getCurrentUser();
    
    if (current && current.id === player.id) {
        localStorage.setItem(KEYS.SESSION, JSON.stringify(player));
    }
    
    const players = getPlayers();
    const idx = players.findIndex(p => p.id === player.id);
    if (idx >= 0) players[idx] = player;
    else players.push(player);
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players));

    await client.from('players').upsert(player);
    notifyListeners();
};

export const savePlayersBulk = async (players: Player[]): Promise<void> => {
    const client = getSupabase();
    await client.from('players').upsert(players);
    notifyListeners();
};

export const getRegistrations = (): Registration[] => JSON.parse(localStorage.getItem(KEYS.REGISTRATIONS) || '[]');
export const addRegistration = async (reg: Registration): Promise<void> => {
    await getSupabase().from('registrations').insert(reg);
};
export const updateRegistration = async (id: string, updates: Partial<Registration>): Promise<void> => {
    await getSupabase().from('registrations').update(updates).eq('id', id);
};
export const removeRegistration = async (id: string): Promise<void> => {
    await getSupabase().from('registrations').delete().eq('id', id);
};

export const getMatches = (): MatchRecord[] => JSON.parse(localStorage.getItem(KEYS.MATCHES) || '[]');
export const addMatch = async (match: MatchRecord, points: number): Promise<void> => {
    const client = getSupabase();
    const players = getPlayers();
    match.playerIds.forEach(pid => {
        const p = players.find(x => x.id === pid);
        if (p) { p.totalPoints += points; p.gamesPlayed += 1; }
    });
    await Promise.all([
        client.from('matches').insert(match),
        client.from('players').upsert(players.filter(p => match.playerIds.includes(p.id)).map(p => ({
            id: p.id, totalPoints: p.totalPoints, gamesPlayed: p.gamesPlayed
        })))
    ]);
};

export const getMessages = (): Message[] => JSON.parse(localStorage.getItem(KEYS.MESSAGES) || '[]');
export const saveMessage = async (msg: Message): Promise<void> => {
    await getSupabase().from('messages').insert(msg);
};

export const getMessagesForUser = (uid: string) => {
    const allMessages = getMessages();
    const registrations = getRegistrations();
    const state = getAppState();
    const userRegistrations = registrations.filter(r => (r.playerId === uid || r.partnerId === uid) && r.date === state.nextSundayDate);
    const userShifts = userRegistrations.map(r => r.shift);

    return allMessages.filter(m => 
        m.receiverId === uid || 
        m.receiverId === 'ALL' || 
        userShifts.includes(m.receiverId as Shift)
    );
};

export const updateAppState = async (updates: Partial<AppState>): Promise<void> => {
    const currentState = getAppState();
    const newState = { ...currentState, ...updates };
    localStorage.setItem(KEYS.STATE, JSON.stringify(newState));
    notifyListeners();

    const dbUpdates: any = { id: 1 };
    if (updates.registrationsOpen !== undefined) dbUpdates.registrations_open = updates.registrationsOpen;
    if (updates.nextSundayDate !== undefined) dbUpdates.next_sunday_date = updates.nextSundayDate;
    if (updates.courtConfig !== undefined) dbUpdates.court_config = updates.courtConfig;
    if (updates.gamesPerShift !== undefined) dbUpdates.games_per_shift = updates.gamesPerShift;
    if (updates.dailyTip !== undefined) dbUpdates.daily_tip = updates.dailyTip;
    if (updates.dailyTipDate !== undefined) dbUpdates.daily_tip_date = updates.dailyTipDate;

    await getSupabase().from('app_config').upsert(dbUpdates);
};

export const saveMastersState = async (state: MastersState): Promise<void> => {
    await getSupabase().from('settings').upsert({ key: 'masters', value: state }, { onConflict: 'key' });
};

export const getMastersState = (): MastersState => {
    const data = localStorage.getItem(KEYS.MASTERS);
    return data ? JSON.parse(data) : { teams: [], matches: [], currentPhase: 1, pool: [] };
};

export const approvePlayer = async (id: string) => {
    await getSupabase().from('players').update({ isApproved: true }).eq('id', id);
};

export const removePlayer = async (id: string) => {
    const client = getSupabase();
    await Promise.all([
        client.from('players').delete().eq('id', id),
        client.from('registrations').delete().or(`playerId.eq.${id},partnerId.eq.${id}`),
        client.from('messages').delete().or(`senderId.eq.${id},receiverId.eq.${id}`)
    ]);
};

export const deleteMatchesByDate = async (date: string) => {
    const client = getSupabase();
    await client.from('matches').delete().eq('date', date);
};

export const deleteRegistrationsByDate = async (date: string) => {
    const client = getSupabase();
    await client.from('registrations').delete().eq('date', date);
};

export const markMessageAsRead = async (id: string) => {
    await getSupabase().from('messages').update({ read: true }).eq('id', id);
};

export const deleteMessageForUser = async (id: string) => {
    await getSupabase().from('messages').delete().eq('id', id);
};

export const deleteAllMessagesForUser = async (uid: string) => {
    await getSupabase().from('messages').delete().eq('receiverId', uid);
};

export const updatePresence = async (playerId: string) => {
    await getSupabase().from('players').update({ lastActive: Date.now() }).eq('id', playerId);
};

export const fetchPlayersBatch = async (offset: number, limit: number, search?: string): Promise<Player[]> => {
    let query = getSupabase().from('players').select('*').order('participantNumber', { ascending: true }).range(offset, offset + limit - 1);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const fetchMatchesByDate = async (date: string): Promise<MatchRecord[]> => {
    const { data, error } = await getSupabase().from('matches').select('*').eq('date', date).order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getUnreadCount = (uid: string) => getMessagesForUser(uid).filter(m => !m.read).length;
export const uploadAvatar = async (playerId: string, file: File): Promise<string> => {
    const client = getSupabase();
    const fileName = `${playerId}-${Date.now()}.${file.name.split('.').pop()}`;
    const filePath = `avatars/${fileName}`;
    const { error: uploadError } = await client.storage.from('avatars').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data } = client.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
};

export const uploadSiteAsset = async (file: File, namePrefix: string): Promise<string> => {
    const client = getSupabase();
    const fileName = `${namePrefix}-${Date.now()}.${file.name.split('.').pop()}`;
    const filePath = `assets/${fileName}`;
    await client.storage.from('avatars').upload(filePath, file);
    const { data } = client.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
};

export const clearAllMessages = async () => { await getSupabase().from('messages').delete().neq('id', '0'); };
export const clearAllRegistrations = async () => { await getSupabase().from('registrations').delete().neq('id', '0'); };
export const clearMatchesByShift = async (shift: Shift) => { await getSupabase().from('matches').delete().eq('shift', shift); };

export const generateUUID = () => crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
