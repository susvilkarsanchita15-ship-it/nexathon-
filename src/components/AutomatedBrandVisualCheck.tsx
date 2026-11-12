import React, { useState, useEffect } from 'react';
import {
  User,
  ContentVersion,
  ContentSubmission,
  BrandProfile,
  BrandAsset,
  BrandGuideline,
  VisualCheckReport,
  VisualBrandIssue,
  VisualIssueReviewStatus,
  DetectedRegion,
} from '../types/inkloom';
import { api } from '../api/client';
import { store } from '../services/store';
import {
  ScanSearch,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Palette,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  Maximize2,
  RefreshCw,
  MessageSquare,
  Check,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  Terminal,
  Clock,
  Hash,
} from 'lucide-react';

interface AutomatedBrandVisualCheckProps {
  version: ContentVersion;
  submission: ContentSubmission;
  currentUser: User;
  onIssueStatusChange?: () => void;
}

export const AutomatedBrandVisualCheck: React.FC<AutomatedBrandVisualCheckProps> = ({
  version,
  submission,
  currentUser,
  onIssueStatusChange,
}) => {
  const [report, setReport] = useState<VisualCheckReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showCommentBox, setShowCommentBox] = useState<Record<string, boolean>>({});
  const [isUpdatingIssue, setIsUpdatingIssue] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  // Manual compare overlay slider state
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [activeVisualTab, setActiveVisualTab] = useState<'automated' | 'manual_overlay'>('automated');
  const [showEngineTrace, setShowEngineTrace] = useState(false);

  const isReviewerOrAdmin = currentUser.role === 'reviewer' || currentUser.role === 'admin';

  // Analysis steps for animation
  const analysisSteps = [
    'Loading approved brand logos & color tokens from Brand Hub...',
    'Extracting color stops and computing CIE Delta E 2000 perceptual distances...',
    'Detecting logo regions, geometric proportions & aspect ratio distortion...',
    'Verifying clear space, contrast & visual guidelines...',
    'Synthesizing human-in-the-loop explainable visual findings...',
  ];

  const currentMedia =
    version.media && version.media.length > 0
      ? version.media[selectedMediaIndex]
      : {
          name: 'promo_banner.png',
          alt_text: null,
          url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80',
        };

  const approvedLogo = store.assets.find((a) => a.asset_type === 'logo') || {
    name: 'Lumora Master Logo (Teal on White)',
    asset_id: 'ast-01',
    file_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80',
    alt_text: 'Official Lumora Loom running spiral logo mark in teal',
  };

  useEffect(() => {
    loadExistingVisualCheck();
  }, [version.version_id]);

  const loadExistingVisualCheck = async () => {
    try {
      const existing = await api.getVisualCheck(version.version_id);
      if (existing) {
        setReport(existing);
        if (existing.issues && existing.issues.length > 0) {
          setSelectedIssueId(existing.issues[0].issue_id);
        }
      }
    } catch (e) {
      console.warn('Could not load existing visual check report', e);
    }
  };

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setAnalysisStep(0);

    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => (prev < analysisSteps.length - 1 ? prev + 1 : prev));
    }, 450);

    try {
      const checkReport = await api.runVisualCheck(version.version_id, {
        media: currentMedia,
        imageName: currentMedia.name,
        imageUrl: currentMedia.url,
      });

      clearInterval(stepInterval);
      setReport(checkReport);
      if (checkReport.issues && checkReport.issues.length > 0) {
        setSelectedIssueId(checkReport.issues[0].issue_id);
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Visual analysis failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateIssueStatus = async (
    issueId: string,
    status: VisualIssueReviewStatus
  ) => {
    if (!isReviewerOrAdmin) return;
    setIsUpdatingIssue(issueId);

    const comment = commentInputs[issueId] || undefined;

    try {
      const updated = await api.updateVisualIssue(issueId, status, comment);

      // Update local report state
      if (report) {
        const updatedIssues = report.issues.map((i) =>
          i.issue_id === issueId
            ? {
                ...i,
                review_status: status,
                reviewer_comment: comment || i.reviewer_comment,
                reviewed_by_name: currentUser.full_name,
                reviewed_at: new Date().toISOString(),
              }
            : i
        );

        const resolvedCount = updatedIssues.filter(
          (i) => i.review_status !== 'pending'
        ).length;

        setReport({
          ...report,
          summary: {
            ...report.summary,
            resolved: resolvedCount,
          },
          issues: updatedIssues,
        });
      }

      setShowCommentBox((prev) => ({ ...prev, [issueId]: false }));
      if (onIssueStatusChange) onIssueStatusChange();
    } catch (err: any) {
      console.error('Failed to update issue status', err);
    } finally {
      setIsUpdatingIssue(null);
    }
  };

  const selectedIssue = report?.issues.find((i) => i.issue_id === selectedIssueId);

  const filteredIssues = (report?.issues || []).filter((issue) => {
    if (severityFilter === 'all') return true;
    if (severityFilter === 'critical_high')
      return issue.severity === 'critical' || issue.severity === 'high';
    if (severityFilter === 'pending') return issue.review_status === 'pending';
    if (severityFilter === 'resolved') return issue.review_status !== 'pending';
    return issue.category === severityFilter;
  });

  return (
    <div className="bg-white border border-[#D5DBE5] rounded-2xl shadow-xs overflow-hidden">
      {/* Top Banner & Mode Toggle */}
      <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-teal-50/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#139A93]/10 text-[#139A93]">
              <ScanSearch className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold text-[#0B1B3A]">
              Automated Brand Visual Check
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold border border-teal-200">
              CIE Delta E & Vision AI
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Perceptual color audit, logo distortion verification, and visual guideline compliance.
          </p>
        </div>

        {/* Action Controls & Sub-tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sub-tab Switcher: Automated vs Manual Overlay */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveVisualTab('automated')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeVisualTab === 'automated'
                  ? 'bg-white text-[#0B1B3A] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Automated Analysis
            </button>
            <button
              type="button"
              onClick={() => setActiveVisualTab('manual_overlay')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeVisualTab === 'manual_overlay'
                  ? 'bg-white text-[#0B1B3A] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Manual Overlay & Diff
            </button>
          </div>

          {/* Run Analysis Button */}
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isLoading}
            className="px-4 py-2 bg-[#139A93] hover:bg-[#0D706B] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{report ? 'Rerun Visual Audit' : 'Run Visual Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Loading Progress State */}
      {isLoading && (
        <div className="p-6 bg-teal-50/40 border-b border-teal-100 space-y-3 animate-pulse">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#0B1B3A] flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#139A93]" />
              Analyzing Uploaded Design: {currentMedia.name}
            </span>
            <span className="font-mono text-teal-800 font-bold">
              Step {analysisStep + 1} of {analysisSteps.length}
            </span>
          </div>
          <div className="w-full bg-teal-200/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#139A93] h-2 transition-all duration-300"
              style={{
                width: `${((analysisStep + 1) / analysisSteps.length) * 100}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-teal-900 font-medium">
            {analysisSteps[analysisStep]}
          </p>
        </div>
      )}

      {/* MAIN TAB CONTENT */}
      {activeVisualTab === 'automated' ? (
        <div className="p-5 md:p-6 space-y-6">
          {/* Summary Status Strip if Report Exists */}
          {report ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                    report.overall_compliance === 'compliant'
                      ? 'bg-emerald-500 shadow-emerald-200 shadow-md'
                      : report.overall_compliance === 'concerns_detected'
                      ? 'bg-amber-500 shadow-amber-200 shadow-md'
                      : 'bg-rose-500 shadow-rose-200 shadow-md'
                  }`}
                >
                  {report.overall_compliance === 'compliant' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : report.overall_compliance === 'concerns_detected' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <ShieldAlert className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
                      Overall Compliance
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        report.overall_compliance === 'compliant'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : report.overall_compliance === 'concerns_detected'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {report.overall_compliance.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#0B1B3A] font-semibold mt-0.5">
                    {report.summary.total} visual findings detected (
                    {report.summary.resolved} reviewed by human)
                  </p>
                </div>
              </div>

              {/* Severity Counts Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {report.summary.critical} Critical
                </span>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {report.summary.high} High
                </span>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  {report.summary.medium} Medium
                </span>
                <span className="text-xs px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  {report.summary.low} Low
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 mx-auto flex items-center justify-center">
                <ScanSearch className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1B3A]">
                No automated visual check run yet for this version
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click <strong>"Run Visual Analysis"</strong> to extract dominant color stops,
                calculate CIE Delta E distances against Lumora Teal, check logo proportions,
                and detect distortions.
              </p>
              <button
                type="button"
                onClick={handleRunAnalysis}
                className="px-4 py-2 bg-[#139A93] hover:bg-[#0D706B] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Automated Visual Analysis</span>
              </button>
            </div>
          )}

          {/* Split View: Left Column (Visual Canvas with Interactive Overlays), Right Column (Issues List & Actions) */}
          {report && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Visual Canvas & Extracted Palette */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-900/5 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span className="truncate">
                      Analyzing: <strong>{currentMedia.name}</strong>
                    </span>
                    <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      Interactive Region Highlighting
                    </span>
                  </div>

                  {/* Interactive Image Frame with Bounding Boxes */}
                  <div className="relative rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800 shadow-inner group min-h-[260px] flex items-center justify-center">
                    {currentMedia.url ? (
                      <img
                        src={currentMedia.url}
                        alt={currentMedia.alt_text || currentMedia.name}
                        className="w-full h-auto max-h-[360px] object-contain block mx-auto"
                      />
                    ) : (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No image preview available
                      </div>
                    )}

                    {/* SVG / Bounding Box Overlays */}
                    {report.issues.map((issue) => {
                      if (!issue.region) return null;
                      const isSelected = selectedIssueId === issue.issue_id;
                      const isCritical = issue.severity === 'critical';
                      const isHigh = issue.severity === 'high';

                      return (
                        <div
                          key={issue.issue_id}
                          onClick={() => setSelectedIssueId(issue.issue_id)}
                          style={{
                            left: `${issue.region.x}%`,
                            top: `${issue.region.y}%`,
                            width: `${issue.region.width}%`,
                            height: `${issue.region.height}%`,
                          }}
                          className={`absolute border-2 rounded-lg cursor-pointer transition-all duration-200 flex items-start justify-end p-1 z-10 ${
                            isSelected
                              ? 'border-teal-400 bg-teal-500/25 ring-2 ring-teal-400 ring-offset-1'
                              : isCritical
                              ? 'border-rose-500 bg-rose-500/15 hover:bg-rose-500/30'
                              : isHigh
                              ? 'border-amber-500 bg-amber-500/15 hover:bg-amber-500/30'
                              : 'border-sky-400 bg-sky-400/15 hover:bg-sky-400/30'
                          }`}
                          title={`${issue.title} (${issue.severity.toUpperCase()})`}
                        >
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded font-black uppercase text-white shadow-xs ${
                              isCritical
                                ? 'bg-rose-600'
                                : isHigh
                                ? 'bg-amber-600'
                                : 'bg-teal-600'
                            }`}
                          >
                            {issue.severity[0].toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 text-center italic">
                    Click any highlighted region on the creative to inspect the detected issue.
                  </p>
                </div>

                {/* Dominant Brand Palette Breakdown */}
                <div className="bg-white border border-[#D5DBE5] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0B1B3A] flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-teal-600" />
                      Extracted Palette Analysis (CIE Delta E 2000)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Threshold: &le;4.0 JND
                    </span>
                  </div>

                  {/* Horizontal Stacked Bar */}
                  <div className="h-4 rounded-full overflow-hidden flex shadow-inner border border-slate-200">
                    {report.extracted_colors.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: `${c.percentage}%`,
                          backgroundColor: c.hex,
                        }}
                        title={`${c.hex} (~${c.percentage}% area) - ${
                          c.is_approved ? 'Approved Brand Color' : 'Off-Brand Color'
                        }`}
                        className="h-full relative group cursor-pointer"
                      />
                    ))}
                  </div>

                  {/* Color Swatches Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {report.extracted_colors.map((c, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-[11px] flex items-center gap-2 ${
                          c.is_approved
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-rose-50/70 border-rose-200 text-rose-900'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-md border border-black/10 shrink-0 shadow-2xs"
                          style={{ backgroundColor: c.hex }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono font-bold leading-none">{c.hex}</div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                            {c.is_approved ? (
                              <span className="text-emerald-700 font-semibold">✓ In Palette</span>
                            ) : (
                              <span className="text-rose-700 font-bold">
                                ΔE: {c.delta_e}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Findings List, Expected vs Detected Swatches, Human Review Action */}
              <div className="lg:col-span-7 space-y-4">
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">
                    Filter:
                  </span>
                  {[
                    { id: 'all', label: `All (${report.issues.length})` },
                    { id: 'critical_high', label: `Critical & High (${report.summary.critical + report.summary.high})` },
                    { id: 'logo_compliance', label: 'Logo' },
                    { id: 'color_compliance', label: 'Color' },
                    { id: 'visual_consistency', label: 'Consistency' },
                    { id: 'pending', label: 'Pending Review' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setSeverityFilter(filter.id)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs font-semibold ${
                        severityFilter === filter.id
                          ? 'bg-[#139A93] text-white shadow-2xs font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Issues Cards List */}
                {filteredIssues.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    No visual findings match this filter.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredIssues.map((issue) => {
                      const isSelected = selectedIssueId === issue.issue_id;
                      const isCritical = issue.severity === 'critical';
                      const isHigh = issue.severity === 'high';
                      const isMedium = issue.severity === 'medium';

                      return (
                        <div
                          key={issue.issue_id}
                          className={`rounded-2xl border transition-all duration-200 p-5 space-y-4 ${
                            isSelected
                              ? 'bg-white border-[#139A93] ring-2 ring-[#139A93]/20 shadow-md'
                              : 'bg-white border-[#D5DBE5] hover:border-slate-300 shadow-xs'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                    isCritical
                                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                      : isHigh
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : isMedium
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                      : 'bg-sky-100 text-sky-800 border border-sky-300'
                                  }`}
                                >
                                  {issue.severity}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                  {issue.category.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className="text-[11px] font-mono font-semibold text-slate-500">
                                  {issue.confidence}% confidence
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-[#0B1B3A]">
                                {issue.title}
                              </h3>
                            </div>

                            {/* Human Review Status Badge */}
                            <div>
                              {issue.review_status === 'pending' ? (
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold">
                                  Pending Review
                                </span>
                              ) : issue.review_status === 'confirmed' ? (
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Confirmed
                                </span>
                              ) : issue.review_status === 'false_positive' ? (
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-bold">
                                  False Positive
                                </span>
                              ) : (
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                                  Needs Correction
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {issue.description}
                          </p>

                          {/* SIDE-BY-SIDE EXPECTED VS DETECTED COMPARISON */}
                          {/* Case A: Color Compliance Comparison */}
                          {issue.color_comparison && (
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              {/* Expected Brand Color */}
                              <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200">
                                <span
                                  className="w-8 h-8 rounded-lg border border-slate-300 shadow-xs shrink-0"
                                  style={{
                                    backgroundColor: issue.color_comparison.expected_hex,
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-slate-400">
                                    Expected Brand Colour
                                  </div>
                                  <div className="font-mono font-bold text-[#0B1B3A]">
                                    {issue.color_comparison.expected_hex}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {issue.color_comparison.expected_name}
                                  </div>
                                </div>
                              </div>

                              {/* Detected Off-Brand Color */}
                              <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-rose-200">
                                <span
                                  className="w-8 h-8 rounded-lg border border-rose-300 shadow-xs shrink-0"
                                  style={{
                                    backgroundColor: issue.color_comparison.detected_hex,
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-rose-600">
                                    Detected Design Colour
                                  </div>
                                  <div className="font-mono font-bold text-rose-700">
                                    {issue.color_comparison.detected_hex}
                                  </div>
                                  <div className="text-[11px] text-rose-800 font-semibold truncate">
                                    ΔE: {issue.color_comparison.delta_e} (Discrepancy)
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Case B: Logo Distortion / Variation Comparison */}
                          {issue.logo_comparison && (
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              {/* Approved Official Logo */}
                              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                                  <span>Official Brand Logo</span>
                                  <span className="font-mono">Ratio 1.00:1</span>
                                </div>
                                <div className="h-16 rounded-md bg-slate-100 flex items-center justify-center p-1 border border-slate-200 overflow-hidden">
                                  <img
                                    src={approvedLogo.file_url}
                                    alt={approvedLogo.name}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <div className="text-[11px] font-semibold text-slate-700 truncate">
                                  {approvedLogo.name}
                                </div>
                              </div>

                              {/* Detected Logo Discrepancy */}
                              <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-amber-700 flex items-center justify-between">
                                  <span>Detected In Design</span>
                                  {issue.logo_comparison.detected_aspect_ratio && (
                                    <span className="font-mono font-bold text-amber-800">
                                      Ratio {issue.logo_comparison.detected_aspect_ratio}:1
                                    </span>
                                  )}
                                </div>
                                <div className="h-16 rounded-md bg-amber-50/50 flex items-center justify-center p-1 border border-amber-200 overflow-hidden text-amber-900 text-xs font-semibold text-center">
                                  <span>
                                    ⚠️ {issue.logo_comparison.variation_type === 'stretched'
                                      ? 'Horizontal Stretch Detected'
                                      : 'Unapproved Variation Detected'}
                                  </span>
                                </div>
                                <div className="text-[11px] font-bold text-amber-900 truncate">
                                  {issue.detected_result}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expected Rule vs Recommendation */}
                          <div className="space-y-1.5 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-700">
                              <strong className="text-[#0B1B3A]">Branding Standard: </strong>
                              {issue.expected_rule}
                            </div>
                            <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-200 text-teal-900">
                              <strong className="text-teal-950">Recommended Fix: </strong>
                              {issue.recommendation}
                            </div>
                          </div>

                          {/* Reviewer Note Display if exists */}
                          {issue.reviewer_comment && (
                            <div className="p-3 rounded-xl bg-slate-100 text-slate-800 text-xs border border-slate-200">
                              <span className="font-bold text-slate-900">Reviewer Note: </span>
                              "{issue.reviewer_comment}"
                              {issue.reviewed_by_name && (
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  Recorded by {issue.reviewed_by_name}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Inline Reviewer Comment Input */}
                          {showCommentBox[issue.issue_id] && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <textarea
                                rows={2}
                                placeholder="Add specific guidance or context for this visual finding..."
                                value={commentInputs[issue.issue_id] || ''}
                                onChange={(e) =>
                                  setCommentInputs({
                                    ...commentInputs,
                                    [issue.issue_id]: e.target.value,
                                  })
                                }
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </div>
                          )}

                          {/* HUMAN REVIEW ACTION BUTTONS (Section 6) */}
                          {isReviewerOrAdmin && (
                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateIssueStatus(issue.issue_id, 'confirmed')
                                  }
                                  disabled={isUpdatingIssue === issue.issue_id}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    issue.review_status === 'confirmed'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Confirm Issue</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateIssueStatus(issue.issue_id, 'needs_correction')
                                  }
                                  disabled={isUpdatingIssue === issue.issue_id}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    issue.review_status === 'needs_correction'
                                      ? 'bg-amber-600 text-white shadow-xs'
                                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                                  }`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Needs Correction</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateIssueStatus(issue.issue_id, 'false_positive')
                                  }
                                  disabled={isUpdatingIssue === issue.issue_id}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    issue.review_status === 'false_positive'
                                      ? 'bg-slate-700 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Mark as False Positive</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setShowCommentBox((prev) => ({
                                    ...prev,
                                    [issue.issue_id]: !prev[issue.issue_id],
                                  }))
                                }
                                className="text-xs text-slate-500 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>
                                  {showCommentBox[issue.issue_id]
                                    ? 'Hide Note'
                                    : 'Add Reviewer Note'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* SUB-TAB 2: PRESERVED MANUAL VISUAL COMPARISON & OVERLAY BLEND */
        <div className="p-5 md:p-6 space-y-6">
          <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 text-xs text-teal-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <strong>Manual Visual Comparison & Asset Overlay: </strong>
              Slide to blend the certified Lumora Master Logo over the submitted creative to verify
              exact contour alignment, clear margins, and vector precision.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Approved Brand Asset */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Official Master Asset</span>
                <span className="font-mono text-teal-700 font-bold">1:1 Standard</span>
              </div>
              <div className="h-60 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-4 overflow-hidden">
                <img
                  src={approvedLogo.file_url}
                  alt={approvedLogo.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="text-xs font-bold text-[#0B1B3A]">{approvedLogo.name}</div>
            </div>

            {/* Interactive Overlay Blend Slider */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Overlay Blend View</span>
                <span className="font-mono text-teal-700 font-bold">
                  {overlayOpacity}% Overlay
                </span>
              </div>

              <div className="relative h-60 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-4 overflow-hidden shadow-inner">
                {/* Background: Uploaded Creative */}
                {currentMedia.url && (
                  <img
                    src={currentMedia.url}
                    alt={currentMedia.name}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                )}
                {/* Foreground: Approved Logo Blend */}
                <img
                  src={approvedLogo.file_url}
                  alt="Overlay"
                  style={{ opacity: overlayOpacity / 100 }}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-150"
                />
              </div>

              {/* Slider Control */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Uploaded Design</span>
                  <span>Approved Master Logo</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
