# 题库与智能练习系统 PRD（v5.1）

> **版本**：v5.1
> **日期**：2026-07-10
> **关联项目**：Education Agent - 个性化学习资源生成与学习多智能体系统  
> **对应赛题**：A3-基于大模型的个性化资源生成与学习多智能体系统开发  
> **目标模块**：多学科题库生成、练习、错题推荐、知识图谱联动，以及 AI Chat 联动子系统  

---

## AI 状态维护表

### 人类可读版

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| F1 | 多学科管理 | P0 | ✅ 是 | ✅ 是 | - | Subject → Domain → Point 三级结构，PostgreSQL CRUD + Neo4j 同步完成 |
| F2 | 个人题库自主管理 | P0 | ✅ 是 | ✅ 是 | - | 学生创建/编辑/删除自己的题库，绑定学科，已实现 |
| F3 | 多题型生成 | P0 | ✅ 是 | ✅ 是 | - | 7种题型全部支持：单选、多选、填空、判断、简答、编程、论述 |
| F4 | 动态难度分级 | P0 | ✅ 是 | ✅ 是 | - | 五级难度：入门/基础/进阶/挑战/竞赛 |
| F5 | 智能标签体系 | P0 | ✅ 是 | ✅ 是 | - | PostgreSQL tags 字段；Neo4j Tag 节点；动态易错标签：错≥2次自动打标+API 管理+前端展示 |
| F6 | 知识图谱关联 | P0 | 🟡 部分 | 🔴 否 | - | Question 节点 + [:TESTS] 关系已实现；PREREQUISITE 和 RELATED_TO 关系未实现（无管理 API） |
| F7 | 错题智能推荐 | P0 | 🔴 否 | 🔴 否 | - | 未实现推荐 API，无 Neo4j 路径遍历推荐逻辑 |
| F8 | 智能练习与进度可视化 | P0 | ✅ 是 | ✅ 是 | - | 练习界面含进度条、颜色提示、章节统计、测后看答案模式 |
| F9 | 练习记录与信号 | P1 | ✅ 是 | ✅ 是 | - | StudentAnswer 表记录答题，随学随新自动更新画像（Neo4j + MongoDB） |
| F10 | 实时画像联动更新 | P0 | 🔴 否 | 🔴 否 | - | 未实现；无 `/internal/profile/analyze-chat` 接口，无 ASKED_ABOUT 关系 |
| F11 | AI Chat 生成题目 | P0 | 🔴 否 | 🔴 否 | - | 未实现；无 `/generate/from-chat` 接口 |
| F12 | 题目即席答疑 | P1 | 🟡 部分 | 🔴 否 | - | 前端已有 ChatPanel 组件；无 `/questions/{id}/ask` 后端接口，后端未实现 |
| F13 | 题目质量审核 | P1 | 🔴 否 | 🔴 否 | - | 未实现 AI 自动审核和人工标记功能 |
| F14 | 批量导入导出 | P2 | 🔴 否 | 🔴 否 | - | 未实现 JSON/Markdown 导入导出 |
| F15 | 章节/知识点管理 | P0 | ✅ 是 | ✅ 是 | - | 在题库详情页可直接创建/删除章节和知识点 |
| F16 | 试卷系统 | P0 | ✅ 是 | ✅ 是 | - | 含 CRUD、组卷、上传解析、AI 生成类似题、PDF/Word 导出、直接练习 |
| F17 | 手动组卷 | P0 | ✅ 是 | ✅ 是 | - | suggest-questions API + ExamOptimizer（章节均衡分配）已实现 |
| F18 | 试卷导入 | P1 | ✅ 是 | ✅ 是 | - | PDF/Word 上传解析 + AI 生成类似题已实现 |
| F19 | 试卷导出 | P1 | ✅ 是 | ✅ 是 | - | PDF（fpdf2）和 Word（python-docx）导出含参考答案页已实现 |
| F20 | 数据结构代码练习与服务端 OJ | P0 | ✅ 是 | 🔴 否 | - | 21 题覆盖 7 个知识点，每点简单/中等/困难各 1 题；公开运行、隐藏测试、真实轨迹、提交记录和隔离运行器已实现，尚待用户验收 |

