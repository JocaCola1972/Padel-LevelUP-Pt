
import React, { useState, useEffect } from 'react';
import { Player } from './types';
import { PlayerForm } from './components/PlayerForm';
import { RegistrationPanel } from './components/RegistrationPanel';
import { MatchTracker } from './components/MatchTracker';
import { RankingTable } from './components/RankingTable';
import { InscritosList } from './components/InscritosList';
import { AdminPanel } from './components/AdminPanel';
import { LandingPage } from './components/LandingPage';
import { MembersList } from './components/MembersList';
import { ProfileModal } from './components/ProfileModal';
import { MastersLup } from './components/MastersLup';
import { NotificationModal } from './components/NotificationModal';
import { LevelUpInfo } from './components/LevelUpInfo';
import { ToolsPanel } from './components/ToolsPanel';
import { generateTacticalTip } from './services/geminiService';
import { getAppState, getUnreadCount, initCloudSync, isFirebaseConnected, subscribeToChanges, getPlayers, fetchAllData } from './services/storageService';

enum Tab { LEVELUP = 'levelup', REGISTRATION = 'registrations', INSCRITOS = 'inscritos', MATCHES = 'matches', RANKING = 'ranking', MEMBERS = 'members', MASTERS = 'masters', ADMIN = 'admin', TOOLS = 'tools' }
enum ViewState { LANDING = 'landing', AUTH = 'auth', APP = 'app' }
const SESSION_KEY = 'padel_levelup_session_user_id';

