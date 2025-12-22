
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
import { generateTacticalTip } from './services/geminiService';
import { getAppState, getUnreadCount, initCloudSync, isFirebaseConnected, subscribeToChanges, getPlayers, updateAppState } from './services/storageService';

enum Tab {
  LEVELUP = 'levelup',
  REGISTRATION = 'registrations',
  INSCRITOS = 'inscritos',
  MATCHES = 'matches',
  RANKING = 'ranking',
  MEMBERS = 'members',
  MASTERS = 'masters',
  ADMIN = 'admin'
}

enum ViewState {
  LANDING = 'landing',
  AUTH = 'auth',
  APP = 'app'
}

const SESSION_KEY = 'padel_levelup_session_user_id';

const App: React.FC = () => {
  // Lógica de recuperação de sessão síncrona para evitar "flicker" no refresh
  const getInitialUser = (): Player | null => {
    const savedUserId = localStorage.getItem(SESSION_KEY);
    if (!savedUserId) return null;
    
    // Tentamos obter os jogadores do localStorage imediatamente
    const playersData = localStorage.getItem('padel_players');
    if (!playersData) return null;
    
    try {
        const players: Player[] = JSON.parse(playersData);
        const found = players.find(p => p.id === savedUserId);
        // Só mantemos a sessão se o utilizador existir e não estiver pendente de aprovação
        return (found && found.isApproved !== false) ? found : null;
    } catch (e) {
        return null;
    }
  };

  const initialUser = getInitialUser();
  const [currentUser, setCurrentUser] = useState<Player | null>(initialUser);
  const [viewState, setViewState] = useState<ViewState>(initialUser ? ViewState.APP : ViewState.LANDING);
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.LEVELUP); // Definido como LEVELUP por defeito
  const [tip, setTip] = useState<string>('');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  // Notification State
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Initial Data Sync & Session Validation
  useEffect(() => {
    const startSync = async () => {
        await initCloudSync();
        setIsSyncing(isFirebaseConnected());
        
        // Após o sync com a nuvem, validamos se o utilizador da sessão ainda é válido/aprovado
        const players = getPlayers();
        const savedUserId = localStorage.getItem(SESSION_KEY);
        if (savedUserId) {
            const freshUser = players.find(p => p.id === savedUserId);
            if (!freshUser || freshUser.isApproved === false) {
                handleLogout();
            } else if (JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
                setCurrentUser(freshUser);
            }
        }
    };
    startSync();
  }, []);

  useEffect(() => {
    // 2. Load AI tip
    generateTacticalTip().then(setTip);

    // 3. Check for notifications periodically
    const checkNotifications = () => {
        const state = getAppState();
        setPendingRequestsCount(state.passwordResetRequests?.length || 0);
        setIsSyncing(isFirebaseConnected());
        
        if (currentUser) {
            const unread = getUnreadCount(currentUser.id);
            setUnreadMessagesCount(unread);
            
            // Mantém os dados do utilizador atualizados se mudarem noutro dispositivo
            const players = getPlayers();
            const freshUserData = players.find(p => p.id === currentUser.id);
            if (freshUserData && JSON.stringify(freshUserData) !== JSON.stringify(currentUser)) {
                setCurrentUser(freshUserData);
            }
        }
    };
    
    checkNotifications();
    const interval = setInterval(checkNotifications, 5000);

    // 4. Dynamic Favicon Updater
    const updateFavicon = () => {
        const state = getAppState();
        if (state.customLogo) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = state.customLogo;
        }
    };

    updateFavicon();
    const unsubscribeFavicon = subscribeToChanges(updateFavicon);

    return () => {
        clearInterval(interval);
        unsubscribeFavicon();
    };

  }, [currentUser]);

  // 5. Automatic Registration Opening Logic
  useEffect(() => {
    const checkAutoOpen = () => {
        const state = getAppState();
        if (!state.registrationsOpen && state.autoOpenTime) {
            const now = new Date();
            const day = now.getDay(); // 0 = Sunday
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${hours}:${minutes}`;

            // We assume automatic opening is for Sunday by default, as per RegistrationPanel context
            if (day === 0 && currentTime >= state.autoOpenTime) {
                console.log("🚀 Abertura automática de inscrições acionada!");
                updateAppState({ registrationsOpen: true });
            }
        }
    };

    const autoOpenInterval = setInterval(checkAutoOpen, 30000); // Check every 30 seconds
    checkAutoOpen(); // Initial check

    return () => clearInterval(autoOpenInterval);
  }, []);

  const handleNavigateFromLanding = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setViewState(ViewState.AUTH);
  };

  const handleLoginSuccess = (player: Player) => {
    localStorage.setItem(SESSION_KEY, player.id);
    setCurrentUser(player);
    setViewState(ViewState.APP);
    setActiveTab(Tab.LEVELUP); // Redireciona para LevelUP após login
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setViewState(ViewState.LANDING);
    setActiveTab(Tab.LEVELUP);
    setIsProfileOpen(false);
  };

  // Render Logic
  if (viewState === ViewState.LANDING) {
    return <LandingPage onNavigate={handleNavigateFromLanding} />;
  }

  if (viewState === ViewState.AUTH) {
    return (
      <PlayerForm 
        initialMode={authMode} 
        onLogin={handleLoginSuccess} 
        onBack={() => setViewState(ViewState.LANDING)}
      />
    );
  }

  // App View
  if (!currentUser) return null;

  const isAnyAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isSuperAdmin = currentUser.role === 'super_admin';

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur shadow-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black italic text-padel-dark tracking-tight transform -skew-x-6">Padel LevelUp</h1>
            <div 
                className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-gray-300'}`} 
                title={isSyncing ? "Online (Sincronizado)" : "Modo Offline (Local)"}
            ></div>
          </div>
          <div className="flex items-center gap-4">
              
              {/* Notification Bell */}
              <button 
                onClick={() => setIsNotificationsOpen(true)}
                className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                  <span className="text-2xl">🔔</span>
                  {unreadMessagesCount > 0 && (
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                          {unreadMessagesCount}
                      </span>
                  )}
              </button>

              <div 
                className="text-right flex items-center gap-3 group cursor-pointer p-1 rounded hover:bg-gray-50 transition-colors" 
                onClick={() => setIsProfileOpen(true)} 
                title="Ver Perfil"
              >
                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">#{currentUser.participantNumber}</span>
                    <div className="font-bold text-sm leading-tight text-gray-800">
                        {currentUser.name}
                    </div>
                </div>
                
                <div className="w-10 h-10 rounded-full border-2 border-padel overflow-hidden bg-gray-100 flex-shrink-0 relative">
                    {currentUser.photoUrl ? (
                        <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-padel-light/20 text-padel-dark text-lg">
                            👤
                        </div>
                    )}
                    {currentUser.role === 'super_admin' && (
                    <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white text-[8px] px-1 rounded-full border border-white font-bold">SP</div>
                    )}
                    {currentUser.role === 'admin' && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[8px] px-1 rounded-full border border-white font-bold">AD</div>
                    )}
                </div>
              </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Daily Tip */}
        {tip && (
            <div className="bg-white/90 backdrop-blur border-l-4 border-yellow-400 p-3 rounded shadow-sm text-xs text-gray-700 italic">
                💡 Coach AI: "{tip}"
            </div>
        )}

        {activeTab === Tab.LEVELUP && <LevelUpInfo />}
        {activeTab === Tab.REGISTRATION && <RegistrationPanel currentUser={currentUser} />}
        {activeTab === Tab.INSCRITOS && <InscritosList />}
        {activeTab === Tab.MATCHES && <MatchTracker currentUser={currentUser} />}
        {activeTab === Tab.RANKING && <RankingTable />}
        
        {/* Protected Tabs */}
        {activeTab === Tab.MASTERS && isAnyAdmin && <MastersLup isAdmin={isAnyAdmin} />}
        {activeTab === Tab.MEMBERS && isAnyAdmin && <MembersList currentUser={currentUser} />}
        {activeTab === Tab.ADMIN && isAnyAdmin && <AdminPanel />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 z-20 pb-safe shadow-[0_-5px_10px_rgba(0,0,0,0.05)] overflow-x-auto">
        <div className="max-w-md mx-auto flex justify-between px-1">
          <NavButton 
            active={activeTab === Tab.LEVELUP} 
            onClick={() => setActiveTab(Tab.LEVELUP)}
            icon="🚀"
            label="LevelUP"
          />
          <NavButton 
            active={activeTab === Tab.REGISTRATION} 
            onClick={() => setActiveTab(Tab.REGISTRATION)}
            icon="📝"
            label="Inscrever"
          />
          <NavButton 
            active={activeTab === Tab.INSCRITOS} 
            onClick={() => setActiveTab(Tab.INSCRITOS)}
            icon="📋"
            label="Inscritos"
          />
          <NavButton 
            active={activeTab === Tab.MATCHES} 
            onClick={() => setActiveTab(Tab.MATCHES)}
            icon="🎾"
            label="Jogos"
          />
          <NavButton 
            active={activeTab === Tab.RANKING} 
            onClick={() => setActiveTab(Tab.RANKING)}
            icon="🏆"
            label="Ranking"
          />
          
          {/* Protected Navigation Buttons */}
          {isAnyAdmin && (
             <NavButton 
              active={activeTab === Tab.MASTERS} 
              onClick={() => setActiveTab(Tab.MASTERS)}
              icon="👑"
              label="Masters"
            />
          )}
          {isAnyAdmin && (
            <div className="relative">
                <NavButton 
                    active={activeTab === Tab.MEMBERS} 
                    onClick={() => setActiveTab(Tab.MEMBERS)}
                    icon="👥"
                    label="Membros"
                />
                {isSuperAdmin && pendingRequestsCount > 0 && (
                    <span className="absolute top-1 right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                        {pendingRequestsCount}
                    </span>
                )}
            </div>
          )}
          {isAnyAdmin && (
            <NavButton 
              active={activeTab === Tab.ADMIN} 
              onClick={() => setActiveTab(Tab.ADMIN)}
              icon="⚙️"
              label="Admin"
            />
          )}
        </div>
      </nav>

      {/* Profile Modal */}
      {isProfileOpen && (
          <ProfileModal 
            currentUser={currentUser}
            onClose={() => setIsProfileOpen(false)}
            onUpdate={setCurrentUser}
            onLogout={handleLogout}
          />
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
          <NotificationModal 
            currentUser={currentUser}
            onClose={() => {
                setIsNotificationsOpen(false);
                setUnreadMessagesCount(getUnreadCount(currentUser.id));
            }}
          />
      )}
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ 
  active, onClick, icon, label 
}) => (
  <button 
    onClick={onClick}
    className={`min-w-[60px] py-3 flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
      active ? 'text-padel scale-110 font-bold' : 'text-gray-400 hover:text-gray-600'
    }`}
  >
    <span className="text-xl drop-shadow-sm">{icon}</span>
    <span className="text-[9px] uppercase tracking-wide">{label}</span>
  </button>
);

export default App;
