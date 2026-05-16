## PRD-002：学习画像构建与动态维护系统（React + LangGraph 实现版）

**版本**：v2.2
**优先级**：P0（赛题必选功能1）
**技术栈**：React 18 + TypeScript（前端），Python 3.11 + LangGraph + FastAPI（后端），DeepSeek API（LLM）
**关联系统**：对话交互前端、Profile Agent、知识图谱 (Neo4j)、pgvector、Redis、MongoDB
**关联PRD**：PRD-001（多用户信息维护）、PRD-003（画像动态微调机制）

---

## AI 状态维护表（人类可读版）

| 功能编号 | 功能描述 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|---------|------|
| chat_profile_init | 对话式画像初始化（AI对话收集专业/年级/学习目标/风格/自我评估） | ✅ 是 | ✅ 是 | - | 已完成LLM对话，使用DeepSeek API |
| profile_api | 画像CRUD API（/api/v1/profile/v2） | ✅ 是 | ✅ 是 | - | 已完成基本CRUD操作 |
| knowledge_management | 知识点管理（知识点的增删改查、得分更新） | ✅ 是 | ✅ 是 | - | 已完成Neo4j存储 |
| error_topic_management | 易错点管理（易错点的增删改查） | ✅ 是 | ✅ 是 | - | 已完成MongoDB存储 |
| behavior_events | 行为事件记录（页面级交互、答题、搜索等） | ✅ 是 | ✅ 是 | - | 已完成MongoDB存储 |
| behavior_timeline | 行为时间线查询 | ✅ 是 | ✅ 是 | - | 已完成，支持分页 |
| dynamic_profile_display | 动态画像展示页面（指标卡片、知识点进度、易错点列表） | ✅ 是 | ✅ 是 | - | 已完成，添加了空数据404处理 |
| empty_data_redirect | 空数据时自动跳转初始化流程 | ✅ 是 | ✅ 是 | - | 已完成，404时navigate到/profile/init |
| langgraph_profile_agent | LangGraph Profile Agent（信号累积触发画像更新） | 🔴 否 | 🔴 否 | - | 规划中，尚未实现 |
| cognitive_style_storage | 认知风格存储（Neo4j） | ✅ 是 | ✅ 是 | - | 已完成Neo4j存储 |

---

## AI 状态维护表（JSON版）

```json
{
  "ai_status": {
    "chat_profile_init": {
      "description": "对话式画像初始化（AI对话收集专业/年级/学习目标/风格/自我评估）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成LLM对话，使用DeepSeek API"
    },
    "profile_api": {
      "description": "画像CRUD API（/api/v1/profile/v2）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成基本CRUD操作"
    },
    "knowledge_management": {
      "description": "知识点管理（知识点的增删改查、得分更新）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成Neo4j存储"
    },
    "error_topic_management": {
      "description": "易错点管理（易错点的增删改查）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成MongoDB存储"
    },
    "behavior_events": {
      "description": "行为事件记录（页面级交互、答题、搜索等）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成MongoDB存储"
    },
    "behavior_timeline": {
      "description": "行为时间线查询",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成，支持分页"
    },
    "dynamic_profile_display": {
      "description": "动态画像展示页面（指标卡片、知识点进度、易错点列表）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成，添加了空数据404处理"
    },
    "empty_data_redirect": {
      "description": "空数据时自动跳转初始化流程",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成，404时navigate到/profile/init"
    },
    "langgraph_profile_agent": {
      "description": "LangGraph Profile Agent（信号累积触发画像更新）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "规划中，尚未实现"
    },
    "cognitive_style_storage": {
      "description": "认知风格存储（Neo4j）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成Neo4j存储"
    }
  }
}
```

---

### 1. 功能概述

本系统为每位学生构建**动态学习画像**，支持对话式初始化、轻量行为持续更新、信号累积触发画像演化，并最终驱动资源生成和路径规划。

