# Supabase Edge Functions Deployment Guide

## Overview

This project uses Supabase Edge Functions (Deno runtime) for backend processing. All functions that interact with the Gemini API now include robust retry logic, rate limiting, and JSON validation to ensure reliable operation.

## Edge Functions

### 1. generate-queries
**Purpose**: Generate AEO queries using Gemini AI based on project configuration

**Features**:
- ✅ Retry logic (up to 3 attempts)
- ✅ Rate limiting (15 requests/minute)
- ✅ JSON validation and sanitization
- ✅ Exponential backoff with jitter

**Request**:
```json
{
  "project_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "count": 20,
  "message": "Successfully generated 20 queries",
  "duration_ms": 3500
}
```

**How it works**:
1. Fetches project configuration from database
2. Builds prompt with project details (company, competitors, themes, etc.)
3. Calls Gemini API with retry logic and rate limiting
4. Validates and sanitizes generated queries
5. Inserts queries into database with `analysis_status: "pending"`
6. Updates project status to `"queries_generated"` and `current_step: 2`

---

### 2. analyze-queries
**Purpose**: Analyze pending queries using Gemini AI to extract brand mentions, sources, and categorization

**Features**:
- ✅ Retry logic (up to 3 attempts per query)
- ✅ Rate limiting (15 requests/minute)
- ✅ JSON validation and sanitization
- ✅ Batch processing (5 queries per batch)
- ✅ Fallback values for failed queries
- ✅ Progress tracking in database

**Request**:
```json
{
  "project_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "analyzed": 18,
  "errors": 2,
  "already_complete": 0,
  "duration_ms": 45000,
  "summary": {
    "total_queries": 20,
    "completed": 18,
    "pending": 0,
    "analyzing": 0,
    "error": 2
  }
}
```

**How it works**:
1. Fetches all queries with `analysis_status: "pending"` or `"analyzing"`
2. Processes queries in batches of 5 with 2-second delays
3. For each query:
   - Updates status to `"analyzing"`
   - Calls Gemini API with retry logic
   - Extracts brand_mentions, source, query_type, query_category
   - Updates query with analysis results and status `"complete"`
   - On failure: uses fallback values and status `"error"`
4. Updates project status to `"analysis_complete"` and `current_step: 3`

---

### 3. diagnose-stuck-queries
**Purpose**: Diagnose why queries are stuck and provide insights

**Features**:
- No Gemini API calls (database-only operations)
- Identifies queries stuck in "analyzing" state for > 5 minutes
- Provides health status and recommendations

**Request**:
```json
{
  "project_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "health_status": "degraded",
  "completion_rate": 85,
  "query_counts": {
    "pending": 0,
    "analyzing": 3,
    "complete": 17,
    "error": 0
  },
  "stuck_queries": [
    {
      "id": "uuid",
      "stuck_duration_seconds": 420,
      "updated_at": "2025-11-07T10:00:00Z"
    }
  ],
  "diagnostics": [
    {
      "issue": "Stuck queries detected",
      "severity": "high",
      "count": 3,
      "description": "3 queries have been in 'analyzing' state for more than 5 minutes",
      "recommendation": "Run resetStuckQueries to reset them to pending status"
    }
  ]
}
```

---

### 4. reset-stuck-queries
**Purpose**: Reset queries stuck in "analyzing" state back to "pending"

**Features**:
- No Gemini API calls (database-only operations)
- Configurable stuck duration threshold (default: 5 minutes)

**Request**:
```json
{
  "project_id": "uuid",
  "max_duration_seconds": 300
}
```

**Response**:
```json
{
  "success": true,
  "reset_count": 3,
  "message": "Reset 3 stuck queries to pending",
  "reset_queries": [
    {
      "id": "uuid",
      "query_text": "What is AEO?",
      "stuck_since": "2025-11-07T10:00:00Z"
    }
  ]
}
```

---

### 5. export-step3-report
**Purpose**: Export analysis results as JSON or CSV

**Features**:
- No Gemini API calls (database-only operations)
- Supports JSON and CSV formats
- Includes project info, statistics, and all query data

