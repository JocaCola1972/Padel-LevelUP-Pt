
import React from 'react';
import { getAppState } from '../services/storageService';

export const LevelUpInfo: React.FC = () => {
    const state = getAppState();

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl shadow-xl bg-gradient-to-br from-padel-dark via-padel-blue to-black text-white p-6 min-h-[220px] flex items-center">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 w-full">
                    {/* Logotipo da APP */}
                    <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl border-2 border-padel-light p-2 flex-shrink-0">
                        <img 
                            src={state.customLogo || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🎾</text></svg>'} 
                            alt="Padel LevelUp Logo" 
                            className="w-full h-full object-contain rounded-full"
                        />
                    </div>

                    <div className="text-center md:text-left">
                        <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter mb-2 transform -skew-x-6">
                            PADEL <span className="text-padel-light">LEVELUP</span>
                        </h2>
                        <p className="text-blue-100 text-sm font-medium leading-relaxed max-w-xs">
                            Entra Para Aprender e Fica para Ensinar
                        </p>
                    </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-9xl">🎾</span>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-padel-light/20 rounded-full blur-3xl"></div>
            </div>

            {/* Content Cards */}
            <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
                    <div className="w-12 h-12 bg-padel/10 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                        📈
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 mb-1">Formato Sobe e Desce</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Joga contra adversários do teu nível. Ganha para subir de campo, perde e luta para voltar ao topo. Dinamismo puro em cada domingo.
                        </p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                        🤝
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 mb-1">Comunidade e Convívio</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Mais do que um torneio, o LevelUP é o ponto de encontro dos Earlybirds e do Breakfast Club. Padel com amigos e novas parcerias.
                        </p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
                    <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                        ⭐
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 mb-1">O Nosso Compromisso</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Gestão profissional, rankings atualizados em tempo real e uma experiência premium para todos os participantes.
                        </p>
                    </div>
                </div>
            </div>

            {/* Social / Branding */}
            <div className="text-center pt-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
                <div className="flex justify-center items-center gap-2 mb-2">
                    <span className="h-px w-8 bg-gray-300"></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">LevelUp Padel League</span>
                    <span className="h-px w-8 bg-gray-300"></span>
                </div>
                <p className="text-[10px] text-gray-400">Powered by Padel LevelUp Tech 2024</p>
            </div>
        </div>
    );
};
