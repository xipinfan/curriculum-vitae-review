# curriculum-vitae-review

一个可私有部署的 AI 简历分析与面试准备工作台。

项目目标不是简单地“帮用户写一份简历”，而是围绕用户已有简历，构建一套可持续迭代的面试准备系统：先帮助用户发现简历中的问题，再辅助用户优化表达，最后基于简历内容生成面试追问、批改用户自己的回答，并沉淀成可中断、可恢复、可复盘的面试作战包。

## 项目定位

系统面向正在找工作的用户，核心解决两个问题：

1. 让简历写得更好：发现表达空洞、项目亮点不足、指标缺失、技术描述风险等问题，并给出可操作的优化建议。
2. 让面试答得更稳：围绕简历中的项目、技术点和经历生成高概率追问，支持用户输入自己的回答，再由 AI 批改、追问和补强。

项目第一版应优先做成“AI 简历诊断与面试作战包系统”，而不是泛泛的聊天机器人，也不是一开始就做完整的简历排版平台。

## 第一版范围

MVP 优先覆盖以下能力：

- 简历导入：优先支持粘贴文本或 Markdown；PDF、DOCX 可以作为辅助导入能力。
- 目标方向：用户填写目标岗位、技术栈、级别、业务方向等上下文。
- 简历诊断：AI 找出简历中的问题、风险点、薄弱描述和可能被追问的位置。
- 简历优化：用户在页面上看到问题卡片，可选择处理、忽略、采纳 AI 改写建议或手动编辑。
- 问答练习：基于简历和目标方向生成追问；用户输入自己的回答；AI 批改、评分、指出漏洞并继续追问。
- 中断恢复：所有诊断项、优化项、问答项都需要结构化存储，支持分多次完成。

第一版暂不把完整简历排版和导出作为核心链路。排版导出可以作为后续能力，在简历内容结构稳定后再扩展。

## 面试作战包结构

作战包不应只是一段 AI 聊天回复，而应是一组结构化数据。

建议第一版围绕以下区域组织：

- 简历诊断区：展示简历中的问题、风险点、薄弱描述。
- 优化处理区：用户对每个问题选择处理、忽略、采纳改写或手动编辑。
- 问答练习区：生成追问，保存用户回答，记录 AI 批改、评分和后续追问。
- 复盘状态区：记录哪些问题已经准备好，哪些仍然薄弱，哪些需要回到简历中继续修改。

“问题和回答”不拆成两个顶层模块，而是作为问答练习区的一组数据：每个追问下面包含 AI 参考思路、用户回答、批改结果和后续追问。

## 权限与空间模型

项目第一版采用轻量多人模型：

- 系统有一个管理员密钥。
- 管理员可以创建、禁用访问密钥。
- 每个访问密钥对应一个独立 workspace。
- 用户使用访问密钥进入自己的空间。
- 不做传统账号密码注册。
- 管理员只管理密钥，不在应用界面查看用户简历内容。
- 第一版做到应用层隔离，不承诺数据库级不可读。

这个模型适合个人私有部署，也方便后续发放给朋友或小范围用户试用。

## 技术方案

计划技术栈：

- 后端：NestJS
- 前端：Vite + React + Ant Design + Less
- AI 工作区：Ant Design X + Ant Design X Markdown
- Agent 编排：LangGraph JS/TS
- 数据库：Postgres
- 部署：Docker Compose
- 模型接入：OpenAI-compatible API

LangGraph 第一版建议直接集成在 NestJS 服务内，不单独拆 Python 服务。这样前后端都保持 TypeScript，Docker 部署更简单，Agent 事件流也更容易通过 SSE 或 WebSocket 推给前端。

模型接入采用 OpenAI-compatible 协议，通过 `baseURL`、`apiKey` 和 `model` 配置适配不同模型供应商。系统应支持从接口中获取模型列表，也允许用户手动填写模型名。

## Agent 设计

第一版不需要过度多 Agent 化，可以先设计成 LangGraph 中的多个专业节点：

- 简历解析节点：把原始简历拆成结构化片段。
- 诊断节点：生成问题、风险、薄弱点。
- 优化建议节点：给出可操作的改写建议。
- 追问生成节点：按项目、技术和经历生成面试问题。
- 回答批改节点：批改用户自己的回答。
- 复盘节点：总结当前准备状态和下一步建议。

这样既保留多 Agent 架构的扩展性，又不会在第一版把系统复杂化。

## 总体判断

该项目可行，且适合从“私有部署、多 workspace 隔离、结构化存储、可中断恢复的 AI 简历诊断与面试作战包系统”切入。

核心竞争力不在于单次 AI 聊天，而在于把简历背后的面试风险、回答准备、优化动作都变成可管理、可迭代、可复盘的数据。

## 当前已执行的项目任务

本仓库已从需求文档推进到可运行骨架，当前完成：

