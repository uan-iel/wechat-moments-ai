"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  Factory,
  Home,
  MessageSquareText,
  Settings,
  Sparkles
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "总览", icon: Home },
  { href: "/content-factory", label: "内容工厂", icon: Factory },
  { href: "/formats", label: "知识库", icon: MessageSquareText },
  { href: "/tasks", label: "文案任务", icon: CheckSquare },
  { href: "/calendar", label: "发布日历", icon: CalendarDays },
  { href: "/settings", label: "模型设置", icon: Settings }
];

type AppShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: "4xl" | "5xl" | "6xl" | "7xl";
};

const maxWidthClasses = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl"
};

export function AppShell({
  eyebrow = "WeChat Moments AI",
  title,
  description,
  children,
  actions,
  maxWidth = "6xl"
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="app-surface min-h-screen">
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm shadow-slate-950/[0.04] backdrop-blur lg:block">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-5">Moments AI</span>
              <span className="block text-xs text-muted-foreground">私域朋友圈助手</span>
            </span>
          </Link>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                    active && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute inset-x-4 bottom-4 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 text-xs leading-5 text-emerald-950">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <Sparkles className="size-4" aria-hidden="true" />
              本地文案闭环
            </div>
            内容形式、产品素材、图片分析和多版本改写都在本地完成。
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-sm lg:hidden">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600",
                    active && "bg-primary text-primary-foreground"
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className={cn("mx-auto w-full pb-10", maxWidthClasses[maxWidth])}>
            <header className="mb-6 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm shadow-slate-950/[0.03] backdrop-blur sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="page-eyebrow">{eyebrow}</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                      {description}
                    </p>
                  ) : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              </div>
            </header>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
