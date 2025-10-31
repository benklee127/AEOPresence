
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle, Building2, Globe } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

export default function BrandPresence({ queries, companyUrl, companyLogoUrl }) {
  if (!companyUrl) {
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
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const companyDomain = getDomain(companyUrl);
  const companyName = companyDomain.replace(/\.(com|org|ai|io|net|co)$/, '');
  const normalizedCompanyName = normalizeBrandName(companyName);

  const brandMentionQueries = queries.filter(q => {
    if (!q.brand_mentions || q.brand_mentions === 'None') return false;
    
    const brands = q.brand_mentions.split(',').map(b => b.trim());
    
    return brands.some(brand => {
      const normalizedBrand = normalizeBrandName(brand);
      return normalizedBrand === normalizedCompanyName || 
             normalizedBrand.includes(normalizedCompanyName) ||
             normalizedCompanyName.includes(normalizedBrand);
    });
  });

  const sourceAppearanceQueries = queries.filter(q => {
    if (!q.source) return false;
    const source = q.source.toLowerCase();
    return source.includes(companyDomain);
  });

  const totalAnalyzed = queries.filter(q => q.analysis_status === 'complete').length;
  const brandMentionPercentage = totalAnalyzed > 0 ? ((brandMentionQueries.length / totalAnalyzed) * 100).toFixed(1) : 0;
  const sourcePercentage = totalAnalyzed > 0 ? ((sourceAppearanceQueries.length / totalAnalyzed) * 100).toFixed(1) : 0;

  const brandMentionsByAudience = {};
  brandMentionQueries.forEach(q => {
    if (q.target_audience) {
      brandMentionsByAudience[q.target_audience] = (brandMentionsByAudience[q.target_audience] || 0) + 1;
    }
  });

  const brandAudienceData = Object.entries(brandMentionsByAudience)
    .map(([audience, count]) => ({ audience, count }))
    .sort((a, b) => b.count - a.count);

  const sourceAppearancesByAudience = {};
  sourceAppearanceQueries.forEach(q => {
    if (q.target_audience) {
      sourceAppearancesByAudience[q.target_audience] = (sourceAppearancesByAudience[q.target_audience] || 0) + 1;
    }
  });

  const sourceAudienceData = Object.entries(sourceAppearancesByAudience)
    .map(([audience, count]) => ({ audience, count }))
    .sort((a, b) => b.count - a.count);

  const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c026d3'];

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader>
        <div className="flex flex-col items-center gap-4">
          {companyLogoUrl ? (
            <img 
              src={companyLogoUrl} 
              alt="Company logo" 
              className="w-48 h-48 object-contain rounded"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center">
              <TrendingUp className="w-16 h-16 text-blue-600" />
            </div>
          )}
          <CardTitle className="text-center text-2xl">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">
              Your AI Brand Presence Audit
            </span>
            <span className="text-slate-600"> by </span>
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">
              GK3
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-slate-600 mb-4">Tracking: <span className="font-semibold text-slate-900">{companyUrl}</span></p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Brand Mentions</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-blue-600">{brandMentionQueries.length}</span>
                  <span className="text-sm text-slate-600">times</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Your brand appeared in {brandMentionPercentage}% of analyzed queries
                </p>
                <Badge className="mt-2 bg-blue-100 text-blue-700 border-blue-300">
                  {brandMentionPercentage > 20 ? 'Strong Visibility' : brandMentionPercentage > 10 ? 'Moderate Visibility' : 'Low Visibility'}
                </Badge>
              </div>

              {brandAudienceData.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-medium text-slate-700 mb-3">Audiences Reached:</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart 
                      data={brandAudienceData} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="audience" 
                        type="category" 
                        width={120}
                        tick={{ fontSize: 10, fill: '#475569' }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {brandAudienceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-slate-700">Source Appearances</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-indigo-600">{sourceAppearanceQueries.length}</span>
                  <span className="text-sm text-slate-600">times</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Your website appeared as a source in {sourcePercentage}% of queries
                </p>
                <Badge className="mt-2 bg-indigo-100 text-indigo-700 border-indigo-300">
                  {sourcePercentage > 15 ? 'Strong Authority' : sourcePercentage > 5 ? 'Moderate Authority' : 'Low Authority'}
                </Badge>
              </div>

              {sourceAudienceData.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-indigo-200">
                  <p className="text-sm font-medium text-slate-700 mb-3">Audiences Reached:</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart 
                      data={sourceAudienceData} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        dataKey="audience" 
                        type="category" 
                        width={120}
                        tick={{ fontSize: 10, fill: '#475569' }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {sourceAudienceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        <LabelList dataKey="count" position="right" style={{ fontSize: 11 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {brandMentionQueries.length === 0 && sourceAppearanceQueries.length === 0 && totalAnalyzed > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Your brand was not found in any search results. Consider creating more content around these query topics to improve your AEO presence.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