### JSON 版

```json
{
  "ai_status": {
    "F1_subject_management": {
      "description": "多学科管理（Subject → KnowledgeDomain → KnowledgePoint，三级结构，Neo4j 同步）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "PostgreSQL CRUD + Neo4j MERGE 同步完整实现"
    },
    "F2_bank_management": {
      "description": "个人题库自主管理（创建/编辑/删除，绑定学科，归属用户）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "owner_id 权限校验完整"
    },
    "F3_multi_type": {
      "description": "多题型生成（单选、多选、填空、判断、简答、编程、论述）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "7 种题型全部可创建、编辑、AI 生成"
    },
    "F4_difficulty_levels": {
      "description": "动态难度分级（五级：入门/基础/进阶/挑战/竞赛）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "枚举 + AI 出题提示词要求难度"
    },
    "F5_tags": {
      "description": "智能标签体系（学科级标签、知识点标签、动态易错标签）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "PostgreSQL tags + Neo4j Tag 节点；动态易错标签：错≥2次自动打标，API 管理，前端红色⚠易错显示，仅易错题练习过滤"
    },
    "F6_knowledge_graph": {
      "description": "知识图谱关联（Question → KnowledgePoint 通过 Neo4j；PREREQUISITE/RELATED_TO）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "Question 节点 + [:TESTS] 已实现；PREREQUISITE 和 RELATED_TO 关系无管理入口"
    },
    "F7_error_recommend": {
      "description": "错题智能推荐（基于 Neo4j 路径遍历的针对性练习推荐）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现推荐 API"
    },
    "F8_practice_progress": {
      "description": "智能练习与进度可视化（统计、颜色提示、章节筛选）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "PracticePage 完整实现，含进度条/颜色/章节域统计/测后答案模式"
    },
    "F9_practice_records": {
      "description": "练习记录与信号（答题记录、事件触发、画像联动）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "StudentAnswer 表 + _update_profile_after_answer 实现随学随新"
    },
    "F10_chat_profile_link": {
      "description": "实时画像联动更新（监听 Chat 提问事件，更新 Neo4j/MongoDB/Redis）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现；需要 analyze-chat 内部接口和 ASKED_ABOUT 关系"
    },
    "F11_chat_generate": {
      "description": "AI Chat 生成题目（聊天即出题，对话上下文中生成题目）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现 /generate/from-chat 接口"
    },
    "F12_question_qa": {
      "description": "题目即席答疑（无状态浮窗对话，不持久化）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "前端 ChatPanel 组件已存在；后端 SSE 答疑接口未实现"
    },
    "F13_quality_review": {
      "description": "题目质量审核（AI 自动审核 + 人工标记）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现"
    },
    "F14_batch_import_export": {
      "description": "批量导入导出（JSON/Markdown 格式，保留标签与知识点关联）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现"
    },
    "F15_kp_management": {
      "description": "章节/知识点管理（题库详情页直接创建/删除章节和知识点）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "BankDetailPage 内嵌创建/删除章节和知识点功能"
    },
    "F16_exam_paper_system": {
      "description": "试卷系统（组卷、上传解析、AI 生成类似题、PDF/Word 导出、直接练习）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "完整的 ExamPaper CRUD + parse-upload + ai-generate + start-practice"
    },
    "F17_manual_compose": {
      "description": "手动组卷（指定题型/数量/难度/章节，智能推荐并均衡覆盖）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "ExamOptimizer 类 + suggest-questions API 实现章节轮询均衡分配"
    },
    "F18_upload_parse": {
      "description": "试卷导入（PDF/Word 上传解析，AI 识别结构生成类似题）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "fitz/pptx + LLM 生成类似题"
    },
    "F19_export": {
      "description": "试卷导出（PDF 和 Word 格式，含参考答案页）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "fpdf2 + python-docx 导出，含 LaTeX 转 Unicode"
    },
    "F20_coding_oj": {
      "description": "数据结构代码练习与服务端 OJ（7 个知识点、三难度、公开运行、隐藏测试、提交记录和隔离执行）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "21 道来源可追溯的适配题已实现；服务端判题、真实运行轨迹和独立无网络运行器已接通，自动化回归由本次开发流程执行，尚待用户实际验收"
    }
  }
}
```

