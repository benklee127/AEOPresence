import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Sparkles, Loader2, CheckCircle2, Users, Upload, X } from "lucide-react";

const AUDIENCE_OPTIONS = [
  "Asset Managers",
  "Financial Advisors",
  "B2B Financial Services",
  "Institutional Investors",
  "Accredited Investors"
];

const QUERY_CATEGORIES = [
  "Industry monitoring",
  "Competitor benchmarking",
  "Operational training",
  "Foundational understanding",
  "Real-world learning examples",
  "Educational — people-focused",
  "Trend explanation",
  "Pain-point focused — commercial intent",
  "Product or vendor-related — lead intent",
  "Decision-stage — ready to buy or engage"
];

export default function OnboardingForm({ project, onComplete }) {
  const [formData, setFormData] = useState({
    name: project?.name || '',
    company_url: project?.company_url || '',
    company_logo_url: project?.company_logo_url || '',
    competitor_urls: project?.competitor_urls || ['', '', '', '', ''],
    audience: project?.audience || [],
    themes: project?.themes || '',
    query_mix_type: project?.query_mix_type || 'Mixed',
    educational_ratio: project?.educational_ratio || 60,
    service_ratio: project?.service_ratio || 40,
    manual_queries: project?.manual_queries || ['', '', '', '', ''],
  });

  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);
  const [isSuggestingCompetitors, setIsSuggestingCompetitors] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [detectedNiche, setDetectedNiche] = useState('');
  const [urlError, setUrlError] = useState('');
  const [competitorError, setCompetitorError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAudienceToggle = (audience) => {
    const currentAudiences = formData.audience || [];
    const newAudiences = currentAudiences.includes(audience)
      ? currentAudiences.filter(a => a !== audience)
      : [...currentAudiences, audience];
    setFormData({ ...formData, audience: newAudiences });
  };

  const handleCompetitorUrlChange = (index, value) => {
    const newUrls = [...formData.competitor_urls];
    newUrls[index] = value;
    setFormData({ ...formData, competitor_urls: newUrls });
  };

  const handleManualQueryChange = (index, value) => {
    const newQueries = [...formData.manual_queries];
    newQueries[index] = value;
    setFormData({ ...formData, manual_queries: newQueries });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (e.g., PNG, JPG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, company_logo_url: file_url });
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = null;
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, company_logo_url: '' });
  };

  const handleSuggestCompetitors = async () => {
    if (!formData.company_url) {
      setCompetitorError('Please enter a company URL first');
      return;
    }

    setIsSuggestingCompetitors(true);
    setCompetitorError('');
    setDetectedNiche('');
    
    try {
      setDetectedNiche('🔍 Analyzing company focus...');
      
      const nicheResponse = await InvokeLLM({
        prompt: `Analyze this company's website: ${formData.company_url}

GOAL: Identify their SPECIFIC BUSINESS NICHE/FOCUS with extreme precision.

BUSINESS MODEL CATEGORIES:
1. INVESTOR/SYNDICATION (passive investment opportunities)
   - Specific asset classes: self-storage, multifamily apartments, mobile home parks, single-family rentals, industrial warehouses, retail centers, office buildings, ATMs, car washes, data centers, senior living, student housing, etc.
   
2. OPERATOR/SERVICE PROVIDER (active business operations)
   - Specific services: property management, consulting, software/platform, brokerage, lending, construction, etc.

3. B2B FINANCIAL SERVICES
   - Specific offerings: fund administration, compliance software, marketing for financial services, CRM, etc.

INSTRUCTIONS:
1. Determine if they are: Investor/Syndication, Operator/Service, or B2B Financial
2. Identify their EXACT NICHE within that category
3. Be EXTREMELY SPECIFIC about the asset class or service type
4. Examples of good specificity:
   - "Self-storage real estate syndication"
   - "Multifamily apartment investments"
   - "ATM passive income investments"
   - "Marketing software for asset managers"
   - "Property management for mobile home parks"

Return JSON:
{
  "business_type": "Investor/Syndication | Operator/Service | B2B Financial",
  "specific_niche": "exact niche description",
  "key_identifiers": ["keyword1", "keyword2", "keyword3"]
}`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            business_type: { type: "string" },
            specific_niche: { type: "string" },
            key_identifiers: { type: "array", items: { type: "string" } }
          },
          required: ["business_type", "specific_niche"]
        }
      });

      if (!nicheResponse || !nicheResponse.specific_niche) {
        throw new Error('Could not detect company niche from the provided URL.');
      }

      const nicheDisplay = `${nicheResponse.specific_niche}`;
      setDetectedNiche(`✅ Detected: ${nicheDisplay}`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      setDetectedNiche(`✅ Detected: ${nicheDisplay} | 🔍 Finding competitors...`);

      const competitorPrompt = `Find direct competitors for this company: ${formData.company_url}

DETECTED NICHE: ${nicheResponse.specific_niche}
BUSINESS TYPE: ${nicheResponse.business_type}
KEY IDENTIFIERS: ${nicheResponse.key_identifiers?.join(', ') || 'N/A'}

CRITICAL REQUIREMENTS:
1. Find companies in the EXACT SAME NICHE: "${nicheResponse.specific_niche}"
2. Same business model: ${nicheResponse.business_type}
3. If it's an investment company, match the SPECIFIC ASSET CLASS (e.g., self-storage → only self-storage, NOT general real estate)
4. If it's a service provider, match the SPECIFIC SERVICE TYPE

SEARCH STRATEGY:
- Use these keywords: ${nicheResponse.key_identifiers?.join(', ')}
- Add: "competitors", "similar to", "alternative to"
- Focus on companies offering the EXACT SAME thing

RULES:
- Return ONLY URLs you find via web search (no invented URLs)
- Return MAIN HOMEPAGE URLs only (not subpages)
- Return 2-5 competitors (only real ones you found)
- DO NOT include ${formData.company_url} itself
- DO NOT return companies in adjacent niches (e.g., if self-storage, don't return multifamily)

Return JSON:
{
  "competitors": ["https://realcompetitor1.com", "https://realcompetitor2.com", ...]
}`;

      const response = await InvokeLLM({
        prompt: competitorPrompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            competitors: {
              type: "array",
              items: { type: "string" },
              maxItems: 5
            }
          },
          required: ["competitors"]
        }
      });

      if (response && response.competitors && Array.isArray(response.competitors)) {
        const isPlaceholder = (url) => {
          const lower = url.toLowerCase();
          return lower.includes('competitor1') || 
                 lower.includes('competitor2') || 
                 lower.includes('competitor3') || 
                 lower.includes('competitor4') || 
                 lower.includes('competitor5') ||
                 lower.includes('example.com') ||
                 lower.includes('placeholder');
        };

        const normalizeUrl = (url) => {
          return url.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '');
        };
        
        const originalNormalized = normalizeUrl(formData.company_url);
        
        const competitorUrls = response.competitors
          .filter(url => {
            if (isPlaceholder(url)) {
              return false;
            }
            const normalized = normalizeUrl(url);
            return normalized !== originalNormalized;
          })
          .slice(0, 5);
        
        while (competitorUrls.length < 5) {
          competitorUrls.push('');
        }
        
        setFormData({ ...formData, competitor_urls: competitorUrls });
        
        if (competitorUrls.filter(u => u).length === 0) {
          setCompetitorError('Could not find real competitors automatically. Please enter them manually.');
          setDetectedNiche('⚠️ No direct competitors found in detected niche. Please enter manually.');
        } else {
          setCompetitorError('');
          setDetectedNiche(`✅ Found ${competitorUrls.filter(u => u).length} competitors in: ${nicheDisplay}`);
        }
      } else {
        setCompetitorError('Failed to find competitors. Please enter them manually.');
        setDetectedNiche('⚠️ Failed to retrieve competitor data.');
      }
    } catch (error) {
      setCompetitorError(`Error: ${error.message || 'Failed to find competitors'}. Please enter them manually or try again.`);
      setDetectedNiche('❌ Error during competitor suggestion.');
    } finally {
      setIsSuggestingCompetitors(false);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!formData.company_url) {
      setUrlError('Please enter a company URL first');
      return;
    }

    setIsAnalyzingUrl(true);
    try {
      const response = await InvokeLLM({
        prompt: `Analyze this website: ${formData.company_url}

Based on the website content, suggest 3-5 key themes and focus areas that would be relevant for AEO query generation in the financial services industry. 

Format your response as a simple list of themes separated by commas. Focus on:
- Core services and offerings
- Target industries or sectors
- Technology or innovation areas
- Key value propositions

Be concise and specific.`,
        add_context_from_internet: true
      });

      const suggestedThemes = typeof response === 'string' ? response : JSON.stringify(response);
      setFormData({ ...formData, themes: suggestedThemes.trim() });
      setUrlError('');
    } catch (error) {
      console.error('Error analyzing URL:', error);
      setUrlError('Failed to analyze URL. Please enter themes manually or try again.');
    }
    setIsAnalyzingUrl(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.company_url || formData.company_url.trim() === '') {
      setUrlError('Company Website URL is required');
      return;
    }
    
    const filteredCompetitorUrls = formData.competitor_urls.filter(url => url && url.trim() !== '');
    const filteredManualQueries = formData.manual_queries.filter(q => q && q.trim() !== '');
    
    setUrlError('');
    setIsSaving(true);
    
    try {
      await onComplete({
        ...formData,
        competitor_urls: filteredCompetitorUrls,
        manual_queries: filteredManualQueries
      });
      
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900">
          Project Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Project Name */}
          <div className="space-y-2 pb-6 border-b border-slate-200">
            <Label htmlFor="name" className="text-base font-semibold text-slate-900">
              1. Project Name
            </Label>
            <Input
              id="name"
              placeholder="Enter project name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-lg"
            />
          </div>

          {/* Step 2: Company Website URL & Logo */}
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <Label htmlFor="company_url" className="text-base font-semibold text-slate-900">
              2. Company Website URL & Logo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="company_url"
              placeholder="https://yourcompany.com"
              value={formData.company_url}
              onChange={(e) => {
                setFormData({ ...formData, company_url: e.target.value });
                setUrlError('');
                setDetectedNiche('');
                setCompetitorError('');
              }}
            />
            {urlError && (
              <p className="text-xs text-red-500">{urlError}</p>
            )}
            <p className="text-xs text-slate-500">
              We'll analyze your website to suggest relevant themes and track your brand mentions in results
            </p>
            
            {/* Logo Upload Section */}
            <div className="mt-4">
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Company Logo (Optional)
              </Label>
              {formData.company_logo_url ? (
                <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <img 
                    src={formData.company_logo_url} 
                    alt="Company logo" 
                    className="h-16 w-16 object-contain rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-slate-700 font-medium">Logo uploaded</p>
                    <p className="text-xs text-slate-500">This will appear in Step 3 analytics</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={isUploadingLogo}
                  />
                  <label htmlFor="logo-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={isUploadingLogo}
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Logo
                        </>
                      )}
                    </Button>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    PNG, JPG, SVG up to 2MB. Will be displayed in Step 3 analytics.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Step 3: Competitor URLs */}
          <div className="space-y-2 pb-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold text-slate-900">
                3. Competitor URLs (Optional - up to 5)
              </Label>
              <Button
                type="button"
                onClick={handleSuggestCompetitors}
                disabled={isSuggestingCompetitors || !formData.company_url.trim()}
                size="sm"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white whitespace-nowrap"
              >
                {isSuggestingCompetitors ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Suggest Competitors
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Track how often your competitors appear in AI search results
            </p>
            
            {detectedNiche && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800">{detectedNiche}</p>
              </div>
            )}
            
            {competitorError && (
              <p className="text-xs text-red-500 mb-2">{competitorError}</p>
            )}
            
            <div className="space-y-2">
              <Input
                placeholder="Competitor 1 URL"
                value={formData.competitor_urls[0]}
                onChange={(e) => handleCompetitorUrlChange(0, e.target.value)}
              />
              <Input
                placeholder="Competitor 2 URL"
                value={formData.competitor_urls[1]}
                onChange={(e) => handleCompetitorUrlChange(1, e.target.value)}
              />
              <Input
                placeholder="Competitor 3 URL"
                value={formData.competitor_urls[2]}
                onChange={(e) => handleCompetitorUrlChange(2, e.target.value)}
              />
              <Input
                placeholder="Competitor 4 URL"
                value={formData.competitor_urls[3]}
                onChange={(e) => handleCompetitorUrlChange(3, e.target.value)}
              />
              <Input
                placeholder="Competitor 5 URL"
                value={formData.competitor_urls[4]}
                onChange={(e) => handleCompetitorUrlChange(4, e.target.value)}
              />
            </div>
          </div>

          {/* Step 4: Target Audience */}
          <div className="space-y-3 pb-6 border-b border-slate-200">
            <Label className="text-base font-semibold text-slate-900">
              4. Target Audience (select all that apply)
            </Label>
            <div className="space-y-3 pl-2">
              {AUDIENCE_OPTIONS.map((audience) => (
                <div key={audience} className="flex items-center space-x-3">
                  <Checkbox
                    id={audience}
                    checked={(formData.audience || []).includes(audience)}
                    onCheckedChange={() => handleAudienceToggle(audience)}
                  />
                  <Label
                    htmlFor={audience}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {audience}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Step 5: Themes / Focus Areas */}
          <div className="space-y-2 pb-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <Label htmlFor="themes" className="text-base font-semibold text-slate-900">
                5. Themes / Focus Areas
              </Label>
              <Button
                type="button"
                onClick={handleAnalyzeUrl}
                disabled={isAnalyzingUrl || !formData.company_url.trim()}
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white whitespace-nowrap"
              >
                {isAnalyzingUrl ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Suggest Themes
                  </>
                )}
              </Button>
            </div>
            <Textarea
              id="themes"
              placeholder="e.g., digital distribution for asset managers, AI in fund marketing, advisor personalization tools"
              value={formData.themes}
              onChange={(e) => setFormData({ ...formData, themes: e.target.value })}
              className="h-24"
            />
          </div>

          {/* Step 6: Query Mix */}
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <Label className="text-base font-semibold text-slate-900">
              6. Query Mix
            </Label>
            <RadioGroup
              value={formData.query_mix_type}
              onValueChange={(value) => setFormData({ ...formData, query_mix_type: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Educational" id="educational" />
                <Label htmlFor="educational" className="font-normal">Educational Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Service-Aligned" id="service" />
                <Label htmlFor="service" className="font-normal">Service-Aligned Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Mixed" id="mixed" />
                <Label htmlFor="mixed" className="font-normal">Mixed (specify ratio below)</Label>
              </div>
            </RadioGroup>

            {formData.query_mix_type === 'Mixed' && (
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">Educational: {formData.educational_ratio}%</Label>
                  </div>
                  <Slider
                    value={[formData.educational_ratio]}
                    onValueChange={([value]) => setFormData({
                      ...formData,
                      educational_ratio: value,
                      service_ratio: 100 - value
                    })}
                    max={100}
                    step={10}
                  />
                </div>
                <div className="text-sm text-slate-600">
                  Service-Aligned: {formData.service_ratio}%
                </div>
              </div>
            )}
          </div>

          {/* Step 7: Manual Queries */}
          <div className="space-y-3 pb-6">
            <Label className="text-base font-semibold text-slate-900">
              7. Manual Queries (Optional - up to 5)
            </Label>
            <p className="text-xs text-slate-500 mb-3">
              Have specific questions you want to audit? Enter them here to include in your analysis.
            </p>
            <div className="space-y-2">
              <Input
                placeholder="Manual query 1 (optional)"
                value={formData.manual_queries[0]}
                onChange={(e) => handleManualQueryChange(0, e.target.value)}
              />
              <Input
                placeholder="Manual query 2 (optional)"
                value={formData.manual_queries[1]}
                onChange={(e) => handleManualQueryChange(1, e.target.value)}
              />
              <Input
                placeholder="Manual query 3 (optional)"
                value={formData.manual_queries[2]}
                onChange={(e) => handleManualQueryChange(2, e.target.value)}
              />
              <Input
                placeholder="Manual query 4 (optional)"
                value={formData.manual_queries[3]}
                onChange={(e) => handleManualQueryChange(3, e.target.value)}
              />
              <Input
                placeholder="Manual query 5 (optional)"
                value={formData.manual_queries[4]}
                onChange={(e) => handleManualQueryChange(4, e.target.value)}
              />
            </div>
          </div>

          {urlError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600 font-medium">{urlError}</p>
            </div>
          )}

          {showSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-700 font-medium">Configuration saved successfully!</p>
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : showSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}