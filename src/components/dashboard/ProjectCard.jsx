import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Search, BarChart3, ArrowRight, MoreVertical, Trash2, Loader2, FolderInput, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  generating: { label: 'Generating Queries', color: 'bg-purple-100 text-purple-700' },
  queries_generated: { label: 'Queries Generated', color: 'bg-blue-100 text-blue-700' },
  generation_failed: { label: 'Generation Failed', color: 'bg-red-100 text-red-700' },
  analyzing: { label: 'Analyzing', color: 'bg-indigo-100 text-indigo-700' },
  analysis_complete: { label: 'Analysis Complete', color: 'bg-green-100 text-green-700' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-700' },
};

export default function ProjectCard({ project, onDelete, onRerun, isDeleting, isRerunning, folders, onMoveToFolder }) {
  const navigate = useNavigate();
  
  const getNextStep = () => {
    if (project.status === 'draft' || !project.total_queries) {
      return { page: 'Step1', label: 'Generate Queries', icon: FileText };
    } else if (project.status === 'queries_generated' || project.status === 'generating') {
      return { page: 'Step2', label: 'Analyze Queries', icon: Search };
    } else {
      return { page: 'Step3', label: 'View Analytics', icon: BarChart3 };
    }
  };

  const nextStep = getNextStep();
  const audiences = Array.isArray(project.audience) ? project.audience : (project.audience ? [project.audience] : []);
  const currentStatus = statusConfig[project.status] || statusConfig.draft;
  const canRerun = project.status === 'analysis_complete' && project.total_queries > 0;

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 bg-white">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex-1 min-w-0 pr-2">
          <CardTitle className="text-lg font-bold text-slate-900 mb-2 break-words overflow-wrap-anywhere">
            {project.name}
          </CardTitle>
          <Badge className={currentStatus.color}>
            {currentStatus.label}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" disabled={isDeleting || isRerunning}>
              {isDeleting || isRerunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(createPageUrl(`Step1?projectId=${project.id}`))}>
              Edit Details
            </DropdownMenuItem>
            {canRerun && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onRerun(project)}
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-run Queries
                </DropdownMenuItem>
              </>
            )}
            {folders && folders.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput className="w-4 h-4 mr-2" />
                    Move to Folder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => onMoveToFolder(project.id, null)}>
                      No Folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {folders.map((folder) => (
                      <DropdownMenuItem 
                        key={folder.id} 
                        onClick={() => onMoveToFolder(project.id, folder.id)}
                      >
                        {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(project.id)}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <p className="text-slate-500 mb-2">Audiences</p>
              <div className="flex flex-wrap gap-1">
                {audiences.length > 0 ? (
                  audiences.map((aud, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {aud}
                    </Badge>
                  ))
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-slate-500">Created</p>
              <p className="font-medium text-slate-900">
                {format(new Date(project.created_date), 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Total Queries</p>
              <p className="font-medium text-slate-900">{project.total_queries || 0}</p>
            </div>
          </div>

          <Button
            className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors"
            variant="outline"
            onClick={() => navigate(createPageUrl(`${nextStep.page}?projectId=${project.id}`))}
          >
            <nextStep.icon className="w-4 h-4 mr-2" />
            {nextStep.label}
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}