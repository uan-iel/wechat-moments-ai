"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Save, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AiModelSettings = {
  provider: "openai" | "deepseek" | "custom";
  baseUrl: string;
  llmModel: string;
  embeddingModel: string;
  visionModel: string;
  imageModel: string;
  audioModel: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  apiKeySource: "database" | "env" | "missing";
};

type SettingsPayload = {
  aiModelSettings: AiModelSettings;
};

const defaults: Record<AiModelSettings["provider"], Partial<AiModelSettings>> = {
  openai: {
    baseUrl: "",
    llmModel: "gpt-4o",
    embeddingModel: "text-embedding-3-small",
    visionModel: "gpt-4o",
    imageModel: "gpt-image-1",
    audioModel: "gpt-4o-mini-transcribe"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    llmModel: "deepseek-chat",
    embeddingModel: "",
    visionModel: "",
    imageModel: "",
    audioModel: ""
  },
  custom: {
    baseUrl: "https://your-gateway.example.com/v1",
    llmModel: "gpt-4o",
    embeddingModel: "",
    visionModel: "",
    imageModel: "",
    audioModel: ""
  }
};

function emptySettings(): AiModelSettings {
  return {
    provider: "openai",
    baseUrl: "",
    llmModel: "gpt-4o",
    embeddingModel: "text-embedding-3-small",
    visionModel: "gpt-4o",
    imageModel: "gpt-image-1",
    audioModel: "gpt-4o-mini-transcribe",
    hasApiKey: false,
    maskedApiKey: null,
    apiKeySource: "missing"
  };
}

export function SettingsPanel() {
  const [aiConfig, setAiConfig] = useState<AiModelSettings>(emptySettings);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSettings() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const payload = (await response.json()) as { settings: SettingsPayload };
    setAiConfig(payload.settings.aiModelSettings);
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function updateConfig<K extends keyof AiModelSettings>(key: K, value: AiModelSettings[K]) {
    setAiConfig((current) => ({
      ...current,
      [key]: value
    }));
  }

  function changeProvider(provider: AiModelSettings["provider"]) {
    setAiConfig((current) => ({
      ...current,
      provider,
      ...defaults[provider]
    }));
  }

  async function saveSettings() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          aiModelConfig: {
            ...aiConfig,
            apiKey
          }
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "保存设置失败");
      }

      setApiKey("");
      setMessage("模型设置已保存。");
      await loadSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存设置失败");
    } finally {
      setBusy(false);
    }
  }

  async function testModel() {
    setTesting(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/test-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ capability: "llm" })
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || payload.error || "模型连通测试失败");
      }

      setMessage(payload.message || "模型连通测试通过。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模型连通测试失败");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Card className="panel-card">
        <CardHeader>
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Settings2 className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>AI 模型配置</CardTitle>
          <CardDescription>风格分析、素材检索和文案生成都会使用这里的配置。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {(["openai", "deepseek", "custom"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => changeProvider(provider)}
                className={`rounded-xl border p-4 text-left text-sm ${
                  aiConfig.provider === provider ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-slate-200 bg-white"
                }`}
              >
                <span className="font-semibold capitalize">{provider}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {provider === "openai" ? "官方 OpenAI" : provider === "deepseek" ? "DeepSeek 兼容接口" : "OpenAI 兼容网关"}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input id="baseUrl" value={aiConfig.baseUrl} onChange={(event) => updateConfig("baseUrl", event.target.value)} placeholder="OpenAI 官方可留空" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llmModel">文案模型（必填）</Label>
              <Input id="llmModel" value={aiConfig.llmModel} onChange={(event) => updateConfig("llmModel", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="embeddingModel">向量模型（可选）</Label>
              <Input id="embeddingModel" value={aiConfig.embeddingModel} onChange={(event) => updateConfig("embeddingModel", event.target.value)} placeholder="留空则使用本地关键词检索" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visionModel">视觉模型（可选）</Label>
              <Input id="visionModel" value={aiConfig.visionModel} onChange={(event) => updateConfig("visionModel", event.target.value)} placeholder="暂不使用可留空" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageModel">图片模型（可选）</Label>
              <Input id="imageModel" value={aiConfig.imageModel} onChange={(event) => updateConfig("imageModel", event.target.value)} placeholder="暂不使用可留空" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audioModel">语音模型（可选）</Label>
              <Input id="audioModel" value={aiConfig.audioModel} onChange={(event) => updateConfig("audioModel", event.target.value)} placeholder="暂不使用可留空" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={aiConfig.hasApiKey ? `已配置：${aiConfig.maskedApiKey}` : "sk-..."}
            />
          </div>

          {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveSettings} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 size-4" aria-hidden="true" />}
              保存设置
            </Button>
            <Button type="button" variant="outline" onClick={testModel} disabled={testing}>
              {testing ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />}
              测试文案模型
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="panel-card h-fit">
        <CardHeader>
          <div className="flex size-11 items-center justify-center rounded-xl bg-slate-950 text-white">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>当前密钥状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>Provider：{aiConfig.provider}</p>
          <p>密钥来源：{aiConfig.apiKeySource === "database" ? "页面保存" : aiConfig.apiKeySource === "env" ? ".env" : "未配置"}</p>
          <p>页面保存的新 API Key 会加密后写入本地数据库。</p>
        </CardContent>
      </Card>
    </div>
  );
}
