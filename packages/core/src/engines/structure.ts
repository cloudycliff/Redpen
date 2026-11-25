import type {
  LoadBearingDimension,
  LoadBearingSentence,
  StructureBlock,
  StructureIssueType,
  StructureMapData,
  WritingIntent,
} from "../types.js";
import type { LLMClient } from "../llm/client.js";
import { parseLLMJson } from "../llm/json.js";
import {
  STRUCTURE_MAP_SYSTEM,
  formatNumberedParagraphs,
  formatWritingIntent,
} from "../prompts/templates.js";

const VALID_ISSUES = new Set<StructureIssueType>([
  "boundary_blur",
  "topic_drift",
  "perspective_jump",
  "disconnect",
  "loop_repeat",
]);

const VALID_DIMENSIONS = new Set<LoadBearingDimension>([
  "sharp_judgment",
  "personal_experience",
  "stance_revision",
]);

interface RawStructureOutput {
  blocks?: Array<{
    paragraph_range?: string;
    start_paragraph?: number;
    end_paragraph?: number;
    summary?: string;
    issue_type?: string;
    issue_note?: string;
  }>;
  candidates?: Array<{
    text?: string;
    dimension?: string;
    reason?: string;
  }>;
}

export async function generateStructureMap(
  llm: LLMClient,
  text: string,
  intent: WritingIntent
): Promise<StructureMapData> {
  const raw = await llm.complete({
    tier: "deep",
    temperature: 0.3,
    messages: [
      { role: "system", content: STRUCTURE_MAP_SYSTEM },
      {
        role: "user",
        content: `## 写作初衷\n${formatWritingIntent(intent)}\n\n## 口述稿正文（已标注段号）\n${formatNumberedParagraphs(text)}`,
      },
    ],
  });

  const parsed = parseLLMJson<RawStructureOutput>(raw);

  const blocks: StructureBlock[] = (parsed.blocks ?? []).map((b, idx) => {
    const start = Number(b.start_paragraph) || idx + 1;
    const end = Number(b.end_paragraph) || start;
    const issueType =
      b.issue_type && VALID_ISSUES.has(b.issue_type as StructureIssueType)
        ? (b.issue_type as StructureIssueType)
        : undefined;
    return {
      id: `blk-${idx + 1}`,
      paragraph_range: b.paragraph_range || `第${start}-${end}段`,
      start_paragraph: start,
      end_paragraph: end,
      summary: b.summary?.trim() || "（无概括）",
      ...(issueType ? { issue_type: issueType, issue_note: b.issue_note?.trim() || "" } : {}),
    };
  });

  const candidates: LoadBearingSentence[] = (parsed.candidates ?? [])
    .filter((c) => typeof c.text === "string" && c.text.trim().length > 0)
    .slice(0, 5)
    .map((c, idx) => ({
      id: `lb-${idx + 1}`,
      text: c.text!.trim(),
      dimension: VALID_DIMENSIONS.has(c.dimension as LoadBearingDimension)
        ? (c.dimension as LoadBearingDimension)
        : "sharp_judgment",
      reason: c.reason?.trim() || "",
      locked: true,
    }));

  return {
    generated_at: new Date().toISOString(),
    blocks,
    candidates,
  };
}
