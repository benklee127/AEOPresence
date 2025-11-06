
import React, { useState } from "react";
import { QueryProject, Query, Folder } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Search, BarChart3, Clock, CheckCircle2, FolderOpen, Folder as FolderIcon, X, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import ProjectCard from "../components/dashboard/ProjectCard";
import FolderCard from "../components/dashboard/FolderCard";
import StatsCard from "../components/dashboard/StatsCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FOLDER_COLORS = [
  { value: "blue", label: "Blue" },
  { value: "indigo", label: "Indigo" },
  { value: "purple", label: "Purple" },
  { value: "pink", label: "Pink" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "slate", label: "Slate" }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderFormData, setFolderFormData] = useState({ name: '', color: 'blue', description: '' });
  const [selectedFolderId, setSelectedFolderId] = useState(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => QueryProject.list('-created_date'),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => Folder.list('-created_date'),
  });

  const createFolderMutation = useMutation({
    mutationFn: (data) => Folder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setShowFolderDialog(false);
      setFolderFormData({ name: '', color: 'blue', description: '' });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, data }) => Folder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setShowFolderDialog(false);
      setEditingFolder(null);
      setFolderFormData({ name: '', color: 'blue', description: '' });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId) => {
      // First, remove folder reference from all projects in this folder
      const projectsInFolder = projects.filter(p => p.folder_id === folderId);
      await Promise.all(
        projectsInFolder.map(p => 
          QueryProject.update(p.id, { folder_id: null })
        )
      );
      // Then delete the folder
      await Folder.delete(folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => QueryProject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const rerunQueriesMutation = useMutation({
    mutationFn: async (originalProject) => {
      // Create new project with same configuration
      const newProject = await QueryProject.create({
        name: `${originalProject.name} (Re-run ${format(new Date(), 'MMM d, yyyy')})`,
        folder_id: originalProject.folder_id,
        company_url: originalProject.company_url,
        company_logo_url: originalProject.company_logo_url,
        competitor_urls: originalProject.competitor_urls || [],
        audience: originalProject.audience || [],
        themes: originalProject.themes,
        query_mix_type: originalProject.query_mix_type,
        educational_ratio: originalProject.educational_ratio,
        service_ratio: originalProject.service_ratio,
        manual_queries: originalProject.manual_queries || [],
        total_queries: originalProject.total_queries,
        status: 'queries_generated',
        current_step: 2
      });

      // Copy all queries from original project
      const originalQueries = await Query.filter({ 
        project_id: originalProject.id 
      });

      if (originalQueries.length > 0) {
        const newQueries = originalQueries.map(q => ({
          project_id: newProject.id,
          query_id: q.query_id,
          query_text: q.query_text,
          query_type: q.query_type,
          query_category: q.query_category,
          query_format: q.query_format,
          target_audience: q.target_audience,
          analysis_status: 'pending'
        }));

        await Query.bulkCreate(newQueries);
      }

      return newProject;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(createPageUrl(`Step2?projectId=${newProject.id}`));
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId) => {
      const queries = await Query.filter({ project_id: projectId });
      
      const batchSize = 5;
      const batchDelay = 2000;
      
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (q) => {
          let retries = 0;
          const maxRetries = 3;
          
          while (retries <= maxRetries) {
            try {
              await Query.delete(q.id);
              return;
            } catch (error) {
              if (error.message?.includes('Rate limit') && retries < maxRetries) {
                retries++;
                const delay = 1000 * Math.pow(2, retries);
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                throw error;
              }
            }
          }
          throw new Error(`Failed to delete query ${q.id} after ${maxRetries} retries.`);
        }));
        
        if (i + batchSize < queries.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
      
      if (queries.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      let retries = 0;
      const maxRetries = 3;
      
      while (retries <= maxRetries) {
        try {
          await QueryProject.delete(projectId);
          return;
        } catch (error) {
          if (error.message?.includes('Rate limit') && retries < maxRetries) {
            retries++;
            const delay = 1000 * Math.pow(2, retries);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }
      throw new Error(`Failed to delete project ${projectId} after ${maxRetries} retries.`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeletingProjectId(null);
    },
    onError: (error) => {
      console.error('Deletion error:', error);
      setDeletingProjectId(null);
    }
  });

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone and may take a minute for projects with many queries.')) {
      setDeletingProjectId(projectId);
      try {
        await deleteProjectMutation.mutateAsync(projectId);
        alert('Project deleted successfully!');
      } catch (error) {
        console.error('Error deleting project:', error);
        const errorMsg = error.message || 'Unknown error';
        if (errorMsg.includes('Rate limit')) {
          alert('Deletion is taking longer than expected due to rate limits. Please wait a moment and try again, or the deletion may complete in the background.');
        } else {
          alert(`Failed to delete project: ${errorMsg}. Please try again.`);
        }
      }
    }
  };

  const handleRerunQueries = async (project) => {
    if (window.confirm(`Re-run all ${project.total_queries} queries from "${project.name}"? This will create a new project with the same queries ready to analyze.`)) {
      try {
        await rerunQueriesMutation.mutateAsync(project);
      } catch (error) {
        console.error('Error re-running queries:', error);
        alert('Failed to re-run queries. Please try again.');
      }
    }
  };

  const handleCreateFolder = () => {
    setEditingFolder(null);
    setFolderFormData({ name: '', color: 'blue', description: '' });
    setShowFolderDialog(true);
  };

  const handleEditFolder = (folder) => {
    setEditingFolder(folder);
    setFolderFormData({ 
      name: folder.name, 
      color: folder.color || 'blue', 
      description: folder.description || '' 
    });
    setShowFolderDialog(true);
  };

  const handleSaveFolder = () => {
    if (!folderFormData.name.trim()) {
      alert('Please enter a folder name');
      return;
    }

    if (editingFolder) {
      updateFolderMutation.mutate({ 
        id: editingFolder.id, 
        data: folderFormData 
      });
    } else {
      createFolderMutation.mutate(folderFormData);
    }
  };

  const handleDeleteFolder = (folderId) => {
    const projectsInFolder = projects.filter(p => p.folder_id === folderId);
    const message = projectsInFolder.length > 0
      ? `Are you sure you want to delete this folder? ${projectsInFolder.length} project(s) will be moved to "No Folder".`
      : 'Are you sure you want to delete this folder?';
    
    if (window.confirm(message)) {
      deleteFolderMutation.mutate(folderId);
    }
  };

  const handleMoveProjectToFolder = (projectId, folderId) => {
    updateProjectMutation.mutate({
      id: projectId,
      data: { folder_id: folderId || null }
    });
  };

  const createProjectMutation = useMutation({
    mutationFn: async (data) => {
      return QueryProject.create(data);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(createPageUrl(`Step1?projectId=${project.id}`));
    },
    onError: (error) => {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  });

  // Filter projects based on selected folder
  const filteredProjects = selectedFolderId 
    ? projects.filter(p => p.folder_id === selectedFolderId)
    : selectedFolderId === 'no-folder'
    ? projects.filter(p => !p.folder_id)
    : projects;

  const stats = {
    total: projects.length,
    inProgress: projects.filter(p => p.status !== 'archived').length,
    completed: projects.filter(p => p.status === 'analysis_complete').length,
    totalQueries: projects.reduce((sum, p) => sum + (p.total_queries || 0), 0),
  };

  const handleCreateProject = () => {
    createProjectMutation.mutate({
      name: `New Project ${format(new Date(), 'MMM d, yyyy')}`,
      status: 'draft',
      current_step: 1,
      folder_id: selectedFolderId && selectedFolderId !== 'no-folder' ? selectedFolderId : null
    });
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              AEO Query Generator
            </h1>
            <p className="text-slate-600">
              Generate, analyze, and visualize Answer Engine Optimization queries
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleCreateFolder}
              variant="outline"
              className="gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              New Folder
            </Button>
            <Button 
              onClick={handleCreateProject}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Projects"
            value={stats.total}
            icon={FolderOpen}
            bgColor="bg-blue-500"
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgress}
            icon={Clock}
            bgColor="bg-indigo-500"
          />
          <StatsCard
            title="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            bgColor="bg-green-500"
          />
          <StatsCard
            title="Total Queries"
            value={stats.totalQueries}
            icon={FileText}
            bgColor="bg-violet-500"
          />
        </div>

        {/* Folders Section */}
        {folders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Folders</h2>
              {selectedFolderId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFolderId(null)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  View All Projects
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {!selectedFolderId && (
                <FolderCard
                  folder={{ id: 'no-folder', name: 'No Folder', color: 'slate' }}
                  projectCount={projects.filter(p => !p.folder_id).length}
                  onClick={() => setSelectedFolderId('no-folder')}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              )}
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  projectCount={projects.filter(p => p.folder_id === folder.id).length}
                  onClick={() => setSelectedFolderId(folder.id)}
                  onEdit={handleEditFolder}
                  onDelete={handleDeleteFolder}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Projects Header */}
        {!selectedFolderId && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">All Projects</h2>
          </div>
        )}

        {/* Projects Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-dashed border-2 bg-white/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {selectedFolderId ? 'No projects in this folder' : 'No projects yet'}
              </h3>
              <p className="text-slate-600 mb-6 text-center max-w-md">
                {selectedFolderId 
                  ? 'Create a new project or move existing projects to this folder'
                  : 'Create your first project to start generating AEO queries for your financial services audience'
                }
              </p>
              <Button onClick={handleCreateProject} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Create {selectedFolderId ? '' : 'First'} Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {selectedFolderId && (
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedFolderId === 'no-folder' 
                    ? 'Projects without folder'
                    : folders.find(f => f.id === selectedFolderId)?.name
                  } ({filteredProjects.length})
                </h2>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  onDelete={handleDeleteProject}
                  onRerun={handleRerunQueries}
                  isDeleting={deletingProjectId === project.id}
                  isRerunning={rerunQueriesMutation.isLoading}
                  folders={folders}
                  onMoveToFolder={handleMoveProjectToFolder}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? 'Edit Folder' : 'Create New Folder'}
            </DialogTitle>
            <DialogDescription>
              {editingFolder 
                ? 'Update folder details below'
                : 'Organize your projects by creating a folder'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g., Client Projects, Financial Services"
                value={folderFormData.name}
                onChange={(e) => setFolderFormData({ ...folderFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-color">Color</Label>
              <Select 
                value={folderFormData.color} 
                onValueChange={(value) => setFolderFormData({ ...folderFormData, color: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLDER_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-description">Description (Optional)</Label>
              <Textarea
                id="folder-description"
                placeholder="Add notes about this folder"
                value={folderFormData.description}
                onChange={(e) => setFolderFormData({ ...folderFormData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFolder}>
              {editingFolder ? 'Update' : 'Create'} Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