const App: React.FC = () => {
  const getInitialUser = (): Player | null => {
    const savedUserId = localStorage.getItem(SESSION_KEY);
    if (!savedUserId) return null;
    const playersData = localStorage.getItem('padel_players');
    if (!playersData) return null;
    try {
        const players: Player[] = JSON.parse(playersData);
        const found = players.find(p => p.id === savedUserId);
        return (found && found.isApproved !== false) ? found : null;
    } catch (e) { return null; }
  };

  const [currentUser, setCurrentUser] = useState<Player | null>(getInitialUser());
  const [viewState, setViewState] = useState<ViewState>(currentUser ? ViewState.APP : ViewState.LANDING);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.LEVELUP);
  const [tip, setTip] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    initCloudSync().then(() => setIsSyncing(isFirebaseConnected()));
    generateTacticalTip().then(setTip);
    
    const refreshState = () => {
        setIsSyncing(isFirebaseConnected());
        if (currentUser) {
            setUnreadMessagesCount(getUnreadCount(currentUser.id));
            const players = getPlayers();
            const fresh = players.find(p => p.id === currentUser.id);
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(currentUser)) {
                setCurrentUser(fresh);
            }
        }
    };

    refreshState();
    const unsubscribe = subscribeToChanges(refreshState);
    const interval = setInterval(() => {
        if (isFirebaseConnected()) fetchAllData();
        refreshState();
    }, 15000);

    return () => { 
        unsubscribe();
        clearInterval(interval); 
    };
  }, [currentUser]);

  const handleLoginSuccess = (player: Player) => {
    localStorage.setItem(SESSION_KEY, player.id);
    setCurrentUser(player);
    setViewState(ViewState.APP);
    setActiveTab(Tab.LEVELUP);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setViewState(ViewState.LANDING);
  };

  if (viewState === ViewState.LANDING) return <LandingPage onNavigate={(mode) => { setAuthMode(mode); setViewState(ViewState.AUTH); }} />;
  if (viewState === ViewState.AUTH) return <PlayerForm initialMode={authMode} onLogin={handleLoginSuccess} onBack={() => setViewState(ViewState.LANDING)} />;
  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  return (
    <div className="min-h-screen pb-24">
      <header className="bg-white/95 backdrop-blur shadow-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black italic text-padel-dark transform -skew-x-6">Padel LevelUp</h1>
            <div 
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${isSyncing ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} 
                title={isSyncing ? "Ligado à Nuvem" : "A tentar ligar..."}
            ></div>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={() => setIsNotificationsOpen(true)} className="relative p-2 text-2xl">🔔
                  {unreadMessagesCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">{unreadMessagesCount}</span>}
              </button>
              <div 
                  onClick={() => setIsProfileOpen(true)} 
                  className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors py-1 pl-3 pr-1 rounded-full border border-gray-200 cursor-pointer"
              >
                  <span className="text-[10px] font-black uppercase text-gray-600 truncate max-w-[80px]">
                      {currentUser.name.split(' ')[0]}
                  </span>
                  <div className="w-8 h-8 rounded-full border-2 border-padel overflow-hidden bg-white shrink-0">
                      {currentUser.photoUrl ? (
                          <img src={currentUser.photoUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">👤</div>
                      )}
                  </div>
              </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {tip && <div className="bg-white/80 p-3 rounded-lg border-l-4 border-yellow-400 text-xs italic text-gray-700 shadow-sm">💡 Coach: "{tip}"</div>}
        {activeTab === Tab.LEVELUP && <LevelUpInfo />}
        {activeTab === Tab.REGISTRATION && <RegistrationPanel currentUser={currentUser} />}
        {activeTab === Tab.INSCRITOS && <InscritosList />}
        {activeTab === Tab.MATCHES && <MatchTracker currentUser={currentUser} />}
        {activeTab === Tab.RANKING && <RankingTable />}
        {activeTab === Tab.MEMBERS && <MembersList currentUser={currentUser} />}
        {activeTab === Tab.MASTERS && <MastersLup isAdmin={isAdmin} />}
        {activeTab === Tab.TOOLS && isAdmin && <ToolsPanel />}
        {activeTab === Tab.ADMIN && isAdmin && <AdminPanel />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t z-20 pb-safe shadow-lg flex overflow-x-auto no-scrollbar items-center px-2">
          <NavButton active={activeTab === Tab.LEVELUP} onClick={() => setActiveTab(Tab.LEVELUP)} icon="🚀" label="LEVELUP" />
          <NavButton active={activeTab === Tab.REGISTRATION} onClick={() => setActiveTab(Tab.REGISTRATION)} icon="📝" label="Insc." />
          <NavButton active={activeTab === Tab.INSCRITOS} onClick={() => setActiveTab(Tab.INSCRITOS)} icon="📋" label="Lista" />
          <NavButton active={activeTab === Tab.MATCHES} onClick={() => setActiveTab(Tab.MATCHES)} icon="🥎" label="Jogos" />
          <NavButton active={activeTab === Tab.RANKING} onClick={() => setActiveTab(Tab.RANKING)} icon="🏆" label="Rank" />
          {isAdmin && (
            <>
              <NavButton active={activeTab === Tab.MASTERS} onClick={() => setActiveTab(Tab.MASTERS)} icon="👑" label="Masters" />
              <NavButton active={activeTab === Tab.MEMBERS} onClick={() => setActiveTab(Tab.MEMBERS)} icon="👥" label="Membros" />
              <NavButton active={activeTab === Tab.ADMIN} onClick={() => setActiveTab(Tab.ADMIN)} icon="⚙️" label="Admin" />
              <NavButton active={activeTab === Tab.TOOLS} onClick={() => setActiveTab(Tab.TOOLS)} icon="🛠️" label="Ferram." />
            </>
          )}
      </nav>

      {isProfileOpen && <ProfileModal currentUser={currentUser} onClose={() => setIsProfileOpen(false)} onUpdate={setCurrentUser} onLogout={handleLogout} />}
      {isNotificationsOpen && <NotificationModal currentUser={currentUser} onClose={() => setIsNotificationsOpen(false)} />}
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`min-w-[65px] py-3 flex flex-col items-center gap-1 transition-all flex-shrink-0 ${active ? 'text-padel scale-110 font-bold' : 'text-gray-400'}`}>
    <span className="text-xl">{icon}</span>
    <span className="text-[8px] uppercase tracking-wide">{label}</span>
  </button>
);

export default App;
