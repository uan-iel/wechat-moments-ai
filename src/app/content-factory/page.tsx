import { AppShell } from "@/components/app-shell";
import { ContentFactory } from "@/components/content-factory";

export default function ContentFactoryPage() {
  return (
    <AppShell
      title="内容工厂"
      description="选择朋友圈或小红书，再选内容形式和产品；系统会自动读取本地文案记忆生成草稿。"
    >
      <ContentFactory />
    </AppShell>
  );
}
