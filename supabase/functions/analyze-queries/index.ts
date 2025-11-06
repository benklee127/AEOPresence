// analyzeQueries - Supabase Edge Function
// Analyzes queries to determine brand mentions, sources, and refine categorization
// Now with robust retry logic and rate limiting!

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeQueryWithRetry, rateLimiter } from "../_shared/gemini-helper.ts";
import { QueryAnalysisSchema, QueryMetadata, DEFAULT_RETRY_CONFIG } from "../_shared/types.ts";
import { generateFallbackResult, sanitizeErrorMessage } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { project_id, query_ids } = await req.json();

    if (!project_id) {
      throw new Error("project_id is required");
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from("query_projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projectError) throw projectError;
    if (!project) throw new Error("Project not found");

    // Fetch pending queries
    let query = supabase
      .from("queries")
      .select("*")
      .eq("project_id", project_id)
      .eq("analysis_status", "pending");

    // If specific query_ids provided, filter by those
    if (query_ids && query_ids.length > 0) {
      query = query.in("id", query_ids);
    }

    const { data: queries, error: queriesError } = await query;

    if (queriesError) throw queriesError;
    if (!queries || queries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          count: 0,
          message: "No pending queries to analyze",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`📊 Starting analysis of ${queries.length} queries for project ${project_id}`);
    console.log(`⚙️  Rate limiter status:`, rateLimiter.getStatus());

    let analyzed = 0;
    let errors = 0;
    let retried = 0;

    // Process queries in batches of 5 to manage concurrency
    const batchSize = 5;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(queries.length / batchSize)} (${batch.length} queries)`);

      // Process batch in parallel with retry logic
      await Promise.all(
        batch.map(async (queryRecord) => {
          const startTime = Date.now();
          let attemptCount = 0;

          try {
            // Update status to 'analyzing'
            await supabase
              .from("queries")
              .update({
                analysis_status: "analyzing",
                metadata: {
                  started_at: new Date().toISOString(),
                  attempt_count: attemptCount,
                } as QueryMetadata,
              })
              .eq("id", queryRecord.id);

            // Analyze query with retry logic and rate limiting
            const analysis: QueryAnalysisSchema = await analyzeQueryWithRetry(
              queryRecord,
              project,
              geminiApiKey,
              DEFAULT_RETRY_CONFIG
            );

            const duration = Date.now() - startTime;

            // Update query with analysis results
            await supabase
              .from("queries")
              .update({
                brand_mentions: analysis.brand_mentions.join(", "),
                source: analysis.source,
                query_type: analysis.query_type,
                query_category: analysis.query_category,
                analysis_status: "complete",
                metadata: {
                  completed_at: new Date().toISOString(),
                  duration_ms: duration,
                  attempt_count: attemptCount,
                } as QueryMetadata,
              })
              .eq("id", queryRecord.id);

            analyzed++;
            console.log(`  ✅ Query ${queryRecord.query_id}: ${queryRecord.query_text.substring(0, 50)}... (${duration}ms)`);

          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = sanitizeErrorMessage(error);

            console.error(`  ❌ Query ${queryRecord.query_id} failed after retries:`, errorMessage);

            // Generate fallback result for critical fields
            const fallback = generateFallbackResult(queryRecord);

            // Update with fallback values and error status
            await supabase
              .from("queries")
              .update({
                brand_mentions: fallback.brand_mentions.join(", "),
                source: fallback.source,
                query_type: fallback.query_type,
                query_category: fallback.query_category,
                analysis_status: "error",
                metadata: {
                  error_message: errorMessage,
                  failed_at: new Date().toISOString(),
                  duration_ms: duration,
                  attempt_count: DEFAULT_RETRY_CONFIG.maxRetries + 1,
                } as QueryMetadata,
              })
              .eq("id", queryRecord.id);

            errors++;
          }
        })
      );

      // Log batch completion
      console.log(`  Batch complete: ${analyzed} analyzed, ${errors} errors`);
      console.log(`  Rate limiter:`, rateLimiter.getStatus());

      // Small delay between batches (rate limiter handles most of this)
      if (i + batchSize < queries.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Check if all queries for the project are complete
    const { data: remainingQueries } = await supabase
      .from("queries")
      .select("id")
      .eq("project_id", project_id)
      .in("analysis_status", ["pending", "analyzing"]);

    // Update project status if all complete
    if (!remainingQueries || remainingQueries.length === 0) {
      console.log(`\n🎉 All queries complete for project ${project_id}, updating project status`);

      await supabase
        .from("query_projects")
        .update({
          status: "analysis_complete",
          current_step: 3,
        })
        .eq("id", project_id);
    } else {
      console.log(`\n⏳ ${remainingQueries.length} queries still pending/analyzing`);
    }

    const successRate = analyzed / (analyzed + errors) * 100;
    const message = errors > 0
      ? `Successfully analyzed ${analyzed} queries with ${errors} errors (${successRate.toFixed(1)}% success rate)`
      : `Successfully analyzed ${analyzed} queries (100% success rate)`;

    console.log(`\n✨ Analysis complete: ${message}`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed,
        errors,
        retried,
        total: queries.length,
        successRate: successRate.toFixed(1),
        message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Error in analyze-queries:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
