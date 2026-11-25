import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Edit3,
  GitCompare,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Send,
  ShieldCheck,
  Square,
  Target,
  X,
} from "lucide-react";
import type {
  ArticleDetail,
  SettlePreview,
  TextDiffPart,
  WritingIntent,
} from "@writing/core/types";
import { api } from "../../api/client";
import { DraftDiffViewer } from "../../components/DraftDiffViewer";
import { SettleModal } from "../../components/SettleModal";

interface StageReviseLoopProps {
  article: ArticleDetail;
  onRefresh: () => Promise<void>;
  onGoPublish: () => Promise<void>;
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

const GHOSTWRITE_PATTERNS = [
  /你可以改成[：:]/,
  /建议改写为[：:]/,
  /范文如下[：:]/,
  /可以这样写[：:]\s*\n/,
];

function hasPotentialGhostwriting(text: string): boolean {
  return GHOSTWRITE_PATTERNS.some((re) => re.test(text));
}

export function StageReviseLoop({
  article,
  onRefresh,
  onGoPublish,
  onError,
  onNotify,
}: StageReviseLoopProps) {
  const slug = article.meta.slug;
  const currentVersion = article.meta.current_draft_version;
  const latestRoundNum = article.meta.current_round;

  // Left pane state
  const [viewingVersion, setViewingVersion] = useState(currentVersion);
  const [draftText, setDraftText] = useState(article.current_draft);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [diffMode, setDiffMode] = useState(false);
  const [diffParts, setDiffParts] = useState<TextDiffPart[]>([]);
  const [diffFromVersion, setDiffFromVersion] = useState(
    Math.max(1, currentVersion - 1)
  );
  const [refTab, setRefTab] = useState<null | "lb" | "map" | "raw">(null);

  // Always-visible Writing Intent anchor bar (3rd touchpoint)
  const [editingIntent, setEditingIntent] = useState(false);
  const [intentDraft, setIntentDraft] = useState(
    article.meta.writing_intent.raw_note || ""
  );

  // Text selection quote for asking Editor
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionQuote, setSelectionQuote] = useState("");
  const [attachedQuote, setAttachedQuote] = useState("");

  // Right pane: Round-based Editor dialogue
  const [activeRoundTab, setActiveRoundTab] = useState(
    latestRoundNum || article.rounds[article.rounds.length - 1]?.round || 1
  );
  const [diagnosisOpen, setDiagnosisOpen] = useState(true);
  const [streamingDiagnosis, setStreamingDiagnosis] = useState("");
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [streamingChat, setStreamingChat] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<{
    content: string;
    quote?: string;
  } | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Round settlement modal
  const [loadingSettle, setLoadingSettle] = useState(false);
  const [settlePreview, setSettlePreview] = useState<SettlePreview | null>(null);
  const [committingSettle, setCommittingSettle] = useState(false);

  // Sync when article version / round advances
  useEffect(() => {
    setViewingVersion(article.meta.current_draft_version);
    setDraftText(article.current_draft);
    setSaveState("saved");
    setActiveRoundTab(article.meta.current_round || 1);
    setIntentDraft(article.meta.writing_intent.raw_note || "");
    setDiffMode(false);
  }, [
    article.meta.slug,
    article.meta.current_draft_version,
    article.meta.current_round,
  ]);

  // Debounced auto-save for current active draft version
  useEffect(() => {
    if (viewingVersion !== currentVersion || saveState !== "dirty") return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        await api.saveDraft(slug, currentVersion, draftText);
        setSaveState("saved");
      } catch (err) {
        setSaveState("dirty");
        onError(err instanceof Error ? err.message : String(err));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [draftText, viewingVersion, currentVersion, saveState, slug]);

  const selectedRound = article.rounds.find((r) => r.round === activeRoundTab);

  // Auto-trigger diagnosis once when entering a fresh active round with empty diagnosis
  const autoTriggeredRef = useRef<string>("");
  useEffect(() => {
    if (
      selectedRound &&
      selectedRound.status === "active" &&
      !selectedRound.diagnosis_markdown &&
      !isDiagnosing
    ) {
      const key = `${slug}-r${selectedRound.round}`;
      if (autoTriggeredRef.current !== key) {
        autoTriggeredRef.current = key;
        void runDiagnosis(selectedRound.round);
      }
    }
  }, [selectedRound?.round, selectedRound?.diagnosis_markdown, slug]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedRound?.messages.length, streamingChat, pendingUserMessage]);

