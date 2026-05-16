# 题库与智能练习系统 PRD（v3.0）

> **版本**：v3.0  
> **日期**：2026-05-12  
> **关联项目**：Education Agent - 个性化学习资源生成与学习多智能体系统  
> **对应赛题**：A3-基于大模型的个性化资源生成与学习多智能体系统开发  
> **目标模块**：多学科题库生成、练习、错题推荐与知识图谱联动子系统  

---

## 1. 模块概述与设计原则

### 1.1 模块定位
题库系统是“多智能体协同资源生成”的核心练习组件。它围绕**学科 → 知识领域 → 具体知识点**的多层结构，对学生提供个性化出题、自适应练习与基于 Neo4j 知识图谱的错题推荐。系统与动态画像、学习路径模块深度联动，使学生能够自主创建、管理个人题库，并在练习中获得精准的薄弱点攻克方案。

### 1.2 核心功能清单

| 编号 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| F1 | 多学科管理 | P0 | 学科下分“知识领域”（大类）及“具体知识点”，层级存储于 Neo4j |
| F2 | 个人题库自主管理 | P0 | 学生创建/编辑/删除自己的题库；题库绑定学科，归属用户，无需管理员权限 |
| F3 | 多题型生成 | P0 | 单选、多选、填空、判断、简答、编程、论述 |
| F4 | 动态难度分级 | P0 | 五级难度：入门/基础/进阶/挑战/竞赛，AI 根据画像自动适配 |
| F5 | 智能标签体系 | P0 | 学科级标签（如“408”）、知识点标签（如“高频考点”）、动态易错标签（错多自动打标），存储于 Neo4j |
| F6 | 知识图谱关联 | P0 | 题目通过 Neo4j 节点关联到知识点；图谱包含层级（HAS_SUB）、前置依赖（PREREQUISITE）、相关关系（RELATED_TO） |
| F7 | 错题智能推荐 | P0 | 基于 Neo4j 路径遍历，定位未掌握前置知识及易混淆点，推荐针对性练习 |
| F8 | 智能练习与进度可视化 | P0 | 题库内显示题目总数/已做/未做/重点题数；练习时可优先展示未做题、重点题，并伴随颜色提示 |
| F9 | 练习记录与信号 | P1 | 记录每次答题，触发标准事件，联动画像更新 |
| F10 | 题目质量审核 | P1 | AI 自动审核 + 人工标记 |
| F11 | 批量导入导出 | P2 | JSON/Markdown 格式，保留标签与知识点关联 |

### 1.3 设计原则
- **学科结构化**：学科 → 知识领域 → 知识点，三级结构清晰，图存储于 Neo4j
- **标签驱动发现**：通过多维标签实现灵活分类，借助 Neo4j 图查询实现易错点自动发现与标记
- **图谱化推荐**：利用 Neo4j 路径查询实现“错题→缺失前置知识→相关薄弱点”的精准推荐，回退方案为 PostgreSQL 标签匹配
- **存储兼容**：主数据使用现有 PostgreSQL（含 JSONB）；图关系使用现有 Neo4j；练习行为日志可使用现有 MongoDB；缓存复用 Redis
- **自主权限**：题库、题目由创建者完全控制，删除操作仅需本人认证，管理员无直接删除权限

---

## 2. 数据模型与存储设计

### 2.1 存储分工

| 存储 | 内容 | 说明 |
|------|------|------|
| PostgreSQL | 学科元数据、题库、题目（JSONB）、练习记录、错题记录 | 结构化查询与事务 |
| Neo4j | 知识点层级、前置/相关关系、标签节点、题目节点（轻量引用）、用户薄弱关系 | 图遍历与推荐 |
| MongoDB (可选) | 详细答题行为日志 | 与现有行为事件系统统一 |
| Redis | 练习会话缓存、热门题目缓存 | 提升响应速度 |

### 2.2 PostgreSQL 表结构

#### 2.2.1 学科表 `subjects`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| name | VARCHAR(200) | NOT NULL, UNIQUE | 学科名称，如“计算机组成原理” |
| description | TEXT | | 简介 |
| cover_image | VARCHAR(500) | | 封面图（可选） |
| creator_id | UUID | FK(users) | 创建者 |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | | |

