import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CategoryDistribution({ queries }) {
  const categoryCounts = {};
  
  queries.forEach(query => {
    if (query.query_category) {
      categoryCounts[query.query_category] = (categoryCounts[query.query_category] || 0) + 1;
    }
  });

  const data = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Query Category Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-sm text-slate-700 flex-1">{item.category}</span>
              <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                {item.count}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}