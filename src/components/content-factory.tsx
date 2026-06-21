"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, ImageIcon, Loader2, Plus, Sparkles, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  assets: ProductAsset[];
};

type ContentFormat = {
  id: string;
  platform: ContentPlatformValue | "moments" | "xiaohongshu";
  name: string;
  description: string | null;
  writingGuide: string | null;
  products: Product[];
};

const wordCountOptions = ["50-150", "150-250", "250-350", "350-450"] as const;
const defaultStyleTags = ["活泼", "简约", "网感", "温柔"];

export function ContentFactory() {
  const router = useRouter();
  const [platform, setPlatform] = useState<ContentPlatformValue>("MOMENTS");
  const [formats, setFormats] = useState<ContentFormat[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [campaignGoal, setCampaignGoal] = useState("");
  const [wordCountRange, setWordCountRange] = useState<(typeof wordCountOptions)[number]>("150-250");
  const [availableStyleTags, setAvailableStyleTags] = useState(defaultStyleTags);
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(["简约"]);
  const [customStyleTag, setCustomStyleTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedFormat = useMemo(
    () => formats.find((format) => format.id === selectedFormatId) ?? null,
    [formats, selectedFormatId]
  );
  const selectedProduct = useMemo(
    () => selectedFormat?.products.find((product) => product.id === selectedProductId) ?? null,
    [selectedFormat, selectedProductId]
  );

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
    setSelectedAssetIds(selectedProduct?.assets.map((asset) => asset.id) ?? []);
  }, [selectedProduct]);

  function toggleAsset(id: string) {
    setSelectedAssetIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)
    );
  }

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

    if (!selectedProduct?.assets.length) {
      setMessage("这个产品还没有素材，先去知识库添加文本或图片素材。");
      return;
    }

    const assetIdsForGeneration = selectedAssetIds.length
      ? selectedAssetIds
      : selectedProduct.assets.map((asset) => asset.id);

    setBusy(true);
    setMessage("正在生成。如果有未分析的图片，系统会先识别图片特征。");
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
          selectedAssetIds: assetIdsForGeneration,
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

  function selectAllAssets() {
    setSelectedAssetIds(selectedProduct?.assets.map((asset) => asset.id) ?? []);
  }

  function clearSelectedAssets() {
    setSelectedAssetIds([]);
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
                <p className="mt-2">卖点：{selectedProduct.sellingPoints.join(" / ")}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
              这个平台下还没有可用产品。先去 <Link href="/formats" className="text-primary underline-offset-4 hover:underline">知识库</Link> 添加 {platformLabel(platform)} 的内容形式和产品。
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>生成{platformLabel(platform)}文案</CardTitle>
            <CardDescription>只使用你人工选取的产品图文素材；图片会被识别特征，但不会自动生成新图。</CardDescription>
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

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label>选择图文素材</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    默认使用当前产品的全部素材；也可以手动取消不需要的素材。
                  </p>
                </div>
                {selectedProduct?.assets.length ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllAssets}>
                      <CheckSquare className="mr-2 size-4" aria-hidden="true" />
                      全选
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearSelectedAssets}>
                      <Square className="mr-2 size-4" aria-hidden="true" />
                      清空
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {selectedProduct?.assets.map((asset) => {
                  const selected = selectedAssetIds.includes(asset.id);
                  const isImage = String(asset.type).toUpperCase() === "IMAGE";

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => toggleAsset(asset.id)}
                      className={cn(
                        "rounded-xl border bg-white p-4 text-left transition",
                        selected ? "border-primary ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">{asset.title || "未命名素材"}</p>
                        {isImage ? <ImageIcon className="size-4 text-primary" aria-hidden="true" /> : null}
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {asset.content || asset.imageUrl || "暂无内容"}
                      </p>
                      {asset.imageAnalysis ? (
                        <p className="mt-3 line-clamp-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                          {asset.imageAnalysis}
                        </p>
                      ) : isImage ? (
                        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                          生成时会自动分析这张图片的产品特征。
                        </p>
                      ) : null}
                      {asset.tags.length ? (
                        <p className="mt-3 text-xs text-muted-foreground">{asset.tags.join(" / ")}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {selectedProduct && selectedProduct.assets.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">
                  这个产品还没有素材，先去知识库添加文本或图片素材。
                </p>
              ) : null}
            </div>

            {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p> : null}
            <Button type="button" onClick={generateContent} disabled={busy || !selectedProduct?.assets.length} className="w-full">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-2 size-4" aria-hidden="true" />}
              {selectedProduct?.assets.length ? "生成并创建任务" : "请先添加素材"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
