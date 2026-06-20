"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Loader2, Save, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ContentVersion = {
  id: string;
  label: string;
  content: string;
  imageUrls: string[];
  revisionInstruction: string | null;
  isFinal: boolean;
  createdAt: string;
};

type TaskPayload = {
  id: string;
  title: string;
  campaignGoal: string;
  status: "DRAFT" | "FINALIZED" | "FAILED" | "draft" | "finalized" | "failed";
  selectedStyle: {
    id: string;
    name: string;
    analysisPrompt: string;
  } | null;
  knowledgeItems: Array<{
    id: string;
    type: string;
    title: string | null;
    content: string;
    imageUrl: string | null;
    tags: string[];
  }>;
  versions: ContentVersion[];
  calendarEntries: Array<{
    id: string;
    plannedDate: string;
    status: string;
    note: string | null;
  }>;
};

const statusLabel: Record<string, string> = {
  DRAFT: "草稿",
  FINALIZED: "已定稿",
  FAILED: "失败",
  draft: "草稿",
  finalized: "已定稿",
  failed: "失败"
};

export function TaskDetail({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskPayload | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedVersion = useMemo(() => {
    if (!task) {
      return null;
    }

    return task.versions.find((version) => version.id === selectedVersionId) ?? task.versions[0] ?? null;
  }, [selectedVersionId, task]);

  const loadTask = useCallback(async (preferVersionId?: string) => {
    const response = await fetch(`/api/content-tasks/${taskId}`, { cache: "no-store" });
    const payload = (await response.json()) as { contentTask: TaskPayload };
    setTask(payload.contentTask);
    const finalVersion = payload.contentTask.versions.find((version) => version.isFinal);
    setSelectedVersionId(preferVersionId || finalVersion?.id || payload.contentTask.versions.at(-1)?.id || "");
  }, [taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  async function copyVersion() {
    if (!selectedVersion) {
      return;
    }

    const imageText = selectedVersion.imageUrls.length
      ? `\n\n配图：\n${selectedVersion.imageUrls.join("\n")}`
      : "";
    const plainText = `${selectedVersion.content}${imageText}`;
    const html = [
      `<div>${selectedVersion.content
        .split("\n")
        .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`)
        .join("")}</div>`,
      ...selectedVersion.imageUrls.map((url) => `<p><img src="${url}" alt="配图" /></p>`)
    ].join("");

    if ("write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        })
      ]);
    } else {
      await navigator.clipboard.writeText(plainText);
    }
    setMessage("已复制文案" + (selectedVersion.imageUrls.length ? "和图片链接。" : "。"));
  }

  async function reviseContent() {
    if (!selectedVersion || !revisionInstruction.trim()) {
      setMessage("请先选择版本并填写修改意见。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/revise-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contentTaskId: taskId,
          contentVersionId: selectedVersion.id,
          revisionInstruction
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "AI 改写失败");
      }

      const payload = (await response.json()) as { contentVersion: ContentVersion };
      setRevisionInstruction("");
      setMessage("AI 已生成一个新版本。");
      await loadTask(payload.contentVersion.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 改写失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveManualVersion() {
    if (!selectedVersion || !editContent.trim()) {
      setMessage("请填写修改后的文案。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/content-tasks/${taskId}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: editContent,
          imageUrls: selectedVersion.imageUrls
        })
      });

      if (!response.ok) {
        throw new Error("保存手动版本失败");
      }

      const payload = (await response.json()) as { contentVersion: ContentVersion };
      setEditing(false);
      setMessage("已保存为新版本。");
      await loadTask(payload.contentVersion.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存手动版本失败");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeVersion() {
    if (!selectedVersion) {
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/content-tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          finalizedVersionId: selectedVersion.id
        })
      });

      if (!response.ok) {
        throw new Error("定稿失败");
      }

      setMessage("已定稿。现在可以一键复制去手动发布。");
      await loadTask(selectedVersion.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "定稿失败");
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    if (!selectedVersion) {
      return;
    }

    setEditContent(selectedVersion.content);
    setEditing(true);
  }

  if (!task) {
    return (
      <Card className="panel-card">
        <CardContent className="p-8 text-sm text-muted-foreground">正在加载任务...</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
      <Card className="panel-card h-fit">
        <CardHeader>
          <Badge className="w-fit bg-slate-100 text-slate-700 hover:bg-slate-100">
            {statusLabel[task.status]}
          </Badge>
          <CardTitle>{task.title}</CardTitle>
          <CardDescription>风格：{task.selectedStyle?.name || "未选择"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {task.versions.map((version) => (
            <button
              key={version.id}
              type="button"
              onClick={() => {
                setSelectedVersionId(version.id);
                setEditing(false);
              }}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition",
                selectedVersionId === version.id ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{version.label}</span>
                {version.isFinal ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" /> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(version.createdAt).toLocaleString("zh-CN")}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{selectedVersion?.label || "暂无版本"}</CardTitle>
                <CardDescription>同一文案目标下的初稿、AI 改写和手动修改都会保存在这里。</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={copyVersion} disabled={!selectedVersion} className="bg-emerald-600 hover:bg-emerald-700">
                  <Clipboard className="mr-2 size-4" aria-hidden="true" />
                  一键复制
                </Button>
                <Button type="button" variant="outline" onClick={startEditing} disabled={!selectedVersion}>
                  自行修改
                </Button>
                <Button type="button" onClick={finalizeVersion} disabled={busy || !selectedVersion}>
                  定稿
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p> : null}
            {editing ? (
              <div className="space-y-3">
                <textarea
                  className="min-h-72 w-full rounded-xl border border-input bg-white px-4 py-3 text-sm leading-7 outline-none focus:ring-2 focus:ring-ring"
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                />
                <Button type="button" onClick={saveManualVersion} disabled={busy}>
                  <Save className="mr-2 size-4" aria-hidden="true" />
                  保存为新版本
                </Button>
              </div>
            ) : (
              <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                  {selectedVersion?.content || "暂无文案。"}
                </p>
                {selectedVersion?.imageUrls.length ? (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    <p className="text-sm font-medium text-slate-700">配图链接</p>
                    {selectedVersion.imageUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all text-sm text-primary underline-offset-4 hover:underline">
                        {url}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>让 AI 改一下</CardTitle>
            <CardDescription>基于当前选中版本生成一个新版本，原版本不会被覆盖。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="revisionInstruction">修改意见</Label>
            <Input
              id="revisionInstruction"
              value={revisionInstruction}
              onChange={(event) => setRevisionInstruction(event.target.value)}
              placeholder="如：再加点紧迫感，开头更生活化"
            />
            <Button type="button" onClick={reviseContent} disabled={busy || !selectedVersion}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Wand2 className="mr-2 size-4" aria-hidden="true" />}
              生成改写版本
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
