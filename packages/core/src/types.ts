export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  lightModel: string;
}

export interface AppConfig {
  llm: LLMConfig;
  vaultDir: string;
}

export interface SafeAppConfig {
  llm: {
    baseUrl: string;
    apiKeyMasked: string;
    hasApiKey: boolean;
    model: string;
    lightModel: string;
  };
  vaultDir: string;
}

export interface WritingIntent {
  raw_note: string;
  trigger: string;
  target_audience: string;
  desired_effect: string;
}

export type FragmentStatus = "raw" | "clustered" | "promoted" | "archived";

export interface FragmentMeta {
  id: string;
  title: string;
  created_at: string;
  source: string;
  status: FragmentStatus;
  tags: string[];
  summary: string;
  candidate_load_bearing: string[];
  candidate_experiences: string[];
  linked_articles: string[];
  char_count: number;
}

export interface Fragment extends FragmentMeta {
  filename: string;
  content: string;
}

export interface TopicCluster {
  id: string;
  topic: string;
  reason: string;
  fragment_ids: string[];
}

export type CleanPatchType =
  | "typo"
  | "punctuation"
  | "terminology"
  | "filler_optional";

export type CleanPatchStatus = "accepted" | "reverted";

export interface CleanPatch {
  id: string;
  exact_quote: string;
  replace_with: string;
  type: CleanPatchType;
  reason: string;
  start: number;
  end: number;
  status: CleanPatchStatus;
}

export interface CleanDiffState {
  source_text: string;
  patches: CleanPatch[];
  cleaned_text: string;
  generated_at: string;
}

export type StructureIssueType =
  | "boundary_blur"
  | "topic_drift"
  | "perspective_jump"
  | "disconnect"
  | "loop_repeat";

export interface StructureBlock {
  id: string;
  paragraph_range: string;
  start_paragraph: number;
  end_paragraph: number;
  summary: string;
  issue_type?: StructureIssueType;
  issue_note?: string;
}

export type LoadBearingDimension =
  | "sharp_judgment"
  | "personal_experience"
  | "stance_revision";

export interface LoadBearingSentence {
  id: string;
  text: string;
  dimension: LoadBearingDimension;
  reason: string;
  locked: boolean;
}

export interface StructureMapData {
  generated_at: string;
  blocks: StructureBlock[];
  candidates: LoadBearingSentence[];
}

export type ArticleStage =
  | "cleaning"
  | "revising"
  | "compliance"
  | "finalized";

export interface TitleCandidate {
  id: string;
  title: string;
  angle: string;
  explanation: string;
  selected: boolean;
}

export interface PublishMeta {
  platform: "wechat_mp";
  published_at: string | null;
  retrospective_note: string | null;
}

export interface ArticleMeta {
  id: string;
  slug: string;
  title: string;
  working_title: string;
  stage: ArticleStage;
  created_at: string;
  updated_at: string;
  writing_intent: WritingIntent;
  source_fragments: string[];
  current_draft_version: number;
  current_round: number;
  load_bearing_sentences: LoadBearingSentence[];
  title_candidates: TitleCandidate[];
  publish_meta: PublishMeta;
}

export interface RoundMessage {
  id: string;
  role: "author" | "editor";
  content: string;
  quote?: string;
  created_at: string;
}

export interface RoundRecord {
  round: number;
  draft_version: number;
  created_at: string;
  status: "active" | "settled";
  diagnosis_markdown: string;
  messages: RoundMessage[];
  agreed_consensus: string[];
  rejected_suggestions: string[];
  referenced_stances: string[];
  referenced_experiences: string[];
  diff_from_prev?: string;
}

export interface SettlePreview {
  updated_writing_intent: WritingIntent;
  intent_changed: boolean;
  agreed_consensus: string[];
  rejected_suggestions: string[];
  draft_diff_summary: string;
}

export type ComplianceDimension = "compliance" | "privacy";
export type RiskSeverity = "high" | "medium" | "low";
export type FindingStatus = "open" | "resolved" | "ignored";

export interface ComplianceFinding {
  id: string;
  dimension: ComplianceDimension;
  severity: RiskSeverity;
  quote: string;
  reason: string;
  direction: string;
  status: FindingStatus;
}

export interface ComplianceReport {
  checked_at: string;
  draft_version: number;
  summary: string;
  findings: ComplianceFinding[];
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  working_title: string;
  stage: ArticleStage;
  created_at: string;
  updated_at: string;
  current_draft_version: number;
  current_round: number;
  locked_load_bearing_count: number;
}

export interface ArticleDetail {
  meta: ArticleMeta;
  raw_source: string;
  clean_diff: CleanDiffState | null;
  structure_map: StructureMapData | null;
  draft_versions: number[];
  current_draft: string;
  rounds: RoundRecord[];
  compliance: ComplianceReport | null;
  final_markdown: string | null;
}

export type StanceStatus = "active" | "revised" | "deprecated";

export interface StanceRecord {
  id: string;
  topic: string;
  status: StanceStatus;
  created_at: string;
  source_article: string;
  supersedes: string | null;
  tags: string[];
  core_judgment: string;
  reasoning: string;
}

export interface ExperienceRecord {
  id: string;
  title: string;
  created_at: string;
  source_article: string;
  tags: string[];
  narrative: string;
  cost_or_lesson: string;
}

export interface ExtractedStanceCandidate {
  topic: string;
  core_judgment: string;
  reasoning: string;
  tags: string[];
  relation: "new" | "extends" | "revises" | "contradicts";
  related_stance_id: string | null;
}

export interface ExtractedExperienceCandidate {
  title: string;
  narrative: string;
  cost_or_lesson: string;
  tags: string[];
}

export interface ArchiveExtractionPreview {
  stances: ExtractedStanceCandidate[];
  experiences: ExtractedExperienceCandidate[];
}

export interface TextDiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}
