import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  return (
    <AppShell
      title="文案任务"
      description="管理 AI 生成草稿、手动修改、AI 改写、多版本和最终定稿。"
      maxWidth="7xl"
      actions={
        <Button asChild>
          <Link href="/content-factory">新建文案</Link>
        </Button>
      }
    >
      <TaskList />
    </AppShell>
  );
}
