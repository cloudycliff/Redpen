import { useRef, useState } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  Copy,
  Crosshair,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ArchiveExtractionPreview,
  ArticleDetail,
  FindingStatus,
  RiskSeverity,
  StanceRecord,
} from "@writing/core/types";
import { api } from "../../api/client";

interface StagePublishGateProps {
  article: ArticleDetail;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

const SEVERITY_STYLE: Record<RiskSeverity, { label: string; cls: string }> = {
  high: { label: "高风险", cls: "bg-rose-100 text-rose-800 border-rose-300" },
  medium: {
    label: "中风险",
    cls: "bg-amber-100 text-amber-900 border-amber-300",
  },
  low: { label: "低风险", cls: "bg-stone-100 text-stone-700 border-stone-300" },
};

export function StagePublishGate({
  article,
  onRefresh,
  onError,
  onNotify,
}: StagePublishGateProps) {
  const slug = article.meta.slug;
  const [title, setTitle] = useState(
    article.meta.title || article.meta.working_title
  );
  const [body, setBody] = useState(article.current_draft);
  const [angleHint, setAngleHint] = useState("");
  const [generatingTitles, setGeneratingTitles] = useState(false);
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [locatingQuote, setLocatingQuote] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Finalize & Archive preview modal state
  const [loadingFinalize, setLoadingFinalize] = useState(false);
  const [finalizePreview, setFinalizePreview] =
    useState<ArchiveExtractionPreview | null>(null);
  const [existingStances, setExistingStances] = useState<StanceRecord[]>([]);
  const [selectedStances, setSelectedStances] = useState<boolean[]>([]);
  const [selectedExps, setSelectedExps] = useState<boolean[]>([]);
  const [committingFinalize, setCommittingFinalize] = useState(false);

  const persistEdits = async () => {
    await api.updateArticleMeta(slug, { title: title.trim() });
    await api.saveDraft(slug, article.meta.current_draft_version, body);
  };

  const handleGenerateTitles = async () => {
    setGeneratingTitles(true);
    try {
      await persistEdits();
      await api.generateTitles(slug, angleHint.trim() || undefined);
      await onRefresh();
      onNotify("已生成多角度候选标题");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingTitles(false);
    }
  };

  const handleSelectTitle = async (id: string, candidateTitle: string) => {
    setTitle(candidateTitle);
    try {
      await api.updateArticleMeta(slug, { selected_title_id: id });
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRunCompliance = async () => {
    setCheckingCompliance(true);
    try {
      await persistEdits();
      await api.runCompliance(slug);
      await onRefresh();
      onNotify("双重合规与隐私审查已完成");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingCompliance(false);
    }
  };

  const handleFindingStatus = async (
    findingId: string,
    status: FindingStatus
  ) => {
    try {
      await api.updateFindingStatus(slug, findingId, status);
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLocateQuote = (quote: string) => {
    if (!quote) return;
    setLocatingQuote(quote);
    const el = textareaRef.current;
    if (!el) return;
    const idx = body.indexOf(quote);
    if (idx !== -1) {
      el.focus();
      el.setSelectionRange(idx, idx + quote.length);
      // Approximate scroll position
      const ratio = idx / Math.max(1, body.length);
      el.scrollTop = Math.max(0, el.scrollHeight * ratio - 120);
    } else {
      onNotify("未在当前正文中精确命中该原句（可能已被你修改）");
    }
  };

  const handleOpenFinalize = async () => {
    setLoadingFinalize(true);
    try {
      await persistEdits();
      const res = await api.previewFinalize(slug);
      setFinalizePreview(res.preview);
      setExistingStances(res.existing_stances);
      setSelectedStances(res.preview.stances.map(() => true));
      setSelectedExps(res.preview.experiences.map(() => true));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFinalize(false);
    }
  };

  const handleCommitFinalize = async () => {
    if (!finalizePreview) return;
    setCommittingFinalize(true);
    try {
      const stances = finalizePreview.stances
        .filter((_, idx) => selectedStances[idx])
        .map((s) => ({
          topic: s.topic,
          core_judgment: s.core_judgment,
          reasoning: s.reasoning,
          tags: s.tags,
          supersedes:
            s.relation === "revises" || s.relation === "contradicts"
              ? s.related_stance_id
              : null,
        }));

      const experiences = finalizePreview.experiences.filter(
        (_, idx) => selectedExps[idx]
      );

      await api.commitFinalize(slug, {
        title: title.trim() || article.meta.working_title,
        final_body: body,
        stances,
        experiences,
      });

      setFinalizePreview(null);
      await onRefresh();
      onNotify("定稿已保存至 final.md，并成功沉淀到个人档案馆！");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommittingFinalize(false);
    }
  };

  const copyFinalMarkdown = async () => {
    const md =
      article.final_markdown ||
      `# ${title.trim() || article.meta.working_title}\n\n${body.trim()}\n`;
    await navigator.clipboard.writeText(md);
    onNotify("已复制公众号长文 Markdown 到剪贴板");
  };

  const openRiskCount =
    article.compliance?.findings.filter((f) => f.status === "open").length ?? 0;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left Pane: Editable Final Title & Body */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#E7E4DC] bg-[#FCFBF8]">
        {article.meta.stage === "finalized" && (
          <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-950">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={15} className="text-emerald-700" />
              <span>
                本篇已定稿归档至 vault/articles/{slug}/final.md
              </span>
            </div>
            <button
              onClick={copyFinalMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-700 text-white hover:bg-emerald-800 font-medium"
            >
              <Copy size={13} /> 复制 Markdown
            </button>
          </div>
        )}

        <div className="px-6 pt-5 pb-3 border-b border-[#E7E4DC] bg-white">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#78716C] mb-1">
            公众号定稿标题
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void persistEdits()}
            placeholder="从右侧挑选候选标题，或直接在这里微调定稿标题..."
            className="w-full text-xl font-semibold text-[#1F1E1C] bg-transparent focus:outline-none placeholder:text-[#A8A29E]"
          />
        </div>

        {locatingQuote && (
          <div className="px-6 py-2 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-900">
            <span className="truncate">
              已定位风险句：「{locatingQuote}」（你可以直接在下方脱敏修改，改完后右侧点「改完复检」）
            </span>
            <button
              onClick={() => setLocatingQuote("")}
              className="text-rose-700 hover:text-rose-950 shrink-0 ml-2"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="max-w-2xl mx-auto h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => void persistEdits()}
              className="flex-1 w-full min-h-[460px] bg-transparent prose-editor text-[16px] text-[#1F1E1C] focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E7E4DC] bg-white text-xs text-[#78716C]">
          <span>{body.replace(/\s+/g, "").length} 字</span>
          <button
            onClick={copyFinalMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D3CB] text-[#292524] hover:bg-[#FAF9F5]"
          >
            <Copy size={13} /> 复制当前 Markdown
          </button>
        </div>
      </div>

      {/* Right Pane: Title Co-creation + Compliance & Privacy Gate */}
      <div className="w-[440px] xl:w-[490px] shrink-0 flex flex-col bg-white min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 1. Title Co-creation */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-[#1F1E1C]">
                  1. 标题共创
                </h3>
                <p className="text-[11px] text-[#78716C]">
                  系统唯一允许给成品候选的环节，围绕已锁定的承重句多角度切入
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={angleHint}
                onChange={(e) => setAngleHint(e.target.value)}
                placeholder="可选：补充期望风格（如“克制冷静”“带一点反常识”）"
                className="flex-1 rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B45309]"
              />
              <button
                onClick={handleGenerateTitles}
                disabled={generatingTitles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50 shrink-0"
              >
                {generatingTitles ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                {article.meta.title_candidates.length > 0
                  ? "重新生成"
                  : "生成候选标题"}
              </button>
            </div>

            <div className="space-y-2">
              {article.meta.title_candidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D6D3CB] p-4 text-center text-xs text-[#78716C]">
                  点击「生成候选标题」，为你拟出 6 个不同切入角度的公众号长文标题。
                </div>
              ) : (
                article.meta.title_candidates.map((tc) => (
                  <div
                    key={tc.id}
                    className={`rounded-lg border p-3 transition ${
                      tc.selected
                        ? "border-amber-400 bg-amber-50/60"
                        : "border-[#E7E4DC] bg-[#FAF9F5] hover:border-[#C7C2B8]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-white border border-[#E7E4DC] text-[10px] font-medium text-[#57534E] mb-1">
                          {tc.angle}
                        </span>
                        <div className="text-sm font-medium text-[#1F1E1C] leading-snug">
                          {tc.title}
                        </div>
                        {tc.explanation && (
                          <p className="text-[11px] text-[#78716C] mt-1">
                            {tc.explanation}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleSelectTitle(tc.id, tc.title)}
                        className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 transition ${
                          tc.selected
                            ? "bg-amber-700 text-white"
                            : "bg-white border border-[#D6D3CB] text-[#292524] hover:bg-[#1F1E1C] hover:text-white"
                        }`}
                      >
                        {tc.selected ? "已选用" : "选为标题"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 2. Compliance & Privacy Dual Gate */}
          <section className="pt-4 border-t border-[#E7E4DC]">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div>
                <h3 className="text-sm font-semibold text-[#1F1E1C] flex items-center gap-1.5">
                  <ShieldAlert size={15} className="text-rose-700" />
                  2. 双重合规与隐私审查
                </h3>
                <p className="text-[11px] text-[#78716C]">
                  独立审查：平台违法违规雷区 + 个人/公司直接与隐性反推隐私风险
                </p>
              </div>
              <button
                onClick={handleRunCompliance}
                disabled={checkingCompliance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50 shrink-0"
              >
                {checkingCompliance ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                {article.compliance ? "改完复检" : "开始双检"}
              </button>
            </div>

            {!article.compliance ? (
              <div className="rounded-lg border border-dashed border-[#D6D3CB] p-4 text-center text-xs text-[#78716C]">
                发布前点击「开始双检」，排查违法违规表述及个人/公司信息泄露隐患。
              </div>
            ) : (
              <div className="space-y-2.5">
                <div
                  className={`rounded-lg px-3 py-2 text-xs border ${
                    openRiskCount === 0
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-amber-50 border-amber-200 text-amber-950"
                  }`}
                >
                  {article.compliance.summary}
                  {openRiskCount > 0 && `（尚有 ${openRiskCount} 处待处理）`}
                </div>

                {article.compliance.findings.map((f) => {
                  const sev = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.medium;
                  const done = f.status !== "open";
                  return (
                    <div
                      key={f.id}
                      className={`rounded-lg border p-3 text-xs space-y-1.5 transition ${
                        done
                          ? "border-[#E7E4DC] bg-stone-50 opacity-60"
                          : "border-[#D6D3CB] bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${sev.cls}`}
                          >
                            {f.dimension === "privacy" ? "隐私" : "合规"} ·{" "}
                            {sev.label}
                          </span>
                          {done && (
                            <span className="text-[11px] text-emerald-700 font-medium">
                              {f.status === "resolved" ? "✓ 已处理" : "已忽略"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {f.quote && (
                            <button
                              onClick={() => handleLocateQuote(f.quote)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F3F1EB] hover:bg-[#E7E4DC] text-[#292524]"
                            >
                              <Crosshair size={11} /> 定位
                            </button>
                          )}
                          {f.status === "open" ? (
                            <>
                              <button
                                onClick={() =>
                                  handleFindingStatus(f.id, "resolved")
                                }
                                className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                              >
                                已处理
                              </button>
                              <button
                                onClick={() =>
                                  handleFindingStatus(f.id, "ignored")
                                }
                                className="px-2 py-0.5 rounded text-[#78716C] hover:bg-stone-100"
                              >
                                忽略
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleFindingStatus(f.id, "open")}
                              className="text-[11px] text-[#78716C] underline"
                            >
                              重开
                            </button>
                          )}
                        </div>
                      </div>

                      {f.quote && (
                        <div className="rounded bg-[#FAF9F5] border border-[#E7E4DC] px-2.5 py-1.5 text-[#1F1E1C] font-medium">
                          「{f.quote}」
                        </div>
                      )}
                      <p className="text-[#44403C] leading-relaxed">
                        <span className="font-medium text-[#1F1E1C]">风险：</span>
                        {f.reason}
                      </p>
                      {f.direction && (
                        <p className="text-[#57534E] leading-relaxed">
                          <span className="font-medium text-[#1F1E1C]">
                            建议方向：
                          </span>
                          {f.direction}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sticky Finalize & Archive CTA */}
        <div className="p-4 border-t border-[#E7E4DC] bg-[#FAF9F5]">
          <button
            onClick={handleOpenFinalize}
            disabled={loadingFinalize}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50 transition"
          >
            {loadingFinalize ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Archive size={15} />
            )}
            <span>
              {loadingFinalize
                ? "正在提炼核心立场与个人经历..."
                : "定稿并沉淀立场档案"}
            </span>
          </button>
        </div>
      </div>

      {/* Finalize & Archive Confirmation Modal */}
      {finalizePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl bg-white border border-[#E7E4DC] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E7E4DC] bg-[#FAF9F5]">
              <div>
                <h3 className="text-base font-semibold text-[#1F1E1C]">
                  定稿确认 &amp; 沉淀个人写作主体档案
                </h3>
                <p className="text-xs text-[#78716C] mt-0.5">
                  勾选你认可的立场与经历写入本地 archive/，供未来写作自动对照与追踪立场演化
                </p>
              </div>
              <button
                onClick={() => setFinalizePreview(null)}
                className="p-1 rounded text-[#78716C] hover:text-[#1F1E1C]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-[#1F1E1C] mb-2">
                  提炼出的核心立场（{finalizePreview.stances.length}）
                </h4>
                {finalizePreview.stances.length === 0 ? (
                  <p className="text-xs text-[#78716C]">未提炼出新立场。</p>
                ) : (
                  <div className="space-y-2">
                    {finalizePreview.stances.map((s, idx) => {
                      const related = s.related_stance_id
                        ? existingStances.find(
                            (x) => x.id === s.related_stance_id
                          )
                        : null;
                      return (
                        <div
                          key={idx}
                          onClick={() =>
                            setSelectedStances(
                              selectedStances.map((v, i) =>
                                i === idx ? !v : v
                              )
                            )
                          }
                          className={`cursor-pointer rounded-lg border p-3 transition ${
                            selectedStances[idx]
                              ? "border-amber-300 bg-amber-50/40"
                              : "border-[#E7E4DC] opacity-60"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                selectedStances[idx]
                                  ? "bg-[#1F1E1C] border-[#1F1E1C] text-white"
                                  : "border-[#C7C2B8] bg-white"
                              }`}
                            >
                              {selectedStances[idx] && <Check size={11} />}
                            </div>
                            <div className="flex-1 min-w-0 text-xs space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-[#1F1E1C]">
                                  {s.topic}
                                </span>
                                {s.relation !== "new" && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-medium">
                                    {s.relation === "extends"
                                      ? "延续历史立场"
                                      : s.relation === "revises"
                                        ? "修正历史立场"
                                        : "推翻历史立场"}
                                  </span>
                                )}
                              </div>
                              <p className="text-[#1F1E1C] font-medium">
                                {s.core_judgment}
                              </p>
                              <p className="text-[#57534E]">{s.reasoning}</p>
                              {related && (
                                <p className="text-[11px] text-indigo-800 bg-indigo-50/60 rounded px-2 py-1">
                                  关联旧立场（{related.created_at}）：
                                  {related.core_judgment}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[#1F1E1C] mb-2">
                  提炼出的个人经历（{finalizePreview.experiences.length}）
                </h4>
                {finalizePreview.experiences.length === 0 ? (
                  <p className="text-xs text-[#78716C]">
                    本篇未检出新增可沉淀的具体个人经历。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {finalizePreview.experiences.map((e, idx) => (
                      <div
                        key={idx}
                        onClick={() =>
                          setSelectedExps(
                            selectedExps.map((v, i) => (i === idx ? !v : v))
                          )
                        }
                        className={`cursor-pointer rounded-lg border p-3 transition ${
                          selectedExps[idx]
                            ? "border-emerald-300 bg-emerald-50/40"
                            : "border-[#E7E4DC] opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 text-xs">
                          <div
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              selectedExps[idx]
                                ? "bg-[#1F1E1C] border-[#1F1E1C] text-white"
                                : "border-[#C7C2B8] bg-white"
                            }`}
                          >
                            {selectedExps[idx] && <Check size={11} />}
                          </div>
                          <div className="space-y-1">
                            <div className="font-semibold text-[#1F1E1C]">
                              {e.title}
                            </div>
                            <p className="text-[#292524]">{e.narrative}</p>
                            {e.cost_or_lesson && (
                              <p className="text-[#57534E]">
                                代价与教训：{e.cost_or_lesson}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#E7E4DC] bg-[#FAF9F5]">
              <button
                onClick={() => setFinalizePreview(null)}
                disabled={committingFinalize}
                className="px-3.5 py-1.5 rounded-lg text-sm text-[#57534E] hover:bg-[#E7E4DC]/60"
              >
                取消
              </button>
              <button
                onClick={handleCommitFinalize}
                disabled={committingFinalize}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50"
              >
                {committingFinalize ? "归档中..." : "确认定稿并写入档案"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
