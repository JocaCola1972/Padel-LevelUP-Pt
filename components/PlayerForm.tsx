
import React, { useState } from 'react';
import { Player } from '../types';
import { signUp, signIn, getAppState } from '../services/storageService';
import { Button } from './Button';

interface PlayerFormProps {
  initialMode: 'login' | 'register';
  onBack: () => void;
}

export const PlayerForm: React.FC<PlayerFormProps> = ({ initialMode, onBack }) => {
  const state = getAppState();
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(initialMode);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signIn(phone, password);
      // O App.tsx deteta a mudança de sessão automaticamente
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "Credenciais inválidas." : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newName || phone.length < 9) {
      setError("Preencha todos os campos.");
      return;
    }
    setIsLoading(true);
    try {
      await signUp(newName, phone, password);
      alert("Ficha criada! Aguarda aprovação do administrador.");
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative">
      <div className="auth-bg"></div>
      <div className="auth-overlay"></div>
      
      <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 relative">
        <button onClick={onBack} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 font-bold">← Voltar</button>

        <div className="text-center mb-6 mt-4 flex flex-col items-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 border-2 border-padel p-1">
             <img src={state.customLogo || 'https://raw.githubusercontent.com/fabiolb/padel-levelup/main/logo.png'} alt="Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <h1 className="text-2xl font-black text-gray-800 italic transform -skew-x-6">Padel <span className="text-padel">LevelUP</span></h1>
          <p className="text-gray-500 font-medium text-[10px] uppercase tracking-widest">{mode === 'login' ? 'Acesso Seguro' : 'Nova Ficha'}</p>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Nome Completo</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl outline-none" placeholder="João Silva" required />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Telemóvel</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl font-mono text-lg" placeholder="912345678" required />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl" placeholder="••••••••" required />
          </div>

          {error && <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
          
          <Button type="submit" className="w-full py-4 text-lg font-black italic" isLoading={isLoading}>
              {mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
          </Button>
          
          <div className="text-center mt-6">
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-padel font-black hover:underline uppercase text-xs">
                {mode === 'login' ? 'Ainda não tenho ficha' : 'Já tenho conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
