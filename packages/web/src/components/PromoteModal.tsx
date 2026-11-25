import { useState } from "react";
import { X } from "lucide-react";

interface PromoteModalProps {
  defaultTitle: string;
  fragmentCount: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (data: { workingTitle: string; rawIntent: string }) => void;
}

export function PromoteModal({
  defaultTitle,
  fragmentCount,
  submitting,
  onCancel,
  onConfirm,
}: PromoteModalProps) {
  const [workingTitle, setWorkingTitle] = useState(defaultTitle);
  const [rawIntent, setRawIntent] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[1px] p-4">
      <div className="w-full max-w-lg rounded-xl bg-white border border-[#E7E4DC] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E7E4DC] bg-[#FAF9F5]">
          <div>
            <h3 className="text-base font-semibold text-[#1F1E1C]">
              立项成文章
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              基于 {fragmentCount} 条原始口述碎片创建独立文章项目（原始底稿保持只读）
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-[#78716C] hover:text-[#1F1E1C] hover:bg-[#E7E4DC]/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#292524] mb-1.5">
              暂定选题名
            </label>
            <input
              type="text"
              value={workingTitle}
              onChange={(e) => setWorkingTitle(e.target.value)}
              placeholder="例如：思想的转变"
              className="w-full rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-3 py-2 text-sm text-[#1F1E1C] focus:outline-none focus:border-[#B45309]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#292524] mb-1">
              写作初衷 / 触发场景
              <span className="ml-1.5 text-xs font-normal text-[#78716C]">
                （选填，1–2 句话即可）
              </span>
            </label>
            <textarea
              rows={4}
              value={rawIntent}
              onChange={(e) => setRawIntent(e.target.value)}
              placeholder="为什么突然想写这篇？主要说给谁听？希望对方看完有什么改变？&#10;例：同事说做汇报压力很大，我觉得这是通病，想告诉他们这种转变很有必要而且机会难得。"
              className="w-full rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-3 py-2 text-sm text-[#1F1E1C] leading-relaxed focus:outline-none focus:border-[#B45309] resize-none"
            />
            <p className="text-xs text-[#78716C] mt-1.5">
              拿不准可以先留空，在后续「脉络透视」或与主编对话时随时补填，系统也会在讨论中帮你提炼回填。
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#E7E4DC] bg-[#FAF9F5]">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-3.5 py-1.5 rounded-lg text-sm text-[#57534E] hover:bg-[#E7E4DC]/60 transition"
          >
            取消
          </button>
          <button
            onClick={() =>
              onConfirm({
                workingTitle: workingTitle.trim() || "未命名选题",
                rawIntent: rawIntent.trim(),
              })
            }
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50 transition"
          >
            {submitting ? "立项中..." : "开始清洗透视"}
          </button>
        </div>
      </div>
    </div>
  );
}
