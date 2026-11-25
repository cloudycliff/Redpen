import crypto from "node:crypto";
import type {
  ArchiveExtractionPreview,
  ComplianceDimension,
  ComplianceFinding,
  ComplianceReport,
  LoadBearingSentence,
  RiskSeverity,
  StanceRecord,
  TitleCandidate,
  WritingIntent,
} from "../types.js";
import type { LLMClient } from "../llm/client.js";
import { parseLLMJson } from "../llm/json.js";
import {
  ARCHIVE_EXTRACT_SYSTEM,
  COMPLIANCE_PRIVACY_SYSTEM,
  TITLE_COCREATION_SYSTEM,
  WECHAT_PACKAGING_SYSTEM,
  formatLoadBearingList,
  formatWritingIntent,
} from "../prompts/templates.js";
import type {
  IllustrationIdea,
  WechatPackaging,
  WechatThemeId,
} from "../types.js";

export async function generateTitleCandidates(params: {
  llm: LLMClient;
  draftText: string;
  loadBearing: LoadBearingSentence[];
  intent: WritingIntent;
  angleHint?: string;
}): Promise<TitleCandidate[]> {
  const hintBlock = params.angleHint?.trim()
    ? `\n\n## 作者额外要求的方向\n${params.angleHint.trim()}`
    : "";

  const raw = await params.llm.complete({
    tier: "deep",
    temperature: 0.7,
    messages: [
      { role: "system", content: TITLE_COCREATION_SYSTEM },
      {
        role: "user",
        content: `## 写作初衷\n${formatWritingIntent(params.intent)}\n\n## 锁定的承重句\n${formatLoadBearingList(params.loadBearing)}${hintBlock}\n\n## 文章正文\n${params.draftText}`,
      },
    ],
  });

  const parsed = parseLLMJson<{
    candidates?: Array<{ title?: string; angle?: string; explanation?: string }>;
  }>(raw);

  return (parsed.candidates ?? [])
    .filter((c) => typeof c.title === "string" && c.title.trim().length > 0)
    .map((c, idx) => ({
      id: `title-${idx + 1}-${crypto.randomBytes(2).toString("hex")}`,
      title: c.title!.trim(),
      angle: c.angle?.trim() || "多角度候选",
      explanation: c.explanation?.trim() || "",
      selected: false,
    }));
}

const VALID_DIMENSIONS = new Set<ComplianceDimension>(["compliance", "privacy"]);
const VALID_SEVERITIES = new Set<RiskSeverity>(["high", "medium", "low"]);

export async function runCompliancePrivacyGate(params: {
  llm: LLMClient;
  title: string;
  draftVersion: number;
  draftText: string;
}): Promise<ComplianceReport> {
  const raw = await params.llm.complete({
    tier: "deep",
    temperature: 0.2,
    messages: [
      { role: "system", content: COMPLIANCE_PRIVACY_SYSTEM },
      {
        role: "user",
        content: `## 待发布标题\n${params.title || "（暂未定标题）"}\n\n## 待发布正文\n${params.draftText}`,
      },
    ],
  });

  const parsed = parseLLMJson<{
    summary?: string;
    findings?: Array<{
      dimension?: string;
      severity?: string;
      quote?: string;
      reason?: string;
      direction?: string;
    }>;
  }>(raw);

  const findings: ComplianceFinding[] = (parsed.findings ?? [])
    .filter((f) => typeof f.reason === "string" && f.reason.trim().length > 0)
    .map((f, idx) => ({
      id: `risk-${idx + 1}-${crypto.randomBytes(2).toString("hex")}`,
      dimension: VALID_DIMENSIONS.has(f.dimension as ComplianceDimension)
        ? (f.dimension as ComplianceDimension)
        : "compliance",
      severity: VALID_SEVERITIES.has(f.severity as RiskSeverity)
        ? (f.severity as RiskSeverity)
        : "medium",
      quote: f.quote?.trim() || "",
      reason: f.reason!.trim(),
      direction: f.direction?.trim() || "",
      status: "open",
    }));

  return {
    checked_at: new Date().toISOString(),
    draft_version: params.draftVersion,
    summary:
      parsed.summary?.trim() ||
      (findings.length === 0
        ? "未发现明显发布合规或隐私泄露风险。"
        : `共检出 ${findings.length} 处需关注的风险提示。`),
    findings,
  };
}

