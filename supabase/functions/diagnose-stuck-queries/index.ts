// diagnoseStuckQueries - Supabase Edge Function
// Diagnoses why queries are stuck and provides insights

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from("query_projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projectError) throw projectError;
    if (!project) throw new Error("Project not found");

    // Get queries by status
    const { data: queries, error: queriesError } = await supabase
      .from("queries")
      .select("id, analysis_status, updated_at")
      .eq("project_id", project_id);

    if (queriesError) throw queriesError;

    // Analyze query statuses
    const statusCounts = {
      pending: 0,
      analyzing: 0,
      complete: 0,
      error: 0,
    };

    const stuckQueries: any[] = [];
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    queries?.forEach((query) => {
      statusCounts[query.analysis_status as keyof typeof statusCounts]++;

      // Check if query is stuck (analyzing for > 5 minutes)
      if (query.analysis_status === "analyzing") {
        const updatedAt = new Date(query.updated_at).getTime();
        if (updatedAt < fiveMinutesAgo) {
          stuckQueries.push({
            id: query.id,
            stuck_duration_seconds: Math.floor((now - updatedAt) / 1000),
            updated_at: query.updated_at,
          });
        }
      }
    });

    // Diagnose issues
    const diagnostics: any[] = [];

    if (stuckQueries.length > 0) {
      diagnostics.push({
        issue: "Stuck queries detected",
        severity: "high",
        count: stuckQueries.length,
        description: `${stuckQueries.length} queries have been in 'analyzing' state for more than 5 minutes`,
        recommendation: "Run resetStuckQueries to reset them to pending status",
      });
    }

    if (statusCounts.error > 0) {
      diagnostics.push({
        issue: "Queries with errors",
        severity: "medium",
        count: statusCounts.error,
        description: `${statusCounts.error} queries failed during analysis`,
        recommendation:
          "Check Supabase logs for error details. May need to retry or adjust query text.",
      });
    }

    if (statusCounts.pending > 0 && project.status === "queries_generated") {
      diagnostics.push({
        issue: "Pending queries not being analyzed",
        severity: "medium",
        count: statusCounts.pending,
        description: `${statusCounts.pending} queries are pending analysis`,
        recommendation: "Run analyzeQueries to start analysis",
      });
    }

    // Check for rate limiting potential
    if (queries && queries.length > 100) {
      diagnostics.push({
        issue: "Large query set",
        severity: "low",
        count: queries.length,
        description: "Large number of queries may hit API rate limits",
        recommendation:
          "Analysis runs in batches of 5 with 2-second delays to avoid rate limits",
      });
    }

    // Overall health status
    const totalQueries = queries?.length || 0;
    const completionRate =
      totalQueries > 0
        ? Math.round((statusCounts.complete / totalQueries) * 100)
        : 0;

    let healthStatus = "healthy";
    if (stuckQueries.length > 0 || statusCounts.error > 5) {
      healthStatus = "unhealthy";
    } else if (statusCounts.error > 0 || stuckQueries.length > 0) {
      healthStatus = "degraded";
    }

    return new Response(
      JSON.stringify({
        success: true,
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          current_step: project.current_step,
        },
        health_status: healthStatus,
        completion_rate: completionRate,
        query_counts: statusCounts,
        stuck_queries: stuckQueries,
        diagnostics,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in diagnose-stuck-queries:", error);
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
