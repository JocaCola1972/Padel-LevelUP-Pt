import React, { useState, useRef } from 'react';
import { Player } from '../types';
import { savePlayer, removePlayer } from '../services/storageService';
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Limit size (approx 2MB)
      if (file.size > 2 * 1024 * 1024) {
          setError("A imagem é demasiado grande. Máximo 2MB.");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.length < 9) {
      setError('Por favor preencha os campos corretamente.');
      return;
    }

    try {
      const updatedPlayer: Player = {
        ...currentUser,
        name,
        phone,
        photoUrl: photoUrl || undefined
      };

      savePlayer(updatedPlayer);
      onUpdate(updatedPlayer);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao gravar alterações.');
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('⚠️ TEM A CERTEZA? \n\nIsto irá apagar permanentemente a sua conta e todas as suas inscrições futuras. Esta ação não pode ser revertida.')) {
      removePlayer(currentUser.id);
      onLogout();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border-2 border-white/50 max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-gray-800 italic transform -skew-x-3">O Meu Perfil</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
        </div>

        <div className="flex flex-col items-center mb-6">
            <div 
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="w-24 h-24 rounded-full border-4 border-padel bg-gray-100 flex items-center justify-center overflow-hidden shadow-lg mb-2 relative">
                    {photoUrl ? (
                        <img src={photoUrl} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-3xl font-bold text-padel">{currentUser.participantNumber}</span>
                    )}
                    
                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold">Alterar</span>
                    </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-gray-100">
                    <span className="text-lg">📷</span>
                </div>
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
            />

            {photoUrl && (
                <button 
                    onClick={() => setPhotoUrl('')} 
                    className="text-xs text-red-400 hover:text-red-600 mb-1"
                >
                    Remover foto
                </button>
            )}

            <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Participante Nº {currentUser.participantNumber}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 ml-1">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 ml-1">Telemóvel</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-padel outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-xs bg-red-50 p-2 rounded">{error}</p>}

          <div className="pt-2">
            <Button type="submit" className="w-full py-3">Gravar Alterações</Button>
          </div>
        </form>

        <div className="border-t border-gray-100 mt-6 pt-4 space-y-3">
            <Button variant="secondary" onClick={onLogout} className="w-full text-sm">
                Terminar Sessão
            </Button>
            
            <button 
                onClick={handleDeleteAccount}
                className="w-full text-xs text-red-400 hover:text-red-600 hover:underline py-2"
            >
                Apagar a minha conta
            </button>
        </div>

      </div>
    </div>
  );
};