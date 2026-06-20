import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ContentFactory } from "@/components/content-factory";
import { Button } from "@/components/ui/button";

export default function ContentFactoryPage() {
  return (
    <AppShell
      title="内容工厂"
      description="从素材库检索相关内容，结合风格模板生成朋友圈草稿。"
      actions={
        <Button asChild variant="outline">
          <Link href="/styles">风格管理</Link>
        </Button>
      }
    >
      <ContentFactory />
    </AppShell>
  );
}
