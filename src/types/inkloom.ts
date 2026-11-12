/**
 * INKLOOM AI - Type Definitions
 * Complete definitions for the 15-table relational schema & AI pipeline.
 */

export type UserRole = 'admin' | 'creator' | 'reviewer';

export interface User {
  user_id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Organisation {
  org_id: string;
  name: string;
  domain?: string;
  created_at: string;
}

export interface BrandProfile {
  profile_id: string;
  org_id: string;
  name: string;
  voice_notes: string;
  external_ai_allowed: boolean;
  team_visibility: 'team' | 'own';
  status: 'active' | 'archived';
  palette?: string[];
  is_demo?: boolean;
  created_at: string;
}

export type GuidelineCategory =
  | 'tone'
  | 'claims'
  | 'terminology'
  | 'accessibility'
  | 'visual'
  | 'general';

export type ContentType =
  | 'email'
  | 'social_post'
  | 'blog'
  | 'ad_copy'
  | 'landing_page'
  | 'press_release';

export interface BrandGuideline {
  guideline_id: string;
  profile_id: string;
  code: string; // e.g. G-01
  title: string;
  category: GuidelineCategory;
  rule_text: string;
  content_types: ContentType[];
  example_good?: string;
  example_bad?: string;
  version: number;
  is_active: boolean;
  is_demo?: boolean;
  created_at: string;
}

export interface ApprovedFact {
  fact_id: string;
  profile_id: string;
  code: string; // e.g. F-01
  statement: string;
  subject: string;
  source_ref?: string;
  valid_until?: string; // YYYY-MM-DD
  is_active: boolean;
  created_at: string;
}

export interface TerminologyItem {
  term_id: string;
  profile_id: string;
  code: string; // e.g. T-01
  preferred_term: string;
  avoid_terms: string[];
  notes?: string;
  case_sensitive: boolean;
}

export interface BrandAsset {
  asset_id: string;
  profile_id: string;
  name: string;
  asset_type: 'logo' | 'color' | 'font' | 'image';
  file_url?: string;
  alt_text?: string;
  is_demo?: boolean;
  created_at: string;
}

export type SubmissionStatus =
  | 'draft'
  | 'in_analysis'
  | 'in_correction'
  | 'in_review'
  | 'approved'
  | 'changes_requested';

export interface ContentSubmission {
  submission_id: string;
  profile_id: string;
  creator_id: string;
  creator_name?: string;
  title: string;
  content_type: ContentType;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  name: string;
  alt_text: string | null;
  url?: string;
}

export interface LinkItem {
  text: string;
  url: string;
}

export interface ContentVersion {
  version_id: string;
  submission_id: string;
  version_no: number;
  body_text: string;
  media: MediaItem[];
  links: LinkItem[];
  source: 'creator_submit' | 'ai_applied' | 'edited';
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export type IssueCategory =
  | 'fact_conflict'
  | 'unsupported_claim'
  | 'terminology'
  | 'tone'
  | 'accessibility';

export type IssueSeverity = 'high' | 'medium' | 'low';

export type IssueStatus =
  | 'verified_conflict'
  | 'needs_human_check'
  | 'rule_violation';

export type SuggestionStatus = 'pending' | 'accepted' | 'edited' | 'dismissed';

export interface CorrectionSuggestion {
  suggestion_id: string;
  issue_id: string;
  suggested_text: string;
  rationale: string;
  status: SuggestionStatus;
  final_text?: string;
  dismiss_reason?: string;
  responded_by?: string;
  responded_at?: string;
}

export interface EvidenceItem {
  code: string;
  type: 'guideline' | 'fact' | 'term';
  title?: string;
  text: string;
}

export interface DetectedIssue {
  issue_id: string;
  report_id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  confidence: 'high' | 'medium' | 'low';
  excerpt: string;
  start_offset: number;
  end_offset: number;
  evidence_refs: string[];
  evidence_items?: EvidenceItem[];
  explanation: string;
  suggestion?: CorrectionSuggestion;
  source: 'code' | 'ai';
}

export interface AnalysisReport {
  report_id: string;
  version_id: string;
  summary: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  model_name: string;
  modelName?: string;
  ai_status: 'completed' | 'ai_unavailable' | 'skipped_external_ai_disabled';
  created_at: string;
  issues: DetectedIssue[];
}

export interface ReviewComment {
  comment_id: string;
  version_id: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  issue_id?: string;
  parent_comment_id?: string;
  body: string;
  created_at: string;
}

export interface ApprovalRecord {
  approval_id: string;
  version_id: string;
  reviewer_id: string;
  reviewer_name: string;
  decision: 'approved' | 'changes_requested';
  comment?: string;
  visual_checklist?: {
    logoCorrect: boolean;
    colorsCompliant: boolean;
    imageryAppropriate: boolean;
  };
  decided_at: string;
}

export interface AuditLog {
  log_id: number;
  org_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: any;
  created_at: string;
}

export interface FactCheckItem {
  claim: string;
  label: 'Conflicts' | 'Matches' | 'Not covered';
  fact_code?: string;
  fact_statement?: string;
}

export interface LabelledTestCase {
  id: string;
  draft_text: string;
  media?: MediaItem[];
  expected_findings: {
    category: IssueCategory;
    severity: IssueSeverity;
    evidence_code: string;
    status: IssueStatus;
  }[];
  notes: string;
}

export interface DiffChunk {
  type: 'unchanged' | 'inserted' | 'deleted';
  value: string;
}

// -------------------------------------------------------------
// SOCIAL MEDIA PUBLISHING TYPES (SECTION 3 OF SPECIFICATION)
// -------------------------------------------------------------

export type SocialProvider =
  | 'meta_facebook'
  | 'meta_instagram'
  | 'linkedin'
  | 'x_twitter';

export interface SocialAccount {
  account_id: string;
  provider: SocialProvider;
  external_account_id: string;
  display_name: string;
  account_handle?: string;
  account_type: 'page' | 'professional' | 'organization' | 'member';
  granted_scopes: string[];
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  profile_picture_url?: string;
  last_verified_at: string;
  owner_id: string;
  created_at: string;
}

export interface SocialPostVariant {
  variant_id: string;
  submission_id: string;
  source_version_id: string;
  provider: SocialProvider;
  target_account_id: string;
  caption: string;
  hashtags: string[];
  media_urls: string[];
  alt_texts: string[];
  character_limit: number;
  is_approved: boolean;
  approval_status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export type PublishJobStatus =
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'
  | 'needs_reconnect';

export interface PublishJob {
  job_id: string;
  variant_id: string;
  account_id: string;
  submission_id: string;
  submission_title: string;
  provider: SocialProvider;
  caption: string;
  media_urls?: string[];
  scheduled_time: string; // ISO format
  timezone: string;
  status: PublishJobStatus;
  retry_count: number;
  idempotency_key: string;
  last_error?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  executed_at?: string;
}

export interface PublishResult {
  result_id: string;
  job_id: string;
  provider: SocialProvider;
  provider_post_id?: string;
  provider_url?: string;
  published_at: string;
  status: 'success' | 'failed' | 'partial';
  response_metadata?: any;
}

// -------------------------------------------------------------
// AUTOMATED IMAGE-BASED BRAND CHECKING TYPES
// -------------------------------------------------------------

export type VisualIssueCategory =
  | 'logo_compliance'
  | 'color_compliance'
  | 'visual_consistency'
  | 'guideline_deviation'
  | 'layout_spacing';

export type VisualIssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type VisualIssueReviewStatus =
  | 'pending'
  | 'unreviewed'
  | 'confirmed'
  | 'false_positive'
  | 'needs_correction'
  | 'unreviewed';

export interface DbHealthReport {
  connected: boolean;
  status: 'connected' | 'unconfigured' | 'unreachable' | 'active';
  latencyMs: number;
  mode?: 'pool' | 'adapter';
  error?: string;
  checkedAt?: string;
  tablesVerified?: string[];
}

export interface DetectedRegion {
  x: number; // percentage 0-100 or px
  y: number; // percentage 0-100 or px
  width: number;
  height: number;
  unit?: '%' | 'px';
  label?: string;
}

export interface ColorComparison {
  expected_hex: string;
  expected_name?: string;
  detected_hex: string;
  detected_name?: string;
  delta_e: number; // CIE Delta E (perceptual distance)
  prominence?: number; // e.g. 24% of image area
  coverage_percentage?: number;
  rule_code?: string;
}

export interface LogoComparison {
  approved_asset_name?: string;
  approved_aspect_ratio?: number;
  approved_logo_id?: string;
  approved_logo_name?: string;
  approved_asset_name?: string;
  approved_logo_url?: string;
  detected_logo_region?: DetectedRegion;
  detected_aspect_ratio?: number;
  expected_aspect_ratio?: number;
  distortion_factor?: number; // ratio discrepancy e.g. 1.48 (48% stretch)
  variation_type?: 'unapproved_variant' | 'stretched' | 'low_contrast' | 'missing' | 'altered_elements';
}

export interface VisualBrandIssue {
  issue_id: string;
  report_id?: string;
  image_name: string;
  image_url?: string;
  title: string;
  category: VisualIssueCategory;
  severity: VisualIssueSeverity;
  confidence: number; // 0 to 100 percentage
  confidence_basis?: Record<string, any>;
  description: string;
  expected_rule: string;
  detected_result: string;
  recommendation: string;
  region?: DetectedRegion;
  color_comparison?: ColorComparison;
  logo_comparison?: LogoComparison;
  source?: 'deterministic' | 'ai' | 'fused';
  classification?: 'violation' | 'possible_concern';
  review_status: VisualIssueReviewStatus;
  reviewer_comment?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
}

export interface ExtractedColorItem {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
  is_approved: boolean;
  closest_approved_hex: string;
  delta_e: number;
}

export interface VisualIssueReview {
  review_id: string;
  issue_id: string;
  org_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  decision: VisualIssueReviewStatus;
  comment?: string;
  created_at: string;
}

export interface VisualCheckReport {
  check_id: string;
  version_id: string;
  submission_id: string;
  org_id?: string;
  created_at: string;
  status: 'completed' | 'analyzing' | 'failed';
  overall_compliance: 'compliant' | 'concerns_detected' | 'action_required';
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
    resolved: number;
  };
  extracted_colors: ExtractedColorItem[];
  detected_logos: {
    name: string;
    region?: DetectedRegion;
    match_score: number;
    is_distorted: boolean;
    is_approved_variant: boolean;
    details?: string;
  }[];
  issues: VisualBrandIssue[];
  provider: 'gemini_vision' | 'cv_heuristic_engine';
  model?: string;
  engine_version?: string;
  engine_notes?: string;
  timings?: Record<string, number>;
  image_sha256?: string;
  width?: number;
  height?: number;
  superseded?: boolean;
}

export interface DbHealthReport {
  connected: boolean;
  mode?: 'pool' | 'replica' | 'memory' | 'database';
  projectUrl?: string;
  latencyMs: number;
  tablesVerified?: string[];
  status: 'operational' | 'degraded' | 'unreachable' | 'active' | 'connected' | 'unconfigured';
  timestamp: string;
  error?: string;
  checkedAt?: string;
}