  const flushCurrentDraft = async () => {
    if (viewingVersion === currentVersion && saveState === "dirty") {
      await api.saveDraft(slug, currentVersion, draftText);
      setSaveState("saved");
    }
  };

  const handleSelectVersion = async (v: number) => {
    await flushCurrentDraft();
    setDiffMode(false);
    setViewingVersion(v);
    if (v === currentVersion) {
      const res = await api.getDraft(slug, v);
      setDraftText(res.content);
    } else {
      const res = await api.getDraft(slug, v);
      setDraftText(res.content);
    }
    setSaveState("saved");
  };

  const handleToggleDiff = async () => {
    if (diffMode) {
      setDiffMode(false);
      return;
    }
    await flushCurrentDraft();
    const fromV = Math.max(1, viewingVersion - 1);
    const toV = viewingVersion === 1 && currentVersion > 1 ? 2 : viewingVersion;
    const actualFrom = fromV === toV ? Math.max(1, toV - 1) : fromV;
    setDiffFromVersion(actualFrom);
    try {
      const res = await api.getDraftDiff(slug, actualFrom, toV);
      setDiffParts(res.parts);
      setDiffMode(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEditorSelect = () => {
    const el = editorRef.current;
    if (!el) return;
    const selected = el.value.slice(el.selectionStart, el.selectionEnd).trim();
    if (selected.length >= 6 && selected.length <= 400) {
      setSelectionQuote(selected);
    } else {
      setSelectionQuote("");
    }
  };

  const saveIntent = async () => {
    try {
      await api.updateArticleMeta(slug, {
        writing_intent: { raw_note: intentDraft.trim() },
      });
      await onRefresh();
      setEditingIntent(false);
      onNotify("写作初衷已更新");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const stopStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsDiagnosing(false);
    setIsChatting(false);
  };

  const runDiagnosis = async (roundNum: number) => {
    await flushCurrentDraft();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsDiagnosing(true);
    setStreamingDiagnosis("");
    setDiagnosisOpen(true);

    await api.streamDiagnose(slug, roundNum, {
      signal: controller.signal,
      onDelta: (delta) => setStreamingDiagnosis((prev) => prev + delta),
      onDone: async () => {
        setIsDiagnosing(false);
        setStreamingDiagnosis("");
        await onRefresh();
      },
      onError: (msg) => {
        setIsDiagnosing(false);
        onError(msg);
      },
    });
  };

  const handleSendChat = async () => {
    if (!selectedRound || !chatInput.trim() || isChatting) return;
    await flushCurrentDraft();
    const messageText = chatInput.trim();
    const quoteText = attachedQuote.trim() || undefined;

    setChatInput("");
    setAttachedQuote("");
    setPendingUserMessage({ content: messageText, quote: quoteText });
    setStreamingChat("");
    setIsChatting(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    await api.streamRoundChat(
      slug,
      selectedRound.round,
      { message: messageText, quote: quoteText },
      {
        signal: controller.signal,
        onDelta: (delta) => setStreamingChat((prev) => prev + delta),
        onDone: async () => {
          setIsChatting(false);
          setStreamingChat("");
          setPendingUserMessage(null);
          await onRefresh();
        },
        onError: (msg) => {
          setIsChatting(false);
          setPendingUserMessage(null);
          onError(msg);
        },
      }
    );
  };

  const handleOpenSettle = async () => {
    await flushCurrentDraft();
    setLoadingSettle(true);
    try {
      const { preview } = await api.previewSettleRound(slug, draftText);
      setSettlePreview(preview);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSettle(false);
    }
  };

  const handleConfirmSettle = async (data: {
    agreed_consensus: string[];
    rejected_suggestions: string[];
    updated_writing_intent: WritingIntent;
  }) => {
    setCommittingSettle(true);
    try {
      await api.commitSettleRound(slug, {
        next_draft: draftText,
        agreed_consensus: data.agreed_consensus,
        rejected_suggestions: data.rejected_suggestions,
        updated_writing_intent: data.updated_writing_intent,
      });
      setSettlePreview(null);
      await onRefresh();
      onNotify(`已提交 v${currentVersion + 1}，进入 Round ${latestRoundNum + 1}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommittingSettle(false);
    }
  };

  const lockedLb = article.meta.load_bearing_sentences.filter((s) => s.locked);
  const displayedDiagnosis =
    isDiagnosing && selectedRound?.round === activeRoundTab
      ? streamingDiagnosis
      : selectedRound?.diagnosis_markdown || "";
  const intentDisplay =
    article.meta.writing_intent.raw_note ||
    article.meta.writing_intent.trigger ||
    "";
  const charCount = draftText.replace(/\s+/g, "").length;
  const isReadOnlyVersion = viewingVersion !== currentVersion;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* LEFT PANE: Fixed Draft Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#E7E4DC] bg-[#FCFBF8]">
        {/* Version & Reference toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#E7E4DC] bg-white">
          <div className="flex items-center gap-1.5 flex-wrap">
            {article.draft_versions.map((v) => (
              <button
                key={v}
                onClick={() => handleSelectVersion(v)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  viewingVersion === v && !diffMode
                    ? "bg-[#1F1E1C] text-white"
                    : "bg-[#F3F1EB] text-[#57534E] hover:bg-[#E7E4DC]"
                }`}
              >
                v{v}
                {v === currentVersion ? " ●" : ""}
              </button>
            ))}

            {article.draft_versions.length >= 2 && (
              <button
                onClick={handleToggleDiff}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition border ${
                  diffMode
                    ? "bg-amber-50 text-amber-900 border-amber-300 font-medium"
                    : "bg-white text-[#57534E] border-[#D6D3CB] hover:bg-[#FAF9F5]"
                }`}
              >
                <GitCompare size={13} />
                {diffMode
                  ? "返回编辑"
                  : `对比 v${Math.max(1, viewingVersion - 1)}→v${viewingVersion === 1 ? 2 : viewingVersion}`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {(
              [
                { id: "lb", label: `承重句(${lockedLb.length})` },
                { id: "map", label: "脉络图" },
                { id: "raw", label: "原口述" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setRefTab(refTab === t.id ? null : t.id)}
                className={`px-2 py-1 rounded text-xs transition ${
                  refTab === t.id
                    ? "bg-amber-100 text-amber-950 font-medium"
                    : "text-[#78716C] hover:bg-[#F3F1EB] hover:text-[#1F1E1C]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Always-visible Writing Intent Anchor Bar (3rd touchpoint) */}
        <div className="px-5 py-2 border-b border-amber-200/70 bg-amber-50/50">
          {editingIntent ? (
            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                value={intentDraft}
                onChange={(e) => setIntentDraft(e.target.value)}
                placeholder="一句话写明触发场景和目标读者..."
                className="flex-1 rounded border border-amber-300 bg-white px-2.5 py-1 text-xs text-[#1F1E1C] focus:outline-none focus:border-amber-600"
              />
              <button
                onClick={saveIntent}
                className="px-2.5 py-1 rounded bg-[#1F1E1C] text-white text-xs shrink-0"
              >
                保存
              </button>
              <button
                onClick={() => setEditingIntent(false)}
                className="px-2 py-1 text-xs text-[#57534E] shrink-0"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Target size={13} className="text-amber-700 shrink-0" />
                <span className="text-xs font-medium text-amber-950 shrink-0">
                  写作初衷：
                </span>
                <span className="text-xs text-[#44403C] truncate">
                  {intentDisplay || "未填写（点击右侧随时补充，或在和主编聊天时补出）"}
                </span>
              </div>
              <button
                onClick={() => {
                  setIntentDraft(intentDisplay);
                  setEditingIntent(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-950 font-medium shrink-0"
              >
                <Edit3 size={11} /> {intentDisplay ? "改" : "+ 补充"}
              </button>
            </div>
          )}
        </div>

        {/* Optional Collapsible Reference Drawer */}
        {refTab && (
          <div className="max-h-48 overflow-y-auto px-5 py-3 border-b border-[#E7E4DC] bg-[#F5F3EC] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#292524]">
                {refTab === "lb"
                  ? "已锁定的承重句"
                  : refTab === "map"
                    ? "初始现状脉络图"
                    : "原始口述稿（只读）"}
              </span>
              <button
                onClick={() => setRefTab(null)}
                className="text-[#78716C] hover:text-[#1F1E1C]"
              >
                <X size={14} />
              </button>
            </div>
            {refTab === "lb" && (
              <ul className="space-y-1.5">
                {lockedLb.length === 0 ? (
                  <li className="text-[#78716C]">尚未锁定承重句。</li>
                ) : (
                  lockedLb.map((s) => (
                    <li
                      key={s.id}
                      className="bg-white rounded px-2.5 py-1.5 border border-[#E7E4DC] text-[#1F1E1C]"
                    >
                      「{s.text}」
                    </li>
                  ))
                )}
              </ul>
            )}
            {refTab === "map" && (
              <div className="space-y-1">
                {article.structure_map?.blocks.map((b, i) => (
                  <div key={b.id} className="text-[#44403C]">
                    <span className="font-medium text-[#1F1E1C]">
                      {i + 1}. {b.paragraph_range}：
                    </span>
                    {b.summary}
                    {b.issue_note && (
                      <span className="text-rose-700 ml-1">
                        （⚠ {b.issue_note}）
                      </span>
                    )}
                  </div>
                )) || <p className="text-[#78716C]">暂无脉络图。</p>}
              </div>
            )}
            {refTab === "raw" && (
              <p className="whitespace-pre-wrap text-[#57534E] leading-relaxed">
                {article.raw_source}
              </p>
            )}
          </div>
        )}

        {/* Editor or Diff Canvas */}
        <div className="flex-1 overflow-y-auto px-6 py-5 relative">
          {diffMode ? (
            <div className="max-w-2xl mx-auto">
              <DraftDiffViewer
                fromVersion={diffFromVersion}
                toVersion={
                  viewingVersion === 1 && currentVersion > 1 ? 2 : viewingVersion
                }
                parts={diffParts}
              />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto h-full flex flex-col">
              {selectionQuote && (
                <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 rounded-lg bg-[#1F1E1C] text-white px-3 py-1.5 text-xs shadow-md">
                  <span className="truncate">
                    已选段落：「{selectionQuote.slice(0, 42)}
                    {selectionQuote.length > 42 ? "…" : ""}」
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setAttachedQuote(selectionQuote);
                        setSelectionQuote("");
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium"
                    >
                      <MessageSquareQuote size={12} /> 引用此段问主编
                    </button>
                    <button
                      onClick={() => setSelectionQuote("")}
                      className="text-stone-300 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {isReadOnlyVersion && (
                <div className="mb-3 rounded-lg bg-stone-100 border border-stone-200 px-3 py-2 text-xs text-stone-700 flex items-center justify-between">
                  <span>正在回看历史版本 v{viewingVersion}（只读）</span>
                  <button
                    onClick={() => handleSelectVersion(currentVersion)}
                    className="underline font-medium text-[#1F1E1C]"
                  >
                    回到当前最新稿 v{currentVersion}
                  </button>
                </div>
              )}

              <textarea
                ref={editorRef}
                value={draftText}
                readOnly={isReadOnlyVersion}
                onSelect={handleEditorSelect}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  setSaveState("dirty");
                }}
                placeholder="在这里亲手改稿。参考右侧主编诊断与对话，保持你自己的语气与承重句..."
                className="flex-1 w-full min-h-[460px] bg-transparent prose-editor text-[16px] text-[#1F1E1C] focus:outline-none resize-none"
              />
            </div>
          )}
        </div>

        {/* Bottom Editor Action Bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#E7E4DC] bg-white">
          <div className="text-xs text-[#78716C] flex items-center gap-3">
            <span>{charCount} 字</span>
            <span>
              {saveState === "saving"
                ? "保存中..."
                : saveState === "dirty"
                  ? "未保存变动"
                  : "已自动保存"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSettle}
              disabled={loadingSettle || isReadOnlyVersion}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50 transition"
            >
              {loadingSettle ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ArrowRight size={13} />
              )}
              保存并提交 v{currentVersion + 1}
            </button>
            <button
              onClick={async () => {
                await flushCurrentDraft();
                await onGoPublish();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border border-[#D6D3CB] bg-[#FAF9F5] text-[#1F1E1C] hover:bg-[#F3F1EB] transition"
            >
              <ShieldCheck size={13} /> 进入标题与合规
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Round-based Editor Dialogue */}
      <div className="w-[440px] xl:w-[490px] shrink-0 flex flex-col bg-white min-h-0">
        {/* Round tabs */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#E7E4DC] bg-[#FAF9F5]">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {article.rounds.map((r) => (
              <button
                key={r.round}
                onClick={() => setActiveRoundTab(r.round)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition ${
                  activeRoundTab === r.round
                    ? "bg-white text-[#1F1E1C] shadow-xs border border-[#D6D3CB]"
                    : "text-[#78716C] hover:text-[#1F1E1C]"
                }`}
              >
                Round {r.round}
                {r.status === "settled" ? " (已结算)" : " ●"}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-[#78716C] shrink-0">
            主编 · 风格 A（不给范文）
          </span>
        </div>

        {/* Scrollable Diagnosis + Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedRound && (
            <>
              {/* Settled consensus banner for historical rounds */}
              {selectedRound.status === "settled" &&
                (selectedRound.agreed_consensus.length > 0 ||
                  selectedRound.rejected_suggestions.length > 0) && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs space-y-1.5">
                    <div className="font-semibold text-emerald-950">
                      本轮已结算共识
                    </div>
                    {selectedRound.agreed_consensus.map((c, i) => (
                      <div key={i} className="text-emerald-900">
                        ✓ {c}
                      </div>
                    ))}
                    {selectedRound.rejected_suggestions.map((r, i) => (
                      <div key={i} className="text-stone-600">
                        ✕ 作者保留原判：{r}
                      </div>
                    ))}
                  </div>
                )}

              {/* Diagnosis Card */}
              <div className="rounded-xl border border-[#E7E4DC] bg-[#FAF9F5] overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#E7E4DC] bg-[#F3F1EB]/70">
                  <button
                    onClick={() => setDiagnosisOpen(!diagnosisOpen)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1E1C]"
                  >
                    {diagnosisOpen ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    <span>
                      本轮诊断书（基于 v{selectedRound.draft_version}）
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isDiagnosing ? (
                      <button
                        onClick={stopStream}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[11px]"
                      >
                        <Square size={10} /> 停止
                      </button>
                    ) : (
                      selectedRound.status === "active" && (
                        <button
                          onClick={() => runDiagnosis(selectedRound.round)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[#57534E] hover:bg-white border border-transparent hover:border-[#D6D3CB]"
                          title="重新生成本轮诊断"
                        >
                          <RefreshCw size={11} />
                          {displayedDiagnosis ? "重跑诊断" : "生成诊断"}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {diagnosisOpen && (
                  <div className="p-3.5 text-[13px] text-[#292524]">
                    {displayedDiagnosis ? (
                      <>
                        {hasPotentialGhostwriting(displayedDiagnosis) && (
                          <div className="mb-2.5 flex items-center gap-1.5 rounded bg-amber-100/80 px-2.5 py-1.5 text-[11px] text-amber-950">
                            <AlertCircle size={13} className="shrink-0" />
                            <span>
                              提醒：检测到疑似范文句式，请保持警惕，可要求主编只给方向或重跑诊断。
                            </span>
                          </div>
                        )}
                        <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {displayedDiagnosis}
                          </ReactMarkdown>
                        </div>
                      </>
                    ) : isDiagnosing ? (
                      <div className="flex items-center gap-2 text-xs text-[#78716C] py-3">
                        <Loader2 size={14} className="animate-spin" />
                        <span>主编正在逐段透视并检索历史立场...</span>
                      </div>
                    ) : (
                      <div className="text-xs text-[#78716C] py-2">
                        点击右上角「生成诊断」开始 Round {selectedRound.round} 审稿。
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Free Discussion Thread */}
              <div className="space-y-3">
                {(selectedRound.messages.length > 0 || pendingUserMessage) && (
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] pt-1">
                    本轮自由讨论
                  </div>
                )}

                {selectedRound.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3.5 py-2.5 text-[13px] ${
                      m.role === "author"
                        ? "bg-[#1F1E1C] text-white ml-6"
                        : "bg-[#FAF9F5] border border-[#E7E4DC] text-[#1F1E1C] mr-3"
                    }`}
                  >
                    <div
                      className={`text-[10px] mb-1 font-medium ${
                        m.role === "author" ? "text-stone-400" : "text-amber-800"
                      }`}
                    >
                      {m.role === "author" ? "你" : "主编"}
                    </div>
                    {m.quote && (
                      <blockquote
                        className={`text-xs mb-2 pl-2 border-l-2 ${
                          m.role === "author"
                            ? "border-amber-500 text-stone-300"
                            : "border-stone-300 text-stone-600"
                        }`}
                      >
                        {m.quote}
                      </blockquote>
                    )}
                    {m.role === "editor" ? (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {m.content}
                      </p>
                    )}
                  </div>
                ))}

                {pendingUserMessage && (
                  <div className="rounded-xl px-3.5 py-2.5 text-[13px] bg-[#1F1E1C] text-white ml-6">
                    <div className="text-[10px] mb-1 font-medium text-stone-400">
                      你
                    </div>
                    {pendingUserMessage.quote && (
                      <blockquote className="text-xs mb-2 pl-2 border-l-2 border-amber-500 text-stone-300">
                        {pendingUserMessage.quote}
                      </blockquote>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {pendingUserMessage.content}
                    </p>
                  </div>
                )}

                {isChatting && (
                  <div className="rounded-xl px-3.5 py-2.5 text-[13px] bg-[#FAF9F5] border border-[#E7E4DC] text-[#1F1E1C] mr-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-amber-800">
                        主编（思考回应中）
                      </span>
                      <button
                        onClick={stopStream}
                        className="inline-flex items-center gap-1 text-[11px] text-rose-700 hover:underline"
                      >
                        <Square size={10} /> 停止
                      </button>
                    </div>
                    {streamingChat ? (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingChat}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <Loader2 size={14} className="animate-spin text-[#78716C]" />
                    )}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </>
          )}
        </div>

        {/* Chat Input Box */}
        <div className="p-3 border-t border-[#E7E4DC] bg-[#FAF9F5]">
          {selectedRound?.status === "settled" ? (
            <div className="text-center text-xs text-[#78716C] py-2">
              Round {selectedRound.round} 已结算归档，请切换到最新 Round{" "}
              {latestRoundNum} 继续讨论。
            </div>
          ) : (
            <div className="space-y-2">
              {attachedQuote && (
                <div className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-950">
                  <span className="line-clamp-2">
                    引用原文：「{attachedQuote}」
                  </span>
                  <button
                    onClick={() => setAttachedQuote("")}
                    className="text-amber-700 hover:text-amber-950 shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  placeholder="反驳主编、回答追问，或补充你没写进正文里的初衷与背景…（Ctrl+Enter 发送）"
                  className="flex-1 rounded-lg border border-[#D6D3CB] bg-white px-3 py-2 text-xs text-[#1F1E1C] leading-relaxed focus:outline-none focus:border-[#B45309] resize-none"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isChatting}
                  className="px-3 py-2 rounded-lg bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-40 transition shrink-0"
                  title="发送（Ctrl+Enter）"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Round Settlement Modal */}
      {settlePreview && (
        <SettleModal
          currentRound={latestRoundNum}
          currentVersion={currentVersion}
          preview={settlePreview}
          committing={committingSettle}
          onCancel={() => setSettlePreview(null)}
          onConfirm={handleConfirmSettle}
        />
      )}
    </div>
  );
}
