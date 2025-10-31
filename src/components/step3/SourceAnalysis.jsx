import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SourceAnalysis({ queries }) {
  const sourceCounts = {};
  
  queries.forEach(query => {
    if (query.source) {
      const sources = query.source.split(',').map(s => s.trim());
      sources.forEach(source => {
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
    }
  });

  const topSources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Information Sources Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {topSources.map(({ source, count }, index) => (
            <Badge
              key={index}
              variant="outline"
              className="text-sm px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
            >
              {source}
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                {count}
              </span>
            </Badge>
          ))}
        </div>
        {topSources.length === 0 && (
          <p className="text-slate-500 text-center py-8">
            No source data available yet. Complete the analysis in Step 2.
          </p>
        )}
      </CardContent>
    </Card>
  );
}