核心设计原则：
- **对话式初始化**：React 聊天组件引导新用户完成 5 轮对话，收集专业、年级、学习目标、学习风格、自我评估等信息，调用后端 API 构建初始画像。
- **LLM 驱动对话**：使用 DeepSeek API 实现智能对话，而非硬编码的固定问答流程。LLM 根据用户回答动态生成下一个问题，提升对话自然度和信息抽取准确率。
- **无视频事件依赖**：只采集页面级交互、答题、搜索等行为，不分析视频内部事件。
- **信号累积更新**：前端埋点上报事件 → LangGraph 的 Profile Agent 消费并累积信号 → 达到阈值后更新 Neo4j 等持久化画像。
- **多维可解释**：前端展示画像指标卡片、知识点掌握进度条、易错点列表及变更时间线，每条变化可回溯至原始事件。
- **空数据容错**：当用户画像数据为空时，前端自动跳转至初始化流程，避免报错。

---

### 2. 技术架构总览

```
┌──────────────────────────────────────────────────────┐
│  React Frontend                                       │
│  ├─ ChatPage (AI 对话 - 画像初始化)                    │
│  ├─ DynamicProfilePage (画像指标/知识点/易错点)        │
│  ├─ BehaviorEventsPage (时间线/行为事件)               │
│  ├─ ProfileInitPage (表单式初始化 - 备选)              │
│  └─ EventTracker (埋点 SDK)                           │
└─────────────────────────────────────────────────────┘
                 │ HTTP (RESTful)
┌────────────────▼─────────────────────────────────────┐
│  FastAPI Gateway                                      │
│  ├─ /api/v1/profile/v2 (画像 CRUD)                    │
│  ├─ /api/v1/profile/v2/knowledge (知识点管理)          │
│  ├─ /api/v1/profile/v2/error-prone (易错点管理)        │
│  ├─ /api/v1/profile/v2/behavior (行为事件记录)         │
│  ├─ /api/v1/profile/v2/timeline (时间线查询)           │
│  └─ Auth Middleware (JWT)                             │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│  LangGraph Agent System (规划中)                       │
│  ├─ ProfileInitAgent (对话 → 抽取+对齐图谱 → 初始画像) │
│  ├─ ProfileUpdateAgent (消费事件信号 → 阈值触发更新)    │
│  └─ ExplainabilityAgent (生成可解释时间线)             │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│  Data Stores                                          │
│  ├─ Neo4j (知识图谱 + 掌握度关系 + 认知风格 + 易错点)   │
│  ├─ pgvector (多模态偏好向量)                          │
│  ├─ Redis (会话画像、信号累积)                         │
│  └─ MongoDB (行为事件日志、画像时间线)                 │
└──────────────────────────────────────────────────────┘
```

---

### 3. 画像维度定义（8维，与引擎无关）

维度定义与 PRD-002 v1.0 完全一致，此处仅按存储引擎重新分组。

#### 3.1 Neo4j 存储维度
| 维度 | 图模型 | 说明 |
|------|--------|------|
| 知识基础 | `(s:Student)-[:MASTERS {score, confidence, last_updated}]->(k:KnowledgePoint)` | 每个知识点的掌握评分(0‑1)及置信度(0.1‑1.0) |
| 认知风格 | `(s)-[:HAS_STYLE]->(:CognitiveStyle {type, confidence})` | 枚举值：visual/auditory/reading_writing/kinesthetic/mixed |
| 易错点偏好 | `(s)-[:WEAK_AT {frequency}]->(k:KnowledgePoint)` | 直接关联易错知识点及错误次数 |

#### 3.2 pgvector 存储维度
| 维度 | 表/集合 | 说明 |
|------|---------|------|
| 多模态偏好 | `student_preference_vectors` (vector 512) | 文档/视频/音频/练习等模态的偏好嵌入，由资源交互加权生成 |

#### 3.3 MongoDB 存储维度
| 维度 | 文档键 | 说明 |
|------|--------|------|
| 学习活跃时段 | `active_hours` (dict: morning/afternoon/evening/night) | 各时段学习占比分布 |
| 学习节奏 | `learning_rhythm` (dict: scalar/trend) | 学习进度快慢及趋势 |
| 元认知校准度 | `metacognitive_calibration` (float, -1..+1) | 自评与实际得分差距的滑动平均 |
| 注意力特征 | `attention_feature` (float, 0..1) | 基于失焦、空闲事件的累积，越高越易分心 |

#### 3.4 Redis 短时维度
| 字段 | 键 | 说明 |
|------|-----|------|
| 当前模块 | `current_module` | 正在学习的课程模块 |
| 近期答题序列 | `recent_answers` | 最近5题正误序列 |
| 认知负荷 | `cognitive_load` | low/medium/high |
| 注意力漂移计数 | `attention_drift_cnt` | 当前会话失焦次数 |