#### 2.2.2 题库表 `question_banks`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| name | VARCHAR(200) | NOT NULL | 题库名称 |
| subject_id | UUID | FK(subjects) NOT NULL | 所属学科 |
| owner_id | UUID | FK(users) NOT NULL | 创建者（学生本人） |
| visibility | ENUM('private','shared','public') | DEFAULT 'private' | |
| description | TEXT | | 题库说明 |
| total_questions | INTEGER | DEFAULT 0 | 题目总数（冗余计数，触发器或应用层更新） |
| created_at | TIMESTAMP | | |
| updated_at | TIMESTAMP | | |

#### 2.2.3 题目表 `questions`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | |
| bank_id | UUID | FK(question_banks) ON DELETE CASCADE | 所属题库 |
| type | ENUM('single_choice','multiple_choice','fill_blank','true_false','short_answer','programming','essay') | NOT NULL | |
| difficulty | ENUM('beginner','basic','intermediate','advanced','competition') | NOT NULL | |
| status | ENUM('draft','reviewed','published','archived') | DEFAULT 'draft' | |
| priority | INTEGER | DEFAULT 0 | 优先级，数值越大越重要（用于排序展示） |
| content | JSONB | NOT NULL | 结构化题干 |
| answer | JSONB | NOT NULL | 答案及解析 |
| knowledge_point_uuids | JSONB | NOT NULL | 关联的 Neo4j 知识点 uuid 列表，至少一个 |
| tags | JSONB | DEFAULT '[]' | 冗余存储部分关键标签，便于 PostgreSQL 侧筛选 |
| created_by | UUID | FK(users) | |
| created_at | TIMESTAMP | | |
| updated_at | TIMESTAMP | | |

**content JSONB 示例**：
```json
{
  "stem": "在下列 Cache 映射方式中，哪种方式冲突率最低？",
  "options": [
    {"key": "A", "text": "直接映射"},
    {"key": "B", "text": "全相联映射"},
    {"key": "C", "text": "组相联映射"},
    {"key": "D", "text": "段相联映射"}
  ],
  "images": [],
  "code_blocks": []
}
```

**answer JSONB 示例**：
```json
{
  "correct_answer": ["B"],
  "explanation": "全相联映射允许任意块放入任意位置，冲突率最低。",
  "difficulty_rationale": "基本概念对比，难度为基础",
  "suggested_time_seconds": 60
}
```

**tags 字段**（冗余）：
```json
["408", "高频考点"]
```

#### 2.2.4 练习记录表 `practice_records`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | |
| user_id | UUID | |
| question_id | UUID | |
| session_id | UUID | 练习会话ID |
| user_answer | JSONB | |
| is_correct | BOOLEAN | |
| time_spent_ms | INTEGER | |
| attempt_number | INTEGER | 该题在当前会话中的第几次尝试 |
| created_at | TIMESTAMP | |

#### 2.2.5 错题记录表 `error_collections`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | |
| user_id | UUID | |
| question_id | UUID | |
| knowledge_point_uuids | JSONB | 冗余，便于统计 |
| error_type | ENUM('concept','calculation','careless','timeout','unknown') | |
| error_count | INTEGER | 累计错误次数 |
| last_error_at | TIMESTAMP | |
| resolved | BOOLEAN | 是否已通过后续练习解决 |
| created_at | TIMESTAMP | |

#### 2.2.6 练习会话表 `practice_sessions`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | |
| user_id | UUID | |
| bank_id | UUID | 来源题库 |
| mode | ENUM('random','sequential','adaptive','weak_point') | |
| status | ENUM('active','paused','completed') | |
| question_order | JSONB | 题目ID序列 |
| current_index | INTEGER | 当前答题位置（0-based） |
| stats | JSONB | 实时统计 {total, completed, correct, incorrect} |
| started_at | TIMESTAMP | |
| finished_at | TIMESTAMP | |

### 2.3 Neo4j 图模型

#### 2.3.1 节点标签与属性

