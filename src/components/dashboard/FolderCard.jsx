import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Folder, MoreVertical, Pencil, Trash2, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const colorClasses = {
  blue: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200",
  purple: "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200",
  pink: "bg-pink-100 text-pink-700 border-pink-300 hover:bg-pink-200",
  green: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200",
  orange: "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200",
  red: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200",
  slate: "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
};

export default function FolderCard({ folder, projectCount, onClick, onEdit, onDelete }) {
  const colorClass = colorClasses[folder.color] || colorClasses.blue;

  return (
    <Card 
      className={`group cursor-pointer transition-all duration-300 border-2 ${colorClass}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <Folder className="w-8 h-8" />
          <div>
            <CardTitle className="text-lg font-bold">{folder.name}</CardTitle>
            {folder.description && (
              <p className="text-xs opacity-80 mt-1">{folder.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(folder); }}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {projectCount} {projectCount === 1 ? 'project' : 'projects'}
          </span>
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );
}