---

### 4. 前端实现规格 (React)

#### 4.1 页面与组件树

**主要页面**：
- `ChatPage`（`/chat`）：AI 对话式画像初始化，5 轮对话收集信息后调用 API 创建画像
- `ProfileInitPage`（`/profile/init`）：表单式画像初始化（5 步向导，备选方案）
- `DynamicProfilePage`（`/profile/dynamic`）：画像仪表盘（6 维指标卡片、知识点掌握列表、易错点列表）
- `BehaviorEventsPage`（`/profile/events`）：行为事件记录（时间线视图、行为事件视图、手动记录事件）
- `ProfilePage`（`/profile`）：个人中心（基本信息、个人信息编辑）

**关键组件**：
- `ChatPanel`：聊天界面，气泡消息，支持系统主动提问及用户回复
- `TypingIndicator`：思考中动画提示
- `MessageBubble`：消息气泡组件
- `ProfileMetricCard`：画像指标卡片（认知风格、知识点数量等）
- `KnowledgeProgressBar`：知识点掌握进度条（带颜色分级）
- `ErrorTopicBadge`：易错点标记（带错误次数）
- `TimelineList`：时间线组件，展示画像变更记录
- `EventTracker`：高阶组件或 Hook，负责采集页面级事件并通过 API 上报

**状态管理**：使用 Zustand 管理认证状态；与后端通信使用 Axios（带 JWT 拦截器和自动刷新）。

#### 4.2 前端与后端交互

| 前端行为 | 接口 | 说明 |
|----------|------|------|
| 创建画像 | `POST /api/v1/profile/v2` | 提交认知风格、活跃时间、学习节奏等初始化数据 |
| 获取完整画像 | `GET /api/v1/profile/v2` | 返回聚合的画像 JSON（404 时跳转至初始化页面） |
| 获取画像摘要 | `GET /api/v1/profile/v2/summary` | 返回简化版画像信息 |
| 更新画像 | `PUT /api/v1/profile/v2` | 更新认知风格、活跃时间等维度 |
| 添加知识点 | `POST /api/v1/profile/v2/knowledge` | 添加知识点及掌握度 |
| 更新知识点 | `PUT /api/v1/profile/v2/knowledge` | 更新知识点掌握度/置信度 |
| 删除知识点 | `DELETE /api/v1/profile/v2/knowledge/{point}` | 删除指定知识点 |
| 添加易错点 | `POST /api/v1/profile/v2/error-prone` | 添加易错知识点及错误次数 |
| 记录行为事件 | `POST /api/v1/profile/v2/behavior` | 提交行为事件 JSON |
| 获取时间线 | `GET /api/v1/profile/v2/timeline` | 从 MongoDB 读取画像变更时间线 |
| 获取行为事件 | `GET /api/v1/profile/v2/behavior` | 从 MongoDB 读取行为事件列表 |
| 删除画像 | `DELETE /api/v1/profile/v2` | 删除用户画像数据 |

#### 4.3 对话式初始化流程 (ChatPage)

**当前实现**：基于硬编码的 5 轮固定问答流程，通过前端 JavaScript 收集信息后调用 API 创建画像。

**目标实现**（待开发）：使用 DeepSeek API 实现 LLM 驱动的智能对话。

**对话步骤**（5 轮，LLM 动态调整）：
1. **专业背景**：询问用户专业 → 收集 `major`
2. **年级信息**：询问年级 → 收集 `grade`
3. **学习目标**：询问学习目标 → 收集 `learningGoal`
4. **学习风格**：提供 4 种风格选项（视觉型/听觉型/阅读型/实践型）→ 收集 `preferredStyle`
5. **自我评估**：询问基础水平 → 收集 `selfAssessment`

**LLM 对话流程**：
1. 前端发送用户消息到后端 `/api/v1/chat/profile-init` 接口
2. 后端调用 DeepSeek API，传入系统提示词（包含画像初始化策略和已收集信息）
3. LLM 生成下一个问题或判断信息已足够，返回响应
4. 前端展示 LLM 回复，用户继续对话
5. 当 LLM 判断信息收集完成时，调用 `POST /api/v1/profile/v2` 创建画像

