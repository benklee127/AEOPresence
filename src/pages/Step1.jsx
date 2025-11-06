
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
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
  const [showSuccessBanner, setShowSuccessBanner] = useState(false); // New state for success banner

  // Refs to store interval/timeout IDs for cleanup
  const pollIntervalRef = useRef(null);
  const timeoutCleanupRef = useRef(null);

  // Redirect to dashboard if no projectId
  useEffect(() => {
    if (!projectId) {
      navigate(createPageUrl("Dashboard"));
    }
    // Cleanup polling intervals/timeouts if component unmounts or projectId changes
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (timeoutCleanupRef.current) {
        clearTimeout(timeoutCleanupRef.current);
      }
    };
  }, [projectId, navigate]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.QueryProject.get(projectId),
    enabled: !!projectId,
  });

  // Queries are no longer displayed on this page after generation, so we don't need to fetch them.
  // The polling mechanism will implicitly fetch them for progress updates, but we don't display a list.
  const { data: queries = [] } = useQuery({
    queryKey: ['queries', projectId],
    queryFn: () => base44.entities.Query.filter({ project_id: projectId }),
    enabled: false, // Keep disabled for direct display, will be fetched during polling
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QueryProject.update(id, data),
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

    // Navigate to Step 2 after successfully saving configuration
    setTimeout(() => {
      navigate(createPageUrl(`Step2?projectId=${projectId}`));
    }, 1500); // Give time for the success message to be seen
  };

  const handleGenerateQueries = async (count = 200) => {
    if (!projectId || !project) return;

    // Clear any previous intervals/timeouts before starting a new generation
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timeoutCleanupRef.current) clearTimeout(timeoutCleanupRef.current);

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Starting generation...');
    setShowSuccessBanner(false); // Reset banner state for new generation

    try {
      setGenerationProgress(10);
      setGenerationStatus(`Starting background generation of ${count} queries...`);

      // Call backend function to generate queries
      await base44.functions.invoke('generateQueries', {
        projectId,
        count
      });

      // Frontend action is complete, now waiting for backend process
      setGenerationProgress(100);
      setGenerationStatus('Generation started! Queries are being generated in the background.');
      setShowSuccessBanner(true); // Show success banner after initiation

      // Start polling for updates
      const pollInterval = setInterval(async () => {
        try {
          // Invalidate project and queries cache to ensure fresh data for polling
          // These are fire-and-forget, the `get` and `filter` below will ensure fresh data
          // if the invalidation has completed by then.
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          queryClient.invalidateQueries({ queryKey: ['queries', projectId] });

          const updatedProject = await base44.entities.QueryProject.get(projectId);
          const currentQueries = await base44.entities.Query.filter({ project_id: projectId });

          if (updatedProject.status === 'queries_generated') {
            clearInterval(pollIntervalRef.current);
            clearTimeout(timeoutCleanupRef.current); // Clear the timeout as well
            setGenerationStatus(`Complete! Generated ${currentQueries.length} queries.`);
            setIsGenerating(false); // Generation is fully complete now

            // Ensure cache is fresh for subsequent steps
            queryClient.invalidateQueries({ queryKey: ['queries', projectId] });
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });

            // Navigate to Step 2 after successful generation
            setTimeout(() => {
              navigate(createPageUrl(`Step2?projectId=${projectId}&success=true`));
            }, 1500); // Give a little time for final status message to be seen
          } else if (updatedProject.status === 'generation_failed') {
            clearInterval(pollIntervalRef.current);
            clearTimeout(timeoutCleanupRef.current);
            setGenerationStatus('Generation failed. Please try again.');
            setIsGenerating(false);
          } else {
            // Update progress based on how many queries exist
            // Min progress is 10 (from initial call), then scale based on generated queries up to 95%.
            // The last 5% will be for finalization after status 'queries_generated'.
            const progress = Math.min(95, 10 + (currentQueries.length / count) * 85);
            setGenerationProgress(Math.floor(progress));
            setGenerationStatus(`Generating queries... (${currentQueries.length} / ${count})`);
          }
        } catch (error) {
          console.error('Polling error:', error);
          // If polling itself errors, perhaps stop polling after a few attempts or clear the interval
          // For now, let's just log and continue polling unless project status changes.
        }
      }, 3000); // Poll every 3 seconds
      pollIntervalRef.current = pollInterval; // Store interval ID

      // Clean up interval after 5 minutes in case it never completes or errors out
      const timeoutId = setTimeout(() => {
        clearInterval(pollIntervalRef.current);
        console.warn('Query generation polling timed out after 5 minutes.');
        // Only update status if still indicating active generation
        if (generationStatus.includes('Generating queries...') || generationProgress < 100) {
          setGenerationStatus('Generation is taking longer than expected. Please check back later.');
        }
        setIsGenerating(false); // Allow user to try again or navigate
      }, 5 * 60 * 1000); // 5 minutes
      timeoutCleanupRef.current = timeoutId; // Store timeout ID

    } catch (error) {
      console.error('Error initiating query generation:', error);
      setGenerationStatus('Error occurred during generation initiation.');
      setIsGenerating(false);
    }
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
