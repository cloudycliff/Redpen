import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { CleanPatch, CleanPatchStatus, CleanPatchType } from "@writing/core/types";

interface CleanDiffViewerProps {
  sourceText: string;
  patches: CleanPatch[];
  highlightRange?: { start: number; end: number } | null;
  onTogglePatch: (patchId: string, nextStatus: CleanPatchStatus) => void;
  onSelectLoadBearing?: (selectedText: string) => void;
}

const TYPE_META: Record<CleanPatchType, { label: string; color: string }> = {
  typo: { label: "语音同音错字", color: "text-rose-700 bg-rose-50 border-rose-200" },
  punctuation: { label: "漏标点/标点规范", color: "text-sky-700 bg-sky-50 border-sky-200" },
  terminology: { label: "术语一致性", color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  filler_optional: { label: "可选口水词", color: "text-amber-800 bg-amber-50 border-amber-200" },
};

interface ParagraphSpan {
  index: number; // 1-based non-empty paragraph index
  text: string;
  startOffset: number;
  endOffset: number;
}

function splitParagraphSpans(source: string): ParagraphSpan[] {
  const spans: ParagraphSpan[] = [];
  const regex = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(source)) !== null) {
    if (match[0].trim().length === 0) continue;
    idx++;
    spans.push({
      index: idx,
      text: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }
  return spans;
}

export function CleanDiffViewer({
  sourceText,
  patches,
  highlightRange,
  onTogglePatch,
  onSelectLoadBearing,
}: CleanDiffViewerProps) {
  const [activePatchId, setActivePatchId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string>("");

  const paragraphs = splitParagraphSpans(sourceText);

  const handleMouseUp = () => {
    if (!onSelectLoadBearing) return;
    const sel = window.getSelection()?.toString().trim() ?? "";
    if (sel.length >= 8 && sel.length <= 240) {
      setSelectedQuote(sel);
    } else {
      setSelectedQuote("");
    }
  };

  return (
    <div className="relative space-y-4" onMouseUp={handleMouseUp}>
      {selectedQuote && onSelectLoadBearing && (
        <div className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-lg bg-[#1F1E1C] text-white px-3.5 py-2 text-xs shadow-lg">
          <span className="truncate">
            已选中：「{selectedQuote.slice(0, 48)}
            {selectedQuote.length > 48 ? "…" : ""}」
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                onSelectLoadBearing(selectedQuote);
                setSelectedQuote("");
                window.getSelection()?.removeAllRanges();
              }}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium"
            >
              + 设为承重句
            </button>
            <button
              onClick={() => setSelectedQuote("")}
              className="text-stone-300 hover:text-white"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {paragraphs.map((para) => {
        const paraPatches = patches
          .filter((p) => p.start >= para.startOffset && p.end <= para.endOffset)
          .sort((a, b) => a.start - b.start);

        const isHighlighted =
          highlightRange &&
          para.index >= highlightRange.start &&
          para.index <= highlightRange.end;

        const segments: React.ReactNode[] = [];
        let cursor = para.startOffset;

        for (const p of paraPatches) {
          if (p.start > cursor) {
            segments.push(
              <span key={`t-${cursor}`}>
                {sourceText.slice(cursor, p.start)}
              </span>
            );
          }

          const isAccepted = p.status === "accepted";
          const isOpen = activePatchId === p.id;
          const meta = TYPE_META[p.type];

          segments.push(
            <span key={p.id} className="inline-block relative align-baseline mx-0.5">
              <button
                type="button"
                onClick={() => setActivePatchId(isOpen ? null : p.id)}
                className={`inline-flex items-baseline gap-0.5 rounded px-1 py-0.5 text-[15px] transition border cursor-pointer ${
                  isAccepted
                    ? "bg-emerald-50/90 border-emerald-200 hover:border-emerald-400"
                    : "bg-stone-100 border-stone-300 opacity-80 hover:opacity-100"
                }`}
                title={`${meta.label}：${p.reason}（点击切换采纳/Revert）`}
              >
                {p.exact_quote && (
                  <span
                    className={
                      isAccepted
                        ? "line-through text-rose-700 bg-rose-100/80 px-0.5 rounded-xs"
                        : "text-stone-800 underline decoration-stone-400 decoration-dashed"
                    }
                  >
                    {p.exact_quote}
                  </span>
                )}
                {isAccepted && p.replace_with && (
                  <span className="text-emerald-800 bg-emerald-100/90 px-0.5 rounded-xs font-medium">
                    {p.replace_with}
                  </span>
                )}
                {!isAccepted && (
                  <span className="text-[11px] text-stone-500 ml-0.5">
                    [已Revert]
                  </span>
                )}
              </button>

              {isOpen && (
                <span className="block mt-1.5 mb-2 rounded-lg border border-[#D6D3CB] bg-white shadow-md p-2.5 text-xs text-[#292524] min-w-[240px] max-w-sm">
                  <span className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-medium ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-[#78716C]">{p.id}</span>
                  </span>
                  <span className="block text-[#57534E] mb-2">{p.reason}</span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePatch(p.id, "accepted");
                        setActivePatchId(null);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                        isAccepted
                          ? "bg-emerald-700 text-white"
                          : "bg-stone-100 text-stone-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <Check size={12} /> 采纳修改
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePatch(p.id, "reverted");
                        setActivePatchId(null);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                        !isAccepted
                          ? "bg-amber-700 text-white"
                          : "bg-stone-100 text-stone-700 hover:bg-amber-50 hover:text-amber-800"
                      }`}
                    >
                      <RotateCcw size={12} /> Revert 保留原文
                    </button>
                  </span>
                </span>
              )}
            </span>
          );

          cursor = p.end;
        }

        if (cursor < para.endOffset) {
          segments.push(
            <span key={`t-end-${cursor}`}>
              {sourceText.slice(cursor, para.endOffset)}
            </span>
          );
        }

        return (
          <div
            key={para.index}
            id={`clean-para-${para.index}`}
            className={`group flex gap-3 rounded-lg px-3 py-2 transition ${
              isHighlighted
                ? "bg-amber-50/90 ring-1 ring-amber-300"
                : "hover:bg-white/70"
            }`}
          >
            <span className="text-[11px] font-mono text-[#A8A29E] select-none pt-1.5 w-7 shrink-0 text-right">
              P{para.index}
            </span>
            <p className="prose-editor text-[15px] text-[#1F1E1C] flex-1">
              {segments}
            </p>
          </div>
        );
      })}
    </div>
  );
}
