# PRD-007：多智能体协同个性化学习资源生成系统

**版本**：v1.0
**日期**：2026-05-12
**大赛**：第十五届中国软件杯 A3 赛题

**技术栈**：
- 前端：React18 + TypeScript + Zustand + SSE 流式接收
- 后端：Python3.11 + FastAPI + LangGraph v0.1.x + Qwen/DeepSeek
- 存储：持久化存储(PG/Neo4j/MinIO/MongoDB)、非持久化存储(Redis/LangGraph InMemoryStore)

**关联 PRD**：PRD-001 (用户)、PRD-002 (画像)、PRD-003 (AI Chat)、PRD-006 (题库)

**核心约束**：低 API 调用、无 Agent 协商、前后端解耦、状态可持久/可临时、LangGraph 标准方法落地

---

## 1. 核心框架选型与 LangGraph 关键方法

### 1.1 框架唯一选型：LangGraph

弃用 AutoGen/GroupChat（多轮协商、API 爆炸），采用状态机驱动的 LangGraph，满足：
- 可控流转
- 并行生成
- 状态持久/非持久切换
- 前后端异步交互

### 1.2 LangGraph 核心方法

| 方法/类 | 官方用途 | 本系统落地场景 |
|--------|----------|---------------|
| StateGraph | 定义带类型的工作流有向图 | 构建多 Agent 协同总流程 |
| MessagesState | 标准化消息与状态结构 | 统一 Agent 间输入输出、前后端数据载体 |
| add_node() | 注册执行节点（Agent/工具/函数） | 注册 4 大核心 Agent 为独立节点 |
| add_edge() | 固定顺序执行边 | 定义 Agent 串行执行链路 |
| add_conditional_edges() | 条件路由边 | 异常降级、资源类型分支、存储策略判断 |
| parallel_nodes() | 并行执行子节点 | 5 类多模态资源并行生成，降低耗时 |
| ToolNode | 工具调用标准化封装 | 对接画像/题库/Neo4j/存储等外部系统 |
| bind_tools() | 大模型绑定工具能力 | Agent 无协商调用外部能力 |
| MemorySaver | 状态持久化存储 | 任务断点续跑、历史任务回溯、竞赛演示存档 |
| InMemoryStore | 状态非持久化存储 | 临时会话、单次生成、不落地任务 |
| get_state()/update_state() | 读取/更新工作流状态 | 前端轮询/SSE 推送任务进度、结果回写 |
| Interrupt | 流程中断点 | 资源生成后审核、人工确认（可选） |

---

## 2. 架构总设计

### 2.1 三层架构（前后端完全解耦）

1. **前端交互层**：AI Chat 触发、任务进度展示、资源预览、学习路径渲染
2. **后端引擎层**：FastAPI 接口 + LangGraph 多 Agent 工作流 + 工具调度
3. **存储层**：持久化存储（落盘）、非持久化存储（临时）

### 2.2 多 Agent 与前后端交互总链路

```
前端 (AI Chat) → HTTP/SSE 请求 → 后端接口 → LangGraph 调度 Agent
    → 多 Agent 协同 → 读写双存储 → 流式/异步返回 → 前端渲染
```

---

## 3. 存储分层设计

### 3.1 持久化存储（落盘、可追溯、竞赛必选）

| 存储 | 数据内容 | 用途 |
|------|----------|------|
| PostgreSQL | 任务记录、资源元数据、学习路径、用户数据 | 结构化数据持久化 |
| Neo4j | 知识点图谱、资源-知识点关联、学生画像关系 | 图关系持久化 |
| MinIO | 多模态资源文件 (PPT/文档/脚本/思维导图) | 文件持久化 |
| MongoDB | 生成日志、行为日志、评估结果 | 日志持久化 |
| LangGraph MemorySaver | 工作流状态、任务上下文 | 流程状态持久化 |

### 3.2 非持久化存储（内存/临时、高性能、自动销毁）

| 存储 | 数据内容 | 用途 |
|------|----------|------|
| Redis | 会话缓存、任务队列、热点画像、临时进度 | 高并发临时缓存 |
| LangGraph InMemoryStore | 单次生成任务状态、临时上下文 | 非存档任务临时状态 |
| 前端内存 (Zustand) | 本地任务状态、预览资源、临时输入 | 前端非持久状态 |

---

## 4. LangGraph 多 Agent 工作流设计

### 4.1 4 个核心 Agent（均为 LangGraph Node）

| Agent | 职责 |
|-------|------|
| SchedulerAgent（调度节点） | 任务入口、参数校验、状态初始化、存储策略判断 |
| ProfileAgent（画像节点） | 读取 6 维+学生画像、薄弱点、认知风格 |
| ResourceGenAgent（资源生成节点） | 并行生成 5 类多模态资源 |
| PathPushAgent（路径推送节点） | 学习路径规划、资源绑定、推送入库 |

### 4.2 工作流构建方法

- 用 `StateGraph` 创建带 `MessagesState` 的工作流
- 用 `add_node()` 注册 4 个 Agent 节点
- 用 `add_edge()` 定义固定执行链路
- 用 `parallel_nodes()` 并行执行 5 类资源生成
- 用 `add_conditional_edges()` 实现：持久化/非持久化切换、API 异常降级
- 用 `MemorySaver/InMemoryStore` 切换状态存储策略
- 用 `get_state()` 支持前端查询任务状态

### 4.3 标准执行流

