import { base44 } from './base44Client';
import { getGeminiModel, geminiClient } from './geminiClient';

/**
 * LLM Provider Configuration
 * Supports 'base44' or 'gemini'
 * Set via VITE_LLM_PROVIDER environment variable
 */
const LLM_PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'base44';

/**
 * Invoke LLM with structured JSON response
 * Supports both Base44 and Gemini API backends
 *
 * @param {Object} params
 * @param {string} params.prompt - The prompt to send to the LLM
 * @param {Object} params.response_json_schema - JSON schema for structured response
 * @param {string} [params.provider] - Override default provider ('base44' or 'gemini')
 * @returns {Promise<Object>} Parsed JSON response matching the schema
 */
export async function InvokeLLM({ prompt, response_json_schema, provider = LLM_PROVIDER }) {
  if (provider === 'gemini') {
    return await invokeGemini({ prompt, response_json_schema });
  } else {
    return await invokeBase44({ prompt, response_json_schema });
  }
}

/**
 * Invoke Base44 LLM
 */
async function invokeBase44({ prompt, response_json_schema }) {
  return await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema
  });
}

/**
 * Invoke Gemini API with JSON schema support
 */
async function invokeGemini({ prompt, response_json_schema }) {
  if (!geminiClient) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in your .env file');
  }

  try {
    const model = getGeminiModel();

    // Create a system instruction that includes the JSON schema
    const schemaInstruction = `You must respond with valid JSON that matches this schema: ${JSON.stringify(response_json_schema, null, 2)}`;

    // Combine the schema instruction with the user prompt
    const fullPrompt = `${schemaInstruction}\n\n${prompt}\n\nRespond with ONLY valid JSON, no markdown formatting or code blocks.`;

    // Generate content with JSON mode
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json', // Enable JSON mode
      },
    });

    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    try {
      const jsonResponse = JSON.parse(text);
      return jsonResponse;
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', text);
      throw new Error(`Gemini returned invalid JSON: ${parseError.message}`);
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(`Gemini API call failed: ${error.message}`);
  }
}

/**
 * Get current LLM provider
 * @returns {string} Current provider ('base44' or 'gemini')
 */
export function getCurrentProvider() {
  return LLM_PROVIDER;
}

/**
 * Check if a specific provider is available
 * @param {string} provider - Provider name ('base44' or 'gemini')
 * @returns {boolean}
 */
export function isProviderAvailable(provider) {
  if (provider === 'base44') {
    return !!base44;
  } else if (provider === 'gemini') {
    return !!geminiClient;
  }
  return false;
}
