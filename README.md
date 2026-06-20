# WeChat Moments AI

本地 AI 朋友圈文案生产工具，聚焦“风格学习 - 素材检索 - 文案生成 - 多版本定稿 - 手工发布记录”。

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
npm run prisma:migrate -- --name local_copywriting_refactor
npm run dev
```

Open http://localhost:3000 to view the local workspace.

## Useful Routes

- `/styles` - paste historical copy and create style profiles
- `/content-factory` - add knowledge items and generate copy drafts
- `/tasks` - manage copy tasks and versions
- `/calendar` - record planned or completed manual publishing dates
- `/settings` - configure AI model provider and API key

## Core API Routes

- `POST /api/analyze-style` - analyze pasted historical copy into a `StyleProfile`
- `GET|POST|PATCH /api/style-profiles` - manage style profiles
- `GET|POST /api/knowledge-items` - manage local knowledge materials
- `POST /api/generate-content` - generate copy and create a task version
- `POST /api/revise-content` - create an AI-revised version
- `GET|PATCH /api/content-tasks/:id` - fetch task details and finalize a selected version
- `POST /api/content-tasks/:id/versions` - save manual edits as a new version
- `GET|POST /api/publish-calendar` - record manual publishing plans or results
