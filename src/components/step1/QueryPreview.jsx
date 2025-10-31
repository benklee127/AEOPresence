import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ArrowRight, CheckCircle2 } from "lucide-react";

export default function QueryPreview({ queries, onDownload, onProceed }) {
  const educationalCount = queries.filter(q => q.query_type === 'Educational').length;
  const serviceCount = queries.filter(q => q.query_type === 'Service-Aligned').length;
  
  // Count by category
  const categoryCounts = {};
  queries.forEach(q => {
    if (q.query_category) {
      categoryCounts[q.query_category] = (categoryCounts[q.query_category] || 0) + 1;
    }
  });

  // Count by format
  const formatCounts = {
    'Natural-language questions': queries.filter(q => q.query_format === 'Natural-language questions').length,
    'Keyword phrases': queries.filter(q => q.query_format === 'Keyword phrases').length
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Queries Generated Successfully
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-600">Total Queries</p>
              <p className="text-2xl font-bold text-slate-900">{queries.length}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Educational</p>
              <p className="text-2xl font-bold text-blue-600">{educationalCount}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Service-Aligned</p>
              <p className="text-2xl font-bold text-indigo-600">{serviceCount}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Questions</p>
              <p className="text-2xl font-bold text-violet-600">{formatCounts['Natural-language questions']}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-2">Category Distribution:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([category, count]) => (
                <div key={category} className="flex justify-between">
                  <span className="text-slate-600">{category}</span>
                  <span className="font-medium text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={onDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            <Button onClick={onProceed} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              Proceed to Analysis
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Queries Preview</CardTitle>
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
                  <TableHead className="w-32">Format</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.slice(0, 50).map((query) => (
                  <TableRow key={query.id}>
                    <TableCell className="font-medium">{query.query_id}</TableCell>
                    <TableCell>{query.query_text}</TableCell>
                    <TableCell>
                      <Badge variant={query.query_type === 'Educational' ? 'default' : 'secondary'}>
                        {query.query_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {query.query_category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                        {query.query_format === 'Natural-language questions' ? 'Question' : 'Keyword'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {queries.length > 50 && (
            <p className="text-sm text-slate-600 text-center mt-4">
              Showing first 50 of {queries.length} queries. Download CSV to see all.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}