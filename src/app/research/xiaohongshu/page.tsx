import { AppShell } from "@/components/app-shell";
import { XiaohongshuResearchPanel } from "@/components/xiaohongshu-research-panel";

export default function XiaohongshuResearchPage() {
  return (
    <AppShell
      eyebrow="Xiaohongshu Research"
      title="小红书研究中心"
      description="这是专门给小红书用的研究层：接收抓取样本、分析高表现内容规律，并把结论写进后端记忆。"
      maxWidth="7xl"
    >
      <XiaohongshuResearchPanel />
    </AppShell>
  );
}
