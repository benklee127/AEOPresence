// resetStuckQueries - Supabase Edge Function
// Resets queries that are stuck in 'analyzing' state

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
    const { project_id, max_duration_seconds = 300 } = await req.json();

    if (!project_id) {
      throw new Error("project_id is required");
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate cutoff time
    const cutoffTime = new Date(
      Date.now() - max_duration_seconds * 1000
    ).toISOString();

    // Find stuck queries
    const { data: stuckQueries, error: findError } = await supabase
      .from("queries")
      .select("id, query_text, updated_at")
      .eq("project_id", project_id)
      .eq("analysis_status", "analyzing")
      .lt("updated_at", cutoffTime);

    if (findError) throw findError;

    if (!stuckQueries || stuckQueries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          reset_count: 0,
          message: "No stuck queries found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Reset stuck queries to pending
    const { error: updateError } = await supabase
      .from("queries")
      .update({ analysis_status: "pending" })
      .in(
        "id",
        stuckQueries.map((q) => q.id)
      );

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        reset_count: stuckQueries.length,
        message: `Reset ${stuckQueries.length} stuck queries to pending`,
        reset_queries: stuckQueries.map((q) => ({
          id: q.id,
          query_text: q.query_text,
          stuck_since: q.updated_at,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in reset-stuck-queries:", error);
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
