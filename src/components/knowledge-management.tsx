"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  FileImage,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  Plus,
  Search,
  Shapes,
  ShoppingBag,
  Trash2,
  UploadCloud
} from "lucide-react";

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

type UploadItem = {
  file: File;
  relativePath?: string;
};

type DataTransferItemWithWebkit = DataTransferItem & {
  webkitGetAsEntry?: () => LocalFileSystemEntry | null;
};

type LocalFileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
};

type LocalFileSystemFileEntry = LocalFileSystemEntry & {
  file: (callback: (file: File) => void) => void;
};

type LocalFileSystemDirectoryEntry = LocalFileSystemEntry & {
  createReader: () => {
    readEntries: (callback: (entries: LocalFileSystemEntry[]) => void) => void;
  };
};

function normalizeAssetType(type: ProductAsset["type"]) {
  return String(type).toUpperCase() === "IMAGE" ? "IMAGE" : "TEXT";
}

function keywordText(format: ContentFormat, product?: Product, asset?: ProductAsset) {
  return [
    format.name,
    format.description,
    format.writingGuide,
    product?.name,
    product?.description,
    product?.sellingPoints.join(" "),
    asset?.title,
    asset?.content,
    asset?.imageAnalysis,
    asset?.tags.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function folderLabelFromAsset(asset: ProductAsset) {
  return asset.tags.find((tag) => tag.trim()) || "";
}

async function readFileEntry(entry: LocalFileSystemFileEntry, relativePath: string) {
  return new Promise<UploadItem>((resolve) => {
    entry.file((file) => resolve({ file, relativePath }));
  });
}

async function readDirectoryEntry(entry: LocalFileSystemDirectoryEntry, basePath = ""): Promise<UploadItem[]> {
  const reader = entry.createReader();
  const currentPath = basePath ? `${basePath}/${entry.name}` : entry.name;
  const entries = await new Promise<LocalFileSystemEntry[]>((resolve) => {
    const allEntries: LocalFileSystemEntry[] = [];

    const readNext = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(allEntries);
          return;
        }

        allEntries.push(...batch);
        readNext();
      });
    };

    readNext();
  });

  const nested = await Promise.all(
    entries.map(async (child) => {
      if (child.isFile) {
        return [await readFileEntry(child as LocalFileSystemFileEntry, `${currentPath}/${child.name}`)];
      }

      if (child.isDirectory) {
        return readDirectoryEntry(child as LocalFileSystemDirectoryEntry, currentPath);
      }

      return [];
    })
  );

  return nested.flat();
}

function fileListToUploadItems(fileList: FileList | File[]) {
  return Array.from(fileList)
    .filter((file) => file.type.startsWith("image/"))
    .map((file) => ({
      file,
      relativePath: "webkitRelativePath" in file && typeof file.webkitRelativePath === "string" && file.webkitRelativePath
        ? file.webkitRelativePath
        : undefined
    }));
}

