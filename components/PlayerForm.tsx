
import React, { useState } from 'react';
import { Player } from '../types';
import { savePlayer, getPlayerByPhone, generateUUID, requestPasswordReset } from '../services/storageService';
import { Button } from './Button';

interface PlayerFormProps {
  initialMode: 'login' | 'register';
  onLogin: (player: Player) => void;
  onBack: () => void;
}

export const PlayerForm: React.FC<PlayerFormProps> = ({ initialMode, onLogin, onBack }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  
  // Login State
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [requirePassword, setRequirePassword] = useState(false); // If true, shows password input
  const [tempPlayer, setTempPlayer] = useState<Player | null>(null); // Stores player while waiting for password

  // Register State
  const [newName, setNewName] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Mode switching logic (wrappers to clear errors)
  const switchMode = (newMode: 'login' | 'register' | 'recover') => {
      setMode(newMode);
      setError('');
      setSuccess('');
      setRequirePassword(false);
      setPassword('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Step 1: Check Phone
    if (!requirePassword) {
        if (phone.length < 9) {
            setError('Número de telemóvel inválido');
            return;
        }

        const existingPlayer = getPlayerByPhone(phone);
        if (existingPlayer) {
            // Check if player has password
            if (existingPlayer.password) {
                setTempPlayer(existingPlayer);
                setRequirePassword(true);
            } else {
                // No password set, login directly
                onLogin(existingPlayer);
            }
        } else {
            setError('Número não encontrado. Por favor cria a tua ficha primeiro.');
        }
    } 
    // Step 2: Check Password
    else {
        if (tempPlayer && tempPlayer.password === password) {
            onLogin(tempPlayer);
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
      setError('Este número já está registado. Por favor faz login.');
      return;
    }

    const newPlayer: Player = {
      id: generateUUID(),
      name: newName,
      phone,
      totalPoints: 0,
      gamesPlayed: 0,
      participantNumber: 0 // Will be assigned in savePlayer
    };

    savePlayer(newPlayer);
    // Retrieve again to get the assigned number
    const saved = getPlayerByPhone(phone);
    if (saved) onLogin(saved);
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
          setSuccess('Pedido enviado ao Super Admin. Aguarda notificação.');
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
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white/95 backdrop-blur p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/40 relative">
        <button 
            onClick={() => {
                if (requirePassword) {
                    resetLogin();
                } else if (mode === 'recover') {
                    switchMode('login');
                } else {
                    onBack();
                }
            }}
            className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
            ← Voltar
        </button>

        <div className="text-center mb-8 mt-4">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-padel-dark to-padel-blue mb-1 italic transform -skew-x-6">
            Padel LevelUp
          </h1>
          <p className="text-gray-500 font-medium text-sm">
            {mode === 'login' ? (requirePassword ? `Olá, ${tempPlayer?.name}` : 'Bem-vindo de volta!') : 
             mode === 'register' ? 'Cria a tua ficha de jogador' : 'Recuperar Password'}
          </p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {!requirePassword ? (
                /* Step 1: Phone */
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Telemóvel</label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel focus:border-transparent outline-none transition-all font-mono text-lg"
                        placeholder="912345678"
                        autoFocus
                        required
                    />
                </div>
            ) : (
                /* Step 2: Password */
                <div className="animate-slide-down">
                    <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel focus:border-transparent outline-none transition-all text-lg"
                        placeholder="Insere a tua password"
                        autoFocus
                        required
                    />
                    <div className="mt-2 text-right">
                        <button type="button" onClick={resetLogin} className="text-xs text-blue-500 hover:underline">
                            Não sou o {tempPlayer?.name}
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
            
            <Button type="submit" className="w-full py-3 text-lg shadow-lg">
                {requirePassword ? 'Confirmar Password' : 'Entrar'}
            </Button>
            
            {!requirePassword && (
                <div className="space-y-2 text-center mt-4">
                    <p className="text-sm text-gray-500">
                        Ainda não tens conta? <button type="button" onClick={() => switchMode('register')} className="text-padel-dark font-bold hover:underline">Criar Ficha</button>
                    </p>
                    <button type="button" onClick={() => switchMode('recover')} className="text-xs text-gray-400 hover:text-padel hover:underline">
                        Esqueci-me da Password
                    </button>
                </div>
            )}
            
            {requirePassword && (
                <div className="text-center mt-4">
                    <button type="button" onClick={() => switchMode('recover')} className="text-xs text-gray-400 hover:text-padel hover:underline">
                        Esqueci-me da Password
                    </button>
                </div>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Nome Completo</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel focus:border-transparent outline-none transition-all"
                placeholder="Ex: João Silva"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Telemóvel</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel focus:border-transparent outline-none transition-all font-mono text-lg"
                placeholder="912345678"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
            
            <Button type="submit" className="w-full py-3 text-lg shadow-lg">Criar Ficha e Entrar</Button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              Já tens conta? <button type="button" onClick={() => switchMode('login')} className="text-padel-dark font-bold hover:underline">Entrar</button>
            </p>
          </form>
        )}

        {mode === 'recover' && (
            <form onSubmit={handleRecoverSubmit} className="space-y-5">
                <div className="text-center p-2 bg-blue-50 text-blue-800 text-sm rounded-lg mb-4">
                    Insere o teu telemóvel para pedir uma renovação de password ao Super Admin.
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Telemóvel</label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel focus:border-transparent outline-none transition-all font-mono text-lg"
                        placeholder="912345678"
                        required
                    />
                </div>
                
                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
                {success && <p className="text-green-600 text-sm bg-green-50 p-2 rounded font-bold">{success}</p>}

                <Button type="submit" className="w-full py-3 text-lg shadow-lg" disabled={!!success}>
                    Enviar Pedido
                </Button>

                <p className="text-center text-sm text-gray-500 mt-4">
                    <button type="button" onClick={() => switchMode('login')} className="text-padel-dark font-bold hover:underline">Voltar ao Login</button>
                </p>
            </form>
        )}
      </div>
    </div>
  );
};
