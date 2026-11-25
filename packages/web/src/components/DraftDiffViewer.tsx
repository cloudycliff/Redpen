import type { TextDiffPart } from "@writing/core/types";

interface DraftDiffViewerProps {
  fromVersion: number;
  toVersion: number;
  parts: TextDiffPart[];
}

export function DraftDiffViewer({
  fromVersion,
  toVersion,
  parts,
}: DraftDiffViewerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-[#78716C] pb-2 border-b border-[#E7E4DC]">
        <span className="font-medium text-[#292524]">
          版本对比：v{fromVersion} → v{toVersion}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-xs bg-rose-100 border border-rose-300" />
          已删去
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-100 border border-emerald-300" />
          新改写
        </span>
      </div>

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
    </div>
  );
}
