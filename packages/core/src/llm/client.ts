import type { LLMConfig } from "../types.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  tier?: "deep" | "light";
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export class LLMClientError extends Error {
  status?: number;
  body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = "LLMClientError";
    this.status = status;
    this.body = body;
  }
}

export class LLMClient {
  private getConfig: () => LLMConfig;

  constructor(configOrGetter: LLMConfig | (() => LLMConfig)) {
    this.getConfig =
      typeof configOrGetter === "function"
        ? configOrGetter
        : () => configOrGetter;
  }

  private resolveEndpoint(tier: "deep" | "light" = "deep") {
    const cfg = this.getConfig();
    if (!cfg.apiKey?.trim()) {
      throw new LLMClientError(
        "尚未配置 LLM API Key，请先在「设置」页填写 DeepSeek 或中转站 API Key。"
      );
    }
    const base = (cfg.baseUrl || "https://api.deepseek.com/v1").replace(
      /\/+$/,
      ""
    );
    const url = base.endsWith("/chat/completions")
      ? base
      : `${base}/chat/completions`;
    const model =
      tier === "light" && cfg.lightModel?.trim()
        ? cfg.lightModel.trim()
        : cfg.model?.trim() || "deepseek-chat";
    return { url, apiKey: cfg.apiKey.trim(), model };
  }

  async complete(options: ChatCompletionOptions): Promise<string> {
    const { url, apiKey, model } = this.resolveEndpoint(options.tier ?? "deep");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.4,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        stream: false,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new LLMClientError(
        `LLM 请求失败 (HTTP ${response.status}): ${errText.slice(0, 300)}`,
        response.status,
        errText
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new LLMClientError("LLM 返回内容为空或格式不符合 OpenAI 协议。");
    }
    return content;
  }

  async *stream(options: ChatCompletionOptions): AsyncGenerator<string> {
    const { url, apiKey, model } = this.resolveEndpoint(options.tier ?? "deep");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.5,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        stream: true,
      }),
      signal: options.signal,
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new LLMClientError(
        `LLM 流式请求失败 (HTTP ${response.status}): ${errText.slice(0, 300)}`,
        response.status,
        errText
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch {
            // Ignore malformed SSE partial chunk
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async testConnection(): Promise<{ ok: boolean; model: string; reply: string }> {
    const { model } = this.resolveEndpoint("deep");
    const reply = await this.complete({
      tier: "deep",
      temperature: 0,
      maxTokens: 32,
      messages: [
        {
          role: "user",
          content: "请只回复 OK",
        },
      ],
    });
    return { ok: true, model, reply: reply.trim() };
  }
}
