import { Hono } from "hono";
import type { ServerContext } from "../context.js";

export function createArchiveRoutes(ctx: ServerContext): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const [stances, experiences] = await Promise.all([
      ctx.store.listStances(),
      ctx.store.listExperiences(),
    ]);
    return c.json({ stances, experiences });
  });

  app.post("/stances", async (c) => {
    const body = await c.req.json<{
      topic: string;
      core_judgment: string;
      reasoning?: string;
      tags?: string[];
      source_article?: string;
      supersedes?: string | null;
    }>();
    if (!body.topic?.trim() || !body.core_judgment?.trim()) {
      return c.json({ error: "主题与核心判断不能为空" }, 400);
    }
    const stance = await ctx.store.createStance({
      topic: body.topic,
      core_judgment: body.core_judgment,
      reasoning: body.reasoning || "",
      tags: body.tags || [],
      source_article: body.source_article || "manual",
      supersedes: body.supersedes ?? null,
    });
    return c.json({ stance }, 201);
  });

  app.post("/experiences", async (c) => {
    const body = await c.req.json<{
      title: string;
      narrative: string;
      cost_or_lesson?: string;
      tags?: string[];
      source_article?: string;
    }>();
    if (!body.title?.trim() || !body.narrative?.trim()) {
      return c.json({ error: "经历标题与梗概不能为空" }, 400);
    }
    const experience = await ctx.store.createExperience({
      title: body.title,
      narrative: body.narrative,
      cost_or_lesson: body.cost_or_lesson || "",
      tags: body.tags || [],
      source_article: body.source_article || "manual",
    });
    return c.json({ experience }, 201);
  });

  return app;
}
