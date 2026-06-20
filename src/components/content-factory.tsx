"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type StyleProfile = {
  id: string;
  name: string;
  analysisPrompt: string;
};

type KnowledgeItem = {
  id: string;
  type: "TEXT" | "IMAGE" | "text" | "image";
  title: string | null;
  content: string;
  imageUrl: string | null;
  tags: string[];
};

export function ContentFactory() {
  const router = useRouter();
  const [styles, setStyles] = useState<StyleProfile[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [campaignGoal, setCampaignGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newType, setNewType] = useState<"TEXT" | "IMAGE">("TEXT");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newTags, setNewTags] = useState("");

  const selectedStyle = useMemo(() => {
    return styles.find((style) => style.id === selectedStyleId);
  }, [selectedStyleId, styles]);

  async function loadData() {
    const [stylesResponse, knowledgeResponse] = await Promise.all([
      fetch("/api/style-profiles", { cache: "no-store" }),
      fetch("/api/knowledge-items", { cache: "no-store" })
    ]);
    const stylesPayload = (await stylesResponse.json()) as { styleProfiles: StyleProfile[] };
    const knowledgePayload = (await knowledgeResponse.json()) as { knowledgeItems: KnowledgeItem[] };
    setStyles(stylesPayload.styleProfiles);
    setKnowledgeItems(knowledgePayload.knowledgeItems);
    setSelectedStyleId((current) => current || stylesPayload.styleProfiles[0]?.id || "");
  }

  useEffect(() => {
    void loadData();
  }, []);

  function toggleKnowledge(id: string) {
    setSelectedKnowledgeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function createKnowledgeItem() {
    if (!newContent.trim()) {
      setMessage("请先填写素材内容。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: newType,
          title: newTitle,
          content: newContent,
          imageUrl: newImageUrl,
          tags: newTags
            .split(/[,，\n]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        })
      });

      if (!response.ok) {
        throw new Error("保存素材失败");
      }

      const payload = (await response.json()) as { knowledgeItem: KnowledgeItem };
      setKnowledgeItems((current) => [payload.knowledgeItem, ...current]);
      setSelectedKnowledgeIds((current) =>
        current.includes(payload.knowledgeItem.id)
          ? current
          : [payload.knowledgeItem.id, ...current]
      );
      setNewTitle("");
      setNewContent("");
      setNewImageUrl("");
      setNewTags("");
      setMessage("素材已保存，并自动加入本次生成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存素材失败");
    } finally {
      setBusy(false);
    }
  }

  async function generateContent() {
    if (!campaignGoal.trim() || !selectedStyleId || selectedKnowledgeIds.length === 0) {
      setMessage("请填写文案目标，并选择风格和至少一条素材。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          campaignGoal,
          selectedStyleId,
          selectedKnowledgeIds
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "生成失败");
      }

      const payload = (await response.json()) as { contentTask: { id: string } };
      router.push(`/tasks/${payload.contentTask.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
      <Card className="panel-card h-fit">
        <CardHeader>
          <CardTitle>添加素材</CardTitle>
          <CardDescription>产品资料、卖点、案例或图片链接都可以作为生成依据。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["TEXT", "IMAGE"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNewType(type)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium",
                  newType === type ? "border-primary bg-primary text-primary-foreground" : "bg-white"
                )}
              >
                {type === "TEXT" ? "文本素材" : "图片素材"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newTitle">素材标题</Label>
            <Input id="newTitle" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="如：新品A核心卖点" />
          </div>
          {newType === "IMAGE" ? (
            <div className="space-y-2">
              <Label htmlFor="newImageUrl">图片链接</Label>
              <Input id="newImageUrl" value={newImageUrl} onChange={(event) => setNewImageUrl(event.target.value)} placeholder="https://..." />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="newContent">素材内容</Label>
            <textarea
              id="newContent"
              className="min-h-32 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              placeholder="粘贴产品信息、活动机制、用户反馈等"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newTags">标签</Label>
            <Input id="newTags" value={newTags} onChange={(event) => setNewTags(event.target.value)} placeholder="新品,复购,高客单" />
          </div>
          <Button type="button" onClick={createKnowledgeItem} disabled={busy} className="w-full">
            <Plus className="mr-2 size-4" aria-hidden="true" />
            保存素材
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>AI 文案生成</CardTitle>
            <CardDescription>选择素材和风格，生成结果会保存为任务的第一个版本。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="campaignGoal">文案目标</Label>
              <Input
                id="campaignGoal"
                value={campaignGoal}
                onChange={(event) => setCampaignGoal(event.target.value)}
                placeholder="如：推广新品A，突出限时福利和真实口碑"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="style">选择风格</Label>
              <select
                id="style"
                className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={selectedStyleId}
                onChange={(event) => setSelectedStyleId(event.target.value)}
              >
                <option value="">请选择风格</option>
                {styles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
              {selectedStyle ? (
                <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                  {selectedStyle.analysisPrompt}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <Label>选择素材</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {knowledgeItems.map((item) => {
                  const selected = selectedKnowledgeIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleKnowledge(item.id)}
                      className={cn(
                        "rounded-xl border bg-white p-4 text-left transition",
                        selected ? "border-primary ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">{item.title || "未命名素材"}</p>
                        {String(item.type).toUpperCase() === "IMAGE" ? (
                          <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {item.content}
                      </p>
                      {item.tags.length ? (
                        <p className="mt-3 text-xs text-muted-foreground">{item.tags.join(" / ")}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {knowledgeItems.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">
                  还没有素材，先在左侧添加一条产品资料。
                </p>
              ) : null}
            </div>

            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <Button type="button" onClick={generateContent} disabled={busy} className="w-full">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-2 size-4" aria-hidden="true" />}
              生成并创建任务
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
