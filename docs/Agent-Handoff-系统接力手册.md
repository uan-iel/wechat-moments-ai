# Agent Handoff 系统接力手册

## 1. 这份文件是干什么的

这份文档是给后续接手本项目的 agent、开发者或协作者准备的“快速上手手册”。

它解决三个问题：

1. 这个项目现在到底是什么
2. 它已经做过哪些关键演化
3. 如果继续做，应该从哪里下手

建议新接手者先读本文件，再读 README，再看具体代码。

## 2. 项目一句话定义

`WeChat Moments AI` 现在本质上是一个 **本地 AI 内容生产工作台**，服务两个平台：

- 朋友圈
- 小红书

它不是企业微信自动化发布工具，不再承担外部平台直接接管或自动发帖职责。核心价值集中在：

- 本地内容记忆管理
- AI 文案生成与改写
- 小红书研究样本抓取、筛选、洞察生成
- 多版本任务管理
- 手工发布记录

## 3. 项目已经历过的关键架构变化

### 阶段 A：企业微信营销助手雏形

早期方向包括：

- 企业微信账号连接
- 风格学习
- 审核与发布
- 后台任务

这一版后来被证明过重，且不利于快速验证内容生产核心价值。

### 阶段 B：去企微化，转为本地内容工作台

后续做了大重构：

- 删除企业微信接入和自动发布
- 删除直接对外平台控制逻辑
- 保留内容生成、知识结构、审核修改、多版本管理
- 改为纯本地数据库驱动

这是当前架构的真正起点。

### 阶段 C：从“风格”改成“内容形式 -> 产品 -> 素材”

核心知识结构被改造成更接近真实运营逻辑的三层结构：

- ContentFormat
- Product
- ProductAsset

其中 `ProductAsset` 既包括文本素材，也包括图片素材和图片分析结果。

### 阶段 D：品牌项目隔离

引入 `BrandProject`，实现多品牌隔离：

- 每个品牌项目拥有独立的数据域
- 内容形式、产品、任务、研究数据都不共用
- 模型配置仍是全局共享

这意味着本项目已经不是单品牌脚本，而是多项目工作台。

### 阶段 E：小红书研究中心独立成模块

引入：

- `ResearchCollection`
- `ResearchNote`
- `ResearchInsight`
- `ResearchCrawlJob`

并接入 MediaCrawler worker 作为抓取来源。

### 阶段 F：研究洞察进入生成链路

小红书文案生成时，不再只依赖产品和素材，还会读取：

- 当前项目下的小红书研究洞察
- 与本次主题相关的研究结论

这一步让“研究”真正参与“生成”。

## 4. 当前系统总架构

### 前端

- Next.js App Router
- React + Tailwind + shadcn/ui
- 主要页面：
  - `/content-factory`
  - `/tasks`
  - `/calendar`
  - `/settings`
  - `/research/xiaohongshu`

### 后端

- Next.js API Routes
- Prisma + PostgreSQL
- 本地文件 + 数据库存储
- MediaCrawler worker 通过本地 HTTP API 协同

### AI 层

- 文案生成：`src/lib/ai/content-generator.ts`
- 文案改写：`src/lib/ai/content-reviser.ts`
- 图片分析：`src/lib/ai/image-analyzer.ts`
- 研究记忆路由：`src/lib/ai/research-memory.ts`
- 模型配置入口：`src/lib/ai/model-config.ts`

### 数据层核心模型

- `BrandProject`
- `ContentFormat`
- `Product`
- `ProductAsset`
- `ContentTask`
- `ContentVersion`
- `PublishCalendarEntry`
- `ResearchCollection`
- `ResearchNote`
- `ResearchInsight`
- `ResearchCrawlJob`

