import type {
  ArchiveExtractionPreview,
  ArticleDetail,
  ArticleMeta,
  ArticleStage,
  ArticleSummary,
  CleanDiffState,
  CleanPatchStatus,
  ComplianceReport,
  ExperienceRecord,
  FindingStatus,
  Fragment,
  LoadBearingSentence,
  RoundRecord,
  SafeAppConfig,
  SettlePreview,
  StanceRecord,
  StructureMapData,
  TextDiffPart,
  TitleCandidate,
  TopicCluster,
  WritingIntent,
} from "@writing/core/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `请求失败 (HTTP ${res.status})`
    );
  }
  return data as T;
}

async function consumeSSE<TDone>(
  url: string,
  body: unknown,
  handlers: {
    onDelta: (delta: string) => void;
    onDone: (payload: TDone) => void;
    onError: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    handlers.onError(
      (err as { error?: string }).error || `流式请求失败 (HTTP ${res.status})`
    );
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentEvent = "message";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line === "") {
          currentEvent = "message";
          continue;
        }
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          const rawData = line.slice(5).trim();
          try {
            const parsed = JSON.parse(rawData);
            if (currentEvent === "delta" && typeof parsed.delta === "string") {
              handlers.onDelta(parsed.delta);
            } else if (currentEvent === "done") {
              handlers.onDone(parsed as TDone);
            } else if (currentEvent === "error") {
              handlers.onError(parsed.error || "生成出错");
            }
          } catch {
            // ignore partial chunk
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      handlers.onError(err instanceof Error ? err.message : String(err));
    }
  } finally {
    reader.releaseLock();
  }
}

