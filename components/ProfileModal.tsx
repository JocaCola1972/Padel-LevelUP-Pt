
import React, { useState, useRef } from 'react';
import { Player } from '../types';
import { savePlayer, uploadAvatar } from '../services/storageService';
import { Button } from './Button';

interface ProfileModalProps {
  currentUser: Player;
  onClose: () => void;
  onUpdate: (updatedPlayer: Player) => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ currentUser, onClose, onUpdate, onLogout }) => {
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [photoUrl, setPhotoUrl] = useState(currentUser.photoUrl || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
          setError("Imagem demasiado grande (Máx 2MB).");
          return;
      }

      setIsUploading(true);
      setError('');
      try {
          // Upload para o bucket 'avatars' no Supabase Storage
          const publicUrl = await uploadAvatar(currentUser.id, file);
          setPhotoUrl(publicUrl);
          
          // Guarda imediatamente o URL na tabela players para persistência
          const updated = { ...currentUser, photoUrl: publicUrl };
          await savePlayer(updated);
          onUpdate(updated);
      } catch (err: any) {
          setError("Erro no upload: " + err.message);
      } finally {
          setIsUploading(false);
      }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updated = { ...currentUser, name, phone, photoUrl };
      await savePlayer(updated);
      onUpdate(updated);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto border-t-8 border-padel">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-gray-800 italic uppercase">O Meu Perfil</h3>
            <button onClick={onClose} className="text-gray-400 text-2xl hover:text-gray-600 transition-colors">&times;</button>
        </div>

        <div className="flex flex-col items-center mb-6">
            <div className="relative cursor-pointer group" onClick={() => !isUploading && fileInputRef.current?.click()}>
                <div className="w-28 h-28 rounded-full border-4 border-padel bg-gray-50 flex items-center justify-center overflow-hidden shadow-xl mb-2 relative">
                    {photoUrl ? (
                        <img src={photoUrl} alt="Perfil" className={`w-full h-full object-cover transition-opacity ${isUploading ? 'opacity-30' : 'opacity-100'}`} />
                    ) : (
                        <span className="text-4xl font-black text-padel-dark opacity-40">{currentUser.participantNumber}</span>
                    )}
                    
                    {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                            <div className="w-8 h-8 border-4 border-padel border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 font-bold text-xs uppercase bg-black/40 px-2 py-1 rounded-full">Alterar</span>
                    </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-padel text-white rounded-full p-2 shadow-lg border-2 border-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <div className="text-center">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mt-2">Nº de Jogador</p>
                <p className="text-lg font-black text-gray-800">#{currentUser.participantNumber}</p>
            </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-padel font-bold transition-all" placeholder="Nome" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Telemóvel</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-xl outline-none font-mono text-gray-500" placeholder="Telemóvel" disabled />
            <p className="text-[9px] text-gray-400 mt-1 ml-1">* O telemóvel é a sua identidade e não pode ser alterado.</p>
          </div>
          
          {error && (
            <div className="text-red-600 text-[11px] font-bold bg-red-50 p-3 rounded-lg border border-red-100 animate-slide-down">
                ⚠️ {error}
            </div>
          )}

          <div className="pt-2 space-y-3">
              <Button type="submit" className="w-full py-4 text-sm font-black uppercase tracking-widest shadow-lg" isLoading={isLoading}>
                  Guardar Alterações
              </Button>
              <Button variant="secondary" onClick={onLogout} className="w-full py-3 border-red-200 text-red-500 hover:bg-red-50">
                  Terminar Sessão
              </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
