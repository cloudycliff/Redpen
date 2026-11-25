import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquareReply, MessagesSquare } from "lucide-react";

interface DiagnosisViewProps {
  markdown: string;
  canReply: boolean;
  onDiscuss: (quote: string, starterPrefix?: string) => void;
}

interface ParsedSection {
  title: string;
  body: string;
  isQuestions: boolean;
}

interface ParsedQuestion {
  index: string;
  text: string;
}

function parseDiagnosisSections(markdown: string): {
  preamble: string;
  sections: ParsedSection[];
} {
  const lines = markdown.split(/\r?\n/);
  const preambleLines: string[] = [];
  const sections: ParsedSection[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const m = line.match(/^#{2,3}\s+(.+)$/);
    if (m) {
      if (current) {
        const body = current.lines.join("\n").trim();
        sections.push({
          title: current.title,
          body,
          isQuestions: /追问/.test(current.title),
        });
      }
      current = { title: m[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  if (current) {
    const body = current.lines.join("\n").trim();
    sections.push({
      title: current.title,
      body,
      isQuestions: /追问/.test(current.title),
    });
  }

  return {
    preamble: preambleLines.join("\n").trim(),
    sections,
  };
}

function parseNumberedQuestions(body: string): ParsedQuestion[] {
  const lines = body.split(/\r?\n/);
  const questions: ParsedQuestion[] = [];
  let current: { index: string; lines: string[] } | null = null;

  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[\.\)、]\s+(.+)$/);
    if (m) {
      if (current) {
        questions.push({
          index: current.index,
          text: current.lines.join("\n").trim(),
        });
      }
      current = { index: m[1], lines: [m[2]] };
    } else if (current && line.trim()) {
      current.lines.push(line.trim());
    }
  }

  if (current) {
    questions.push({
      index: current.index,
      text: current.lines.join("\n").trim(),
    });
  }

  return questions;
}

export function DiagnosisView({
  markdown,
  canReply,
  onDiscuss,
}: DiagnosisViewProps) {
  const { preamble, sections } = parseDiagnosisSections(markdown);

  if (sections.length === 0) {
    return (
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {preamble && (
        <div className="markdown-body text-[13px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{preamble}</ReactMarkdown>
        </div>
      )}

      {sections.map((sec, idx) => {
        const questions = sec.isQuestions
          ? parseNumberedQuestions(sec.body)
          : [];

        return (
          <div
            key={`${sec.title}-${idx}`}
            className="rounded-lg border border-[#E7E4DC] bg-white p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[13px] font-semibold text-[#1F1E1C] border-l-[3px] border-amber-700 pl-2 leading-snug">
                {sec.title}
              </h4>
              {canReply && !sec.isQuestions && (
                <button
                  type="button"
                  onClick={() =>
                    onDiscuss(
                      `【诊断 · ${sec.title}】\n${sec.body.slice(0, 180)}${sec.body.length > 180 ? "…" : ""}`,
                      `关于「${sec.title}」，`
                    )
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 shrink-0 transition"
                >
                  <MessagesSquare size={11} /> 针对讨论
                </button>
              )}
            </div>

            {sec.isQuestions && questions.length > 0 ? (
              <div className="space-y-2 pt-0.5">
                {questions.map((q) => (
                  <div
                    key={q.index}
                    className="rounded-md bg-[#FAF9F5] border border-[#EAE7DF] p-2.5 flex items-start justify-between gap-2.5"
                  >
                    <div className="markdown-body text-[13px] flex-1 min-w-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {`**Q${q.index}.** ${q.text}`}
                      </ReactMarkdown>
                    </div>
                    {canReply && (
                      <button
                        type="button"
                        onClick={() =>
                          onDiscuss(
                            `【追问 Q${q.index}】${q.text.replace(/\*\*/g, "").slice(0, 160)}`,
                            `回答 Q${q.index}：`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] shrink-0 transition"
                      >
                        <MessageSquareReply size={11} /> 直接回
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="markdown-body text-[13px] text-[#292524]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {sec.body}
                </ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
