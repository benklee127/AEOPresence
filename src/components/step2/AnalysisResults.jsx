import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ArrowRight, Loader2 } from "lucide-react";

export default function AnalysisResults({ queries, isComplete, onDownload, onProceed }) {
  // Calculate how long each query has been analyzing
  const getAnalyzingDuration = (query) => {
    if (query.analysis_status !== 'analyzing' || !query.updated_at) return null;
    
    const now = new Date();
    const updated = new Date(query.updated_at);
    const seconds = Math.floor((now - updated) / 1000);
    
    return seconds;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Analysis Results</span>
          <div className="flex gap-2">
            <Button onClick={onDownload} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            {isComplete && (
              <Button onClick={onProceed} size="sm" className="bg-violet-600 hover:bg-violet-700">
                View Analytics
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Query</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-40">Category</TableHead>
                <TableHead className="w-32">Brands</TableHead>
                <TableHead className="w-32">Source</TableHead>
                <TableHead className="w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((query, index) => {
                const analyzingDuration = getAnalyzingDuration(query);
                const isStuck = analyzingDuration && analyzingDuration > 60;
                
                return (
                  <TableRow key={query.id} className={isStuck ? 'bg-red-50' : ''}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="max-w-md truncate">{query.query_text}</TableCell>
                    <TableCell>
                      <Badge variant={query.query_type === 'Educational' ? 'default' : 'secondary'} className="text-xs">
                        {query.query_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {query.query_category ? (
                        <Badge variant="outline" className="text-xs">
                          {query.query_category}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {query.brand_mentions || '-'}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-xs">
                      {query.source || '-'}
                    </TableCell>
                    <TableCell>
                      {query.analysis_status === 'complete' ? (
                        <Badge className="bg-green-100 text-green-700">Complete</Badge>
                      ) : query.analysis_status === 'analyzing' ? (
                        <div className="flex flex-col gap-1">
                          <Badge className={`${isStuck ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Analyzing
                          </Badge>
                          {analyzingDuration !== null && (
                            <span className={`text-xs ${isStuck ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                              {analyzingDuration}s {isStuck && '⚠️ STUCK'}
                            </span>
                          )}
                        </div>
                      ) : query.analysis_status === 'error' ? (
                        <Badge className="bg-red-100 text-red-700">Error</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}