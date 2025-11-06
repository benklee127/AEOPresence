
import React, { useState, useEffect } from "react";
import { QueryProject, Query } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Download, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import OnboardingForm from "../components/step1/OnboardingForm";
// QueryPreview component is no longer needed as we navigate directly to Step2

export default function Step1() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Redirect to dashboard if no projectId
  useEffect(() => {
    if (!projectId) {
      navigate(createPageUrl("Dashboard"));
    }
  }, [projectId, navigate]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => QueryProject.get(projectId),
    enabled: !!projectId,
  });

  // Queries are no longer displayed on this page after generation, so we don't need to fetch them.
  // The polling mechanism will implicitly fetch them for progress updates, but we don't display a list.
  const { data: queries = [] } = useQuery({
    queryKey: ['queries', projectId],
    queryFn: () => Query.filter({ project_id: projectId }),
    enabled: false, // Keep disabled for direct display, will be fetched during polling
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => QueryProject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const handleFormComplete = async (formData) => {
    if (!projectId) return;
    await updateProjectMutation.mutateAsync({
      id: projectId,
      data: formData,
    });
    // Query generation buttons will appear automatically after save
    // since the project data will be refreshed with the audience information
  };

  const handleGenerateQueries = async (count = 200) => {
    if (!projectId || !project) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Starting generation...');
    setShowSuccessBanner(false);

    try {
      const audiences = Array.isArray(project.audience) ? project.audience.join(', ') : project.audience;
      const formats = Array.isArray(project.query_format) ? project.query_format : [project.query_format];

      const categories = [
        "Industry monitoring",
        "Competitor benchmarking",
        "Operational training",
        "Foundational understanding",
        "Real-world learning examples",
        "Educational — people-focused",
        "Trend explanation",
        "Pain-point focused — commercial intent",
        "Product or vendor-related — lead intent",
        "Decision-stage — ready to buy or engage"
      ];

      const queriesPerCategory = Math.floor(count / categories.length);

      let formatInstruction = '';
      if (formats.length === 2) {
        formatInstruction = 'Mix of both Natural-language questions and Keyword phrases (distribute evenly)';
      } else if (formats.includes('Natural-language questions')) {
        formatInstruction = 'Natural-language questions only';
      } else if (formats.includes('Keyword phrases')) {
        formatInstruction = 'Keyword phrases only';
      } else {
        formatInstruction = 'Natural-language questions';
      }

      setGenerationStatus(`Generating ${count} queries...`);
      setGenerationProgress(10);

      const prompt = `Generate EXACTLY ${count} unique AEO queries for the following criteria:

Audience: ${audiences}
Themes/Focus Areas: ${project.themes}
Query Mix: ${project.query_mix_type}${project.query_mix_type === 'Mixed' ? ` (${project.educational_ratio}% Educational, ${project.service_ratio}% Service-Aligned)` : ''}
Query Format: ${formatInstruction}

CRITICAL REQUIREMENTS:
1. Generate EXACTLY ${count} queries total - this is mandatory
2. Distribute queries EVENLY across these ${categories.length} categories (approximately ${queriesPerCategory} queries per category):
${categories.map((cat, idx) => `   ${idx + 1}. ${cat}`).join('\n')}

3. NEVER include company names or brand names in queries
4. Ensure complete deduplication - no exact, near, or semantic duplicates
5. Expand across subtopics: strategy, automation, measurement, personalization, tooling, compliance, data, reporting, integration, workflows, KPIs
6. Ensure diversity of structure and intent
7. Each query must be assigned to ONE of the ${categories.length} categories listed above
8. For query_format field, use exactly one of these: "Natural-language questions" or "Keyword phrases"
9. Each query must be assigned to ONE target audience from: ${audiences}

Return a JSON array with EXACTLY ${count} items in this structure:
[
  {
    "query_id": 1,
    "query_text": "...",
    "query_type": "Educational or Service-Aligned",
    "query_category": "one of the ${categories.length} categories listed above",
    "query_format": "Natural-language questions or Keyword phrases",
    "target_audience": "one of: ${audiences}"
  },
  ... (continue until you have ${count} queries)
]

IMPORTANT: The array MUST contain exactly ${count} query objects. Count them to make sure.`;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            queries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  query_id: { type: "number" },
                  query_text: { type: "string" },
                  query_type: { type: "string" },
                  query_category: { type: "string" },
                  query_format: { type: "string" },
                  target_audience: { type: "string" }
                }
              }
            }
          }
        }
      });

      let generatedQueries = response.queries || [];
      setGenerationProgress(50);
      setGenerationStatus(`Generated ${generatedQueries.length} queries, checking if more needed...`);

      // If we didn't get enough queries, generate more to reach the target
      let attempts = 0;
      while (generatedQueries.length < count && attempts < 3) {
        attempts++;
        const remaining = count - generatedQueries.length;
        setGenerationStatus(`Generating ${remaining} more queries (attempt ${attempts}/3)...`);
        setGenerationProgress(50 + (attempts * 10));

        const additionalPrompt = `Generate EXACTLY ${remaining} MORE unique AEO queries for:
Audience: ${audiences}
Themes: ${project.themes}
Query Mix: ${project.query_mix_type}${project.query_mix_type === 'Mixed' ? ` (${project.educational_ratio}% Educational, ${project.service_ratio}% Service-Aligned)` : ''}
Categories to distribute across: ${categories.join(', ')}

These queries must be:
1. Different from any previous queries
2. Distributed across the categories mentioned above
3. Format: ${formatInstruction}
4. No brand names or company names.
5. Ensure diversity of structure and intent.
6. Each query must be assigned to ONE of the categories.
7. Each query must be assigned to ONE target audience from: ${audiences}

Return JSON array with exactly ${remaining} queries using this structure:
[{"query_id": ${generatedQueries.length + 1}, "query_text": "...", "query_type": "Educational or Service-Aligned", "query_category": "one of the categories", "query_format": "Natural-language questions or Keyword phrases", "target_audience": "one of the audiences"}]`;

        const additionalResponse = await InvokeLLM({
          prompt: additionalPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              queries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    query_id: { type: "number" },
                    query_text: { type: "string" },
                    query_type: { type: "string" },
                    query_category: { type: "string" },
                    query_format: { type: "string" },
                    target_audience: { type: "string" }
                  }
                }
              }
            }
          }
        });

        if (additionalResponse.queries && additionalResponse.queries.length > 0) {
          generatedQueries = [...generatedQueries, ...additionalResponse.queries];
          setGenerationStatus(`Generated ${generatedQueries.length} / ${count} queries...`);
        }
      }

      // Ensure queries are capped at count and have sequential query_id from 1
      generatedQueries = generatedQueries.slice(0, count).map((q, idx) => ({
        ...q,
        query_id: idx + 1
      }));

      setGenerationStatus('Saving queries to database...');
      setGenerationProgress(85);

      // Save queries to database
      await Query.bulkCreate(
        generatedQueries.map(q => ({
          project_id: projectId,
          query_id: q.query_id,
          query_text: q.query_text,
          query_type: q.query_type,
          query_category: q.query_category,
          query_format: q.query_format,
          target_audience: q.target_audience,
          analysis_status: 'pending'
        }))
      );

      setGenerationStatus('Finalizing...');
      setGenerationProgress(95);

      // Update project with query count and status
      await updateProjectMutation.mutateAsync({
        id: projectId,
        data: {
          total_queries: generatedQueries.length,
          status: 'queries_generated',
        },
      });

      setGenerationProgress(100);
      setGenerationStatus(`Complete! Generated ${generatedQueries.length} queries.`);
      setShowSuccessBanner(true);

      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['queries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      // Navigate to Step 2 after successful generation
      setTimeout(() => {
        navigate(createPageUrl(`Step2?projectId=${projectId}&success=true`));
      }, 1500);

    } catch (error) {
      console.error('Error generating queries:', error);
      setGenerationStatus('Error occurred during generation. Please try again.');
      setIsGenerating(false);
    }

    setIsGenerating(false);
  };

  // handleDownloadCSV is no longer needed as QueryPreview is removed
  // const handleDownloadCSV = () => {
  //   const headers = ['Query_ID', 'Query', 'Query_Type', 'Query_Category', 'Query_Format'];
  //   const rows = queries.map(q => [q.query_id, q.query_text, q.query_type, q.query_category, q.query_format]);

  //   const csvContent = [
  //     headers.join(','),
  //     ...rows.map(row => row.map(cell => `"${String(cell || '')}"`).join(','))
  //   ].join('\n');

  //   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  //   const link = document.createElement('a');
  //   const url = URL.createObjectURL(blob);
  //   link.setAttribute('href', url);
  //   link.setAttribute('download', `queries_${new Date().toISOString().split('T')[0]}.csv`);
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // };

  const canGoToStep2 = project?.total_queries > 0;
  const canGoToStep3 = project?.status === 'analysis_complete';

  const handleNextStep = () => {
    // This navigation is for the top right arrow, it should always go to Step2 if queries are generated
    if (canGoToStep2) { // Ensure queries exist before proceeding
      navigate(createPageUrl(`Step2?projectId=${projectId}`));
    }
  };

  if (!projectId) {
    return null;
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-slate-600 mb-4">Project not found</p>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(createPageUrl("Dashboard"))}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextStep}
                disabled={!canGoToStep2} // Disable if no queries have been generated yet
                className={!canGoToStep2 ? "opacity-50 cursor-not-allowed" : ""}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Step 1: Generate Queries</h1>
              <p className="text-slate-600 mt-1">{project?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              Step 1
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${canGoToStep2 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'}`}>
              Step 2
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${canGoToStep3 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'}`}>
              Step 3
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <OnboardingForm
            project={project}
            onComplete={handleFormComplete}
          />

          {project?.audience && project?.audience.length > 0 && (
            <Card className="border-2 border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Ready to Generate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isGenerating ? (
                  <>
                    <p className="text-slate-700">
                      Configuration complete! Generate up to 200 unique, deduplicated AEO queries.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleGenerateQueries(20)}
                        disabled={isGenerating}
                        variant="outline"
                        className="flex-1"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate 20 Sample Queries
                      </Button>
                      <Button
                        onClick={() => handleGenerateQueries(200)}
                        disabled={isGenerating}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Full 200 Queries
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {showSuccessBanner && (
                      <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                        <p>Query generation successfully initiated in the background!</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{generationStatus}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-500 rounded-full"
                              style={{ width: `${generationProgress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700 min-w-[45px]">
                            {generationProgress}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">
                      This may take a few minutes. You can navigate away and come back, or wait here for completion.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
