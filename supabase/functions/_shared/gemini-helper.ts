// Gemini API helper with retry logic and rate limiting

import {
  RetryConfig,
  GeminiRateLimits,
  QueryAnalysisSchema,
  GeneratedQuerySchema,
  GeminiRequestConfig,
  GeminiResponse,
  ErrorType,
  RetryMetadata,
  DEFAULT_RETRY_CONFIG,
  GEMINI_FLASH_LIMITS,
  DEFAULT_GEMINI_CONFIG,
} from './types.ts';

import {
  validateAndSanitize,
  validateGeneratedQueries,
  sanitizeErrorMessage,
  generateFallbackResult,
} from './validation.ts';

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect error type for retry logic
 */
function detectErrorType(error: any): ErrorType {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
    return ErrorType.RATE_LIMIT;
  }
  if (message.includes('parse') || message.includes('json') || message.includes('invalid')) {
    return ErrorType.PARSE_ERROR;
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return ErrorType.NETWORK_ERROR;
  }
  if (message.includes('validation')) {
    return ErrorType.VALIDATION_ERROR;
  }
  if (message.includes('auth') || message.includes('401') || message.includes('403')) {
    return ErrorType.AUTH_ERROR;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Determine if error should be retried
 */
function shouldRetry(errorType: ErrorType): boolean {
  return [
    ErrorType.RATE_LIMIT,
    ErrorType.PARSE_ERROR,
    ErrorType.NETWORK_ERROR,
    ErrorType.VALIDATION_ERROR,
  ].includes(errorType);
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function calculateRetryDelay(
  attempt: number,
  config: RetryConfig,
  errorType: ErrorType
): number {
  // Base delay with exponential backoff
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );

  // Add jitter (±25%) to avoid thundering herd
  const jitter = baseDelay * 0.25 * (Math.random() - 0.5) * 2;
  let delay = Math.floor(baseDelay + jitter);

  // Special handling for rate limits - wait longer
  if (errorType === ErrorType.RATE_LIMIT) {
    delay = Math.max(delay, 60000); // Wait at least 60 seconds
  }

  return delay;
}

/**
 * Call Gemini API with a single request
 */
async function callGeminiAPI(
  prompt: string,
  apiKey: string,
  config: GeminiRequestConfig = DEFAULT_GEMINI_CONFIG
): Promise<GeminiResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: config.temperature || 0.3,
          maxOutputTokens: config.maxOutputTokens || 2048,
          topK: config.topK || 40,
          topP: config.topP || 0.95,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Call Gemini API with retry logic
 */
export async function callGeminiWithRetry(
  prompt: string,
  apiKey: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<QueryAnalysisSchema> {
  let lastError: Error | null = null;
  const retryMetadata: RetryMetadata[] = [];

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Call Gemini API
      const response = await callGeminiAPI(prompt, apiKey);

      // Extract text from response
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No text content in Gemini response');
      }

      // Validate and sanitize response
      const validated = validateAndSanitize(text);

      // Log success after retries
      if (attempt > 0) {
        console.log(
          `✅ Success after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`
        );
      }

      return validated;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorType = detectErrorType(lastError);

      // Record retry metadata
      retryMetadata.push({
        attempt,
        totalAttempts: config.maxRetries,
        delay: 0,
        errorType,
        errorMessage: sanitizeErrorMessage(lastError),
      });

      // Don't retry if we're out of attempts
      if (attempt >= config.maxRetries) {
        console.error(
          `❌ All ${config.maxRetries + 1} attempts failed:`,
          retryMetadata
        );
        break;
      }

      // Check if we should retry this error
      if (!shouldRetry(errorType)) {
        console.error(`🚫 Non-retryable error (${errorType}):`, lastError.message);
        throw lastError; // Don't retry auth errors, etc.
      }

      // Calculate delay
      const delay = calculateRetryDelay(attempt, config, errorType);
      retryMetadata[retryMetadata.length - 1].delay = delay;

      // Log retry attempt
      console.log(
        `🔄 Retry ${attempt + 1}/${config.maxRetries} ` +
        `after ${delay}ms (${errorType}): ${lastError.message.substring(0, 100)}`
      );

      // Wait before retry
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError || new Error('Max retries exceeded with unknown error');
}

/**
 * Rate limiter class to manage Gemini API request throttling
 */
export class GeminiRateLimiter {
  private requestQueue: Array<() => Promise<any>> = [];
  private requestTimestamps: number[] = [];
  private isProcessing = false;

  constructor(private limits: GeminiRateLimits = GEMINI_FLASH_LIMITS) {}

  /**
   * Throttle a request to respect rate limits
   */
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      // Start processing queue
      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();

      // Clean old timestamps (older than 1 minute)
      this.requestTimestamps = this.requestTimestamps.filter(
        (ts) => now - ts < 60000
      );

      // Check if we've hit rate limit
      if (this.requestTimestamps.length >= this.limits.requestsPerMinute) {
        // Calculate wait time until oldest request expires
        const oldestRequest = this.requestTimestamps[0];
        const waitTime = 60000 - (now - oldestRequest) + 100; // Add 100ms buffer

        console.log(
          `⏸️  Rate limit reached (${this.requestTimestamps.length}/${this.limits.requestsPerMinute}), ` +
          `waiting ${Math.ceil(waitTime / 1000)}s`
        );

        await sleep(waitTime);
        continue;
      }

      // Execute next request in queue
      const request = this.requestQueue.shift();
      if (request) {
        this.requestTimestamps.push(Date.now());
        await request();

        // Small delay between requests to be gentle on the API
        if (this.requestQueue.length > 0) {
          await sleep(200); // 200ms between requests
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    queueLength: number;
    requestsInLastMinute: number;
    requestsPerMinute: number;
  } {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      (ts) => now - ts < 60000
    ).length;

    return {
      queueLength: this.requestQueue.length,
      requestsInLastMinute: recentRequests,
      requestsPerMinute: this.limits.requestsPerMinute,
    };
  }
}

// Global rate limiter instance
export const rateLimiter = new GeminiRateLimiter(GEMINI_FLASH_LIMITS);

/**
 * Analyze single query with retry and rate limiting
 */
export async function analyzeQueryWithRetry(
  query: any,
  project: any,
  apiKey: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<QueryAnalysisSchema> {
  // Throttle through rate limiter
  return await rateLimiter.throttle(async () => {
    const prompt = generateAnalysisPrompt(query, project);
    return await callGeminiWithRetry(prompt, apiKey, retryConfig);
  });
}

/**
 * Generate analysis prompt for query
 */
function generateAnalysisPrompt(query: any, project: any): string {
  return `Analyze this AEO query and provide structured information:

Query: "${query.query_text}"
Query Type: ${query.query_type}
Category: ${query.query_category}
Target Audience: ${query.target_audience}

Company: ${project.company_url || 'Not specified'}
Competitors: ${project.competitor_urls?.join(', ') || 'Not specified'}

Please analyze:
1. Which brands would likely be mentioned in answers to this query? (List specific brand names)
2. What sources (websites, platforms, forums) would typically answer this query?
3. Confirm or correct the query type and category

Output as JSON with this exact format:
{
  "brand_mentions": ["Brand1", "Brand2", "Brand3"],
  "source": "Source name or platform (e.g., 'Reddit forums', 'Industry documentation', 'Review sites')",
  "query_type": "Educational",
  "query_category": "Industry monitoring"
}

IMPORTANT:
- brand_mentions should be an array of specific brand/company names (not generic terms)
- query_type must be exactly "Educational" or "Service-Aligned"
- query_category must be one of the 10 valid categories
- Return ONLY the JSON object, no additional text`;
}

/**
 * Call Gemini API for query generation with retry logic
 */
export async function generateQueriesWithRetry(
  prompt: string,
  apiKey: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<GeneratedQuerySchema[]> {
  let lastError: Error | null = null;
  const retryMetadata: RetryMetadata[] = [];

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Call Gemini API with higher token limit for query generation
      const response = await callGeminiAPI(prompt, apiKey, {
        ...DEFAULT_GEMINI_CONFIG,
        maxOutputTokens: 8192, // Higher limit for generating multiple queries
        temperature: 0.7, // Higher temperature for more variety
      });

      // Extract text from response
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No text content in Gemini response');
      }

      // Validate and sanitize array of queries
      const validated = validateGeneratedQueries(text);

      // Log success after retries
      if (attempt > 0) {
        console.log(
          `✅ Generated ${validated.length} queries after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`
        );
      } else {
        console.log(`✅ Generated ${validated.length} queries on first attempt`);
      }

      return validated;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorType = detectErrorType(lastError);

      // Record retry metadata
      retryMetadata.push({
        attempt,
        totalAttempts: config.maxRetries,
        delay: 0,
        errorType,
        errorMessage: sanitizeErrorMessage(lastError),
      });

      // Don't retry if we're out of attempts
      if (attempt >= config.maxRetries) {
        console.error(
          `❌ Query generation failed after ${config.maxRetries + 1} attempts:`,
          retryMetadata
        );
        break;
      }

      // Check if we should retry this error
      if (!shouldRetry(errorType)) {
        console.error(`🚫 Non-retryable error (${errorType}):`, lastError.message);
        throw lastError;
      }

      // Calculate delay
      const delay = calculateRetryDelay(attempt, config, errorType);
      retryMetadata[retryMetadata.length - 1].delay = delay;

      // Log retry attempt
      console.log(
        `🔄 Retry ${attempt + 1}/${config.maxRetries} ` +
        `after ${delay}ms (${errorType}): ${lastError.message.substring(0, 100)}`
      );

      // Wait before retry
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError || new Error('Query generation failed after max retries');
}

/**
 * Generate query generation prompt
 */
export function buildQueryGenerationPrompt(project: any): string {
  const sampleSize = project.total_queries || 20;
  const educationalRatio = project.educational_ratio || 50;
  const serviceRatio = project.service_ratio || 50;

  return `Generate ${sampleSize} Answer Engine Optimization (AEO) queries for analysis.

Company: ${project.company_url || 'Not specified'}
Competitors: ${project.competitor_urls?.join(', ') || 'Not specified'}
Target Audience: ${project.audience?.join(', ') || 'General audience'}
Focus Areas: ${project.themes || 'General topics'}
Query Mix: ${educationalRatio}% Educational, ${serviceRatio}% Service-Aligned

Requirements:
- Mix of natural language questions and keyword phrases
- Cover all 10 query categories:
  1. Industry monitoring
  2. Competitor benchmarking
  3. Operational training
  4. Foundational understanding
  5. Real-world learning examples
  6. Educational — people-focused
  7. Trend explanation
  8. Pain-point focused — commercial intent
  9. Product or vendor-related — lead intent
  10. Decision-stage — ready to buy or engage

${project.manual_queries?.length > 0 ? `Include these manual queries: ${project.manual_queries.join(', ')}` : ''}

Output as a JSON array with this exact format:
[
  {
    "query_text": "Example query text here",
    "query_type": "Educational",
    "query_category": "Industry monitoring",
    "query_format": "Natural-language questions",
    "target_audience": "Business professionals"
  }
]

IMPORTANT:
- query_type must be exactly "Educational" or "Service-Aligned"
- query_category must be one of the 10 categories listed above
- query_format must be exactly "Natural-language questions" or "Keyword phrases"
- Return ONLY the JSON array, no additional text`;
}
