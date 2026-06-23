import { existsSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { getAppSetting, setAppSetting } from "@/lib/settings";

const SETTINGS = {
  path: "research.xhs.mediaCrawler.path",
  baseUrl: "research.xhs.mediaCrawler.baseUrl",
  startCommand: "research.xhs.mediaCrawler.startCommand"
} as const;

type WorkerConfig = {
  path: string;
  baseUrl: string;
  startCommand: string;
};

export type LoginBrowserStatus = {
  debugPort: number;
  profileDir: string;
  running: boolean;
  healthy: boolean;
  browserVersion: string | null;
  webSocketDebuggerUrl: string | null;
};

type WorkerHealth = {
  configured: boolean;
  baseUrl: string;
  path: string;
  startCommand: string;
  healthy: boolean;
  running: boolean;
  lastError: string | null;
  logs: string[];
};

const EXTRA_COMMAND_PATHS = [
  path.join(os.homedir(), ".local/bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin"
];

type GlobalWorkerState = {
  process: ChildProcessWithoutNullStreams | null;
  logs: string[];
  lastError: string | null;
  installing: boolean;
};

function state() {
  const globalState = globalThis as unknown as {
    xhsMediaCrawlerWorker?: GlobalWorkerState;
  };

  if (!globalState.xhsMediaCrawlerWorker) {
    globalState.xhsMediaCrawlerWorker = {
      process: null,
      logs: [],
      lastError: null,
      installing: false
    };
  }

  return globalState.xhsMediaCrawlerWorker;
}

function pushLog(message: string) {
  const current = state();
  current.logs = [...current.logs.slice(-119), `[${new Date().toLocaleString("zh-CN")}] ${message}`];
}

function looksLikeError(message: string) {
  return /command not found|error|failed|traceback|exception|no such file|not found|permission denied/i.test(message);
}

function commandEnv() {
  return {
    ...process.env,
    PATH: Array.from(new Set([...EXTRA_COMMAND_PATHS, process.env.PATH || ""]))
      .filter(Boolean)
      .join(":")
  };
}

export async function getMediaCrawlerConfig(): Promise<WorkerConfig> {
  const [path, baseUrl, startCommand] = await Promise.all([
    getAppSetting(SETTINGS.path),
    getAppSetting(SETTINGS.baseUrl),
    getAppSetting(SETTINGS.startCommand)
  ]);

  const defaultPath = path?.trim() || detectDefaultMediaCrawlerPath();

  return {
    path: defaultPath,
    baseUrl: baseUrl || "http://127.0.0.1:8088",
    startCommand: startCommand || "uv run uvicorn api.main:app --host 127.0.0.1 --port 8088"
  };
}

function detectDefaultMediaCrawlerPath() {
  const bundledPath = path.resolve(process.cwd(), ".crawler/MediaCrawler");
  const legacyPath = path.join(os.homedir(), "MediaCrawler");

  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  return existsSync(legacyPath) ? legacyPath : "";
}

export async function saveMediaCrawlerConfig(input: Partial<WorkerConfig>) {
  const current = await getMediaCrawlerConfig();
  const next = {
    path: typeof input.path === "string" ? input.path.trim() : current.path,
    baseUrl: typeof input.baseUrl === "string" ? input.baseUrl.trim() : current.baseUrl,
    startCommand: typeof input.startCommand === "string" ? input.startCommand.trim() : current.startCommand
  };

  await Promise.all([
    setAppSetting(SETTINGS.path, next.path),
    setAppSetting(SETTINGS.baseUrl, next.baseUrl),
    setAppSetting(SETTINGS.startCommand, next.startCommand)
  ]);

  return next;
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkMediaCrawlerHealth(): Promise<WorkerHealth> {
  const config = await getMediaCrawlerConfig();
  const current = state();
  let healthy = false;

  try {
    const response = await fetchWithTimeout(`${config.baseUrl}/api/health`);
    healthy = response.ok;
  } catch {
    healthy = false;
  }

  if (healthy) {
    current.lastError = null;
  }

  return {
    configured: Boolean(config.path && config.baseUrl && config.startCommand),
    baseUrl: config.baseUrl,
    path: config.path,
    startCommand: config.startCommand,
    healthy,
    running:
      healthy ||
      current.installing ||
      Boolean(current.process && current.process.exitCode === null && !current.process.killed),
    lastError: current.lastError,
    logs: current.logs.slice(-30)
  };
}

function runCommand(command: string, cwd: string) {
  const current = state();

  return new Promise<void>((resolve, reject) => {
    pushLog(`执行：${command}`);
    const child = spawn(process.env.SHELL || "zsh", ["-lc", command], {
      cwd,
      env: commandEnv(),
      stdio: "pipe"
    });

    child.stdout.on("data", (chunk) => {
      const message = String(chunk).trim();
      if (message) {
        pushLog(message);
      }
    });

    child.stderr.on("data", (chunk) => {
      const message = String(chunk).trim();
      if (message) {
        if (looksLikeError(message)) {
          current.lastError = message;
        }
        pushLog(message);
      }
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(current.lastError || `命令执行失败：${command}`));
    });
  });
}

export async function installMediaCrawlerWorker() {
  const current = state();

  if (current.installing) {
    throw new Error("MediaCrawler 正在安装中，请稍后刷新状态。");
  }

  const config = await getMediaCrawlerConfig();
  const targetPath =
    config.path && existsSync(config.path)
      ? config.path
      : path.resolve(process.cwd(), ".crawler/MediaCrawler");
  current.installing = true;
  current.lastError = null;

  try {
    if (!existsSync(targetPath)) {
      await runCommand(
        `git clone --depth 1 https://github.com/NanmiCoder/MediaCrawler.git '${targetPath}'`,
        process.cwd()
      );
    } else {
      pushLog("已检测到本地 MediaCrawler 目录，跳过 clone。");
    }

    await runCommand("uv sync", targetPath);
    await runCommand("uv run playwright install", targetPath);

    await saveMediaCrawlerConfig({
      path: targetPath,
      baseUrl: "http://127.0.0.1:8088",
      startCommand: "uv run uvicorn api.main:app --host 127.0.0.1 --port 8088"
    });

    pushLog("MediaCrawler 安装完成，并已写入默认 worker 配置。");

    return {
      path: targetPath,
      baseUrl: "http://127.0.0.1:8088",
      startCommand: "uv run uvicorn api.main:app --host 127.0.0.1 --port 8088"
    };
  } finally {
    current.installing = false;
  }
}

export async function startMediaCrawlerWorker() {
  const config = await getMediaCrawlerConfig();
  const current = state();
  const health = await checkMediaCrawlerHealth();

  if (health.healthy) {
    return health;
  }

  if (!config.path) {
    await installMediaCrawlerWorker();
    return startMediaCrawlerWorker();
  }

  if (!existsSync(config.path)) {
    pushLog(`MediaCrawler 路径不存在：${config.path}，开始自动准备 worker。`);
    await installMediaCrawlerWorker();
    return startMediaCrawlerWorker();
  }

  if (!config.startCommand) {
    throw new Error("请先配置 MediaCrawler 启动命令。");
  }

  if (current.process && current.process.exitCode === null && !current.process.killed) {
    return checkMediaCrawlerHealth();
  }

  pushLog(`启动 MediaCrawler worker：${config.startCommand}`);
  const child = spawn(process.env.SHELL || "zsh", ["-lc", config.startCommand], {
    cwd: config.path,
    env: commandEnv(),
    stdio: "pipe"
  });

  current.process = child;
  current.lastError = null;

  child.stdout.on("data", (chunk) => {
    pushLog(String(chunk).trim());
  });

  child.stderr.on("data", (chunk) => {
    const message = String(chunk).trim();
    if (message) {
      if (looksLikeError(message)) {
        current.lastError = message;
      }
      pushLog(message);
    }
  });

  child.on("exit", (code) => {
    pushLog(`MediaCrawler worker 已退出，code=${code ?? "null"}`);
    current.process = null;
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 20000) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const nextHealth = await checkMediaCrawlerHealth();
    if (nextHealth.healthy) {
      current.lastError = null;
      pushLog("MediaCrawler worker 已就绪。");
      return nextHealth;
    }
  }

  throw new Error(current.lastError || "MediaCrawler worker 启动失败，请检查路径、命令和依赖环境。");
}

export async function mediaCrawlerRequest(path: string, init?: RequestInit) {
  const config = await getMediaCrawlerConfig();
  const response = await fetchWithTimeout(`${config.baseUrl}${path}`, init, 20000);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `MediaCrawler request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

const LOGIN_BROWSER_DEBUG_PORT = 9222;
const LOGIN_BROWSER_PROFILE_DIR = path.join(os.homedir(), ".mediacrawler-chrome");

function fireAndForget(command: string, args: string[]) {
  spawn(command, args, {
    detached: true,
    stdio: "ignore"
  }).unref();
}

function focusLoginBrowserWindow() {
  if (process.platform === "darwin") {
    fireAndForget("osascript", ["-e", 'tell application "Google Chrome" to activate']);
    return;
  }

  fireAndForget("open", ["-a", "Google Chrome"]);
}

export async function getLoginBrowserStatus(): Promise<LoginBrowserStatus> {
  try {
    const response = await fetchWithTimeout(
      `http://127.0.0.1:${LOGIN_BROWSER_DEBUG_PORT}/json/version`,
      undefined,
      3000
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      Browser?: string;
      webSocketDebuggerUrl?: string;
    };

    return {
      debugPort: LOGIN_BROWSER_DEBUG_PORT,
      profileDir: LOGIN_BROWSER_PROFILE_DIR,
      running: true,
      healthy: true,
      browserVersion: payload.Browser || null,
      webSocketDebuggerUrl: payload.webSocketDebuggerUrl || null
    };
  } catch {
    return {
      debugPort: LOGIN_BROWSER_DEBUG_PORT,
      profileDir: LOGIN_BROWSER_PROFILE_DIR,
      running: false,
      healthy: false,
      browserVersion: null,
      webSocketDebuggerUrl: null
    };
  }
}

export async function openLoginBrowser() {
  const browserStatus = await getLoginBrowserStatus();

  if (browserStatus.healthy) {
    focusLoginBrowserWindow();
    return browserStatus;
  }

  fireAndForget("open", [
    "-na",
    "Google Chrome",
    "--args",
    `--remote-debugging-port=${LOGIN_BROWSER_DEBUG_PORT}`,
    `--user-data-dir=${LOGIN_BROWSER_PROFILE_DIR}`,
    "--no-first-run",
    "about:blank"
  ]);

  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const nextStatus = await getLoginBrowserStatus();
    if (nextStatus.healthy) {
      focusLoginBrowserWindow();
      return nextStatus;
    }
  }

  throw new Error("登录浏览器没有成功启动，请确认本机已安装 Google Chrome。");
}