| 节点类型 | 属性 | 说明 |
|----------|------|------|
| `:Subject` | `{ uuid, name }` | 对应 PostgreSQL 学科 |
| `:KnowledgeDomain` | `{ uuid, name }` | 知识领域（大类），如“存储系统” |
| `:KnowledgePoint` | `{ uuid, name, description }` | 具体知识点，如“Cache映射方式” |
| `:Question` | `{ uuid }` | 题目轻量引用 |
| `:Tag` | `{ uuid, name, type }` | type: `subject_tag` / `knowledge_tag` / `error_tag` |
| `:User` | `{ uuid }` | 用户节点（可复用现有用户图） |

#### 2.3.2 关系类型

| 关系 | 方向 | 说明 |
|------|------|------|
| `[:BELONGS_TO]` | `(KnowledgeDomain)->(Subject)` | 领域归属学科 |
| `[:HAS_SUB]` | `(KnowledgeDomain)->(KnowledgePoint)` | 领域包含知识点 |
| `[:PREREQUISITE]` | `(KnowledgePoint)->(KnowledgePoint)` | 前置依赖 |
| `[:RELATED_TO]` | `(KnowledgePoint)->(KnowledgePoint)` | 相关/易混淆 |
| `[:TAGGED]` | `(Subject|Domain|Point|Question)->(Tag)` | 打标签 |
| `[:TESTS]` | `(Question)->(KnowledgePoint)` | 题目考查的知识点 |
| `[:ANSWERED_WRONG]` | `(User)->(Question)` | 用户答错，可带属性 `count` |
| `[:STRUGGLES_WITH]` | `(User)->(KnowledgePoint)` | 汇总薄弱点，属性 `error_count` |

#### 2.3.3 知识图谱初始化示例

```cypher
// 学科
CREATE (s:Subject {uuid: 'subj-1', name: '计算机组成原理'})
// 标签
CREATE (t408:Tag {uuid: 'tag-408', name: '408', type: 'subject_tag'})
CREATE (s)-[:TAGGED]->(t408)

// 领域与知识点
CREATE (d1:KnowledgeDomain {uuid: 'dom-1', name: '存储系统'})-[:BELONGS_TO]->(s)
CREATE (kp1:KnowledgePoint {uuid: 'kp-1', name: 'Cache映射方式', description: '...'})
CREATE (kp2:KnowledgePoint {uuid: 'kp-2', name: 'Cache替换算法', description: '...'})
CREATE (d1)-[:HAS_SUB]->(kp1)
CREATE (d1)-[:HAS_SUB]->(kp2)
CREATE (kp1)-[:PREREQUISITE]->(kp2)

// 知识点标签
CREATE (tHigh:Tag {uuid: 'tag-high', name: '高频考点', type: 'knowledge_tag'})
CREATE (kp1)-[:TAGGED]->(tHigh)
```

---

## 3. API 接口规范

所有接口遵循现有约定：前缀 `/api/v1`，JWT 认证，统一错误响应格式。

### 3.1 学科与知识结构 (`/api/v1/subjects`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 创建学科 | 需要 |
| GET | `/` | 学科列表 | 需要 |
| GET | `/{id}` | 学科详情（含领域与知识点树，从 Neo4j 查询） | 需要 |
| PUT | `/{id}` | 更新学科 | 创建者 |
| DELETE | `/{id}` | 删除学科（无题库关联时允许） | 创建者 |
| GET | `/{id}/domains` | 获取知识领域列表 | 需要 |
| POST | `/{id}/domains` | 创建知识领域 | 需要 |
| GET | `/domains/{domain_id}/points` | 获取知识点列表 | 需要 |
| POST | `/domains/{domain_id}/points` | 创建知识点（并更新 Neo4j） | 需要 |

### 3.2 题库管理 (`/api/v1/question-banks`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 创建题库（指定学科） | 需要 |
| GET | `/` | 获取我的题库（支持按学科、名称筛选） | 需要 |
| GET | `/{id}` | 题库详情（含题目总数、已完成数、未做题数等统计） | 需要 |
| PUT | `/{id}` | 修改名称、描述等 | **所有者** |
| DELETE | `/{id}` | 删除题库（级联删除题目） | **所有者** |
| GET | `/{id}/stats` | 获取练习进度统计 | **所有者** |

