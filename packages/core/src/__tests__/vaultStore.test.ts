import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VaultStore } from "../vault/store.js";

const tmpDirs: string[] = [];

async function makeTempVault(): Promise<VaultStore> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "writing-vault-"));
  tmpDirs.push(dir);
  return new VaultStore(dir);
}

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()!;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe("VaultStore", () => {
  it("preserves raw fragment content read-only when updating metadata", async () => {
    const store = await makeTempVault();
    const rawText = "最近公司在推AI的工作流应用，我觉得这是一个难得的机会。";
    const created = await store.createFragment({ content: rawText });

    const updated = await store.updateFragmentMeta(created.id, {
      title: "思想的转变",
      tags: ["AI工作流", "转型"],
      summary: "讨论 AI 工作流下的角色转型。",
    });

    expect(updated.content).toBe(rawText);
    expect(updated.tags).toEqual(["AI工作流", "转型"]);

    const loaded = await store.getFragment(created.id);
    expect(loaded?.content).toBe(rawText);
    expect(loaded?.title).toBe("思想的转变");
  });

  it("promotes fragments to an article with writing_intent and tracks stance supersedes", async () => {
    const store = await makeTempVault();
    const frag = await store.createFragment({
      content: "同事觉得做汇报压力大，我觉得这是把东西卖出去的练习。",
    });

    const art = await store.createArticle({
      working_title: "思想的转变",
      fragment_ids: [frag.id],
      writing_intent: {
        raw_note: "写给对做汇报感到焦虑的研发同事",
      },
    });

    expect(art.meta.writing_intent.raw_note).toBe(
      "写给对做汇报感到焦虑的研发同事"
    );
    expect(art.raw_source).toContain("同事觉得做汇报压力大");

    const oldStance = await store.createStance({
      topic: "程序员核心价值",
      core_judgment: "写好代码就是核心竞争力",
      reasoning: "过去实现门槛高",
      tags: ["研发"],
      source_article: "art-old",
    });

    const newStance = await store.createStance({
      topic: "程序员核心价值",
      core_judgment: "做出东西没门槛，找到痛点并卖出去才是价值",
      reasoning: "AI 消除了纯实现垄断",
      tags: ["研发", "AI"],
      source_article: art.meta.slug,
      supersedes: oldStance.id,
    });

    const allStances = await store.listStances();
    const refreshedOld = allStances.find((s) => s.id === oldStance.id);
    expect(refreshedOld?.status).toBe("revised");
    expect(newStance.supersedes).toBe(oldStance.id);
  });
});
