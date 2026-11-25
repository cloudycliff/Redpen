import type { TextDiffPart } from "@writing/core/types";

export interface RevisionOption {
  id: string;
  label: string;
}

interface DraftDiffViewerProps {
  options: RevisionOption[];
  fromRev: string;
  toRev: string;
  parts: TextDiffPart[];
  loading?: boolean;
  onChangeRange: (nextFrom: string, nextTo: string) => void;
}

export function DraftDiffViewer({
  options,
  fromRev,
  toRev,
  parts,
  loading,
  onChangeRange,
}: DraftDiffViewerProps) {
  const hasChanges = parts.some((p) => p.added || p.removed);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap pb-2.5 border-b border-[#E7E4DC]">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-[#292524]">演变对比：</span>
          <select
            value={fromRev}
            onChange={(e) => onChangeRange(e.target.value, toRev)}
            className="rounded-md border border-[#D6D3CB] bg-white px-2 py-1 text-xs text-[#1F1E1C]"
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[#78716C]">→</span>
          <select
            value={toRev}
            onChange={(e) => onChangeRange(fromRev, e.target.value)}
            className="rounded-md border border-[#D6D3CB] bg-white px-2 py-1 text-xs text-[#1F1E1C]"
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#78716C]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-100 border border-rose-300" />
            已删去
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-100 border border-emerald-300" />
            新改写
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs text-[#78716C]">
          正在计算版本演变 Diff...
        </div>
      ) : !hasChanges ? (
        <div className="py-10 text-center text-xs text-[#78716C]">
          所选两个版本之间没有文本差异。
        </div>
      ) : (
        <div className="prose-editor text-[15px] leading-8 whitespace-pre-wrap">
          {parts.map((part, idx) => {
            if (part.removed) {
              return (
                <div
                  key={idx}
                  className="bg-rose-50/90 text-rose-900 border-l-2 border-rose-400 px-3 py-1 my-1 line-through decoration-rose-400/70"
                >
                  {part.value}
                </div>
              );
            }
            if (part.added) {
              return (
                <div
                  key={idx}
                  className="bg-emerald-50/90 text-emerald-950 border-l-2 border-emerald-500 px-3 py-1 my-1"
                >
                  {part.value}
                </div>
              );
            }
            return (
              <div key={idx} className="text-[#44403C] px-3 py-0.5">
                {part.value}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
