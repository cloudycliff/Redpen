import { useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Highlighter } from "lucide-react";
import type { WechatThemeId } from "@writing/core/types";
import { WECHAT_THEMES, renderWechatHtml } from "@writing/core/wechat";

interface WechatPreviewPaneProps {
  title: string;
  markdown: string;
  digest: string;
  theme: WechatThemeId;
  highlightLoadBearing: boolean;
  loadBearingSentences: string[];
  onChangeTheme: (theme: WechatThemeId) => void;
  onToggleHighlight: (enabled: boolean) => void;
  onExportHtml: (html: string) => Promise<void>;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function WechatPreviewPane({
  title,
  markdown,
  digest,
  theme,
  highlightLoadBearing,
  loadBearingSentences,
  onChangeTheme,
  onToggleHighlight,
  onExportHtml,
  onNotify,
  onError,
}: WechatPreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [copiedRich, setCopiedRich] = useState(false);
  const [exporting, setExporting] = useState(false);

  const html = useMemo(
    () =>
      renderWechatHtml({
        markdown,
        theme,
        highlightLoadBearing,
        loadBearingSentences,
      }),
    [markdown, theme, highlightLoadBearing, loadBearingSentences]
  );

  const handleCopyRichText = async () => {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([markdown], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);
      } else if (previewRef.current) {
        const range = document.createRange();
        range.selectNodeContents(previewRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand("copy");
        sel?.removeAllRanges();
      }
      setCopiedRich(true);
      onNotify("已复制带内联样式的富文本，可直接粘贴到微信公众号后台！");
      setTimeout(() => setCopiedRich(false), 2200);
    } catch (err) {
      onError(
        `复制富文本失败（请确认浏览器允许剪贴板权限）：${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExportHtml(html);
    } finally {
      setExporting(false);
    }
  };

  const activeThemeMeta = WECHAT_THEMES.find((t) => t.id === theme);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F1EFEA]">
      {/* Theme & Copy Toolbar */}
      <div className="px-5 py-3 border-b border-[#E7E4DC] bg-white flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-[#D6D3CB] overflow-hidden text-xs">
            {WECHAT_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTheme(t.id)}
                title={t.description}
                className={`px-3 py-1.5 transition ${
                  theme === t.id
                    ? "bg-[#1F1E1C] text-white font-medium"
                    : "bg-white text-[#57534E] hover:bg-[#FAF9F5]"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onToggleHighlight(!highlightLoadBearing)}
            disabled={loadBearingSentences.length === 0}
            title={
              loadBearingSentences.length === 0
                ? "当前文章尚未锁定承重句"
                : "在排版中对正文里出现的锁定承重句施加克制的视觉微高亮"
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition disabled:opacity-40 ${
              highlightLoadBearing
                ? "bg-amber-50 border-amber-300 text-amber-950 font-medium"
                : "bg-white border-[#D6D3CB] text-[#57534E] hover:bg-[#FAF9F5]"
            }`}
          >
            <Highlighter size={13} />
            承重句微高亮
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#D6D3CB] bg-[#FAF9F5] text-[#292524] hover:bg-[#F3F1EB] disabled:opacity-50"
          >
            <Download size={13} />
            {exporting ? "导出中..." : "保存 wechat.html"}
          </button>
          <button
            type="button"
            onClick={handleCopyRichText}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#07C160] text-white hover:bg-[#06AD56] transition shadow-2xs"
          >
            {copiedRich ? <Check size={14} /> : <Copy size={14} />}
            {copiedRich ? "已复制富文本" : "一键复制粘贴到公众号"}
          </button>
        </div>
      </div>

      {/* Simulated WeChat Article Column */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-[660px] mx-auto bg-white rounded-xl border border-[#E7E4DC] shadow-sm px-7 py-8">
          <div className="mb-6 pb-5 border-b border-[#F3F1EB]">
            <h1 className="text-[22px] font-bold text-[#1F1E1C] leading-snug">
              {title || "（暂未填写公众号标题）"}
            </h1>
            <div className="mt-2.5 flex items-center gap-3 text-xs text-[#A8A29E]">
              <span>微信公众号长文预览</span>
              <span>·</span>
              <span>{activeThemeMeta?.name}</span>
              <span>·</span>
              <span>约 {markdown.replace(/\s+/g, "").length} 字</span>
            </div>
            {digest.trim() && (
              <div className="mt-3 rounded-lg bg-[#FAF9F5] border border-[#EAE7DF] px-3 py-2 text-xs text-[#57534E] leading-relaxed">
                <span className="font-medium text-[#292524]">摘要：</span>
                {digest.trim()}
              </div>
            )}
          </div>

          <div
            ref={previewRef}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
