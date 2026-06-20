import { AppShell } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <AppShell
      title="模型设置"
      description="按能力分别配置文案、向量、图片理解、图片生成和音频模型。"
      maxWidth="7xl"
    >
      <SettingsPanel />
    </AppShell>
  );
}
