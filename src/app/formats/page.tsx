import { AppShell } from "@/components/app-shell";
import { KnowledgeManagement } from "@/components/knowledge-management";

export default function FormatsPage() {
  return (
    <AppShell
      title="知识库"
      description="按内容形式、产品和图文素材组织知识库；图片素材可由视觉模型分析特征。"
      maxWidth="7xl"
    >
      <KnowledgeManagement />
    </AppShell>
  );
}
