import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import { decryptText, encryptText, maskSecret } from "@/lib/crypto";
import { getAppSetting, hasAppSetting, SETTINGS_KEYS, setAppSetting } from "@/lib/settings";

export const AI_CAPABILITIES = ["llm", "embedding", "vision", "image", "audio"] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];

export type AiModelEndpointInput = {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

export type AiModelEndpoint = {
  baseUrl: string;
  model: string;
  encryptedApiKey?: string;
};

export type AiRuntimeEndpoint = AiModelEndpoint & {
  apiKey: string;
};

export type AiModelEndpointForClient = {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  apiKeySource: "database" | "env" | "missing";
};

export type AiModelEndpoints = Record<AiCapability, AiModelEndpoint>;

export type AiModelSettings = Record<AiCapability, AiModelEndpointForClient>;

const DEFAULT_ENDPOINTS: AiModelEndpoints = {
  llm: {
    baseUrl: "",
    model: "gpt-4o"
  },
  embedding: {
    baseUrl: "",
    model: "text-embedding-3-small"
  },
  vision: {
    baseUrl: "",
    model: "gpt-4o"
  },
  image: {
    baseUrl: "",
    model: ""
  },
  audio: {
    baseUrl: "",
    model: ""
  }
};

type LegacyProvider = "openai" | "deepseek" | "custom";

type LegacyAiModelConfig = {
  provider?: LegacyProvider;
  baseUrl?: string;
  llmModel?: string;
  embeddingModel?: string;
  visionModel?: string;
  imageModel?: string;
  audioModel?: string;
};

function cleanOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanString(value: unknown, fallback: string) {
  const cleaned = cleanOptionalString(value);

  return cleaned || fallback;
}

function capabilityEnvKey(capability: AiCapability) {
  const upper = capability.toUpperCase();
  const direct = process.env[`AI_${upper}_API_KEY`];

  if (direct) {
    return direct;
  }

  if (capability === "llm") {
    return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
  }

  if (capability === "embedding" || capability === "vision" || capability === "image" || capability === "audio") {
    return process.env.OPENAI_API_KEY || "";
  }

  return "";
}

function capabilityEnvBaseUrl(capability: AiCapability) {
  const upper = capability.toUpperCase();

  return process.env[`AI_${upper}_BASE_URL`] || "";
}

function capabilityEnvModel(capability: AiCapability) {
  const upper = capability.toUpperCase();

  if (process.env[`AI_${upper}_MODEL`]) {
    return process.env[`AI_${upper}_MODEL`] || "";
  }

  if (capability === "llm") {
    return process.env.OPENAI_MODEL || DEFAULT_ENDPOINTS.llm.model;
  }

  if (capability === "embedding") {
    return process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_ENDPOINTS.embedding.model;
  }

  return DEFAULT_ENDPOINTS[capability].model;
}

function parseEndpoint(value: unknown, capability: AiCapability): AiModelEndpoint {
  const source = typeof value === "object" && value ? (value as Partial<AiModelEndpoint>) : {};

  return {
    baseUrl: cleanString(source.baseUrl, capabilityEnvBaseUrl(capability) || DEFAULT_ENDPOINTS[capability].baseUrl),
    model: cleanString(source.model, capabilityEnvModel(capability)),
    encryptedApiKey: cleanOptionalString(source.encryptedApiKey) || undefined
  };
}

function parseStoredEndpoints(value: string | null): AiModelEndpoints {
  if (!value) {
    return DEFAULT_ENDPOINTS;
  }

  try {
    const parsed = JSON.parse(value) as Partial<Record<AiCapability, Partial<AiModelEndpoint>>>;

    return AI_CAPABILITIES.reduce((acc, capability) => {
      acc[capability] = parseEndpoint(parsed[capability], capability);
      return acc;
    }, {} as AiModelEndpoints);
  } catch {
    return DEFAULT_ENDPOINTS;
  }
}

function legacyProviderBaseUrl(provider: LegacyProvider | undefined) {
  return provider === "deepseek" ? "https://api.deepseek.com/v1" : "";
}

async function legacyEndpoints(): Promise<AiModelEndpoints | null> {
  const storedConfig = await getAppSetting(SETTINGS_KEYS.aiModelConfig);

  if (!storedConfig) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedConfig) as LegacyAiModelConfig;
    const encryptedApiKey = (await getAppSetting(SETTINGS_KEYS.aiApiKey)) || undefined;
    const baseUrl = cleanString(parsed.baseUrl, legacyProviderBaseUrl(parsed.provider));

    return {
      llm: {
        baseUrl,
        model: cleanString(parsed.llmModel, DEFAULT_ENDPOINTS.llm.model),
        encryptedApiKey
      },
      embedding: {
        baseUrl,
        model: cleanOptionalString(parsed.embeddingModel),
        encryptedApiKey
      },
      vision: {
        baseUrl,
        model: cleanOptionalString(parsed.visionModel),
        encryptedApiKey
      },
      image: {
        baseUrl,
        model: cleanOptionalString(parsed.imageModel),
        encryptedApiKey
      },
      audio: {
        baseUrl,
        model: cleanOptionalString(parsed.audioModel),
        encryptedApiKey
      }
    };
  } catch {
    return null;
  }
}

