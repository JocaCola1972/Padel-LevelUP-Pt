
import React from 'react';
import { getAppState } from '../services/storageService';

export const LevelUpInfo: React.FC = () => {
    const state = getAppState();

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
                        <h3 className="font-bold text-gray-800 mb-1 uppercase text-sm tracking-wide">Formato Sobe e Desce</h3>
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
                        <h3 className="font-bold text-gray-800 mb-1 uppercase text-sm tracking-wide">Comunidade e Convívio</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Mais do que um torneio ou um “Mix” o LevelUP é o ponto de encontro de amigos e novas parcerias.
                        </p>
                    </div>
                </div>

                {/* HISTÓRIA E COMPROMISSO - LONG TEXT */}
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 border border-yellow-100">
                            ⭐
                        </div>
                        <h3 className="font-black text-gray-800 uppercase text-sm tracking-wide">LEVELUP – Muito mais do que Padel!</h3>
                    </div>
                    
                    <div className="text-xs text-gray-600 space-y-4 leading-relaxed text-justify">
                        <p>
                            O LevelUP nasceu da vontade de duas pessoas com um objetivo simples: fazer bem e fazer melhor.
                        </p>
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