export const api = {
  // Settings
  getSettings: () => request<SafeAppConfig>("/api/settings"),
  updateSettings: (payload: {
    vaultDir?: string;
    llm?: {
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      lightModel?: string;
    };
  }) =>
    request<SafeAppConfig>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  testSettings: () =>
    request<{ ok: boolean; model?: string; reply?: string; error?: string }>(
      "/api/settings/test",
      { method: "POST" }
    ),

  // Inbox
  listFragments: () => request<{ fragments: Fragment[] }>("/api/inbox"),
  createFragment: (payload: {
    content: string;
    title?: string;
    autoAnalyze?: boolean;
  }) =>
    request<{ fragment: Fragment; analyzeError: string | null }>("/api/inbox", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  analyzeFragment: (id: string) =>
    request<{ fragment: Fragment }>(`/api/inbox/${encodeURIComponent(id)}/analyze`, {
      method: "POST",
    }),
  detectClusters: () =>
    request<{ clusters: TopicCluster[] }>("/api/inbox/clusters", {
      method: "POST",
    }),
  deleteFragment: (id: string) =>
    request<{ ok: boolean }>(`/api/inbox/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  promoteFragments: (payload: {
    working_title: string;
    fragment_ids: string[];
    writing_intent?: Partial<WritingIntent>;
  }) =>
    request<{ article: ArticleDetail }>("/api/inbox/promote", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Articles
  listArticles: () => request<{ articles: ArticleSummary[] }>("/api/articles"),
  getArticle: (slug: string) =>
    request<{ article: ArticleDetail }>(
      `/api/articles/${encodeURIComponent(slug)}`
    ),
  deleteArticle: (slug: string) =>
    request<{ ok: boolean }>(`/api/articles/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }),
  updateArticleMeta: (
    slug: string,
    payload: {
      working_title?: string;
      title?: string;
      stage?: ArticleStage;
      writing_intent?: Partial<WritingIntent>;
      load_bearing_sentences?: LoadBearingSentence[];
      selected_title_id?: string;
    }
  ) =>
    request<{ meta: ArticleMeta }>(
      `/api/articles/${encodeURIComponent(slug)}/meta`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  // Stage 1: Clean & Map
  runCleanAndMap: (slug: string) =>
    request<{
      clean_diff: CleanDiffState;
      structure_map: StructureMapData;
      meta: ArticleMeta;
    }>(`/api/articles/${encodeURIComponent(slug)}/clean-and-map`, {
      method: "POST",
    }),
  toggleCleanPatch: (slug: string, patchId: string, status: CleanPatchStatus) =>
    request<{ clean_diff: CleanDiffState }>(
      `/api/articles/${encodeURIComponent(slug)}/clean-patches/${encodeURIComponent(patchId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    ),
  bulkCleanPatches: (slug: string, status: CleanPatchStatus) =>
    request<{ clean_diff: CleanDiffState }>(
      `/api/articles/${encodeURIComponent(slug)}/clean-patches/bulk`,
      {
        method: "POST",
        body: JSON.stringify({ status }),
      }
    ),
  confirmCleaning: (slug: string) =>
    request<{ article: ArticleDetail }>(
      `/api/articles/${encodeURIComponent(slug)}/confirm-cleaning`,
      { method: "POST" }
    ),

  // Stage 2: Drafts & Rounds
  getDraft: (slug: string, version: number) =>
    request<{ version: number; content: string }>(
      `/api/articles/${encodeURIComponent(slug)}/drafts/${version}`
    ),
  saveDraft: (slug: string, version: number, content: string) =>
    request<{ ok: boolean; version: number }>(
      `/api/articles/${encodeURIComponent(slug)}/drafts/${version}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      }
    ),
  getDraftDiff: (slug: string, from: number, to: number) =>
    request<{ from: number; to: number; parts: TextDiffPart[] }>(
      `/api/articles/${encodeURIComponent(slug)}/diff?from=${from}&to=${to}`
    ),
  streamDiagnose: (
    slug: string,
    round: number,
    handlers: {
      onDelta: (delta: string) => void;
      onDone: (payload: { round: RoundRecord }) => void;
      onError: (message: string) => void;
      signal?: AbortSignal;
    }
  ) =>
    consumeSSE<{ round: RoundRecord }>(
      `/api/articles/${encodeURIComponent(slug)}/rounds/${round}/diagnose`,
      {},
      handlers
    ),
  streamRoundChat: (
    slug: string,
    round: number,
    payload: { message: string; quote?: string },
    handlers: {
      onDelta: (delta: string) => void;
      onDone: (payload: { round: RoundRecord }) => void;
      onError: (message: string) => void;
      signal?: AbortSignal;
    }
  ) =>
    consumeSSE<{ round: RoundRecord }>(
      `/api/articles/${encodeURIComponent(slug)}/rounds/${round}/chat`,
      payload,
      handlers
    ),
  previewSettleRound: (slug: string, next_draft: string) =>
    request<{ preview: SettlePreview }>(
      `/api/articles/${encodeURIComponent(slug)}/rounds/settle-preview`,
      {
        method: "POST",
        body: JSON.stringify({ next_draft }),
      }
    ),
  commitSettleRound: (
    slug: string,
    payload: {
      next_draft: string;
      agreed_consensus: string[];
      rejected_suggestions: string[];
      updated_writing_intent?: WritingIntent;
    }
  ) =>
    request<{ article: ArticleDetail }>(
      `/api/articles/${encodeURIComponent(slug)}/rounds/settle-commit`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  // Stage 3 & 4: Titles, Compliance & Finalize
  generateTitles: (slug: string, angleHint?: string) =>
    request<{ title_candidates: TitleCandidate[]; meta: ArticleMeta }>(
      `/api/articles/${encodeURIComponent(slug)}/titles`,
      {
        method: "POST",
        body: JSON.stringify({ angleHint }),
      }
    ),
  runCompliance: (slug: string) =>
    request<{ compliance: ComplianceReport }>(
      `/api/articles/${encodeURIComponent(slug)}/compliance`,
      { method: "POST" }
    ),
  updateFindingStatus: (slug: string, findingId: string, status: FindingStatus) =>
    request<{ compliance: ComplianceReport }>(
      `/api/articles/${encodeURIComponent(slug)}/compliance/${encodeURIComponent(findingId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    ),
  previewFinalize: (slug: string) =>
    request<{
      preview: ArchiveExtractionPreview;
      existing_stances: StanceRecord[];
    }>(`/api/articles/${encodeURIComponent(slug)}/finalize/preview`, {
      method: "POST",
    }),
  commitFinalize: (
    slug: string,
    payload: {
      title: string;
      final_body: string;
      stances: Array<{
        topic: string;
        core_judgment: string;
        reasoning: string;
        tags: string[];
        supersedes?: string | null;
      }>;
      experiences: Array<{
        title: string;
        narrative: string;
        cost_or_lesson: string;
        tags: string[];
      }>;
    }
  ) =>
    request<{
      article: ArticleDetail;
      final_markdown: string;
      saved_stances: StanceRecord[];
      saved_experiences: ExperienceRecord[];
    }>(`/api/articles/${encodeURIComponent(slug)}/finalize/commit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Archive
  getArchive: () =>
    request<{ stances: StanceRecord[]; experiences: ExperienceRecord[] }>(
      "/api/archive"
    ),
  createStance: (payload: {
    topic: string;
    core_judgment: string;
    reasoning?: string;
    tags?: string[];
    supersedes?: string | null;
  }) =>
    request<{ stance: StanceRecord }>("/api/archive/stances", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createExperience: (payload: {
    title: string;
    narrative: string;
    cost_or_lesson?: string;
    tags?: string[];
  }) =>
    request<{ experience: ExperienceRecord }>("/api/archive/experiences", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
