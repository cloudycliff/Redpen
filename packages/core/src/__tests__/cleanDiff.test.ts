import { describe, expect, it } from "vitest";
import { applyCleanPatches, buildCleanPatches } from "../engines/cleanDiff.js";

describe("CleanDiffEngine", () => {
  const sample =
    "比如把开发时间从之前的多少人点缩减到几人点，需要做很多很多复杂的设置。";

  it("anchors unique surgical patches and supports selective revert", () => {
    const patches = buildCleanPatches(sample, [
      {
        exact_quote: "之前的多少人点缩减到",
        replace_with: "之前的多少人天缩减到",
        type: "typo",
        reason: "语音同音错字：人点→人天",
      },
      {
        exact_quote: "缩减到几人点，需要",
        replace_with: "缩减到几人天，需要",
        type: "typo",
        reason: "语音同音错字：人点→人天",
      },
      {
        exact_quote: "需要做很多很多复杂的",
        replace_with: "需要做很多复杂的",
        type: "filler_optional",
        reason: "口语叠词可选删",
      },
    ]);

    expect(patches).toHaveLength(3);
    expect(patches[0].exact_quote).toBe("点");
    expect(patches[0].replace_with).toBe("天");

    const allAccepted = applyCleanPatches(sample, patches);
    expect(allAccepted).toBe(
      "比如把开发时间从之前的多少人天缩减到几人天，需要做很多复杂的设置。"
    );

    // Revert the optional filler patch to preserve author's emphasis
    const reverted = patches.map((p, i) =>
      i === 2 ? { ...p, status: "reverted" as const } : p
    );
    expect(applyCleanPatches(sample, reverted)).toBe(
      "比如把开发时间从之前的多少人天缩减到几人天，需要做很多很多复杂的设置。"
    );
  });

  it("rejects sneaky full-sentence rewrites exceeding guardrail threshold", () => {
    const patches = buildCleanPatches(sample, [
      {
        exact_quote: "需要做很多很多复杂的设置。",
        replace_with: "必须完成极为繁琐的系统配置与权限初始化流程。",
        type: "typo",
        reason: "试图偷换书面语",
      },
    ]);
    expect(patches).toHaveLength(0);
  });
});
