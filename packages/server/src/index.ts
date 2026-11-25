import fs from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ServerContext, WORKSPACE_ROOT } from "./context.js";
import { createSettingsRoutes } from "./routes/settings.js";
import { createInboxRoutes } from "./routes/inbox.js";
import { createArticlesRoutes } from "./routes/articles.js";
import { createArchiveRoutes } from "./routes/archive.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function fileExists(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

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

// Production single-command hosting: serve built packages/web/dist when present
const webDistDir = path.join(WORKSPACE_ROOT, "packages", "web", "dist");
const hasWebDist = await fileExists(path.join(webDistDir, "index.html"));

if (hasWebDist) {
  app.get("*", async (c) => {
    const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
    const safeRelative = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
    const candidate = path.join(webDistDir, safeRelative);

    const target = (await fileExists(candidate))
      ? candidate
      : path.join(webDistDir, "index.html");
    const ext = path.extname(target).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const buf = await fs.readFile(target);
    return c.body(buf, 200, { "Content-Type": contentType });
  });
}

const port = Number(process.env.PORT || 3090);
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  const baseUrl = `http://127.0.0.1:${info.port}`;
  console.log(
    `[Redpen] running at ${baseUrl} (vault: ${ctx.getSafeConfig().vaultDir})`
  );
  if (hasWebDist) {
    console.log(`[Redpen] Web UI ready -> ${baseUrl}`);
  } else {
    console.log(
      `[Redpen] API-only mode. Run "pnpm build" for single-process UI or "pnpm dev" for hot reload.`
    );
  }
});
