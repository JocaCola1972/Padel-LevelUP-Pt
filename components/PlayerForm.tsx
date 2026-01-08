
import React, { useState } from 'react';
import { signUp, signIn, getAppState } from '../services/storageService';
import { Button } from './Button';

interface PlayerFormProps {
  initialMode: 'login' | 'register';
  onBack: () => void;
}

export const PlayerForm: React.FC<PlayerFormProps> = ({ initialMode, onBack }) => {
  const state = getAppState();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
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
    } catch (err: any) {
      if (err.message === "Invalid login credentials") {
        setError("As credenciais não coincidem. Verifica o número e a password.");
      } else if (err.message?.toLowerCase().includes("email not confirmed")) {
        setError(
          <div className="space-y-2">
            <p className="font-bold text-red-700">Acesso Restrito Temporariamente!</p>
            <p className="text-[10px] leading-tight text-red-600 font-medium">
              O Administrador ainda não configurou a confirmação automática no Supabase. 
              Por favor, informe o responsável para desativar <strong>"Confirm Email"</strong> no Dashboard do Supabase.
            </p>
          </div>
        );
      } else {
        setError(err.message || "Erro de ligação ao sistema. Tente mais tarde.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPhone = phone.trim().replace(/\s/g, '');
    if (!newName || cleanPhone.length < 9) {
      setError("Insira um nome válido e pelo menos 9 dígitos no telemóvel.");
      return;
    }
    setIsLoading(true);
    try {
      await signUp(newName, cleanPhone, password);
      alert("Ficha criada com sucesso! Aguarda a aprovação do administrador para entrar.");
      setMode('login');
    } catch (err: any) {
      if (err.message?.includes("User already registered")) {
        setError("Este número de telemóvel já tem uma ficha associada.");
      } else {
        setError(err.message || "Erro ao criar conta.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative">
      <div className="auth-bg"></div>
      <div 
        className="auth-overlay" 
        style={state.loginBackground ? { backgroundImage: `url(${state.loginBackground})`, opacity: 0.15 } : {}}
      ></div>
      
      <div className="bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-padel"></div>
        <button onClick={onBack} className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 font-black transition-colors">← VOLTAR</button>

        <div className="text-center mb-10 mt-6 flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-4 border-4 border-padel p-1.5 overflow-hidden transition-transform hover:scale-105 duration-500">
             <img 
               src={state.customLogo || 'https://raw.githubusercontent.com/fabiolb/padel-levelup/main/logo.png'} 
               alt="Logo" 
               className="w-full h-full object-contain rounded-full" 
               onError={(e) => (e.currentTarget.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>?️</text></svg>')}
             />
          </div>
          <h1 className="text-3xl font-black text-gray-800 italic transform -skew-x-6 tracking-tighter">
            Padel <span className="text-padel">LevelUP</span>
          </h1>
          <div className="h-1 w-12 bg-padel/30 rounded-full mt-2"></div>
          <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.4em] mt-3">
            {mode === 'login' ? 'Autenticação' : 'Registo de Jogador'}
          </p>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-5">
          {mode === 'register' && (
            <div className="animate-slide-down">
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1 tracking-widest">Nome Completo</label>
              <input 
                type="text" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-padel font-bold transition-all text-gray-800" 
                placeholder="Ex: João Ferreira" 
                required 
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1 tracking-widest">Telemóvel</label>
            <input 
              type="tel" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-mono text-xl outline-none focus:ring-2 focus:ring-padel transition-all text-gray-700" 
              placeholder="9xx xxx xxx" 
              required 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 ml-1 tracking-widest">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-padel transition-all font-mono" 
              placeholder="••••••••" 
              required 
            />
          </div>

          {error && (
            <div className="text-red-700 text-xs font-bold bg-red-50 p-4 rounded-2xl border border-red-100 animate-slide-down shadow-sm">
              {error}
            </div>
          )}
          
          <div className="pt-2">
              <Button type="submit" className="w-full py-5 text-lg font-black italic tracking-widest shadow-xl transform active:scale-95 transition-transform" isLoading={isLoading}>
                  {mode === 'login' ? 'ENTRAR NO CLUB' : 'CRIAR MINHA FICHA'}
              </Button>
          </div>
          
          <div className="text-center mt-8">
            <button 
              type="button" 
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }} 
              className="group text-gray-400 font-bold transition-colors uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 mx-auto"
            >
                {mode === 'login' ? (
                    <>Ainda não tens conta? <span className="text-padel group-hover:underline">Regista-te Aqui</span></>
                ) : (
                    <>Já tens uma ficha? <span className="text-padel group-hover:underline">Faz o Login</span></>
                )}
            </button>
          </div>
        </form>
      </div>
      
      <p className="fixed bottom-8 text-white/20 text-[9px] font-black uppercase tracking-[0.5em] select-none pointer-events-none">
        Padel LevelUp Security Layer v2.0
      </p>
    </div>
  );
};
