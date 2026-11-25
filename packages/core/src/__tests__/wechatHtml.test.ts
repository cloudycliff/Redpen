import { describe, expect, it } from "vitest";
import { renderWechatHtml } from "../engines/wechatHtml.js";

describe("WechatHtml renderer", () => {
  it("renders inline-styled WeChat HTML with headings, quotes, lists, and escapes HTML", () => {
    const md = [
      "## 核心转变",
      "",
      "在现在这个时代，做出一个东西并没有门槛。",
      "",
      "> 关键是把东西卖出去。",
      "",
      "- 第一步：找真痛点",
      "- 第二步：算清 <ROI>",
    ].join("\n");

    const html = renderWechatHtml({
      markdown: md,
      theme: "editorial_ink",
      highlightLoadBearing: true,
      loadBearingSentences: ["在现在这个时代，做出一个东西并没有门槛。"],
    });

    expect(html).toContain("<section style=");
    expect(html).toContain("<h2 style=");
    expect(html).toContain("<blockquote style=");
    expect(html).toContain("<ul style=");
    expect(html).toContain("&lt;ROI&gt;");
    expect(html).toContain("linear-gradient");
  });

  it("omits load-bearing highlight when disabled", () => {
    const html = renderWechatHtml({
      markdown: "在现在这个时代，做出一个东西并没有门槛。",
      theme: "calm_slate",
      highlightLoadBearing: false,
      loadBearingSentences: ["在现在这个时代，做出一个东西并没有门槛。"],
    });

    expect(html).not.toContain("border-bottom: 2px solid");
  });
});
