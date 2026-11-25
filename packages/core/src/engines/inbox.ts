import crypto from "node:crypto";
import type { Fragment, TopicCluster } from "../types.js";
import type { LLMClient } from "../llm/client.js";
import { parseLLMJson } from "../llm/json.js";
import {
  FRAGMENT_CLUSTER_SYSTEM,
  FRAGMENT_INGEST_SYSTEM,
} from "../prompts/templates.js";

export interface FragmentIngestResult {
  suggested_title: string;
  tags: string[];
  summary: string;
  candidate_load_bearing: string[];
  candidate_experiences: string[];
}

export async function analyzeFragment(
  llm: LLMClient,
  content: string
): Promise<FragmentIngestResult> {
  const raw = await llm.complete({
    tier: "light",
    temperature: 0.2,
    messages: [
      { role: "system", content: FRAGMENT_INGEST_SYSTEM },
      { role: "user", content: `原始口述稿：\n\n${content}` },
    ],
  });

  const parsed = parseLLMJson<Partial<FragmentIngestResult>>(raw);
  const candidates = Array.isArray(parsed.candidate_load_bearing)
    ? parsed.candidate_load_bearing.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0
      )
    : [];

  return {
    suggested_title:
      typeof parsed.suggested_title === "string" && parsed.suggested_title.trim()
        ? parsed.suggested_title.trim().slice(0, 18)
        : content.split(/\r?\n/)[0]?.trim().slice(0, 14) || "口述碎片",
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === "string").slice(0, 5)
      : [],
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    candidate_load_bearing: candidates.slice(0, 3),
    candidate_experiences: Array.isArray(parsed.candidate_experiences)
      ? parsed.candidate_experiences.filter(
          (e): e is string => typeof e === "string" && e.trim().length > 0
        )
      : [],
  };
}

export async function detectTopicClusters(
  llm: LLMClient,
  fragments: Fragment[]
): Promise<TopicCluster[]> {
  const eligible = fragments
    .filter((f) => f.status !== "archived")
    .slice(0, 50);

  if (eligible.length < 2) return [];

  const compactIndex = eligible.map((f) => ({
    id: f.id,
    title: f.title,
    tags: f.tags,
    summary: f.summary || f.content.slice(0, 90),
    created_at: f.created_at.slice(0, 10),
  }));

  const raw = await llm.complete({
    tier: "light",
    temperature: 0.2,
    messages: [
      { role: "system", content: FRAGMENT_CLUSTER_SYSTEM },
      {
        role: "user",
        content: `碎片索引列表：\n${JSON.stringify(compactIndex, null, 2)}`,
      },
    ],
  });

  const parsed = parseLLMJson<{
    clusters?: Array<{
      topic: string;
      reason: string;
      fragment_ids: string[];
    }>;
  }>(raw);

  const validIds = new Set(eligible.map((f) => f.id));
  const clusters: TopicCluster[] = [];

  for (const c of parsed.clusters ?? []) {
    const ids = Array.isArray(c.fragment_ids)
      ? c.fragment_ids.filter((id) => validIds.has(id))
      : [];
    if (ids.length >= 2 && c.topic) {
      clusters.push({
        id: `cluster-${crypto.randomBytes(2).toString("hex")}`,
        topic: c.topic.trim(),
        reason: c.reason?.trim() || "",
        fragment_ids: ids,
      });
    }
  }

  return clusters;
}
