import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function BrandMentionsChart({ queries }) {
  const brandBlacklist = [
    'index', 'folder', 'file', 'document', 'page', 'website', 'site', 
    'company', 'firm', 'corporation', 'organization', 'business',
    'article', 'report', 'study', 'research', 'analysis', 'data',
    'source', 'sources', 'information', 'content', 'results',
    'search', 'google', 'web', 'internet', 'online', 'digital'
  ];

  const isValidBrand = (brand) => {
    if (!brand || typeof brand !== 'string') return false;
    
    const cleaned = brand
      .trim()
      .replace(/^[_\-\s\*\.,:;!?]+/g, '')
      .replace(/[_\-\s\*\.,:;!?]+$/g, '')
      .trim();
    
    if (!cleaned || cleaned.length < 2) return false;
    
    const alphanumeric = cleaned.match(/[a-zA-Z0-9]/g);
    if (!alphanumeric || alphanumeric.length < 2) return false;
    
    if (!/[a-zA-Z]/.test(cleaned)) return false;
    
    const lowerCleaned = cleaned.toLowerCase();
    if (brandBlacklist.some(term => lowerCleaned.includes(term))) return false;
    
    const sentencePatterns = [
      /^(or|and|the|a|an)\s/i,
      /(were|are|was|is|have|has|been|at|in|on|of|to|for|with)\s/i,
      /succeed/i, /mention/i, /context/i, /barrier/i,
      /identif/i, /effective/i, /communication/i, /investor/i,
      /experience/i, /-are-/i, /-is-/i, /-were-/i, /-has-/i
    ];
    
    if (sentencePatterns.some(pattern => pattern.test(cleaned))) return false;
    
    const hyphens = (cleaned.match(/-/g) || []).length;
    if (hyphens > 2) return false;
    
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 3) return false;
    
    return true;
  };

  const brandCounts = {};
  
  queries.forEach(query => {
    if (!query.brand_mentions || query.brand_mentions === 'None') return;
    
    const brands = query.brand_mentions.split(',');
    
    brands.forEach(brand => {
      const cleaned = brand.trim();
      
      if (isValidBrand(cleaned)) {
        const finalBrand = cleaned
          .replace(/^[_\-\s\*\.,:;!?]+/g, '')
          .replace(/[_\-\s\*\.,:;!?]+$/g, '')
          .trim();
          
        if (finalBrand && finalBrand.length >= 2) {
          brandCounts[finalBrand] = (brandCounts[finalBrand] || 0) + 1;
        }
      }
    });
  });

  const data = Object.entries(brandCounts)
    .filter(([brand]) => isValidBrand(brand))
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const COLORS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c026d3',
    '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316'
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Top Brand Mentions</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis 
                dataKey="brand" 
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
        ) : (
          <p className="text-slate-500 text-center py-8">
            No brand mentions found yet. Complete the analysis in Step 2.
          </p>
        )}
      </CardContent>
    </Card>
  );
}