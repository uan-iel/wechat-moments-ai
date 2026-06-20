import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import { decryptText, encryptText, maskSecret } from "@/lib/crypto";
import { getAppSetting, hasAppSetting, SETTINGS_KEYS, setAppSetting } from "@/lib/settings";

export const AI_PROVIDERS = ["openai", "deepseek", "custom"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export type AiModelConfig = {
  provider: AiProvider;
  baseUrl: string;
  llmModel: string;
  embeddingModel: string;
  visionModel: string;
  imageModel: string;
  audioModel: string;
};

export type AiModelSettings = AiModelConfig & {
  hasApiKey: boolean;
  maskedApiKey: string | null;
  apiKeySource: "database" | "env" | "missing";
};

export const DEFAULT_AI_MODEL_CONFIG: AiModelConfig = {
  provider: "openai",
  baseUrl: "",
  llmModel: "gpt-4o",
  embeddingModel: "text-embedding-3-small",
  visionModel: "gpt-4o",
  imageModel: "gpt-image-1",
  audioModel: "gpt-4o-mini-transcribe"
};

function normalizeProvider(value: unknown): AiProvider {
  return AI_PROVIDERS.includes(value as AiProvider) ? (value as AiProvider) : "openai";
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function providerDefaultBaseUrl(provider: AiProvider) {
  if (provider === "deepseek") {
    return "https://api.deepseek.com/v1";
  }

  return "";
}

function envApiKey(provider: AiProvider) {
  if (provider === "deepseek") {
    return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
  }

  return process.env.OPENAI_API_KEY || "";
}

function parseStoredConfig(value: string | null) {
  if (!value) {
    return DEFAULT_AI_MODEL_CONFIG;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AiModelConfig>;
    const provider = normalizeProvider(parsed.provider);
    return {
      provider,
      baseUrl: cleanString(parsed.baseUrl, providerDefaultBaseUrl(provider)),
      llmModel: cleanString(parsed.llmModel, process.env.OPENAI_MODEL || DEFAULT_AI_MODEL_CONFIG.llmModel),
      embeddingModel: cleanOptionalString(parsed.embeddingModel),
      visionModel: cleanOptionalString(parsed.visionModel),
      imageModel: cleanOptionalString(parsed.imageModel),
      audioModel: cleanOptionalString(parsed.audioModel)
    } satisfies AiModelConfig;
  } catch {
    return DEFAULT_AI_MODEL_CONFIG;
  }
}

export async function getAiModelConfig() {
  const storedConfig = await getAppSetting(SETTINGS_KEYS.aiModelConfig);
  const parsed = parseStoredConfig(storedConfig);

  return {
    ...parsed,
    baseUrl: parsed.baseUrl || providerDefaultBaseUrl(parsed.provider),
    llmModel: parsed.llmModel || process.env.OPENAI_MODEL || DEFAULT_AI_MODEL_CONFIG.llmModel,
    embeddingModel: parsed.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || ""
  };
}

export async function getAiModelSettingsForClient(): Promise<AiModelSettings> {
  const config = await getAiModelConfig();
  const storedKey = await getAppSetting(SETTINGS_KEYS.aiApiKey);
  const fallbackKey = envApiKey(config.provider);

  return {
    ...config,
    hasApiKey: Boolean(storedKey || fallbackKey),
    maskedApiKey: storedKey
      ? "已保存"
      : fallbackKey
        ? maskSecret(fallbackKey)
        : null,
    apiKeySource: storedKey ? "database" : fallbackKey ? "env" : "missing"
  };
}

export async function saveAiModelConfig(input: Partial<AiModelConfig> & { apiKey?: string }) {
  const current = await getAiModelConfig();
  const provider = normalizeProvider(input.provider ?? current.provider);
  const next: AiModelConfig = {
    provider,
    baseUrl: cleanString(input.baseUrl, providerDefaultBaseUrl(provider)),
    llmModel: cleanString(input.llmModel, current.llmModel),
    embeddingModel: cleanOptionalString(input.embeddingModel),
    visionModel: cleanOptionalString(input.visionModel),
    imageModel: cleanOptionalString(input.imageModel),
    audioModel: cleanOptionalString(input.audioModel)
  };

  await setAppSetting(SETTINGS_KEYS.aiModelConfig, JSON.stringify(next));

  if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    await setAppSetting(SETTINGS_KEYS.aiApiKey, encryptText(input.apiKey.trim()));
  }

  return getAiModelSettingsForClient();
}

async function getRuntimeApiKey(provider: AiProvider) {
  const encryptedKey = await getAppSetting(SETTINGS_KEYS.aiApiKey);

  if (encryptedKey) {
    return decryptText(encryptedKey);
  }

  return envApiKey(provider);
}

export async function getAiRuntimeConfig() {
  const config = await getAiModelConfig();
  const apiKey = await getRuntimeApiKey(config.provider);

  return {
    ...config,
    apiKey
  };
}

function openAiConfiguration(baseUrl: string) {
  return baseUrl
    ? {
        baseURL: baseUrl
      }
    : undefined;
}

export async function createChatModel(options?: { temperature?: number; model?: string }) {
  const config = await getAiRuntimeConfig();

  return new ChatOpenAI({
    model: options?.model || config.llmModel,
    temperature: options?.temperature ?? 0.7,
    apiKey: config.apiKey || undefined,
    configuration: openAiConfiguration(config.baseUrl)
  });
}

export async function createEmbeddingModel() {
  const config = await getAiRuntimeConfig();

  if (!config.embeddingModel) {
    throw new Error("未配置向量模型。");
  }

  return new OpenAIEmbeddings({
    model: config.embeddingModel,
    apiKey: config.apiKey || undefined,
    configuration: openAiConfiguration(config.baseUrl)
  });
}

export async function isAiApiKeyConfigured() {
  const config = await getAiModelConfig();
  return (await hasAppSetting(SETTINGS_KEYS.aiApiKey)) || Boolean(envApiKey(config.provider));
}
