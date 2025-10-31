
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Loader2, Clock, AlertCircle, Sparkles, Bug, RotateCcw } from "lucide-react";

export default function AnalysisProgress({ 
  total, 
  completed, 
  isAnalyzing, 
  onStart, 
  onPause,
  showGenerateButton,
  onGenerateFull,
  isGenerating,
  generationProgress,
  generationStatus,
  projectId,
  onDiagnose,
  onResetStuck,
  isDiagnosing
}) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  
  const remainingQueries = total - completed;
  const remainingBatches = Math.ceil(remainingQueries / 3);
  const estimatedTimeRemaining = isAnalyzing && remainingQueries > 0 ? Math.ceil(remainingBatches * 8 / 60) : 0;

  const getButtonText = () => {
    if (completed === total && total > 0) return 'Analysis Complete';
    if (completed === 0) return 'Start Analysis';
    return 'Resume Analysis';
  };

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <div className="space-y-3">
          <CardTitle className="flex items-center justify-between">
            <span>Analysis Progress</span>
            <div className="flex items-center gap-2"> {/* This div wraps the status messages and the new button */}
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-sm font-normal text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </div>
              )}
              {isGenerating && (
                <div className="flex items-center gap-2 text-sm font-normal text-purple-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </div>
              )}
              <Button
                onClick={onResetStuck}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Stuck
              </Button>
              <Button
                onClick={onDiagnose}
                disabled={isDiagnosing}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                {isDiagnosing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Diagnosing...
                  </>
                ) : (
                  <>
                    <Bug className="w-4 h-4" />
                    Diagnose
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
          
          {isAnalyzing && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-800">
                  <strong>Analysis running:</strong> You can safely navigate away or close this page. 
                  The analysis will continue in the background.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Stuck queries are automatically recovered every 15 seconds (1-minute timeout).
                </p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{generationStatus}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-pink-600 h-full transition-all duration-500 rounded-full"
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
              This may take 1-2 minutes. Please don't close this page.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Progress</span>
                <span className="font-medium text-slate-900">
                  {completed} / {total} queries ({Math.round(progress)}%)
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            {isAnalyzing && estimatedTimeRemaining > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 p-3 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Estimated time remaining: ~{estimatedTimeRemaining} minutes</span>
              </div>
            )}

            <div className="flex gap-3">
              {showGenerateButton && !isAnalyzing && (
                <Button
                  onClick={onGenerateFull}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Full 200 Queries
                </Button>
              )}
              
              {!isAnalyzing ? (
                <Button
                  onClick={() => {
                    console.log('Start/Resume button clicked, total:', total, 'completed:', completed);
                    onStart();
                  }}
                  disabled={completed === total && total > 0}
                  className={`${showGenerateButton ? 'flex-1' : 'flex-1'} bg-gradient-to-r from-indigo-600 to-blue-600`}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {getButtonText()}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    console.log('Pause button clicked');
                    onPause();
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause Analysis
                </Button>
              )}
            </div>

            <p className="text-sm text-slate-600">
              Each query will be searched on Chat GPT and analyzed for brand mentions and sources.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
