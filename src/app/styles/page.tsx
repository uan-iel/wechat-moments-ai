import { AppShell } from "@/components/app-shell";
import { StyleManagement } from "@/components/style-management";

export default function StylesPage() {
  return (
    <AppShell
      title="风格管理"
      description="粘贴历史朋友圈文案学习风格，也可以手动维护多套风格 Profile。"
      maxWidth="7xl"
    >
      <StyleManagement />
    </AppShell>
  );
}
