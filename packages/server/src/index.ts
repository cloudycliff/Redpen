import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ServerContext } from "./context.js";
import { createSettingsRoutes } from "./routes/settings.js";
import { createInboxRoutes } from "./routes/inbox.js";
import { createArticlesRoutes } from "./routes/articles.js";
import { createArchiveRoutes } from "./routes/archive.js";

const ctx = new ServerContext();
await ctx.init();

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.onError((err, c) => {
  console.error("[writing-server] Error:", err);
  const message = err instanceof Error ? err.message : "内部服务错误";
  return c.json({ error: message }, 500);
});

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    vaultDir: ctx.getSafeConfig().vaultDir,
    hasApiKey: ctx.hasApiKey(),
  });
});

app.route("/api/settings", createSettingsRoutes(ctx));
app.route("/api/inbox", createInboxRoutes(ctx));
app.route("/api/articles", createArticlesRoutes(ctx));
app.route("/api/archive", createArchiveRoutes(ctx));

const port = Number(process.env.PORT || 3090);
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(
    `[writing-server] running at http://127.0.0.1:${info.port} (vault: ${ctx.getSafeConfig().vaultDir})`
  );
});