export async function getAiModelConfig(): Promise<AiModelEndpoints> {
  const storedEndpoints = await getAppSetting(SETTINGS_KEYS.aiModelEndpoints);

  if (storedEndpoints) {
    return parseStoredEndpoints(storedEndpoints);
  }

  return (await legacyEndpoints()) ?? DEFAULT_ENDPOINTS;
}

export async function getAiModelSettingsForClient(): Promise<AiModelSettings> {
  const endpoints = await getAiModelConfig();

  return AI_CAPABILITIES.reduce((acc, capability) => {
    const endpoint = endpoints[capability];
    const fallbackKey = capabilityEnvKey(capability);
    const hasStoredKey = Boolean(endpoint.encryptedApiKey);

    acc[capability] = {
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      hasApiKey: Boolean(hasStoredKey || fallbackKey),
      maskedApiKey: hasStoredKey ? "已保存" : fallbackKey ? maskSecret(fallbackKey) : null,
      apiKeySource: hasStoredKey ? "database" : fallbackKey ? "env" : "missing"
    };

    return acc;
  }, {} as AiModelSettings);
}

export async function saveAiModelConfig(input: Partial<Record<AiCapability, AiModelEndpointInput>>) {
  const current = await getAiModelConfig();
  const next = { ...current };

  await Promise.all(
    AI_CAPABILITIES.map(async (capability) => {
      const incoming = input[capability];

      if (!incoming) {
        return;
      }

      next[capability] = {
        baseUrl: cleanOptionalString(incoming.baseUrl),
        model: cleanOptionalString(incoming.model),
        encryptedApiKey:
          typeof incoming.apiKey === "string" && incoming.apiKey.trim()
            ? encryptText(incoming.apiKey.trim())
            : current[capability].encryptedApiKey
      };
    })
  );

  await setAppSetting(SETTINGS_KEYS.aiModelEndpoints, JSON.stringify(next));

  return getAiModelSettingsForClient();
}

export async function getRuntimeEndpoint(
  capability: AiCapability,
  override?: AiModelEndpointInput
): Promise<AiRuntimeEndpoint> {
  const endpoints = await getAiModelConfig();
  const endpoint = endpoints[capability];
  const encryptedKey = endpoint.encryptedApiKey;
  const apiKey = cleanOptionalString(override?.apiKey) || (encryptedKey ? decryptText(encryptedKey) : capabilityEnvKey(capability));

  return {
    ...endpoint,
    baseUrl: typeof override?.baseUrl === "string" ? cleanOptionalString(override.baseUrl) : endpoint.baseUrl,
    model: typeof override?.model === "string" ? cleanOptionalString(override.model) : endpoint.model,
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

export async function createChatModel(options?: {
  capability?: Extract<AiCapability, "llm" | "vision">;
  temperature?: number;
  model?: string;
  endpoint?: AiModelEndpointInput;
}) {
  const endpoint = await getRuntimeEndpoint(options?.capability ?? "llm", options?.endpoint);
  const model = options?.model || endpoint.model;

  if (!model) {
    throw new Error("请先配置对应能力的模型名称。");
  }

  return new ChatOpenAI({
    model,
    temperature: options?.temperature ?? 0.7,
    apiKey: endpoint.apiKey || undefined,
    configuration: openAiConfiguration(endpoint.baseUrl)
  });
}

export async function createEmbeddingModel() {
  const endpoint = await getRuntimeEndpoint("embedding");

  if (!endpoint.model) {
    throw new Error("未配置向量模型。");
  }

  return createEmbeddingModelFromEndpoint(endpoint);
}

export function createEmbeddingModelFromEndpoint(endpoint: AiRuntimeEndpoint) {
  if (!endpoint.model) {
    throw new Error("未配置向量模型。");
  }

  return new OpenAIEmbeddings({
    model: endpoint.model,
    apiKey: endpoint.apiKey || undefined,
    configuration: openAiConfiguration(endpoint.baseUrl)
  });
}

export async function isAiApiKeyConfigured() {
  const settings = await getAiModelSettingsForClient();

  return (await hasAppSetting(SETTINGS_KEYS.aiModelEndpoints)) || settings.llm.hasApiKey;
}
