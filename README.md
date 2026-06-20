# WeChat Moments AI

本地 AI 朋友圈文案生产工具，聚焦“内容形式 - 产品 - 图文素材 - 图片分析 - 文案生成 - 多版本定稿 - 手工发布记录”。

## Tech Stack

- Next.js 14 App Router
- React + TypeScript
- Tailwind CSS + shadcn/ui structure
- Prisma + PostgreSQL
- LangChain.js + `@langchain/openai`

## Getting Started

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Open http://localhost:3000 to view the local workspace.

## Useful Routes

- `/formats` - manage content formats, products, product text assets, and product image assets
- `/content-factory` - choose a product and selected assets to generate copy drafts
- `/tasks` - manage generated copy tasks and versions
- `/calendar` - record planned or completed manual publishing dates
- `/settings` - configure AI endpoints per capability

## Model Configuration

Model capabilities are configured independently. Each capability can use a different OpenAI-compatible service, base URL, model name, and API key.

- `llm` - copy generation and revision, for example DeepSeek
- `embedding` - semantic retrieval; if empty, the app falls back to local keyword retrieval
- `vision` - product image analysis, for example Qwen-VL or GPT-4o
- `image` - reserved for future image generation integrations
- `audio` - reserved for future audio integrations

## Core API Routes

- `GET|POST /api/content-formats` - manage content formats
- `GET|POST /api/products` - manage products under content formats
- `GET|POST /api/product-assets` - manage product text and image assets
- `POST /api/product-assets/analyze` - analyze a stored product image with the configured vision model
- `POST /api/generate-content` - generate copy from a content format, product, and selected assets
- `POST /api/revise-content` - create an AI-revised version
- `GET|PATCH /api/content-tasks/:id` - fetch task details and finalize a selected version
- `POST /api/content-tasks/:id/versions` - save manual edits as a new version
- `GET|POST /api/publish-calendar` - record manual publishing plans or results