**Request**:
```json
{
  "project_id": "uuid",
  "format": "json"
}
```

**Response**: File download with analysis results

---

## Deployment

### Prerequisites

1. **Supabase CLI**: Install the Supabase CLI
   ```bash
   npm install -g supabase
   ```

2. **Supabase Project**: You need a Supabase project with:
   - Project URL
   - Service role key
   - Gemini API key configured

3. **Environment Variables**: Set these in Supabase Dashboard → Project Settings → Edge Functions:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `SUPABASE_URL`: Auto-configured by Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Auto-configured by Supabase

### Deploy Individual Function

```bash
# Deploy a specific function
supabase functions deploy generate-queries

# Deploy with environment variables (first time)
supabase functions deploy generate-queries --set-env GEMINI_API_KEY=your_api_key_here
```

### Deploy All Functions

```bash
# Deploy all functions at once
supabase functions deploy
```

### Check Function Status

```bash
# List all deployed functions
supabase functions list

# Check function logs (real-time)
supabase functions logs generate-queries

# Check function logs (follow mode)
supabase functions logs generate-queries --follow
```

### Test Function Locally

```bash
# Start local Supabase (runs all functions locally)
supabase start

# Test function locally
supabase functions serve generate-queries

# In another terminal, invoke the function
curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-queries' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"project_id":"your-project-uuid"}'
```

### Update Environment Variables

```bash
# Update a single environment variable
supabase secrets set GEMINI_API_KEY=new_api_key_here

# List all secrets
supabase secrets list

# Remove a secret
supabase secrets unset GEMINI_API_KEY
```

---

## Shared Modules

The `_shared/` directory contains reusable code for all edge functions:

### `types.ts`
- TypeScript type definitions
- Retry configuration interfaces
- Gemini API rate limits
- Query schemas (analysis and generation)

### `validation.ts`
- JSON extraction and sanitization
- Query validation (analysis and generation)
- Fuzzy matching for query types/categories
- Fallback value generation

### `gemini-helper.ts`
- Gemini API client with retry logic
- Rate limiter class (15 requests/minute)
- Exponential backoff with jitter
- Error detection and classification
- Query analysis and generation helpers

---

## Retry and Rate Limiting

### Retry Configuration

Default retry config (can be customized):
```typescript
{
  maxRetries: 3,              // Max 3 retry attempts
  initialDelayMs: 1000,       // Start with 1 second
  maxDelayMs: 30000,          // Max 30 seconds
  backoffMultiplier: 2,       // Double each time (1s → 2s → 4s)
}
```

### Error Types

The system handles these error types:
- **RATE_LIMIT**: 429 errors, waits at least 60 seconds before retry
- **PARSE_ERROR**: JSON parsing failures, retries with sanitization
- **NETWORK_ERROR**: Network/fetch failures, retries immediately
- **VALIDATION_ERROR**: Schema validation failures, retries with fuzzy matching
- **AUTH_ERROR**: Authentication failures, does NOT retry
- **UNKNOWN**: Unknown errors, retries with standard backoff

### Rate Limiting

Gemini API free tier limits:
- 15 requests per minute
- 1,000,000 tokens per minute
- 1,500 requests per day

The rate limiter:
- Queues requests when limit is reached
- Automatically waits for rate limit window to expire
- Adds 200ms delay between requests
- Tracks request timestamps in a sliding window

---

## Troubleshooting

### Function Fails with "GEMINI_API_KEY environment variable is required"

**Solution**: Set the Gemini API key as a secret:
```bash
supabase secrets set GEMINI_API_KEY=your_api_key_here
```

### Function Hits Rate Limit

**Symptoms**:
- Console shows `⏸️ Rate limit reached, waiting Xs`
- Multiple queries fail with 429 errors

**Solution**:
- The rate limiter will automatically handle this by queuing requests
- If hitting limits frequently, consider:
  - Upgrading to Gemini API paid tier (higher limits)
  - Reducing batch sizes in analyze-queries
  - Adding longer delays between batches

