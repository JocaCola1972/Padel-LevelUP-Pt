
import React, { useEffect, useState } from 'react';
import { Player, Message } from '../types';
import { getMessagesForUser, markMessageAsRead } from '../services/storageService';
import { Button } from './Button';

interface NotificationModalProps {
    currentUser: Player;
    onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ currentUser, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        const msgs = getMessagesForUser(currentUser.id);
        setMessages(msgs);
        
        // Mark all displayed messages as read after a short delay
        const timer = setTimeout(() => {
            msgs.forEach(m => markMessageAsRead(m.id, currentUser.id));
        }, 1000);

        return () => clearTimeout(timer);
    }, [currentUser.id]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="text-lg font-bold text-gray-800">📬 Notificações</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">&times;</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 italic">
                            Não tens novas mensagens.
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div key={msg.id} className="bg-white border border-gray-100 shadow-sm rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-padel-blue">
                                        {msg.senderId === currentUser.id ? 'Eu' : msg.senderName}
                                        {msg.receiverId === 'ALL' && <span className="ml-1 bg-purple-100 text-purple-700 px-1 rounded text-[9px]">BROADCAST</span>}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(msg.timestamp).toLocaleDateString()} {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                    <Button onClick={onClose} className="w-full">Fechar</Button>
                </div>
            </div>
        </div>
    );
};