### 实施建议（未实现功能优先级）

| 优先级 | 功能 | 依赖 | 建议 |
|--------|------|------|------|
| P0 | F7 错题智能推荐 | F6（图谱） | 实现 Neo4j 路径查询：从 User-[:ANSWERED_WRONG]->Question-[:TESTS]->KP 出发，找关联知识点下的题目 |
| P0 | F10 实时画像联动 | F9 | 创建 analyze-chat 内部接口，监听 Chat 事件更新画像 |
| P0 | F11 Chat 生成题目 | F3（出题） | 创建 from-chat 端点，复用现有 AI 出题流程 |
| P1 | F12 题目即席答疑 | - | 创建 SSE 流式答疑接口，system prompt 注入题目上下文 |
| P1 | F13 质量审核 | - | AI 批量检查已发布题目 |
| P2 | F14 批量导入导出 | - | JSON/Markdown 格式 |

### 已知与 PRD 的偏差

| PRD 要求 | 实际实现 | 影响 |
|----------|---------|------|
| 2.2.4 practice_records 表（含 session_id） | StudentAnswer（question_answers）表，无 session_id 字段 | 功能等价，但无法按练习会话筛选答题记录 |
| 2.2.5 error_collections 表 | 错误记录通过 Neo4j ANSWERED_WRONG + STRUGGLES_WITH 关系处理 | 功能等价 |
| 3.5 练习会话暂停/恢复 API | 未实现 pause/resume 端点 | 练习会话只能通过 update 改变状态 |
| Section 6 事件总线事件 | 未显式发出 quiz:/profile: 系列事件 | 仅通过随学随新间接更新，其他模块无法订阅 |
| 3.1 GET /subjects/{id} 从 Neo4j 查询树 | 从 PostgreSQL 查询 domains + points | 功能等价 |
| PG 表 subjects/question_banks/questions 迁移脚本 | 无独立迁移脚本，通过 SQLAlchemy create_all 创建 | 自动创建，缺少版本化管理 |

---

## 1. 模块概述与设计原则

### 1.1 模块定位

题库系统是“多智能体协同资源生成”的核心练习组件。它围绕**学科 → 知识领域 → 具体知识点**的多层结构，对学生提供个性化出题、自适应练习、基于 Neo4j 知识图谱的错题推荐。**（v4.0 新增）** 系统与 AI Chat 智能对话平台深度互通：对话过程中实时分析用户提问，动态更新学习画像；支持从对话中识别知识缺口并一键生成题目入库；题库内为每道题目提供临时性 AI 答疑对话窗口，不持久化会话数据。

### 1.2 核心功能清单

