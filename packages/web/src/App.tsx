import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { SafeAppConfig } from "@writing/core/types";
import { api } from "./api/client";
import { Sidebar, type TopView } from "./components/Sidebar";
import { InboxView } from "./views/InboxView";
import { ArticlesListView } from "./views/ArticlesListView";
import { ArticleWorkspace } from "./views/ArticleWorkspace";
import { ArchiveView } from "./views/ArchiveView";
import { SettingsView } from "./views/SettingsView";

export default function App() {
  const [activeView, setActiveView] = useState<TopView>("inbox");
  const [activeArticleSlug, setActiveArticleSlug] = useState<string | null>(
    null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [config, setConfig] = useState<SafeAppConfig | null>(null);
  const [toast, setToast] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const showError = useCallback((text: string) => {
    setToast({ type: "error", text });
  }, []);

  const showNotify = useCallback((text: string) => {
    setToast({ type: "ok", text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.type === "error" ? 6500 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    void api
      .getSettings()
      .then(setConfig)
      .catch(() => {
        // server might still be booting
      });
  }, []);

  const openArticle = (slug: string) => {
    setActiveView("articles");
    setActiveArticleSlug(slug);
    setSidebarCollapsed(true); // Enter distraction-free writing layout
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F9F8F4]">
      <Sidebar
        activeView={activeView}
        collapsed={sidebarCollapsed}
        hasApiKey={Boolean(config?.llm.hasApiKey)}
        onSelectView={(v) => {
          setActiveView(v);
          if (v !== "articles") setActiveArticleSlug(null);
        }}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
        {/* Global toast */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md">
            <div
              className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs shadow-lg border ${
                toast.type === "error"
                  ? "bg-rose-50 border-rose-300 text-rose-950"
                  : "bg-[#1F1E1C] border-[#3A3834] text-white"
              }`}
            >
              {toast.type === "error" ? (
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-700" />
              ) : (
                <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-400" />
              )}
              <span className="leading-relaxed">{toast.text}</span>
              <button
                onClick={() => setToast(null)}
                className="opacity-70 hover:opacity-100 ml-1"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {activeView === "inbox" && (
          <InboxView
            onOpenArticle={openArticle}
            onError={showError}
            onNotify={showNotify}
          />
        )}

        {activeView === "articles" &&
          (activeArticleSlug ? (
            <ArticleWorkspace
              slug={activeArticleSlug}
              onBack={() => {
                setActiveArticleSlug(null);
                setSidebarCollapsed(false);
              }}
              onError={showError}
              onNotify={showNotify}
            />
          ) : (
            <ArticlesListView
              onOpenArticle={openArticle}
              onGoInbox={() => setActiveView("inbox")}
              onError={showError}
              onNotify={showNotify}
            />
          ))}

        {activeView === "archive" && (
          <ArchiveView onError={showError} onNotify={showNotify} />
        )}

        {activeView === "settings" && (
          <SettingsView
            onConfigUpdated={setConfig}
            onError={showError}
            onNotify={showNotify}
          />
        )}
      </main>
    </div>
  );
}