**`GET /{id}` 响应示例**：
```json
{
  "id": "uuid",
  "name": "计组第三章练习",
  "subject": { "id": "subj-1", "name": "计算机组成原理" },
  "total_questions": 50,
  "completed_questions": 30,
  "correct_questions": 25,
  "important_questions": 10,
  "last_practiced_at": "2026-05-10T10:00:00Z",
  "tags": ["408", "存储系统"]
}
```

### 3.3 题目 CRUD (`/api/v1/questions`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 手动创建题目（需指定题库及知识点uuids） | 需要 |
| GET | `/` | 题目列表（支持 ?bank_id, ?knowledge_point_uuid, ?difficulty, ?tag, ?status, ?priority 等筛选） | 需要 |
| GET | `/{id}` | 题目详情（含答案解析） | **题库所有者/管理员** |
| PUT | `/{id}` | 更新题目 | **所有者** |
| DELETE | `/{id}` | 删除题目 | **所有者** |
| GET | `/{id}/practice-history` | 该题的个人练习历史 | 所有者 |

**筛选补充**：`?sort_by=priority&order=desc` 用于按重要性排序。

### 3.4 AI 多智能体出题 (`/api/v1/questions/generate`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/generate` | 启动多智能体生成任务 | 需要 |
| GET | `/generate/{request_id}/status` | 查询生成进度 | 需要 |
| GET | `/generate/{request_id}/result` | 获取生成结果（题目列表） | 需要 |

**请求体**：
```json
{
  "bank_id": "UUID",
  "knowledge_point_uuids": ["kp-uuid-1"],
  "include_related_kp": true,
  "question_types": ["single_choice", "fill_blank"],
  "difficulty_distribution": {
    "beginner": 0.1, "basic": 0.3, "intermediate": 0.4,
    "advanced": 0.15, "competition": 0.05
  },
  "count": 10,
  "use_user_profile": true
}
```
生成过程异步，完成后题目自动入库并建立 Neo4j 题目节点。

### 3.5 练习与答题

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/practice/sessions` | 创建练习会话（指定题库、模式、过滤条件） | 需要 |
| GET | `/practice/sessions/{id}` | 获取会话详情与剩余题目序列 | 需要 |
| POST | `/practice/sessions/{id}/answer` | 提交单题答案（自动同步 Neo4j 薄弱关系） | 需要 |
| PUT | `/practice/sessions/{id}/pause` | 暂停会话 | 需要 |
| PUT | `/practice/sessions/{id}/resume` | 恢复会话 | 需要 |
| GET | `/practice/sessions/{id}/results` | 获取会话统计结果 | 需要 |
| GET | `/practice/errors` | 个人错题本，支持按学科/知识点/标签筛选 | 需要 |
| GET | `/practice/stats` | 练习统计（按学科/知识点聚合正确率） | 需要 |

**创建会话请求**：
```json
{
  "bank_id": "UUID",
  "mode": "adaptive",
  "question_filter": {
    "difficulty": ["basic","intermediate"],
    "knowledge_point_uuids": ["..."],
    "only_unanswered": true,
    "priority_first": true,
    "max_questions": 20
  }
}
```
- `only_unanswered`：仅包含该用户在此题库未做过的题
- `priority_first`：若为 true，则按优先级降序排列题目，确保重点题先出现
- `adaptive` 模式则基于画像和错题薄弱点动态调整后续题目。

### 3.6 错题推荐 (`/api/v1/recommend/correction`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/recommend/correction` | 获取图谱推荐题目 | 需要 |
| POST | `/recommend/correction/practice` | 基于推荐结果一键生成练习会话 | 需要 |

**查询参数**：`?subject_id=...&max_count=5`

**Neo4j 推荐逻辑**（具体 Cypher 参考）：
1. 找出用户累计错误>=2次的知识点列表 WEAK_KP  
2. 对每个薄弱知识点，探索：  
   - 其前置知识点（PREREQUISITE），且用户对该前置知识点的掌握度低（画像或错误记录判断）  
   - 与其相关（RELATED_TO）且用户同样薄弱的知识点  