| 编号  | 功能           | 优先级 | 说明                                                                                                                     |
| --- | ------------ | --- | ---------------------------------------------------------------------------------------------------------------------- |
| F1  | 多学科管理        | P0  | 学科下分“知识领域”及“具体知识点”，层级存储于 Neo4j                                                                                         |
| F2  | 个人题库自主管理     | P0  | 学生创建/编辑/删除自己的题库；题库绑定学科，归属用户                                                                                           |
| F3  | 多题型生成        | P0  | 单选、多选、填空、判断、简答、编程、论述                                                                                                  |
| F4  | 动态难度分级       | P0  | 五级难度：入门/基础/进阶/挑战/竞赛，AI 根据画像自动适配                                                                                      |
| F5  | 智能标签体系       | P0  | 学科级标签、知识点标签、动态易错标签，存储于 Neo4j                                                                                          |
| F6  | 知识图谱关联       | P0  | 题目通过 Neo4j 节点关联到知识点；图谱包含层级、前置依赖、相关关系                                                                                 |
| F7  | 错题智能推荐       | P0  | 基于 Neo4j 路径遍历，推荐针对性练习                                                                                                  |
| F8  | 智能练习与进度可视化   | P0  | 题库内显示统计，练习时颜色提示                                                                                                        |
| F9  | 练习记录与信号      | P1  | 记录答题，触发标准事件，联动画像更新                                                                                                    |
| **F10** | **实时画像联动更新** | **P0** | **[v4.0 新增]** 监听 AI Chat 提问事件，实时抽取知识点/薄弱点，更新 Neo4j 掌握关系、错误倾向及 Redis 缓存，使画像随对话动态刷新                                        |
| **F11** | **AI Chat 生成题目** | **P0** | **[v4.0 新增]** 用户在 AI Chat 中提出知识性问题或要求出题时，自动或手动触发题目生成，结果写入指定题库，实现“聊天即出题”                                                    |
| **F12** | **题目即席答疑**    | **P1** | **[v4.0 新增]** 为题库中的每道题目提供无状态的 AI 答疑浮动窗口，对话不持久化，刷新或关闭即清空，仅用于即时解惑                                                   |
| F13  | 题目质量审核       | P1  | AI 自动审核 + 人工标记                                                                                                        |
| F14  | 批量导入导出       | P2  | JSON/Markdown 格式，保留标签与知识点关联                                                                                           |
| **F15** | **章节/知识点管理** | **P0** | **[v5.0 新增]** 在题库详情页直接创建/删除章节和知识点，无需经过后台管理                                                                |
| **F16** | **试卷系统**       | **P0** | **[v5.0 新增]** 支持从题库组卷、上传解析试卷、AI 生成类似题、PDF/Word 导出、直接练习                                                |
| **F17** | **手动组卷**       | **P0** | **[v5.0 新增]** 指定题型/数量/难度/章节，智能推荐题目并均衡覆盖，支持预览后创建试卷                                                      |
| **F18** | **试卷导入**       | **P1** | **[v5.0 新增]** 上传 PDF/Word 试卷文件，AI 自动识别结构并生成类似题目                                                                  |
| **F19** | **试卷导出**       | **P1** | **[v5.0 新增]** 试卷导出为 PDF 和 Word 格式，包含题目和参考答案页                                                                      |
| **F20** | **数据结构代码练习与服务端 OJ** | **P0** | **[v5.1 新增]** 7 个数据结构知识点各提供简单/中等/困难 1 题，通过隔离运行器执行公开测试和隐藏测试，并保存服务端判题记录 |

### 1.3 设计原则

- **学科结构化**：学科 → 知识领域 → 知识点，三级结构清晰，图存储于 Neo4j
- **标签驱动发现**：通过多维标签实现灵活分类，借助 Neo4j 图查询实现易错点自动发现与标记
- **图谱化推荐**：利用 Neo4j 路径查询实现精准推荐，回退方案为 PostgreSQL 标签匹配
- **存储兼容**：主数据使用 PostgreSQL（含 JSONB）；图关系使用 Neo4j；练习行为日志使用 MongoDB；缓存复用 Redis
- **自主权限**：题库、题目由创建者完全控制，删除操作仅需本人认证
- **[v4.0 新增] 对话联动与即时反馈**：打通 AI Chat 与题库，让学习画像实时反映对话动态，让题目生成触手可及，让答疑轻量化

***

## 2. 数据模型与存储设计

### 2.1 存储分工

| 存储             | 内容                                         | 说明                |
| -------------- | ------------------------------------------ | ----------------- |
| PostgreSQL     | 学科、题库、题目（JSONB）、练习记录、错题记录                   | 结构化查询与事务          |
| Neo4j          | 知识点层级、前置/相关关系、标签节点、题目节点、用户薄弱关系，**[新增]** 用户-知识点问答关系 | 图遍历与推荐            |
| MongoDB (可选)   | 详细答题行为日志，**[新增]** 画像分析事件、题目生成事件            | 与现有行为事件系统统一       |
| Redis          | 练习会话缓存、热门题目缓存，**[新增]** 画像实时薄弱点快照、答疑会话临时缓存    | 提升响应速度，支持临时答疑会话 |

### 2.2 PostgreSQL 表结构（保持原样，仅增补说明）

