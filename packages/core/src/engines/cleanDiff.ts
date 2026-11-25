import { diffChars, diffLines, createTwoFilesPatch } from "diff";
import type {
  CleanDiffState,
  CleanPatch,
  CleanPatchType,
  TextDiffPart,
} from "../types.js";
import type { LLMClient } from "../llm/client.js";
import { parseLLMJson } from "../llm/json.js";
import { CLEAN_DIFF_PATCHES_SYSTEM } from "../prompts/templates.js";

export interface RawPatchSuggestion {
  exact_quote: string;
  replace_with: string;
  type: CleanPatchType;
  reason: string;
}

const VALID_TYPES = new Set<CleanPatchType>([
  "typo",
  "punctuation",
  "terminology",
  "filler_optional",
]);

/**
 * Validates and anchors LLM-suggested atomic patches onto sourceText.
 * Enforces anti-rewriting guardrails so the model cannot silently polish sentences.
 */
export function buildCleanPatches(
  sourceText: string,
  rawSuggestions: RawPatchSuggestion[]
): CleanPatch[] {
  const anchored: CleanPatch[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const item of rawSuggestions) {
    if (!item || typeof item.exact_quote !== "string" || typeof item.replace_with !== "string") {
      continue;
    }
    const quote = item.exact_quote;
    const replacement = item.replace_with;
    if (!quote || quote === replacement) continue;

    // Guardrail 1: Must exist uniquely in sourceText (prevent ambiguous replacements)
    const firstIdx = sourceText.indexOf(quote);
    if (firstIdx === -1) continue;
    const secondIdx = sourceText.indexOf(quote, firstIdx + 1);
    if (secondIdx !== -1) continue;

    // Guardrail 2: Must not span across paragraph breaks
    if (quote.includes("\n") || replacement.includes("\n")) continue;

    // Guardrail 3: Prevent sneaky rewriting — changed char count should be minimal
    const charDiff = diffChars(quote, replacement);
    let changedChars = 0;
    for (const part of charDiff) {
      if (part.added || part.removed) {
        changedChars += part.value.length;
      }
    }
    if (changedChars > 14) {
      continue;
    }

    // Trim shared prefix & suffix so the highlighted diff span is surgical and tight
    let prefixLen = 0;
    while (
      prefixLen < quote.length &&
      prefixLen < replacement.length &&
      quote[prefixLen] === replacement[prefixLen]
    ) {
      prefixLen++;
    }
    let suffixLen = 0;
    while (
      suffixLen < quote.length - prefixLen &&
      suffixLen < replacement.length - prefixLen &&
      quote[quote.length - 1 - suffixLen] ===
        replacement[replacement.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    const start = firstIdx + prefixLen;
    const end = firstIdx + quote.length - suffixLen;
    const tightOriginal = quote.slice(prefixLen, quote.length - suffixLen);
    const tightReplacement = replacement.slice(
      prefixLen,
      replacement.length - suffixLen
    );

    if (tightOriginal === tightReplacement) continue;

    // Guardrail 4: Avoid overlapping patches
    const overlaps = usedRanges.some(
      (r) => !(end <= r.start || start >= r.end)
    );
    if (overlaps) continue;

    usedRanges.push({ start, end });
    const patchType: CleanPatchType = VALID_TYPES.has(item.type)
      ? item.type
      : "typo";

    anchored.push({
      id: `patch-${anchored.length + 1}`,
      exact_quote: tightOriginal,
      replace_with: tightReplacement,
      type: patchType,
      reason: item.reason?.trim() || "语音转写修正",
      start,
      end,
      status: "accepted",
    });
  }

  return anchored.sort((a, b) => a.start - b.start);
}

/**
 * Deterministically synthesizes cleaned_text from sourceText and patches
 * honoring each patch's accepted/reverted state.
 */
export function applyCleanPatches(
  sourceText: string,
  patches: CleanPatch[]
): string {
  const sorted = [...patches].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let result = "";

  for (const p of sorted) {
    if (p.start < cursor || p.end > sourceText.length) continue;
    result += sourceText.slice(cursor, p.start);
    result += p.status === "accepted" ? p.replace_with : sourceText.slice(p.start, p.end);
    cursor = p.end;
  }

  result += sourceText.slice(cursor);
  return result;
}

export async function generateCleanDiff(
  llm: LLMClient,
  sourceText: string
): Promise<CleanDiffState> {
  const raw = await llm.complete({
    tier: "light",
    temperature: 0.1,
    messages: [
      { role: "system", content: CLEAN_DIFF_PATCHES_SYSTEM },
      {
        role: "user",
        content: `请对以下中文语音口述稿输出最小原子校对补丁（严格遵守不改句式、不删口语连接词的规则）：\n\n${sourceText}`,
      },
    ],
  });

  let parsed: RawPatchSuggestion[] = [];
  try {
    const json = parseLLMJson<RawPatchSuggestion[] | { patches?: RawPatchSuggestion[] }>(raw);
    parsed = Array.isArray(json) ? json : Array.isArray(json?.patches) ? json.patches : [];
  } catch {
    parsed = [];
  }

  const patches = buildCleanPatches(sourceText, parsed);
  const cleanedText = applyCleanPatches(sourceText, patches);

  return {
    source_text: sourceText,
    patches,
    cleaned_text: cleanedText,
    generated_at: new Date().toISOString(),
  };
}

export function computeDraftDiffParts(
  oldText: string,
  newText: string
): TextDiffPart[] {
  const parts = diffLines(oldText, newText);
  return parts.map((p) => ({
    value: p.value,
    added: p.added,
    removed: p.removed,
  }));
}

export function formatUnifiedDraftDiff(
  oldText: string,
  newText: string,
  oldLabel = "prev",
  newLabel = "next"
): string {
  return createTwoFilesPatch(oldLabel, newLabel, oldText, newText, "", "", {
    context: 2,
  });
}
