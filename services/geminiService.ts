
import { GoogleGenAI } from "@google/genai";
import { Player } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateRankingAnalysis = async (topPlayers: Player[]): Promise<string> => {
  const ai = getClient();
  if (!ai) return "Erro de configuração de API.";

  const playersData = topPlayers.map((p, i) => 
    `${i + 1}. ${p.name} (${p.totalPoints} pontos, ${p.gamesPlayed} jogos)`
  ).join('\n');

  const prompt = `
    És um comentador desportivo entusiasta de Padel. 
    Analisa o seguinte top 5 de jogadores da liga "Sobe e Desce":
    ${playersData}

    Escreve um pequeno parágrafo divertido (máximo 100 palavras) em Português sobre o desempenho deles. 
    Elogia o primeiro lugar e dá uma dica motivacional aos outros. 
    Usa emojis de padel, fogo e troféus.
  `;

  try {
    // Corrected model to 'gemini-3-flash-preview' for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Accessing .text property directly as per instructions
    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Error generating analysis:", error);
    return "O comentador virtual está a beber água. Tente mais tarde.";
  }
};

export const generateTacticalTip = async (): Promise<string> => {
    const ai = getClient();
    if (!ai) return "Dica indisponível.";

    const prompt = "Dá-me uma dica tática curta e avançada para Padel (máximo 1 frase) em Português.";

    try {
        // Corrected model to 'gemini-3-flash-preview' for basic text tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        // Accessing .text property directly as per instructions
        return response.text || "Mantenha os olhos na bola!";
    } catch (error) {
        return "Concentre-se no jogo!";
    }
}
