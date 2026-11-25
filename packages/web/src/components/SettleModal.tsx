import { useState } from "react";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import type { SettlePreview, WritingIntent } from "@writing/core/types";

interface SettleModalProps {
  currentRound: number;
  currentVersion: number;
  preview: SettlePreview;
  committing: boolean;
  onCancel: () => void;
  onConfirm: (data: {
    agreed_consensus: string[];
    rejected_suggestions: string[];
    updated_writing_intent: WritingIntent;
  }) => void;
}

export function SettleModal({
  currentRound,
  currentVersion,
  preview,
  committing,
  onCancel,
  onConfirm,
}: SettleModalProps) {
  const [consensus, setConsensus] = useState<string[]>(preview.agreed_consensus);
  const [rejected, setRejected] = useState<string[]>(preview.rejected_suggestions);
  const [intent, setIntent] = useState<WritingIntent>(
    preview.updated_writing_intent
  );
  const [newConsensus, setNewConsensus] = useState("");
  const [newRejected, setNewRejected] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const addConsensus = () => {
    if (!newConsensus.trim()) return;
    setConsensus([...consensus, newConsensus.trim()]);
    setNewConsensus("");
  };

  const addRejected = () => {
    if (!newRejected.trim()) return;
    setRejected([...rejected, newRejected.trim()]);
    setNewRejected("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[1px] p-4">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl bg-white border border-[#E7E4DC] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E7E4DC] bg-[#FAF9F5]">
          <div>
            <h3 className="text-base font-semibold text-[#1F1E1C]">
              结算 Round {currentRound} 并提交 v{currentVersion + 1}
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              确认本轮共识与否决项后，下一轮主编将只带入压缩共识与改动 Diff，保持聚焦不啰嗦
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-[#78716C] hover:text-[#1F1E1C] hover:bg-[#E7E4DC]/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Writing Intent update card */}
          <div
            className={`rounded-lg border p-3.5 ${
              preview.intent_changed
                ? "bg-amber-50/80 border-amber-300"
                : "bg-[#FAF9F5] border-[#E7E4DC]"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F1E1C] mb-2">
              <Sparkles
                size={14}
                className={
                  preview.intent_changed ? "text-amber-700" : "text-[#78716C]"
                }
              />
              <span>
                {preview.intent_changed
                  ? "检测到本轮对话更新了「写作初衷」（将同步回写顶部锚点）"
                  : "当前「写作初衷」（可顺手微调）"}
              </span>
            </div>
            <textarea
              rows={2}
              value={intent.raw_note}
              onChange={(e) =>
                setIntent({ ...intent, raw_note: e.target.value })
              }
              placeholder="一句话概括这篇的触发场景与目标读者..."
              className="w-full rounded-md border border-[#D6D3CB] bg-white px-2.5 py-1.5 text-sm text-[#1F1E1C] focus:outline-none focus:border-[#B45309]"
            />
          </div>

          {/* Agreed Consensus */}
          <div>
            <h4 className="text-sm font-medium text-[#1F1E1C] mb-2">
              本轮达成的修改共识（下一轮重点核对落地）
            </h4>
            <div className="space-y-1.5 mb-2">
              {consensus.length === 0 && (
                <p className="text-xs text-[#78716C]">暂无提炼共识，可手动补充或直接提交。</p>
              )}
              {consensus.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200 px-3 py-1.5 text-sm text-emerald-950"
                >
                  <span className="flex-1">{item}</span>
                  <button
                    onClick={() =>
                      setConsensus(consensus.filter((_, i) => i !== idx))
                    }
                    className="text-emerald-700 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newConsensus}
                onChange={(e) => setNewConsensus(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addConsensus()}
                placeholder="手动补充一条共识..."
                className="flex-1 rounded-lg border border-[#D6D3CB] px-3 py-1.5 text-xs focus:outline-none focus:border-[#B45309]"
              />
              <button
                type="button"
                onClick={addConsensus}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs text-stone-700"
              >
                <Plus size={13} /> 添加
              </button>
            </div>
          </div>

          {/* Rejected Suggestions */}
          <div>
            <h4 className="text-sm font-medium text-[#1F1E1C] mb-2">
              你已明确否决的建议（下一轮主编【严禁重提】）
            </h4>
            <div className="space-y-1.5 mb-2">
              {rejected.length === 0 && (
                <p className="text-xs text-[#78716C]">暂无已否决建议。</p>
              )}
              {rejected.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg bg-stone-100 border border-stone-200 px-3 py-1.5 text-sm text-stone-800"
                >
                  <span className="flex-1">{item}</span>
                  <button
                    onClick={() =>
                      setRejected(rejected.filter((_, i) => i !== idx))
                    }
                    className="text-stone-500 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRejected}
                onChange={(e) => setNewRejected(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRejected()}
                placeholder="手动补充一条你要坚持保留/否决主编的决定..."
                className="flex-1 rounded-lg border border-[#D6D3CB] px-3 py-1.5 text-xs focus:outline-none focus:border-[#B45309]"
              />
              <button
                type="button"
                onClick={addRejected}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs text-stone-700"
              >
                <Plus size={13} /> 添加
              </button>
            </div>
          </div>

          {/* Collapsible diff preview */}
          <div>
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="text-xs text-[#78716C] hover:text-[#1F1E1C] underline"
            >
              {showDiff ? "收起本次改动 Diff 预览" : "查看本次改动 Diff 预览"}
            </button>
            {showDiff && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-stone-900 text-stone-100 p-3 text-xs font-mono">
                {preview.draft_diff_summary || "（暂无文本改动）"}
              </pre>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#E7E4DC] bg-[#FAF9F5]">
          <button
            onClick={onCancel}
            disabled={committing}
            className="px-3.5 py-1.5 rounded-lg text-sm text-[#57534E] hover:bg-[#E7E4DC]/60"
          >
            取消
          </button>
          <button
            onClick={() =>
              onConfirm({
                agreed_consensus: consensus,
                rejected_suggestions: rejected,
                updated_writing_intent: intent,
              })
            }
            disabled={committing}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50"
          >
            {committing
              ? "提交并开启下一轮..."
              : `确认并进入 Round ${currentRound + 1}`}
          </button>
        </div>
      </div>
    </div>
  );
}
