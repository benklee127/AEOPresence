# Updating Supabase Edge Functions - Developer Guide

This guide walks you through the complete process of updating, testing, and deploying changes to Supabase edge functions.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Making Changes to Functions](#making-changes-to-functions)
- [Testing Changes Locally](#testing-changes-locally)
- [Deploying Updates](#deploying-updates)
- [Verifying Deployments](#verifying-deployments)
- [Monitoring & Debugging](#monitoring--debugging)
- [Common Update Scenarios](#common-update-scenarios)
- [Rollback Procedures](#rollback-procedures)
- [Best Practices](#best-practices)

---

## Overview

The AEO Presence application uses 5 Supabase edge functions:

| Function | Purpose | Uses Gemini API |
|----------|---------|-----------------|
| `generate-queries` | Generate AEO queries using AI | ✅ Yes |
| `analyze-queries` | Analyze queries for brands, sources, categories | ✅ Yes |
| `diagnose-stuck-queries` | Diagnose query analysis health | ❌ No (DB only) |
| `reset-stuck-queries` | Reset stuck queries to pending | ❌ No (DB only) |
| `export-step3-report` | Export analysis results as CSV/JSON | ❌ No (DB only) |

**When to Update Functions:**
- Bug fixes in business logic
- Adding new features or parameters
- Improving error handling
- Updating retry logic or rate limiting
- Modifying AI prompts
- Database schema changes requiring function updates
- Performance optimizations

---

## Prerequisites

### 1. Install Supabase CLI

```bash
# macOS/Linux
npm install -g supabase

# Windows
npm install -g supabase

# Verify installation
supabase --version
```

### 2. Install Deno (Optional but Recommended)

Deno is the runtime for edge functions. Installing it locally enables better IDE support and type checking.

```bash
# macOS/Linux
curl -fsSL https://deno.land/x/install/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# Verify installation
deno --version
```

### 3. Authenticate with Supabase

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

**Finding your project ref:**
- Go to your Supabase Dashboard
- Navigate to Settings → General → Reference ID
- Or extract it from your project URL: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`

### 4. Set Environment Variables

Functions need environment variables to work:

```bash
# View existing secrets
supabase secrets list

# Set Gemini API key (if not already set)
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Local Development Setup

### 1. Start Local Supabase

```bash
# Initialize local Supabase (first time only)
supabase init

# Start local Supabase stack (DB + edge functions)
supabase start
```

This starts:
- PostgreSQL database on `localhost:54322`
- Edge functions on `http://localhost:54321/functions/v1/`
- Studio UI on `http://localhost:54323`

### 2. Create Local Environment File

Create `.env` in the `supabase/functions/` directory:

```bash
# supabase/functions/.env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Note:** This file is for local development only and should be in `.gitignore`.

### 3. Serve a Function Locally

```bash
# Serve a single function
supabase functions serve generate-queries

# Serve with environment variables
supabase functions serve generate-queries --env-file supabase/functions/.env

# Serve all functions
supabase functions serve
```

The function will be available at: `http://localhost:54321/functions/v1/generate-queries`

---

## Making Changes to Functions

### Function Structure

Each function lives in its own directory:

```
supabase/functions/
├── _shared/                    # Shared utilities
│   ├── types.ts               # TypeScript definitions
│   ├── gemini-helper.ts       # Gemini API integration
│   └── validation.ts          # JSON validation
├── generate-queries/
│   └── index.ts               # Function entry point
├── analyze-queries/
│   └── index.ts
└── ...
```

### Example: Updating generate-queries

Let's say you want to change the number of queries generated from 20 to 30.

**File:** `supabase/functions/generate-queries/index.ts`

```typescript
// Before:
const prompt = buildQueryGenerationPrompt(project, 20);

// After:
const prompt = buildQueryGenerationPrompt(project, 30);
```

### Example: Updating Shared Helper

If you need to modify shared code used by multiple functions:

**File:** `supabase/functions/_shared/gemini-helper.ts`

```typescript
// Example: Change rate limit from 15 RPM to 10 RPM
export const GEMINI_FLASH_LIMITS = {
  requestsPerMinute: 10,  // Changed from 15
  tokensPerMinute: 1_000_000,
  requestsPerDay: 1500,
};
```

**Important:** Changes to `_shared/` affect ALL functions that import from it!

### Type Checking (Optional)

```bash
# Check TypeScript types without deploying
deno check supabase/functions/generate-queries/index.ts
```

---

## Testing Changes Locally

### 1. Start the Function

```bash
# Terminal 1: Start the function
supabase functions serve generate-queries --env-file supabase/functions/.env
```

### 2. Get Local Credentials

```bash
# Get local anon key
supabase status | grep "anon key"
```

Example output:
```
anon key: eyJhbGc...
```

### 3. Test with cURL

**Example: Test generate-queries**

```bash
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/generate-queries' \
  --header 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "project_id": "your-test-project-uuid"
  }'
```

**Example: Test analyze-queries**

```bash
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/analyze-queries' \
  --header 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "project_id": "your-test-project-uuid"
  }'
```

### 4. Test with Frontend

Update your frontend `.env.local` to point to local functions:

```bash
# .env.local (temporary for testing)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_local_anon_key_here
```

Then run your frontend normally:

```bash
npm run dev
```

**Remember to revert `.env.local` back to production values when done testing!**

### 5. Check Logs

Function logs appear in the terminal where you ran `supabase functions serve`.

---

## Deploying Updates

### Deploy Single Function

```bash
# Deploy just the updated function
supabase functions deploy generate-queries

# Deploy with verbose output
supabase functions deploy generate-queries --debug
```

### Deploy Multiple Functions

```bash
# Deploy specific functions
supabase functions deploy generate-queries analyze-queries

# Deploy all functions
supabase functions deploy
```

### Deploy with Environment Variables

If you need to update environment variables at the same time:

```bash
# Update secret and deploy
supabase secrets set GEMINI_API_KEY=new_key_here
supabase functions deploy generate-queries
```

### Deployment Output

Successful deployment looks like:

```
Deploying generate-queries (project ref: xxxxx)
 ✓ Uploaded function bundle
 ✓ Function deployed successfully

Deployment URL:
https://xxxxx.supabase.co/functions/v1/generate-queries
```

---

## Verifying Deployments

### 1. List Deployed Functions

```bash
# List all functions
supabase functions list
```

Output:
```
NAME                    STATUS    VERSION    CREATED AT
generate-queries        active    v42        2025-11-10 10:30:00
analyze-queries         active    v41        2025-11-09 14:20:00
...
```

### 2. Test Deployed Function

**Using Supabase CLI:**

```bash
# Test the deployed function
supabase functions invoke generate-queries \
  --body '{"project_id":"test-uuid"}'
```

**Using cURL:**

```bash
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-queries' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"project_id":"test-uuid"}'
```

### 3. Check Function Logs

```bash
# View recent logs
supabase functions logs generate-queries

# Follow logs in real-time
supabase functions logs generate-queries --follow

# View logs with timestamps
supabase functions logs generate-queries --timestamps
```

### 4. Verify in Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** (left sidebar)
3. Select your function
4. Check:
   - Last deployment time
   - Recent invocations
   - Error rate
   - Response times

---

## Monitoring & Debugging

### View Logs

```bash
# Basic log view
supabase functions logs generate-queries

# Follow logs (updates in real-time)
supabase functions logs generate-queries --follow

# Show last 100 entries
supabase functions logs generate-queries --limit 100

# Filter by time
supabase functions logs generate-queries --since 1h  # Last hour
supabase functions logs generate-queries --since 30m # Last 30 minutes
```

### Debug Common Issues

#### Issue: Function returns 500 error

**Check logs:**
```bash
supabase functions logs generate-queries | grep ERROR
```

**Common causes:**
- Missing environment variables
- Invalid API keys
- Database connection issues
- Syntax errors in code

#### Issue: Function times out

**Symptoms:** 504 Gateway Timeout after 60 seconds

**Solutions:**
1. Check logs for slow operations
2. Optimize database queries
3. Reduce batch sizes
4. Add progress logging:

```typescript
console.log('Step 1: Fetching project...');
// ... operation ...
console.log('Step 2: Calling Gemini API...');
// ... operation ...
```

#### Issue: Environment variable not found

**Error:** `GEMINI_API_KEY environment variable is required`

**Solution:**
```bash
# Set the secret
supabase secrets set GEMINI_API_KEY=your_key_here

# Verify it's set
supabase secrets list

# Redeploy function
supabase functions deploy generate-queries
```

### Enable Debug Logging

Add console.log statements to your function:

```typescript
console.log('Debug: project_id received:', project_id);
console.log('Debug: project data:', JSON.stringify(project));
console.log('Debug: API response:', JSON.stringify(response));
```

These will appear in `supabase functions logs`.

---

## Common Update Scenarios

### Scenario 1: Update AI Prompt

**Goal:** Change how queries are generated by modifying the prompt.

**File:** `supabase/functions/_shared/gemini-helper.ts`

**Steps:**

1. **Edit the prompt function:**
```typescript
export function buildQueryGenerationPrompt(
  project: any,
  count: number
): string {
  return `
You are an expert AEO query generator.

Generate ${count} diverse queries about ${project.company_url}.

NEW INSTRUCTION: Focus more on long-tail queries.

...
  `;
}
```

2. **Test locally:**
```bash
supabase functions serve generate-queries
# ... test with cURL ...
```

3. **Deploy:**
```bash
supabase functions deploy generate-queries
```

4. **Verify:**
```bash
supabase functions logs generate-queries --follow
# ... test from frontend ...
```

---

### Scenario 2: Add New Function Parameter

**Goal:** Add optional `query_count` parameter to `generate-queries`.

**File:** `supabase/functions/generate-queries/index.ts`

**Steps:**

1. **Update function to accept new parameter:**
```typescript
// Parse request body
const { project_id, query_count = 20 } = await req.json();

// Use the parameter
const prompt = buildQueryGenerationPrompt(project, query_count);
```

2. **Test with old API (backward compatibility):**
```bash
curl ... --data '{"project_id":"test-uuid"}'  # Should use default 20
```

3. **Test with new API:**
```bash
curl ... --data '{"project_id":"test-uuid","query_count":50}'
```

4. **Deploy:**
```bash
supabase functions deploy generate-queries
```

---

### Scenario 3: Update Shared Retry Logic

**Goal:** Increase max retries from 3 to 5.

**File:** `supabase/functions/_shared/types.ts`

**Steps:**

1. **Edit default config:**
```typescript
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,  // Changed from 3
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};
```

2. **Test affected functions:**
```bash
# Test all functions that use retry logic
supabase functions serve generate-queries
supabase functions serve analyze-queries
```

3. **Deploy all affected functions:**
```bash
supabase functions deploy generate-queries analyze-queries
```

4. **Monitor logs:**
```bash
supabase functions logs generate-queries --follow
supabase functions logs analyze-queries --follow
```

---

### Scenario 4: Fix a Bug

**Goal:** Fix a bug where empty brand_mentions arrays crash the function.

**File:** `supabase/functions/_shared/validation.ts`

**Steps:**

1. **Identify the bug:**
```typescript
// Before (crashes if empty)
brand_mentions: result.brand_mentions.join(", ")
```

2. **Fix the bug:**
```typescript
// After (handles empty arrays)
brand_mentions: Array.isArray(result.brand_mentions) && result.brand_mentions.length > 0
  ? result.brand_mentions.join(", ")
  : "No brands mentioned"
```

3. **Add test case locally:**
```typescript
// Test with empty array
const testResult = {
  brand_mentions: [],
  source: "test",
  // ...
};
const sanitized = validateAndSanitize(testResult);
console.log('Test result:', sanitized);
```

4. **Deploy fix:**
```bash
supabase functions deploy analyze-queries
```

5. **Verify fix:**
```bash
# Check logs for the fixed behavior
supabase functions logs analyze-queries --follow
```

---

### Scenario 5: Update Database Schema

**Goal:** Add a new column `priority` to queries table and update functions.

**Steps:**

1. **Update database schema:**
```sql
-- Run in Supabase Dashboard → SQL Editor
ALTER TABLE queries ADD COLUMN priority TEXT DEFAULT 'normal';
```

2. **Update function to use new column:**
```typescript
// supabase/functions/analyze-queries/index.ts

const { error: updateError } = await supabase
  .from("queries")
  .update({
    analysis_status: "complete",
    brand_mentions,
    source,
    priority: "high",  // New field
    // ...
  })
  .eq("id", query.id);
```

3. **Test locally with local DB:**
```bash
# Apply migration locally
supabase migration new add_priority_column
# Add SQL to migration file
supabase db reset

# Test function
supabase functions serve analyze-queries
```

4. **Deploy:**
```bash
# Database already updated in step 1
supabase functions deploy analyze-queries
```

---

## Rollback Procedures

### Option 1: Redeploy Previous Version

If you have the previous code in git:

```bash
# Find the previous commit
git log --oneline supabase/functions/generate-queries/

# Checkout previous version
git checkout PREVIOUS_COMMIT supabase/functions/generate-queries/

# Redeploy
supabase functions deploy generate-queries

# Return to current code
git checkout HEAD supabase/functions/generate-queries/
```

### Option 2: Manual Revert

1. **Identify what changed:**
```bash
git diff HEAD~1 supabase/functions/generate-queries/index.ts
```

2. **Manually revert the changes**

3. **Redeploy:**
```bash
supabase functions deploy generate-queries
```

### Option 3: Deploy from Backup

If you keep function backups:

```bash
# Copy backup
cp backup/generate-queries/index.ts supabase/functions/generate-queries/

# Deploy
supabase functions deploy generate-queries
```

### Emergency: Disable Function

If a function is causing critical issues:

**Option A:** Deploy a minimal "maintenance mode" version:

```typescript
// Temporary index.ts
serve(async (req) => {
  return new Response(
    JSON.stringify({
      error: "This function is temporarily unavailable"
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" }
    }
  );
});
```

**Option B:** Remove function invocations from frontend code temporarily.

---

## Best Practices

### 1. Version Control

```bash
# Always commit before deploying
git add supabase/functions/
git commit -m "feat: update generate-queries to support custom query counts"

# Tag major deployments
git tag -a v1.2.0 -m "Deploy edge functions v1.2.0"
git push origin v1.2.0
```

### 2. Test Locally First

```bash
# ALWAYS test locally before deploying
supabase functions serve function-name
# ... run tests ...
supabase functions deploy function-name
```

### 3. Deploy One Function at a Time

```bash
# Deploy and verify one by one
supabase functions deploy generate-queries
# ... test and monitor ...
supabase functions deploy analyze-queries
# ... test and monitor ...
```

### 4. Monitor After Deployment

```bash
# Watch logs for 5-10 minutes after deployment
supabase functions logs function-name --follow
```

Check for:
- Error rate increase
- Performance degradation
- Unexpected behavior

### 5. Use Feature Flags

For major changes, add feature flags:

```typescript
const USE_NEW_LOGIC = Deno.env.get("USE_NEW_LOGIC") === "true";

if (USE_NEW_LOGIC) {
  // New behavior
} else {
  // Old behavior
}
```

Enable gradually:
```bash
# Test with new logic
supabase secrets set USE_NEW_LOGIC=true
# ... monitor ...
# Roll back if needed
supabase secrets set USE_NEW_LOGIC=false
```

### 6. Document Changes

Update this README and function comments:

```typescript
/**
 * generateQueries - Edge Function
 *
 * Version: 2.1.0
 * Last Updated: 2025-11-10
 *
 * Changelog:
 * - 2.1.0: Added query_count parameter support
 * - 2.0.0: Added retry logic and rate limiting
 */
```

### 7. Keep Shared Code Stable

Changes to `_shared/` affect multiple functions:

- Test ALL affected functions
- Deploy ALL affected functions together
- Consider making shared code backward compatible

### 8. Environment Variables

```bash
# Document all required environment variables
supabase secrets list

# Never commit secrets to git
# Use .env.example files for documentation
```

### 9. Error Handling

Always include comprehensive error handling:

```typescript
try {
  // ... operation ...
} catch (error) {
  console.error('Error in operation:', error);
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
```

### 10. Performance Monitoring

Add timing logs:

```typescript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;
console.log(`Operation completed in ${duration}ms`);
```

---

## Quick Reference

### Common Commands

```bash
# Local development
supabase start                                    # Start local stack
supabase functions serve function-name            # Serve locally
supabase stop                                     # Stop local stack

# Deployment
supabase functions deploy function-name           # Deploy single function
supabase functions deploy                         # Deploy all functions

# Monitoring
supabase functions list                           # List all functions
supabase functions logs function-name             # View logs
supabase functions logs function-name --follow    # Follow logs

# Secrets
supabase secrets list                             # List secrets
supabase secrets set KEY=value                    # Set secret
supabase secrets unset KEY                        # Remove secret

# Project
supabase link --project-ref ref                   # Link project
supabase status                                   # Check status
```

### Testing URLs

```bash
# Local
http://localhost:54321/functions/v1/function-name

# Production
https://YOUR_PROJECT_REF.supabase.co/functions/v1/function-name
```

---

## Additional Resources

- **[EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md)** - Complete function documentation and API reference
- **[Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)** - Official documentation
- **[Deno Manual](https://deno.land/manual)** - Deno runtime documentation
- **[Deno Deploy Docs](https://deno.com/deploy/docs)** - Deployment platform docs

---

## Troubleshooting

### Can't deploy: "Not authenticated"

```bash
supabase login
supabase link --project-ref your-ref
```

### Function not updating after deployment

Clear the edge cache:
1. Wait 2-3 minutes for propagation
2. Or force refresh by incrementing version in a comment

### Local function can't connect to database

```bash
# Check local Supabase is running
supabase status

# Restart if needed
supabase stop
supabase start
```

### TypeScript errors in editor

Install Deno VSCode extension and add to workspace settings:

```json
{
  "deno.enable": true,
  "deno.unstable": true,
  "deno.importMap": "./supabase/functions/import_map.json"
}
```

---

## Support

For issues or questions:
1. Check [EDGE_FUNCTIONS.md](./EDGE_FUNCTIONS.md) for API documentation
2. Check [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) for common issues
3. Review Supabase Dashboard → Edge Functions → Logs
4. Check [Supabase Discord](https://discord.supabase.com)

---

**Last Updated:** 2025-11-10
**Function Version:** 2.0
**Maintained by:** AEO Presence Team
