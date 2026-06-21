"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { platformLabel, platformOptions, type ContentPlatformValue } from "@/lib/platforms";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  platform: ContentPlatformValue | "moments" | "xiaohongshu";
  title: string;
  campaignGoal: string;
  status: "DRAFT" | "FINALIZED" | "FAILED" | "draft" | "finalized" | "failed";
  updatedAt: string;
  contentFormat: {
    id: string;
    name: string;
  } | null;
  product: {
    id: string;
    name: string;
  } | null;
  versions: Array<{
    id: string;
    label: string;
    content: string;
    isFinal: boolean;
    createdAt: string;
  }>;
  _count: {
    versions: number;
    calendarEntries: number;
  };
};

type FilterKey = "ALL" | "DRAFT" | "FINALIZED" | "FAILED";

const statusLabel: Record<string, string> = {
  DRAFT: "草稿",
  FINALIZED: "已定稿",
  FAILED: "失败",
  draft: "草稿",
  finalized: "已定稿",
  failed: "失败"
};

const statusClass: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-800 ring-amber-200",
  FINALIZED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  FAILED: "bg-rose-50 text-rose-800 ring-rose-200",
  draft: "bg-amber-50 text-amber-800 ring-amber-200",
  finalized: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  failed: "bg-rose-50 text-rose-800 ring-rose-200"
};

function normalizeStatus(status: Task["status"]) {
  return String(status).toUpperCase() as FilterKey;
}

export function TaskList() {
  const [platform, setPlatform] = useState<ContentPlatformValue>("MOMENTS");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/content-tasks?platform=${platform}`, { cache: "no-store" });
    const payload = (await response.json()) as { contentTasks: Task[] };
    setTasks(payload.contentTasks);
    setLoading(false);
  }, [platform]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function deleteTask(task: Task) {
    if (!window.confirm(`确定删除「${task.title}」吗？该任务的所有版本和日历记录都会一起删除。`)) {
      return;
    }

    setDeletingId(task.id);
    try {
      const response = await fetch(`/api/content-tasks/${task.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("删除任务失败");
      }

      await loadTasks();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "删除任务失败");
    } finally {
      setDeletingId("");
    }
  }

  const filteredTasks = useMemo(() => {
    if (filter === "ALL") {
      return tasks;
    }

    return tasks.filter((task) => normalizeStatus(task.status) === filter);
  }, [filter, tasks]);

  return (
    <div className="space-y-5">
      <Card className="panel-card">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 sm:w-72">
            {platformOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={platform === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPlatform(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "FINALIZED", "FAILED"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={filter === item ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(item)}
            >
              {item === "ALL" ? "全部" : statusLabel[item]}
            </Button>
          ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="panel-card">
          <CardContent className="p-8 text-sm text-muted-foreground">正在加载任务...</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {filteredTasks.map((task) => {
          const latest = task.versions[0];

          return (
            <Card key={task.id} className="panel-card">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className={cn("ring-1", statusClass[task.status])}>
                      {statusLabel[task.status]}
                    </Badge>
                    <Badge variant="outline">{platformLabel(task.platform)}</Badge>
                    <span className="text-xs text-muted-foreground">{task._count.versions} 个版本</span>
                    {task._count.calendarEntries ? (
                      <span className="text-xs text-muted-foreground">{task._count.calendarEntries} 条日历记录</span>
                    ) : null}
                  </div>
                  <CardTitle>{task.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    内容形式：{task.contentFormat?.name || "未选择"} · 产品：{task.product?.name || "未选择"} · 更新于 {new Date(task.updatedAt).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteTask(task)}
                    disabled={deletingId === task.id}
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden="true" />
                    删除
                  </Button>
                  <Link href={`/tasks/${task.id}`}>
                    <Button type="button" size="sm">
                      打开
                      <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    {latest?.isFinal ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
                    {latest?.label || "暂无版本"}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {latest?.content || "还没有生成内容。"}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && filteredTasks.length === 0 ? (
        <Card className="panel-card">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            当前平台下暂无任务。去内容工厂生成第一条文案。
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
