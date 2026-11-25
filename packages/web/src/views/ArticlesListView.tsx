import { useEffect, useState } from "react";
import { ArrowRight, FileText, Trash2 } from "lucide-react";
import type { ArticleStage, ArticleSummary } from "@writing/core/types";
import { api } from "../api/client";

interface ArticlesListViewProps {
  onOpenArticle: (slug: string) => void;
  onGoInbox: () => void;
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

const STAGE_BADGE: Record<ArticleStage, { label: string; cls: string }> = {
  cleaning: {
    label: "1. 清洗与脉络",
    cls: "bg-sky-50 text-sky-800 border-sky-200",
  },
  revising: {
    label: "2. 多轮改稿中",
    cls: "bg-amber-50 text-amber-900 border-amber-200",
  },
  compliance: {
    label: "3. 标题与合规",
    cls: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  finalized: {
    label: "已定稿归档",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
};

export function ArticlesListView({
  onOpenArticle,
  onGoInbox,
  onError,
  onNotify,
}: ArticlesListViewProps) {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.listArticles();
      setArticles(res.articles);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (slug: string, name: string) => {
    if (!window.confirm(`确定删除文章项目「${name}」及其本地目录吗？`)) return;
    try {
      await api.deleteArticle(slug);
      await load();
      onNotify("已删除文章项目");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F9F8F4]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#E7E4DC] bg-white">
        <div>
          <h1 className="text-base font-semibold text-[#1F1E1C]">文章项目</h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            每篇文章独立存放在 <code className="text-[11px]">vault/articles/</code> 下，完整保留版本草稿、主编讨论与合规报告
          </p>
        </div>
        <button
          onClick={onGoInbox}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834]"
        >
          去收件箱立项新文章
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-xs text-[#78716C] text-center py-12">
              加载中...
            </div>
          ) : articles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D6D3CB] bg-white p-12 text-center space-y-3">
              <FileText size={28} className="mx-auto text-[#A8A29E]" />
              <p className="text-sm text-[#44403C]">还没有立项的文章</p>
              <p className="text-xs text-[#78716C]">
                先去「收件箱」粘贴一段口述稿，立项后即可进入清洗透视与主编改稿工作台。
              </p>
              <button
                onClick={onGoInbox}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#1F1E1C] text-white"
              >
                前往收件箱
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((art) => {
                const badge = STAGE_BADGE[art.stage] ?? STAGE_BADGE.cleaning;
                const displayTitle = art.title || art.working_title;
                return (
                  <div
                    key={art.slug}
                    onClick={() => onOpenArticle(art.slug)}
                    className="group cursor-pointer rounded-xl border border-[#E7E4DC] bg-white p-4 hover:border-[#B45309]/60 hover:shadow-xs transition flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-semibold text-[#1F1E1C] truncate">
                          {displayTitle}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[#78716C]">
                        <span>草稿 v{art.current_draft_version}</span>
                        <span>·</span>
                        <span>Round {art.current_round}</span>
                        <span>·</span>
                        <span>承重句 {art.locked_load_bearing_count}</span>
                        <span>·</span>
                        <span>
                          更新于 {art.updated_at.slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(art.slug, displayTitle);
                        }}
                        className="p-2 rounded-lg text-[#A8A29E] hover:text-rose-700 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition"
                        title="删除文章"
                      >
                        <Trash2 size={15} />
                      </button>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#57534E] group-hover:text-[#1F1E1C]">
                        进入工作台 <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
