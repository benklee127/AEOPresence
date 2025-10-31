
import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import BrandMentionsChart from "../components/step3/BrandMentionsChart";
import TrendInsights from "../components/step3/TrendInsights";
import BrandPresence from "../components/step3/BrandPresence";
import TopSourcesChart from "../components/step3/TopSourcesChart";
import ActionableInsights from "../components/step3/ActionableInsights";
import CompetitorBrandMentions from "../components/step3/CompetitorBrandMentions";
import CompetitorSources from "../components/step3/CompetitorSources";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function Step3() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('projectId');
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);
  const contentRef = React.useRef(null);

  useEffect(() => {
    if (!projectId) {
      navigate(createPageUrl("Dashboard"));
    }
  }, [projectId, navigate]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.QueryProject.get(projectId),
    enabled: !!projectId,
  });

  const { data: queries = [] } = useQuery({
    queryKey: ['queries', projectId],
    queryFn: () => base44.entities.Query.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const handlePreviousStep = () => {
    if (!projectId) return;
    navigate(createPageUrl(`Step2?projectId=${projectId}`));
  };

  const handleGoToStep1 = () => {
    if (!projectId) return;
    navigate(createPageUrl(`Step1?projectId=${projectId}`));
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Hide UI elements
      const exportButton = document.querySelector('[data-export-button]');
      const hideInPdfElements = document.querySelectorAll('[data-hide-in-pdf]');
      
      if (exportButton) {
        exportButton.style.display = 'none';
      }
      hideInPdfElements.forEach(el => {
        el.style.display = 'none';
      });

      await new Promise(resolve => setTimeout(resolve, 500)); // Give elements time to hide

      if (!contentRef.current) {
        throw new Error("Content reference for PDF export not found.");
      }

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pdfWidth - (2 * margin);
      
      let currentY = margin;
      let isFirstPageSection = true;

      // Capture each section separately
      const sections = Array.from(contentRef.current.children);
      
      for (const section of sections) {
        // Skip elements that might be explicitly hidden or are not standard elements
        if (section.nodeType !== Node.ELEMENT_NODE || section.style.display === 'none') {
          continue;
        }

        const canvas = await html2canvas(section, {
          scale: 2, // Higher scale for better quality
          useCORS: true,
          logging: false,
          backgroundColor: '#f8fafc',
          width: section.scrollWidth,
          height: section.scrollHeight,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * usableWidth) / imgProps.width;

        // Check if section fits on current page. Add a small buffer (margin) for aesthetics.
        if (currentY + imgHeight + margin > pdfHeight && !isFirstPageSection) {
          pdf.addPage();
          currentY = margin; // Reset Y position for the new page
        }

        // Add section to PDF
        pdf.addImage(imgData, 'PNG', margin, currentY, usableWidth, imgHeight);
        currentY += imgHeight + 5; // Add small spacing between sections

        isFirstPageSection = false;
      }

      // Show UI elements again
      if (exportButton) {
        exportButton.style.display = '';
      }
      hideInPdfElements.forEach(el => {
        el.style.display = '';
      });

      // Download PDF
      pdf.save(`AEO_Report_${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
    setIsExportingPDF(false);
  };

  if (!projectId) {
    return null;
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-slate-600 mb-4">Project not found</p>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Calculate brand mention and source counts for recommendations
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

  let brandMentionCount = 0;
  let sourceAppearanceCount = 0;

  if (project?.company_url) {
    const companyDomain = getDomain(project.company_url);
    const companyName = companyDomain.replace(/\.(com|org|ai|io|net|co)$/, '');
    const normalizedCompanyName = normalizeBrandName(companyName);

    brandMentionCount = queries.filter(q => {
      if (!q.brand_mentions || q.brand_mentions === 'None') return false;
      const brands = q.brand_mentions.split(',').map(b => b.trim());
      return brands.some(brand => {
        const normalizedBrand = normalizeBrandName(brand);
        return normalizedBrand === normalizedCompanyName || 
               normalizedBrand.includes(normalizedCompanyName) ||
               normalizedCompanyName.includes(normalizedBrand);
      });
    }).length;

    sourceAppearanceCount = queries.filter(q => {
      if (!q.source) return false;
      const source = q.source.toLowerCase();
      // Check if the source domain includes the company domain
      return source.includes(companyDomain);
    }).length;
  }

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8" data-hide-in-pdf>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousStep}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Step 3: Analytics Dashboard</h1>
              <p className="text-slate-600 mt-1">{project?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              variant="outline"
              className="gap-2"
              data-export-button
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export PDF
                </>
              )}
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200" onClick={handleGoToStep1}>
                Step 1
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200" onClick={handlePreviousStep}>
                Step 2
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 font-medium">
                <div className="w-2 h-2 rounded-full bg-violet-600"></div>
                Step 3
              </div>
            </div>
          </div>
        </div>

        <div ref={contentRef} className="space-y-6">
          {project?.company_url && (
            <div>
              <BrandPresence 
                queries={queries} 
                companyUrl={project.company_url}
                companyLogoUrl={project.company_logo_url}
              />
            </div>
          )}

          <div>
            <TrendInsights queries={queries} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <BrandMentionsChart queries={queries} />
            </div>
            <div>
              <TopSourcesChart queries={queries} />
            </div>
          </div>

          {project?.competitor_urls && project.competitor_urls.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <CompetitorBrandMentions queries={queries} competitorUrls={project.competitor_urls} />
              </div>
              <div>
                <CompetitorSources queries={queries} competitorUrls={project.competitor_urls} />
              </div>
            </div>
          )}

          <div>
            <ActionableInsights 
              queries={queries} 
              companyUrl={project?.company_url}
              brandMentionCount={brandMentionCount}
              sourceAppearanceCount={sourceAppearanceCount}
              competitorUrls={project?.competitor_urls}
              project={project}
            />
          </div>

          <Card className="border-slate-200" data-hide-in-pdf>
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={handlePreviousStep}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous: Analyze Queries
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl("Dashboard"))}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Back to Dashboard
                  <ArrowLeft className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
