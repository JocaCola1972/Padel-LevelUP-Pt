
import React, { useEffect, useState } from 'react';
import { Player, Message } from '../types';
import { getMessagesForUser, markMessageAsRead, deleteMessageForUser, deleteAllMessagesForUser } from '../services/storageService';
import { Button } from './Button';

interface NotificationModalProps {
    currentUser: Player;
    onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ currentUser, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);

    const loadMessages = () => {
        const msgs = getMessagesForUser(currentUser.id);
        setMessages(msgs);
    };

    useEffect(() => {
        loadMessages();
        
        // Mark all displayed messages as read after a short delay
        const timer = setTimeout(() => {
            const msgs = getMessagesForUser(currentUser.id);
            // Fix: markMessageAsRead only accepts 1 argument
            msgs.forEach(m => markMessageAsRead(m.id));
        }, 1000);

        return () => clearTimeout(timer);
    }, [currentUser.id]);

    const handleDelete = async (messageId: string) => {
        if (window.confirm('Desejas apagar esta mensagem?')) {
            // Fix: deleteMessageForUser only accepts 1 argument
            await deleteMessageForUser(messageId);
            loadMessages();
        }
    };

    const handleDeleteAll = async () => {
        if (window.confirm('Tens a certeza que desejas apagar TODAS as mensagens?')) {
            await deleteAllMessagesForUser(currentUser.id);
            loadMessages();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="text-lg font-bold text-gray-800">📬 Notificações</h3>
                    <div className="flex items-center gap-4">
                        {messages.length > 0 && (
                            <button 
                                onClick={handleDeleteAll}
                                className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest bg-red-50 px-2 py-1 rounded border border-red-100"
                            >
                                Apagar Tudo
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-2xl leading-none">&times;</button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 italic">
                            Não tens novas mensagens.
                        </div>
                    ) : (
                        messages.map(msg => {
                            const isSystem = msg.senderId === 'SYSTEM';
                            return (
                                <div key={msg.id} className={`border shadow-sm rounded-lg p-3 group relative transition-all ${isSystem ? 'bg-yellow-50 border-yellow-200 ring-1 ring-yellow-400/20' : 'bg-white border-gray-100 hover:border-padel-light/50'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-1">
                                            <span className={`text-xs font-black ${isSystem ? 'text-yellow-700' : 'text-padel-blue'}`}>
                                                {msg.senderId === currentUser.id ? 'Eu' : msg.senderName}
                                            </span>
                                            {msg.receiverId === 'ALL' && <span className="bg-purple-100 text-purple-700 px-1 rounded text-[9px] font-black uppercase">Broadcast</span>}
                                            {isSystem && <span className="bg-yellow-400 text-yellow-900 px-1 rounded text-[9px] font-black uppercase animate-pulse">Urgente</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(msg.timestamp).toLocaleDateString()} {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            <button 
                                                onClick={() => handleDelete(msg.id)}
                                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                title="Apagar mensagem"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    <p className={`text-sm whitespace-pre-wrap ${isSystem ? 'text-yellow-900 font-medium' : 'text-gray-700'}`}>{msg.content}</p>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                    <Button onClick={onClose} className="w-full">Fechar</Button>
                </div>
            </div>
        </div>
    );
};
