import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Fragment, TopicCluster } from "@writing/core/types";
import { api } from "../api/client";
import { PromoteModal } from "../components/PromoteModal";

interface InboxViewProps {
  onOpenArticle: (slug: string) => void;
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

export function InboxView({
  onOpenArticle,
  onError,
  onNotify,
}: InboxViewProps) {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "raw">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Quick paste box
  const [pasteText, setPasteText] = useState("");
  const [saving, setSaving] = useState(false);

  // Clustering
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [clustering, setClustering] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Promote modal
  const [promoteTarget, setPromoteTarget] = useState<{
    defaultTitle: string;
    fragmentIds: string[];
  } | null>(null);
  const [promoting, setPromoting] = useState(false);

  const loadFragments = async () => {
    try {
      const res = await api.listFragments();
      setFragments(res.fragments);
      if (!activeId && res.fragments.length > 0) {
        setActiveId(res.fragments[0].id);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFragments();
  }, []);

  const handleSaveFragment = async (andPromote: boolean) => {
    if (!pasteText.trim()) return;
    setSaving(true);
    try {
      const res = await api.createFragment({
        content: pasteText.trim(),
        autoAnalyze: true,
      });
      setPasteText("");
      await loadFragments();
      setActiveId(res.fragment.id);
      if (res.analyzeError) {
        onNotify(`原始口述已只读保存（自动打标跳过：${res.analyzeError}）`);
      } else {
        onNotify("原始口述已保存并完成轻量索引");
      }
      if (andPromote) {
        setPromoteTarget({
          defaultTitle: res.fragment.title,
          fragmentIds: [res.fragment.id],
        });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      await api.analyzeFragment(id);
      await loadFragments();
      onNotify("已完成标签与候选承重句提取");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDetectClusters = async () => {
    setClustering(true);
    try {
      const res = await api.detectClusters();
      setClusters(res.clusters);
      if (res.clusters.length === 0) {
        onNotify("当前碎片暂无明显可聚合的同主题选题");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setClustering(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteFragment(id);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      if (activeId === id) setActiveId(null);
      await loadFragments();
      onNotify("已删除该碎片");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmPromote = async (data: {
    workingTitle: string;
    rawIntent: string;
  }) => {
    if (!promoteTarget) return;
    setPromoting(true);
    try {
      const res = await api.promoteFragments({
        working_title: data.workingTitle,
        fragment_ids: promoteTarget.fragmentIds,
        writing_intent: data.rawIntent ? { raw_note: data.rawIntent } : undefined,
      });
      setPromoteTarget(null);
      setSelectedIds([]);
      onNotify("文章项目已创建，进入清洗与脉络透视");
      onOpenArticle(res.article.meta.slug);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setPromoting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const visible = fragments.filter((f) =>
    filter === "raw" ? f.status !== "promoted" : true
  );
  const activeFragment =
    visible.find((f) => f.id === activeId) ?? visible[0] ?? null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F9F8F4]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#E7E4DC] bg-white">
        <div>
          <h1 className="text-base font-semibold text-[#1F1E1C]">
            收件箱 · 口述碎片库
          </h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            从 ima 直接复制粘贴语音口述稿；原始内容永久只读留存，保护原始思考现场
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDetectClusters}
            disabled={clustering || fragments.length < 2}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#D6D3CB] bg-[#FAF9F5] text-[#292524] hover:bg-[#F3F1EB] disabled:opacity-40 transition"
          >
            {clustering ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Layers size={13} />
            )}
            发现可聚合选题
          </button>

          <div className="flex rounded-lg border border-[#D6D3CB] overflow-hidden text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1.5 ${
                filter === "all"
                  ? "bg-[#1F1E1C] text-white"
                  : "bg-white text-[#57534E]"
              }`}
            >
              全部 ({fragments.length})
            </button>
            <button
              onClick={() => setFilter("raw")}
              className={`px-2.5 py-1.5 ${
                filter === "raw"
                  ? "bg-[#1F1E1C] text-white"
                  : "bg-white text-[#57534E]"
              }`}
            >
              未立项
            </button>
          </div>
        </div>
      </header>

      {/* Quick Paste Area */}
      <div className="px-6 py-4 border-b border-[#E7E4DC] bg-[#FCFBF8]">
        <div className="rounded-xl border border-[#D6D3CB] bg-white p-3 shadow-2xs focus-within:border-[#B45309] transition">
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="从 ima 复制一段语音转文字口述稿粘贴到这里（几百到一千多字皆可，无需提前润色）..."
            className="w-full text-sm text-[#1F1E1C] leading-relaxed focus:outline-none resize-none placeholder:text-[#A8A29E]"
          />
          <div className="flex items-center justify-between pt-2 border-t border-[#F3F1EB]">
            <span className="text-xs text-[#78716C]">
              {pasteText.replace(/\s+/g, "").length} 字 · 自动保存至{" "}
              <code className="text-[11px]">vault/inbox/</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveFragment(false)}
                disabled={saving || !pasteText.trim()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-[#D6D3CB] text-[#292524] hover:bg-[#FAF9F5] disabled:opacity-40 transition"
              >
                {saving ? "保存中..." : "仅保存碎片"}
              </button>
              <button
                onClick={() => handleSaveFragment(true)}
                disabled={saving || !pasteText.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-40 transition"
              >
                <Sparkles size={13} /> 保存并立项
              </button>
            </div>
          </div>
        </div>

        {/* Topic Cluster Banner */}
        {clusters.length > 0 && (
          <div className="mt-3 space-y-2">
            {clusters.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/70 px-3.5 py-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-amber-950">
                    选题聚合提醒：「{c.topic}」
                  </span>
                  <span className="text-amber-900 ml-2">
                    命中 {c.fragment_ids.length} 条碎片 — {c.reason}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setPromoteTarget({
                      defaultTitle: c.topic,
                      fragmentIds: c.fragment_ids,
                    })
                  }
                  className="px-2.5 py-1 rounded bg-amber-700 text-white hover:bg-amber-800 font-medium shrink-0"
                >
                  合并立项
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Split List + Read-only Detail */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left List */}
        <div className="w-80 xl:w-96 shrink-0 border-r border-[#E7E4DC] bg-white flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto divide-y divide-[#F3F1EB]">
            {loading ? (
              <div className="p-6 text-center text-xs text-[#78716C]">
                加载中...
              </div>
            ) : visible.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#78716C] leading-relaxed">
                收件箱还是空的。
                <br />
                在上方粘贴你的第一段口述稿开始吧。
              </div>
            ) : (
              visible.map((frag) => {
                const isActive = activeFragment?.id === frag.id;
                const isChecked = selectedIds.includes(frag.id);
                return (
                  <div
                    key={frag.id}
                    onClick={() => setActiveId(frag.id)}
                    className={`p-3.5 cursor-pointer transition ${
                      isActive ? "bg-[#FAF9F5]" : "hover:bg-[#FCFBF8]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(frag.id);
                        }}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? "bg-[#1F1E1C] border-[#1F1E1C] text-white"
                            : "border-[#C7C2B8] bg-white"
                        }`}
                      >
                        {isChecked && <Check size={11} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[#1F1E1C] truncate">
                            {frag.title}
                          </span>
                          <span className="text-[11px] text-[#A8A29E] shrink-0">
                            {frag.created_at.slice(5, 10)}
                          </span>
                        </div>
                        {frag.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {frag.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-[#F3F1EB] text-[#57534E]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#78716C]">
                          <span>{frag.char_count} 字</span>
                          {frag.candidate_load_bearing.length > 0 && (
                            <span>
                              · {frag.candidate_load_bearing.length} 句潜在承重
                            </span>
                          )}
                          {frag.status === "promoted" && (
                            <span className="text-emerald-700 font-medium">
                              · 已立项
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="p-3 border-t border-[#E7E4DC] bg-[#FAF9F5] flex items-center justify-between">
              <span className="text-xs text-[#57534E]">
                已勾选 {selectedIds.length} 条碎片
              </span>
              <button
                onClick={() => {
                  const first = fragments.find((f) => f.id === selectedIds[0]);
                  setPromoteTarget({
                    defaultTitle: first?.title || "合并选题",
                    fragmentIds: selectedIds,
                  });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834]"
              >
                合并立项成文
              </button>
            </div>
          )}
        </div>

        {/* Right Read-only Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!activeFragment ? (
            <div className="h-full flex items-center justify-center text-xs text-[#78716C]">
              选择左侧一条口述碎片查看原始底稿与提取信息
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#1F1E1C]">
                    {activeFragment.title}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-[#78716C] mt-1">
                    <span>{activeFragment.created_at.slice(0, 16).replace("T", " ")}</span>
                    <span>·</span>
                    <span>来源：{activeFragment.source}</span>
                    <span>·</span>
                    <span>{activeFragment.char_count} 字</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleReanalyze(activeFragment.id)}
                    disabled={analyzingId === activeFragment.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[#D6D3CB] bg-white text-[#57534E] hover:text-[#1F1E1C]"
                    title="重新提取标签与潜在承重句"
                  >
                    {analyzingId === activeFragment.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    重新提取
                  </button>
                  <button
                    onClick={() => handleDelete(activeFragment.id)}
                    className="p-1.5 rounded-lg text-[#78716C] hover:text-rose-700 hover:bg-rose-50"
                    title="删除碎片"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() =>
                      setPromoteTarget({
                        defaultTitle: activeFragment.title,
                        fragmentIds: [activeFragment.id],
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834]"
                  >
                    立项成文章 <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {activeFragment.summary && (
                <div className="rounded-lg bg-white border border-[#E7E4DC] p-3.5 text-xs text-[#44403C] leading-relaxed">
                  <span className="font-semibold text-[#1F1E1C]">一句话摘要：</span>
                  {activeFragment.summary}
                </div>
              )}

              {(activeFragment.candidate_load_bearing.length > 0 ||
                activeFragment.candidate_experiences.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-amber-50/50 border border-amber-200/80 p-3.5 space-y-1.5">
                    <div className="text-xs font-semibold text-amber-950">
                      识别出的潜在承重句
                    </div>
                    {activeFragment.candidate_load_bearing.length === 0 ? (
                      <p className="text-xs text-[#78716C]">暂无</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-[#292524]">
                        {activeFragment.candidate_load_bearing.map((s, i) => (
                          <li key={i} className="leading-relaxed">
                            · 「{s}」
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg bg-emerald-50/40 border border-emerald-200/80 p-3.5 space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-950">
                      个人经历线索 / 暗门
                    </div>
                    {activeFragment.candidate_experiences.length === 0 ? (
                      <p className="text-xs text-[#78716C]">暂无明显经历线索</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-[#292524]">
                        {activeFragment.candidate_experiences.map((e, i) => (
                          <li key={i} className="leading-relaxed">
                            · {e}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {activeFragment.linked_articles.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#57534E]">
                  <span>已立项文章：</span>
                  {activeFragment.linked_articles.map((slug) => (
                    <button
                      key={slug}
                      onClick={() => onOpenArticle(slug)}
                      className="px-2 py-0.5 rounded bg-white border border-[#D6D3CB] hover:border-[#1F1E1C] text-[#1F1E1C]"
                    >
                      {slug} →
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-white border border-[#E7E4DC] p-5">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F3F1EB]">
                  <span className="text-xs font-semibold text-[#57534E]">
                    原始口述底稿（只读 · 永不覆盖）
                  </span>
                  <span className="text-[11px] font-mono text-[#A8A29E]">
                    inbox/{activeFragment.filename}
                  </span>
                </div>
                <div className="prose-editor text-[15px] text-[#1F1E1C] whitespace-pre-wrap">
                  {activeFragment.content}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {promoteTarget && (
        <PromoteModal
          defaultTitle={promoteTarget.defaultTitle}
          fragmentCount={promoteTarget.fragmentIds.length}
          submitting={promoting}
          onCancel={() => setPromoteTarget(null)}
          onConfirm={handleConfirmPromote}
        />
      )}
    </div>
  );
}
