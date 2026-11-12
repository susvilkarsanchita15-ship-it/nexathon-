import React, { useState, useEffect } from 'react';
import { User, ContentType, MediaItem, LinkItem } from '../types/inkloom';
import { api } from '../api/client';
import { store } from '../services/store';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Link as LinkIcon,
  HelpCircle,
  Cpu,
  Layers,
  Wand2,
  X,
  Maximize2,
} from 'lucide-react';
import { processImageFile } from '../utils/imageUtils';

interface SubmissionPageProps {
  currentUser: User;
  onNavigate: (page: string, params?: any) => void;
  loadDemo?: boolean;
}

export const SubmissionPage: React.FC<SubmissionPageProps> = ({
  currentUser,
  onNavigate,
  loadDemo = false,
}) => {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<ContentType>('email');
  const [bodyText, setBodyText] = useState('');
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [linksList, setLinksList] = useState<LinkItem[]>([]);

  // Drag-and-drop & image preview state
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [isDraggingDraft, setIsDraggingDraft] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; name: string } | null>(null);

  // Media addition state
  const [newMediaName, setNewMediaName] = useState('');
  const [newMediaAlt, setNewMediaAlt] = useState('');

  // Link addition state
  const [newLinkText, setNewLinkText] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Analysis progress animation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fileNotice, setFileNotice] = useState<string | null>(null);

  const steps = [
    'Scanning active guidelines, verified facts, and brand dictionary...',
    'Running deterministic terminology & tone evaluators...',
    'Comparing draft claims against specifications via Gemini AI...',
    'Validating citations, eliminating hallucinations & compiling report...',
  ];

  // Initialize demo scenario if requested
  useEffect(() => {
    if (loadDemo) {
      loadScenario(1);
    }
  }, [loadDemo]);

  // Load diverse test scenarios to prove analysis on DIFFERENT data
  const loadScenario = (num: number) => {
    switch (num) {
      case 1:
        // Scenario 1: TS-01 Reference Promo
        setTitle('Spring Member Cloud Storage & App Promo (TS-01)');
        setContentType('email');
        setBodyText(
          'Lumora Pro gives all customers unlimited cloud storage and is the number one rated fitness app!!!'
        );
        setMediaList([
          {
            name: 'promo_banner.png',
            alt_text: null, // missing alt text per G-10
            url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80',
          },
        ]);
        setLinksList([
          {
            text: 'Learn more about Pro',
            url: 'https://lumora.fitness/pro',
          },
        ]);
        break;

      case 2:
        // Scenario 2: Pricing & Trial Policy Breach
        setTitle('Exclusive Flash Trial & Pricing Email');
        setContentType('email');
        setBodyText(
          'Try Lumora Pro today for only 299 rupees a month with a 30 days trial, no card needed! Guaranteed results in two weeks.'
        );
        setMediaList([
          {
            name: 'pricing_table.png',
            alt_text: 'Infographic of monthly pricing plans',
            url: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&auto=format&fit=crop&q=80',
          },
        ]);
        setLinksList([
          {
            text: 'click here', // vague link text per G-11
            url: 'https://lumora.fitness/pricing',
          },
        ]);
        break;

      case 3:
        // Scenario 3: Shouting Hype Tone & Superlatives
        setTitle('Social Video Ad Launch Campaign');
        setContentType('social_post');
        setBodyText(
          'WE ARE THE BEST WORKOUT APP ON THE PLANET!! Hurry before you fail. All clients get access to our cheap subscriptions.'
        );
        setMediaList([]);
        setLinksList([
          {
            text: 'read more', // vague link text
            url: 'https://lumora.fitness/plans',
          },
        ]);
        break;

      case 4:
        // Scenario 4: Clean Compliant Draft
        setTitle('Lumora Pro Official Launch - Fully Verified Copy');
        setContentType('email');
        setBodyText(
          'Lumora Pro gives all members 50 GB of workout-video storage for offline routines. Join today for 499 rupees a month with an official 14-day trial.'
        );
        setMediaList([
          {
            name: 'athlete_hero.png',
            alt_text: 'Athlete stretching in outdoor morning sunshine',
            url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=80',
          },
        ]);
        setLinksList([
          {
            text: 'Explore all Lumora Pro workout plans',
            url: 'https://lumora.fitness/pro',
          },
        ]);
        break;
    }
  };

  const loadVisualPreset = (preset: { id: string; filename: string; label: string; alt: string | null }) => {
    setTitle(`Visual Audit: ${preset.label}`);
    setContentType('social_post');
    setBodyText(`Campaign visual creative loaded for automated pixel-level brand check.\nAsset: ${preset.filename}`);
    setMediaList([
      {
        name: preset.filename,
        alt_text: preset.alt,
        url: `/demo-assets/creatives/${preset.filename}`,
      },
    ]);
    setFileNotice(`Loaded visual test asset: ${preset.filename}`);
    setTimeout(() => setFileNotice(null), 3000);
  };

  // Helper to add processed image items
  const addImageFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;

    for (const file of list) {
      try {
        const processed = await processImageFile(file);
        setMediaList((prev) => [
          ...prev,
          {
            name: processed.name,
            alt_text: null, // initially null so user can test G-10 violation or add alt text
            url: processed.url,
          },
        ]);
        setFileNotice(`Added "${file.name}" to media assets`);
        setTimeout(() => setFileNotice(null), 3500);
      } catch (err: any) {
        console.error('Failed to process image:', err);
        setFileNotice(`Could not process "${file.name}"`);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setFileNotice('PDF extraction is a planned enhancement');
      return;
    }

    setFileNotice(null);

    // If user dropped or selected an image file in the main draft importer, route it to media
    if (file.type.startsWith('image/')) {
      await addImageFiles([file]);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBodyText(text);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await addImageFiles(files);
    e.target.value = '';
  };

  // Drag and drop for media section
  const handleMediaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMedia(true);
  };

  const handleMediaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMedia(false);
  };

  const handleMediaDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMedia(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await addImageFiles(e.dataTransfer.files);
    }
  };

  // Drag and drop onto draft text area
  const handleDraftDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDraft(true);
  };

  const handleDraftDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDraft(false);
  };

  const handleDraftDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDraft(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imgFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
      const textFiles = Array.from(files).filter(
        (f) => f.name.endsWith('.txt') || f.name.endsWith('.md')
      );

      if (imgFiles.length > 0) {
        await addImageFiles(imgFiles);
      }
      if (textFiles.length > 0) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setBodyText((prev) => (prev ? prev + '\n\n' : '') + (ev.target?.result as string));
        };
        reader.readAsText(textFiles[0]);
      }
    }
  };

  // Clipboard paste handler (support pasting screenshots / copied images directly)
  const handleDraftPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imgItems: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imgItems.push(file);
      }
    }

    if (imgItems.length > 0) {
      // Don't prevent text paste if text is also being pasted
      await addImageFiles(imgItems);
    }
  };

  const handleUpdateMediaAlt = (idx: number, alt: string) => {
    setMediaList((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, alt_text: alt.trim().length > 0 ? alt : null } : item
      )
    );
  };

  const handleAddMedia = () => {
    if (!newMediaName.trim()) return;
    setMediaList([
      ...mediaList,
      {
        name: newMediaName.trim(),
        alt_text: newMediaAlt.trim() ? newMediaAlt.trim() : null,
      },
    ]);
    setNewMediaName('');
    setNewMediaAlt('');
  };

  const handleRemoveMedia = (idx: number) => {
    setMediaList(mediaList.filter((_, i) => i !== idx));
  };

  const handleAddLink = () => {
    if (!newLinkText.trim() || !newLinkUrl.trim()) return;
    setLinksList([
      ...linksList,
      {
        text: newLinkText.trim(),
        url: newLinkUrl.trim(),
      },
    ]);
    setNewLinkText('');
    setNewLinkUrl('');
  };

  const handleRemoveLink = (idx: number) => {
    setLinksList(linksList.filter((_, i) => i !== idx));
  };

  const handleSubmitForAnalysis = async () => {
    if (!title.trim() || !bodyText.trim()) {
      alert('Please provide both a title and draft body text.');
      return;
    }

    setIsSubmitting(true);
    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 450);

    try {
      const subResult = await api.createSubmission({
        title,
        content_type: contentType,
        profile_id: store.profiles[0].profile_id,
        body_text: bodyText,
        media: mediaList,
        links: linksList,
      });

      // Trigger reference-grounded AI analysis
      await api.triggerAnalysis(subResult.submission.submission_id);

      clearInterval(interval);
      onNavigate('results', { submissionId: subResult.submission.submission_id });
    } catch (err: any) {
      clearInterval(interval);
      setIsSubmitting(false);
      alert(err.message || 'Failed to submit draft for analysis');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1B3A]">Content Submission Workspace</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit draft copy to compare against approved brand guidelines, verified facts, and terminology.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmitForAnalysis}
            disabled={isSubmitting || !bodyText.trim() || !title.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#139A93] hover:bg-[#0D706B] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>Analyze with AI</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preset Test Scenarios Bar to test DIFFERENT DATA */}
      <div className="bg-white border border-[#D5DBE5] rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0B1B3A]">
            <Wand2 className="w-4 h-4 text-[#139A93]" />
            <span>Load Test Data Scenarios (Analyze Different Inputs)</span>
          </div>
          <span className="text-[11px] text-slate-400">Click to instantly populate workspace</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => loadScenario(1)}
            className="p-3 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100/60 text-left transition-colors cursor-pointer"
          >
            <div className="font-bold text-xs text-[#0D706B] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>1. Reference Promo (TS-01)</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-tight">
              Storage conflict (F-12), claim (G-15), scream (G-07), vocab (T-01), alt-text (G-10).
            </p>
          </button>

          <button
            type="button"
            onClick={() => loadScenario(2)}
            className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 text-left transition-colors cursor-pointer"
          >
            <div className="font-bold text-xs text-rose-800 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>2. Pricing & Trial Breach</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-tight">
              Pricing conflict 299 vs 499 (F-09), trial conflict 30d no card (F-07), health claim (G-09).
            </p>
          </button>

          <button
            type="button"
            onClick={() => loadScenario(3)}
            className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/60 text-left transition-colors cursor-pointer"
          >
            <div className="font-bold text-xs text-purple-800 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" />
              <span>3. Hype Tone & Shouting</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-tight">
              ALL CAPS screaming words, superlative claims (#1 app), urgency breach, vague link text.
            </p>
          </button>

          <button
            type="button"
            onClick={() => loadScenario(4)}
            className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-left transition-colors cursor-pointer"
          >
            <div className="font-bold text-xs text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>4. Clean Compliant Draft</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-tight">
              Accurate 50 GB storage, 499 price, 14-day trial, descriptive alt text. 100% clean pass!
            </p>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Editor & Draft */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#D5DBE5] rounded-2xl p-6 shadow-xs space-y-4">
            {/* Title & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0B1B3A] mb-1.5">
                  Submission Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lumora Pro Summer Launch Campaign"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0B1B3A] mb-1.5">
                  Content Type
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentType)}
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="email">Marketing Email</option>
                  <option value="social_post">Social Post</option>
                  <option value="blog">Blog Article</option>
                  <option value="ad_copy">Ad Copy</option>
                  <option value="landing_page">Landing Page</option>
                  <option value="press_release">Press Release</option>
                </select>
              </div>
            </div>

            {/* Body Text */}
            <div
              onDragOver={handleDraftDragOver}
              onDragLeave={handleDraftDragLeave}
              onDrop={handleDraftDrop}
              className={`relative rounded-xl transition-all ${
                isDraggingDraft ? 'ring-2 ring-teal-500 bg-teal-50/20' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0B1B3A]">
                  Draft Copy (Type, Paste, or Drop Files Here)
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {bodyText.split(/\s+/).filter(Boolean).length} words • {bodyText.length} characters
                </span>
              </div>
              <textarea
                rows={10}
                placeholder="Enter or paste draft content here. (Tip: You can also paste screenshots or drag-and-drop images here to attach them)..."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                onPaste={handleDraftPaste}
                className="w-full text-sm font-serif p-4 bg-[#FBFAF7] border border-[#E8E4DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed shadow-inner"
              />

              {isDraggingDraft && (
                <div className="absolute inset-0 bg-teal-600/10 backdrop-blur-2xs border-2 border-dashed border-teal-500 rounded-xl flex items-center justify-center pointer-events-none">
                  <div className="bg-white/95 px-4 py-2 rounded-xl shadow-lg font-bold text-xs text-teal-800 flex items-center gap-2">
                    <Upload className="w-4 h-4 animate-bounce" />
                    <span>Drop image or text file to insert</span>
                  </div>
                </div>
              )}
            </div>

            {/* File Upload Attachment */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <label className="flex items-center gap-1.5 cursor-pointer text-[#139A93] hover:text-[#0D706B] font-semibold">
                <Upload className="w-4 h-4" />
                <span>Import from text file (.txt, .md)</span>
                <input
                  type="file"
                  accept=".txt,.md,.pdf,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fileNotice && (
                <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium text-[11px] border border-teal-200 animate-fade-in">
                  {fileNotice}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Media, Links & Reference Grounding summary */}
        <div className="space-y-4">
          {/* Media Items Card */}
          <div className="bg-white border border-[#D5DBE5] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1B3A]">
                  Media Assets ({mediaList.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">G-10 Alt Text Check</span>
            </div>

            {/* Click/Drag Image File Upload Zone */}
            <div
              onDragOver={handleMediaDragOver}
              onDragLeave={handleMediaDragLeave}
              onDrop={handleMediaDrop}
              className="relative"
            >
              <label
                className={`border-2 border-dashed p-4 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all text-center group ${
                  isDraggingMedia
                    ? 'border-teal-600 bg-teal-100/70 ring-2 ring-teal-500 ring-offset-1'
                    : 'border-teal-300 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50/80'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${
                    isDraggingMedia
                      ? 'scale-110 bg-teal-600 text-white animate-pulse'
                      : 'bg-teal-100 text-teal-700 group-hover:scale-105'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#0B1B3A]">
                    {isDraggingMedia ? 'Drop Image Now!' : 'Click to Browse or Drag Image Here'}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    PNG, JPG, WEBP, SVG • Drag & Drop / Ctrl+V supported
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageFilesSelected}
                  className="hidden"
                />
              </label>
            </div>

            {/* Media Items List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {mediaList.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2 text-xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {m.url ? (
                        <div
                          onClick={() => setPreviewModalImage({ url: m.url!, name: m.name })}
                          className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-white group/thumb cursor-pointer"
                          title="Click to expand preview"
                        >
                          <img
                            src={m.url}
                            alt={m.alt_text || m.name}
                            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-[#0B1B3A] truncate" title={m.name}>
                          {m.name}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {m.alt_text ? (
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                              ✓ Alt text set
                            </span>
                          ) : (
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-semibold border border-rose-200">
                              ⚠️ Missing Alt Text (G-10)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Inline Alt Text Input */}
                  <div className="pt-1.5 border-t border-slate-200/60">
                    <input
                      type="text"
                      placeholder="Enter descriptive alt text (or leave blank to test G-10 violation)..."
                      value={m.alt_text || ''}
                      onChange={(e) => handleUpdateMediaAlt(idx, e.target.value)}
                      className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Manual Entry Fallback */}
            <details className="text-[11px] text-slate-500 pt-1">
              <summary className="cursor-pointer hover:text-slate-800 font-semibold select-none">
                + Or add media item by file name / URL
              </summary>
              <div className="pt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Image file name (e.g. promo_banner.png)"
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Alt text (optional)"
                  value={newMediaAlt}
                  onChange={(e) => setNewMediaAlt(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleAddMedia}
                  disabled={!newMediaName.trim()}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0B1B3A] text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Add Media Item
                </button>
              </div>
            </details>
          </div>

          {/* Links Card */}
          <div className="bg-white border border-[#D5DBE5] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1B3A]">
                  Links ({linksList.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">G-11 Vague Text</span>
            </div>

            <div className="space-y-2">
              {linksList.map((l, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#0B1B3A] truncate">"{l.text}"</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{l.url}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <input
                type="text"
                placeholder="Anchor text (e.g. Explore Pro plans)"
                value={newLinkText}
                onChange={(e) => setNewLinkText(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="URL (e.g. https://lumora.fitness/pro)"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddLink}
                disabled={!newLinkText.trim() || !newLinkUrl.trim()}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0B1B3A] text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                + Add Link Item
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Submission in-progress modal */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-[#139A93] flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 animate-spin" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#0B1B3A]">
                Reference-Grounded AI Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Comparing copy against approved specifications...
              </p>
            </div>

            <div className="bg-[#FBFAF7] border border-[#E8E4DC] p-4 rounded-xl text-left space-y-2">
              {steps.map((st, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {i < currentStep ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : i === currentStep ? (
                    <div className="w-4 h-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin shrink-0"></div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-200 shrink-0"></div>
                  )}
                  <span
                    className={`${
                      i === currentStep
                        ? 'font-bold text-[#0B1B3A]'
                        : i < currentStep
                        ? 'text-emerald-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {st}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {previewModalImage && (
        <div
          onClick={() => setPreviewModalImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs cursor-pointer animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl border border-slate-200 cursor-default"
          >
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold text-[#0B1B3A] truncate max-w-md">
                {previewModalImage.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
              <img
                src={previewModalImage.url}
                alt={previewModalImage.name}
                className="max-h-[68vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
