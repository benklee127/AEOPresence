import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function CompetitorBrandMentions({ queries, competitorUrls }) {
  if (!competitorUrls || competitorUrls.length === 0) {
    return null;
  }

  const getDomain = (url) => {
    try {
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
      return match ? match[1].toLowerCase() : url.toLowerCase();
    } catch (e) {
      return url.toLowerCase();
    }
  };

  const normalizeBrandName = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  };

  // Create data for each competitor
  const data = competitorUrls.map(url => {
    const domain = getDomain(url);
    const companyName = domain.replace(/\.(com|org|ai|io|net|co)$/, '');
    const normalizedCompanyName = normalizeBrandName(companyName);

    const count = queries.filter(q => {
      if (!q.brand_mentions || q.brand_mentions === 'None') return false;
      const brands = q.brand_mentions.split(',').map(b => b.trim());
      return brands.some(brand => {
        const normalizedBrand = normalizeBrandName(brand);
        return normalizedBrand === normalizedCompanyName || 
               normalizedBrand.includes(normalizedCompanyName) ||
               normalizedCompanyName.includes(normalizedBrand);
      });
    }).length;

    return {
      competitor: domain.length > 25 ? domain.substring(0, 22) + '...' : domain,
      count
    };
  });

  const maxValue = Math.max(...data.map(d => d.count), 1);

  const COLORS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c026d3'
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Top Competitor Brand Mentions</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(data.length * 50, 200)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, maxValue]} />
            <YAxis 
              dataKey="competitor" 
              type="category" 
              width={160}
              tick={{ fill: '#475569', fontSize: 11 }}
            />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 8, 8, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}