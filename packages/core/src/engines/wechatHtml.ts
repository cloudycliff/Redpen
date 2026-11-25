import type { WechatThemeId } from "../types.js";

export interface WechatThemeMeta {
  id: WechatThemeId;
  name: string;
  description: string;
}

export const WECHAT_THEMES: WechatThemeMeta[] = [
  {
    id: "editorial_ink",
    name: "经典纸墨",
    description: "温润深墨 + 陶土红点缀，适合观点随笔与深度长文",
  },
  {
    id: "calm_slate",
    name: "冷静专栏",
    description: "冷灰石板色调，克制理性，适合技术与方法论复盘",
  },
  {
    id: "minimal_serif",
    name: "极简书卷",
    description: "居中节标题与舒朗留白，接近杂志长文阅读质感",
  },
];

interface ThemeStyles {
  container: string;
  h1: string;
  h2: string;
  h3: string;
  p: string;
  strong: string;
  em: string;
  inlineCode: string;
  blockquote: string;
  ul: string;
  ol: string;
  li: string;
  hr: string;
  pre: string;
  codeBlock: string;
  loadBearing: string;
}

const THEME_STYLES: Record<WechatThemeId, ThemeStyles> = {
  editorial_ink: {
    container:
      'font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; font-size: 15.5px; line-height: 1.85; color: #262522; letter-spacing: 0.04em; word-break: break-word;',
    h1: "font-size: 21px; font-weight: 700; color: #1C1917; line-height: 1.4; margin: 24px 0 16px;",
    h2: "font-size: 17.5px; font-weight: 700; color: #1C1917; line-height: 1.45; margin: 30px 0 14px; padding-left: 11px; border-left: 3.5px solid #9A3412;",
    h3: "font-size: 16px; font-weight: 600; color: #44403C; line-height: 1.5; margin: 22px 0 10px;",
    p: "margin: 0 0 18px; text-align: left;",
    strong: "font-weight: 700; color: #1C1917;",
    em: "font-style: italic; color: #57534E;",
    inlineCode:
      'font-family: Menlo, Monaco, Consolas, monospace; font-size: 13.5px; background: #F5F2EB; color: #9A3412; padding: 2px 5px; border-radius: 3px;',
    blockquote:
      "margin: 20px 0; padding: 12px 16px; background: #FAF8F3; border-left: 3px solid #D6D3CB; color: #57534E; font-size: 14.5px; line-height: 1.8;",
    ul: "margin: 0 0 18px; padding-left: 22px;",
    ol: "margin: 0 0 18px; padding-left: 22px;",
    li: "margin-bottom: 8px; line-height: 1.8;",
    hr: "border: none; border-top: 1px solid #E7E4DC; margin: 28px 0;",
    pre: "margin: 18px 0; padding: 14px 16px; background: #F5F3EE; border-radius: 6px; overflow-x: auto;",
    codeBlock:
      'font-family: Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.65; color: #292524;',
    loadBearing:
      "background: linear-gradient(180deg, transparent 62%, rgba(217, 119, 6, 0.22) 62%); padding: 0 2px; font-weight: 600; color: #1C1917;",
  },
  calm_slate: {
    container:
      'font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.82; color: #1E293B; letter-spacing: 0.03em; word-break: break-word;',
    h1: "font-size: 20px; font-weight: 700; color: #0F172A; line-height: 1.4; margin: 24px 0 16px;",
    h2: "font-size: 17px; font-weight: 700; color: #0F172A; line-height: 1.45; margin: 28px 0 14px; padding: 5px 12px; background: #F1F5F9; border-left: 3.5px solid #334155;",
    h3: "font-size: 15.5px; font-weight: 600; color: #334155; line-height: 1.5; margin: 20px 0 10px;",
    p: "margin: 0 0 17px; text-align: left;",
    strong: "font-weight: 700; color: #0F172A;",
    em: "font-style: italic; color: #475569;",
    inlineCode:
      'font-family: Menlo, Monaco, Consolas, monospace; font-size: 13px; background: #F1F5F9; color: #0F172A; padding: 2px 5px; border-radius: 3px;',
    blockquote:
      "margin: 18px 0; padding: 12px 15px; background: #F8FAFC; border-left: 3px solid #94A3B8; color: #475569; font-size: 14.5px; line-height: 1.78;",
    ul: "margin: 0 0 17px; padding-left: 22px;",
    ol: "margin: 0 0 17px; padding-left: 22px;",
    li: "margin-bottom: 7px; line-height: 1.78;",
    hr: "border: none; border-top: 1px solid #E2E8F0; margin: 26px 0;",
    pre: "margin: 18px 0; padding: 14px 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; overflow-x: auto;",
    codeBlock:
      'font-family: Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.6; color: #1E293B;',
    loadBearing:
      "border-bottom: 2px solid #475569; padding-bottom: 1px; font-weight: 600; color: #0F172A;",
  },
  minimal_serif: {
    container:
      'font-family: "Songti SC", "Noto Serif SC", "PingFang SC", Georgia, serif; font-size: 15.5px; line-height: 1.95; color: #292524; letter-spacing: 0.05em; word-break: break-word;',
    h1: "font-size: 21px; font-weight: 700; color: #1C1917; line-height: 1.45; margin: 26px 0 18px; text-align: center;",
    h2: "font-size: 17px; font-weight: 700; color: #1C1917; line-height: 1.5; margin: 34px 0 16px; text-align: center; padding-bottom: 8px; border-bottom: 1px solid #E7E4DC;",
    h3: "font-size: 15.5px; font-weight: 700; color: #44403C; line-height: 1.5; margin: 24px 0 12px;",
    p: "margin: 0 0 20px; text-align: left;",
    strong: "font-weight: 700; color: #1C1917;",
    em: "font-style: italic; color: #57534E;",
    inlineCode:
      'font-family: Menlo, Monaco, Consolas, monospace; font-size: 13px; background: #F5F4F0; color: #44403C; padding: 2px 5px; border-radius: 3px;',
    blockquote:
      "margin: 22px 0; padding: 14px 18px; background: #FAF9F6; border-left: 2.5px solid #A8A29E; color: #57534E; font-size: 14.5px; line-height: 1.85;",
    ul: "margin: 0 0 20px; padding-left: 22px;",
    ol: "margin: 0 0 20px; padding-left: 22px;",
    li: "margin-bottom: 9px; line-height: 1.85;",
    hr: "border: none; border-top: 1px solid #D6D3CB; width: 42%; margin: 30px auto;",
    pre: "margin: 18px 0; padding: 14px 16px; background: #F7F6F2; border-radius: 4px; overflow-x: auto;",
    codeBlock:
      'font-family: Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.65; color: #292524;',
    loadBearing:
      "background: #FEF3C7; padding: 1px 3px; border-radius: 2px; color: #1C1917;",
  },
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyLoadBearingHighlight(
  escapedText: string,
  sentences: string[],
  spanStyle: string
): string {
  if (sentences.length === 0) return escapedText;
  let result = escapedText;
  // Sort longest first to avoid nested partial replacements
  const sorted = [...sentences]
    .map((s) => escapeHtml(s.trim()))
    .filter((s) => s.length >= 6)
    .sort((a, b) => b.length - a.length);

  for (const target of sorted) {
    if (result.includes(target)) {
      result = result.replace(
        target,
        `<span style="${spanStyle}">${target}</span>`
      );
    }
  }
  return result;
}

function renderInlineMarkdown(
  raw: string,
  styles: ThemeStyles,
  loadBearingSentences: string[]
): string {
  // Protect inline code segments first
  const codeTokens: string[] = [];
  const withPlaceholders = raw.replace(/`([^`]+)`/g, (_m, code: string) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code style="${styles.inlineCode}">${escapeHtml(code)}</code>`);
    return `@@CODE_${idx}@@`;
  });

  let html = escapeHtml(withPlaceholders);

  // Links: WeChat external links aren't directly clickable, show readable label
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    `<span style="color: #9A3412; text-decoration: underline;">$1</span>`
  );

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="${styles.strong}">$1</strong>`);
  html = html.replace(/\*([^*]+)\*/g, `<em style="${styles.em}">$1</em>`);

  // Subtle load-bearing sentence highlight (only when enabled)
  if (loadBearingSentences.length > 0) {
    html = applyLoadBearingHighlight(
      html,
      loadBearingSentences,
      styles.loadBearing
    );
  }

  // Restore inline code tokens
  html = html.replace(/@@CODE_(\d+)@@/g, (_m, idxStr: string) => {
    return codeTokens[Number(idxStr)] ?? "";
  });

  return html;
}

export function renderWechatHtml(params: {
  markdown: string;
  theme?: WechatThemeId;
  highlightLoadBearing?: boolean;
  loadBearingSentences?: string[];
}): string {
  const themeId: WechatThemeId = params.theme ?? "editorial_ink";
  const styles = THEME_STYLES[themeId] ?? THEME_STYLES.editorial_ink;
  const lb = params.highlightLoadBearing ? params.loadBearingSentences ?? [] : [];

  const lines = params.markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        `<pre style="${styles.pre}"><code style="${styles.codeBlock}">${escapeHtml(codeLines.join("\n"))}</code></pre>`
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(`<hr style="${styles.hr}" />`);
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInlineMarkdown(headingMatch[2].trim(), styles, []);
      const tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      blocks.push(`<${tag} style="${style}">${content}</${tag}>`);
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const inner = quoteLines
        .map((ql) => renderInlineMarkdown(ql, styles, lb))
        .join("<br />");
      blocks.push(
        `<blockquote style="${styles.blockquote}">${inner}</blockquote>`
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*+]\s+/, "");
        items.push(
          `<li style="${styles.li}">${renderInlineMarkdown(itemText, styles, lb)}</li>`
        );
        i++;
      }
      blocks.push(`<ul style="${styles.ul}">${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(
          `<li style="${styles.li}">${renderInlineMarkdown(itemText, styles, lb)}</li>`
        );
        i++;
      }
      blocks.push(`<ol style="${styles.ol}">${items.join("")}</ol>`);
      continue;
    }

    // Standard paragraph (join consecutive non-blank plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s+|>\s?|[-*+]\s+|\d+\.\s+|```|---|\*\*\*|___)/.test(
        lines[i].trim()
      )
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    const content = paraLines
      .map((pl) => renderInlineMarkdown(pl, styles, lb))
      .join("<br />");
    blocks.push(`<p style="${styles.p}">${content}</p>`);
  }

  return `<section style="${styles.container}">${blocks.join("")}</section>`;
}
