/**
 * Extracts a JSON object or array from an LLM response that may be wrapped in
 * markdown code fences or contain brief leading/trailing commentary.
 */
export function parseLLMJson<T>(raw: string): T {
  const trimmed = raw.trim();

  // 1. Try direct parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue
  }

  // 2. Try ```json ... ``` fenced block
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // 3. Try outermost {...} or [...]
  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  let start = -1;
  let openChar = "{";
  let closeChar = "}";

  if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
    start = firstObj;
    openChar = "{";
    closeChar = "}";
  } else if (firstArr !== -1) {
    start = firstArr;
    openChar = "[";
    closeChar = "]";
  }

  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === openChar) {
        depth++;
      } else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          return JSON.parse(candidate) as T;
        }
      }
    }
  }

  throw new Error(`无法从 LLM 响应中解析有效 JSON：${trimmed.slice(0, 200)}`);
}
