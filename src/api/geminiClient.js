import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client with API key from environment
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const geminiClient = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Get a Gemini model instance
 * @param {string} modelName - Default: 'gemini-flash-latest'
 * @returns {Object} Gemini model instance
 */
export function getGeminiModel(modelName = 'gemini-flash-latest') {
  if (!geminiClient) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in your .env file');
  }
  return geminiClient.getGenerativeModel({ model: modelName });
}
