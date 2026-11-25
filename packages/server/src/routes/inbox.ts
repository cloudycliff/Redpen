import { Hono } from "hono";
import { analyzeFragment, detectTopicClusters, type WritingIntent } from "@writing/core";
import type { ServerContext } from "../context.js";

export function createInboxRoutes(ctx: ServerContext): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const fragments = await ctx.store.listFragments();
    return c.json({ fragments });
  });

  app.post("/", async (c) => {
    const body = await c.req.json<{
      content: string;
      title?: string;
      source?: string;
      autoAnalyze?: boolean;
    }>();

    if (!body.content?.trim()) {
      return c.json({ error: "口述内容不能为空" }, 400);
    }

    let fragment = await ctx.store.createFragment({
      content: body.content,
      title: body.title,
      source: body.source || "ima-voice",
    });

    let analyzeError: string | null = null;
    const shouldAnalyze = body.autoAnalyze !== false && ctx.hasApiKey();
    if (shouldAnalyze) {
      try {
        const analyzed = await analyzeFragment(ctx.llm, fragment.content);
        fragment = await ctx.store.updateFragmentMeta(fragment.id, {
          title: body.title?.trim() || analyzed.suggested_title,
          tags: analyzed.tags,
          summary: analyzed.summary,
          candidate_load_bearing: analyzed.candidate_load_bearing,
          candidate_experiences: analyzed.candidate_experiences,
        });
      } catch (err) {
        analyzeError = err instanceof Error ? err.message : String(err);
      }
    }

    return c.json({ fragment, analyzeError }, 201);
  });

  app.post("/:id/analyze", async (c) => {
    const id = c.req.param("id");
    const fragment = await ctx.store.getFragment(id);
    if (!fragment) {
      return c.json({ error: "未找到该口述碎片" }, 404);
    }
    const analyzed = await analyzeFragment(ctx.llm, fragment.content);
    const updated = await ctx.store.updateFragmentMeta(fragment.id, {
      title: analyzed.suggested_title,
      tags: analyzed.tags,
      summary: analyzed.summary,
      candidate_load_bearing: analyzed.candidate_load_bearing,
      candidate_experiences: analyzed.candidate_experiences,
    });
    return c.json({ fragment: updated });
  });

  app.post("/clusters", async (c) => {
    const fragments = await ctx.store.listFragments();
    const clusters = await detectTopicClusters(ctx.llm, fragments);
    return c.json({ clusters });
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    await ctx.store.deleteFragment(id);
    return c.json({ ok: true });
  });

  app.post("/promote", async (c) => {
    const body = await c.req.json<{
      working_title: string;
      fragment_ids: string[];
      writing_intent?: Partial<WritingIntent>;
    }>();

    if (!Array.isArray(body.fragment_ids) || body.fragment_ids.length === 0) {
      return c.json({ error: "请至少选择一条口述碎片进行立项" }, 400);
    }

    const article = await ctx.store.createArticle({
      working_title: body.working_title || "未命名选题",
      fragment_ids: body.fragment_ids,
      writing_intent: body.writing_intent,
    });

    return c.json({ article }, 201);
  });

  return app;
}