**系统提示词模板**：
```
你是一个学习助手，正在帮助用户初始化学习画像。你需要收集以下信息：
1. 专业背景（major）
2. 年级（grade）
3. 学习目标（learningGoal）
4. 学习风格偏好（preferredStyle）：visual/auditory/reading_writing/kinesthetic/mixed
5. 自我评估基础水平（selfAssessment）

当前已收集的信息：{collected_info}

请根据用户回答动态生成下一个问题，保持对话自然流畅。当所有信息收集完成后，回复以"[COMPLETE]"开头。
```

**完成后**：调用 `POST /api/v1/profile/v2` 创建画像，成功后跳转至 `/profile/dynamic`。

**错误处理**：
- API 调用失败时显示具体错误信息（红色提示框）
- 404 错误（画像不存在）自动跳转至初始化页面
- 对话过程中支持"思考中"加载状态提示
- LLM API 调用失败时降级到硬编码问答流程

#### 4.4 埋点事件采集 (EventTracker)

在 React 中使用 `useEffect` 全局监听以下事件，并统一格式化上报：

- `visibilitychange` → `attention_drift` (+1)
- 用户空闲（5分钟无交互）→ `idle` (+2)
- 页面卸载（beforeunload）→ 计算当前资源停留时长，若 >30s 发送 `resource_view` 事件
- 答题提交 → 调用专用接口（已含对错信息）
- 资源收藏/下载 → 按钮点击埋点
- 模块完成后自评弹窗 → 提交自评分数

所有上报事件格式：
```json
{
  "event_type": "resource_view | answer_submit | attention_drift | ...",
  "student_id": "...",
  "payload": { ... },
  "timestamp": "ISO8601"
}
```
前端侧自动注入 `student_id` 来自登录 JWT。

#### 4.5 前端提示策略（遵循 CLAUDE.md）

| 场景 | 成功提示 | 失败提示 |
|------|----------|----------|
| 注册/登录 | 弹窗/绿色提示框 | 红色提示框展示具体原因 |
| 画像初始化（对话） | 不提示（直接跳转） | 红色提示框展示具体原因 |
| 画像初始化（表单） | 成功页面 | 红色提示框展示具体原因 |
| 添加知识点/易错点 | 绿色提示框 | 红色提示框展示具体原因 |
| 删除知识点 | 绿色提示框 | 红色提示框展示具体原因 |
| 记录行为事件 | 绿色提示框 | 红色提示框展示具体原因 |
| 页面导航 | 无提示 | 无提示 |

---

### 5. 后端 Agent 实现规格 (LangGraph)

#### 5.1 Agent 清单

1. **ProfileInitAgent**  
   - 职责：处理新用户画像初始化对话。  
   - 状态：对话历史、已抽取维度（部分）。
   - 工作流：
     1. 系统根据预定义策略生成提问。
     2. 用户回复后，LLM 抽取专业、知识点、偏好等。
     3. 对齐 Neo4j 中的知识图谱，将知识点名称映射到节点。
     4. 重复直到收集到足够信息，最后汇总写入 Neo4j + pgvector + MongoDB，并生成初始时间线。
2. **ProfileUpdateAgent**  
   - 职责：消费行为事件，累积信号，触发画像更新。
   - 状态：每个学生的信号累积器（存于 Redis Sorted Set）。
   - 工作流：
     1. 从事件队列（Kafka 或 Redis Stream）读取事件。
     2. 根据事件类型生成信号并累积到 Redis `signal:{student_id}:{knowledge_point}` key 的权重。
     3. 若某信号权重超过阈值，执行更新：Neo4j 调整掌握度/风格；pgvector 更新偏好向量；MongoDB 追加时间线。
     4. 对于触发补救资源的信号（如 weak_point 累积），调用资源生成 Agent（预留接口）。
3. **ExplainabilityAgent**  
   - 职责：为每一次画像更新生成可读解释，写入 MongoDB `profile_timeline` 集合。
   - 内部调用：组合事件上下文和更新内容，生成自然语言描述。

#### 5.2 LangGraph 图定义（关键部分）

