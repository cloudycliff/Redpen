import type {
  ExperienceRecord,
  LoadBearingSentence,
  StanceRecord,
} from "../types.js";
import type { LLMClient } from "../llm/client.js";
import { parseLLMJson } from "../llm/json.js";
import {
  ARCHIVE_RETRIEVE_SYSTEM,
  formatLoadBearingList,
} from "../prompts/templates.js";

export async function retrieveRelevantArchives(params: {
  llm: LLMClient;
  title: string;
  draftSnippet: string;
  loadBearing: LoadBearingSentence[];
  allStances: StanceRecord[];
  allExperiences: ExperienceRecord[];
}): Promise<{ stances: StanceRecord[]; experiences: ExperienceRecord[] }> {
  if (params.allStances.length === 0 && params.allExperiences.length === 0) {
    return { stances: [], experiences: [] };
  }

  const stanceIndex = params.allStances.map((s) => ({
    id: s.id,
    topic: s.topic,
    status: s.status,
    core_judgment: s.core_judgment,
    tags: s.tags,
  }));

  const expIndex = params.allExperiences.map((e) => ({
    id: e.id,
    title: e.title,
    narrative: e.narrative.slice(0, 80),
    tags: e.tags,
  }));

  try {
    const raw = await params.llm.complete({
      tier: "light",
      temperature: 0.1,
      messages: [
        { role: "system", content: ARCHIVE_RETRIEVE_SYSTEM },
        {
          role: "user",
          content: `## 当前文章\n标题：${params.title}\n承重句：\n${formatLoadBearingList(params.loadBearing)}\n正文前段摘录：${params.draftSnippet.slice(0, 500)}\n\n## 历史立场索引\n${JSON.stringify(stanceIndex, null, 2)}\n\n## 历史经历索引\n${JSON.stringify(expIndex, null, 2)}`,
        },
      ],
    });

    const parsed = parseLLMJson<{
      stance_ids?: string[];
      experience_ids?: string[];
    }>(raw);

    const stanceSet = new Set(parsed.stance_ids ?? []);
    const expSet = new Set(parsed.experience_ids ?? []);

    return {
      stances: params.allStances.filter((s) => stanceSet.has(s.id)).slice(0, 5),
      experiences: params.allExperiences
        .filter((e) => expSet.has(e.id))
        .slice(0, 5),
    };
  } catch {
    return { stances: [], experiences: [] };
  }
}
