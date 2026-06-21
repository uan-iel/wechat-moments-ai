"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, ImageIcon, Loader2, Plus, Shapes, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  name: string;
  description: string | null;
  writingGuide: string | null;
  products: Product[];
};

export function KnowledgeManagement() {
  const [formats, setFormats] = useState<ContentFormat[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formatName, setFormatName] = useState("");
  const [formatDescription, setFormatDescription] = useState("");
  const [writingGuide, setWritingGuide] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [assetType, setAssetType] = useState<"TEXT" | "IMAGE">("TEXT");
  const [assetTitle, setAssetTitle] = useState("");
  const [assetContent, setAssetContent] = useState("");
  const [assetImageUrl, setAssetImageUrl] = useState("");
  const [assetTags, setAssetTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzingId, setAnalyzingId] = useState("");
  const [message, setMessage] = useState("");

  const selectedFormat = useMemo(
    () => formats.find((format) => format.id === selectedFormatId) ?? null,
    [formats, selectedFormatId]
  );
  const selectedProduct = useMemo(
    () => selectedFormat?.products.find((product) => product.id === selectedProductId) ?? null,
    [selectedFormat, selectedProductId]
  );

  async function loadFormats() {
    const response = await fetch("/api/content-formats", { cache: "no-store" });
    const payload = (await response.json()) as { contentFormats: ContentFormat[] };
    setFormats(payload.contentFormats);
    setSelectedFormatId((current) => current || payload.contentFormats[0]?.id || "");
    setSelectedProductId((current) => {
      const currentProductStillExists = payload.contentFormats.some((format) =>
        format.products.some((product) => product.id === current)
      );
      return currentProductStillExists ? current : payload.contentFormats[0]?.products[0]?.id || "";
    });
  }

  useEffect(() => {
    void loadFormats();
  }, []);

  async function createFormat() {
    if (!formatName.trim()) {
      setMessage("请先填写内容形式名称。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/content-formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formatName,
          description: formatDescription,
          writingGuide
        })
      });

      if (!response.ok) {
        throw new Error("保存内容形式失败");
      }

      setFormatName("");
      setFormatDescription("");
      setWritingGuide("");
      setMessage("内容形式已保存。");
      await loadFormats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存内容形式失败");
    } finally {
      setBusy(false);
    }
  }

  async function createProduct() {
    if (!selectedFormatId || !productName.trim()) {
      setMessage("请先选择内容形式并填写产品名称。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentFormatId: selectedFormatId,
          name: productName,
          description: productDescription,
          sellingPoints: sellingPoints.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
        })
      });

      if (!response.ok) {
        throw new Error("保存产品失败");
      }

      setProductName("");
      setProductDescription("");
      setSellingPoints("");
      setMessage("产品已保存。");
      await loadFormats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存产品失败");
    } finally {
      setBusy(false);
    }
  }

  async function createAsset() {
    if (!selectedProductId) {
      setMessage("请先选择产品。");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/product-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          type: assetType,
          title: assetTitle,
          content: assetContent,
          imageUrl: assetImageUrl,
          tags: assetTags.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "保存素材失败");
      }

      setAssetTitle("");
      setAssetContent("");
      setAssetImageUrl("");
      setAssetTags("");
      setMessage("产品素材已保存。");
      await loadFormats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存素材失败");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeAsset(assetId: string) {
    setAnalyzingId(assetId);
    setMessage("");
    try {
      const response = await fetch("/api/product-assets/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productAssetId: assetId })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "图片分析失败");
      }

      setMessage("图片特征分析已保存。");
      await loadFormats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片分析失败");
    } finally {
      setAnalyzingId("");
    }
  }

  async function deleteResource(kind: "content-formats" | "products" | "product-assets", id: string, label: string) {
    if (!window.confirm(`确定删除「${label}」吗？相关下级资料也会一起删除。`)) {
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/${kind}?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "删除失败");
      }

      if (kind === "content-formats" && selectedFormatId === id) {
        setSelectedFormatId("");
        setSelectedProductId("");
      }

      if (kind === "products" && selectedProductId === id) {
        setSelectedProductId("");
      }

      setMessage("已删除。");
      await loadFormats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[25rem_1fr]">
      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>内容形式</CardTitle>
            <CardDescription>比如：新品种草、复购提醒、活动转化、口碑案例。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={formatName} onChange={(event) => setFormatName(event.target.value)} placeholder="内容形式名称" />
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={formatDescription}
              onChange={(event) => setFormatDescription(event.target.value)}
              placeholder="这个内容形式适合什么场景"
            />
            <textarea
              className="min-h-24 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={writingGuide}
              onChange={(event) => setWritingGuide(event.target.value)}
              placeholder="写作要求：开头方式、结构、语气、行动引导等"
            />
            <Button type="button" onClick={createFormat} disabled={busy} className="w-full">
              <Plus className="mr-2 size-4" aria-hidden="true" />
              保存内容形式
            </Button>
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>产品</CardTitle>
            <CardDescription>产品归属于某个内容形式，下方再挂具体图文素材。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={selectedFormatId}
              onChange={(event) => {
                setSelectedFormatId(event.target.value);
                setSelectedProductId("");
              }}
            >
              <option value="">选择内容形式</option>
              {formats.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.name}
                </option>
              ))}
            </select>
            <Input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="产品名称" />
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              placeholder="产品说明"
            />
            <Input value={sellingPoints} onChange={(event) => setSellingPoints(event.target.value)} placeholder="卖点，用逗号分隔" />
            <Button type="button" onClick={createProduct} disabled={busy || !selectedFormatId} className="w-full">
              <ShoppingBag className="mr-2 size-4" aria-hidden="true" />
              保存产品
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>知识库导图</CardTitle>
            <CardDescription>内容形式 → 产品 → 图文素材。生成文案时会从这里人工选择素材。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p> : null}
            <div className="grid gap-3 lg:grid-cols-2">
              {formats.map((format) => (
                <div
                  key={format.id}
                  className={cn(
                    "rounded-xl border p-4 transition",
                    selectedFormatId === format.id ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFormatId(format.id);
                      setSelectedProductId(format.products[0]?.id || "");
                    }}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-950">
                      <Shapes className="size-4 text-primary" aria-hidden="true" />
                      {format.name}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{format.description || "暂无说明"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{format.products.length} 个产品</p>
                  </button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    onClick={() => deleteResource("content-formats", format.id, format.name)}
                    disabled={busy}
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden="true" />
                    删除
                  </Button>
                </div>
              ))}
            </div>

            {selectedFormat ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <Label>选择产品</Label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedFormat.products.map((product) => (
                    <div key={product.id} className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                      <Button
                        type="button"
                        variant={selectedProductId === product.id ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSelectedProductId(product.id)}
                        className="rounded-r-none"
                      >
                        {product.name}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-l-none text-destructive hover:text-destructive"
                        onClick={() => deleteResource("products", product.id, product.name)}
                        disabled={busy}
                        aria-label={`删除 ${product.name}`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader>
            <CardTitle>给产品添加素材</CardTitle>
            <CardDescription>文本素材保存卖点、话术、机制；图片素材保存图片链接，可用视觉模型分析特征。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            >
              <option value="">选择产品</option>
              {selectedFormat?.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {(["TEXT", "IMAGE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAssetType(type)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    assetType === type ? "border-primary bg-primary text-primary-foreground" : "bg-white"
                  )}
                >
                  {type === "TEXT" ? "文本素材" : "图片素材"}
                </button>
              ))}
            </div>
            <Input value={assetTitle} onChange={(event) => setAssetTitle(event.target.value)} placeholder="素材标题" />
            {assetType === "IMAGE" ? (
              <Input value={assetImageUrl} onChange={(event) => setAssetImageUrl(event.target.value)} placeholder="图片 URL" />
            ) : null}
            <textarea
              className="min-h-24 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={assetContent}
              onChange={(event) => setAssetContent(event.target.value)}
              placeholder={assetType === "IMAGE" ? "图片补充说明，可选" : "文本内容"}
            />
            <Input value={assetTags} onChange={(event) => setAssetTags(event.target.value)} placeholder="标签，用逗号分隔" />
            <Button type="button" onClick={createAsset} disabled={busy || !selectedProductId} className="w-full">
              <Plus className="mr-2 size-4" aria-hidden="true" />
              保存素材
            </Button>
          </CardContent>
        </Card>

        {selectedProduct ? (
          <Card className="panel-card">
            <CardHeader>
              <CardTitle>{selectedProduct.name} 的素材</CardTitle>
              <CardDescription>{selectedProduct.assets.length} 条图文素材。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {selectedProduct.assets.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-950">{asset.title || "未命名素材"}</p>
                      {String(asset.type).toUpperCase() === "IMAGE" ? <ImageIcon className="size-4 text-primary" aria-hidden="true" /> : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteResource("product-assets", asset.id, asset.title || "未命名素材")}
                      disabled={busy}
                      aria-label="删除素材"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {asset.content || asset.imageUrl || "暂无内容"}
                  </p>
                  {asset.imageAnalysis ? (
                    <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                      {asset.imageAnalysis}
                    </p>
                  ) : null}
                  {String(asset.type).toUpperCase() === "IMAGE" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => analyzeAsset(asset.id)}
                      disabled={analyzingId === asset.id}
                    >
                      {analyzingId === asset.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Eye className="mr-2 size-4" aria-hidden="true" />
                      )}
                      分析图片特征
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
