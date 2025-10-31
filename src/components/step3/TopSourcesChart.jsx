import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function TopSourcesChart({ queries }) {
  const extractDomain = (url) => {
    if (!url || typeof url !== 'string') return null;
    
    try {
      // Clean up the URL
      let cleanUrl = url.trim();
      
      // Add protocol if missing
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      // Parse URL
      const urlObj = new URL(cleanUrl);
      let domain = urlObj.hostname;
      
      // Remove www. prefix
      domain = domain.replace(/^www\./i, '');
      
      return domain;
    } catch (e) {
      // Manual fallback - extract domain from string
      try {
        let cleaned = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
        const slashIndex = cleaned.indexOf('/');
        const domain = slashIndex > -1 ? cleaned.substring(0, slashIndex) : cleaned;
        
        // Only return if it looks like a domain (has a dot)
        if (domain.includes('.')) {
          return domain;
        }
      } catch (err) {
        console.error('Failed to extract domain:', url, err);
      }
      return null;
    }
  };

  const sourceCounts = {};
  
  queries.forEach(query => {
    if (query.source && query.source.trim() !== '' && query.source !== 'Web search completed' && query.source !== 'Search completed') {
      const sources = query.source.split(',').map(s => s.trim()).filter(s => s.length > 0);
      sources.forEach(source => {
        if (source) {
          const domain = extractDomain(source);
          if (domain && domain.length > 0 && domain.includes('.')) {
            sourceCounts[domain] = (sourceCounts[domain] || 0) + 1;
          }
        }
      });
    }
  });

  const data = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .filter(item => item.source && item.source.length > 0 && item.source.includes('.'))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const COLORS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c026d3', '#d946ef'
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Top Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="source" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-500 text-center py-8">
            No source data available yet. Complete the analysis in Step 2.
          </p>
        )}
      </CardContent>
    </Card>
  );
}