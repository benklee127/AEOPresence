// Shared TypeScript types for Supabase Edge Functions

/**
 * Configuration for retry logic with exponential backoff
 */
export interface RetryConfig {
  maxRetries: number;           // Maximum number of retry attempts
  initialDelayMs: number;       // Initial delay in milliseconds
  maxDelayMs: number;           // Maximum delay cap in milliseconds
  backoffMultiplier: number;    // Multiplier for exponential backoff
}

/**
 * Gemini API rate limits (Free tier as of 2024)
 * See: https://ai.google.dev/pricing
 */
export interface GeminiRateLimits {
  requestsPerMinute: number;    // Requests per minute limit
  tokensPerMinute: number;      // Tokens per minute limit
  requestsPerDay: number;       // Requests per day limit
}

/**
 * Query analysis result schema
 */
export interface QueryAnalysisSchema {
  brand_mentions: string[];                           // List of brand names
  source: string;                                     // Source/platform name
  query_type: "Educational" | "Service-Aligned";     // Query type
  query_category: string;                             // Category name
}

/**
 * Gemini API request configuration
 */
export interface GeminiRequestConfig {
  temperature?: number;         // Temperature (0.0-1.0)
  maxOutputTokens?: number;     // Max output tokens
  topK?: number;               // Top-K sampling
  topP?: number;               // Top-P sampling
}

/**
 * Error types for retry logic
 */
export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  PARSE_ERROR = 'PARSE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Retry attempt metadata
 */
export interface RetryMetadata {
  attempt: number;
  totalAttempts: number;
  delay: number;
  errorType: ErrorType;
  errorMessage: string;
}

/**
 * Gemini API response structure
 */
export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

/**
 * Query metadata for tracking
 */
export interface QueryMetadata {
  retry_count?: number;
  error_message?: string;
  completed_at?: string;
  failed_at?: string;
  last_attempt_at?: string;
}

// Default configurations

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,      // Start with 1 second
  maxDelayMs: 30000,         // Max 30 seconds
  backoffMultiplier: 2,      // Double each time
};

/**
 * Gemini Flash rate limits (Free tier)
 */
export const GEMINI_FLASH_LIMITS: GeminiRateLimits = {
  requestsPerMinute: 15,     // 15 RPM for free tier
  tokensPerMinute: 1000000,  // 1M tokens/min
  requestsPerDay: 1500,      // 1500 requests/day
};

/**
 * Default Gemini request configuration
 */
export const DEFAULT_GEMINI_CONFIG: GeminiRequestConfig = {
  temperature: 0.3,          // Low temperature for consistency
  maxOutputTokens: 2048,     // Reasonable max
  topK: 40,
  topP: 0.95,
};

/**
 * Valid query types
 */
export const VALID_QUERY_TYPES = ['Educational', 'Service-Aligned'] as const;

/**
 * Valid query categories
 */
export const VALID_QUERY_CATEGORIES = [
  'Industry monitoring',
  'Competitor benchmarking',
  'Operational training',
  'Foundational understanding',
  'Real-world learning examples',
  'Educational — people-focused',
  'Trend explanation',
  'Pain-point focused — commercial intent',
  'Product or vendor-related — lead intent',
  'Decision-stage — ready to buy or engage',
] as const;