模型定义在 [schema.prisma](/Users/m3max/Selena's app/Wechat Moments AI/prisma/schema.prisma)。

## 5. 当前最关键的业务闭环

### 闭环 1：本地内容生成

路径：

1. 选择品牌项目
2. 选择平台
3. 选择内容形式
4. 选择产品
5. 输入文案目标
6. 后端读取：
   - 产品关键词
   - 本地图文素材
   - 图片分析结果
   - 平台底层文案记忆
   - 小红书研究洞察（仅小红书）
7. 生成草稿
8. 在任务页修改、改写、定稿

### 闭环 2：小红书研究学习

路径：

1. 在研究页发起抓取
2. worker 返回 JSON
3. 导入 `ResearchCollection / ResearchNote`
4. 人工按关键词筛样本
5. 手动删除不需要的帖子
6. 重新生成洞察
7. 内容工厂生成时自动引用相关洞察

## 6. 当前已经踩过并修过的重要坑

### 坑 1：抓取结果串题

原因：

- MediaCrawler 的 `search_contents_YYYY-MM-DD.json` 是按天追加
- 同一天多个话题写进同一个 JSON
- 系统早期没有按 `source_keyword` 严格隔离

修复：

- 导入时优先按 `rawPayload.source_keyword` 精确过滤
- 如果当前查询词没有对应结果，不再回退导入整份 JSON
- 同名集合重新导入时先清旧样本和旧洞察

关键文件：

- [xiaohongshu-import.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/lib/research/xiaohongshu-import.ts)

### 坑 2：研究洞察误参与不相关生成

原因：

- 研究记忆检索过宽
- 泛词如“礼物”“推荐”“好物”容易造成错误命中

修复：

- `resolveResearchMemory` 中过滤泛词
- 必须有真实主题重合才纳入本次生成

关键文件：

- [research-memory.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/lib/ai/research-memory.ts)

### 坑 3：历史抓取任务删除不稳定

原因：

- 运行中任务和历史任务删除逻辑未区分

修复：

- 前端禁用运行中任务删除
- 后端接口对 `RUNNING / IMPORTING / PENDING` 返回 `409`

关键文件：

- [crawl/route.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/app/api/research/xiaohongshu/crawl/route.ts)
- [xiaohongshu-research-panel.tsx](/Users/m3max/Selena's app/Wechat Moments AI/src/components/xiaohongshu-research-panel.tsx)

## 7. 现在各页面分别负责什么

### `/content-factory`

职责：

- 选择平台、内容形式、产品
- 输入文案目标
- 选择参考文案倾向、字数、风格标签
- 触发生成
- 小红书模式下预览“本次会参考的小红书研究”

关键文件：

- [content-factory.tsx](/Users/m3max/Selena's app/Wechat Moments AI/src/components/content-factory.tsx)
- [generate-content/route.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/app/api/generate-content/route.ts)
- [preview/route.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/app/api/research/xiaohongshu/preview/route.ts)

### `/research/xiaohongshu`

职责：

- worker 安装与状态
- 登录浏览器状态
- 发起抓取任务
- 查看任务列表
- 查看研究集合
- 样本筛选、删帖、重生洞察

关键文件：

- [xiaohongshu-research-panel.tsx](/Users/m3max/Selena's app/Wechat Moments AI/src/components/xiaohongshu-research-panel.tsx)
- [research/xiaohongshu/route.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/app/api/research/xiaohongshu/route.ts)
- [crawl/route.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/app/api/research/xiaohongshu/crawl/route.ts)

### `/tasks`

职责：

- 查看每条内容任务
- 多版本切换
- AI 改写
- 手动编辑
- 定稿

关键文件：

- [task-list.tsx](/Users/m3max/Selena's app/Wechat Moments AI/src/components/task-list.tsx)
- [task-detail.tsx](/Users/m3max/Selena's app/Wechat Moments AI/src/components/task-detail.tsx)

## 8. 当前“研究洞察如何接入内容生成”的准确说明

这是后续接手者最容易误判的地方。

当前不是“研究页和内容工厂完全分开”，而是：

1. 研究页负责生产 `ResearchInsight`
2. 内容工厂生成小红书文案时，调用 `resolveResearchMemory`
3. `resolveResearchMemory` 会根据：
   - `campaignGoal`
   - `contentFormatName`
   - `productName`
   - `productKeywords`
   在当前项目下筛选相关 `ResearchInsight`
4. 返回两种结果：
   - 给模型的 `text`
   - 给前端显示的 `insights`

所以当前链路已经实现了：

- 研究数据进入生成提示词
- 前端可见“本次命中了哪些研究洞察”

## 9. 接下来最值得做的事

下面这些是“下一位 agent”最适合优先接的方向。

### 优先级 A：把研究结果继续显性化

建议：

- 在任务详情页显示该文案实际引用了哪些研究洞察
- 保存生成时的 `appliedResearchInsights` 快照，避免研究库后续变化影响历史任务解释

原因：

现在内容工厂里已经能预览，但任务详情页还看不到“这篇文案到底参考了什么”。

### 优先级 B：做“研究 -> 生成”的一键跳转

建议：

- 在研究集合卡片上加“用这组洞察去生成小红书文案”
- 自动带上：
  - 平台
  - 推荐的内容形式或 scopeKey
  - 研究集合 id

原因：

现在链路是连着的，但操作上还要用户自己切页面、重新选对象。

### 优先级 C：去重历史洞察

当前问题：

- 同一集合可能生成多条相似洞察

建议：

- 生成新洞察时允许覆盖旧洞察
- 或给集合设定“当前生效洞察”概念

### 优先级 D：研究样本清洗能力再升级

建议：

- 支持“只看高互动样本”
- 支持“按关键词保留 / 排除”
- 支持“批量标记为忽略而不是物理删除”

## 10. 新 agent 接手时的最短阅读顺序

建议按下面顺序读：

1. [README.md](/Users/m3max/Selena's app/Wechat Moments AI/README.md)
2. 本文档
3. [schema.prisma](/Users/m3max/Selena's app/Wechat Moments AI/prisma/schema.prisma)
4. [content-factory.tsx](/Users/m3max/Selena's app/Wechat Moments AI/src/components/content-factory.tsx)
5. [xiaohongshu-research-panel.tsx](/Users/m3max/Selena's app/Wechat Moments AI/src/components/xiaohongshu-research-panel.tsx)
6. [generate-content/route.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/app/api/generate-content/route.ts)
7. [research-memory.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/lib/ai/research-memory.ts)
8. [xiaohongshu-import.ts](/Users/m3max/Selena's app/Wechat Moments AI/src/lib/research/xiaohongshu-import.ts)

## 11. 接手时要避免的误区

- 不要把这个项目再理解成企业微信自动发布工具
- 不要默认研究系统和内容生成系统是分开的
- 不要忽略 `BrandProject` 的数据隔离
- 不要假设抓取 JSON 文件只对应一个主题
- 不要轻易改掉当前研究记忆过滤规则，否则容易再次串题

## 12. 一句话总结

这个项目现在最准确的定位是：

一个以品牌项目为边界、以内容形式和产品为骨架、以本地文案记忆和小红书研究洞察为燃料的 AI 内容生产工作台。
