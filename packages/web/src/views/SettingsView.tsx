import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PlugZap, Save } from "lucide-react";
import type { SafeAppConfig } from "@writing/core/types";
import { api } from "../api/client";

interface SettingsViewProps {
  onConfigUpdated: (cfg: SafeAppConfig) => void;
  onError: (msg: string) => void;
  onNotify: (msg: string) => void;
}

export function SettingsView({
  onConfigUpdated,
  onError,
  onNotify,
}: SettingsViewProps) {
  const [cfg, setCfg] = useState<SafeAppConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [lightModel, setLightModel] = useState("");
  const [vaultDir, setVaultDir] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getSettings()
      .then((res) => {
        setCfg(res);
        setBaseUrl(res.llm.baseUrl);
        setModel(res.llm.model);
        setLightModel(res.llm.lightModel);
        setVaultDir(res.vaultDir);
      })
      .catch((err) =>
        onError(err instanceof Error ? err.message : String(err))
      );
  }, [onError]);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const updated = await api.updateSettings({
        vaultDir,
        llm: {
          baseUrl,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          model,
          lightModel,
        },
      });
      setCfg(updated);
      setApiKey("");
      onConfigUpdated(updated);
      onNotify("配置已保存到 vault/config.local.yaml");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testSettings();
      if (res.ok) {
        setTestResult(`连接成功 · 模型 ${res.model} 返回：${res.reply}`);
      } else {
        onError(res.error || "连接测试失败");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F9F8F4]">
      <header className="px-6 py-4 border-b border-[#E7E4DC] bg-white">
        <h1 className="text-base font-semibold text-[#1F1E1C]">系统设置</h1>
        <p className="text-xs text-[#78716C] mt-0.5">
          支持 DeepSeek 官方 API 或任意 OpenAI 兼容协议中转站；Key 仅保存在本地（已加入 .gitignore）
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="rounded-xl border border-[#E7E4DC] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1F1E1C]">
                大模型接口配置（OpenAI 兼容协议）
              </h2>
              <button
                type="button"
                onClick={() => {
                  setBaseUrl("https://api.deepseek.com/v1");
                  setModel("deepseek-chat");
                }}
                className="text-xs text-amber-800 hover:underline"
              >
                一键填入 DeepSeek 官方默认
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#292524] mb-1">
                API Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                className="w-full rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-3 py-2 text-sm focus:outline-none focus:border-[#B45309]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#292524] mb-1">
                API Key
                {cfg?.llm.hasApiKey && (
                  <span className="ml-2 text-emerald-700 font-normal">
                    已配置：{cfg.llm.apiKeyMasked}（留空则保持原 Key 不变）
                  </span>
                )}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  cfg?.llm.hasApiKey
                    ? "输入新 Key 以覆盖，或留空保持不变"
                    : "sk-..."
                }
                className="w-full rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-3 py-2 text-sm focus:outline-none focus:border-[#B45309]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#292524] mb-1">
                  主力深度模型（脉络 / 主编 / 合规审查）
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="deepseek-chat / deepseek-reasoner / claude-..."
                  className="w-full rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-3 py-2 text-sm focus:outline-none focus:border-[#B45309]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292524] mb-1">
                  轻量模型（选填：打标 / 清洗 / 共识压缩）
                </label>
                <input
                  type="text"
                  value={lightModel}
                  onChange={(e) => setLightModel(e.target.value)}
                  placeholder="留空则默认复用主力模型"
                  className="w-full rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-3 py-2 text-sm focus:outline-none focus:border-[#B45309]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E7E4DC] bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#1F1E1C]">
              本地 Markdown 资产库路径（Vault）
            </h2>
            <input
              type="text"
              value={vaultDir}
              onChange={(e) => setVaultDir(e.target.value)}
              className="w-full rounded-lg border border-[#D6D3CB] bg-[#FCFBF8] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#B45309]"
            />
            <p className="text-xs text-[#78716C]">
              所有原始口述、草稿版本、主编讨论与立场档案都以纯文本 Markdown 存在此目录下，随时可用 Obsidian 或任意编辑器打开。
            </p>
          </div>

          {testResult && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#1F1E1C] text-white hover:bg-[#3A3834] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              保存设置
            </button>

            <button
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[#D6D3CB] bg-white text-[#1F1E1C] hover:bg-[#FAF9F5] disabled:opacity-50"
            >
              {testing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <PlugZap size={15} />
              )}
              测试 API 连通性
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
