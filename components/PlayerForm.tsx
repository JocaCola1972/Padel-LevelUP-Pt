
import React, { useState } from 'react';
import { Player } from '../types';
import { savePlayer, getPlayerByPhone, generateUUID, requestPasswordReset, getAppState } from '../services/storageService';
import { Button } from './Button';

interface PlayerFormProps {
  initialMode: 'login' | 'register';
  onLogin: (player: Player) => void;
  onBack: () => void;
}

export const PlayerForm: React.FC<PlayerFormProps> = ({ initialMode, onLogin, onBack }) => {
  const state = getAppState();
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  
  // Login State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [tempPlayer, setTempPlayer] = useState<Player | null>(null);

  // Register State
  const [newName, setNewName] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const switchMode = (newMode: 'login' | 'register' | 'recover') => {
      setMode(newMode);
      setError('');
      setSuccess('');
      setRequirePassword(false);
      setPassword('');
  };

  const attemptLogin = (player: Player) => {
      if (player.isApproved === false) {
          setError('A tua conta ainda está a aguardar aprovação do administrador.');
          setRequirePassword(false);
          setTempPlayer(null);
          return;
      }
      onLogin(player);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!requirePassword) {
        const isSpecialAdmin = phone === "JocaCola";
        if (!isSpecialAdmin && phone.length < 9) {
            setError('Utilizador ou telemóvel inválido');
            return;
        }

        const existingPlayer = getPlayerByPhone(phone);
        if (existingPlayer) {
            if (existingPlayer.password) {
                setTempPlayer(existingPlayer);
                setRequirePassword(true);
            } else {
                attemptLogin(existingPlayer);
            }
        } else {
            setError('Utilizador não encontrado. Cria a tua ficha primeiro.');
        }
    } else {
        if (tempPlayer && tempPlayer.password === password) {
            attemptLogin(tempPlayer);
        } else {
            setError('Password incorreta.');
        }
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || phone.length < 9) {
      setError('Preenche todos os campos corretamente.');
      return;
    }

    const existingPlayer = getPlayerByPhone(phone);
    if (existingPlayer) {
      setError('Este número já está registado. Faz login.');
      return;
    }

    const newPlayer: Player = {
      id: generateUUID(),
      name: newName,
      phone,
      totalPoints: 0,
      gamesPlayed: 0,
      participantNumber: 0,
      isApproved: false
    };

    savePlayer(newPlayer);
    setSuccess('Ficha criada! Aguarda a aprovação para entrar.');
    setNewName('');
    setTimeout(() => switchMode('login'), 3000);
  };

  const handleRecoverSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      if (phone.length < 9) {
          setError('Telemóvel inválido.');
          return;
      }
      const sent = requestPasswordReset(phone);
      if (sent) {
          setSuccess('Pedido enviado ao Super Admin.');
      } else {
          setError('Número não encontrado.');
      }
  };

  const resetLogin = () => {
      setRequirePassword(false);
      setTempPlayer(null);
      setPassword('');
      setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative">
      <div className="auth-bg"></div>
      <div className="auth-overlay"></div>
      
      <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/40 relative">
        <button 
            onClick={() => {
                if (requirePassword) resetLogin();
                else if (mode === 'recover') switchMode('login');
                else onBack();
            }}
            className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors font-bold"
        >
            ← Voltar
        </button>

        <div className="text-center mb-6 mt-4 flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 border-2 border-padel p-1">
             <img src={state.customLogo || 'https://raw.githubusercontent.com/fabiolb/padel-levelup/main/logo.png'} alt="Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <h1 className="text-2xl font-black text-gray-800 mb-1 italic transform -skew-x-6">
            PADEL <span className="text-padel">LEVELUP</span>
          </h1>
          <p className="text-gray-500 font-medium text-xs uppercase tracking-widest">
            {mode === 'login' ? (requirePassword ? `Olá, ${tempPlayer?.name}` : 'Acesso à Liga') : 
             mode === 'register' ? 'Nova Ficha de Jogador' : 'Recuperar Acesso'}
          </p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {!requirePassword ? (
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Utilizador ou Telemóvel</label>
                    <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel focus:border-transparent outline-none transition-all font-mono text-lg"
                        placeholder="Ex: 912345678"
                        autoFocus
                        required
                    />
                </div>
            ) : (
                <div className="animate-slide-down">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel focus:border-transparent outline-none transition-all text-lg"
                        placeholder="••••••••"
                        autoFocus
                        required
                    />
                    <div className="mt-2 text-right">
                        <button type="button" onClick={resetLogin} className="text-[10px] text-blue-500 hover:underline font-bold uppercase">
                            Não sou o {tempPlayer?.name}?
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100 font-medium">{error}</p>}
            {success && <p className="text-green-600 text-xs bg-green-50 p-3 rounded-lg border border-green-100 font-bold">{success}</p>}
            
            <Button type="submit" className="w-full py-4 text-lg shadow-lg font-black italic transform hover:scale-105 active:scale-95 transition-transform">
                {requirePassword ? 'CONFIRMAR' : 'ENTRAR'}
            </Button>
            
            {!requirePassword && (
                <div className="space-y-3 text-center mt-6">
                    <p className="text-xs text-gray-500">
                        Ainda não tens ficha? <button type="button" onClick={() => switchMode('register')} className="text-padel-dark font-black hover:underline uppercase">Criar Agora</button>
                    </p>
                    <button type="button" onClick={() => switchMode('recover')} className="text-[10px] text-gray-400 hover:text-padel font-bold uppercase tracking-tighter">
                        Esqueci-me da Password
                    </button>
                </div>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nome Completo</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel outline-none transition-all"
                placeholder="Ex: João Silva"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Telemóvel</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel outline-none transition-all font-mono text-lg"
                placeholder="912345678"
                required
              />
            </div>
            {error && <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100 font-medium">{error}</p>}
            {success && <p className="text-green-600 text-xs bg-green-50 p-3 rounded-lg border border-green-100 font-bold">{success}</p>}
            
            <Button type="submit" className="w-full py-4 text-lg font-black italic">CRIAR FICHA</Button>
            
            <p className="text-center text-xs text-gray-500 mt-6">
              Já tens conta? <button type="button" onClick={() => switchMode('login')} className="text-padel-dark font-black hover:underline uppercase">Fazer Login</button>
            </p>
          </form>
        )}

        {mode === 'recover' && (
            <form onSubmit={handleRecoverSubmit} className="space-y-4">
                <div className="text-center p-3 bg-blue-50 text-blue-800 text-[11px] font-medium rounded-lg mb-4 border border-blue-100">
                    Insere o teu telemóvel para pedir um reset de password ao administrador.
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Telemóvel</label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel outline-none transition-all font-mono text-lg"
                        placeholder="912345678"
                        required
                    />
                </div>
                
                {error && <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100 font-medium">{error}</p>}
                {success && <p className="text-green-600 text-xs bg-green-50 p-3 rounded-lg border border-green-100 font-bold">{success}</p>}

                <Button type="submit" className="w-full py-4 text-lg font-black italic" disabled={!!success}>
                    PEDIR RESET
                </Button>

                <p className="text-center text-xs text-gray-500 mt-6">
                    <button type="button" onClick={() => switchMode('login')} className="text-padel-dark font-black hover:underline uppercase">Voltar</button>
                </p>
            </form>
        )}
      </div>
    </div>
  );
};
