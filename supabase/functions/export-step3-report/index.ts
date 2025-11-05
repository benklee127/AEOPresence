// exportStep3Report - Supabase Edge Function
// Exports analysis results as CSV or JSON for download

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
    const { project_id, format = "json" } = await req.json();

    if (!project_id) {
      throw new Error("project_id is required");
    }

    if (!["json", "csv"].includes(format)) {
      throw new Error("format must be 'json' or 'csv'");
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

    // Fetch all queries for this project
    const { data: queries, error: queriesError } = await supabase
      .from("queries")
      .select("*")
      .eq("project_id", project_id)
      .order("query_id", { ascending: true });

    if (queriesError) throw queriesError;

    // Calculate statistics
    const stats = calculateStatistics(queries || []);

    if (format === "json") {
      return new Response(
        JSON.stringify(
          {
            project: {
              id: project.id,
              name: project.name,
              status: project.status,
              company_url: project.company_url,
              created_at: project.created_at,
            },
            statistics: stats,
            queries: queries,
            export_date: new Date().toISOString(),
          },
          null,
          2
        ),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="aeo-report-${project.name
              .toLowerCase()
              .replace(/\s+/g, "-")}-${Date.now()}.json"`,
          },
          status: 200,
        }
      );
    } else {
      // CSV format
      const csv = generateCSV(project, queries || [], stats);

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="aeo-report-${project.name
            .toLowerCase()
            .replace(/\s+/g, "-")}-${Date.now()}.csv"`,
        },
        status: 200,
      });
    }
  } catch (error) {
    console.error("Error in export-step3-report:", error);
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

function calculateStatistics(queries: any[]) {
  const stats: any = {
    total_queries: queries.length,
    by_type: {},
    by_category: {},
    by_status: {},
    brand_mentions: {},
    sources: {},
  };

  queries.forEach((query) => {
    // Count by type
    if (query.query_type) {
      stats.by_type[query.query_type] =
        (stats.by_type[query.query_type] || 0) + 1;
    }

    // Count by category
    if (query.query_category) {
      stats.by_category[query.query_category] =
        (stats.by_category[query.query_category] || 0) + 1;
    }

    // Count by status
    if (query.analysis_status) {
      stats.by_status[query.analysis_status] =
        (stats.by_status[query.analysis_status] || 0) + 1;
    }

    // Count brand mentions
    if (query.brand_mentions) {
      const brands = query.brand_mentions.split(",").map((b: string) => b.trim());
      brands.forEach((brand: string) => {
        if (brand) {
          stats.brand_mentions[brand] =
            (stats.brand_mentions[brand] || 0) + 1;
        }
      });
    }

    // Count sources
    if (query.source) {
      stats.sources[query.source] = (stats.sources[query.source] || 0) + 1;
    }
  });

  return stats;
}

function generateCSV(project: any, queries: any[], stats: any): string {
  const rows: string[] = [];

  // Header
  rows.push(
    [
      "Query ID",
      "Query Text",
      "Query Type",
      "Query Category",
      "Query Format",
      "Target Audience",
      "Analysis Status",
      "Brand Mentions",
      "Source",
    ]
      .map(escapeCSV)
      .join(",")
  );

  // Data rows
  queries.forEach((query) => {
    rows.push(
      [
        query.query_id,
        query.query_text,
        query.query_type,
        query.query_category,
        query.query_format,
        query.target_audience,
        query.analysis_status,
        query.brand_mentions,
        query.source,
      ]
        .map(escapeCSV)
        .join(",")
    );
  });

  return rows.join("\n");
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If the string contains commas, quotes, or newlines, wrap it in quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    // Escape quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}
