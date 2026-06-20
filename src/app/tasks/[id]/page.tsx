import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell
      title="任务详情"
      description="切换版本、AI 改写、手动修改、定稿并一键复制。"
      actions={
        <Button asChild variant="outline">
          <Link href="/tasks">任务列表</Link>
        </Button>
      }
    >
      <TaskDetail taskId={params.id} />
    </AppShell>
  );
}
