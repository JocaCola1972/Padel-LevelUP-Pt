
import { GoogleGenAI } from "@google/genai";
import { Player } from "../types";
import { getAppState, updateAppState } from "./storageService";

const CACHE_KEYS = {
  RANKING: 'padel_gemini_ranking',
  RANKING_HASH: 'padel_gemini_ranking_hash'
};

const FALLBACK_TIPS = [
  "No Padel, a paciência ganha jogos. Espera pela bola certa para atacar!",
  "Mantém o teu parceiro sempre informado sobre a posição dos adversários.",
  "O vidro é o teu melhor amigo. Aprende a usá-lo para ganhar tempo.",
  "Tenta jogar mais bolas pelo centro para criar confusão na dupla adversária.",
  "Dobrar os joelhos é o segredo para uma defesa sólida no fundo do campo.",
  "A comunicação é 50% da vitória. Fala com o teu parceiro em cada ponto.",
  "Mantém a raquete sempre alta e pronta na rede para o voleio."
];

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateRankingAnalysis = async (topPlayers: Player[]): Promise<string> => {
  const currentHash = topPlayers.map(p => `${p.id}-${p.totalPoints}`).join('|');
  const cachedHash = localStorage.getItem(CACHE_KEYS.RANKING_HASH);
  const cachedAnalysis = localStorage.getItem(CACHE_KEYS.RANKING);

  if (currentHash === cachedHash && cachedAnalysis) return cachedAnalysis;

  const ai = getClient();
  const fallback = `Grande performance do top 5! O ${topPlayers[0]?.name || 'líder'} está imparável. Continuem a lutar! 🔥🏆`;

  if (!ai) return fallback;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analisa este top 5 de Padel: ${topPlayers.map((p, i) => `${i + 1}. ${p.name} (${p.totalPoints} pts)`).join('\n')}. Escreve um parágrafo divertido (max 80 palavras) em PT-PT.`,
    });
    
    const text = response.text || fallback;
    localStorage.setItem(CACHE_KEYS.RANKING, text);
    localStorage.setItem(CACHE_KEYS.RANKING_HASH, currentHash);
    return text;
  } catch (error) {
    return fallback;
  }
};

/**
 * Retorna a dica do dia. Se a dica na DB tiver mais de 24h, tenta gerar uma nova
 * e atualiza a DB para que todos os utilizadores vejam a mesma dica sem gastar quota extra.
 */
export const getOrGenerateGlobalTip = async (): Promise<string> => {
    const state = getAppState();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Se já temos uma dica de hoje na DB, usamos essa
    if (state.dailyTip && state.dailyTipDate === todayStr) {
        return state.dailyTip;
    }

    // Se expirou ou não existe, tentamos gerar uma nova (apenas 1 utilizador fará isto por dia)
    const ai = getClient();
    const randomFallback = FALLBACK_TIPS[Math.floor(Math.random() * FALLBACK_TIPS.length)];

    if (!ai) return state.dailyTip || randomFallback;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Dá uma dica tática curta e avançada para Padel (máximo 1 frase) em Português de Portugal.",
        });
        
        const newTip = response.text?.trim() || randomFallback;
        
        // Atualiza na base de dados global para todos os utilizadores
        await updateAppState({
            dailyTip: newTip,
            dailyTipDate: todayStr
        });
        
        return newTip;
    } catch (error) {
        console.warn("Gemini API Quota/Error. Using fallback.");
        return state.dailyTip || randomFallback;
    }
}
