import { getGeminiModel, geminiClient } from './geminiClient';

/**
 * LLM Provider Configuration
 * Now uses Gemini API exclusively (base44 support removed)
 * Set via VITE_GEMINI_API_KEY environment variable
 */
const LLM_PROVIDER = 'gemini';

/**
 * Invoke LLM with structured JSON response
 * Uses Gemini API for all LLM operations
 *
 * @param {Object} params
 * @param {string} params.prompt - The prompt to send to the LLM
 * @param {Object} params.response_json_schema - JSON schema for structured response
 * @returns {Promise<Object>} Parsed JSON response matching the schema
 */
export async function InvokeLLM({ prompt, response_json_schema }) {
  return await invokeGemini({ prompt, response_json_schema });
}

/**
 * Invoke Gemini API with JSON schema support
 */
async function invokeGemini({ prompt, response_json_schema }) {
  if (!geminiClient) {
    throw new Error(
      'Gemini API key not configured.\n\n' +
      '🔑 Required Environment Variable:\n' +
      '   VITE_GEMINI_API_KEY=your_api_key_here\n\n' +
      '📝 To fix:\n' +
      '   1. Create/update .env.local file in project root\n' +
      '   2. Add: VITE_GEMINI_API_KEY=your_key\n' +
      '   3. Get API key from: https://aistudio.google.com/app/apikey\n' +
      '   4. Restart development server'
    );
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

    // Provide helpful error messages
    if (error.message && error.message.includes('API key')) {
      throw new Error(
        'Invalid Gemini API key.\n\n' +
        'Please verify your VITE_GEMINI_API_KEY in .env.local\n' +
        'Get a new key from: https://aistudio.google.com/app/apikey'
      );
    }

    throw new Error(`Gemini API call failed: ${error.message}`);
  }
}

/**
 * Get current LLM provider
 * @returns {string} Current provider (always 'gemini')
 */
export function getCurrentProvider() {
  return LLM_PROVIDER;
}

/**
 * Check if Gemini provider is available
 * @returns {boolean}
 */
export function isProviderAvailable() {
  return !!geminiClient;
}
