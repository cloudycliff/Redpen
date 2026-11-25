import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { ArticleDetail } from "@writing/core/types";
import { api } from "../api/client";
import { StageCleanMap } from "./workspace/StageCleanMap";
import { StageReviseLoop } from "./workspace/StageReviseLoop";
import { StagePublishGate } from "./workspace/StagePublishGate";

type WorkspaceTab = "cleaning" | "revising" | "publish";

interface ArticleWorkspaceProps {
  slug: string;
  onBack: () => void;
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

export function ArticleWorkspace({
  slug,
  onBack,
  onError,
  onNotify,
}: ArticleWorkspaceProps) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<WorkspaceTab>("cleaning");

  const load = useCallback(async () => {
    try {
      const res = await api.getArticle(slug);
      setArticle(res.article);
      return res.article;
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [slug, onError]);

  useEffect(() => {
    setLoading(true);
    void load().then((art) => {
      if (!art) return;
      if (art.meta.stage === "cleaning") setTab("cleaning");
      else if (art.meta.stage === "revising") setTab("revising");
      else setTab("publish");
    });
  }, [slug, load]);

  if (loading || !article) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[#78716C] gap-2">
        <Loader2 size={16} className="animate-spin" />
        <span>加载文章工作台...</span>
      </div>
    );
  }

  const refreshAndSyncTab = async () => {
    const prevStage = article.meta.stage;
    const updated = await load();
    if (updated && updated.meta.stage !== prevStage) {
      if (updated.meta.stage === "revising") setTab("revising");
      else if (
        updated.meta.stage === "compliance" ||
        updated.meta.stage === "finalized"
      ) {
        setTab("publish");
      }
    }
  };

  const steps: Array<{ id: WorkspaceTab; label: string; badge?: string }> = [
    { id: "cleaning", label: "1. 清洗与脉络" },
    {
      id: "revising",
      label: "2. 多轮改稿",
      badge:
        article.meta.current_round > 0
          ? `v${article.meta.current_draft_version} · R${article.meta.current_round}`
          : undefined,
    },
    {
      id: "publish",
      label:
        article.meta.stage === "finalized"
          ? "3. 标题、合规与已定稿"
          : "3. 标题与合规审查",
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Top stage progress bar */}
      <header className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-[#E7E4DC] bg-[#F3F1EB]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs text-[#57534E] hover:text-[#1F1E1C] px-2 py-1 rounded hover:bg-[#E7E4DC]/60 transition shrink-0"
          >
            <ArrowLeft size={14} /> 文章列表
          </button>
          <span className="text-[#C7C2B8]">|</span>
          <h1 className="text-sm font-semibold text-[#1F1E1C] truncate">
            {article.meta.title || article.meta.working_title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {steps.map((s) => {
            const active = tab === s.id;
            const disabled =
              s.id === "revising" &&
              article.draft_versions.length === 0 &&
              article.meta.stage === "cleaning";
            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={() => setTab(s.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  active
                    ? "bg-[#1F1E1C] text-white"
                    : disabled
                      ? "text-[#A8A29E] cursor-not-allowed"
                      : "text-[#57534E] hover:bg-white/80 hover:text-[#1F1E1C]"
                }`}
              >
                <span>{s.label}</span>
                {s.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[#E7E4DC] text-[#44403C]"
                    }`}
                  >
                    {s.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {tab === "cleaning" && (
        <StageCleanMap
          article={article}
          onRefresh={refreshAndSyncTab}
          onError={onError}
          onNotify={onNotify}
        />
      )}

      {tab === "revising" && (
        <StageReviseLoop
          article={article}
          onRefresh={refreshAndSyncTab}
          onGoPublish={async () => {
            if (article.meta.stage === "revising") {
              await api.updateArticleMeta(slug, { stage: "compliance" });
              await load();
            }
            setTab("publish");
          }}
          onError={onError}
          onNotify={onNotify}
        />
      )}

      {tab === "publish" && (
        <StagePublishGate
          article={article}
          onRefresh={refreshAndSyncTab}
          onError={onError}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