- Monorepo 结构：`apps/api` + `apps/web`
- 后端：NestJS 最小服务（`/api/health`、`/api/v1/workspaces/validate-key/:accessKey`）
- 前端：Vite + React + Ant Design + Less 工作台
- `/workspace` 核心 AI 面板：`@ant-design/x`（Welcome / Conversations / Bubble / Sender / Prompts）
- Markdown 渲染：`@ant-design/x-markdown`
- 一键作战包：简历导入 -> 解析 -> 诊断 -> 建会话 -> 自动出题（含步骤进度与错误定位）
- 诊断执行器：LLM+Agent 多步骤编排（规划、候选生成、覆盖补齐、收敛排序）+ 规则回退
- Docker Compose：Postgres + API + Web 一键部署
- CI：GitHub Actions 并行执行 `typecheck + build + api e2e + web test`
- 任务清单：`docs/tasks/2026-04-mvp-tasklist.md`

## Docker 部署（推荐）

1. 配置环境变量

```bash
cp .env.example .env
```

2. 启动整套服务（数据库 + API + Web）

```bash
docker compose up -d --build
```

仓库默认将 Postgres 映射到宿主机 `5433`，以避免和本机已有数据库冲突。
如需改回其他端口，可覆盖 `POSTGRES_PORT`，并同步调整 `.env` 里的 `DATABASE_URL`。

3. 查看服务状态

```bash
docker compose ps
```

默认地址：

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:3001/api/health

说明：`web` 容器通过 Nginx 反代 `/api/*` 到 `api` 容器，浏览器侧不需要额外配置跨域地址。

## 本地启动

1. 安装依赖

```bash
pnpm install
```

2. 启动数据库（可选但推荐，默认映射到宿主机 `5433`）

```bash
docker compose up -d postgres
```

3. 配置环境变量

```bash
cp .env.example .env
```

4. 启动前后端

```bash
pnpm dev
```

如需本地生产模式启动：

```bash
pnpm build
pnpm start:prod
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3001/api/health

## 后端数据层（NestJS + Prisma）

后端已接入 Prisma，并包含以下核心模型：

- `Workspace`
- `ResumeDocument`
- `DiagnosisJob` / `DiagnosisItem`
- `InterviewSession` / `SessionRound`

Prisma 相关命令（在仓库根目录执行）：

```bash
pnpm --filter @cv-review/api prisma:generate
pnpm --filter @cv-review/api prisma:migrate:dev
pnpm --filter @cv-review/api prisma:migrate:deploy
pnpm --filter @cv-review/api prisma:studio
```

初始化迁移文件位置：

- `apps/api/prisma/migrations/20260426193000_init/migration.sql`
- `apps/api/prisma/migrations/20260426201500_resume_parse_fields/migration.sql`
- `apps/api/prisma/migrations/20260426211500_diagnosis_item_actions/migration.sql`
- `apps/api/prisma/migrations/20260426214500_model_configs/migration.sql`

## 当前后端基础接口

- `GET /api/health`
- `POST /api/v1/workspaces`
- `GET /api/v1/workspaces`
- `GET /api/v1/workspaces/validate-key/:accessKey`
- `GET /api/v1/model-configs?workspaceId=...`
- `POST /api/v1/model-configs`
- `PATCH /api/v1/model-configs/:configId`
- `POST /api/v1/model-configs/:configId/test`
- `GET /api/v1/model-configs/:configId/models`
- `POST /api/v1/model-configs/test-direct`
- `POST /api/v1/resumes/import`
- `GET /api/v1/resumes/:resumeId`
- `POST /api/v1/resumes/:resumeId/parse`
- `GET /api/v1/resumes/:resumeId/structured`
- `GET /api/v1/diagnosis/jobs?workspaceId=...`
- `POST /api/v1/diagnosis/jobs`
- `POST /api/v1/diagnosis/jobs/:jobId/start`
- `GET /api/v1/diagnosis/jobs/:jobId`
- `GET /api/v1/diagnosis/jobs/:jobId/stream`（SSE）
- `PATCH /api/v1/diagnosis/jobs/:jobId/status`
- `GET /api/v1/diagnosis/jobs/:jobId/items`
- `POST /api/v1/diagnosis/jobs/:jobId/items`
- `PATCH /api/v1/diagnosis/jobs/:jobId/items/:itemId/action`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions?workspaceId=...`
- `GET /api/v1/sessions/:sessionId`
- `POST /api/v1/sessions/:sessionId/generate-questions`
- `PATCH /api/v1/sessions/:sessionId/status`
- `GET /api/v1/sessions/:sessionId/rounds`
- `POST /api/v1/sessions/:sessionId/rounds`
- `PATCH /api/v1/sessions/:sessionId/rounds/:roundId/answer`
- `GET /api/v1/sessions/:sessionId/progress`
- `GET /api/v1/sessions/:sessionId/review`
- `GET /api/v1/sessions/review-trends?workspaceId=...&weeks=...`