```
入口 → SchedulerAgent → ProfileAgent → ResourceGenAgent(并行5子节点) → PathPushAgent → 结束
```

---

## 5. 前后端功能拆解

### 5.1 前端职责

**核心**：只做交互与展示，不参与 Agent 逻辑

**触发层**：AI Chat 对话内发起资源生成请求（对接 PRD-003）

**状态层**：Zustand 管理本地临时状态（非持久化）

**交互层**：
- 任务进度实时展示（SSE/轮询调用 get_state()）
- 多模态资源预览（文档/思维导图/题库/案例/视频脚本）
- 学习路径阶梯式渲染
- 临时答疑浮窗（复用 AI Chat）

**传输协议**：HTTP 创建任务、SSE 流式接收结果、轮询查询状态

### 5.2 后端职责

**核心**：Agent 调度、业务逻辑、存储读写、接口提供

| 层级 | 职责 |
|------|------|
| 接口层 | 任务创建、状态查询、结果获取、推送回调 |
| 引擎层 | LangGraph 工作流执行、Agent 协同、工具调用 |
| 存储层 | 读写持久化/非持久化存储、状态管理 |
| Agent 层 | 4 大 Agent 节点逻辑、并行资源生成、异常降级 |

---

## 6. 多 Agent 协作与前后端数据交互

### 6.1 前端→后端触发（创建任务）

1. 前端在 AI Chat 输入生成指令
2. 调用 `POST /api/v1/agent/generate`
3. 后端初始化 MessagesState → 启动 LangGraph 工作流
4. 后端返回 `task_id` → 前端用 `task_id` 轮询/SSE 监听

### 6.2 后端 Agent 内部协同

| Agent | 核心逻辑 |
|-------|----------|
| SchedulerAgent | 判断用持久化 (MemorySaver) 或非持久化 (InMemoryStore) |
| ProfileAgent | 从 Redis/Neo4j 读取 6 维画像（无 LLM 调用） |
| ResourceGenAgent | parallel_nodes 并行生成 5 类资源（仅 1 次 LLM 调用） |
| PathPushAgent | 生成路径、绑定资源、写入 PG/MinIO/Redis |

### 6.3 后端→前端返回（结果推送）

- **方式 A（SSE）**：后端流式推送任务进度与最终资源
- **方式 B（轮询）**：前端调用 `GET /api/v1/agent/task/{task_id}`，后端用 `get_state()` 返回状态
- 前端渲染资源与路径，完成闭环

---

## 7. 开发排期

### 7.1 前端（React）总工时：24h

| 任务编号 | 任务内容 | 工时 | 优先级 |
|---------|---------|------|--------|
| FE-01 | AI Chat 触发入口、任务面板 UI 开发 | 6h | P0 |
| FE-02 | SSE 流式接收/轮询状态、进度展示 | 4h | P0 |
| FE-03 | 多模态资源预览组件开发 | 6h | P0 |
| FE-04 | 学习路径阶梯渲染、交互优化 | 4h | P0 |
| FE-05 | 临时状态管理 (Zustand)、异常提示 | 4h | P1 |

### 7.2 后端（FastAPI + LangGraph）总工时：32h

| 任务编号 | 任务内容 | 工时 | 优先级 |
|---------|---------|------|--------|
| BE-01 | MessagesState 定义、LangGraph 工作流构建 | 6h | P0 |
| BE-02 | 4 个 Agent 节点逻辑、add_node/parallel_nodes 实现 | 8h | P0 |
| BE-03 | 持久化/非持久化存储切换、MemorySaver/InMemoryStore | 4h | P0 |
| BE-04 | 接口开发 (创建/查询/推送)、SSE 支持 | 6h | P0 |
| BE-05 | 异常降级、add_conditional_edges 路由 | 4h | P1 |
| BE-06 | 与 AI Chat/画像/题库联调 | 4h | P0 |

### 7.3 联调与测试 总工时：8h

| 任务内容 | 工时 |
|---------|------|
| 前后端接口联调、SSE/状态同步 | 4h |
| 存储验证、持久/非持久切换测试 | 2h |
| 竞赛演示调试、性能优化 | 2h |

---

## 8. 非功能需求

| 需求 | 说明 |
|------|------|
| LLM 调用 | 1 次/任务（5 类资源批量生成） |
| 存储策略 | 演示用持久化、日常用非持久化 |
| 交互 | 前端 SSE 无刷新、后端异步执行不阻塞 |
| 降级 | LLM 超限→本地模板；Neo4j 异常→PG 标签匹配 |
| 并发 | 支持 100 用户同时创建任务 |

---

## 9. 竞赛验收标准

- ✅ 多智能体架构：LangGraph 状态机 + 4 Agent 协同
- ✅ LangGraph 标准方法落地（StateGraph/parallel_nodes 等）
- ✅ 前后端完全分离、异步交互
- ✅ 持久化/非持久化存储严格区分
- ✅ 6 维+动态画像对接、≥5 类多模态资源生成
- ✅ 学习路径规划 + 资源精准推送
- ✅ 低 API 调用、无 Agent 协商、可稳定演示

---

## 10. 文档使用说明

- 无业务代码，仅保留架构、方法、流转、存储、排期
- 前后端职责完全拆分，可直接分配开发任务
- LangGraph 方法均为官方标准能力，Claude 可直接理解生成设计图/流程图
- 存储分层明确，可直接生成数据库脚本与存储配置
- 完全对齐现有 PRD 格式，可直接合并到项目文档