#### 2.2.3 题目表 `questions`  
**（无结构改动）** 新增来源字段通过 `tags` 冗余标记，如 `"source:ai_chat"`，便于溯源。其余表结构不变。

#### 2.2.6 练习会话表 `practice_sessions`  
**（无改动）**

### 2.3 Neo4j 图模型

#### 2.3.1 节点标签与属性（原有基础上新增）

| 节点类型               | 属性                            | 说明                             |
| ------------------ | ----------------------------- | ------------------------------ |
| `:Subject`         | `{ uuid, name }`              | 学科                             |
| `:KnowledgeDomain` | `{ uuid, name }`              | 知识领域                           |
| `:KnowledgePoint`  | `{ uuid, name, description }` | 具体知识点                          |
| `:Question`        | `{ uuid }`                    | 题目轻量引用                         |
| `:Tag`             | `{ uuid, name, type }`        | type: 学科标签/知识点标签/易错标签          |
| `:User`            | `{ uuid }`                    | 用户节点                           |
| **[新增]** `:WeakPoint` | `{ name, confidence }`        | 临时薄弱点提示（可合并到标签或直接使用 `STRUGGLES_WITH` 关系） |

#### 2.3.2 关系类型（新增一条）

| 关系                | 方向                               | 说明               |
| ----------------- | -------------------------------- | ---------------- |
| `[:BELONGS_TO]`   | `(KnowledgeDomain)->(Subject)`   | 领域归属             |
| `[:HAS_SUB]`      | `(KnowledgeDomain)->(KnowledgePoint)` | 领域包含知识点          |
| `[:PREREQUISITE]` | `(KnowledgePoint)->(KnowledgePoint)` | 前置依赖             |
| `[:RELATED_TO]`   | `(KnowledgePoint)->(KnowledgePoint)` | 相关/易混淆           |
| `[:TAGGED]`       | `(Subject/Domain/Point/Question)->(Tag)` | 打标签              |
| `[:TESTS]`        | `(Question)->(KnowledgePoint)`   | 题目考查的知识点         |
| `[:ANSWERED_WRONG]` | `(User)->(Question)`           | 用户答错             |
| `[:STRUGGLES_WITH]` | `(User)->(KnowledgePoint)`       | 汇总薄弱点            |
| **[新增]** `[:ASKED_ABOUT]` | `(User)->(KnowledgePoint)`   | 用户在对话中提问/关注该知识点 |

#### 2.3.3 知识图谱初始化示例（保持不变）

***

## 3. API 接口规范

### 3.1 学科与知识结构（无变化）

### 3.2 题库管理（无变化）

### 3.3 题目 CRUD（无变化）

### 3.4 AI 多智能体出题（原有基础上增加一个子端点）

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/generate` | 启动多智能体生成任务 | 需要 |
| GET  | `/generate/{request_id}/status` | 查询生成进度 | 需要 |
| GET  | `/generate/{request_id}/result` | 获取生成结果 | 需要 |
| **[新增]** POST | `/generate/from-chat` | **从对话上下文一键生成题目** | 需要 |

#### 3.4.1 原有 `/generate` 接口不变

#### 3.4.2 **[新增] POST /generate/from-chat**  
**说明**：当用户在 AI Chat 中表达出题意图或选中文本触发时调用。

**请求体**：

```json
{
  "chat_id": "uuid",
  "message_id": "uuid (可选，用于定位对话上下文)",
  "target_bank_id": "uuid",
  "keywords": ["Cache替换算法"],
  "difficulty_distribution": { "basic": 0.5, "intermediate": 0.5 },
  "count": 5
}
```

**处理流程**：系统从对话中提取关键知识，调用多智能体出题流程，生成题目直接入库并建立 Neo4j 关系，返回题目列表预览。生成的题目自动打上 `"source:ai_chat"` 标签。

### 3.5 练习与答题（不变）

### 3.6 错题推荐（不变）

### 3.7 **[新增] 画像实时更新触发接口**

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/internal/profile/analyze-chat` | 接收来自 Chat 服务的分析事件，更新画像（内部接口） | 服务间认证 |