## 简历解析说明（当前版本）

- 当前支持导入来源：`TEXT`、`MARKDOWN`
- 当前暂不支持直接导入：`PDF`、`DOCX`（会返回 400）
- 解析方式：规则解析（章节识别 + 联系方式抽取 + 工作/项目/教育条目化）
- 解析结果会写入 `ResumeDocument.parsedData`，并记录 `parserVersion` 与 `parsedAt`

## 诊断任务流说明（当前版本）

- 任务创建：`POST /api/v1/diagnosis/jobs`
- 异步启动：`POST /api/v1/diagnosis/jobs/:jobId/start`
- 状态轮询：`GET /api/v1/diagnosis/jobs/:jobId`
- 事件流：`GET /api/v1/diagnosis/jobs/:jobId/stream`（SSE）
- 当前执行器为 LLM+Agent 编排：
  - `planning`：生成本轮诊断策略与重点类别
  - `candidate generation`：生成候选诊断项
  - `coverage guard`：补齐关键类别（如指标与技术深度）
  - `ranking`：收敛排序并输出最终卡片
- 兜底策略：任一步骤 LLM 不可用时自动回退规则结果，保证任务可完成

## 诊断卡片动作说明（当前版本）

- 统一动作接口：`PATCH /api/v1/diagnosis/jobs/:jobId/items/:itemId/action`
- 支持动作：
  - `ADOPT`（采纳）
  - `IGNORE`（忽略）
  - `MANUAL_EDIT`（手动编辑，需要 `editedContent`）
- 结果会更新：
  - `DiagnosisItem.status`
  - `DiagnosisItem.editedContent`（仅手动编辑）
  - `DiagnosisItem.userNote`（可选）
- 前端工作台已提供可视化处理面板，可直接操作诊断卡片状态

## 模型配置管理说明（当前版本）

- 配置存储：`ModelConfig`（按 `workspaceId` 隔离）
- 支持字段：`baseUrl`、`apiKey`、`defaultModel`、`status`
- 列模型：通过 OpenAI-compatible `GET {baseUrl}/models`
- 连通性测试：
  - 按配置测试：`POST /api/v1/model-configs/:configId/test`
  - 直连测试：`POST /api/v1/model-configs/test-direct`
- 安全返回：接口仅返回 `apiKeyMasked`，不回传明文 key

## 问答练习链路说明（当前版本）

- 会话管理：创建会话并按 workspace 拉取列表
- 自动出题：`POST /api/v1/sessions/:sessionId/generate-questions`
- 作答批改：`PATCH /api/v1/sessions/:sessionId/rounds/:roundId/answer`
- 自动追问：作答批改后按薄弱点自动生成下一轮问题
- 进度统计：`GET /api/v1/sessions/:sessionId/progress`
- 结构化复盘：`GET /api/v1/sessions/:sessionId/review`（准备度/强弱项/行动建议）
- 趋势聚合：`GET /api/v1/sessions/review-trends`（按周与按岗位方向）
- 前端 `问答练习` 模块已接入完整闭环（创建会话、出题、作答、评分、追问）
- 前端 `复盘状态` 模块已接入会话复盘报告 + 多会话趋势（支持 4/8/12 周窗口）
- 执行器：优先使用 workspace 级模型配置调用 OpenAI-compatible `/chat/completions`；
  如配置缺失或调用失败，会自动回退到本地规则引擎，保证链路可用

## 最小 E2E 测试

已加入最小测试覆盖：

- API e2e：健康检查、访问密钥校验
- API e2e：诊断 Agent 编排回退/覆盖补齐
- Web 测试：workbench 页面基础加载

执行命令：

```bash
pnpm --filter @cv-review/api test:e2e
pnpm --filter @cv-review/web test
```

## LLM 执行器实现位置

- `apps/api/src/llm/openai-compatible.service.ts`
- `apps/api/src/diagnosis/diagnosis-agent.service.ts`
- `apps/api/src/diagnosis/diagnosis.service.ts`（诊断任务编排接入）
- `apps/api/src/sessions/sessions.service.ts`（问答出题/批改/追问接入）

## 前端基础架构（Vite + Less）

前端采用 `Vite + React + TypeScript + Less`，并提供可扩展的分层目录：

- `src/router`：路由入口与页面映射
- `src/pages`：页面级组件（当前为 `workbench`）
- `src/services`：接口请求封装与业务 API
- `src/types`：前端类型定义
- `src/styles`：全局 Less 与变量

当前前端组件分工：

- 访问、信息录入、模型配置等常规业务表单：`antd`
- `/workspace` AI 工作区的会话导航、消息流、快捷动作与发送区：`@ant-design/x`
- AI 输出中的 Markdown 内容：`@ant-design/x-markdown`

已在 `vite.config.ts` 中启用：

- `@` 路径别名（指向 `src`）
- Less 预处理器（自动注入 `variables.less`）
- 基础分包策略（`react` / `antd`）