3. 收集这些“连带薄弱知识点” REC_KP  
4. 从题库中选出测试 REC_KP 的题目，且用户未答对过，按推荐分数排序返回。

**返回体**：
```json
{
  "recommendations": [
    {
      "question_id": "q-uuid",
      "question_stem": "...",
      "reason": "弥补前置知识「Cache基本概念」",
      "priority_score": 0.95,
      "tags": ["易错点"],
      "difficulty": "basic"
    }
  ]
}
```

---

## 4. 多智能体协同出题流程

沿用已有的多智能体框架，各 Agent 配置与职责如下：

| Agent角色 | 职责 | LLM配置 |
|-----------|------|---------|
| 出题规划Agent | 分析用户画像 + Neo4j 知识点图谱，制定出题策略和分布 | DeepSeek-chat，temperature=0.3 |
| 题目生成Agent | 批量生成题目内容、选项、答案、解析 | DeepSeek-chat，temperature=0.7 |
| 质量审核Agent | 检查正确性、难度、知识点关联清晰度 | DeepSeek-chat，temperature=0.2 |
| 格式编排Agent | 转为标准 JSON Schema，写入 PostgreSQL 并同步 Neo4j | 规则引擎 |

协同流程与赛题描述一致，最终触发 `quiz:generate:completed` 事件。

---

## 5. 前端交互细节

以下描述题库及练习模块在 React 前端中的关键细节。

### 5.1 题库列表页 `/banks`
- 按学科分组显示卡片。
- 每个卡片显示：题库名称、题数（已完成/总数）、进度条、最近练习时间。
- 重要题库（包含大量错题或高优先级题目）可显示警示图标（红色角标）。
- 提供“新建题库”按钮，弹出选择学科、输入名称的对话框。

### 5.2 题库详情页 `/banks/:id`
- 顶部统计栏：`总题数 50 | 已做 30 | 未做 20 | 重点题 10`。
- 题目列表，每行显示：
  - 题目类型图标、难度标签（颜色区分）、题干摘要
  - 状态指示：✅ 已答对 / ❌ 答错 / ⬜ 未做（灰色）
  - 重点题目标题前有红色感叹号，背景浅红。
- 支持筛选：按知识点、题型、难度、状态（未做/已做/错题）。
- 排序选项：默认 **重要题目优先**（优先值高的在前，且未做题比已做题更前）。
- 操作按钮：**“开始练习”**（弹出模式选择）、**“AI生成题目”**、**“手动添加题目”**。

### 5.3 练习界面 `/practice/:sessionId`
- 显示当前进度：`第 3/20 题`。
- 题目展示区域：题干、选项（可点击选择）、图片或代码高亮。
- 颜色提示系统：
  - 普通题：白色背景
  - 重点题：左侧红色竖条，提示“重点题，请认真作答”
  - 来自错题推荐的题目：黄色边框，提示“补漏推荐”
- 提交答案后立即反馈正误，并显示正确答案与解析。
- 下一题按钮，或自动跳转（可配置）。
- 侧边栏或顶部迷你进度条显示正确/错误/未答的小圆点。
- 完成练习后展示结果页：正确率、各知识点正确率、薄弱点标签、建议推荐练习入口。

### 5.4 错题本与智能推荐页
- `/practice/errors`：列表聚合，可按知识点/标签筛选，点击可重练该错题或该知识点。
- 错题卡片上显示错误次数、最后错误时间，并有“去复习”按钮跳转到该知识点教材或视频（若已生成）。
- `/recommend/fix`：展示图谱推荐卡片，每个卡片包含**推荐理由**、题目摘要、优先级，可一键加入新练习。

### 5.5 知识点树浏览
- 可在 `/subjects/:id` 页面以树形控件展示 **领域 → 知识点** 层级。
- 知识点节点上显示个人掌握度（通过画像数据映射为颜色：绿/黄/红）。
- 点击知识点可查看相关题目或开始针对性练习。

---

## 6. 事件与信号规范

沿用现有 `app/core/events.py` 事件总线，新增以下事件：

