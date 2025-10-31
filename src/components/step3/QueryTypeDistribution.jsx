import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function QueryTypeDistribution({ queries }) {
  const data = [
    {
      name: 'Educational',
      value: queries.filter(q => q.query_type === 'Educational').length,
      color: '#3b82f6'
    },
    {
      name: 'Service-Aligned',
      value: queries.filter(q => q.query_type === 'Service-Aligned').length,
      color: '#6366f1'
    }
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Query Type Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}