import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, FileText, Globe, Target, AlertTriangle, Edit2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { QueryProject } from "@/api/entities";

export default function ActionableInsights({ queries, companyUrl, brandMentionCount, sourceAppearanceCount, competitorUrls, project }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedRecommendations, setEditedRecommendations] = useState(project?.custom_recommendations || null);
  const [isSaving, setIsSaving] = useState(false);

  const totalAnalyzed = queries.filter(q => q.analysis_status === 'complete').length;
  
  if (totalAnalyzed === 0) {
    return null;
  }

  // Helper functions
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

  // Get company info
  let companyDomain = '';
  let normalizedCompanyName = '';
  if (companyUrl) {
    companyDomain = getDomain(companyUrl);
    const companyName = companyDomain.replace(/\.(com|org|ai|io|net|co)$/, '');
    normalizedCompanyName = normalizeBrandName(companyName);
  }

  // Analyze category distribution
  const categoryAnalysis = {};
  const audienceAnalysis = {};

  queries.forEach(q => {
    // Category counts
    if (q.query_category) {
      if (!categoryAnalysis[q.query_category]) {
        categoryAnalysis[q.query_category] = { total: 0, brandMentioned: 0, asSource: 0, queries: [] };
      }
      categoryAnalysis[q.query_category].total++;
      categoryAnalysis[q.query_category].queries.push(q);

      // Check if brand is mentioned
      if (q.brand_mentions && q.brand_mentions !== 'None' && normalizedCompanyName) {
        const brands = q.brand_mentions.split(',').map(b => b.trim());
        const mentioned = brands.some(brand => {
          const normalizedBrand = normalizeBrandName(brand);
          return normalizedBrand === normalizedCompanyName || 
                 normalizedBrand.includes(normalizedCompanyName) ||
                 normalizedCompanyName.includes(normalizedBrand);
        });
        if (mentioned) categoryAnalysis[q.query_category].brandMentioned++;
      }

      // Check if brand is source
      if (q.source && companyDomain) {
        const source = q.source.toLowerCase();
        if (source.includes(companyDomain)) {
          categoryAnalysis[q.query_category].asSource++;
        }
      }
    }

    // Audience counts
    if (q.target_audience) {
      if (!audienceAnalysis[q.target_audience]) {
        audienceAnalysis[q.target_audience] = { total: 0, brandMentioned: 0, queries: [] };
      }
      audienceAnalysis[q.target_audience].total++;
      audienceAnalysis[q.target_audience].queries.push(q);

      if (q.brand_mentions && q.brand_mentions !== 'None' && normalizedCompanyName) {
        const brands = q.brand_mentions.split(',').map(b => b.trim());
        const mentioned = brands.some(brand => {
          const normalizedBrand = normalizeBrandName(brand);
          return normalizedBrand === normalizedCompanyName || 
                 normalizedBrand.includes(normalizedCompanyName) ||
                 normalizedCompanyName.includes(normalizedBrand);
        });
        if (mentioned) audienceAnalysis[q.target_audience].brandMentioned++;
      }
    }
  });

  // Analyze competitor presence
  const competitorAnalysis = {};
  if (competitorUrls && competitorUrls.length > 0) {
    competitorUrls.forEach(url => {
      if (!url) return;
      const domain = getDomain(url);
      const name = domain.replace(/\.(com|org|ai|io|net|co)$/, '');
      const normalized = normalizeBrandName(name);
      
      competitorAnalysis[domain] = { mentions: 0, sources: 0, queries: [] };
      
      queries.forEach(q => {
        let foundInMentions = false;
        let foundInSources = false;

        if (q.brand_mentions && q.brand_mentions !== 'None') {
          const brands = q.brand_mentions.split(',').map(b => b.trim());
          foundInMentions = brands.some(brand => {
            const normalizedBrand = normalizeBrandName(brand);
            return normalizedBrand === normalized || 
                   normalizedBrand.includes(normalized) ||
                   normalized.includes(normalizedBrand);
          });
        }

        if (q.source) {
          const source = q.source.toLowerCase();
          foundInSources = source.includes(domain);
        }

        if (foundInMentions) competitorAnalysis[domain].mentions++;
        if (foundInSources) competitorAnalysis[domain].sources++;
        if (foundInMentions || foundInSources) {
          competitorAnalysis[domain].queries.push(q);
        }
      });
    });
  }

  // Find top competitors
  const topCompetitors = Object.entries(competitorAnalysis)
    .sort((a, b) => (b[1].mentions + b[1].sources) - (a[1].mentions + a[1].sources))
    .slice(0, 3)
    .filter(([_, data]) => data.mentions + data.sources > 0);

  // Find biggest gaps
  const categoryGaps = Object.entries(categoryAnalysis)
    .map(([cat, data]) => ({
      category: cat,
      ...data,
      gap: data.total - data.brandMentioned - data.asSource
    }))
    .sort((a, b) => b.gap - a.gap);

  const audienceGaps = Object.entries(audienceAnalysis)
    .map(([aud, data]) => ({
      audience: aud,
      ...data,
      percentage: data.total > 0 ? ((data.brandMentioned / data.total) * 100).toFixed(0) : 0
    }))
    .sort((a, b) => parseFloat(a.percentage) - parseFloat(b.percentage));

  // Calculate percentages
  const brandMentionPercentage = totalAnalyzed > 0 ? ((brandMentionCount / totalAnalyzed) * 100) : 0;

  // Helper to check if brand appears in a query
  const brandAppearsInQuery = (q) => {
    const brandMentioned = (q.brand_mentions && q.brand_mentions !== 'None' && normalizedCompanyName && 
      q.brand_mentions.split(',').some(b => {
        const nb = normalizeBrandName(b.trim());
        return nb === normalizedCompanyName || nb.includes(normalizedCompanyName) || normalizedCompanyName.includes(nb);
      }));
    const citedAsSource = (q.source && companyDomain && q.source.toLowerCase().includes(companyDomain));
    return brandMentioned || citedAsSource;
  };

  // Build default recommendations (same logic as before)
  const defaultRecommendations = [];

  // RECOMMENDATION 1: Biggest Category Gap
  const biggestGap = categoryGaps[0];
  if (biggestGap && biggestGap.gap > 0) {
    const exampleQueries = biggestGap.queries
      .filter(q => !brandAppearsInQuery(q))
      .slice(0, 3)
      .map(q => q.query_text);

    if (topCompetitors.length > 0) {
      const competitorNames = topCompetitors.map(([domain]) => domain).join(', ');
      const totalCompetitorAppearances = topCompetitors.reduce((sum, [_, data]) => sum + data.mentions + data.sources, 0);
      const yourTotalAppearances = brandMentionCount + sourceAppearanceCount;
      
      let comparisonText;
      if (yourTotalAppearances > totalCompetitorAppearances) {
        comparisonText = `Your competitors (${competitorNames}) appear in ${totalCompetitorAppearances} total mentions, while you appear in ${yourTotalAppearances}. However, the biggest gap is in "${biggestGap.category}" where you're missing from ${biggestGap.gap} out of ${biggestGap.total} queries.`;
      } else if (yourTotalAppearances < totalCompetitorAppearances) {
        comparisonText = `Your competitors (${competitorNames}) appear in ${totalCompetitorAppearances} total mentions, while you only appear in ${yourTotalAppearances}. The biggest gap is in "${biggestGap.category}" where you're missing from ${biggestGap.gap} out of ${biggestGap.total} queries.`;
      } else {
        comparisonText = `Your competitors (${competitorNames}) and you both appear in ${yourTotalAppearances} mentions. The biggest differentiation opportunity is in "${biggestGap.category}" where you're missing from ${biggestGap.gap} out of ${biggestGap.total} queries.`;
      }

      defaultRecommendations.push({
        num: '1',
        title: `Close Your ${biggestGap.category} Content Gap`,
        description: comparisonText,
        examples: exampleQueries.length > 0 ? exampleQueries : undefined,
        action: `Create authoritative content targeting "${biggestGap.category}" queries. Focus on in-depth guides, case studies, and thought leadership pieces.`,
        color: { bg: [239, 68, 68], bgLight: [254, 226, 226], border: [252, 165, 165], text: [220, 38, 38] },
        icon: AlertTriangle
      });
    } else {
      defaultRecommendations.push({
        num: '1',
        title: `Dominate ${biggestGap.category} Content`,
        description: `You're missing from ${biggestGap.gap} out of ${biggestGap.total} queries in "${biggestGap.category}" - your biggest opportunity category.`,
        examples: exampleQueries,
        action: `Create comprehensive resources addressing these topics. Use structured data (FAQ, How-To schemas) and ensure content directly answers searcher intent.`,
        color: { bg: [59, 130, 246], bgLight: [219, 234, 254], border: [147, 197, 253], text: [29, 78, 216] },
        icon: Target
      });
    }
  }

  // RECOMMENDATION 2: Second Biggest Category Gap
  const secondGap = categoryGaps[1];
  if (secondGap && secondGap.gap > 0 && defaultRecommendations.length < 2) { 
    const exampleQueries = secondGap.queries
      .filter(q => !brandAppearsInQuery(q))
      .slice(0, 3)
      .map(q => q.query_text);
    
    defaultRecommendations.push({
      num: String(defaultRecommendations.length + 1),
      title: `Expand into ${secondGap.category}`,
      description: `After addressing "${biggestGap.category}", target "${secondGap.category}" where you're missing from ${secondGap.gap} out of ${secondGap.total} queries.`,
      examples: exampleQueries.length > 0 ? exampleQueries : undefined,
      action: `Develop content strategy for ${secondGap.category}. Create a content calendar targeting these queries with blog posts, guides, videos, and tools.`,
      color: { bg: [99, 102, 241], bgLight: [224, 231, 255], border: [165, 180, 252], text: [67, 56, 202] },
      icon: FileText
    });
  }

  // RECOMMENDATION 3: Weakest Audience Gap
  if (audienceGaps.length > 0) {
    const weakestAudience = audienceGaps[0];
    const strongestAudience = audienceGaps[audienceGaps.length - 1];
    
    const exampleQueries = weakestAudience.queries
      .filter(q => {
        const brandAppears = (q.brand_mentions && q.brand_mentions !== 'None' && normalizedCompanyName && 
          q.brand_mentions.split(',').some(b => {
            const nb = normalizeBrandName(b.trim());
            return nb === normalizedCompanyName || nb.includes(normalizedCompanyName) || normalizedCompanyName.includes(nb);
          })) || (q.source && companyDomain && q.source.toLowerCase().includes(companyDomain));
        
        return !brandAppears;
      })
      .slice(0, 3)
      .map(q => q.query_text);

    const hasMultipleAudiences = audienceGaps.length > 1;

    if (brandMentionCount === 0) {
      defaultRecommendations.push({
        num: '3',
        title: `Build Presence with ${weakestAudience.audience}`,
        description: hasMultipleAudiences 
          ? `You have zero brand visibility across all audience segments. Start with ${weakestAudience.audience} - the weakest performing audience where you're not appearing in any of ${weakestAudience.total} queries.`
          : `You have zero brand visibility. There are ${weakestAudience.total} queries for ${weakestAudience.audience} where you're not appearing.`,
        examples: exampleQueries.length > 0 ? exampleQueries : undefined,
        action: `Create dedicated landing pages, whitepapers, case studies, and resources specifically for ${weakestAudience.audience}. Address their unique pain points and use their language.`,
        color: { bg: [139, 92, 246], bgLight: [233, 213, 255], border: [196, 181, 253], text: [109, 40, 217] },
        icon: Target
      });
    } else if (brandMentionPercentage < 10) {
      defaultRecommendations.push({
        num: '3',
        title: `Expand Reach to ${weakestAudience.audience}`,
        description: hasMultipleAudiences
          ? `You have minimal brand visibility (only ${brandMentionCount} mentions out of ${totalAnalyzed} queries). ${weakestAudience.audience} is your weakest performing audience - they see your brand only ${weakestAudience.percentage}% of the time, with ${weakestAudience.total - weakestAudience.brandMentioned} queries where you're not appearing.`
          : `You have minimal brand visibility (only ${brandMentionCount} mentions out of ${totalAnalyzed} queries). ${weakestAudience.audience} see your brand only ${weakestAudience.percentage}% of the time - there are ${weakestAudience.total - weakestAudience.brandMentioned} queries from this audience where you're not appearing.`,
        examples: exampleQueries.length > 0 ? exampleQueries : undefined,
        action: `Create dedicated landing pages, whitepapers, case studies, and resources specifically for ${weakestAudience.audience}. Address their unique pain points and use their language.`,
        color: { bg: [139, 92, 246], bgLight: [233, 213, 255], border: [196, 181, 253], text: [109, 40, 217] },
        icon: Target
      });
    } else if (hasMultipleAudiences) {
      defaultRecommendations.push({
        num: '3',
        title: `Target ${weakestAudience.audience} Specifically`,
        description: `${strongestAudience.audience} see your brand ${strongestAudience.percentage}% of the time, but ${weakestAudience.audience} only ${weakestAudience.percentage}% of the time. You're missing a key audience segment.`,
        examples: exampleQueries.length > 0 ? exampleQueries : undefined,
        action: `Create dedicated landing pages, whitepapers, case studies, and resources specifically for ${weakestAudience.audience}. Address their unique pain points and use their language.`,
        color: { bg: [139, 92, 246], bgLight: [233, 213, 255], border: [196, 181, 253], text: [109, 40, 217] },
        icon: Target
      });
    } else {
      defaultRecommendations.push({
        num: '3',
        title: `Strengthen ${weakestAudience.audience} Engagement`,
        description: `You're appearing in ${brandMentionPercentage.toFixed(1)}% of queries. Focus on increasing your presence with ${weakestAudience.audience} to capture the remaining ${weakestAudience.total - weakestAudience.brandMentioned} queries where you're missing.`,
        examples: exampleQueries.length > 0 ? exampleQueries : undefined,
        action: `Create more comprehensive content for ${weakestAudience.audience}. Focus on their specific pain points, use cases, and decision-making criteria. Expand your content coverage across all query categories.`,
        color: { bg: [139, 92, 246], bgLight: [233, 213, 255], border: [196, 181, 253], text: [109, 40, 217] },
        icon: Target
      });
    }
  }

  // Fill remaining if needed
  while (defaultRecommendations.length < 3 && categoryGaps.length > defaultRecommendations.length) {
    const nextGap = categoryGaps[defaultRecommendations.length];
    if (nextGap && nextGap.gap > 0) {
      defaultRecommendations.push({
        num: String(defaultRecommendations.length + 1),
        title: `Expand Coverage in ${nextGap.category}`,
        description: `Create more content in "${nextGap.category}" where you're missing from ${nextGap.gap} out of ${nextGap.total} queries.`,
        action: `Develop targeted content addressing these query types.`,
        color: { bg: [139, 92, 246], bgLight: [233, 213, 255], border: [196, 181, 253], text: [109, 40, 217] },
        icon: FileText
      });
    } else {
      break;
    }
  }

  // Use edited recommendations if available, otherwise use defaults
  const recommendations = editedRecommendations || defaultRecommendations;

  const handleEdit = (index) => {
    setEditingIndex(index);
  };

  const handleCancel = () => {
    setEditingIndex(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await QueryProject.update(project.id, {
        custom_recommendations: recommendations
      });
      setEditedRecommendations(recommendations);
      setEditingIndex(null);
    } catch (error) {
      console.error('Error saving recommendations:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRecommendation = (index, field, value) => {
    const updated = [...recommendations];
    updated[index] = { ...updated[index], [field]: value };
    setEditedRecommendations(updated);
  };

  const updateExample = (recIndex, exampleIndex, value) => {
    const updated = [...recommendations];
    const examples = [...(updated[recIndex].examples || [])];
    examples[exampleIndex] = value;
    updated[recIndex] = { ...updated[recIndex], examples };
    setEditedRecommendations(updated);
  };

  return (
    <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-600" />
          Actionable Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-6">
          Based on your specific analysis results, here are your top priorities:
        </p>
        
        <div className="space-y-4">
          {recommendations.slice(0, 3).map((rec, idx) => {
            const Icon = rec.icon;
            const isEditing = editingIndex === idx;
            
            return (
              <div key={rec.num + '-' + idx} className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-xl flex-shrink-0"
                    style={{ 
                      backgroundColor: `rgb(${rec.color.bgLight.join(',')})`,
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: `rgb(${rec.color.border.join(',')})`
                    }}
                  >
                    <Icon 
                      className="w-6 h-6" 
                      style={{ color: `rgb(${rec.color.bg.join(',')})` }}
                    />
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <>
                        <div className="mb-3">
                          <Input
                            value={rec.title}
                            onChange={(e) => updateRecommendation(idx, 'title', e.target.value)}
                            className="font-bold text-lg"
                            placeholder="Title"
                          />
                        </div>
                        <div className="mb-3">
                          <Textarea
                            value={rec.description}
                            onChange={(e) => updateRecommendation(idx, 'description', e.target.value)}
                            className="text-sm"
                            rows={4}
                            placeholder="Description"
                          />
                        </div>
                        
                        {rec.examples && rec.examples.length > 0 && (
                          <div className="mb-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Example queries you're missing:</p>
                            <div className="space-y-2">
                              {rec.examples.map((query, queryIdx) => (
                                <Input
                                  key={queryIdx}
                                  value={query}
                                  onChange={(e) => updateExample(idx, queryIdx, e.target.value)}
                                  className="text-xs"
                                  placeholder={`Example ${queryIdx + 1}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <Textarea
                            value={rec.action}
                            onChange={(e) => updateRecommendation(idx, 'action', e.target.value)}
                            className="text-sm"
                            rows={3}
                            placeholder="Action Plan"
                          />
                        </div>
                        
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isSaving ? (
                              <>Saving...</>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSaving}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-lg text-slate-900">
                            {rec.num}. {rec.title}
                          </h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(idx)}
                            className="ml-2"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed mb-3">
                          {rec.description}
                        </p>
                        
                        {rec.examples && rec.examples.length > 0 && (
                          <div className="mb-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Example queries you're missing:</p>
                            <div className="space-y-1.5">
                              {rec.examples.map((query, queryIdx) => (
                                <div key={queryIdx} className="flex items-start gap-2">
                                  <span className="text-slate-400 text-xs mt-0.5">•</span>
                                  <p className="text-xs text-slate-700 italic">"{query}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div 
                          className="rounded-lg p-3 border-l-4"
                          style={{ 
                            backgroundColor: `rgb(${rec.color.bgLight.join(',')})`,
                            borderColor: `rgb(${rec.color.bg.join(',')})`
                          }}
                        >
                          <p className="text-xs font-semibold text-slate-600 mb-1">Action Plan:</p>
                          <p className="text-sm text-slate-700">
                            {rec.action}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-white border border-amber-200 rounded-lg p-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>💡 Pro Tip:</strong> AI search engines prioritize content that directly answers questions with authority and structure. Focus on creating comprehensive, well-organized resources with proper schema markup, not keyword-stuffed pages. The recommendations above are based on your specific data gaps and competitive landscape.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}