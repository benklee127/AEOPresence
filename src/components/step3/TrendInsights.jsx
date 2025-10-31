import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Building2, Globe } from "lucide-react";

export default function TrendInsights({ queries }) {
  const insights = [
    {
      title: "Total Queries Analyzed",
      value: queries.length,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Brand Mentions Found",
      value: queries.filter(q => q.brand_mentions && q.brand_mentions !== 'None').length,
      icon: Building2,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    },
    {
      title: "Unique Sources",
      value: new Set(queries.map(q => q.source).filter(s => s && s !== 'Web search completed' && s !== 'Search completed')).size,
      icon: Globe,
      color: "text-violet-600",
      bgColor: "bg-violet-100"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {insights.map((insight, index) => (
        <Card key={index} className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              {insight.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${insight.bgColor}`}>
              <insight.icon className={`w-4 h-4 ${insight.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{insight.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}