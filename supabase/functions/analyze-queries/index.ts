// analyzeQueries - Supabase Edge Function
// Analyzes queries to determine brand mentions, sources, and refine categorization

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

    let analyzed = 0;
    let errors = 0;

    // Analyze queries in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (query) => {
          try {
            // Update status to 'analyzing'
            await supabase
              .from("queries")
              .update({ analysis_status: "analyzing" })
              .eq("id", query.id);

            // Analyze the query
            const analysis = await analyzeSingleQuery(query, project, geminiApiKey);

            // Update query with analysis results
            await supabase
              .from("queries")
              .update({
                brand_mentions: analysis.brand_mentions.join(", "),
                source: analysis.source,
                query_type: analysis.query_type || query.query_type,
                query_category: analysis.query_category || query.query_category,
                analysis_status: "complete",
              })
              .eq("id", query.id);

            analyzed++;
          } catch (error) {
            console.error(`Error analyzing query ${query.id}:`, error);

            // Mark query as error
            await supabase
              .from("queries")
              .update({ analysis_status: "error" })
              .eq("id", query.id);

            errors++;
          }
        })
      );

      // Small delay between batches to avoid rate limits
      if (i + batchSize < queries.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Check if all queries are complete
    const { data: remainingQueries } = await supabase
      .from("queries")
      .select("id")
      .eq("project_id", project_id)
      .in("analysis_status", ["pending", "analyzing"]);

    if (!remainingQueries || remainingQueries.length === 0) {
      // Update project status to 'analysis_complete'
      await supabase
        .from("query_projects")
        .update({
          status: "analysis_complete",
          current_step: 3,
        })
        .eq("id", project_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed,
        errors,
        message: `Successfully analyzed ${analyzed} queries (${errors} errors)`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in analyze-queries:", error);
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

async function analyzeSingleQuery(
  query: any,
  project: any,
  apiKey: string
): Promise<any> {
  const prompt = `Analyze this AEO query and provide structured information:

Query: "${query.query_text}"
Query Type: ${query.query_type}
Category: ${query.query_category}
Target Audience: ${query.target_audience}

Company: ${project.company_url || "Not specified"}
Competitors: ${project.competitor_urls?.join(", ") || "Not specified"}

Please analyze:
1. Which brands would likely be mentioned in answers to this query? (List specific brand names)
2. What sources (websites, platforms, forums) would typically answer this query?
3. Confirm or correct the query type and category

Output as JSON with this exact format:
{
  "brand_mentions": ["Brand1", "Brand2", "Brand3"],
  "source": "Source name or platform (e.g., 'Reddit forums', 'Industry documentation', 'Review sites')",
  "query_type": "Educational",
  "query_category": "Industry monitoring"
}

IMPORTANT:
- brand_mentions should be an array of specific brand/company names (not generic terms)
- query_type must be exactly "Educational" or "Service-Aligned"
- query_category must be one of the 10 valid categories
- Return ONLY the JSON object, no additional text`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;

  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error("Failed to parse LLM response:", text);
    throw new Error("Failed to parse LLM response as JSON");
  }
}
