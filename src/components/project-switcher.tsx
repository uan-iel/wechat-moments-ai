"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Loader2, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count?: {
    contentFormats: number;
    contentTasks: number;
    researchCollections: number;
  };
};

type ProjectsPayload = {
  activeProject: Project;
  projects: Project[];
};

export function ProjectSwitcher() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProjects() {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const payload = (await response.json()) as ProjectsPayload;
    setProjects(payload.projects || []);
    setActiveProjectId(payload.activeProject?.id || "");
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function switchProject(projectId: string) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ projectId })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "切换项目失败");
      }

      setActiveProjectId(projectId);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "切换项目失败");
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    if (!newProjectName.trim()) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newProjectName.trim() })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "创建项目失败");
      }

      setNewProjectName("");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建项目失败");
    } finally {
      setBusy(false);
    }
  }

  const activeProject = projects.find((project) => project.id === activeProjectId);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <FolderKanban className="size-4" aria-hidden="true" />
        当前项目
      </div>
      <select
        value={activeProjectId}
        onChange={(event) => void switchProject(event.target.value)}
        disabled={busy || projects.length === 0}
        className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {activeProject ? (
        <div className="mt-2 text-xs leading-5 text-slate-500">
          内容 {activeProject._count?.contentFormats ?? 0} 类 / 任务 {activeProject._count?.contentTasks ?? 0} 个
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Input
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          placeholder="新增项目"
          className="h-8 text-xs"
        />
        <Button type="button" size="icon-sm" variant="outline" onClick={() => void createProject()} disabled={busy || !newProjectName.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => void loadProjects()} disabled={busy}>
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs leading-5 text-rose-600">{message}</p> : null}
    </div>
  );
}
