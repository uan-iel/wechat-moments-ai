# WeChat Moments AI

本地 AI 内容工作台，支持 `朋友圈` 和 `小红书` 两个平台的本地文案记忆读取、文案生成、多版本定稿与手工发布记录。

## 现在能做什么

- 按平台读取本地数据库里的内容形式、产品和分类文案记忆
- 投喂的参考文案存放在本地数据库，不上传到 GitHub
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
- `/content-factory` - 选择平台、内容形式和产品，读取本地记忆生成文案草稿
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

## Local Memory Import

投喂文案请放在 `.local-memory/reference-memory.json`。这个目录已被 Git 忽略，不会上传到 GitHub。

```json
{
  "formats": [
    {
      "platform": "MOMENTS",
      "name": "内容形式名称",
      "description": "这类内容适合什么场景",
      "writingGuide": "分类关键词、写作要求、语气方向",
      "products": [
        {
          "name": "产品名称",
          "description": "产品说明",
          "keywords": ["产品关键词", "场景关键词"],
          "memories": [
            {
              "title": "本地记忆标题",
              "keywords": ["记忆关键词"],
              "content": "这里放分好类的参考文案或摘要"
            }
          ]
        }
      ]
    }
  ]
}
```

导入命令：

```bash
npm run memory:import
```

导出本地记忆包：

```bash
npm run memory:export
```

## Xiaohongshu Research Import

如果你要抓取小红书主题/账号内容做“爆文规律学习”，现在可以先走独立研究通道，不会污染前端知识库。

1. 用外部爬虫把结果导出成 JSON
2. 导入到本地研究库：

```bash
npm run research:import:xhs -- /absolute/path/to/notes.json "新品话题样本" "新品 场景 人群"
```

3. 启动本地服务后，调用研究分析接口生成“研究洞察”：

```bash
curl -X POST http://localhost:3100/api/research/xiaohongshu \
  -H "Content-Type: application/json" \
  -d '{"collectionName":"新品话题样本","scopeKey":"新品 场景 人群"}'
```

生成后的研究洞察会自动进入后端记忆，并在后续朋友圈/小红书文案生成时作为“外部平台研究洞察”参与提示词。

## Xiaohongshu Crawler Worker

这个项目现在采用“主仓库一键安装 worker”的方式，不要求用户再单独手动拉第二个仓库。

### 一键安装

在本项目根目录执行：

```bash
npm run worker:xhs:install
```

这条命令会自动：

- 把 `MediaCrawler` 克隆到本项目的 `.crawler/MediaCrawler`
- 执行 `uv sync`
- 执行 `uv run playwright install`

安装完成后，启动本项目并打开 `/research/xiaohongshu`，就可以继续：

- 打开登录浏览器
- 启动 worker
- 发起小红书关键词抓取
- 自动入库并生成“小红书专用”的研究洞察

### 说明

- `.crawler/` 已加入 `.gitignore`，不会把 worker 运行产物提交到 GitHub
- 当前没有把 `MediaCrawler` 源码直接并入本仓库，是因为它体积较大，而且采用 `Non-Commercial Learning License 1.1`
- 所以本项目采用“安装脚本内置、源码按需拉取”的方式，尽量做到一套产品内完成，同时保持仓库可维护
- 这套研究记忆只给 `小红书生成模块` 使用，不会串到朋友圈

### 依赖要求

本地需要预先安装：

- `git`
- `uv`
- `Google Chrome`

如果你已经完成 `npm run worker:xhs:install`，通常不需要再单独处理 Python 依赖。

## Core API Routes

- `GET|POST /api/content-formats` - 本地记忆导入器使用的内容形式接口
- `GET|POST /api/products` - 本地记忆导入器使用的产品接口
- `GET|POST /api/product-assets` - 本地文案记忆素材接口
- `POST /api/product-assets/upload` - 本地图片记忆素材接口
- `POST /api/product-assets/analyze` - 分析本地图片记忆素材
- `POST /api/generate-content` - 生成文案草稿
- `POST /api/revise-content` - 生成 AI 改写版本
- `GET|POST /api/research/xiaohongshu` - 小红书研究集合列表与研究洞察生成
- `GET|PATCH /api/content-tasks/:id` - 查看任务详情并定稿版本
- `POST /api/content-tasks/:id/versions` - 保存手动修改版本
- `GET|POST /api/publish-calendar` - 记录手工发布日程

## Data Model

- `ContentFormat` - 内容形式，按 `platform` 区分朋友圈和小红书
- `Product` - 内容形式下的具体产品，`sellingPoints` 在界面语义上作为产品关键词使用
- `ProductAsset` - 本地文案或图片记忆，图片文件会本地存储
- `ContentTask` - 文案任务与多个版本
- `ContentVersion` - 初稿、AI 改写稿和手动修改稿
- `PublishCalendarEntry` - 纯手工发布备忘记录
- `ResearchCollection / ResearchNote / ResearchInsight` - 外部平台抓取结果、本地研究样本与可复用写作洞察

## Notes

- 默认旧数据会归到 `朋友圈` 平台
- `.local-memory/` 已加入 `.gitignore`，请把投喂文案和可打包导出的本地记忆放在这里
- 使用 `npm run memory:import` 从 `.local-memory/reference-memory.json` 导入本地记忆
- 版本号以 `package.json` 为准
