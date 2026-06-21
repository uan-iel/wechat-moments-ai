"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Eye, FileText, ImageIcon, KeyRound, Loader2, Mic, RefreshCw, Save, Search, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Capability = "llm" | "embedding" | "vision" | "image" | "audio";

type EndpointSettings = {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  apiKeySource: "database" | "env" | "missing";
};

type SettingsPayload = {
  aiModelSettings: Record<Capability, EndpointSettings>;
};

type EndpointDraft = EndpointSettings & {
  apiKey: string;
};

type CapabilityFeedback = {
  ok: boolean;
  message: string;
  elapsedMs?: number;
};

const capabilityMeta: Array<{
  key: Capability;
  title: string;
  description: string;
  icon: typeof FileText;
  modelPlaceholder: string;
  baseUrlPlaceholder: string;
}> = [
  {
    key: "llm",
    title: "文案语言模型",
    description: "用于文案生成、内容形式分析和 AI 改写。DeepSeek 放这里就很合适。",
    icon: FileText,
    modelPlaceholder: "deepseek-chat / gpt-4o / qwen-plus",
    baseUrlPlaceholder: "https://api.deepseek.com/v1"
  },
  {
    key: "embedding",
    title: "向量检索模型",
    description: "用于素材语义检索；留空时会自动使用本地关键词检索。",
    icon: Search,
    modelPlaceholder: "text-embedding-3-small",
    baseUrlPlaceholder: "OpenAI 官方可留空"
  },
  {
    key: "vision",
    title: "图片理解模型",
    description: "用于识别产品图片特征，并把分析结果融入文案。",
    icon: Eye,
    modelPlaceholder: "qwen-vl-plus / gpt-4o",
    baseUrlPlaceholder: "你的视觉模型 OpenAI-compatible Base URL"
  },
  {
    key: "image",
    title: "图片生成模型",
    description: "预留能力。当前不会自动生图，只保存配置，方便后续扩展。",
    icon: ImageIcon,
    modelPlaceholder: "seedance / gpt-image-1",
    baseUrlPlaceholder: "图片模型 Base URL"
  },
  {
    key: "audio",
    title: "音频模型",
    description: "预留能力。后续可用于语音转文字或口播脚本处理。",
    icon: Mic,
    modelPlaceholder: "gpt-4o-mini-transcribe",
    baseUrlPlaceholder: "音频模型 Base URL"
  }
];

function emptyEndpoint(): EndpointDraft {
  return {
    baseUrl: "",
    model: "",
    hasApiKey: false,
    maskedApiKey: null,
    apiKeySource: "missing",
    apiKey: ""
  };
}

function emptyDrafts(): Record<Capability, EndpointDraft> {
  return {
    llm: emptyEndpoint(),
    embedding: emptyEndpoint(),
    vision: emptyEndpoint(),
    image: emptyEndpoint(),
    audio: emptyEndpoint()
  };
}

