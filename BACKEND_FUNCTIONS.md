# Backend Functions Implementation Guide

This guide will help you implement the backend functions that were previously provided by Base44. These functions need to be implemented as serverless functions to complete your migration.

## 🎯 Overview

The following backend functions need to be implemented:

1. **generateQueries** - Generates queries based on project configuration
2. **analyzeQueries** - Analyzes queries to determine type, category, brand mentions, etc.
3. **exportStep3Report** - Exports analysis results as a report
4. **resetStuckQueries** - Resets queries that are stuck in analyzing state
5. **diagnoseStuckQueries** - Diagnoses why queries are stuck

## 📋 Implementation Options

### Option 1: Supabase Edge Functions (Recommended)

Supabase Edge Functions run on Deno and are globally distributed.

**Advantages:**
- Integrated with your Supabase project
- Automatic authentication
- Free tier available
- TypeScript/JavaScript support
- Global distribution via Deno Deploy

**Setup:**
```bash
# Initialize edge functions
supabase functions new generate-queries
supabase functions new analyze-queries
supabase functions new export-step3-report
supabase functions new reset-stuck-queries
supabase functions new diagnose-stuck-queries
```

### Option 2: Vercel Serverless Functions

If you're deploying on Vercel.

**Setup:**
Create `api/` directory in project root with function files.

### Option 3: Cloudflare Workers

Fast, globally distributed serverless functions.

### Option 4: AWS Lambda

Enterprise-grade serverless with extensive AWS integration.

## 🔧 Function Specifications

### 1. generateQueries

**Purpose**: Generate AEO queries based on project configuration using an LLM.

**Input Parameters**:
```javascript
{
  project_id: string,           // UUID of the query project
  company_url: string,          // Company website URL
  competitor_urls: string[],    // Array of competitor URLs
  audience: string[],           // Target audiences
  themes: string,               // Focus areas/topics
  query_mix_type: string,       // 'Mixed' or other
  educational_ratio: number,    // 0-100
  service_ratio: number,        // 0-100
  manual_queries: string[],     // User-provided queries
  sample_size: number          // Number of queries to generate (20 or 200)
}
```

**Process**:
1. Fetch project from database using `project_id`
2. Build a prompt for the LLM with project configuration
3. Request LLM to generate queries matching the specifications
4. Parse LLM response into structured query objects
5. Bulk insert queries into the `queries` table with `query_id` sequence
6. Update project `status` to 'queries_generated'
7. Update project `total_queries` count
8. Return success response

**LLM Prompt Template**:
```
Generate [sample_size] Answer Engine Optimization (AEO) queries for analysis.

Company: [company_url]
Competitors: [competitor_urls]
Target Audience: [audience]
Focus Areas: [themes]
Query Mix: [educational_ratio]% Educational, [service_ratio]% Service-Aligned

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

Output as JSON array with format:
[
  {
    "query_text": "...",
    "query_type": "Educational" or "Service-Aligned",
    "query_category": "...",
    "query_format": "Natural-language questions" or "Keyword phrases",
    "target_audience": "..."
  }
]
```

**Example Implementation (Supabase Edge Function)**:
```typescript
// supabase/functions/generate-queries/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { project_id, sample_size } = await req.json()

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('query_projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (projectError) throw projectError

    // Update status to generating
    await supabase
      .from('query_projects')
      .update({ status: 'generating' })
      .eq('id', project_id)

    // Call LLM to generate queries (implement your LLM call here)
    const prompt = buildPrompt(project, sample_size)
    const generatedQueries = await callLLM(prompt)

    // Insert queries
    const queriesWithProjectId = generatedQueries.map((q, index) => ({
      ...q,
      project_id: project_id,
      query_id: index + 1,
      analysis_status: 'pending'
    }))

    const { error: insertError } = await supabase
      .from('queries')
      .insert(queriesWithProjectId)

    if (insertError) throw insertError

    // Update project
    await supabase
      .from('query_projects')
      .update({
        status: 'queries_generated',
        total_queries: generatedQueries.length,
        current_step: 2
      })
      .eq('id', project_id)

    return new Response(
      JSON.stringify({ success: true, count: generatedQueries.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### 2. analyzeQueries

**Purpose**: Analyze generated queries to identify brand mentions, sources, and refine categorization.

**Input Parameters**:
```javascript
{
  project_id: string,  // UUID of the query project
  query_ids?: string[] // Optional: specific query IDs to analyze
}
```

**Process**:
1. Fetch queries with `analysis_status = 'pending'` for the project
2. For each query:
   - Update `analysis_status` to 'analyzing'
   - Call LLM to analyze the query
   - Extract brand mentions from the response
   - Identify likely sources (forums, documentation, etc.)
   - Update query with analysis results
   - Set `analysis_status` to 'complete'
3. When all queries complete, update project `status` to 'analysis_complete'
4. Return analysis summary

**LLM Prompt Template**:
```
Analyze this AEO query and provide structured information:

Query: [query_text]
Query Type: [query_type]
Category: [query_category]
Target Audience: [target_audience]

