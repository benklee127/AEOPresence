// generateQueries - Supabase Edge Function
// Generates AEO queries based on project configuration using LLM with retry logic and rate limiting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateQueriesWithRetry,
  buildQueryGenerationPrompt,
  rateLimiter,
} from "../_shared/gemini-helper.ts";
import {
  DEFAULT_RETRY_CONFIG,
  GeneratedQuerySchema,
} from "../_shared/types.ts";
import { sanitizeErrorMessage } from "../_shared/validation.ts";

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
    const { project_id } = await req.json();

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

    // Update project status to 'generating'
    await supabase
      .from("query_projects")
      .update({ status: "generating" })
      .eq("id", project_id);

    console.log(`🚀 Starting query generation for project: ${project.name}`);
    console.log(`📊 Target: ${project.total_queries || 20} queries`);

    const startTime = Date.now();

    // Build prompt and generate queries with retry logic
    const prompt = buildQueryGenerationPrompt(project);

    let generatedQueries: GeneratedQuerySchema[];
    try {
      // Use rate limiter to throttle request
      generatedQueries = await rateLimiter.throttle(async () => {
        return await generateQueriesWithRetry(
          prompt,
          geminiApiKey,
          DEFAULT_RETRY_CONFIG
        );
      });
    } catch (error) {
      // Update project status to 'error' if generation fails
      await supabase
        .from("query_projects")
        .update({
          status: "error",
          metadata: {
            error_message: sanitizeErrorMessage(error),
            failed_at: new Date().toISOString(),
          },
        })
        .eq("id", project_id);

      throw new Error(
        `Query generation failed after ${DEFAULT_RETRY_CONFIG.maxRetries + 1} attempts: ${error.message}`
      );
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Generated ${generatedQueries.length} queries in ${duration}ms`);

    // Insert queries into database
    const queriesWithProjectId = generatedQueries.map((q, index) => ({
      project_id: project_id,
      query_id: index + 1,
      query_text: q.query_text,
      query_type: q.query_type,
      query_category: q.query_category,
      query_format: q.query_format,
      target_audience: q.target_audience,
      analysis_status: "pending",
    }));

    const { error: insertError } = await supabase
      .from("queries")
      .insert(queriesWithProjectId);

    if (insertError) {
      await supabase
        .from("query_projects")
        .update({
          status: "error",
          metadata: {
            error_message: `Database insert failed: ${insertError.message}`,
            failed_at: new Date().toISOString(),
          },
        })
        .eq("id", project_id);

      throw new Error(`Failed to insert queries: ${insertError.message}`);
    }

    // Update project status to 'queries_generated'
    await supabase
      .from("query_projects")
      .update({
        status: "queries_generated",
        total_queries: generatedQueries.length,
        current_step: 2,
        metadata: {
          generated_at: new Date().toISOString(),
          generation_duration_ms: duration,
        },
      })
      .eq("id", project_id);

    console.log(`✅ Successfully saved ${generatedQueries.length} queries to database`);

    return new Response(
      JSON.stringify({
        success: true,
        count: generatedQueries.length,
        message: `Successfully generated ${generatedQueries.length} queries`,
        duration_ms: duration,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Error in generate-queries:", error);
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
