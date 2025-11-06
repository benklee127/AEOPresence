
import React, { useState, useEffect, useRef } from "react";
import { QueryProject, Query } from "@/api/entities";
import { analyzeQueries, diagnoseStuckQueries, resetStuckQueries } from "@/api/functions";
import { InvokeLLM } from "@/api/integrations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Download, Play, Pause, Loader2, CheckCircle2, AlertCircle, Bug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AnalysisProgress from "../components/step2/AnalysisProgress";
import AnalysisResults from "../components/step2/AnalysisResults";

export default function Step2() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successBannerMessage, setSuccessBannerMessage] = useState('');
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = React.useState(false);

  // Ref to track if we're already calling the backend to prevent duplicate calls
  const isCallingBackendRef = useRef(false);

  // Redirect to dashboard if no projectId
  useEffect(() => {
    if (!projectId) {
      navigate(createPageUrl("Dashboard"));
    }
  }, [projectId, navigate]);

  // Effect to hide success banner after a few seconds
  useEffect(() => {
    let timer;
    if (showSuccessBanner) {
      timer = setTimeout(() => {
        setShowSuccessBanner(false);
        setSuccessBannerMessage(''); // Clear message after hiding
      }, 5000); // Hide after 5 seconds
    }
    return () => clearTimeout(timer);
  }, [showSuccessBanner]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => QueryProject.get(projectId),
    enabled: !!projectId,
  });

  const { data: queries = [] } = useQuery({
    queryKey: ['queries', projectId],
    queryFn: () => Query.filter({ project_id: projectId }),
    enabled: !!projectId,
    refetchInterval: isAnalyzing || hasStartedAnalysis ? 3000 : false, // Poll while analyzing or when analysis has started
  });

  const updateQueryMutation = useMutation({
    mutationFn: ({ id, data }) => Query.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries', projectId] });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => QueryProject.update(id, data),
  });

  const handleGenerateFullQueries = async () => {
    if (!projectId || !project) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Starting generation...');
    setIsPaused(false); // Clear pause state if generating new queries

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

      const targetCount = 200;
      const queriesPerCategory = Math.floor(targetCount / categories.length);

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

      setGenerationStatus(`Generating ${targetCount} queries...`);
      setGenerationProgress(10);

      const prompt = `Generate EXACTLY ${targetCount} unique AEO queries for the following criteria:

Audience: ${audiences}
Themes/Focus Areas: ${project.themes}
Query Mix: ${project.query_mix_type}${project.query_mix_type === 'Mixed' ? ` (${project.educational_ratio}% Educational, ${project.service_ratio}% Service-Aligned)` : ''}
Query Format: ${formatInstruction}

CRITICAL REQUIREMENTS:
1. Generate EXACTLY ${targetCount} queries total - this is mandatory
2. Distribute queries EVENLY across these ${categories.length} categories (approximately ${queriesPerCategory} queries per category):
${categories.map((cat, idx) => `   ${idx + 1}. ${cat}`).join('\n')}

3. NEVER include company names or brand names in queries
4. Ensure complete deduplication - no exact, near, or semantic duplicates
5. Expand across subtopics: strategy, automation, measurement, personalization, tooling, compliance, data, reporting, integration, workflows, KPIs
6. Ensure diversity of structure and intent
7. Each query must be assigned to ONE of the ${categories.length} categories listed above
8. For query_format field, use exactly one of these: "Natural-language questions" or "Keyword phrases"
9. Each query must be assigned to ONE target audience from: ${audiences}

Return a JSON array with EXACTLY ${targetCount} items in this structure:
[
  {
    "query_id": 1,
    "query_text": "...",
    "query_type": "Educational or Service-Aligned",
    "query_category": "one of the ${categories.length} categories listed above",
    "query_format": "Natural-language questions or Keyword phrases",
    "target_audience": "one of: ${audiences}"
  },
  ... (continue until you have ${targetCount} queries)
]

IMPORTANT: The array MUST contain exactly ${targetCount} query objects. Count them to make sure.`;

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
      while (generatedQueries.length < targetCount && attempts < 3) {
        attempts++;
        const remaining = targetCount - generatedQueries.length;
        setGenerationStatus(`Generating ${remaining} more queries (attempt ${attempts}/3)...`);
        setGenerationProgress(50 + (attempts * 15));

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
          // Combine queries, will re-number them in the next step to ensure sequential IDs
          generatedQueries = [...generatedQueries, ...additionalResponse.queries];
          setGenerationStatus(`Generated ${generatedQueries.length} / ${targetCount} queries...`);
        }
      }

      // Ensure queries are capped at targetCount and have sequential query_id from 1
      generatedQueries = generatedQueries.slice(0, targetCount).map((q, idx) => ({
        ...q,
        query_id: idx + 1 // Re-assign sequential IDs from 1
      }));

      setGenerationStatus('Saving queries to database...');
      setGenerationProgress(85);

      await Query.bulkCreate(
        generatedQueries.map(q => ({
          project_id: projectId,
          query_id: q.query_id, // Use the re-assigned sequential query_id
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

      await updateProjectMutation.mutateAsync({
        id: projectId,
        data: {
          total_queries: generatedQueries.length,
          status: 'queries_generated',
        },
      });

      setGenerationProgress(100);
      setGenerationStatus('Complete!');
      setSuccessBannerMessage('Queries generated successfully!'); // Set specific message
      setShowSuccessBanner(true); // Show success banner
      queryClient.invalidateQueries({ queryKey: ['queries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (error) {
      console.error('Error generating queries:', error);
      setGenerationStatus('Error occurred during generation');
    }
    setIsGenerating(false);
  };

  const handleStartAnalysis = async () => {
    if (!projectId) {
      alert('No project ID found. Please go back to the dashboard.');
      return;
    }
    
    console.log('Starting analysis for project:', projectId);
    setIsAnalyzing(true);
    setHasStartedAnalysis(true);
    setIsPaused(false);
    isCallingBackendRef.current = false; // Reset the ref
    
    try {
      // Call the backend function to start analysis
      const response = await analyzeQueries({ project_id: projectId });

      console.log('Analysis response:', response);
      queryClient.invalidateQueries({ queryKey: ['queries', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      
      // Wait a bit then check status
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['queries', projectId] });
      }, 2000);
    } catch (error) {
      console.error('Analysis error:', error);
      setIsAnalyzing(false);
      setHasStartedAnalysis(false);
      alert('Analysis encountered an error. Please try again.');
    }
  };

  const handlePauseAnalysis = () => {
    console.log("Frontend analysis display paused. Backend process continues.");
    setIsAnalyzing(false);
    setHasStartedAnalysis(false);
    setIsPaused(true);
  };

  const handleDownloadCSV = () => {
    const headers = ['Query_ID', 'Query', 'Query_Type', 'Query_Category', 'Query_Format', 'Brand_Mentions', 'Source'];
    const rows = queries.map(q => [
      q.query_id,
      q.query_text,
      q.query_type,
      q.query_category,
      q.query_format,
      q.brand_mentions || 'Pending',
      q.source || 'Pending'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analyzed_queries_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    try {
      const response = await diagnoseStuckQueries({ project_id: projectId });
      console.log('=== DIAGNOSTIC RESULTS ===');
      console.log(JSON.stringify(response, null, 2));

      // Also show a summary in an alert
      const summary = response.summary;
      alert(`DIAGNOSTIC SUMMARY:
Total Queries: ${summary.total}
Completed: ${summary.statusCounts.complete || 0}
Pending: ${summary.statusCounts.pending || 0}
Analyzing: ${summary.statusCounts.analyzing || 0}
Error: ${summary.statusCounts.error || 0}

First Incomplete Query ID: ${summary.firstIncompleteQueryId || 'N/A'}
Stuck Analyzing: ${summary.stuckAnalyzingCount}

Check console (F12) for full details.`);
    } catch (error) {
      console.error('Diagnostic error:', error);
      alert('Diagnostic failed: ' + error.message);
    }
    setIsDiagnosing(false);
  };

  const handleResetStuck = async () => {
    if (!window.confirm('Reset all stuck "analyzing" queries back to pending?')) {
      return;
    }
    
    try {
      const response = await resetStuckQueries({ project_id: projectId });
      alert(response.message);
      queryClient.invalidateQueries({ queryKey: ['queries', projectId] });

      // Auto-restart analysis after reset
      if (response.stuck > 0) {
        setTimeout(() => handleStartAnalysis(), 1000);
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('Failed to reset: ' + error.message);
    }
  };

  const completedCount = queries.filter(q => q.analysis_status === 'complete').length;
  const allQueriesProcessed = queries.length > 0 && completedCount === queries.length;
  
  const canGoToStep3 = allQueriesProcessed && project?.status === 'analysis_complete';

  const handlePreviousStep = () => {
    if (!projectId) return;
    navigate(createPageUrl(`Step1?projectId=${projectId}`));
  };

  const handleNextStep = () => {
    if (canGoToStep3) {
      navigate(createPageUrl(`Step3?projectId=${projectId}`));
    }
  };

  // MODIFIED: Automated status checking - simplified, no stuck detection
  React.useEffect(() => {
    if (isPaused || !projectId || queries.length === 0 || isGenerating || isUpdatingProject) {
      return;
    }

    const hasPending = queries.some(q => q.analysis_status === 'pending' || q.analysis_status === 'error');
    const hasActivelyAnalyzing = queries.some(q => q.analysis_status === 'analyzing');
    const allComplete = queries.every(q => q.analysis_status === 'complete');
    
    const pendingCount = queries.filter(q => q.analysis_status === 'pending' || q.analysis_status === 'error').length;
    const analyzingCount = queries.filter(q => q.analysis_status === 'analyzing').length;

    console.log('[Step2] Status check:', {
      total: queries.length,
      completed: completedCount,
      hasActivelyAnalyzing,
      analyzingCount,
      hasPending,
      pendingCount,
      allComplete,
      hasStartedAnalysis,
      isCallingBackend: isCallingBackendRef.current
    });

    // Scenario 1: All queries are complete
    if (allComplete) {
      setIsAnalyzing(false);
      setHasStartedAnalysis(false);
      setIsPaused(false);
      isCallingBackendRef.current = false;

      if (project?.status !== 'analysis_complete') {
        setIsUpdatingProject(true);
        updateProjectMutation.mutateAsync({
          id: projectId,
          data: {
            status: 'analysis_complete',
            analyzed_queries: queries.length,
          },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          setSuccessBannerMessage('Analysis complete!');
          setShowSuccessBanner(true);
          setIsUpdatingProject(false);
        }).catch(error => {
          console.error("Error updating project status:", error);
          setIsUpdatingProject(false);
        });
      }
      return;
    }

    // Scenario 2: Analysis is actively running or needs to be started
    if (hasPending && hasStartedAnalysis && !isCallingBackendRef.current) {
      setIsAnalyzing(true);
      
      console.log('[Step2] 🔄 Pending queries detected, auto-starting next batch...');
      isCallingBackendRef.current = true;
      
      setTimeout(async () => {
        try {
          console.log('[Step2] 📞 Calling analyzeQueries for next batch...');
          await analyzeQueries({ project_id: projectId });
          queryClient.invalidateQueries({ queryKey: ['queries', projectId] });
        } catch (error) {
          console.error('[Step2] ❌ Error auto-starting batch:', error);
        } finally {
          isCallingBackendRef.current = false;
        }
      }, 3000);
    }

  }, [queries, isGenerating, project?.status, isUpdatingProject, hasStartedAnalysis, isPaused, projectId, updateProjectMutation, queryClient, completedCount]);


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

  const isComplete = allQueriesProcessed;

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousStep}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextStep}
                disabled={!canGoToStep3}
                className={!canGoToStep3 ? "opacity-50 cursor-not-allowed" : ""}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Step 2: Analyze Queries</h1>
              <p className="text-slate-600 mt-1">{project?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200" onClick={handlePreviousStep}>
              Step 1
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-medium">
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
              Step 2
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${canGoToStep3 ? 'bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200' : 'bg-slate-50 text-slate-400'}`} onClick={canGoToStep3 ? handleNextStep : undefined}>
              Step 3
            </div>
          </div>
        </div>

        {showSuccessBanner && (
          <div className="flex items-center gap-3 p-4 mb-6 text-sm text-green-700 bg-green-100 rounded-lg" role="alert">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Success!</span> {successBannerMessage}
          </div>
        )}

        <AnalysisProgress 
          total={queries.length}
          completed={completedCount}
          isAnalyzing={isAnalyzing}
          onStart={handleStartAnalysis}
          onPause={handlePauseAnalysis}
          showGenerateButton={queries.length > 0 && queries.length < 200 && !isGenerating}
          onGenerateFull={handleGenerateFullQueries}
          isGenerating={isGenerating}
          generationProgress={generationProgress}
          generationStatus={generationStatus}
          isPaused={isPaused}
          projectId={projectId}
          onDiagnose={handleDiagnose}
          onResetStuck={handleResetStuck}
          isDiagnosing={isDiagnosing}
        />

        <AnalysisResults 
          queries={queries}
          isComplete={isComplete}
          onDownload={handleDownloadCSV}
          onProceed={handleNextStep}
        />

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handlePreviousStep}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous: Generate Queries
              </Button>
              <Button
                onClick={handleNextStep}
                disabled={!canGoToStep3}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                Next: View Analytics
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
