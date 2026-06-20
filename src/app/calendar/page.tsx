import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PublishCalendar } from "@/components/publish-calendar";
import { Button } from "@/components/ui/button";

export default function CalendarPage() {
  return (
    <AppShell
      title="发布日历"
      description="手动记录计划发布或已经发布的文案，不触发任何外部平台操作。"
      maxWidth="7xl"
      actions={
        <Button asChild variant="outline">
          <Link href="/tasks">查看文案任务</Link>
        </Button>
      }
    >
      <PublishCalendar />
    </AppShell>
  );
}
