import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ContentFactory } from "@/components/content-factory";
import { Button } from "@/components/ui/button";

export default function ContentFactoryPage() {
  return (
    <AppShell
      title="内容工厂"
      description="选择朋友圈或小红书，再选内容形式、产品和人工选定的图文素材生成草稿。"
      actions={
        <Button asChild variant="outline">
          <Link href="/formats">知识库</Link>
        </Button>
      }
    >
      <ContentFactory />
    </AppShell>
  );
}