**画像初始化图** (StateGraph):
```python
from langgraph.graph import StateGraph, START, END

class InitState(TypedDict):
    messages: List[BaseMessage]
    extracted_info: dict  # 部分画像维度
    required_dims: list

builder = StateGraph(InitState)
builder.add_node("ask_question", ask_strategy)
builder.add_node("extract_info", extract_with_llm)
builder.add_node("validate_info", validate_against_kg)
builder.add_node("finalize_profile", persist_initial_profile)
builder.add_edge(START, "ask_question")
builder.add_edge("ask_question", "extract_info")
builder.add_conditional_edges("extract_info", check_completeness, {
    "incomplete": "ask_question",
    "complete": "validate_info"
})
builder.add_edge("validate_info", "finalize_profile")
builder.add_edge("finalize_profile", END)
graph = builder.compile()
```

**信号更新图** (简化版，状态为事件流):
```python
class UpdateState(TypedDict):
    events: List[Event]
    student_id: str

def signal_accumulator(state):
    # 从 Redis 读取当前累积值，增加信号，返回是否触发更新
    ...
def apply_updates(state):
    # 执行 Neo4j/pgvector/MongoDB 写操作，并生成时间线
    ...
```

LangGraph 图将部署为 FastAPI 后台服务，通过 API 触发或根据 Kafka 消费者自动运行。

---

### 6. 接口定义（RESTful）

#### 6.1 画像 CRUD

**创建画像**
- `POST /api/v1/profile/v2`
- Body:
```json
{
  "cognitive_style": "visual",
  "cognitive_style_confidence": 0.6,
  "active_hours": {"morning": 0.25, "afternoon": 0.25, "evening": 0.25, "night": 0.25},
  "learning_rhythm_scalar": 0.5,
  "learning_rhythm_trend": 0.0,
  "metacognitive_calibration": 0.0,
  "attention_feature": 0.5,
  "knowledge_points": []
}
```
- 响应：`201 Created` + `{"message": "画像创建成功"}`

**获取画像**
- `GET /api/v1/profile/v2`
- 响应：
```json
{
  "student_id": "...",
  "knowledge_mastery": [
    {"knowledge_point": "反向传播", "score": 0.45, "confidence": 0.8, "last_updated": "..."}
  ],
  "cognitive_style": {"style_type": "visual", "confidence": 0.6, "last_updated": "..."},
  "error_prone_topics": [
    {"topic": "梯度消失", "error_count": 3, "last_updated": "..."}
  ],
  "active_hours": {"morning": 0.25, "afternoon": 0.25, "evening": 0.25, "night": 0.25},
  "learning_rhythm": {"scalar": 0.5, "trend": 0.0},
  "metacognitive_calibration": 0.0,
  "attention_feature": 0.5,
  "created_at": "...",
  "updated_at": "..."
}
```
- 404 响应：`{"detail": "画像不存在，请先创建"}`

**更新画像**
- `PUT /api/v1/profile/v2`
- Body: 部分字段更新
- 响应：`{"message": "画像更新成功"}`

**删除画像**
- `DELETE /api/v1/profile/v2`
- 响应：`{"message": "画像删除成功"}`

#### 6.2 知识点管理

**添加知识点**
- `POST /api/v1/profile/v2/knowledge`
- Body: `{"knowledge_point": "...", "score": 0.5, "confidence": 0.5}`
- 响应：`{"message": "知识点添加成功"}`

**更新知识点**
- `PUT /api/v1/profile/v2/knowledge`
- Body: `{"knowledge_point": "...", "score": 0.6, "confidence": 0.7}`
- 响应：`{"message": "知识点更新成功"}`

**删除知识点**
- `DELETE /api/v1/profile/v2/knowledge/{knowledge_point}`
- 响应：`{"message": "知识点删除成功"}`

#### 6.3 易错点管理

**添加易错点**
- `POST /api/v1/profile/v2/error-prone`
- Body: `{"topic": "...", "error_count": 1}`
- 响应：`{"message": "易错点添加成功"}`

#### 6.4 行为事件

**记录行为事件**
- `POST /api/v1/profile/v2/behavior`
- Body: `{"event_type": "...", "event_data": {...}}`
- 响应：`{"message": "行为事件记录成功"}`

**获取时间线**
- `GET /api/v1/profile/v2/timeline?limit=50&skip=0`
- 响应：`{"events": [...]}`

