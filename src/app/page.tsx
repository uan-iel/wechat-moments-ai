import { ArrowRight, CalendarDays, CheckCircle2, Factory, MessageSquareText, Sparkles } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ReadinessPanel } from "@/components/readiness-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const shortcuts = [
  {
    href: "/formats",
    icon: MessageSquareText,
    title: "搭建内容知识库",
    description: "按内容形式、产品和图文素材组织知识库。"
  },
  {
    href: "/content-factory",
    icon: Factory,
    title: "生成朋友圈文案",
    description: "选择产品和图片素材，一键生成适合手工发布的草稿。"
  },
  {
    href: "/tasks",
    icon: CheckCircle2,
    title: "修改并定稿",
    description: "保留初稿、AI 改写和手动修改等多个版本。"
  },
  {
    href: "/calendar",
    icon: CalendarDays,
    title: "记录发布计划",
    description: "在日历中标记计划发布或已经发布的文案。"
  }
];

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <AppShell
      title="本地 AI 朋友圈文案工作台"
      description="去掉企微连接与自动发布，保留内容形式、产品素材、图片分析、AI 生成、多版本定稿和手工发布记录。"
      maxWidth="7xl"
      actions={
        <Link
          href="/content-factory"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          开始生成
          <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <ReadinessPanel />

          <div className="grid gap-4 md:grid-cols-2">
            {shortcuts.map((item) => (
              <Link key={item.href} href={item.href} className="group block">
                <Card className="panel-card h-full transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="size-5" aria-hidden="true" />
                    </span>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <Card className="panel-card h-fit">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>现在的产品边界</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>不再扫码、不保存企微密钥、不自动发布。</p>
            <p>最终文案会在任务详情里定稿并复制，用户手动发到企微、微信或其他平台。</p>
            <p>发布日历只做备忘记录，不触发任何外部 API。</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
