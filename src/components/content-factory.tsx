"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOMENTS_REFERENCE_OPTIONS, XIAOHONGSHU_REFERENCE_OPTIONS } from "@/lib/ai/moments-style-memory";
import { platformLabel, platformOptions, type ContentPlatformValue } from "@/lib/platforms";
import { cn } from "@/lib/utils";

type ProductAsset = {
  id: string;
  type: "TEXT" | "IMAGE" | "text" | "image";
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  imageAnalysis: string | null;
  tags: string[];
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  sellingPoints: string[];
  _count?: {
    assets: number;
  };
};

type ContentFormat = {
  id: string;
  platform: ContentPlatformValue | "moments" | "xiaohongshu";
  name: string;
  description: string | null;
  writingGuide: string | null;
  products: Product[];
};

type AppliedResearchInsight = {
  id: string;
  title: string;
  scopeKey: string | null;
  summary: string;
  recommendations: string | null;
  topKeywords: string[];
  updatedAt: string;
  overlap: number;
};

const wordCountOptions = ["50-150", "150-250", "250-350", "350-450"] as const;
const defaultStyleTags = ["活泼", "简约", "网感", "温柔"];

export function ContentFactory() {
  const router = useRouter();
  const [platform, setPlatform] = useState<ContentPlatformValue>("MOMENTS");
  const [formats, setFormats] = useState<ContentFormat[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [referenceStyleId, setReferenceStyleId] = useState("auto");
  const [wordCountRange, setWordCountRange] = useState<(typeof wordCountOptions)[number]>("150-250");
  const [availableStyleTags, setAvailableStyleTags] = useState(defaultStyleTags);
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(["简约"]);
  const [customStyleTag, setCustomStyleTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [researchPreviewLoading, setResearchPreviewLoading] = useState(false);
  const [appliedResearchInsights, setAppliedResearchInsights] = useState<AppliedResearchInsight[]>([]);
  const [message, setMessage] = useState("");

  const selectedFormat = useMemo(
    () => formats.find((format) => format.id === selectedFormatId) ?? null,
    [formats, selectedFormatId]
  );
  const selectedProduct = useMemo(
    () => selectedFormat?.products.find((product) => product.id === selectedProductId) ?? null,
    [selectedFormat, selectedProductId]
  );
  const memoryCount = selectedProduct?._count?.assets ?? 0;
  const referenceOptions = platform === "MOMENTS" ? MOMENTS_REFERENCE_OPTIONS : XIAOHONGSHU_REFERENCE_OPTIONS;

  const loadFormats = useCallback(async () => {
    const response = await fetch(`/api/content-formats?platform=${platform}`, { cache: "no-store" });
    const payload = (await response.json()) as { contentFormats: ContentFormat[] };
    setFormats(payload.contentFormats);
    setSelectedFormatId((current) => current || payload.contentFormats[0]?.id || "");
    setSelectedProductId((current) => {
      const stillExists = payload.contentFormats.some((format) =>
        format.products.some((product) => product.id === current)
      );
      return stillExists ? current : payload.contentFormats[0]?.products[0]?.id || "";
    });
  }, [platform]);

  useEffect(() => {
    void loadFormats();
  }, [loadFormats]);

  useEffect(() => {
    if (platform !== "XIAOHONGSHU" || !selectedFormatId || !selectedProductId) {
      setAppliedResearchInsights([]);
      return;
    }

    let cancelled = false;
    setResearchPreviewLoading(true);

    void fetch("/api/research/xiaohongshu/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        platform,
        campaignGoal,
        contentFormatId: selectedFormatId,
        productId: selectedProductId
      })
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          insights?: AppliedResearchInsight[];
        };

        if (!response.ok) {
          throw new Error("读取研究预览失败");
        }

        if (!cancelled) {
          setAppliedResearchInsights(payload.insights || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppliedResearchInsights([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResearchPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignGoal, platform, selectedFormatId, selectedProductId]);

  function toggleStyleTag(tag: string) {
    setSelectedStyleTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : current.concat(tag)
    );
  }

  function addCustomStyleTag() {
    const nextTag = customStyleTag.trim();

    if (!nextTag) {
      return;
    }

    setAvailableStyleTags((current) => (current.includes(nextTag) ? current : current.concat(nextTag)));
    setSelectedStyleTags((current) => (current.includes(nextTag) ? current : current.concat(nextTag)));
    setCustomStyleTag("");
  }

  async function generateContent() {
    if (!campaignGoal.trim() || !selectedFormatId || !selectedProductId) {
      setMessage("请填写文案目标，并选择内容形式和产品。");
      return;
    }

    setBusy(true);
    setMessage("正在读取本地文案记忆并生成草稿。");
    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          campaignGoal,
          platform,
          contentFormatId: selectedFormatId,
          productId: selectedProductId,
          referenceStyleId,
          wordCountRange,
          styleTags: selectedStyleTags
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
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
          <CardTitle>选择生成对象</CardTitle>
          <CardDescription>先选平台，再选该平台下的内容形式与产品。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>平台</Label>
            <div className="grid grid-cols-2 gap-2">
              {platformOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPlatform(option.value);
                    setSelectedFormatId("");
                    setSelectedProductId("");
                    setMessage("");
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition",
                    platform === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700 hover:border-primary/40"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentFormat">内容形式</Label>
            <select
              id="contentFormat"
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={selectedFormatId}
              onChange={(event) => {
                const nextFormatId = event.target.value;
                const nextFormat = formats.find((format) => format.id === nextFormatId);
                setSelectedFormatId(nextFormatId);
                setSelectedProductId(nextFormat?.products[0]?.id || "");
              }}
            >
              <option value="">请选择内容形式</option>
              {formats.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product">产品</Label>
            <select
              id="product"
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            >
              <option value="">请选择产品</option>
              {selectedFormat?.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-semibold text-slate-950">{selectedProduct.name}</p>
              <p className="mt-1">{selectedProduct.description || "暂无产品说明"}</p>
              {selectedProduct.sellingPoints.length ? (
                <p className="mt-2">关键词：{selectedProduct.sellingPoints.join(" / ")}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                本地记忆素材：{memoryCount} 条，生成时由后端自动读取。
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
              这个平台下还没有可用产品。请先通过本地记忆导入脚本写入 {platformLabel(platform)} 的内容形式和产品。
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>生成{platformLabel(platform)}文案</CardTitle>
            <CardDescription>系统会自动读取本地数据库中的分类文案记忆、产品关键词和图片分析结果。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="campaignGoal">文案目标</Label>
              <Input
                id="campaignGoal"
                value={campaignGoal}
                onChange={(event) => setCampaignGoal(event.target.value)}
                placeholder="如：推广新品A，强调质感和首发福利"
              />
            </div>

            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-[18rem_1fr]">
              <div className="space-y-3">
                <Label>生成字数</Label>
                <div className="grid grid-cols-2 gap-2">
                  {wordCountOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setWordCountRange(option)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-medium transition",
                        wordCountRange === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-200 bg-white text-slate-700 hover:border-primary/40"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>风格标签</Label>
                <div className="flex flex-wrap gap-2">
                  {availableStyleTags.map((tag) => {
                    const selected = selectedStyleTags.includes(tag);

                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleStyleTag(tag)}
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-slate-200 bg-white text-slate-700 hover:border-primary/40"
                        )}
                      >
                        {tag}
                        {selected ? <X className="ml-1.5 size-3" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customStyleTag}
                    onChange={(event) => setCustomStyleTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomStyleTag();
                      }
                    }}
                    placeholder="添加自定义标签，如高级感、克制、种草"
                  />
                  <Button type="button" variant="outline" onClick={addCustomStyleTag}>
                    <Plus className="mr-2 size-4" aria-hidden="true" />
                    添加
                  </Button>
                </div>
              </div>
            </div>

            {platform === "MOMENTS" || platform === "XIAOHONGSHU" ? (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div>
                  <Label>参考文案倾向</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {platform === "MOMENTS"
                      ? "已根据你提供的参考文案写入朋友圈底层记忆；这里选择本次更接近哪一种参考用法。"
                      : "已根据你提供的小红书参考文案写入底层记忆；这里选择本次更接近哪一种表达路径。"}
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {referenceOptions.map((option) => {
                    const selected = referenceStyleId === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setReferenceStyleId(option.id)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition",
                          selected
                            ? "border-primary bg-white text-slate-950 ring-2 ring-primary/15"
                            : "border-emerald-100 bg-white/70 text-slate-700 hover:border-primary/30"
                        )}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {platform === "XIAOHONGSHU" ? (
              <div className="space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>本次会参考的小红书研究</Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      这里显示本次生成前，系统实际命中的研究洞察。样本清洗后重新生成洞察，这里会同步变化。
                    </p>
                  </div>
                  {researchPreviewLoading ? <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden="true" /> : null}
                </div>
                {appliedResearchInsights.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-rose-200 bg-white px-4 py-4 text-sm text-slate-600">
                    当前还没有命中直接相关的小红书研究洞察，生成时会更多依赖产品信息、图片分析和底层文案记忆。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appliedResearchInsights.map((insight) => (
                      <div key={insight.id} className="rounded-lg border border-rose-100 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-950">{insight.title}</p>
                          <Badge variant="outline">命中 {insight.overlap}</Badge>
                          {insight.scopeKey ? <Badge variant="outline">{insight.scopeKey}</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{insight.summary}</p>
                        {insight.topKeywords.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {insight.topKeywords.slice(0, 6).map((keyword) => (
                              <span
                                key={`${insight.id}-${keyword}`}
                                className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p> : null}
            <Button type="button" onClick={generateContent} disabled={busy || !selectedProduct} className="w-full">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-2 size-4" aria-hidden="true" />}
              生成并创建任务
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
