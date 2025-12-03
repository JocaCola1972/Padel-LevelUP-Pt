import React, { useState } from 'react';
import { Button } from './Button';
import { getAppState } from '../services/storageService';

interface LandingPageProps {
  onNavigate: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const state = getAppState();
  const logoSrc = state.customLogo || '/logo.png';
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-black/40 to-black/70 text-center animate-fade-in">
      
      {/* Logo Container */}
      <div className="mb-8 transform hover:scale-105 transition-transform duration-500 flex flex-col items-center">
        {/* Container circular com fundo branco e padding para criar efeito de moldura */}
        <div className="w-72 h-72 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(163,230,53,0.6)] mb-6 border-4 border-padel relative overflow-hidden group p-1">
            {!imgError ? (
                <img 
                    src={logoSrc}
                    alt="Padel LevelUp Logo" 
                    className="w-full h-full object-contain rounded-full p-4"
                    onError={() => setImgError(true)}
                />
            ) : (
                // Fallback Logo (SVG) se a imagem não existir
                <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-padel-dark to-padel rounded-full text-white">
                    <svg className="w-32 h-32 mb-2 drop-shadow-md" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2ZM10 9C10 7.9 10.9 7 12 7C13.1 7 14 7.9 14 9H10ZM12 22C11.45 22 11 21.55 11 21V19H13V21C13 21.55 12.55 22 12 22Z" fill="currentColor"/>
                        <path d="M7 9C7 9 7 11 9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="text-3xl font-black italic tracking-tighter transform -skew-x-6">LevelUp</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-80 mt-1">Padel League</span>
                </div>
            )}
        </div>
        
        <h1 className="text-5xl font-black italic text-white tracking-tighter drop-shadow-lg transform -skew-x-6">
          <span className="text-padel-light">Padel</span> LevelUp
        </h1>
        <p className="text-white/90 font-medium mt-2 text-lg tracking-widest uppercase text-shadow-sm">Liga Sobe e Desce</p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-4">
        <Button 
          onClick={() => onNavigate('login')}
          className="w-full py-4 text-lg bg-padel hover:bg-padel-light text-padel-blue font-bold shadow-[0_0_20px_rgba(163,230,53,0.4)] border-none transform transition hover:-translate-y-1"
        >
          Entrar / Inscrever em Turno
        </Button>
        
        <Button 
          onClick={() => onNavigate('register')}
          variant="secondary"
          className="w-full py-4 text-lg bg-white/90 backdrop-blur text-gray-800 border-none font-bold shadow-lg transform transition hover:-translate-y-1"
        >
          Criar Ficha de Jogador
        </Button>
      </div>

      <footer className="mt-12 text-white/60 text-xs">
        <p>&copy; 2024 Padel LevelUp. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};