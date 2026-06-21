# WeChat Moments AI

本地 AI 内容工作台，支持 `朋友圈` 和 `小红书` 两个平台的知识库、文案生成、多版本定稿与手工发布记录。

## 现在能做什么

- 按平台管理内容形式、产品和素材
- 文本素材与图片素材分开管理，图片支持拖拽文件或文件夹导入
- 图片素材会落盘到本地 `public/uploads/...`
- 生成文案时按平台自动切换表达方式
- 小红书采用双段式生成，先出标题再出正文
- 任务支持初稿、AI 改写、手动修改、定稿和删除
- 发布日历只做手工备忘，不会触发任何外部发布

## Tech Stack

- Next.js 14 App Router
- React + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL
- LangChain.js + `@langchain/openai`

## Getting Started

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3100` to view the local workspace.

## Main Pages

- `/` - 总览
- `/formats` - 按平台管理知识库、产品和图文素材
- `/content-factory` - 选择平台、内容形式、产品和素材，生成文案草稿
- `/tasks` - 管理草稿、AI 改写和手动修改版本
- `/calendar` - 记录朋友圈 / 小红书的手工发布计划
- `/settings` - 配置模型服务与测试连接

## Model Configuration

模型配置是统一的，不区分朋友圈和小红书。

- `llm` - 文案生成与改写
- `embedding` - 语义检索；为空时会回退到本地关键词检索
- `vision` - 产品图片分析
- `image` - 预留给后续图像生成
- `audio` - 预留给后续音频能力

## Core API Routes

- `GET|POST /api/content-formats` - 按平台管理内容形式
- `GET|POST /api/products` - 管理内容形式下的产品
- `GET|POST /api/product-assets` - 管理文本素材
- `POST /api/product-assets/upload` - 拖拽文件或文件夹上传图片素材
- `POST /api/product-assets/analyze` - 分析图片素材
- `POST /api/generate-content` - 生成文案草稿
- `POST /api/revise-content` - 生成 AI 改写版本
- `GET|PATCH /api/content-tasks/:id` - 查看任务详情并定稿版本
- `POST /api/content-tasks/:id/versions` - 保存手动修改版本
- `GET|POST /api/publish-calendar` - 记录手工发布日程

## Data Model

- `ContentFormat` - 内容形式，按 `platform` 区分朋友圈和小红书
- `Product` - 内容形式下的具体产品
- `ProductAsset` - 文本或图片素材，图片文件会本地存储
- `ContentTask` - 文案任务与多个版本
- `ContentVersion` - 初稿、AI 改写稿和手动修改稿
- `PublishCalendarEntry` - 纯手工发布备忘记录

## Notes

- 默认旧数据会归到 `朋友圈` 平台
- 删除产品或内容形式时，会同时清理对应的本地图片文件
- 版本号当前为 `2.0.0`
