
import React, { useState } from 'react';
import { getAppState } from '../services/storageService';

export const LevelUpInfo: React.FC = () => {
    const state = getAppState();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isGdprExpanded, setIsGdprExpanded] = useState(false);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl shadow-xl bg-gradient-to-br from-padel-dark via-padel-blue to-black text-white p-6 min-h-[220px] flex items-center border-b-4 border-padel">
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
                        <h3 className="font-bold text-gray-800 mb-1 uppercase text-sm tracking-wide">DESAFIA OS TEUS LIMITES</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Joga contra adversários do teu nível. Ganha para subir de nível, perde e luta para voltar ao topo. Dinamismo puro em cada domingo
                        </p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                        🤝
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 mb-1 uppercase text-sm tracking-wide">Comunidade e Convívio</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Mais do que um torneio ou um “Mix” o LevelUP é o ponto de encontro de amigos e novas parcerias.
                        </p>
                    </div>
                </div>

                {/* HISTÓRIA E COMPROMISSO - COLLAPSIBLE CARD */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col overflow-hidden transition-all duration-300">
                    {/* Header/Trigger */}
                    <div 
                        className="p-6 pb-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 border border-yellow-100">
                                ⭐
                            </div>
                            <h3 className="font-black text-gray-800 uppercase text-sm tracking-wide">LEVELUP – Muito mais do que Padel!</h3>
                        </div>
                        <div className={`text-xl text-gray-400 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    
                    {/* Content Body */}
                    <div className="px-6 pb-6 text-xs text-gray-600 leading-relaxed text-justify">
                        {/* Always Visible Part */}
                        <p className="font-medium text-gray-700">
                            O LevelUP nasceu da vontade de duas pessoas com um objetivo simples: fazer bem e fazer melhor.
                        </p>

                        {/* Collapsible Wrapper */}
                        <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden space-y-4">
                                <p>
                                    O que começou como uma brincadeira entre amigos transformou-se numa experiência única, feita de alegria, partilha e paixão pelo Padel.
                                    Falámos da nossa experiência, despertámos curiosidade e, num instante, estávamos a dar mini-aulas sobre “O que é isto do Padel?” e a ensinar como se joga. Não porque soubéssemos tudo, mas porque o entusiasmo era contagiante. Assim, nasceu uma legião de fantásticos seguidores.
                                </p>
                                <p>
                                    Em 10 de dezembro de 2017, criámos o grupo LevelUP – um espaço para quem gosta e para quem quer gostar deste desporto.
                                    “LevelUP” significa subir de nível, aumentar tudo o que é bom no Padel. É isso que fazemos: crescer juntos, com saúde, amizade e diversão.
                                </p>

                                <div className="bg-padel/5 border-l-4 border-padel p-4 rounded-r-lg my-6">
                                    <p className="text-sm font-black text-padel-dark italic text-center italic tracking-tight">
                                        “Entra com vontade de aprender e fica com vontade de ensinar.”
                                    </p>
                                </div>

                                <p>
                                    Sobrevivemos a uma pandemia, mantivemos a comunidade ativa online, promovemos exercício em casa e continuámos unidos. Hoje, somos responsáveis por tirar centenas de pessoas do sedentarismo, criar amizades, parcerias e uma verdadeira rede saudável.
                                </p>

                                <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
                                    <p className="font-bold text-gray-700 mb-2 uppercase tracking-tighter text-[10px]">Mas não ficamos por aqui:</p>
                                    <ul className="space-y-1.5 ml-1">
                                        <li className="flex items-center gap-2 font-medium">
                                            <span className="text-padel">✔</span> Formação para todos os níveis
                                        </li>
                                        <li className="flex items-center gap-2 font-medium">
                                            <span className="text-padel">✔</span> Jogos adaptados e competições sazonais
                                        </li>
                                        <li className="flex items-center gap-2 font-medium">
                                            <span className="text-padel">✔</span> Almoços, jantares e dias especiais
                                        </li>
                                        <li className="flex items-center gap-2 font-medium">
                                            <span className="text-padel">✔</span> Até recriamos “derbys” nos dias dos derbys!
                                        </li>
                                    </ul>
                                </div>

                                <p>
                                    E todos os domingos, 9 campos cheios, 108 jogadores a dar o seu melhor.
                                    O LevelUP começou com dois, mas hoje é mantido por todos. Somos uma experiência completa de Padel, que vai de A a Z.
                                </p>
                                
                                <div className="pt-2 border-t border-gray-100">
                                    <p className="font-bold text-padel-dark uppercase text-[10px] mb-2 tracking-widest">Além do desporto, fazemos o bem fora de campo:</p>
                                    <p>
                                        A nossa marca está em salas de aula equipadas e em refeições para crianças carenciadas noutros pontos do mundo. Porque acreditamos que o desporto é também solidariedade.
                                    </p>
                                </div>

                                <p className="font-bold">
                                    Não queremos ser “Os Maiores”, mas somos “Os Melhores” – porque cada pessoa que entra neste grupo faz dele algo único.
                                </p>

                                <div className="pt-4 text-center">
                                    <p className="text-sm font-black italic text-gray-800">Sejam bem-vindos ao LevelUP.</p>
                                    <p className="text-xs text-gray-500 font-bold mt-1">Entramos com vontade de aprender e ficamos com vontade de ensinar.</p>
                                    <div className="mt-4 flex flex-col items-center">
                                        <div className="h-px w-12 bg-padel mb-2 opacity-30"></div>
                                        <p className="font-black text-padel-dark text-lg italic transform -skew-x-6 tracking-tighter">Elsa e Joca</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Expand/Collapse Label */}
                        <div 
                            className="mt-4 pt-2 border-t border-gray-50 text-center cursor-pointer group"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-padel hover:text-padel-dark transition-colors">
                                {isExpanded ? 'Ler menos ↑' : 'Ler história completa ↓'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* GDPR - DISCRETE COLLAPSIBLE CARD */}
                <div className="bg-gray-50/50 rounded-xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300">
                    <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setIsGdprExpanded(!isGdprExpanded)}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-lg">🛡️</span>
                            <h3 className="font-bold text-gray-500 uppercase text-[10px] tracking-widest">Proteção de Dados e Privacidade (GDPR)</h3>
                        </div>
                        <div className={`text-xs text-gray-400 transition-transform duration-500 ${isGdprExpanded ? 'rotate-180' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    
                    <div className={`grid transition-all duration-500 ease-in-out ${isGdprExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden px-4 pb-4">
                            <div className="text-[10px] text-gray-500 leading-relaxed space-y-3">
                                <p>
                                    A sua privacidade é importante para nós. Esta aplicação cumpre as disposições do Regulamento Geral de Proteção de Dados (RGPD), garantindo que os seus dados pessoais são tratados de forma legal, leal e transparente, apenas para fins legítimos e necessários.
                                </p>
                                
                                <div>
                                    <p className="font-bold text-gray-700 uppercase tracking-tighter mb-1">Direitos do Utilizador</p>
                                    <ul className="list-disc ml-4 space-y-0.5">
                                        <li>Aceder, corrigir ou eliminar os seus dados pessoais.</li>
                                        <li>Solicitar informações sobre como os seus dados são tratados.</li>
                                    </ul>
                                </div>

                                <div className="pt-2 border-t border-gray-200">
                                    <p className="font-bold text-gray-700 uppercase tracking-tighter mb-1">Isenção de Responsabilidade</p>
                                    <p className="italic">
                                        Esta aplicação e os seus responsáveis não fornecem aconselhamento jurídico. As informações apresentadas destinam-se apenas a comunicar as práticas de privacidade adotadas. Ao utilizar esta aplicação, aceita que a responsabilidade pelo cumprimento das obrigações legais relacionadas com o tratamento dos seus dados pessoais é limitada às disposições aqui descritas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Social / Branding */}
            <div className="text-center pt-8 opacity-80 transition-all duration-700">
                <div className="flex justify-center items-center gap-2 mb-2">
                    <span className="h-px w-8 bg-white/30"></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Padel LevelUp</span>
                    <span className="h-px w-8 bg-white/30"></span>
                </div>
                <p className="text-[10px] text-white/70 font-medium">Powered by Padel LevelUp Amazing Team</p>
            </div>
        </div>
    );
};