export async function extractArchiveCandidates(params: {
  llm: LLMClient;
  title: string;
  finalBody: string;
  loadBearing: LoadBearingSentence[];
  existingStances: StanceRecord[];
}): Promise<ArchiveExtractionPreview> {
  const stanceIndex = params.existingStances.map((s) => ({
    id: s.id,
    topic: s.topic,
    core_judgment: s.core_judgment,
    created_at: s.created_at,
  }));

  const raw = await params.llm.complete({
    tier: "deep",
    temperature: 0.3,
    messages: [
      { role: "system", content: ARCHIVE_EXTRACT_SYSTEM },
      {
        role: "user",
        content: `## 定稿标题\n${params.title}\n\n## 锁定的承重句\n${formatLoadBearingList(params.loadBearing)}\n\n## 已有历史立场索引\n${JSON.stringify(stanceIndex, null, 2)}\n\n## 定稿正文\n${params.finalBody}`,
      },
    ],
  });

  const parsed = parseLLMJson<Partial<ArchiveExtractionPreview>>(raw);
  const validStanceIds = new Set(params.existingStances.map((s) => s.id));

  const stances = (parsed.stances ?? [])
    .filter((s) => s && typeof s.core_judgment === "string" && s.core_judgment.trim())
    .slice(0, 3)
    .map((s) => ({
      topic: s.topic?.trim() || "核心立场",
      core_judgment: s.core_judgment.trim(),
      reasoning: s.reasoning?.trim() || "",
      tags: Array.isArray(s.tags) ? s.tags.filter((t): t is string => typeof t === "string") : [],
      relation:
        s.relation === "extends" ||
        s.relation === "revises" ||
        s.relation === "contradicts"
          ? s.relation
          : ("new" as const),
      related_stance_id:
        s.related_stance_id && validStanceIds.has(s.related_stance_id)
          ? s.related_stance_id
          : null,
    }));

  const experiences = (parsed.experiences ?? [])
    .filter((e) => e && typeof e.narrative === "string" && e.narrative.trim())
    .slice(0, 3)
    .map((e) => ({
      title: e.title?.trim() || "个人经历",
      narrative: e.narrative.trim(),
      cost_or_lesson: e.cost_or_lesson?.trim() || "",
      tags: Array.isArray(e.tags) ? e.tags.filter((t): t is string => typeof t === "string") : [],
    }));

  return { stances, experiences };
}

export async function generateWechatPackaging(params: {
  llm: LLMClient;
  title: string;
  draftText: string;
  loadBearing: LoadBearingSentence[];
  intent: WritingIntent;
  existing?: Partial<WechatPackaging>;
}): Promise<WechatPackaging> {
  const raw = await params.llm.complete({
    tier: "deep",
    temperature: 0.5,
    messages: [
      { role: "system", content: WECHAT_PACKAGING_SYSTEM },
      {
        role: "user",
        content: `## 文章标题\n${params.title || "（暂未定标题）"}\n\n## 写作初衷\n${formatWritingIntent(params.intent)}\n\n## 锁定的承重句\n${formatLoadBearingList(params.loadBearing)}\n\n## 文章正文\n${params.draftText}`,
      },
    ],
  });

  const parsed = parseLLMJson<{
    digest_candidates?: string[];
    illustration_ideas?: Array<{
      placement?: string;
      concept?: string;
      style?: string;
      prompt_hint?: string;
    }>;
  }>(raw);

  const digestCandidates = Array.isArray(parsed.digest_candidates)
    ? parsed.digest_candidates
        .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
        .map((d) => d.trim())
        .slice(0, 3)
    : [];

  const illustrationIdeas: IllustrationIdea[] = (parsed.illustration_ideas ?? [])
    .filter((i) => i && typeof i.concept === "string" && i.concept.trim())
    .slice(0, 4)
    .map((i, idx) => ({
      id: `illus-${idx + 1}-${crypto.randomBytes(2).toString("hex")}`,
      placement: i.placement?.trim() || "正文配图",
      concept: i.concept!.trim(),
      style: i.style?.trim() || "极简配图",
      prompt_hint: i.prompt_hint?.trim() || "",
    }));

  const theme: WechatThemeId = params.existing?.theme ?? "editorial_ink";
  return {
    theme,
    highlight_load_bearing: params.existing?.highlight_load_bearing ?? false,
    digest: params.existing?.digest?.trim() || digestCandidates[0] || "",
    digest_candidates: digestCandidates,
    illustration_ideas: illustrationIdeas,
    generated_at: new Date().toISOString(),
  };
}
