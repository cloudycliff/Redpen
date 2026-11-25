import type {
  ExperienceRecord,
  LoadBearingSentence,
  RoundMessage,
  RoundRecord,
  SettlePreview,
  StanceRecord,
  WritingIntent,
} from "../types.js";
import type { ChatMessage, LLMClient } from "../llm/client.js";
import { parseLLMJson } from "../llm/json.js";
import {
  CONSENSUS_COMPRESS_SYSTEM,
  EDITOR_SYSTEM_CORE,
  buildNextRoundUserPrompt,
  buildRound1UserPrompt,
  formatLoadBearingList,
  formatNumberedParagraphs,
  formatWritingIntent,
} from "../prompts/templates.js";
import { formatUnifiedDraftDiff } from "./cleanDiff.js";

export async function* streamRound1Diagnosis(params: {
  llm: LLMClient;
  title: string;
  intent: WritingIntent;
  loadBearing: LoadBearingSentence[];
  draftText: string;
  stances: StanceRecord[];
  experiences: ExperienceRecord[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const userPrompt = buildRound1UserPrompt(params);
  yield* params.llm.stream({
    tier: "deep",
    temperature: 0.45,
    signal: params.signal,
    messages: [
      { role: "system", content: EDITOR_SYSTEM_CORE },
      { role: "user", content: userPrompt },
    ],
  });
}

export async function* streamNextRoundDiagnosis(params: {
  llm: LLMClient;
  round: number;
  draftVersion: number;
  title: string;
  intent: WritingIntent;
  loadBearing: LoadBearingSentence[];
  agreedConsensus: string[];
  rejectedSuggestions: string[];
  diffFromPrev: string;
  draftText: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const userPrompt = buildNextRoundUserPrompt(params);
  yield* params.llm.stream({
    tier: "deep",
    temperature: 0.45,
    signal: params.signal,
    messages: [
      { role: "system", content: EDITOR_SYSTEM_CORE },
      { role: "user", content: userPrompt },
    ],
  });
}

export async function* streamRoundChat(params: {
  llm: LLMClient;
  title: string;
  intent: WritingIntent;
  loadBearing: LoadBearingSentence[];
  draftVersion: number;
  draftText: string;
  round: RoundRecord;
  accumulatedConsensus: string[];
  accumulatedRejected: string[];
  newUserMessage: string;
  quote?: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const contextPrompt = `当前处于 **Round ${params.round.round}（基于 v${params.draftVersion}）的自由讨论阶段**。

## 选题名
${params.title}

## 写作初衷
${formatWritingIntent(params.intent)}

## 作者锁定的承重句
${formatLoadBearingList(params.loadBearing)}

${params.accumulatedConsensus.length > 0 ? `## 此前已达成共识\n${params.accumulatedConsensus.map((c) => `- ${c}`).join("\n")}\n` : ""}
${params.accumulatedRejected.length > 0 ? `## 作者已否决建议（严禁重提）\n${params.accumulatedRejected.map((r) => `- ${r}`).join("\n")}\n` : ""}

## 当前稿件（v${params.draftVersion}）
${formatNumberedParagraphs(params.draftText)}

---
请记住：
1. 若作者补充了触发场景、受众或反驳理由，请立刻评估它是否改变了整篇主线——有理则爽快收回旧判断并帮作者串起新骨架；
2. 每次回复保持紧凑，追问不超过 3 个；
3. 【绝不代写正文，不给出可供直接复制粘贴的改写范文】。`;

  const messages: ChatMessage[] = [
    { role: "system", content: EDITOR_SYSTEM_CORE },
    { role: "user", content: contextPrompt },
  ];

  if (params.round.diagnosis_markdown) {
    messages.push({
      role: "assistant",
      content: params.round.diagnosis_markdown,
    });
  }

  for (const m of params.round.messages) {
    const content = m.quote
      ? `【引用正文】\n> ${m.quote}\n\n${m.content}`
      : m.content;
    messages.push({
      role: m.role === "author" ? "user" : "assistant",
      content,
    });
  }

  const latest = params.quote
    ? `【引用正文】\n> ${params.quote}\n\n${params.newUserMessage}`
    : params.newUserMessage;
  messages.push({ role: "user", content: latest });

  yield* params.llm.stream({
    tier: "deep",
    temperature: 0.5,
    signal: params.signal,
    messages,
  });
}

export async function previewRoundSettlement(params: {
  llm: LLMClient;
  currentIntent: WritingIntent;
  round: RoundRecord;
  prevDraft: string;
  nextDraft: string;
}): Promise<SettlePreview> {
  const diffStr = formatUnifiedDraftDiff(
    params.prevDraft,
    params.nextDraft,
    `v${params.round.draft_version}.md`,
    `v${params.round.draft_version + 1}.md`
  );

  // If no discussion happened at all, skip LLM call for instant UX
  if (params.round.messages.length === 0) {
    return {
      updated_writing_intent: params.currentIntent,
      intent_changed: false,
      agreed_consensus: [],
      rejected_suggestions: [],
      draft_diff_summary: diffStr,
    };
  }

  const transcript = params.round.messages
    .map((m: RoundMessage) =>
      `${m.role === "author" ? "作者" : "主编"}：${m.quote ? `[引用：${m.quote}] ` : ""}${m.content}`
    )
    .join("\n\n");

  const raw = await params.llm.complete({
    tier: "light",
    temperature: 0.2,
    messages: [
      { role: "system", content: CONSENSUS_COMPRESS_SYSTEM },
      {
        role: "user",
        content: `## 当前写作初衷\n${JSON.stringify(params.currentIntent, null, 2)}\n\n## 本轮诊断摘要\n${params.round.diagnosis_markdown.slice(0, 1500)}\n\n## 本轮对话记录\n${transcript}`,
      },
    ],
  });

  const parsed = parseLLMJson<Partial<SettlePreview>>(raw);
  const updatedIntent: WritingIntent = {
    raw_note:
      parsed.updated_writing_intent?.raw_note ?? params.currentIntent.raw_note,
    trigger:
      parsed.updated_writing_intent?.trigger ?? params.currentIntent.trigger,
    target_audience:
      parsed.updated_writing_intent?.target_audience ??
      params.currentIntent.target_audience,
    desired_effect:
      parsed.updated_writing_intent?.desired_effect ??
      params.currentIntent.desired_effect,
  };

  return {
    updated_writing_intent: updatedIntent,
    intent_changed: Boolean(parsed.intent_changed),
    agreed_consensus: Array.isArray(parsed.agreed_consensus)
      ? parsed.agreed_consensus.filter((s): s is string => typeof s === "string")
      : [],
    rejected_suggestions: Array.isArray(parsed.rejected_suggestions)
      ? parsed.rejected_suggestions.filter(
          (s): s is string => typeof s === "string"
        )
      : [],
    draft_diff_summary: diffStr,
  };
}
