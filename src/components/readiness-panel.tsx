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
  const [modelSettings, styleCount, knowledgeCount, draftCount, finalizedCount] = await Promise.all([
    getAiModelSettingsForClient(),
    prisma.styleProfile.count(),
    prisma.knowledgeItem.count(),
    prisma.contentTask.count({ where: { status: ContentTaskStatus.DRAFT } }),
    prisma.contentTask.count({ where: { status: ContentTaskStatus.FINALIZED } })
  ]);
  const modelReady = Boolean(modelSettings.hasApiKey || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY);
  const items = [
    {
      label: "模型配置",
      detail: modelReady
        ? `${modelSettings.provider} / ${modelSettings.llmModel}`
        : "先在模型设置里配置 API Key",
      state: modelReady ? "ready" : "warning"
    },
    {
      label: "风格 Profile",
      detail: styleCount > 0 ? `${styleCount} 套可用风格` : "粘贴历史文案学习第一套风格",
      state: styleCount > 0 ? "ready" : "todo"
    },
    {
      label: "素材知识库",
      detail: knowledgeCount > 0 ? `${knowledgeCount} 条素材` : "添加产品资料、卖点或图片链接",
      state: knowledgeCount > 0 ? "ready" : "todo"
    },
    {
      label: "文案任务",
      detail: `${draftCount} 个草稿，${finalizedCount} 个已定稿`,
      state: draftCount + finalizedCount > 0 ? "ready" : "todo"
    }
  ] satisfies Array<{ label: string; detail: string; state: ReadinessState }>;

  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>本地生产状态</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
