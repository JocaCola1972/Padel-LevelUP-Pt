
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
          setError("Imagem demasiado grande (Máx 2MB).");
          return;
      }

      setIsLoading(true);
      try {
          const url = await uploadAvatar(currentUser.id, file);
          setPhotoUrl(url);
          const updated = { ...currentUser, photoUrl: url };
          await savePlayer(updated);
          onUpdate(updated);
      } catch (err: any) {
          setError("Erro no upload: " + err.message);
      } finally {
          setIsLoading(false);
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
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-gray-800 italic">O Meu Perfil</h3>
            <button onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
        </div>

        <div className="flex flex-col items-center mb-6">
            <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 rounded-full border-4 border-padel bg-gray-100 flex items-center justify-center overflow-hidden shadow-lg mb-2">
                    {photoUrl ? <img src={photoUrl} alt="Perfil" className="w-full h-full object-cover" /> : <span className="text-3xl font-bold text-padel">{currentUser.participantNumber}</span>}
                    {isLoading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                </div>
                <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow border">📷</div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-2">ID #{currentUser.participantNumber}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none" placeholder="Nome" />
          <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-mono" placeholder="Telemóvel" />
          {error && <p className="text-red-500 text-xs bg-red-50 p-2 rounded">{error}</p>}
          <Button type="submit" className="w-full py-3" isLoading={isLoading}>Gravar</Button>
          <Button variant="secondary" onClick={onLogout} className="w-full">Sair</Button>
        </form>
      </div>
    </div>
  );
};
