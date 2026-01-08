
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
  const [error, setError] = useState<React.ReactNode>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signIn(phone, password);
      // O App.tsx deteta a mudança de sessão automaticamente
    } catch (err: any) {
      if (err.message === "Invalid login credentials") {
        setError("Credenciais inválidas. Verifica o número e a password.");
      } else if (err.message?.toLowerCase().includes("email not confirmed")) {
        setError(
          <div className="space-y-2">
            <p className="font-bold">Email não confirmado!</p>
            <p className="text-[10px] leading-tight">
              O Administrador precisa de desativar a opção <strong>"Confirm Email"</strong> nas definições de Autenticação do Supabase Dashboard para permitir o acesso.
            </p>
          </div>
        );
      } else {
        setError(err.message || "Erro ao entrar. Tenta novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newName || phone.length < 9) {
      setError("Preencha todos os campos corretamente.");
      return;
    }
    setIsLoading(true);
    try {
      await signUp(newName, phone, password);
      alert("Ficha criada com sucesso! Se o Administrador já desativou a confirmação de email, podes entrar agora.");
      setMode('login');
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta.");
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
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 border-2 border-padel p-1 overflow-hidden">
             <img 
               src={state.customLogo || 'https://raw.githubusercontent.com/fabiolb/padel-levelup/main/logo.png'} 
               alt="Logo" 
               className="w-full h-full object-contain" 
               onError={(e) => (e.currentTarget.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🎾</text></svg>')}
             />
          </div>
          <h1 className="text-2xl font-black text-gray-800 italic transform -skew-x-6">Padel <span className="text-padel">LevelUP</span></h1>
          <p className="text-gray-500 font-medium text-[10px] uppercase tracking-widest">{mode === 'login' ? 'Acesso Seguro' : 'Nova Ficha de Jogador'}</p>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Nome Completo</label>
              <input 
                type="text" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-padel transition-all" 
                placeholder="Ex: João Silva" 
                required 
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Telemóvel</label>
            <input 
              type="tel" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full p-4 bg-gray-50 border rounded-xl font-mono text-lg outline-none focus:ring-2 focus:ring-padel transition-all" 
              placeholder="912345678" 
              required 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-padel transition-all" 
              placeholder="••••••••" 
              required 
            />
          </div>

          {error && (
            <div className="text-red-600 text-xs bg-red-50 p-4 rounded-xl border border-red-100 animate-slide-down">
              {error}
            </div>
          )}
          
          <Button type="submit" className="w-full py-4 text-lg font-black italic shadow-lg" isLoading={isLoading}>
              {mode === 'login' ? 'ENTRAR AGORA' : 'CRIAR MINHA FICHA'}
          </Button>
          
          <div className="text-center mt-6">
            <button 
              type="button" 
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }} 
              className="text-padel font-black hover:text-padel-dark transition-colors uppercase text-xs tracking-tight underline underline-offset-4"
            >
                {mode === 'login' ? 'Ainda não tenho conta? Criar Ficha' : 'Já tenho conta? Ir para Login'}
            </button>
          </div>
        </form>
      </div>
      
      <p className="fixed bottom-6 text-white/30 text-[10px] font-bold uppercase tracking-[0.3em]">
        Padel LevelUp Security System
      </p>
    </div>
  );
};