| 事件名 | 触发时机 | 载荷关键字段 |
|--------|----------|--------------|
| `quiz:bank:created` | 创建题库 | `bank_id, subject_id` |
| `quiz:question:added` | 手动或自动新增题目 | `question_id, bank_id, knowledge_point_uuids` |
| `quiz:generate:started` | 出题任务开始 | `request_id, bank_id, count` |
| `quiz:generate:progress` | 批量生成进度 | `request_id, generated, total` |
| `quiz:generate:completed` | 出题完成 | `request_id, question_ids` |
| `quiz:session:started` | 开始练习会话 | `session_id, bank_id, mode` |
| `quiz:answer:submitted` | 每题提交 | `session_id, question_id, is_correct, knowledge_point_uuids, time_spent` |
| `quiz:session:completed` | 会话结束 | `session_id, stats` |
| `quiz:error:updated` | 错题记录更新 | `user_id, question_id, error_count` |
| `quiz:tag:auto_assigned` | 自动打易错标签 | `tag_name, user_id, question_id, reason` |
| `quiz:recommend:generated` | 图谱推荐计算完成 | `user_id, recommended_count` |

这些事件供画像系统、学习路径模块订阅，实现数据联动。

---

## 7. 权限与安全

- **题库及题目**：仅创建者（owner_id）可以进行修改和删除操作。删除时后端验证 `owner_id == current_user.id`。
- 管理员**不**具备直接删除学生个人题库的接口权限，但可访问数据统计（如总题目数、活跃度）用于运维监控。若需清理数据，须通过后台脚本并记录审计日志。
- AI 出题接口强制要求登录，且生成的题目自动归属请求者的指定题库。
- 所有接口均使用 JWT 认证，敏感操作记录审计日志（已存在 admin_audit_log 表）。

---

## 8. 降级策略

| 场景 | 降级方案 |
|------|----------|
| Neo4j 不可用 | 错题推荐回退为基于 PostgreSQL 的标签 + 知识点名称模糊匹配的简单推荐；知识树API返回仅包含学科基本信息。 |
| AI 生成失败 | 返回友好提示，建议手动添加题目或从公共题库中复制题目（后续功能）。 |
| MongoDB 不可用 | 不影响核心功能；仅行为日志暂停收集，待恢复后补录。 |
| 高并发练习 | Redis 缓存题库统计与热点题目，PostgreSQL 读写分离（如有必要）。 |

---

## 9. 数据库迁移规划

在现有 `migrations/` 目录下依次添加：

| 文件 | 内容 |
|------|------|
| `010_create_subjects.sql` | 创建 subjects 表 |
| `011_create_question_banks.sql` | 创建 question_banks，含 owner_id 外键 |
| `012_create_questions.sql` | 创建 questions，含 JSONB 及 knowledge_point_uuids |
| `013_create_practice_records.sql` | 创建 practice_records |
| `014_create_error_collections.sql` | 创建 error_collections |
| `015_create_practice_sessions.sql` | 创建 practice_sessions |

Neo4j 初始化脚本：`neo4j/init_knowledge_graph.cypher`，包含学科、领域、知识点样例及标签关系。

---

## 10. 开发任务与工时（预估）

| 阶段 | 任务 | 工时 |
|------|------|------|
| 1 | PostgreSQL 迁移与模型定义 | 8h |
| 2 | 学科、领域、知识点的 CRUD API + Neo4j 同步 | 12h |
| 3 | 题库与题目 CRUD API（含权限、统计） | 10h |
| 4 | Neo4j 知识图谱初始化脚本与标签体系导入 | 10h |
| 5 | AI 多智能体出题流程（规划→生成→审核→入库） | 14h |
| 6 | 练习会话、答题、错题记录与事件集成 | 12h |
| 7 | 错题推荐图谱查询逻辑与推荐 API | 10h |
| 8 | 前端题库管理、练习界面、进度可视化 | 24h |
| 9 | 画像联动与信号消费 | 8h |
| 10 | 测试、降级处理与文档 | 10h |

---

**请 AI Agent 严格依据本 PRD 文档进行开发，确保所有数据模型、API 契约、Neo4j 图模式和前端交互细节均被实现，并与现有 Education Agent 生态系统完全兼容。**