Company: [company_url]
Competitors: [competitor_urls]

Please analyze:
1. Which brands would likely be mentioned in answers to this query?
2. What sources (websites, platforms) would typically answer this query?
3. Confirm if the query type and category are correct

Output as JSON:
{
  "brand_mentions": ["Brand1", "Brand2", ...],
  "source": "Source name or platform",
  "query_type": "Educational" or "Service-Aligned",
  "query_category": "..."
}
```

**Example Implementation**:
```typescript
// supabase/functions/analyze-queries/index.ts
serve(async (req) => {
  const { project_id } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Fetch pending queries
  const { data: queries } = await supabase
    .from('queries')
    .select('*')
    .eq('project_id', project_id)
    .eq('analysis_status', 'pending')

  // Analyze each query
  for (const query of queries) {
    await supabase
      .from('queries')
      .update({ analysis_status: 'analyzing' })
      .eq('id', query.id)

    try {
      const analysis = await analyzeSingleQuery(query, project)

      await supabase
        .from('queries')
        .update({
          brand_mentions: analysis.brand_mentions.join(','),
          source: analysis.source,
          query_type: analysis.query_type,
          query_category: analysis.query_category,
          analysis_status: 'complete'
        })
        .eq('id', query.id)
    } catch (error) {
      await supabase
        .from('queries')
        .update({ analysis_status: 'error' })
        .eq('id', query.id)
    }
  }

  // Update project status
  await supabase
    .from('query_projects')
    .update({
      status: 'analysis_complete',
      current_step: 3
    })
    .eq('id', project_id)

  return new Response(JSON.stringify({ success: true }))
})
```

### 3. exportStep3Report

**Purpose**: Generate a downloadable report of analysis results.

**Input Parameters**:
```javascript
{
  project_id: string,  // UUID of the query project
  format: 'pdf' | 'csv' | 'json'
}
```

**Process**:
1. Fetch project and all queries
2. Compile statistics and visualizations
3. Generate report in requested format
4. Return download URL or file data

**Note**: This might be better implemented client-side using existing PDF export functionality.

### 4. resetStuckQueries

**Purpose**: Reset queries that are stuck in 'analyzing' state.

**Input Parameters**:
```javascript
{
  project_id: string,
  max_duration_seconds?: number // Default: 300 (5 minutes)
}
```

**Process**:
1. Find queries with `analysis_status = 'analyzing'`
2. Check if `updated_at` is older than `max_duration_seconds`
3. Reset those queries to `analysis_status = 'pending'`
4. Return count of reset queries

**Example Implementation**:
```typescript
serve(async (req) => {
  const { project_id, max_duration_seconds = 300 } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const cutoffTime = new Date(Date.now() - max_duration_seconds * 1000).toISOString()

  const { data: stuckQueries } = await supabase
    .from('queries')
    .select('id')
    .eq('project_id', project_id)
    .eq('analysis_status', 'analyzing')
    .lt('updated_at', cutoffTime)

  if (stuckQueries && stuckQueries.length > 0) {
    const { error } = await supabase
      .from('queries')
      .update({ analysis_status: 'pending' })
      .in('id', stuckQueries.map(q => q.id))

    if (error) throw error
  }

  return new Response(
    JSON.stringify({
      success: true,
      reset_count: stuckQueries?.length ?? 0
    })
  )
})
```

### 5. diagnoseStuckQueries

**Purpose**: Diagnose why queries are stuck and provide insights.

**Input Parameters**:
```javascript
{
  project_id: string
}
```

**Process**:
1. Identify stuck queries (analyzing > 5 minutes)
2. Check for common issues:
   - Rate limiting
   - API errors
   - Database locks
   - Network issues
3. Return diagnostic information

## 🔌 Integration with Custom SDK

### Update SDK to Call Your Functions

Once you've deployed your functions, update the custom SDK:

```javascript
// src/lib/custom-sdk.js
functions: {
  generateQueries: async (params) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(params)
    })
    return response.json()
  },

  analyzeQueries: async (params) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(params)
    })
    return response.json()
  },

  // ... implement others similarly
}
```

## 🧪 Testing

Test each function individually:

```bash
# Test with Supabase CLI
supabase functions serve generate-queries

# Then call it
curl -X POST http://localhost:54321/functions/v1/generate-queries \
  -H "Content-Type: application/json" \
  -d '{"project_id": "your-project-id", "sample_size": 20}'
```

## 📝 Additional Notes

### Rate Limiting
- Implement rate limiting to prevent abuse
- Use exponential backoff for LLM API calls
- Consider batch processing for large query sets

### Error Handling
- Implement proper error handling and logging
- Set queries to 'error' status if analysis fails
- Provide meaningful error messages

### Performance
- Process queries in batches (e.g., 5-10 at a time)
- Use parallel processing where possible
- Implement progress tracking

### Security
- Always use service role for server-side operations
- Validate all input parameters
- Implement authentication checks

## 📚 Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [AWS Lambda](https://aws.amazon.com/lambda/)

---

**Need Help?** Refer to the original Base44 implementation for business logic details, and adapt it to your chosen serverless platform.
