# Backend Functions - Deployment Guide

✅ **All backend functions have been implemented as Supabase Edge Functions!**

This guide explains how to deploy the functions to your Supabase project using the Supabase CLI.

## 🎯 Implemented Functions

All 5 backend functions are ready to deploy:

1. ✅ **generateQueries** - Generates queries based on project configuration using Gemini AI
2. ✅ **analyzeQueries** - Analyzes queries to determine type, category, brand mentions, sources
3. ✅ **exportStep3Report** - Exports analysis results as CSV or JSON
4. ✅ **resetStuckQueries** - Resets queries stuck in analyzing state
5. ✅ **diagnoseStuckQueries** - Diagnoses stuck queries and provides health status

**Location**: `supabase/functions/`

```
supabase/functions/
├── generate-queries/index.ts
├── analyze-queries/index.ts
├── export-step3-report/index.ts
├── reset-stuck-queries/index.ts
└── diagnose-stuck-queries/index.ts
```

---

## 🚀 Deployment Guide

### Prerequisites

1. **Supabase CLI** installed
2. **Supabase project** created and linked
3. **Gemini API key** for LLM operations

### Step 1: Install Supabase CLI

```bash
# Install globally
npm install -g supabase

# Verify installation
supabase --version
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate with your Supabase account.

### Step 3: Link Your Project

```bash
# Link to your existing project
supabase link --project-ref your-project-ref
```

**Finding your project ref:**
- Go to your Supabase dashboard
- The project ref is in your project URL: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`
- Or find it in Settings → General → Reference ID

### Step 4: Set Environment Variables (Important!)

The edge functions need environment variables to work. Set them using:

```bash
# Set Gemini API key (required for generateQueries and analyzeQueries)
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

# Verify secrets are set
supabase secrets list
```

**Environment Variables Required:**
- `GEMINI_API_KEY` - Your Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase

### Step 5: Deploy All Functions

Deploy all 5 functions at once:

```bash
# Deploy all functions from the supabase/functions directory
supabase functions deploy generate-queries
supabase functions deploy analyze-queries
supabase functions deploy export-step3-report
supabase functions deploy reset-stuck-queries
supabase functions deploy diagnose-stuck-queries
```

Or deploy them all in one command:

```bash
# Deploy all functions
for func in generate-queries analyze-queries export-step3-report reset-stuck-queries diagnose-stuck-queries; do
  supabase functions deploy $func
done
```

### Step 6: Verify Deployment

Check that your functions are deployed:

```bash
# List all deployed functions
supabase functions list
```

You should see all 5 functions listed with their URLs.

---

## 🧪 Testing the Functions

### Test generateQueries

```bash
# Create a test project first in your app, then:
supabase functions invoke generate-queries \
  --body '{"project_id":"your-project-uuid"}'
```

### Test analyzeQueries

```bash
supabase functions invoke analyze-queries \
  --body '{"project_id":"your-project-uuid"}'
```

### Test resetStuckQueries

```bash
supabase functions invoke reset-stuck-queries \
  --body '{"project_id":"your-project-uuid","max_duration_seconds":300}'
```

### Test diagnoseStuckQueries

```bash
supabase functions invoke diagnose-stuck-queries \
  --body '{"project_id":"your-project-uuid"}'
```

### Test exportStep3Report

```bash
supabase functions invoke export-step3-report \
  --body '{"project_id":"your-project-uuid","format":"json"}'
```

---

## 📊 Function Details

### 1. generateQueries

**What it does:**
- Fetches project configuration from database
- Builds an AI prompt based on project settings
- Calls Gemini API to generate queries
- Inserts queries into the database
- Updates project status to 'queries_generated'

**Parameters:**
```typescript
{
  project_id: string  // UUID of the query project
}
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "message": "Successfully generated 20 queries"
}
```

**Requirements:**
- `GEMINI_API_KEY` environment variable must be set
- Project must exist in database
- Project must have valid configuration

---

### 2. analyzeQueries

**What it does:**
- Fetches pending queries for a project
- Analyzes each query using Gemini AI
- Extracts brand mentions and sources
- Updates queries with analysis results
- Processes in batches of 5 to avoid rate limits
- Updates project status to 'analysis_complete' when done

**Parameters:**
```typescript
{
  project_id: string,        // UUID of the query project
  query_ids?: string[]       // Optional: specific queries to analyze
}
```

**Response:**
```json
{
  "success": true,
  "analyzed": 18,
  "errors": 2,
  "message": "Successfully analyzed 18 queries (2 errors)"
}
```

**Features:**
- Batch processing (5 queries at a time)
- 2-second delay between batches
- Automatic error handling
- Updates query status throughout process

---

### 3. exportStep3Report