### Query Analysis Returns "Analysis unavailable"

**Symptoms**:
- Queries complete but have `brand_mentions: ["Analysis unavailable"]`
- Query status is `"error"`

**Possible Causes**:
1. All 3 retry attempts failed due to malformed JSON
2. Gemini API consistently returning invalid responses
3. Rate limit exceeded and retries exhausted

**Solution**:
- Check Supabase logs: `supabase functions logs analyze-queries`
- Look for error patterns in logs
- Use `diagnose-stuck-queries` to identify issues
- Use `reset-stuck-queries` to reset failed queries and retry

### Function Times Out

**Symptoms**: Function returns 504 Gateway Timeout

**Possible Causes**:
- Query generation/analysis taking too long (>60s Supabase limit)
- Large batch sizes causing extended processing

**Solution**:
- Check function logs for performance issues
- Consider reducing batch sizes
- For large projects (200+ queries), run analysis in multiple calls

### Database Insert Fails

**Symptoms**: "Failed to insert queries" error

**Possible Causes**:
- Database table schema mismatch
- Duplicate query_id values
- Missing required fields

**Solution**:
- Verify table schemas match expected format
- Check Supabase Dashboard → Database → Tables
- Ensure query_id is unique per project

---

## Best Practices

### 1. Monitor Logs Regularly

```bash
# Check logs after deployment
supabase functions logs generate-queries --follow
supabase functions logs analyze-queries --follow
```

### 2. Test Locally Before Deployment

```bash
# Always test locally first
supabase functions serve
# ... test the function ...
# Then deploy
supabase functions deploy
```

### 3. Use Progressive Deployment

```bash
# Deploy one function at a time
supabase functions deploy generate-queries
# Test it...
supabase functions deploy analyze-queries
# Test it...
```

### 4. Keep Secrets Secure

- Never commit API keys to git
- Use Supabase secrets management
- Rotate keys periodically

### 5. Monitor Rate Limits

- Check function logs for rate limit warnings
- Consider upgrading Gemini API tier for production
- Adjust batch sizes based on usage patterns

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│                                                              │
│  Step 1: Configuration → Generate Queries                   │
│  Step 2: Analysis → Analyze Queries                         │
│  Step 3: Results → Export Report                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP Requests
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Supabase Edge Functions                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  generate-queries                                    │   │
│  │  • Rate Limiter                                      │   │
│  │  • Retry Logic (3x)                                  │   │
│  │  • JSON Validation                                   │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │  analyze-queries                                     │   │
│  │  • Batch Processing (5 per batch)                    │   │
│  │  • Rate Limiter                                      │   │
│  │  • Retry Logic (3x per query)                        │   │
│  │  • Fallback Values                                   │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│                         │ Uses                               │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │  _shared/                                            │   │
│  │  • types.ts (TypeScript definitions)                 │   │
│  │  • validation.ts (JSON sanitization)                 │   │
│  │  • gemini-helper.ts (API calls + retry)              │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Gemini API Calls (with rate limiting)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Google Gemini API                          │
│              (gemini-1.5-flash-latest)                      │
│                                                              │
│  Rate Limits (Free Tier):                                   │
│  • 15 requests/minute                                        │
│  • 1M tokens/minute                                          │
│  • 1,500 requests/day                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Version History

### v2.0 (Current)
- ✅ Added retry logic to generate-queries and analyze-queries
- ✅ Implemented rate limiting (15 RPM)
- ✅ JSON validation and sanitization
- ✅ Exponential backoff with jitter
- ✅ Fallback values for failed queries
- ✅ Comprehensive error handling

### v1.0 (Legacy)
- Basic Gemini API integration
- No retry logic
- No rate limiting
- Basic error handling

---

## Support

For issues or questions:
1. Check function logs: `supabase functions logs <function-name>`
2. Review this documentation
3. Check Supabase Dashboard → Edge Functions
4. Consult Supabase docs: https://supabase.com/docs/guides/functions
5. Consult Gemini API docs: https://ai.google.dev/docs
