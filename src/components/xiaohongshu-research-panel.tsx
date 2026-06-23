"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Heart,
  Loader2,
  LogIn,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  XCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResearchCollection = {
  id: string;
  name: string;
  sourceType: string;
  sourceQuery: string | null;
  description: string | null;
  insights: Array<{
    id: string;
    title: string;
    summary: string;
    recommendations: string | null;
    topKeywords: string[];
    updatedAt: string;
  }>;
  notes: Array<{
    id: string;
    title: string | null;
    content: string | null;
    authorName: string | null;
    noteUrl: string | null;
    publishedAt: string | null;
    keywords: string[];
    likeCount: number | null;
    commentCount: number | null;
    collectCount: number | null;
  }>;
  _count: {
    notes: number;
    insights: number;
  };
};

type ResearchPayload = {
  collections: ResearchCollection[];
};

type CrawlJob = {
  id: string;
  collectionName: string;
  query: string | null;
  creatorIds: string[];
  crawlerType: "SEARCH" | "CREATOR" | "search" | "creator";
  status: "PENDING" | "RUNNING" | "IMPORTING" | "COMPLETED" | "FAILED" | "pending" | "running" | "importing" | "completed" | "failed";
  notesImported: number | null;
  sourceFilePath: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type WorkerConfig = {
  path: string;
  baseUrl: string;
  startCommand: string;
};

type WorkerStatus = {
  healthy: boolean;
  running: boolean;
  configured: boolean;
  lastError: string | null;
  logs: string[];
};

type LoginBrowserStatus = {
  debugPort: number;
  profileDir: string;
  running: boolean;
  healthy: boolean;
  browserVersion: string | null;
  webSocketDebuggerUrl: string | null;
};

function shortText(text: string | null | undefined, max = 110) {
  if (!text) {
    return "暂无正文摘要。";
  }

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max)}...`;
}

function normalizeStatus(status: string | null | undefined) {
  return String(status || "").toLowerCase();
}

function statusMeta(status: string) {
  switch (normalizeStatus(status)) {
    case "completed":
      return {
        label: "已完成",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200"
      };
    case "importing":
      return {
        label: "入库中",
        className: "bg-sky-50 text-sky-700 ring-sky-200"
      };
    case "running":
      return {
        label: "抓取中",
        className: "bg-amber-50 text-amber-700 ring-amber-200"
      };
    case "pending":
      return {
        label: "排队中",
        className: "bg-slate-100 text-slate-700 ring-slate-200"
      };
    case "failed":
      return {
        label: "失败",
        className: "bg-rose-50 text-rose-700 ring-rose-200"
      };
    default:
      return {
        label: status || "未知",
        className: "bg-slate-100 text-slate-700 ring-slate-200"
      };
  }
}

export function XiaohongshuResearchPanel() {
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [scopeById, setScopeById] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<WorkerConfig>({
    path: "",
    baseUrl: "",
    startCommand: ""
  });
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [loginBrowserStatus, setLoginBrowserStatus] = useState<LoginBrowserStatus | null>(null);
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const [mode, setMode] = useState<"search" | "creator">("search");
  const [query, setQuery] = useState("");
  const [creatorIds, setCreatorIds] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [cookies, setCookies] = useState("");
  const [savingWorker, setSavingWorker] = useState(false);
  const [startingWorker, setStartingWorker] = useState(false);
  const [installingWorker, setInstallingWorker] = useState(false);
  const [openingBrowser, setOpeningBrowser] = useState(false);
  const [checkingBrowser, setCheckingBrowser] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadCollections() {
    setLoading(true);
    try {
      const response = await fetch("/api/research/xiaohongshu", { cache: "no-store" });
      const payload = (await response.json()) as ResearchPayload;
      setCollections(payload.collections || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadWorker() {
    try {
      const [workerResponse, crawlResponse, browserResponse] = await Promise.all([
        fetch("/api/research/xiaohongshu/worker", { cache: "no-store" }),
        fetch("/api/research/xiaohongshu/crawl", { cache: "no-store" }),
        fetch("/api/research/xiaohongshu/browser", { cache: "no-store" })
      ]);

      const workerPayload = (await workerResponse.json().catch(() => ({}))) as {
        error?: string;
        config?: WorkerConfig;
        status?: WorkerStatus;
      };
      const crawlPayload = (await crawlResponse.json().catch(() => ({}))) as {
        jobs?: CrawlJob[];
      };
      const browserPayload = (await browserResponse.json().catch(() => ({}))) as {
        status?: LoginBrowserStatus;
      };

      if (!workerResponse.ok) {
        throw new Error(workerPayload.error || "读取 worker 状态失败");
      }

      if (workerPayload.config) {
        setConfig(workerPayload.config);
      }
      if (workerPayload.status) {
        setWorkerStatus(workerPayload.status);
      }
      if (browserPayload.status) {
        setLoginBrowserStatus(browserPayload.status);
      }
      setCrawlJobs(crawlPayload.jobs || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取 worker 状态失败");
    }
  }

  useEffect(() => {
    void loadCollections();
    void loadWorker();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadWorker();
      void loadCollections();
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  const totalNotes = useMemo(
    () => collections.reduce((sum, item) => sum + item._count.notes, 0),
    [collections]
  );

  const runningJob = useMemo(
    () =>
      crawlJobs.find((job) => {
        const status = normalizeStatus(job.status);
        return status === "running" || status === "importing" || status === "pending";
      }),
    [crawlJobs]
  );

  const latestJob = crawlJobs[0] ?? null;
  const latestCollection = collections[0] ?? null;
  const latestInsight = latestCollection?.insights[0] ?? null;

  const flowSteps = useMemo(() => {
    const jobStatus = normalizeStatus(latestJob?.status);

    return [
      {
        key: "login",
        label: "已登录",
        active: Boolean(loginBrowserStatus?.healthy),
        pending: !loginBrowserStatus?.healthy,
        icon: LogIn
      },
      {
        key: "crawling",
        label: "抓取中",
        active: jobStatus === "running",
        pending: !latestJob || jobStatus === "pending",
        icon: Search
      },
      {
        key: "importing",
        label: "入库中",
        active: jobStatus === "importing",
        pending: !latestJob || jobStatus === "pending" || jobStatus === "running",
        icon: Database
      },
      {
        key: "completed",
        label: "入库完成",
        active: jobStatus === "completed",
        pending: jobStatus !== "completed",
        icon: CheckCircle2
      }
    ];
  }, [latestJob, loginBrowserStatus]);

  async function analyzeCollection(collection: ResearchCollection) {
    setAnalyzingId(collection.id);
    setMessage("");

    try {
      const response = await fetch("/api/research/xiaohongshu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          collectionId: collection.id,
          scopeKey: scopeById[collection.id]?.trim() || collection.sourceQuery || collection.name
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        insight?: { title?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || "分析失败");
      }

      setMessage(`已更新研究洞察：${payload.insight?.title || collection.name}`);
      await loadCollections();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "分析失败");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function saveWorkerConfig(action?: "save" | "start" | "install") {
    if (action === "install") {
      setInstallingWorker(true);
    } else if (action === "start") {
      setStartingWorker(true);
    } else {
      setSavingWorker(true);
    }
    setMessage("");

    try {
      const response = await fetch("/api/research/xiaohongshu/worker", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...config,
          action
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: WorkerStatus;
        config?: WorkerConfig;
      };

      if (!response.ok) {
        throw new Error(payload.error || "保存 worker 配置失败");
      }

      if (payload.config) {
        setConfig(payload.config);
      }
      if (payload.status) {
        setWorkerStatus(payload.status);
      }

      setMessage(
        action === "install"
          ? "MediaCrawler worker 已准备好。"
          : action === "start"
            ? "MediaCrawler worker 已启动或已可用。"
            : "Worker 配置已保存。"
      );
      await loadWorker();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存 worker 配置失败");
    } finally {
      setSavingWorker(false);
      setStartingWorker(false);
      setInstallingWorker(false);
    }
  }

  async function openBrowserForLogin() {
    setOpeningBrowser(true);
    setMessage("");

    try {
      const response = await fetch("/api/research/xiaohongshu/browser", {
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: LoginBrowserStatus;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "打开登录浏览器失败");
      }

      if (payload.status) {
        setLoginBrowserStatus(payload.status);
      }

      setMessage("专用登录浏览器已打开并已尝试切到前台。请直接在那个窗口里登录小红书，登录后不要关闭窗口。");
      await loadWorker();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "打开登录浏览器失败");
    } finally {
      setOpeningBrowser(false);
    }
  }

  async function checkBrowserStatusManually() {
    setCheckingBrowser(true);
    setMessage("");

    try {
      const response = await fetch("/api/research/xiaohongshu/browser", {
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: LoginBrowserStatus;
      };

      if (!response.ok) {
        throw new Error(payload.error || "检查浏览器状态失败");
      }

      if (payload.status) {
        setLoginBrowserStatus(payload.status);
      }

      setMessage(
        payload.status?.healthy
          ? "已检测到登录浏览器和有效调试端口，可以直接去那个浏览器窗口里继续操作。"
          : "暂时没有检测到登录浏览器。点“打开登录浏览器”后，系统会自动帮你打开并切到前台。"
      );
      await loadWorker();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "检查浏览器状态失败");
    } finally {
      setCheckingBrowser(false);
    }
  }

  async function startCrawl() {
    setCrawling(true);
    setMessage("");

    try {
      const response = await fetch("/api/research/xiaohongshu/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          crawlerType: mode,
          collectionName: collectionName.trim() || (mode === "search" ? query.trim() : "小红书账号样本"),
          query: mode === "search" ? query.trim() : "",
          creatorIds:
            mode === "creator"
              ? creatorIds
                  .split(/[\n,，]/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
          cookies: cookies.trim(),
          maxNotesCount: 40,
          enableComments: false,
          autoAnalyze: true
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "启动抓取失败");
      }

      setMessage("抓取任务已启动。抓完后会自动入库，并自动生成小红书洞察。");
      await loadWorker();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "启动抓取失败");
    } finally {
      setCrawling(false);
    }
  }

  async function deleteCollection(collection: ResearchCollection) {
    const confirmed = window.confirm(`确认删除研究集合“${collection.name}”吗？这会同时删除它的样本、洞察和关联任务记录。`);
    if (!confirmed) {
      return;
    }

    setDeletingCollectionId(collection.id);
    setMessage("");

    try {
      const response = await fetch(`/api/research/xiaohongshu?collectionId=${encodeURIComponent(collection.id)}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "删除研究集合失败");
      }

      setMessage(`已删除研究集合：${collection.name}`);
      await Promise.all([loadCollections(), loadWorker()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除研究集合失败");
    } finally {
      setDeletingCollectionId(null);
    }
  }

  async function deleteCrawlJob(job: CrawlJob) {
    const confirmed = window.confirm(`确认删除任务记录“${job.collectionName}”吗？这只会删除任务记录本身。`);
    if (!confirmed) {
      return;
    }

    setDeletingJobId(job.id);
    setMessage("");

    try {
      const response = await fetch(`/api/research/xiaohongshu/crawl?jobId=${encodeURIComponent(job.id)}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "删除抓取任务失败");
      }

      setMessage(`已删除任务记录：${job.collectionName}`);
      await loadWorker();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除抓取任务失败");
    } finally {
      setDeletingJobId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <Card className="panel-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>小红书研究中心</CardTitle>
                <CardDescription>
                  这里专门服务小红书生成模块。抓取、入库、分析都会在页面上直接呈现结果。
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">研究集合</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{collections.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">样本笔记</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{totalNotes}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">最近状态</div>
              <div className="mt-2 text-sm font-medium text-slate-950">
                {latestJob ? statusMeta(latestJob.status).label : "等待首次抓取"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>流程状态</CardTitle>
            <CardDescription>已登录、抓取、入库、完成四步会在这里直观显示。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {flowSteps.map((step) => {
                const Icon = step.icon;
                const done = step.key === "login" ? step.active : step.key === "completed" ? step.active : false;
                const inProgress = step.active && !done;
                const idle = !step.active && step.pending;

                return (
                  <div
                    key={step.key}
                    className={[
                      "rounded-xl border p-4 transition",
                      done
                        ? "border-emerald-200 bg-emerald-50"
                        : inProgress
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={[
                          "flex size-9 items-center justify-center rounded-lg",
                          done
                            ? "bg-emerald-100 text-emerald-700"
                            : inProgress
                              ? "bg-amber-100 text-amber-700"
                              : "bg-white text-slate-500"
                        ].join(" ")}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      {done ? (
                        <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                      ) : inProgress ? (
                        <Loader2 className="size-4 animate-spin text-amber-600" aria-hidden="true" />
                      ) : idle ? (
                        <Clock3 className="size-4 text-slate-400" aria-hidden="true" />
                      ) : (
                        <XCircle className="size-4 text-rose-500" aria-hidden="true" />
                      )}
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-950">{step.label}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {done
                        ? "已就绪"
                        : inProgress
                          ? "进行中"
                          : step.key === "login"
                            ? "等待登录"
                            : "等待上一步"}
                    </div>
                  </div>
                );
              })}
            </div>
            {latestJob ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-950">当前任务：</span>
                  <span>{latestJob.collectionName}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ${statusMeta(latestJob.status).className}`}>
                    {statusMeta(latestJob.status).label}
                  </span>
                </div>
                <p className="mt-2">
                  {latestJob.query || latestJob.creatorIds.join("、") || "无查询条件"}
                </p>
                {latestJob.notesImported ? <p>已导入 {latestJob.notesImported} 条样本。</p> : null}
                {latestJob.errorMessage ? <p className="text-rose-600">{latestJob.errorMessage}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {message ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="panel-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-slate-500" aria-hidden="true" />
              <CardTitle>MediaCrawler Worker 配置</CardTitle>
            </div>
            <CardDescription>
              这里配置的是你本机上的 crawler worker，不会上传到 GitHub。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium text-slate-900">本地路径</div>
              <Input
                value={config.path}
                onChange={(event) => setConfig((current) => ({ ...current, path: event.target.value }))}
                placeholder="/absolute/path/to/MediaCrawler"
              />
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium text-slate-900">API 地址</div>
              <Input
                value={config.baseUrl}
                onChange={(event) => setConfig((current) => ({ ...current, baseUrl: event.target.value }))}
                placeholder="http://127.0.0.1:8088"
              />
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium text-slate-900">启动命令</div>
              <Input
                value={config.startCommand}
                onChange={(event) => setConfig((current) => ({ ...current, startCommand: event.target.value }))}
                placeholder="uv run uvicorn api.main:app --host 127.0.0.1 --port 8088"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveWorkerConfig("save")} disabled={savingWorker}>
                {savingWorker ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                保存配置
              </Button>
              <Button variant="outline" onClick={() => void saveWorkerConfig("install")} disabled={installingWorker}>
                {installingWorker ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Settings2 className="size-4" aria-hidden="true" />}
                准备 worker
              </Button>
              <Button variant="outline" onClick={() => void saveWorkerConfig("start")} disabled={startingWorker}>
                {startingWorker ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PlayCircle className="size-4" aria-hidden="true" />}
                启动 worker
              </Button>
              <Button variant="ghost" onClick={() => void loadWorker()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                刷新状态
              </Button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <div className="font-medium text-slate-950">当前状态</div>
              <p className="mt-2">
                {workerStatus?.healthy
                  ? "Worker API 已可用，可以直接发起小红书抓取。"
                  : "Worker 还不可用。请先确认路径、启动命令和 crawler 依赖环境。"}
              </p>
              {workerStatus?.lastError ? <p className="mt-2 text-rose-600">{workerStatus.lastError}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="size-4 text-slate-500" aria-hidden="true" />
              <CardTitle>直接发起小红书抓取</CardTitle>
            </div>
            <CardDescription>
              抓取结果只进入小红书研究库，并只用于小红书文案生成，不会串到朋友圈。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant={mode === "search" ? "default" : "outline"} onClick={() => setMode("search")}>
                关键词抓取
              </Button>
              <Button variant={mode === "creator" ? "default" : "outline"} onClick={() => setMode("creator")}>
                Creator 抓取
              </Button>
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium text-slate-900">研究集合名</div>
              <Input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                placeholder="如：新品话题样本"
              />
            </div>
            {mode === "search" ? (
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-900">主题关键词</div>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="如：新品 场景 人群 需求"
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-900">Creator IDs</div>
                <Input
                  value={creatorIds}
                  onChange={(event) => setCreatorIds(event.target.value)}
                  placeholder="多个 id 用逗号分隔"
                />
              </div>
            )}
            <div className="grid gap-2">
              <div className="text-sm font-medium text-slate-900">Cookies（可选）</div>
              <Input
                value={cookies}
                onChange={(event) => setCookies(event.target.value)}
                placeholder="如已登录会话可留空；如需临时会话可填 cookie 字符串"
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <div className="font-medium text-slate-950">登录浏览器</div>
              <p className="mt-2">
                {loginBrowserStatus?.healthy
                  ? `已连接专用登录浏览器，调试端口 ${loginBrowserStatus.debugPort}。`
                  : "如果登录态过期，先点下面这个按钮打开专用登录浏览器，然后在里面登录小红书。"}
              </p>
              {loginBrowserStatus?.browserVersion ? (
                <p className="mt-1 text-slate-600">{loginBrowserStatus.browserVersion}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void openBrowserForLogin()} disabled={openingBrowser}>
                  {openingBrowser ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogIn className="size-4" aria-hidden="true" />}
                  打开并聚焦登录浏览器
                </Button>
                <Button variant="ghost" onClick={() => void checkBrowserStatusManually()} disabled={checkingBrowser}>
                  {checkingBrowser ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                  检查状态
                </Button>
              </div>
            </div>
            <Button onClick={() => void startCrawl()} disabled={crawling || Boolean(runningJob)} className="w-full">
              {crawling ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PlayCircle className="size-4" aria-hidden="true" />}
              {runningJob ? "已有任务运行中" : "开始抓取并入库"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>最近一次产出</CardTitle>
            <CardDescription>这里直接展示最近导入的样本内容，不再显示日志。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!latestCollection ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                还没有已导入的小红书研究数据。
              </div>
            ) : latestCollection.notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                最近集合里暂时没有可展示的样本。
              </div>
            ) : (
              latestCollection.notes.slice(0, 3).map((note) => (
                <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{note.title || "未命名笔记"}</div>
                      <div className="mt-1 text-xs text-slate-500">{note.authorName || "未知作者"}</div>
                    </div>
                    {note.noteUrl ? (
                      <a
                        href={note.noteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
                      >
                        原文
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{shortText(note.content, 130)}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3.5" aria-hidden="true" />
                      {note.likeCount ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3.5" aria-hidden="true" />
                      {note.commentCount ?? 0}
                    </span>
                    <span>收藏 {note.collectCount ?? 0}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>最近一次分析</CardTitle>
            <CardDescription>自动分析后的结论会写入小红书专属研究记忆。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!latestInsight ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                还没有生成分析结果。导入样本后点“生成洞察”即可。
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">{latestInsight.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{latestInsight.summary}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-medium text-slate-900">建议动作</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {latestInsight.recommendations || "暂时没有额外建议。"}
                  </p>
                </div>
                {latestInsight.topKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {latestInsight.topKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>最近抓取任务</CardTitle>
            <CardDescription>这里保留任务结果摘要，只看关键信息，不再展示底层日志。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {crawlJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                还没有从页面发起过抓取任务。
              </div>
            ) : (
              crawlJobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-slate-950">{job.collectionName}</div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                        {String(job.crawlerType).toLowerCase() === "creator" ? "creator" : "search"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ${statusMeta(job.status).className}`}>
                        {statusMeta(job.status).label}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void deleteCrawlJob(job)}
                      disabled={deletingJobId === job.id}
                      aria-label={`删除任务 ${job.collectionName}`}
                    >
                      {deletingJobId === job.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2">查询：{job.query || job.creatorIds.join("、") || "无"}</p>
                  <p>导入条数：{job.notesImported ?? "-"}</p>
                  {job.sourceFilePath ? <p>结果文件：{job.sourceFilePath}</p> : null}
                  {job.errorMessage ? <p className="text-rose-600">{job.errorMessage}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>这批研究会怎么用</CardTitle>
            <CardDescription>你能直接看到样本和洞察，它们后面也会进入生成逻辑。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              抓取回来的笔记会按主题入库，保留标题、正文、互动数据和关键词。
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              AI 会优先总结高互动内容的切入角度、结构节奏、情绪路径和互动方法。
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              如果某次抓取结果不符合预期，你现在可以直接在页面里删除集合和任务记录，数据库也会同步清理。
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="panel-card">
        <CardHeader>
          <CardTitle>已导入的小红书研究集合</CardTitle>
          <CardDescription>每个集合都可以手动重新分析，并直接看到代表性样本。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              正在读取小红书研究集合...
            </div>
          ) : null}

          {!loading && collections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm leading-6 text-slate-600">
              还没有导入任何小红书研究数据。现在可以直接在上方发起抓取，成功后这里会自动出现。
            </div>
          ) : null}

          {!loading &&
            collections.map((collection) => {
              const collectionInsight = collection.insights[0];

              return (
                <div key={collection.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">{collection.name}</h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                          {collection._count.notes} 条样本
                        </span>
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700">
                          小红书专用
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        <p>{collection.description || "已导入的小红书研究集合。"}</p>
                        <p>主题关键词：{collection.sourceQuery || "未填写"}</p>
                      </div>
                    </div>

                    <div className="w-full max-w-sm space-y-2">
                      <Input
                        value={scopeById[collection.id] ?? collection.sourceQuery ?? ""}
                        onChange={(event) =>
                          setScopeById((current) => ({
                            ...current,
                            [collection.id]: event.target.value
                          }))
                        }
                        placeholder="如：新品场景 / 人群需求 / 观点表达"
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          onClick={() => void analyzeCollection(collection)}
                          disabled={analyzingId === collection.id}
                          className="w-full"
                        >
                          {analyzingId === collection.id ? (
                            <>
                              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              正在生成洞察
                            </>
                          ) : (
                            <>
                              <Wand2 className="size-4" aria-hidden="true" />
                              生成洞察
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void deleteCollection(collection)}
                          disabled={deletingCollectionId === collection.id}
                          className="w-full"
                        >
                          {deletingCollectionId === collection.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="size-4" aria-hidden="true" />
                          )}
                          删除结果
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <BookOpenText className="size-4" aria-hidden="true" />
                        最新洞察
                      </div>
                      {collectionInsight ? (
                        <div className="space-y-3 text-sm leading-6 text-slate-700">
                          <div className="font-medium text-slate-950">{collectionInsight.title}</div>
                          <p>{collectionInsight.summary}</p>
                          {collectionInsight.recommendations ? (
                            <div className="whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-slate-700">
                              {collectionInsight.recommendations}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm leading-6 text-slate-600">
                          还没有生成洞察。点一次“生成洞察”，后续小红书文案生成就会自动读取这里的结论。
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Database className="size-4" aria-hidden="true" />
                        代表样本
                      </div>
                      <div className="space-y-3">
                        {collection.notes.length === 0 ? (
                          <p className="text-sm leading-6 text-slate-600">暂无样本预览。</p>
                        ) : (
                          collection.notes.slice(0, 3).map((note) => (
                            <div key={note.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="text-sm font-medium text-slate-900">{note.title || "未命名笔记"}</div>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {shortText(note.content, 90)}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <Heart className="size-3.5" aria-hidden="true" />
                                  {note.likeCount ?? 0}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MessageCircle className="size-3.5" aria-hidden="true" />
                                  {note.commentCount ?? 0}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
