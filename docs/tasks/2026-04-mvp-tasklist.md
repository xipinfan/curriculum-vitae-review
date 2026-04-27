# MVP 开发任务清单（2026-04）

## 已完成

1. 建立 monorepo 结构（`apps/api` + `apps/web`）
2. 建立 NestJS 后端可运行骨架（健康检查 + 访问密钥校验接口）
3. 建立 React + Ant Design 前端工作台骨架（四大模块入口）
4. 补充本地 Postgres 的 Docker Compose 配置
5. 提供 `.env.example` 与统一启动脚本
6. 接入 Prisma ORM，完成 `workspace/diagnosis/session` 数据模型与基础 API 骨架
7. 实现简历导入与结构化解析接口（文本/Markdown 优先）
8. 实现诊断任务流基础闭环（创建任务、异步执行、状态轮询、SSE 事件流）
9. 实现诊断卡片处理动作（采纳、忽略、手动编辑）并接入前端操作台
10. 接入 OpenAI-compatible 模型配置管理与连通性测试接口
11. 实现问答练习链路（出题、作答、批改、追问与评分）并接入前端面板
12. 加入最小端到端测试（健康检查 + key 验证 + 工作台加载）
13. 将问答出题与批改升级为可配置 LLM 执行器（优先 workspace 模型配置，失败回退规则引擎）
14. 打通前端“简历导入 -> 诊断任务 -> 问答会话”一键链路，并补充步骤可视化与失败定位
15. 增加 GitHub Actions CI（`typecheck + build + api e2e + web test`）
16. 将诊断执行器升级为 LLM+Agent 编排（规划、候选生成、覆盖补齐、收敛排序）并保留规则回退
17. 复盘状态模块接入结构化会话复盘报告（准备度、强弱项、行动建议）
18. 复盘状态新增多会话趋势视图（最近会话均分、分数变化、轮次轨迹）
19. CI 升级为分层并行作业（typecheck/build/api e2e/web test）并加入并发取消策略
20. 复盘趋势细化为“按周 + 按岗位方向”双维度（支持窗口周数切换）
21. 补齐 Docker 部署能力（postgres + api + web）并增加生产启动脚本

## 下一步（按优先级）

1. 为诊断/问答链路补充更多业务回归测试（覆盖异常路径与并发场景）
2. 打磨前端“作战包复盘”模块的趋势细化（增加岗位方向筛选与趋势下载）
3. 优化 CI 安装耗时（可引入依赖预热或复用构建产物）

## 备注

- 由于本机 Docker daemon 未启动，本次尚未在本地真实数据库执行 `prisma migrate dev`；
  已生成迁移 SQL：
  - `apps/api/prisma/migrations/20260426193000_init/migration.sql`
  - `apps/api/prisma/migrations/20260426201500_resume_parse_fields/migration.sql`
  - `apps/api/prisma/migrations/20260426211500_diagnosis_item_actions/migration.sql`
  - `apps/api/prisma/migrations/20260426214500_model_configs/migration.sql`
