// JSON validation and sanitization utilities

import {
  QueryAnalysisSchema,
  GeneratedQuerySchema,
  VALID_QUERY_TYPES,
  VALID_QUERY_CATEGORIES,
} from './types.ts';

/**
 * Sanitize and extract JSON from LLM response
 * Handles common issues like markdown code blocks, extra text, etc.
 */
export function extractJSON(response: string): string {
  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Try to find JSON object in response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned;
}

/**
 * Parse JSON with error handling
 */
export function safeJSONParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON: ${text.substring(0, 200)}... (Error: ${error.message})`
    );
  }
}

/**
 * Validate and sanitize query analysis response from LLM
 * Ensures response matches expected schema and provides fallback values
 */
export function validateAndSanitize(
  response: any
): QueryAnalysisSchema {
  let parsed = response;

  // If response is string, parse it
  if (typeof response === 'string') {
    const cleaned = extractJSON(response);
    parsed = safeJSONParse(cleaned);
  }

  // Validate and sanitize brand_mentions
  let brandMentions: string[] = [];
  if (Array.isArray(parsed.brand_mentions)) {
    brandMentions = parsed.brand_mentions
      .filter((b: any) => typeof b === 'string' && b.trim())
      .map((b: string) => b.trim())
      .slice(0, 20); // Limit to 20 brands max
  } else if (typeof parsed.brand_mentions === 'string') {
    // Handle case where LLM returned comma-separated string
    brandMentions = parsed.brand_mentions
      .split(',')
      .map((b: string) => b.trim())
      .filter((b: string) => b.length > 0)
      .slice(0, 20);
  }

  // Default if no brands identified
  if (brandMentions.length === 0) {
    brandMentions = ['No specific brands identified'];
  }

  // Validate and sanitize source
  let source = 'Unknown';
  if (typeof parsed.source === 'string' && parsed.source.trim()) {
    source = parsed.source.trim().substring(0, 500); // Limit length
  }

  // Validate query_type
  let queryType: "Educational" | "Service-Aligned" = 'Educational';
  if (VALID_QUERY_TYPES.includes(parsed.query_type)) {
    queryType = parsed.query_type;
  } else if (typeof parsed.query_type === 'string') {
    // Try to fuzzy match
    const normalized = parsed.query_type.toLowerCase();
    if (normalized.includes('service') || normalized.includes('aligned')) {
      queryType = 'Service-Aligned';
    } else {
      queryType = 'Educational';
    }
  }

  // Validate query_category
  let queryCategory = 'Industry monitoring'; // Default
  if (typeof parsed.query_category === 'string') {
    const normalized = parsed.query_category.trim();

    // Exact match
    if (VALID_QUERY_CATEGORIES.includes(normalized as any)) {
      queryCategory = normalized;
    } else {
      // Try fuzzy matching
      const lowerNormalized = normalized.toLowerCase();
      const match = VALID_QUERY_CATEGORIES.find(cat =>
        cat.toLowerCase() === lowerNormalized ||
        lowerNormalized.includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(lowerNormalized)
      );

      if (match) {
        queryCategory = match;
      }
    }
  }

  const result: QueryAnalysisSchema = {
    brand_mentions: brandMentions,
    source: source,
    query_type: queryType,
    query_category: queryCategory,
  };

  return result;
}

/**
 * Validate that result has minimum required fields
 */
export function hasMinimumFields(result: QueryAnalysisSchema): boolean {
  return (
    Array.isArray(result.brand_mentions) &&
    result.brand_mentions.length > 0 &&
    typeof result.source === 'string' &&
    result.source.length > 0 &&
    typeof result.query_type === 'string' &&
    typeof result.query_category === 'string'
  );
}

/**
 * Generate fallback result when all retries fail
 */
export function generateFallbackResult(
  originalQuery: any
): QueryAnalysisSchema {
  return {
    brand_mentions: ['Analysis unavailable'],
    source: 'Unable to determine',
    query_type: originalQuery.query_type || 'Educational',
    query_category: originalQuery.query_category || 'Industry monitoring',
  };
}

/**
 * Sanitize error message for logging
 */
export function sanitizeErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message.substring(0, 500); // Limit length
  }
  return String(error).substring(0, 500);
}

/**
 * Extract JSON array from LLM response
 * Handles common issues like markdown code blocks, extra text, etc.
 */
export function extractJSONArray(response: string): string {
  // Remove markdown code blocks
  let cleaned = response
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Try to find JSON array in response
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned;
}

/**
 * Validate and sanitize a single generated query
 */
export function validateGeneratedQuery(query: any): GeneratedQuerySchema | null {
  try {
    // Validate query_text
    if (!query.query_text || typeof query.query_text !== 'string' || !query.query_text.trim()) {
      console.warn('Invalid query_text:', query);
      return null;
    }

    // Validate query_type with fuzzy matching
    let queryType: "Educational" | "Service-Aligned" = 'Educational';
    if (VALID_QUERY_TYPES.includes(query.query_type)) {
      queryType = query.query_type;
    } else if (typeof query.query_type === 'string') {
      const normalized = query.query_type.toLowerCase();
      if (normalized.includes('service') || normalized.includes('aligned')) {
        queryType = 'Service-Aligned';
      }
    }

    // Validate query_category with fuzzy matching
    let queryCategory = 'Industry monitoring'; // Default
    if (typeof query.query_category === 'string') {
      const normalized = query.query_category.trim();
      if (VALID_QUERY_CATEGORIES.includes(normalized as any)) {
        queryCategory = normalized;
      } else {
        const lowerNormalized = normalized.toLowerCase();
        const match = VALID_QUERY_CATEGORIES.find(cat =>
          cat.toLowerCase() === lowerNormalized ||
          lowerNormalized.includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(lowerNormalized)
        );
        if (match) {
          queryCategory = match;
        }
      }
    }

    // Validate query_format
    const validFormats = ['Natural-language questions', 'Keyword phrases'];
    let queryFormat: "Natural-language questions" | "Keyword phrases" = 'Natural-language questions';
    if (validFormats.includes(query.query_format)) {
      queryFormat = query.query_format;
    } else if (typeof query.query_format === 'string') {
      const normalized = query.query_format.toLowerCase();
      if (normalized.includes('keyword') || normalized.includes('phrase')) {
        queryFormat = 'Keyword phrases';
      }
    }

    // Validate target_audience
    let targetAudience = 'General audience';
    if (typeof query.target_audience === 'string' && query.target_audience.trim()) {
      targetAudience = query.target_audience.trim().substring(0, 200);
    }

    return {
      query_text: query.query_text.trim(),
      query_type: queryType,
      query_category: queryCategory,
      query_format: queryFormat,
      target_audience: targetAudience,
    };
  } catch (error) {
    console.error('Error validating query:', error);
    return null;
  }
}

/**
 * Validate and sanitize array of generated queries
 */
export function validateGeneratedQueries(response: any): GeneratedQuerySchema[] {
  let parsed = response;

  // If response is string, parse it
  if (typeof response === 'string') {
    const cleaned = extractJSONArray(response);
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      console.error('Failed to parse generated queries JSON:', cleaned.substring(0, 200));
      throw new Error(`Failed to parse generated queries: ${error.message}`);
    }
  }

  // Ensure we have an array
  if (!Array.isArray(parsed)) {
    throw new Error('Generated queries response is not an array');
  }

  // Validate each query
  const validQueries: GeneratedQuerySchema[] = [];
  for (const query of parsed) {
    const validated = validateGeneratedQuery(query);
    if (validated) {
      validQueries.push(validated);
    }
  }

  if (validQueries.length === 0) {
    throw new Error('No valid queries found in LLM response');
  }

  return validQueries;
}
