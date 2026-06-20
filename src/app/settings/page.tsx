import { AppShell } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <AppShell
      title="模型设置"
      description="配置文案生成、风格分析和向量检索使用的 AI 模型。"
      maxWidth="7xl"
    >
      <SettingsPanel />
    </AppShell>
  );
}
