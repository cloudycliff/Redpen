import { useEffect, useState } from "react";
import { GitBranch, Plus, Search } from "lucide-react";
import type { ExperienceRecord, StanceRecord } from "@writing/core/types";
import { api } from "../api/client";

interface ArchiveViewProps {
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

export function ArchiveView({ onError, onNotify }: ArchiveViewProps) {
  const [tab, setTab] = useState<"stances" | "experiences">("stances");
  const [stances, setStances] = useState<StanceRecord[]>([]);
  const [experiences, setExperiences] = useState<ExperienceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Quick manual add
  const [adding, setAdding] = useState(false);
  const [topic, setTopic] = useState("");
  const [judgment, setJudgment] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [supersedesId, setSupersedesId] = useState("");

  const load = async () => {
    try {
      const res = await api.getArchive();
      setStances(res.stances);
      setExperiences(res.experiences);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleManualCreate = async () => {
    const tags = tagsText
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      if (tab === "stances") {
        await api.createStance({
          topic,
          core_judgment: judgment,
          reasoning,
          tags,
          supersedes: supersedesId || null,
        });
        onNotify("已写入立场档案馆");
      } else {
        await api.createExperience({
          title: topic,
          narrative: judgment,
          cost_or_lesson: reasoning,
          tags,
        });
        onNotify("已写入个人经历库");
      }
      setAdding(false);
      setTopic("");
      setJudgment("");
      setReasoning("");
      setTagsText("");
      setSupersedesId("");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  const q = query.trim().toLowerCase();
  const filteredStances = stances.filter(
    (s) =>
      !q ||
      s.topic.toLowerCase().includes(q) ||
      s.core_judgment.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
  );
  const filteredExps = experiences.filter(
    (e) =>
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.narrative.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F9F8F4]">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E7E4DC] bg-white">
        <div>
          <h1 className="text-base font-semibold text-[#1F1E1C]">
            个人写作主体档案馆
          </h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            沉淀你在不同时间点的核心判断与真实经历，写新文章时自动对照与追踪自我修正轨迹
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#D6D3CB] overflow-hidden text-xs">
            <button
              onClick={() => setTab("stances")}
              className={`px-3 py-1.5 ${
                tab === "stances"
                  ? "bg-[#1F1E1C] text-white"
                  : "bg-white text-[#57534E]"
              }`}
            >
              立场演进库 ({stances.length})
            </button>
            <button
              onClick={() => setTab("experiences")}
              className={`px-3 py-1.5 ${
                tab === "experiences"
                  ? "bg-[#1F1E1C] text-white"
                  : "bg-white text-[#57534E]"
              }`}
            >
              个人经历库 ({experiences.length})
            </button>
          </div>
          <button
            onClick={() => setAdding(!adding)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834]"
          >
            <Plus size={13} /> 手动补录
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按关键词或标签搜索历史立场与经历..."
              className="w-full rounded-lg border border-[#D6D3CB] bg-white pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#B45309]"
            />
          </div>

          {adding && (
            <div className="rounded-xl border border-amber-300 bg-white p-4 space-y-3">
              <div className="text-xs font-semibold text-[#1F1E1C]">
                {tab === "stances" ? "手动记录一条核心立场" : "手动记录一段个人经历"}
              </div>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  tab === "stances" ? "立场主题（如：AI 与程序员价值）" : "经历标题"
                }
                className="w-full rounded-lg border border-[#D6D3CB] px-3 py-1.5 text-xs"
              />
              <textarea
                rows={2}
                value={judgment}
                onChange={(e) => setJudgment(e.target.value)}
                placeholder={
                  tab === "stances"
                    ? "一句话锋利判断"
                    : "真实经历梗概（时间、事件、真实场景）"
                }
                className="w-full rounded-lg border border-[#D6D3CB] px-3 py-1.5 text-xs"
              />
              <textarea
                rows={2}
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder={
                  tab === "stances" ? "依据与上下文" : "付出的代价或得到的教训"
                }
                className="w-full rounded-lg border border-[#D6D3CB] px-3 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="标签（逗号分隔）"
                  className="flex-1 rounded-lg border border-[#D6D3CB] px-3 py-1.5 text-xs"
                />
                {tab === "stances" && stances.length > 0 && (
                  <select
                    value={supersedesId}
                    onChange={(e) => setSupersedesId(e.target.value)}
                    className="rounded-lg border border-[#D6D3CB] px-2.5 py-1.5 text-xs bg-white"
                  >
                    <option value="">（可选）修正哪条旧立场？</option>
                    {stances.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.created_at} · {s.topic}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setAdding(false)}
                  className="px-3 py-1 text-xs text-[#57534E]"
                >
                  取消
                </button>
                <button
                  onClick={handleManualCreate}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white"
                >
                  保存
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center text-xs text-[#78716C] py-12">
              加载中...
            </div>
          ) : tab === "stances" ? (
            filteredStances.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D6D3CB] bg-white p-10 text-center text-xs text-[#78716C]">
                立场库目前为空。文章定稿时会自动提炼立场供你确认沉淀，也可以点击右上角手动补录。
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStances.map((s) => {
                  const superseded = s.supersedes
                    ? stances.find((x) => x.id === s.supersedes)
                    : null;
                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border bg-white p-4 space-y-2 ${
                        s.status === "revised"
                          ? "border-[#E7E4DC] opacity-75"
                          : "border-[#D6D3CB]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#1F1E1C]">
                            {s.topic}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              s.status === "active"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200"
                            }`}
                          >
                            {s.status === "active" ? "当前立场" : "已被后续修正"}
                          </span>
                        </div>
                        <span className="text-xs text-[#A8A29E]">
                          {s.created_at}
                        </span>
                      </div>

                      <p className="text-sm text-[#1F1E1C] font-medium leading-relaxed">
                        「{s.core_judgment}」
                      </p>
                      {s.reasoning && (
                        <p className="text-xs text-[#57534E] leading-relaxed">
                          {s.reasoning}
                        </p>
                      )}

                      {superseded && (
                        <div className="flex items-start gap-2 rounded-lg bg-indigo-50/70 border border-indigo-200 px-3 py-2 text-xs text-indigo-950">
                          <GitBranch size={14} className="shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium">
                              自我修正轨迹 · 取代了 {superseded.created_at} 的旧判断：
                            </span>
                            <span className="line-through text-indigo-800/80 ml-1">
                              {superseded.core_judgment}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#78716C]">
                        <div className="flex flex-wrap gap-1.5">
                          {s.tags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-[#F3F1EB]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                        <span className="font-mono text-[#A8A29E]">
                          来源：{s.source_article || "manual"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredExps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D6D3CB] bg-white p-10 text-center text-xs text-[#78716C]">
              个人经历库目前为空。定稿沉淀或手动补录后，写作时主编会自动提醒你可以复用哪些真实故事。
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExps.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl border border-[#D6D3CB] bg-white p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#1F1E1C]">
                      {e.title}
                    </span>
                    <span className="text-xs text-[#A8A29E]">{e.created_at}</span>
                  </div>
                  <p className="text-xs text-[#292524] leading-relaxed">
                    {e.narrative}
                  </p>
                  {e.cost_or_lesson && (
                    <p className="text-xs text-amber-900 bg-amber-50/70 rounded px-2.5 py-1.5">
                      代价与教训：{e.cost_or_lesson}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-[#78716C]">
                    <div className="flex flex-wrap gap-1.5">
                      {e.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded bg-[#F3F1EB]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <span className="font-mono text-[#A8A29E]">
                      来源：{e.source_article || "manual"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
