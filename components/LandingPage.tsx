
import React from 'react';
import { Button } from './Button';
import { getAppState } from '../services/storageService';

interface LandingPageProps {
  onNavigate: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const state = getAppState();
  
  // Imagem base64 do logótipo carregado ou fallback
  const logoSrc = state.customLogo || 'https://raw.githubusercontent.com/fabiolb/padel-levelup/main/logo.png';

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 text-center animate-fade-in overflow-hidden">
      <div className="auth-bg"></div>
      <div className="auth-overlay"></div>
      
      {/* Logo Container Principal */}
      <div className="mb-10 transform hover:scale-105 transition-transform duration-700 flex flex-col items-center z-10">
        <div className="w-64 h-64 md:w-80 md:h-80 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(163,230,53,0.4)] mb-8 border-4 border-padel relative p-2">
            <img 
                src={logoSrc}
                alt="Padel LevelUp" 
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🎾</text></svg>';
                }}
            />
        </div>
        
        <h1 className="text-5xl md:text-6xl font-black italic text-white tracking-tighter drop-shadow-2xl transform -skew-x-6">
          <span className="text-padel-light">PADEL</span> LEVELUP
        </h1>
        <p className="text-white font-bold mt-4 text-xl tracking-widest uppercase bg-black/30 px-4 py-1 rounded-full backdrop-blur-sm">
          Entra Para Aprender e Fica para Ensinar
        </p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-4 z-10">
        <Button 
          onClick={() => onNavigate('login')}
          className="w-full py-4 text-xl bg-padel hover:bg-padel-light text-padel-blue font-black shadow-[0_10px_20px_rgba(0,0,0,0.3)] border-none transform transition hover:-translate-y-1"
        >
          LOGIN / ENTRAR
        </Button>
        
        <Button 
          onClick={() => onNavigate('register')}
          variant="secondary"
          className="w-full py-4 text-lg bg-white/10 backdrop-blur-md text-white border-2 border-white/50 font-bold shadow-lg transform transition hover:bg-white/20"
        >
          CRIAR FICHA DE JOGADOR
        </Button>
      </div>

      <footer className="mt-16 text-white/50 text-[10px] uppercase tracking-widest z-10">
        &copy; 2024 Padel LevelUp League • Todos os direitos reservados
      </footer>
    </div>
  );
};
