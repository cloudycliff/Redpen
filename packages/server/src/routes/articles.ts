import crypto from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  applyCleanPatches,
  computeDraftDiffParts,
  extractArchiveCandidates,
  formatUnifiedDraftDiff,
  generateCleanDiff,
  generateStructureMap,
  generateTitleCandidates,
  previewRoundSettlement,
  retrieveRelevantArchives,
  runCompliancePrivacyGate,
  streamNextRoundDiagnosis,
  streamRound1Diagnosis,
  streamRoundChat,
  type ArticleStage,
  type CleanPatchStatus,
  type FindingStatus,
  type LoadBearingSentence,
  type RoundRecord,
  type WritingIntent,
} from "@writing/core";
import type { ServerContext } from "../context.js";

export function createArticlesRoutes(ctx: ServerContext): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const articles = await ctx.store.listArticles();
    return c.json({ articles });
  });

  app.get("/:slug", async (c) => {
    const detail = await ctx.store.getArticle(c.req.param("slug"));
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);
    return c.json({ article: detail });
  });

  app.delete("/:slug", async (c) => {
    await ctx.store.deleteArticle(c.req.param("slug"));
    return c.json({ ok: true });
  });

  app.patch("/:slug/meta", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const body = await c.req.json<{
      working_title?: string;
      title?: string;
      stage?: ArticleStage;
      writing_intent?: Partial<WritingIntent>;
      load_bearing_sentences?: LoadBearingSentence[];
      selected_title_id?: string;
    }>();

    const meta = { ...detail.meta };
    if (body.working_title !== undefined) meta.working_title = body.working_title;
    if (body.title !== undefined) meta.title = body.title;
    if (body.stage !== undefined) meta.stage = body.stage;
    if (body.writing_intent) {
      meta.writing_intent = { ...meta.writing_intent, ...body.writing_intent };
    }
    if (body.load_bearing_sentences) {
      meta.load_bearing_sentences = body.load_bearing_sentences;
    }
    if (body.selected_title_id) {
      meta.title_candidates = meta.title_candidates.map((tc) => ({
        ...tc,
        selected: tc.id === body.selected_title_id,
      }));
      const chosen = meta.title_candidates.find(
        (tc) => tc.id === body.selected_title_id
      );
      if (chosen) meta.title = chosen.title;
    }

    const updated = await ctx.store.saveArticleMeta(slug, meta);
    return c.json({ meta: updated });
  });

  // ---------------------------------------------------------------------------
  // Stage 1: Clean Diff + Structure Map
  // ---------------------------------------------------------------------------

  app.post("/:slug/clean-and-map", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const [cleanDiff, structureMap] = await Promise.all([
      generateCleanDiff(ctx.llm, detail.raw_source),
      generateStructureMap(ctx.llm, detail.raw_source, detail.meta.writing_intent),
    ]);

    await ctx.store.saveCleanDiff(slug, cleanDiff);
    await ctx.store.saveStructureMap(slug, structureMap);

    // Populate load-bearing candidates on meta if empty or refreshing
    const updatedMeta = await ctx.store.saveArticleMeta(slug, {
      ...detail.meta,
      load_bearing_sentences: structureMap.candidates,
    });

    return c.json({
      clean_diff: cleanDiff,
      structure_map: structureMap,
      meta: updatedMeta,
    });
  });

  app.patch("/:slug/clean-patches/:patchId", async (c) => {
    const slug = c.req.param("slug");
    const patchId = c.req.param("patchId");
    const detail = await ctx.store.getArticle(slug);
    if (!detail?.clean_diff) {
      return c.json({ error: "尚未生成清洗 Diff" }, 404);
    }

    const body = await c.req.json<{ status: CleanPatchStatus }>();
    const patches = detail.clean_diff.patches.map((p) =>
      p.id === patchId ? { ...p, status: body.status } : p
    );
    const cleaned_text = applyCleanPatches(detail.clean_diff.source_text, patches);
    const nextState = { ...detail.clean_diff, patches, cleaned_text };
    await ctx.store.saveCleanDiff(slug, nextState);
    return c.json({ clean_diff: nextState });
  });

  app.post("/:slug/clean-patches/bulk", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail?.clean_diff) {
      return c.json({ error: "尚未生成清洗 Diff" }, 404);
    }

    const body = await c.req.json<{ status: CleanPatchStatus }>();
    const patches = detail.clean_diff.patches.map((p) => ({
      ...p,
      status: body.status,
    }));
    const cleaned_text = applyCleanPatches(detail.clean_diff.source_text, patches);
    const nextState = { ...detail.clean_diff, patches, cleaned_text };
    await ctx.store.saveCleanDiff(slug, nextState);
    return c.json({ clean_diff: nextState });
  });

  app.post("/:slug/confirm-cleaning", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const baseText = detail.clean_diff?.cleaned_text ?? detail.raw_source;
    const existingV1 = await ctx.store.getDraft(slug, 1);
    if (!existingV1) {
      await ctx.store.saveDraft(slug, 1, baseText);
    }

    const rounds = await ctx.store.listRounds(slug);
    let currentRound = detail.meta.current_round;
    if (rounds.length === 0) {
      const round1: RoundRecord = {
        round: 1,
        draft_version: 1,
        created_at: new Date().toISOString(),
        status: "active",
        diagnosis_markdown: "",
        messages: [],
        agreed_consensus: [],
        rejected_suggestions: [],
        referenced_stances: [],
        referenced_experiences: [],
      };
      await ctx.store.saveRound(slug, round1);
      currentRound = 1;
    }

    await ctx.store.saveArticleMeta(slug, {
      ...detail.meta,
      stage: "revising",
      current_draft_version: Math.max(1, detail.meta.current_draft_version),
      current_round: Math.max(1, currentRound),
    });

    const refreshed = await ctx.store.getArticle(slug);
    return c.json({ article: refreshed });
  });

  // ---------------------------------------------------------------------------
  // Stage 2: Drafts, Diff & Round-based Editor Dialogue (SSE)
  // ---------------------------------------------------------------------------

  app.get("/:slug/drafts/:version", async (c) => {
    const slug = c.req.param("slug");
    const version = Number(c.req.param("version"));
    const content = await ctx.store.getDraft(slug, version);
    if (content === null) return c.json({ error: "未找到该版本草稿" }, 404);
    return c.json({ version, content });
  });

  app.put("/:slug/drafts/:version", async (c) => {
    const slug = c.req.param("slug");
    const version = Number(c.req.param("version"));
    const body = await c.req.json<{ content: string }>();
    await ctx.store.saveDraft(slug, version, body.content ?? "");
    return c.json({ ok: true, version });
  });

  app.get("/:slug/diff", async (c) => {
    const slug = c.req.param("slug");
    const fromV = Number(c.req.query("from"));
    const toV = Number(c.req.query("to"));
    const oldText = (await ctx.store.getDraft(slug, fromV)) ?? "";
    const newText = (await ctx.store.getDraft(slug, toV)) ?? "";
    const parts = computeDraftDiffParts(oldText, newText);
    return c.json({ from: fromV, to: toV, parts });
  });

  app.post("/:slug/rounds/:round/diagnose", async (c) => {
    const slug = c.req.param("slug");
    const roundNum = Number(c.req.param("round"));
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const targetRound = detail.rounds.find((r) => r.round === roundNum);
    if (!targetRound) return c.json({ error: "未找到该轮次记录" }, 404);

    const draftText =
      (await ctx.store.getDraft(slug, targetRound.draft_version)) ??
      detail.current_draft;

    return streamSSE(c, async (stream) => {
      const abort = new AbortController();
      stream.onAbort(() => abort.abort());

      try {
        let fullText = "";
        let referencedStances: string[] = [];
        let referencedExperiences: string[] = [];

        if (roundNum === 1) {
          const [allStances, allExperiences] = await Promise.all([
            ctx.store.listStances(),
            ctx.store.listExperiences(),
          ]);
          const matched = await retrieveRelevantArchives({
            llm: ctx.llm,
            title: detail.meta.working_title,
            draftSnippet: draftText,
            loadBearing: detail.meta.load_bearing_sentences,
            allStances,
            allExperiences,
          });
          referencedStances = matched.stances.map((s) => s.id);
          referencedExperiences = matched.experiences.map((e) => e.id);

          for await (const delta of streamRound1Diagnosis({
            llm: ctx.llm,
            title: detail.meta.working_title,
            intent: detail.meta.writing_intent,
            loadBearing: detail.meta.load_bearing_sentences,
            draftText,
            stances: matched.stances,
            experiences: matched.experiences,
            signal: abort.signal,
          })) {
            fullText += delta;
            await stream.writeSSE({
              event: "delta",
              data: JSON.stringify({ delta }),
            });
          }
        } else {
          const prevRounds = detail.rounds.filter((r) => r.round < roundNum);
          const agreedConsensus = prevRounds.flatMap((r) => r.agreed_consensus);
          const rejectedSuggestions = prevRounds.flatMap(
            (r) => r.rejected_suggestions
          );

          for await (const delta of streamNextRoundDiagnosis({
            llm: ctx.llm,
            round: roundNum,
            draftVersion: targetRound.draft_version,
            title: detail.meta.working_title,
            intent: detail.meta.writing_intent,
            loadBearing: detail.meta.load_bearing_sentences,
            agreedConsensus,
            rejectedSuggestions,
            diffFromPrev: targetRound.diff_from_prev || "",
            draftText,
            signal: abort.signal,
          })) {
            fullText += delta;
            await stream.writeSSE({
              event: "delta",
              data: JSON.stringify({ delta }),
            });
          }
        }

        const updatedRound: RoundRecord = {
          ...targetRound,
          diagnosis_markdown: fullText,
          referenced_stances: referencedStances,
          referenced_experiences: referencedExperiences,
        };
        await ctx.store.saveRound(slug, updatedRound);

        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ round: updatedRound }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: message }),
        });
      }
    });
  });

  app.post("/:slug/rounds/:round/chat", async (c) => {
    const slug = c.req.param("slug");
    const roundNum = Number(c.req.param("round"));
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const targetRound = detail.rounds.find((r) => r.round === roundNum);
    if (!targetRound) return c.json({ error: "未找到该轮次记录" }, 404);

    const body = await c.req.json<{ message: string; quote?: string }>();
    if (!body.message?.trim()) {
      return c.json({ error: "消息内容不能为空" }, 400);
    }

    const draftText =
      (await ctx.store.getDraft(slug, targetRound.draft_version)) ??
      detail.current_draft;

    const prevRounds = detail.rounds.filter((r) => r.round < roundNum);
    const accumulatedConsensus = prevRounds.flatMap((r) => r.agreed_consensus);
    const accumulatedRejected = prevRounds.flatMap(
      (r) => r.rejected_suggestions
    );

    const authorMsg = {
      id: `msg-${crypto.randomBytes(3).toString("hex")}`,
      role: "author" as const,
      content: body.message.trim(),
      quote: body.quote?.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    return streamSSE(c, async (stream) => {
      const abort = new AbortController();
      stream.onAbort(() => abort.abort());

      try {
        let fullReply = "";
        for await (const delta of streamRoundChat({
          llm: ctx.llm,
          title: detail.meta.working_title,
          intent: detail.meta.writing_intent,
          loadBearing: detail.meta.load_bearing_sentences,
          draftVersion: targetRound.draft_version,
          draftText,
          round: targetRound,
          accumulatedConsensus,
          accumulatedRejected,
          newUserMessage: authorMsg.content,
          quote: authorMsg.quote,
          signal: abort.signal,
        })) {
          fullReply += delta;
          await stream.writeSSE({
            event: "delta",
            data: JSON.stringify({ delta }),
          });
        }

        const editorMsg = {
          id: `msg-${crypto.randomBytes(3).toString("hex")}`,
          role: "editor" as const,
          content: fullReply,
          created_at: new Date().toISOString(),
        };

        const updatedRound: RoundRecord = {
          ...targetRound,
          messages: [...targetRound.messages, authorMsg, editorMsg],
        };
        await ctx.store.saveRound(slug, updatedRound);

        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ round: updatedRound }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: message }),
        });
      }
    });
  });

  app.post("/:slug/rounds/settle-preview", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const body = await c.req.json<{ next_draft: string }>();
    const activeRound = detail.rounds.find(
      (r) => r.round === detail.meta.current_round
    );
    if (!activeRound) {
      return c.json({ error: "未找到当前活跃轮次" }, 404);
    }

    const prevDraft =
      (await ctx.store.getDraft(slug, activeRound.draft_version)) ?? "";

    const preview = await previewRoundSettlement({
      llm: ctx.llm,
      currentIntent: detail.meta.writing_intent,
      round: activeRound,
      prevDraft,
      nextDraft: body.next_draft ?? prevDraft,
    });

    return c.json({ preview });
  });

  app.post("/:slug/rounds/settle-commit", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const body = await c.req.json<{
      next_draft: string;
      agreed_consensus: string[];
      rejected_suggestions: string[];
      updated_writing_intent?: WritingIntent;
    }>();

    const activeRound = detail.rounds.find(
      (r) => r.round === detail.meta.current_round
    );
    if (!activeRound) {
      return c.json({ error: "未找到当前活跃轮次" }, 404);
    }

    const prevDraft =
      (await ctx.store.getDraft(slug, activeRound.draft_version)) ?? "";
    const nextVersion = detail.meta.current_draft_version + 1;
    const nextRoundNum = detail.meta.current_round + 1;

    // 1. Settle current round
    await ctx.store.saveRound(slug, {
      ...activeRound,
      status: "settled",
      agreed_consensus: body.agreed_consensus ?? [],
      rejected_suggestions: body.rejected_suggestions ?? [],
    });

    // 2. Save new draft version
    await ctx.store.saveDraft(slug, nextVersion, body.next_draft ?? prevDraft);

    // 3. Create next round with diff from previous version
    const diffStr = formatUnifiedDraftDiff(
      prevDraft,
      body.next_draft ?? prevDraft,
      `v${activeRound.draft_version}.md`,
      `v${nextVersion}.md`
    );

    const nextRound: RoundRecord = {
      round: nextRoundNum,
      draft_version: nextVersion,
      created_at: new Date().toISOString(),
      status: "active",
      diagnosis_markdown: "",
      messages: [],
      agreed_consensus: [],
      rejected_suggestions: [],
      referenced_stances: [],
      referenced_experiences: [],
      diff_from_prev: diffStr,
    };
    await ctx.store.saveRound(slug, nextRound);

    // 4. Update article meta
    await ctx.store.saveArticleMeta(slug, {
      ...detail.meta,
      current_draft_version: nextVersion,
      current_round: nextRoundNum,
      writing_intent: body.updated_writing_intent ?? detail.meta.writing_intent,
    });

    const refreshed = await ctx.store.getArticle(slug);
    return c.json({ article: refreshed });
  });

  // ---------------------------------------------------------------------------
  // Stage 3 & 4: Titles, Compliance & Privacy Gate, Finalize & Archive Commit
  // ---------------------------------------------------------------------------

  app.post("/:slug/titles", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const body = await c.req.json<{ angleHint?: string }>().catch(() => ({
      angleHint: undefined,
    }));

    const candidates = await generateTitleCandidates({
      llm: ctx.llm,
      draftText: detail.current_draft,
      loadBearing: detail.meta.load_bearing_sentences,
      intent: detail.meta.writing_intent,
      angleHint: body.angleHint,
    });

    const meta = await ctx.store.saveArticleMeta(slug, {
      ...detail.meta,
      title_candidates: candidates,
    });

    return c.json({ title_candidates: candidates, meta });
  });

  app.post("/:slug/compliance", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const report = await runCompliancePrivacyGate({
      llm: ctx.llm,
      title: detail.meta.title || detail.meta.working_title,
      draftVersion: detail.meta.current_draft_version,
      draftText: detail.current_draft,
    });

    await ctx.store.saveComplianceReport(slug, report);
    return c.json({ compliance: report });
  });

  app.patch("/:slug/compliance/:findingId", async (c) => {
    const slug = c.req.param("slug");
    const findingId = c.req.param("findingId");
    const detail = await ctx.store.getArticle(slug);
    if (!detail?.compliance) {
      return c.json({ error: "尚未运行合规审查" }, 404);
    }

    const body = await c.req.json<{ status: FindingStatus }>();
    const updated = {
      ...detail.compliance,
      findings: detail.compliance.findings.map((f) =>
        f.id === findingId ? { ...f, status: body.status } : f
      ),
    };
    await ctx.store.saveComplianceReport(slug, updated);
    return c.json({ compliance: updated });
  });

  app.post("/:slug/finalize/preview", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const existingStances = await ctx.store.listStances();
    const preview = await extractArchiveCandidates({
      llm: ctx.llm,
      title: detail.meta.title || detail.meta.working_title,
      finalBody: detail.current_draft,
      loadBearing: detail.meta.load_bearing_sentences,
      existingStances,
    });

    return c.json({ preview, existing_stances: existingStances });
  });

  app.post("/:slug/finalize/commit", async (c) => {
    const slug = c.req.param("slug");
    const detail = await ctx.store.getArticle(slug);
    if (!detail) return c.json({ error: "未找到该文章项目" }, 404);

    const body = await c.req.json<{
      title: string;
      final_body: string;
      stances: Array<{
        topic: string;
        core_judgment: string;
        reasoning: string;
        tags: string[];
        supersedes?: string | null;
      }>;
      experiences: Array<{
        title: string;
        narrative: string;
        cost_or_lesson: string;
        tags: string[];
      }>;
    }>();

    const finalTitle =
      body.title?.trim() || detail.meta.title || detail.meta.working_title;
    const finalBody = body.final_body ?? detail.current_draft;

    // Save latest draft & final.md
    await ctx.store.saveDraft(slug, detail.meta.current_draft_version, finalBody);
    const finalMarkdown = await ctx.store.saveFinalMarkdown(
      slug,
      finalTitle,
      finalBody
    );

    // Commit chosen stances & experiences to vault/archive/
    const savedStances = [];
    for (const s of body.stances ?? []) {
      savedStances.push(
        await ctx.store.createStance({
          topic: s.topic,
          core_judgment: s.core_judgment,
          reasoning: s.reasoning,
          tags: s.tags ?? [],
          source_article: slug,
          supersedes: s.supersedes ?? null,
        })
      );
    }

    const savedExperiences = [];
    for (const e of body.experiences ?? []) {
      savedExperiences.push(
        await ctx.store.createExperience({
          title: e.title,
          narrative: e.narrative,
          cost_or_lesson: e.cost_or_lesson,
          tags: e.tags ?? [],
          source_article: slug,
        })
      );
    }

    await ctx.store.saveArticleMeta(slug, {
      ...detail.meta,
      title: finalTitle,
      stage: "finalized",
    });

    const refreshed = await ctx.store.getArticle(slug);
    return c.json({
      article: refreshed,
      final_markdown: finalMarkdown,
      saved_stances: savedStances,
      saved_experiences: savedExperiences,
    });
  });

  return app;
}