**What it does:**
- Fetches project and all queries
- Calculates statistics (brand mentions, sources, categories)
- Generates downloadable report in CSV or JSON format

**Parameters:**
```typescript
{
  project_id: string,        // UUID of the query project
  format: "json" | "csv"     // Report format (default: "json")
}
```

**Response:**
Returns the report data with appropriate headers for download.

**CSV Format:**
```
Query ID,Query Text,Query Type,Query Category,...
1,"How to...",Educational,Industry monitoring,...
```

**JSON Format:**
```json
{
  "project": { "id": "...", "name": "..." },
  "statistics": { "total_queries": 20, ... },
  "queries": [...],
  "export_date": "2025-11-05T..."
}
```

---

### 4. resetStuckQueries

**What it does:**
- Finds queries stuck in 'analyzing' state
- Checks if they've been stuck for > 5 minutes (configurable)
- Resets them to 'pending' status
- Returns list of reset queries

**Parameters:**
```typescript
{
  project_id: string,
  max_duration_seconds?: number  // Default: 300 (5 minutes)
}
```

**Response:**
```json
{
  "success": true,
  "reset_count": 3,
  "message": "Reset 3 stuck queries to pending",
  "reset_queries": [
    {
      "id": "uuid",
      "query_text": "...",
      "stuck_since": "2025-11-05T..."
    }
  ]
}
```

---

### 5. diagnoseStuckQueries

**What it does:**
- Analyzes query statuses for a project
- Identifies stuck queries
- Calculates completion rates
- Provides health status and diagnostics
- Suggests remediation actions

**Parameters:**
```typescript
{
  project_id: string
}
```

**Response:**
```json
{
  "success": true,
  "project": { "id": "...", "name": "...", "status": "..." },
  "health_status": "healthy",
  "completion_rate": 85,
  "query_counts": {
    "pending": 2,
    "analyzing": 1,
    "complete": 17,
    "error": 0
  },
  "stuck_queries": [],
  "diagnostics": [
    {
      "issue": "...",
      "severity": "low",
      "recommendation": "..."
    }
  ]
}
```

---

## 🔧 Troubleshooting

### Function fails with "GEMINI_API_KEY is required"

**Solution:**
```bash
supabase secrets set GEMINI_API_KEY=your_actual_key_here
```

### Function returns 401 Unauthorized

**Check:**
1. Is your Supabase project linked correctly?
2. Are you using the correct authorization header?
3. Run: `supabase link --project-ref your-ref`

### Function times out

**Possible causes:**
- Large query sets (>100 queries)
- Gemini API rate limiting
- Network issues

**Solutions:**
- Process queries in smaller batches
- Use `query_ids` parameter to analyze specific queries
- Check Supabase function logs: `supabase functions logs function-name`

### Cannot find function

**Verify deployment:**
```bash
supabase functions list
```

If not listed, redeploy:
```bash
supabase functions deploy function-name
```

### View Function Logs

```bash
# View logs for a specific function
supabase functions logs generate-queries

# Follow logs in real-time
supabase functions logs generate-queries --follow
```

---

## 📝 Updating Functions

If you make changes to the function code:

1. **Edit the TypeScript file** in `supabase/functions/function-name/index.ts`
2. **Redeploy**:
   ```bash
   supabase functions deploy function-name
   ```
3. **Test** the updated function

---

## 🔒 Security Notes

- Functions use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- All functions require authentication via Authorization header
- CORS is enabled for all functions
- Secrets are encrypted and not visible in logs

---

## 💰 Cost Considerations

### Supabase Edge Functions
- **Free tier**: 500,000 invocations/month
- **Pro plan**: 2 million invocations/month
- Additional: $2 per million invocations

### Gemini API
- **Free tier**: 60 requests per minute
- Check current pricing: [Google AI Pricing](https://ai.google.dev/pricing)

**Cost Optimization Tips:**
- Generate queries in smaller batches (20 instead of 200)
- Analyze queries in batches (already implemented)
- Cache analysis results
- Monitor function invocation counts

---

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Deno Documentation](https://deno.land/manual)
- [Gemini API Documentation](https://ai.google.dev/docs)

---

## ✅ Deployment Checklist

Before going to production:

- [ ] Supabase CLI installed and authenticated
- [ ] Project linked via `supabase link`
- [ ] `GEMINI_API_KEY` secret set
- [ ] All 5 functions deployed successfully
- [ ] Functions tested with real project data
- [ ] Database migrations applied
- [ ] `.env.local` configured in frontend
- [ ] Function logs reviewed for errors
- [ ] Rate limits understood and monitored

---

**Last Updated**: 2025-11-05
**Functions Version**: 1.0.0
**Status**: ✅ Ready for Production
