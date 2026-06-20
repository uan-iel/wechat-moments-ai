"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CalendarEntry = {
  id: string;
  taskId: string;
  versionId: string | null;
  plannedDate: string;
  status: "PLANNED" | "POSTED" | "planned" | "posted";
  note: string | null;
  task: {
    title: string;
  };
};

type TaskOption = {
  id: string;
  title: string;
  versions: Array<{
    id: string;
    label: string;
    isFinal: boolean;
  }>;
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toDayKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export function PublishCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [taskId, setTaskId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [plannedDate, setPlannedDate] = useState(toDateInputValue(new Date()));
  const [status, setStatus] = useState<"PLANNED" | "POSTED">("PLANNED");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const selectedTask = useMemo(() => tasks.find((task) => task.id === taskId), [taskId, tasks]);
  const monthDays = useMemo(() => {
    const base = new Date(plannedDate);
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const days: Date[] = [];

    for (let day = 1; day <= last.getDate(); day += 1) {
      days.push(new Date(first.getFullYear(), first.getMonth(), day));
    }

    return days;
  }, [plannedDate]);
  const entriesByDay = useMemo(() => {
    return entries.reduce<Record<string, CalendarEntry[]>>((acc, entry) => {
      const key = toDayKey(entry.plannedDate);
      acc[key] = [...(acc[key] ?? []), entry];
      return acc;
    }, {});
  }, [entries]);

  async function loadCalendar() {
    const response = await fetch("/api/publish-calendar", { cache: "no-store" });
    const payload = (await response.json()) as { entries: CalendarEntry[]; tasks: TaskOption[] };
    setEntries(payload.entries);
    setTasks(payload.tasks);
    setTaskId((current) => current || payload.tasks[0]?.id || "");
  }

  useEffect(() => {
    void loadCalendar();
  }, []);

  useEffect(() => {
    const finalVersion = selectedTask?.versions.find((version) => version.isFinal);
    setVersionId(finalVersion?.id || selectedTask?.versions[0]?.id || "");
  }, [selectedTask]);

  async function createEntry() {
    if (!taskId || !plannedDate) {
      setMessage("请选择任务和日期。");
      return;
    }

    const response = await fetch("/api/publish-calendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        taskId,
        versionId,
        plannedDate: new Date(`${plannedDate}T09:00:00`).toISOString(),
        status,
        note
      })
    });

    if (!response.ok) {
      setMessage("保存日历记录失败。");
      return;
    }

    setNote("");
    setMessage("日历记录已保存。");
    await loadCalendar();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <Card className="panel-card h-fit">
        <CardHeader>
          <CardTitle>标记发布记录</CardTitle>
          <CardDescription>这里只做备忘，不会触发任何自动发布。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taskId">文案任务</Label>
            <select
              id="taskId"
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
            >
              <option value="">请选择任务</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="versionId">版本</Label>
            <select
              id="versionId"
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
            >
              {selectedTask?.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}{version.isFinal ? "（定稿）" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plannedDate">日期</Label>
            <Input id="plannedDate" type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={status === "PLANNED" ? "default" : "outline"} onClick={() => setStatus("PLANNED")}>
              计划发布
            </Button>
            <Button type="button" variant={status === "POSTED" ? "default" : "outline"} onClick={() => setStatus("POSTED")}>
              已发布
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">备注</Label>
            <Input id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="如：发到朋友圈 / 社群同步" />
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="button" onClick={createEntry} className="w-full">
            <Plus className="mr-2 size-4" aria-hidden="true" />
            保存记录
          </Button>
        </CardContent>
      </Card>

      <Card className="panel-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>{new Date(plannedDate).toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}</CardTitle>
              <CardDescription>计划和已发布记录集中在这里查看。</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {monthDays.map((day) => {
              const key = toDayKey(day);
              const dayEntries = entriesByDay[key] ?? [];

              return (
                <div key={key} className="min-h-32 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-950">{day.getDate()}</p>
                  <div className="mt-2 space-y-2">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className="rounded-lg bg-slate-50 p-2">
                        <p className="line-clamp-2 text-xs font-medium text-slate-800">{entry.task.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {String(entry.status).toUpperCase() === "POSTED" ? "已发布" : "计划发布"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
