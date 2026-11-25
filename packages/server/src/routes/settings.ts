import { Hono } from "hono";
import type { ServerContext } from "../context.js";

export function createSettingsRoutes(ctx: ServerContext): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json(ctx.getSafeConfig());
  });

  app.put("/", async (c) => {
    const body = await c.req.json<{
      vaultDir?: string;
      llm?: {
        baseUrl?: string;
        apiKey?: string;
        model?: string;
        lightModel?: string;
      };
    }>();
    const updated = await ctx.updateConfig(body);
    return c.json(updated);
  });

  app.post("/test", async (c) => {
    try {
      const result = await ctx.llm.testConnection();
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 400);
    }
  });

  return app;
}
