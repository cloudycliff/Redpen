import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  LLMClient,
  VaultStore,
  type AppConfig,
  type LLMConfig,
  type SafeAppConfig,
} from "@writing/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(WORKSPACE_ROOT, ".env") });

function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

export class ServerContext {
  private config: AppConfig;
  store: VaultStore;
  readonly llm: LLMClient;

  constructor() {
    const defaultVaultDir = path.resolve(
      WORKSPACE_ROOT,
      process.env.VAULT_DIR || "./vault"
    );
    this.config = {
      vaultDir: defaultVaultDir,
      llm: {
        baseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
        apiKey: process.env.LLM_API_KEY || "",
        model: process.env.LLM_MODEL || "deepseek-chat",
        lightModel: process.env.LLM_LIGHT_MODEL || "",
      },
    };
    this.store = new VaultStore(this.config.vaultDir);
    this.llm = new LLMClient(() => this.config.llm);
  }

  async init(): Promise<void> {
    await this.store.ensureLayout();
    const local = await this.store.readLocalConfig();
    if (local.vaultDir?.trim()) {
      const resolved = path.resolve(WORKSPACE_ROOT, local.vaultDir.trim());
      if (resolved !== this.config.vaultDir) {
        this.config.vaultDir = resolved;
        this.store = new VaultStore(resolved);
        await this.store.ensureLayout();
      }
    }
    if (local.llm) {
      this.config.llm = {
        baseUrl: local.llm.baseUrl || this.config.llm.baseUrl,
        apiKey: local.llm.apiKey || this.config.llm.apiKey,
        model: local.llm.model || this.config.llm.model,
        lightModel: local.llm.lightModel ?? this.config.llm.lightModel,
      };
    }
  }

  getLLMConfig(): LLMConfig {
    return this.config.llm;
  }

  hasApiKey(): boolean {
    return Boolean(this.config.llm.apiKey?.trim());
  }

  getSafeConfig(): SafeAppConfig {
    return {
      vaultDir: this.config.vaultDir,
      llm: {
        baseUrl: this.config.llm.baseUrl,
        apiKeyMasked: maskApiKey(this.config.llm.apiKey),
        hasApiKey: this.hasApiKey(),
        model: this.config.llm.model,
        lightModel: this.config.llm.lightModel,
      },
    };
  }

  async updateConfig(patch: {
    vaultDir?: string;
    llm?: Partial<LLMConfig>;
  }): Promise<SafeAppConfig> {
    if (patch.llm) {
      this.config.llm = {
        baseUrl: patch.llm.baseUrl?.trim() || this.config.llm.baseUrl,
        apiKey:
          patch.llm.apiKey !== undefined && patch.llm.apiKey.trim() !== ""
            ? patch.llm.apiKey.trim()
            : this.config.llm.apiKey,
        model: patch.llm.model?.trim() || this.config.llm.model,
        lightModel:
          patch.llm.lightModel !== undefined
            ? patch.llm.lightModel.trim()
            : this.config.llm.lightModel,
      };
    }

    if (patch.vaultDir?.trim()) {
      const resolved = path.resolve(WORKSPACE_ROOT, patch.vaultDir.trim());
      this.config.vaultDir = resolved;
      this.store = new VaultStore(resolved);
      await this.store.ensureLayout();
    }

    await this.store.writeLocalConfig({
      vaultDir: this.config.vaultDir,
      llm: this.config.llm,
    });

    return this.getSafeConfig();
  }
}