**获取行为事件**
- `GET /api/v1/profile/v2/behavior?event_type=...&limit=100&skip=0`
- 响应：`{"events": [...]}`

#### 6.5 LLM 对话（待实现）

**画像初始化对话**
- `POST /api/v1/chat/profile-init`
- Body: `{"message": "我是计算机专业", "conversation_history": [...]}`
- 响应：
```json
{
  "reply": "很好！那你的年级是？",
  "collected_info": {"major": "计算机专业"},
  "is_complete": false
}
```
- 当 `is_complete` 为 `true` 时，前端调用 `POST /api/v1/profile/v2` 创建画像

---

### 7. 非功能需求

- **实时性**：API 响应延迟 < 500ms；事件异步处理延迟 < 5s。
- **可扩展性**：LangGraph Agent 可水平扩展（通过 Kafka 消费者组）。
- **安全性**：所有 API 通过 JWT 鉴权。
- **日志与监控**：所有 Agent 状态转换记录结构化日志，对接 Prometheus 指标。
- **前端体验**：所有页面均有返回首页按钮，避免用户陷入死页面；空数据时自动引导至初始化流程。

---

### 8. 阶段拆分（与 prd-2-phased.md 对齐）

| 阶段 | 内容 | 技术产出 |
|------|------|----------|
| P0 | 存储层与基础 API | Neo4j 图模型、pgvector 表、MongoDB 集合、Redis 结构定义；FastAPI 端点骨架 |
| P1 | 对话式初始化 | LangGraph `ProfileInitAgent` 图实现；React `ChatPage`；RESTful API 集成 |
| P2 | 行为事件采集与存储 | React `EventTracker`；`POST /api/v1/profile/v2/behavior`；MongoDB 写入 |
| P3 | 信号累积与动态更新 | LangGraph `ProfileUpdateAgent`；Redis 信号累积；阈值触发逻辑；画像时间线生成 |
| P4 | 前端可视化 | React 画像指标卡片、知识点进度条、易错点列表、时间线组件；连接实时画像 API |

---

### 9. 验收标准

1. 新用户通过 AI 对话（5 轮）或表单（5 步向导）完成画像初始化，后端成功生成画像并存入 Neo4j + MongoDB。
2. 前端 `DynamicProfilePage` 正确展示 6 维画像指标、知识点掌握列表（带进度条）、易错点列表。
3. 前端 `BehaviorEventsPage` 正确展示时间线和行为事件，支持手动记录事件。
4. 前端 `ChatPage` 支持 5 轮对话式初始化，完成后自动跳转至画像页面。
5. 所有页面均有返回首页按钮，空数据时自动引导至初始化流程。
6. 所有操作均有明确的成功/失败提示（遵循 CLAUDE.md 提示策略）。
7. 所有数据隔离，API 鉴权正确。
8. 系统中不存在任何视频进度分析代码。

---

### 10. 当前实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 后端 API (profile/v2) | ✅ 已完成 | 所有 CRUD 端点已实现 |
| 前端 ChatPage | ✅ 已完成（基础版） | 5 轮硬编码对话式初始化，调用真实 API |
| 前端 ChatPage (LLM) | 📋 规划中 | 待集成 DeepSeek API 实现智能对话 |
| 前端 DynamicProfilePage | ✅ 已完成 | 6 维指标、知识点管理、易错点管理 |
| 前端 BehaviorEventsPage | ✅ 已完成 | 时间线、行为事件、手动记录 |
| 前端 ProfileInitPage | ✅ 已完成 | 5 步表单式初始化（备选方案） |
| 空数据容错处理 | ✅ 已完成 | 404 错误自动跳转至初始化页面 |
| LangGraph ProfileInitAgent | 📋 规划中 | 待实现 LLM 驱动的对话 Agent |
| LangGraph ProfileUpdateAgent | 📋 规划中 | 待实现信号累积与自动更新 |
| LangGraph ExplainabilityAgent | 📋 规划中 | 待实现可解释时间线生成 |
| EventTracker 自动埋点 | 📋 规划中 | 待实现页面级事件自动采集 |

---

此 PRD 现在可直接作为 React 前端开发者和 LangGraph 后端开发者的实现依据。如需进一步将 LangGraph 图转为具体的 Python 代码框架，或设计 React 组件的详细 Props/State 接口，请告知。
