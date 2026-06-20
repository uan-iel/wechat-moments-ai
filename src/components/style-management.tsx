"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StyleProfile = {
  id: string;
  name: string;
  description: string | null;
  analysisPrompt: string;
  sourceText: string | null;
  updatedAt: string;
};

export function StyleManagement() {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [styleName, setStyleName] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPrompt, setManualPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function loadProfiles() {
    const response = await fetch("/api/style-profiles", { cache: "no-store" });
    const payload = (await response.json()) as { styleProfiles: StyleProfile[] };
    setProfiles(payload.styleProfiles);
    setEditing(
      Object.fromEntries(payload.styleProfiles.map((profile) => [profile.id, profile.analysisPrompt]))
    );
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function analyzeStyle() {
    if (sourceText.trim().length < 20) {
      setMessage("请粘贴更完整的历史文案，至少 20 个字符。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/analyze-style", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: styleName,
          sourceText
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "风格分析失败");
      }

      setSourceText("");
      setStyleName("");
      setMessage("风格已分析并保存。");
      await loadProfiles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "风格分析失败");
    } finally {
      setBusy(false);
    }
  }

  async function createManualProfile() {
    if (!manualName.trim() || !manualPrompt.trim()) {
      setMessage("请填写风格名称和风格描述。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/style-profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: manualName,
          analysisPrompt: manualPrompt
        })
      });

      if (!response.ok) {
        throw new Error("保存风格失败");
      }

      setManualName("");
      setManualPrompt("");
      setMessage("风格已保存。");
      await loadProfiles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存风格失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(profile: StyleProfile) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/style-profiles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: profile.id,
          name: profile.name,
          description: profile.description || "",
          analysisPrompt: editing[profile.id]
        })
      });

      if (!response.ok) {
        throw new Error("更新风格失败");
      }

      setMessage("风格已更新。");
      await loadProfiles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新风格失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[26rem_1fr]">
      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>粘贴历史文案学习风格</CardTitle>
            <CardDescription>可以一次性粘贴多段朋友圈文案，AI 会总结语气、句式、词汇和 emoji 使用习惯。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="styleName">风格名称</Label>
              <Input id="styleName" value={styleName} onChange={(event) => setStyleName(event.target.value)} placeholder="如：亲切宝妈风" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceText">历史文案</Label>
              <textarea
                id="sourceText"
                className="min-h-56 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="把你过去发过的朋友圈文案粘贴到这里，可以多段..."
              />
            </div>
            <Button type="button" onClick={analyzeStyle} disabled={busy} className="w-full">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-2 size-4" aria-hidden="true" />}
              分析风格
            </Button>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>手动创建风格</CardTitle>
            <CardDescription>已有明确风格要求时，可以直接写入。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="风格名称" />
            <textarea
              className="min-h-28 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={manualPrompt}
              onChange={(event) => setManualPrompt(event.target.value)}
              placeholder="风格描述，例如：语气亲切、有生活感，句子短，常用提问式开头..."
            />
            <Button type="button" variant="outline" onClick={createManualProfile} disabled={busy} className="w-full">
              保存手动风格
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="panel-card">
        <CardHeader>
          <CardTitle>风格 Profile</CardTitle>
          <CardDescription>生成文案时会严格参考这里的风格描述。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p> : null}
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-950">{profile.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    更新于 {new Date(profile.updatedAt).toLocaleString("zh-CN")}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => saveProfile(profile)} disabled={busy}>
                  <Save className="mr-2 size-4" aria-hidden="true" />
                  保存调整
                </Button>
              </div>
              <textarea
                className="min-h-32 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring"
                value={editing[profile.id] ?? profile.analysisPrompt}
                onChange={(event) =>
                  setEditing((current) => ({
                    ...current,
                    [profile.id]: event.target.value
                  }))
                }
              />
            </div>
          ))}
          {profiles.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">
              暂无风格。先粘贴一组历史文案，生成第一套 Profile。
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