export function KnowledgeManagement() {
  const [platform, setPlatform] = useState<ContentPlatformValue>("MOMENTS");
  const [formats, setFormats] = useState<ContentFormat[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [formatName, setFormatName] = useState("");
  const [formatDescription, setFormatDescription] = useState("");
  const [writingGuide, setWritingGuide] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [assetType, setAssetType] = useState<"TEXT" | "IMAGE">("TEXT");
  const [assetTitle, setAssetTitle] = useState("");
  const [assetContent, setAssetContent] = useState("");
  const [assetTags, setAssetTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [analyzingId, setAnalyzingId] = useState("");
  const [message, setMessage] = useState("");

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

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
    setSelectedFormatId((current) => {
      const nextId = current || payload.contentFormats[0]?.id || "";
      return payload.contentFormats.some((format) => format.id === nextId) ? nextId : payload.contentFormats[0]?.id || "";
    });
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

  const filteredFormats = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return formats;
    }

    return formats
      .map((format) => {
        const formatMatches = keywordText(format).includes(query);
        const products = format.products
          .map((product) => {
            const productMatches = keywordText(format, product).includes(query);
            const assets = product.assets.filter((asset) => keywordText(format, product, asset).includes(query));

            if (productMatches || assets.length > 0) {
              return {
                ...product,
                assets: assets.length > 0 ? assets : product.assets
              };
            }

            return null;
          })
          .filter((product): product is Product => Boolean(product));

        if (formatMatches || products.length > 0) {
          return {
            ...format,
            products: products.length > 0 ? products : format.products
          };
        }

        return null;
      })
      .filter((format): format is ContentFormat => Boolean(format));
  }, [formats, searchTerm]);

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
          platform,
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

  async function createTextAsset() {
    if (!selectedProductId) {
      setMessage("请先选择产品。");
      return;
    }

    if (!assetContent.trim()) {
      setMessage("文本素材需要填写内容。");
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
          type: "TEXT",
          title: assetTitle,
          content: assetContent,
          tags: assetTags.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "保存素材失败");
      }

      setAssetTitle("");
      setAssetContent("");
      setAssetTags("");
      setMessage("文本素材已保存。");
      await loadFormats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存素材失败");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImages(items: UploadItem[]) {
    if (!selectedProductId) {
      setMessage("请先选择产品。");
      return;
    }

    const imageItems = items.filter((item) => item.file.type.startsWith("image/"));

    if (imageItems.length === 0) {
      setMessage("没有检测到可导入的图片文件。");
      return;
    }

    setBusy(true);
    setDragActive(false);
    setMessage(`正在导入 ${imageItems.length} 张图片...`);

    try {
      const formData = new FormData();
      formData.set("productId", selectedProductId);
      formData.set("title", assetTitle.trim());
      formData.set("content", assetContent.trim());
      formData.set("tags", assetTags.trim());
      formData.set(
        "fileMeta",
        JSON.stringify(
          imageItems.map((item) => ({
            name: item.file.name,
            relativePath: item.relativePath || ""
          }))
        )
      );

      imageItems.forEach((item) => {
        formData.append("files", item.file, item.file.name);
      });

      const response = await fetch("/api/product-assets/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "图片导入失败");
      }

      setAssetTitle("");
      setAssetContent("");
      setAssetTags("");
      setMessage(`已导入 ${imageItems.length} 张图片素材。`);
      await loadFormats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片导入失败");
    } finally {
      setBusy(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
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

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);

    if (busy) {
      return;
    }

    const webkitItems = Array.from(event.dataTransfer.items) as DataTransferItemWithWebkit[];
    const entries = webkitItems
      .map((item) => item.webkitGetAsEntry?.())
      .filter(Boolean) as LocalFileSystemEntry[];

    if (entries.length > 0) {
      const nestedItems = await Promise.all(
        entries.map(async (entry) => {
          if (entry.isFile) {
            return [await readFileEntry(entry as LocalFileSystemFileEntry, entry.name)];
          }

          if (entry.isDirectory) {
            return readDirectoryEntry(entry as LocalFileSystemDirectoryEntry);
          }

          return [];
        })
      );

      await uploadImages(nestedItems.flat());
      return;
    }

    await uploadImages(fileListToUploadItems(event.dataTransfer.files));
  }

  const selectedProductAssets = selectedProduct?.assets ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <CardTitle>平台与新增</CardTitle>
            <CardDescription>左侧只负责新增和导入，右侧专门用来检索与浏览知识库。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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

            <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" open>
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                新增内容形式
              </summary>
              <div className="mt-4 space-y-3">
                <Input value={formatName} onChange={(event) => setFormatName(event.target.value)} placeholder="如：新品种草" />
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={formatDescription}
                  onChange={(event) => setFormatDescription(event.target.value)}
                  placeholder="适合什么场景"
                />
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={writingGuide}
                  onChange={(event) => setWritingGuide(event.target.value)}
                  placeholder="写作要求：结构、语气、行动引导等"
                />
                <Button type="button" onClick={createFormat} disabled={busy} className="w-full">
                  <Plus className="mr-2 size-4" aria-hidden="true" />
                  保存内容形式
                </Button>
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" open>
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                新增产品
              </summary>
              <div className="mt-4 space-y-3">
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
              </div>
            </details>

            <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" open>
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                添加素材
              </summary>
              <div className="mt-4 space-y-3">
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
                        "rounded-lg border px-3 py-2 text-sm font-medium transition",
                        assetType === type ? "border-primary bg-primary text-primary-foreground" : "bg-white"
                      )}
                    >
                      {type === "TEXT" ? "文本素材" : "图片素材"}
                    </button>
                  ))}
                </div>

                <Input value={assetTitle} onChange={(event) => setAssetTitle(event.target.value)} placeholder={assetType === "IMAGE" ? "图片标题，可选" : "素材标题"} />
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={assetContent}
                  onChange={(event) => setAssetContent(event.target.value)}
                  placeholder={assetType === "IMAGE" ? "图片补充说明，可选" : "文本内容"}
                />
                <Input value={assetTags} onChange={(event) => setAssetTags(event.target.value)} placeholder="标签，用逗号分隔" />

                {assetType === "TEXT" ? (
                  <Button type="button" onClick={createTextAsset} disabled={busy || !selectedProductId} className="w-full">
                    <Plus className="mr-2 size-4" aria-hidden="true" />
                    保存文本素材
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        if (event.target.files) {
                          void uploadImages(fileListToUploadItems(event.target.files));
                        }
                      }}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                      onChange={(event) => {
                        if (event.target.files) {
                          void uploadImages(fileListToUploadItems(event.target.files));
                        }
                      }}
                    />

                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!busy) {
                          setDragActive(true);
                        }
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        setDragActive(false);
                      }}
                      onDrop={(event) => {
                        void handleDrop(event);
                      }}
                      className={cn(
                        "rounded-xl border border-dashed p-4 text-sm transition",
                        dragActive ? "border-primary bg-primary/5" : "border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <UploadCloud className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900">拖拽图片文件或整个图片文件夹到这里</p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            如果导入文件夹，文件夹名会自动写进图片标签里，后续可直接按文件夹标题搜索这批图片。
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={busy || !selectedProductId}>
                              <ImageIcon className="mr-2 size-4" aria-hidden="true" />
                              选择图片
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => folderInputRef.current?.click()} disabled={busy || !selectedProductId}>
                              <FolderOpen className="mr-2 size-4" aria-hidden="true" />
                              选择文件夹
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </details>

            {message ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">{message}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="panel-card">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{platformLabel(platform)}知识库</CardTitle>
                <CardDescription>支持按内容形式、产品、素材标题、卖点、标签和图片文件夹标题检索。</CardDescription>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="搜索内容形式 / 产品 / 素材 / 文件夹标题"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[20rem_1fr]">
            <div className="max-h-[44rem] space-y-3 overflow-y-auto pr-1">
              {filteredFormats.map((format) => (
                <details
                  key={format.id}
                  open={selectedFormatId === format.id || Boolean(searchTerm)}
                  className="rounded-xl border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        setSelectedFormatId(format.id);
                        setSelectedProductId(format.products[0]?.id || "");
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Shapes className="size-4 text-primary" aria-hidden="true" />
                        <p className="truncate text-sm font-semibold text-slate-950">{format.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format.products.length} 个产品 · {format.products.reduce((count, product) => count + product.assets.length, 0)} 条素材
                      </p>
                    </button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={(event) => {
                        event.preventDefault();
                        void deleteResource("content-formats", format.id, format.name);
                      }}
                      disabled={busy}
                      aria-label={`删除 ${format.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </summary>

                  <div className="border-t border-slate-100 px-3 py-2">
                    <div className="space-y-1">
                      {format.products.map((product) => (
                        <div
                          key={product.id}
                          className={cn(
                            "rounded-lg border px-3 py-2 transition",
                            selectedProductId === product.id
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFormatId(format.id);
                                setSelectedProductId(product.id);
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <ShoppingBag className="size-4 text-slate-500" aria-hidden="true" />
                                <span className="truncate text-sm font-medium text-slate-900">{product.name}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {product.assets.length} 条素材
                              </p>
                            </button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => void deleteResource("products", product.id, product.name)}
                              disabled={busy}
                              aria-label={`删除 ${product.name}`}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>

                          {selectedProductId === product.id || Boolean(searchTerm) ? (
                            <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                              {product.assets.map((asset) => (
                                <div key={asset.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedFormatId(format.id);
                                      setSelectedProductId(product.id);
                                    }}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <span className="flex items-center gap-2 text-slate-700">
                                      {normalizeAssetType(asset.type) === "IMAGE" ? (
                                        <FileImage className="size-3.5 text-primary" aria-hidden="true" />
                                      ) : (
                                        <FileText className="size-3.5 text-slate-500" aria-hidden="true" />
                                      )}
                                      <span className="truncate">{asset.title || folderLabelFromAsset(asset) || "未命名素材"}</span>
                                    </span>
                                  </button>
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="size-6 text-destructive hover:text-destructive"
                                    onClick={() => void deleteResource("product-assets", asset.id, asset.title || "未命名素材")}
                                    disabled={busy}
                                    aria-label="删除素材"
                                  >
                                    <Trash2 className="size-3.5" aria-hidden="true" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ))}

              {filteredFormats.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                  没找到匹配内容。换个关键词试试。
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              {selectedProduct ? (
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                          {selectedFormat?.name}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">{selectedProduct.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {selectedProduct.description || "暂无产品说明"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                        {selectedProduct.assets.length} 条素材
                      </div>
                    </div>
                    {selectedProduct.sellingPoints.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedProduct.sellingPoints.map((point) => (
                          <span key={point} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                            {point}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="divide-y divide-slate-100">
                    {selectedProductAssets.map((asset) => (
                      <div key={asset.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                                {normalizeAssetType(asset.type) === "IMAGE" ? (
                                  <ImageIcon className="size-3.5" aria-hidden="true" />
                                ) : (
                                  <FileText className="size-3.5" aria-hidden="true" />
                                )}
                                {normalizeAssetType(asset.type) === "IMAGE" ? "图片" : "文本"}
                              </span>
                              <p className="text-sm font-semibold text-slate-950">
                                {asset.title || folderLabelFromAsset(asset) || "未命名素材"}
                              </p>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                              {asset.content || asset.imageUrl || "暂无内容"}
                            </p>
                            {asset.tags.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {asset.tags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] text-primary">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {asset.imageAnalysis ? (
                              <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                                {asset.imageAnalysis}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {asset.imageUrl && normalizeAssetType(asset.type) === "IMAGE" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={asset.imageUrl}
                                alt={asset.title || "产品图片"}
                                className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : null}
                            <div className="flex gap-2">
                              {normalizeAssetType(asset.type) === "IMAGE" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => analyzeAsset(asset.id)}
                                  disabled={analyzingId === asset.id}
                                >
                                  {analyzingId === asset.id ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Eye className="mr-2 size-4" aria-hidden="true" />
                                  )}
                                  分析
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => void deleteResource("product-assets", asset.id, asset.title || "未命名素材")}
                                disabled={busy}
                              >
                                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                                删除
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {selectedProductAssets.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                        这个产品还没有素材，左侧可以直接添加文本或拖拽导入图片。
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-muted-foreground">
                  先从左侧树状列表选择一个产品，这里会显示它的图文素材详情。
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
