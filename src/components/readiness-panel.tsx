import { ContentTaskStatus } from "@prisma/client";
import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

import { getAiModelSettingsForClient } from "@/lib/ai/model-config";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ReadinessState = "ready" | "warning" | "todo";

const stateStyle: Record<ReadinessState, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  todo: "border-slate-200 bg-slate-50 text-slate-700"
};

const stateIcon = {
  ready: CheckCircle2,
  warning: CircleAlert,
  todo: CircleDashed
};

export async function ReadinessPanel() {
  const [modelSettings, formatCount, productCount, assetCount, draftCount, finalizedCount, researchCollectionCount, researchNoteCount, researchInsightCount] = await Promise.all([
    getAiModelSettingsForClient(),
    prisma.contentFormat.count(),
    prisma.product.count(),
    prisma.productAsset.count(),
    prisma.contentTask.count({ where: { status: ContentTaskStatus.DRAFT } }),
    prisma.contentTask.count({ where: { status: ContentTaskStatus.FINALIZED } }),
    prisma.researchCollection.count(),
    prisma.researchNote.count(),
    prisma.researchInsight.count()
  ]);
  const modelReady = Boolean(modelSettings.llm.hasApiKey || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY);
  const items = [
    {
      label: "模型配置",
      detail: modelReady
        ? `文案模型：${modelSettings.llm.model || "未命名"}`
        : "先在模型设置里配置 API Key",
      state: modelReady ? "ready" : "warning"
    },
    {
      label: "内容形式",
      detail: formatCount > 0 ? `${formatCount} 个内容形式` : "先创建新品种草、复购提醒等内容形式",
      state: formatCount > 0 ? "ready" : "todo"
    },
    {
      label: "产品与记忆",
      detail: productCount > 0 ? `${productCount} 个产品，${assetCount} 条本地记忆` : "通过本地导入写入产品和文案记忆",
      state: productCount > 0 && assetCount > 0 ? "ready" : "todo"
    },
    {
      label: "文案任务",
      detail: `${draftCount} 个草稿，${finalizedCount} 个已定稿`,
      state: draftCount + finalizedCount > 0 ? "ready" : "todo"
    },
    {
      label: "小红书研究",
      detail:
        researchCollectionCount > 0
          ? `${researchCollectionCount} 个研究集合，${researchNoteCount} 条样本，${researchInsightCount} 条洞察`
          : "先导入小红书抓取结果，再生成研究洞察",
      state: researchCollectionCount > 0 ? "ready" : "todo"
    }
  ] satisfies Array<{ label: string; detail: string; state: ReadinessState }>;

  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>本地生产状态</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const Icon = stateIcon[item.state];

          return (
            <div key={item.label} className={cn("rounded-xl border p-4", stateStyle[item.state])}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </div>
              <p className="mt-2 text-sm leading-5 opacity-85">{item.detail}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
