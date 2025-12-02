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
import { generateTacticalTip } from './services/geminiService';

enum Tab {
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

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [viewState, setViewState] = useState<ViewState>(ViewState.LANDING);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [activeTab, setActiveTab] = useState<Tab>(Tab.REGISTRATION);
  const [tip, setTip] = useState<string>('');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    // Load AI tip on mount
    generateTacticalTip().then(setTip);
  }, []);

  const handleNavigateFromLanding = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setViewState(ViewState.AUTH);
  };

  const handleLoginSuccess = (player: Player) => {
    setCurrentUser(player);
    setViewState(ViewState.APP);
    // If they registered new, registration tab is good. If they logged in, registration tab is also good.
    setActiveTab(Tab.REGISTRATION);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setViewState(ViewState.LANDING);
    setActiveTab(Tab.REGISTRATION);
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
  if (!currentUser) return null; // Should not happen

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur shadow-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black italic text-padel-dark tracking-tight transform -skew-x-6">Padel LevelUp</h1>
          </div>
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
            
            <div className="w-10 h-10 rounded-full border-2 border-padel overflow-hidden bg-gray-100 flex-shrink-0">
                {currentUser.photoUrl ? (
                    <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-padel-light/20 text-padel-dark text-lg">
                        👤
                    </div>
                )}
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

        {activeTab === Tab.REGISTRATION && <RegistrationPanel currentUser={currentUser} />}
        {activeTab === Tab.INSCRITOS && <InscritosList />}
        {activeTab === Tab.MATCHES && <MatchTracker currentUser={currentUser} />}
        {activeTab === Tab.RANKING && <RankingTable />}
        {activeTab === Tab.MASTERS && <MastersLup isAdmin={currentUser.role === 'admin'} />}
        {activeTab === Tab.MEMBERS && currentUser.role === 'admin' && <MembersList currentUser={currentUser} />}
        {activeTab === Tab.ADMIN && <AdminPanel />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 z-20 pb-safe shadow-[0_-5px_10px_rgba(0,0,0,0.05)] overflow-x-auto">
        <div className="max-w-md mx-auto flex justify-between px-1">
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
           <NavButton 
            active={activeTab === Tab.MASTERS} 
            onClick={() => setActiveTab(Tab.MASTERS)}
            icon="👑"
            label="Masters"
          />
          {currentUser.role === 'admin' && (
            <NavButton 
                active={activeTab === Tab.MEMBERS} 
                onClick={() => setActiveTab(Tab.MEMBERS)}
                icon="👥"
                label="Membros"
            />
          )}
          <NavButton 
            active={activeTab === Tab.ADMIN} 
            onClick={() => setActiveTab(Tab.ADMIN)}
            icon="⚙️"
            label="Admin"
          />
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