**说明**：该接口由 AI Chat 后端在每次用户提问时异步调用，传入用户消息摘要，由 Profile Agent 解析并修改 Neo4j/MongoDB/Redis。

**请求体**：
```json
{
  "user_id": "uuid",
  "session_id": "uuid",
  "message_text": "summary or original",
  "context_summary": "...",
  "extracted_knowledge": [{"name": "Cache映射", "confidence": 0.8}],
  "weak_hints": ["不理解全相联映射"]
}
```

### 3.8 **[新增] 题目即席答疑**

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/questions/{question_id}/ask` | 发起对该题的非持久化答疑对话（SSE 流式） | 需要 |

**请求体**：
```json
{
  "message": "这题为什么选C？",
  "history": [
    {"role": "user", "content": "刚才你说的..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**响应**：`text/event-stream` 流式返回 AI 回答，不存入任何数据库，仅通过 Redis 临时缓存最近几轮（可选，TTL 10分钟）。若无 Redis，则完全无状态，前端自行维护 `history` 数组并在每次请求中回传。

**业务约束**：system prompt 自动注入题目内容与解析，严禁直接给出答案，仅作引导性解答。接口配置每分钟 5 次调用限制。

***

## 3.9 **[新增] 试卷系统 API**

试卷系统允许用户从题库中组卷、上传解析试卷、导出和直接练习。

### 3.9.1 API 端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/banks/{id}/exam-papers` | 创建试卷（含章节配置和题目ID） | Y |
| GET | `/banks/{id}/exam-papers` | 列出题库的试卷 | Y |
| GET | `/exam-papers/{paper_id}` | 试卷详情（含题目内容） | Y |
| PUT | `/exam-papers/{paper_id}` | 更新试卷元数据 | Y |
| DELETE | `/exam-papers/{paper_id}` | 删除试卷 | Y |
| POST | `/banks/{id}/exam-papers/suggest-questions` | 智能推荐题目（按章节均衡分配） | Y |
| POST | `/banks/{id}/exam-papers/parse-upload` | 上传解析 PDF/Word 试卷文件 | Y |
| POST | `/banks/{id}/exam-papers/ai-generate` | 基于解析内容 AI 生成类似题目 | Y |
| GET | `/exam-papers/{paper_id}/export/pdf` | 导出 PDF（含参考答案页） | Y |
| GET | `/exam-papers/{paper_id}/export/word` | 导出 Word（含参考答案页） | Y |
| POST | `/exam-papers/{paper_id}/start-practice` | 创建练习会话，跳转至练习页 | Y |

### 3.9.2 数据模型

试卷使用单表 `exam_papers` 存储，通过 JSONB 字段存储章节配置和题目引用：

```json
{
  "sections": [
    {
      "name": "一、选择题",
      "question_type": "single_choice",
      "count": 10,
      "score_per_question": 3,
      "question_ids": ["uuid1", "uuid2", ...],
      "difficulty": "basic",
      "domain_ids": ["domain-uuid1"]
    }
  ]
}
```

### 3.9.3 两种创建方式

**手动组卷**：用户配置题型/数量/难度/章节 → 系统调用 `suggest-questions` 按章节均衡推荐题目 → 预览确认 → 保存试卷

**上传组卷**：上传 PDF/Word → 系统解析文本 → 调用 AI 生成类似题目 → 预览确认 → 保存试卷（题目不入题库，仅存在于试卷中）

### 3.9.4 考试模式

从试卷开始的练习自动设置为：
- `answer_mode = "after"`（测后看答案）
- 时间限制从试卷设置中读取
- 练习完成后可查看详细结果

### 3.9.5 导出格式

- **PDF**：使用 fpdf2 生成，包含试卷标题、信息行、分节题目、参考答案页，支持中文
- **Word**：使用 python-docx 生成，同等结构

### 3.10 **[新增] 数据结构代码练习与服务端 OJ**

#### 3.10.1 题目范围与版权边界

- 代码练习题库固定为 21 题，覆盖数组、单链表、栈、队列、哈希表、二叉树遍历和图 7 个知识点。
- 每个知识点最多 3 题，难度严格为简单、中等、困难各 1 题，避免同一知识点和难度重复堆题。
- 记录公开编程网站的来源名称、题号、标题和原题链接；项目内题面、学习目标、提示、代码模板和测试用例采用独立适配内容，不保存站点完整题面或官方题解。

#### 3.10.2 用户业务流程

```text
选知识点与难度
  → 阅读目标/任务步骤/输入输出/样例/约束/边界
  → 按需展开三级提示
  → 在 TODO 模板中编写代码并自动保存草稿
  → 运行公开测试并查看实际输出、期望输出和真实轨迹
  → 提交隐藏测试
  → 服务端判题并持久化提交记录
  → 提交后按需查看参考解法
```

#### 3.10.3 API 与数据安全

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/coding/tree?source=oj_curated` | 返回按章节、知识点和三难度组织的目录，每知识点最多 3 题 | Y |
| GET | `/coding/problems/{problem_id}` | 返回结构化题面、代码模板和公开样例，不返回隐藏测试或标准答案 | Y |
| POST | `/coding/problems/{problem_id}/run` | 在隔离运行器中执行公开测试，可返回由真实执行产生的轨迹 | Y |
| POST | `/coding/problems/{problem_id}/submit` | 执行全部公开与隐藏测试，由服务端计算结果并写入答题记录 | Y |
| GET | `/coding/problems/{problem_id}/submissions` | 分页读取当前用户的提交记录 | Y |
| GET | `/coding/problems/{problem_id}/solution` | 至少提交一次后返回参考解法 | Y |

隐藏测试输入、期望输出和参考答案不得出现在题目详情或提交响应中。客户端上报的“是否正确”不作为判题依据，历史自报结果接口应停用。

#### 3.10.4 隔离执行要求

- 用户代码由独立 `code-runner` 容器执行，后端通过 Unix Socket 调用，运行器不加入任何 Docker 网络。
- 容器使用只读根文件系统、临时工作目录、最小 Linux capabilities，并限制 CPU、内存、进程数、文件和输出大小。
- 运行超时、编译/运行错误和判题失败均返回明确中文状态；运行器不可访问后端源码、数据库凭据或外部网络。
- Docker 启动后，后端先幂等应用 OJ 所需版本化迁移，再执行种子数据同步，兼容已有数据卷升级。

***

## 4. 多智能体协同出题流程（无变化）

***

## 5. 前端交互细节

### 5.1 ~ 5.4 保留原有题库管理、练习界面、错题本等交互

### 5.5 **[新增] AI Chat 联动交互**

#### 5.5.1 对话内题目生成卡片
- 当 AI Chat 后端在回复中检测到用户的出题意图并自动生成题目后，会向前端推送一个特殊事件 `quiz:chat_generated`。
- 前端消息列表中出现一张“📝 已生成题目”卡片，显示题目数量、知识点、难度分布。
- 点击卡片可：
  - 展开预览部分题目
  - 一键跳转至题库详情页
  - 或加入指定题库
- 用户亦可手动选中 AI 回复中的文本，点击浮动工具栏“根据此内容生成题目”，调用 `/generate/from-chat`。

#### 5.5.2 实时画像标识
- 在 AI Chat 界面的侧边栏或顶部状态栏，动态展示从对话中识别的最新薄弱知识点标签（红色小徽章）。
- 点击标签可直接跳转至错题本或针对性练习。

### 5.6 **[新增] 题目即席答疑浮窗**

- 题目详情页或练习界面，每道题目的右侧/底部出现“🤖 AI 答疑”按钮。
- 点击后展开一个**浮动聊天窗口**（类似客服小浮窗），包含文本框和消息列表。
- 窗口打开时自动发送题目上下文给后端，学生可连续提问。
- 窗口内所有消息存储于前端本地内存，关闭窗口或切换到下一题后完全清空。
- 浮窗顶部标明“临时答疑 · 对话不保存”。

### 5.7 知识点树浏览（保持不变，掌握度颜色需联动画像实时更新）

### 5.8 **[新增] 数据结构代码练习界面**

- 目录页按知识点展示简单、中等、困难三档题目及完成状态，不自动进入第一题。
- 做题页采用题面/代码分栏；题面提供结构化说明和递进提示，代码区提供草稿自动保存、还原模板、运行、提交及快捷键。
- 公开测试逐项展示输入、期望与实际输出；隐藏测试只展示序号和通过状态，不泄露数据。
- 运行轨迹只来自本次真实代码执行，代码改变后旧轨迹立即失效，不使用定时器或模拟业务数据伪造过程。
- 桌面端和移动端均需保证题面、编辑器、测试结果与提交按钮可达。

***

## 6. 事件与信号规范

在原有事件基础上新增：

| 事件名                            | 触发时机           | 载荷关键字段                                         |
| ------------------------------ | -------------- | ---------------------------------------------- |
| `profile:incremental_update`   | 对话分析完成后        | `user_id, knowledge_points, weak_hints`        |
| `quiz:chat_generated`          | 对话生成题目成功       | `chat_id, question_ids, bank_id`               |
| `quiz:chat_generate_failed`    | 对话生成题目失败       | `chat_id, reason`                              |
| `quiz:ask:started`             | 题目答疑开始         | `question_id, user_id`                         |
| `quiz:ask:message`             | 答疑对话中每条消息      | `question_id, role, content_length`            |
| `profile:ask_about`            | 用户在答疑中追问某知识点   | `user_id, knowledge_point, intensity`          |

原有事件全部保留，`quiz:answer:submitted` 等继续用于画像更新，但新增的 `profile:incremental_update` 提供更实时的对话反馈路径。

***

## 7. 权限与安全（无变化）

***

## 8. 降级策略

| 场景 | 降级方案 |
|------|---------|
| **画像实时分析失败** | 本次分析事件记入 MongoDB 待重放，不影响主对话流；前端不展示最新薄弱点标签 |
| **对话生成题目中断** | 返回明确错误提示，建议稍后重试或手动添加题目 |
| **题目答疑不可用** | 答疑按钮置灰并提示“AI 助手暂不可用”，不影响正常刷题 |
| **Redis 不可用（答疑缓存）** | 答疑接口仍正常，只依赖前端传入的 history 继续，不保存服务端状态 |

***

## 9. 数据库迁移规划

在 v3.0 迁移基础上新增：

| 文件 | 内容 |
|------|------|
| `016_add_chat_events.sql` | (可选) 如果 MongoDB 未使用，可在 PostgreSQL 中新建事件队列表，用于异步画像分析任务 |
| `neo4j/init_chat_relations.cypher` | 包含 `[:ASKED_ABOUT]` 关系的初始化示例 |
| `007_create_exam_papers.sql` | 创建试卷表 exam_papers（含 JSONB config、索引） |

***

## 10. 开发任务与工时（预估）

在原 v3.0 工时基础上追加：

| 阶段 | 任务 | 工时 |
|------|------|------|
| 11 | 画像实时分析 Agent 与 API 开发 | 12h |
| 12 | 对话题目生成卡片及 `/generate/from-chat` 实现 | 8h |
| 13 | 题目即席答疑接口与前端浮窗 | 10h |
| 14 | 前端 AI Chat 联动组件与画像标签展示 | 8h |
| 15 | 联调测试与降级处理 | 8h |
| **16** | **章节/知识点管理** | **4h** |
| **17** | **试卷系统模型与迁移** | **2h** |
| **18** | **试卷生成与推荐服务** | **4h** |
| **19** | **试卷导出（PDF/Word）** | **4h** |
| **20** | **试卷 API 端点** | **4h** |
| **21** | **前端试卷页面** | **8h** |

***

**请 AI Agent 严格依据本 PRD 文档进行开发，确保所有数据模型、API 契约、Neo4j 图模式和前端交互细节均被实现，并与现有 Education Agent 生态系统完全兼容。**  
新版改动将显著提升“对话—练习—画像”闭环的实时性与流畅度，真正实现智能学习体系统的动态进化。