export function SettingsPanel() {
  const [drafts, setDrafts] = useState<Record<Capability, EndpointDraft>>(emptyDrafts);
  const [modelOptions, setModelOptions] = useState<Record<Capability, string[]>>({
    llm: [],
    embedding: [],
    vision: [],
    image: [],
    audio: []
  });
  const [fetchingModels, setFetchingModels] = useState<Capability | null>(null);
  const [testResults, setTestResults] = useState<Partial<Record<Capability, CapabilityFeedback>>>({});
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<Capability | null>(null);
  const [message, setMessage] = useState("");

  async function loadSettings() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const payload = (await response.json()) as { settings: SettingsPayload };
    setDrafts((current) => {
      const next = { ...current };

      capabilityMeta.forEach(({ key }) => {
        next[key] = {
          ...payload.settings.aiModelSettings[key],
          apiKey: ""
        };
      });

      return next;
    });
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function updateEndpoint(capability: Capability, patch: Partial<EndpointDraft>) {
    setDrafts((current) => ({
      ...current,
      [capability]: {
        ...current[capability],
        ...patch
      }
    }));
    setTestResults((current) => {
      const next = { ...current };
      delete next[capability];
      return next;
    });
  }

  function endpointPayload(capability: Capability) {
    return {
      baseUrl: drafts[capability].baseUrl,
      model: drafts[capability].model,
      apiKey: drafts[capability].apiKey
    };
  }

  async function fetchModels(capability: Capability) {
    setFetchingModels(capability);
    setMessage("");
    setTestResults((current) => ({
      ...current,
      [capability]: {
        ok: false,
        message: "正在获取模型列表..."
      }
    }));

    try {
      const response = await fetch("/api/settings/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          capability,
          endpoint: {
            baseUrl: drafts[capability].baseUrl,
            apiKey: drafts[capability].apiKey
          }
        })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        models?: string[];
        error?: string;
        elapsedMs?: number;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "获取模型列表失败");
      }

      setModelOptions((current) => ({
        ...current,
        [capability]: payload.models || []
      }));
      setTestResults((current) => ({
        ...current,
        [capability]: {
          ok: true,
          message: payload.models?.length ? `已获取 ${payload.models.length} 个模型。` : "已连接，但没有返回可选模型。",
          elapsedMs: payload.elapsedMs
        }
      }));
    } catch (error) {
      setTestResults((current) => ({
        ...current,
        [capability]: {
          ok: false,
          message: error instanceof Error ? error.message : "获取模型列表失败"
        }
      }));
    } finally {
      setFetchingModels(null);
    }
  }

  async function saveSettings() {
    setBusy(true);
    setMessage("");
    try {
      const aiModelConfig = Object.fromEntries(
        capabilityMeta.map(({ key }) => [
          key,
          {
            baseUrl: drafts[key].baseUrl,
            model: drafts[key].model,
            apiKey: drafts[key].apiKey
          }
        ])
      );
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ aiModelConfig })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "保存设置失败");
      }

      setMessage("模型能力配置已保存。");
      await loadSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存设置失败");
    } finally {
      setBusy(false);
    }
  }

  async function testCapability(capability: Capability) {
    setTesting(capability);
    setMessage("");
    setTestResults((current) => ({
      ...current,
      [capability]: {
        ok: false,
        message: "正在测试..."
      }
    }));

    try {
      const response = await fetch("/api/settings/test-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          capability,
          endpoint: endpointPayload(capability)
        })
      });
      const payload = (await response.json()) as { ok?: boolean; response?: string; error?: string; elapsedMs?: number };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "模型连通测试失败");
      }

      setTestResults((current) => ({
        ...current,
        [capability]: {
          ok: true,
          message: payload.response || "模型配置可用。",
          elapsedMs: payload.elapsedMs
        }
      }));
    } catch (error) {
      setTestResults((current) => ({
        ...current,
        [capability]: {
          ok: false,
          message: error instanceof Error ? error.message : "模型连通测试失败"
        }
      }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="panel-card">
        <CardHeader>
          <CardTitle>按能力配置模型</CardTitle>
          <CardDescription>
            每种能力都可以使用不同厂商、Base URL、模型名称和 API Key。文案模型可以接 DeepSeek，图片理解可以接 Qwen-VL 或其他兼容接口。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {capabilityMeta.map((item) => {
            const Icon = item.icon;
            const draft = drafts[item.key];
            const options = Array.from(new Set([draft.model, ...modelOptions[item.key]].filter(Boolean)));
            const feedback = testResults[item.key];

            return (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${item.key}-baseUrl`}>Base URL</Label>
                    <Input
                      id={`${item.key}-baseUrl`}
                      value={draft.baseUrl}
                      onChange={(event) => updateEndpoint(item.key, { baseUrl: event.target.value })}
                      placeholder={item.baseUrlPlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${item.key}-model-select`}>可选模型</Label>
                    <select
                      id={`${item.key}-model-select`}
                      className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={options.includes(draft.model) ? draft.model : ""}
                      onChange={(event) => {
                        if (event.target.value) {
                          updateEndpoint(item.key, { model: event.target.value });
                        }
                      }}
                    >
                      <option value="">{options.length ? "从列表选择，或下方手填" : "先获取模型，或下方手填"}</option>
                      {options.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">供应商可能隐藏部分模型；没有出现在列表时可手动填写。</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <Label htmlFor={`${item.key}-model`}>模型名称</Label>
                  <Input
                    id={`${item.key}-model`}
                    value={draft.model}
                    onChange={(event) => updateEndpoint(item.key, { model: event.target.value })}
                    placeholder={item.modelPlaceholder}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <Label htmlFor={`${item.key}-apiKey`}>API Key</Label>
                  <Input
                    id={`${item.key}-apiKey`}
                    type="password"
                    value={draft.apiKey}
                    onChange={(event) => updateEndpoint(item.key, { apiKey: event.target.value })}
                    placeholder={draft.hasApiKey ? `已配置：${draft.maskedApiKey}` : "sk-..."}
                  />
                  <p className="text-xs text-muted-foreground">
                    密钥来源：{draft.apiKeySource === "database" ? "页面保存" : draft.apiKeySource === "env" ? ".env" : "未配置"}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchModels(item.key)}
                    disabled={fetchingModels === item.key}
                  >
                    {fetchingModels === item.key ? (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                    )}
                    获取模型
                  </Button>
                  <Button
                    type="button"
                    variant={feedback?.ok ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => testCapability(item.key)}
                    disabled={testing === item.key}
                  >
                    {testing === item.key ? (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />
                    )}
                    测试
                  </Button>
                </div>
                {feedback ? (
                  <div
                    className={cn(
                      "mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm",
                      feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                    )}
                  >
                    {feedback.ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
                    <span>{feedback.message}</span>
                    {typeof feedback.elapsedMs === "number" ? (
                      <span className="inline-flex items-center gap-1 text-xs opacity-80">
                        <Clock className="size-3" aria-hidden="true" />
                        {feedback.elapsedMs}ms
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={saveSettings} disabled={busy}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 size-4" aria-hidden="true" />}
          保存全部模型配置
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="size-4" aria-hidden="true" />
          API Key 会加密写入本地数据库。
        </div>
      </div>
    </div>
  );
}
