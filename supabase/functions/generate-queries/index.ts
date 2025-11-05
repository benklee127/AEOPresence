// generateQueries - Supabase Edge Function
// Generates AEO queries based on project configuration using LLM

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

    // Build prompt for LLM
    const prompt = buildQueryGenerationPrompt(project);

    // Call Gemini API to generate queries
    const generatedQueries = await callGeminiAPI(prompt, geminiApiKey);

    // Insert queries into database
    const queriesWithProjectId = generatedQueries.map((q: any, index: number) => ({
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

    if (insertError) throw insertError;

    // Update project status to 'queries_generated'
    await supabase
      .from("query_projects")
      .update({
        status: "queries_generated",
        total_queries: generatedQueries.length,
        current_step: 2,
      })
      .eq("id", project_id);

    return new Response(
      JSON.stringify({
        success: true,
        count: generatedQueries.length,
        message: `Successfully generated ${generatedQueries.length} queries`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in generate-queries:", error);
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

function buildQueryGenerationPrompt(project: any): string {
  const sampleSize = project.total_queries || 20;
  const educationalRatio = project.educational_ratio || 50;
  const serviceRatio = project.service_ratio || 50;

  return `Generate ${sampleSize} Answer Engine Optimization (AEO) queries for analysis.

Company: ${project.company_url || "Not specified"}
Competitors: ${project.competitor_urls?.join(", ") || "Not specified"}
Target Audience: ${project.audience?.join(", ") || "General audience"}
Focus Areas: ${project.themes || "General topics"}
Query Mix: ${educationalRatio}% Educational, ${serviceRatio}% Service-Aligned

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

${project.manual_queries?.length > 0 ? `Include these manual queries: ${project.manual_queries.join(", ")}` : ""}

Output as a JSON array with this exact format:
[
  {
    "query_text": "Example query text here",
    "query_type": "Educational",
    "query_category": "Industry monitoring",
    "query_format": "Natural-language questions",
    "target_audience": "Business professionals"
  }
]

IMPORTANT:
- query_type must be exactly "Educational" or "Service-Aligned"
- query_category must be one of the 10 categories listed above
- query_format must be exactly "Natural-language questions" or "Keyword phrases"
- Return ONLY the JSON array, no additional text`;
}

async function callGeminiAPI(prompt: string, apiKey: string): Promise<any[]> {
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
          temperature: 0.7,
          maxOutputTokens: 8192,
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
