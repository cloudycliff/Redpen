import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import type {
  ArticleDetail,
  CleanPatchStatus,
  LoadBearingDimension,
  LoadBearingSentence,
  StructureIssueType,
} from "@writing/core/types";
import { api } from "../../api/client";
import { CleanDiffViewer } from "../../components/CleanDiffViewer";

interface StageCleanMapProps {
  article: ArticleDetail;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

const ISSUE_LABELS: Record<StructureIssueType, string> = {
  boundary_blur: "边界模糊",
  topic_drift: "主题漂移",
  perspective_jump: "视角跳切",
  disconnect: "前后脱节",
  loop_repeat: "重复绕圈",
};

const DIM_LABELS: Record<LoadBearingDimension, { label: string; cls: string }> = {
  sharp_judgment: {
    label: "锋利判断",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
  },
  personal_experience: {
    label: "个人经验",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  stance_revision: {
    label: "立场转向",
    cls: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
};

export function StageCleanMap({
  article,
  onRefresh,
  onError,
  onNotify,
}: StageCleanMapProps) {
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [highlightRange, setHighlightRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  // Explicit editable Writing Intent card
  const [editingIntent, setEditingIntent] = useState(false);
  const [intentDraft, setIntentDraft] = useState(
    article.meta.writing_intent.raw_note || ""
  );
  const [savingIntent, setSavingIntent] = useState(false);

  // Manual load-bearing sentence add
  const [addingLb, setAddingLb] = useState(false);
  const [newLbText, setNewLbText] = useState("");
  const [newLbDim, setNewLbDim] = useState<LoadBearingDimension>("sharp_judgment");

  const runCleanAndMap = async () => {
    setRunning(true);
    try {
      await api.runCleanAndMap(article.meta.slug);
      await onRefresh();
      onNotify("轻度清洗与现状脉络透视已完成");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const handleTogglePatch = async (patchId: string, status: CleanPatchStatus) => {
    try {
      await api.toggleCleanPatch(article.meta.slug, patchId, status);
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleBulkPatches = async (status: CleanPatchStatus) => {
    try {
      await api.bulkCleanPatches(article.meta.slug, status);
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const saveIntent = async () => {
    setSavingIntent(true);
    try {
      await api.updateArticleMeta(article.meta.slug, {
        writing_intent: { raw_note: intentDraft.trim() },
      });
      await onRefresh();
      setEditingIntent(false);
      onNotify("写作初衷已保存");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingIntent(false);
    }
  };

  const toggleLoadBearing = async (id: string) => {
    const next = article.meta.load_bearing_sentences.map((s) =>
      s.id === id ? { ...s, locked: !s.locked } : s
    );
    try {
      await api.updateArticleMeta(article.meta.slug, {
        load_bearing_sentences: next,
      });
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const addLoadBearingSentence = async (
    text: string,
    dimension: LoadBearingDimension = "sharp_judgment"
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next: LoadBearingSentence[] = [
      ...article.meta.load_bearing_sentences,
      {
        id: `lb-manual-${Date.now()}`,
        text: trimmed,
        dimension,
        reason: "作者手动选定的承重句",
        locked: true,
      },
    ];
    try {
      await api.updateArticleMeta(article.meta.slug, {
        load_bearing_sentences: next,
      });
      await onRefresh();
      setNewLbText("");
      setAddingLb(false);
      onNotify("已添加到承重句清单");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleJumpToBlock = (start: number, end: number) => {
    setHighlightRange({ start, end });
    const el = document.getElementById(`clean-para-${start}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleConfirmCleaning = async () => {
    setConfirming(true);
    try {
      await api.confirmCleaning(article.meta.slug);
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirming(false);
    }
  };

  const patches = article.clean_diff?.patches ?? [];
  const acceptedCount = patches.filter((p) => p.status === "accepted").length;
  const intentText =
    article.meta.writing_intent.raw_note ||
    article.meta.writing_intent.trigger ||
    "";

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left pane: Git-style Clean Diff */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#E7E4DC] bg-[#FCFBF8]">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-[#E7E4DC] bg-white">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-[#1F1E1C]">
              轻度清洗（Git 式逐处 Diff）
            </h2>
            {article.clean_diff && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3F1EB] text-[#57534E]">
                共 {patches.length} 处改动 · 已采纳 {acceptedCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {article.clean_diff && patches.length > 0 && (
              <>
                <button
                  onClick={() => handleBulkPatches("accepted")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                >
                  <CheckCheck size={13} /> 全部采纳
                </button>
                <button
                  onClick={() => handleBulkPatches("reverted")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                >
                  <RotateCcw size={13} /> 全部 Revert
                </button>
              </>
            )}
            <button
              onClick={runCleanAndMap}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50 transition"
            >
              {running ? (
                <Loader2 size={13} className="animate-spin" />
              ) : article.clean_diff ? (
                <RefreshCw size={13} />
              ) : (
                <Sparkles size={13} />
              )}
              {running
                ? "分析中..."
                : article.clean_diff
                  ? "重新透视"
                  : "开始轻度清洗 & 脉络透视"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!article.clean_diff ? (
            <div className="max-w-2xl mx-auto">
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 flex items-center justify-between gap-3">
                <span>
                  点击上方「开始轻度清洗 &amp; 脉络透视」，系统将仅修语音同音错字与明显漏标点（绝不改写句式），并拆出当前口述的结构脉络与候选承重句。
                </span>
              </div>
              <CleanDiffViewer
                sourceText={article.raw_source}
                patches={[]}
                highlightRange={highlightRange}
                onTogglePatch={handleTogglePatch}
                onSelectLoadBearing={(text) => addLoadBearingSentence(text)}
              />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <p className="text-xs text-[#78716C] mb-3">
                提示：点击任意高亮改动可单独 Revert 保留你的原始表达；在正文中划选任意句子可直接设为承重句。
              </p>
              <CleanDiffViewer
                sourceText={article.clean_diff.source_text}
                patches={patches}
                highlightRange={highlightRange}
                onTogglePatch={handleTogglePatch}
                onSelectLoadBearing={(text) => addLoadBearingSentence(text)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right pane: Writing Intent + Structure Map + Load-Bearing Sentences */}
      <div className="w-[420px] xl:w-[460px] shrink-0 flex flex-col bg-white min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 1. Explicit Writing Intent Card (2nd touchpoint) */}
          <section className="rounded-xl border border-amber-200/90 bg-amber-50/40 p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                <Target size={14} className="text-amber-700" />
                <span>写作初衷 / 触发场景</span>
              </div>
              {!editingIntent && (
                <button
                  onClick={() => {
                    setIntentDraft(intentText);
                    setEditingIntent(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-950 font-medium"
                >
                  <Edit3 size={12} /> {intentText ? "编辑" : "+ 补充"}
                </button>
              )}
            </div>

            {editingIntent ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={intentDraft}
                  onChange={(e) => setIntentDraft(e.target.value)}
                  placeholder="为什么突然想写这篇？主要说给谁听？想解决对方什么困惑？"
                  className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-xs text-[#1F1E1C] leading-relaxed focus:outline-none focus:border-amber-600"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingIntent(false)}
                    className="px-2.5 py-1 rounded text-xs text-[#57534E] hover:bg-stone-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={saveIntent}
                    disabled={savingIntent}
                    className="px-3 py-1 rounded text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50"
                  >
                    {savingIntent ? "保存中..." : "保存初衷"}
                  </button>
                </div>
              </div>
            ) : intentText ? (
              <p className="text-xs text-[#292524] leading-relaxed whitespace-pre-wrap">
                {intentText}
              </p>
            ) : (
              <p className="text-xs text-amber-900/75 leading-relaxed">
                尚未填写。补一句触发这件事的场景和想说给谁听，脉络透视和 Round 1 主编诊断会准得多（也可先跳过）。
              </p>
            )}
          </section>

          {/* 2. Structure Map */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#57534E]">
                现状脉络图（忠实还原 · 不补写）
              </h3>
              {highlightRange && (
                <button
                  onClick={() => setHighlightRange(null)}
                  className="text-[11px] text-[#78716C] hover:text-[#1F1E1C]"
                >
                  清除高亮
                </button>
              )}
            </div>

            {!article.structure_map ? (
              <div className="rounded-lg border border-dashed border-[#D6D3CB] p-4 text-center text-xs text-[#78716C]">
                运行「开始轻度清洗 &amp; 脉络透视」后，这里将忠实拆解你的口述层次与逻辑病灶。
              </div>
            ) : (
              <div className="space-y-2">
                {article.structure_map.blocks.map((blk, idx) => {
                  const isSelected =
                    highlightRange?.start === blk.start_paragraph &&
                    highlightRange?.end === blk.end_paragraph;
                  return (
                    <button
                      key={blk.id}
                      type="button"
                      onClick={() =>
                        handleJumpToBlock(blk.start_paragraph, blk.end_paragraph)
                      }
                      className={`w-full text-left rounded-lg border p-3 transition ${
                        isSelected
                          ? "border-amber-400 bg-amber-50/70"
                          : "border-[#E7E4DC] bg-[#FAF9F5] hover:border-[#C7C2B8]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-[#1F1E1C]">
                          {idx + 1}. {blk.paragraph_range}
                        </span>
                        {blk.issue_type && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle size={11} />
                            {ISSUE_LABELS[blk.issue_type]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#44403C] leading-relaxed">
                        {blk.summary}
                      </p>
                      {blk.issue_note && (
                        <p className="mt-1.5 text-[11px] text-rose-800 bg-rose-50/60 rounded px-2 py-1 leading-relaxed">
                          {blk.issue_note}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. Load-Bearing Sentences */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#57534E]">
                承重句清单（勾选锁定为核心骨架）
              </h3>
              <button
                onClick={() => setAddingLb(!addingLb)}
                className="inline-flex items-center gap-1 text-xs text-[#57534E] hover:text-[#1F1E1C]"
              >
                <Plus size={13} /> 手动添加
              </button>
            </div>

            {addingLb && (
              <div className="mb-3 rounded-lg border border-[#D6D3CB] bg-[#FAF9F5] p-3 space-y-2">
                <textarea
                  rows={2}
                  value={newLbText}
                  onChange={(e) => setNewLbText(e.target.value)}
                  placeholder="粘贴或输入一句你想用来撑起整篇文章的原话..."
                  className="w-full rounded border border-[#D6D3CB] bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#B45309]"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={newLbDim}
                    onChange={(e) =>
                      setNewLbDim(e.target.value as LoadBearingDimension)
                    }
                    className="rounded border border-[#D6D3CB] bg-white px-2 py-1 text-xs"
                  >
                    <option value="sharp_judgment">锋利判断</option>
                    <option value="personal_experience">个人经验</option>
                    <option value="stance_revision">立场转向</option>
                  </select>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAddingLb(false)}
                      className="px-2 py-1 text-xs text-[#57534E]"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => addLoadBearingSentence(newLbText, newLbDim)}
                      className="px-2.5 py-1 rounded text-xs bg-[#1F1E1C] text-white"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {article.meta.load_bearing_sentences.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D6D3CB] p-4 text-center text-xs text-[#78716C]">
                  暂无候选承重句，可运行上方透视自动识别，或在左栏正文划选添加。
                </div>
              ) : (
                article.meta.load_bearing_sentences.map((lb) => {
                  const dim = DIM_LABELS[lb.dimension] ?? DIM_LABELS.sharp_judgment;
                  return (
                    <div
                      key={lb.id}
                      onClick={() => toggleLoadBearing(lb.id)}
                      className={`cursor-pointer rounded-lg border p-3 transition ${
                        lb.locked
                          ? "border-amber-300 bg-amber-50/40"
                          : "border-[#E7E4DC] bg-white opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            lb.locked
                              ? "bg-[#1F1E1C] border-[#1F1E1C] text-white"
                              : "border-[#C7C2B8] bg-white"
                          }`}
                        >
                          {lb.locked && <Check size={11} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium mb-1 ${dim.cls}`}
                          >
                            {dim.label}
                          </span>
                          <p className="text-xs text-[#1F1E1C] font-medium leading-relaxed">
                            「{lb.text}」
                          </p>
                          {lb.reason && (
                            <p className="text-[11px] text-[#78716C] mt-1">
                              {lb.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Sticky Bottom CTA */}
        <div className="p-4 border-t border-[#E7E4DC] bg-[#FAF9F5]">
          <button
            onClick={handleConfirmCleaning}
            disabled={confirming}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50 transition"
          >
            {confirming ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ArrowRight size={15} />
            )}
            <span>确认底稿并进入 Round 1 审稿</span>
          </button>
        </div>
      </div>
    </div>
  );
}
