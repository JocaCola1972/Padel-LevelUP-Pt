import React, { useState } from 'react';
import { Player } from '../types';
import { savePlayer, getPlayerByPhone, generateUUID } from '../services/storageService';
import { Button } from './Button';

interface PlayerFormProps {
  initialMode: 'login' | 'register';
  onLogin: (player: Player) => void;
  onBack: () => void;
}

export const PlayerForm: React.FC<PlayerFormProps> = ({ initialMode, onLogin, onBack }) => {
  // If mode is register, we start at 'details' step but need phone first? 
  // Actually, for consistency, let's keep the flow simple:
  // Login: Phone -> Check -> Login
  // Register: Phone -> Check (if exists error) -> Details -> Register
  
  // However, the prompt asks for specific flows. 
  // If 'register', we explicitly show the registration form (Name + Phone).
  // If 'login', we just ask for Phone.
  
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 9) {
      setError('Número de telemóvel inválido');
      return;
    }

    const existingPlayer = getPlayerByPhone(phone);
    if (existingPlayer) {
      onLogin(existingPlayer);
    } else {
      setError('Número não encontrado. Por favor cria a tua ficha primeiro.');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.length < 9) {
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
      name,
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white/95 backdrop-blur p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/40 relative">
        <button 
            onClick={onBack}
            className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
            ← Voltar
        </button>

        <div className="text-center mb-8 mt-4">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-padel-dark to-padel-blue mb-1 italic transform -skew-x-6">
            Padel LevelUp
          </h1>
          <p className="text-gray-500 font-medium text-sm">
            {mode === 'login' ? 'Bem-vindo de volta!' : 'Cria a tua ficha de jogador'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-5">
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
            {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
            
            <Button type="submit" className="w-full py-3 text-lg shadow-lg">Entrar</Button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              Ainda não tens conta? <button type="button" onClick={() => {setMode('register'); setError('')}} className="text-padel-dark font-bold hover:underline">Criar Ficha</button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              Já tens conta? <button type="button" onClick={() => {setMode('login'); setError('')}} className="text-padel-dark font-bold hover:underline">Entrar</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};