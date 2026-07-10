# 个性化学习路径系统 PRD（统一版）

> **版本**：v4.0（业务流程整合版）
> **日期**：2026-06-14
> **关联赛题**：A3-基于大模型的个性化资源生成与学习多智能体系统开发
> **合并自**：prd-7, prd-8, prd-9, prd-12（旧版已废弃）
> **核心变更**：补全"知识图谱构建 → AI路径生成 → 路径确认持久化 → 路径执行"完整业务闭环

---

## 0. 完整业务流程（端到端）

### 0.1 流程总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                   学习路径生成 — 完整业务闭环                           │
│                                                                      │
│  阶段0: 知识准备                                                      │
│  ├─ 方式A: PDF上传 → AI抽取 → 构建知识图谱（KnowledgeGraphPage）       │
│  ├─ 方式B: 管理员预置知识点（已有）                                    │
│  └─ 方式C: 手动添加知识点（题库管理）                                   │
│       │                                                              │
│       ▼                                                              │
│  阶段1: 进入路径规划                                                   │
│  ├─ 入口A: 知识图谱页 → "生成学习路径" → 携带 subject_id 跳转           │
│  ├─ 入口B: 首页 → "学习路径" → 自主选择学科                             │
│  └─ 入口C: 导航栏 → 学习路径规划                                       │
│       │                                                              │
│       ▼                                                              │
│  阶段2: 目标设置（CreateScreen）                                       │
│  ├─ 选择学科（自动填入入口A传入的学科）                                  │
│  ├─ 设定目标类型（学期提升/升学备考/考级考证）                            │
│  ├─ 设定目标分数/等级                                                  │
│  └─ 设定截止日期                                                      │
│       │                                                              │
│       ▼                                                              │
│  阶段3: 能力检查（点击"生成学习路径"）                                   │
│  ├─ GET /path/check-api → 检查 LLM 配置 + 认知数据                      │
│  ├─ has_llm=false → 显示引导：请先配置 AI 服务                           │
│  ├─ has_llm=true, has_cognitive_data=false → 弹出风格评估弹窗            │
│  └─ has_llm=true, has_cognitive_data=true → 直接生成                    │
│       │                                                              │
│       ▼                                                              │
│  阶段4: 风格评估（冷启动用户）★已实现                                    │
│  ├─ 3题弹窗（Q1:学习偏好→认知风格, Q2:复习方式, Q3:活跃时段）              │
│  ├─ POST /path/style-assessment → Neo4j + MongoDB                     │
│  └─ 自动继续 → 进入阶段5                                               │
│       │                                                              │
│       ▼                                                              │
│  阶段5: AI 路径生成 ★已实现                                            │
│  ├─ POST /path/generate → GenerationProgress 四步动画                  │
│  ├─ 后端: ProfileAggregator → PathPlanningEngine(Neo4j+LLM)            │
│  ├─ 返回: PersonalizedPath（阶段/策略/每日建议/知识点排序）               │
│  └─ 前端: 路径预览（阶段卡片 + 策略说明 + 每日建议）                      │
│       │                                                              │
│       ▼                                                              │
│  阶段6: 确认路径 ★★★ 核心缺失 — 待实现 ★★★                             │
│  ├─ 用户审核预览内容 → 点击"确认路径并开始学习"                           │
│  ├─ POST /path/confirm ← 将 AI 路径持久化到状态机                       │
│  ├─ 后端: 写入 LearningPathState（含 AI 生成的阶段/策略/node_order）     │
│  └─ 前端: 跳转到路径总览页（OverviewScreen）                             │
│       │                                                              │
│       ▼                                                              │
│  阶段7: 路径执行 ★已实现                                               │
│  ├─ GET /path/state → 按 AI 生成的 node_order 展示                      │
│  ├─ 知识点卡片：标记已学习 / 去做题 / AI 讲解                            │
│  ├─ POST /path/progress → 推进节点 → 自动流转阶段                       │
│  └─ 阶段自动流转: diagnosis → learning → practice → review → completed  │
│       │                                                              │
│       ▼                                                              │
│  阶段8: 学习看板 ★已实现                                               │
│  ├─ 周统计 / 趋势图 / 薄弱点分析                                        │
│  ├─ 阶段复盘                                                          │
│  └─ 重规划（基于新数据重新生成路径）                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 0.2 当前流程断点分析

以下是从代码层面识别出的 **5 个断点**，导致完整业务闭环无法走通：

| 断点 | 位置 | 现象 | 严重度 | 状态 |
|------|------|------|--------|------|
| **断点1: AI路径未持久化** | `handleConfirmPath()` → `fetchPath()` | 用户确认路径后，AI 生成的阶段/策略/排序被丢弃，前端重新从 `GET /path/current` 加载 sort_order 排序的数据 | 🔴 致命 | ✅ 已修复 |
| **断点2: 缺乏确认端点** | 后端 `path.py` | 没有 `POST /path/confirm`，AI 路径只能在前端预览，无法写入 `LearningPathState` | 🔴 致命 | ✅ 已修复 |
| **断点3: 状态机未存AI元数据** | `LearningPathState` 模型 | 缺少 `path_name`, `phases`, `strategy_notes`, `daily_suggestion`, `generation_reason` 字段 | 🟡 重要 | ✅ 已修复 |
| **断点4: KG→Path 无上下文传递** | `KnowledgeGraphPage` → `/path` | 点击"生成学习路径"只做 `navigate('/path')`，不传 subject_id；用户需重新选择学科 | 🟡 重要 | ✅ 已修复 |
| **断点5: GET /path/current 不查状态机** | `path.py:get_current_path` / `handleConfirmPath` | 始终按 `sort_order` 排序，不检查用户是否有 AI 生成的状态机路径 | 🟡 重要 | ✅ 已修复（前端侧） |

### 0.3 断点修复方案

#### 断点1+2：新增 `POST /api/v1/path/confirm` 端点

```
POST /api/v1/path/confirm

Request:
{
  "goal_type": "升学备考",
  "goal_description": "目标分数: 130, 截止日期: 2026-12-14",
  "subject_id": "uuid",
  "generated_path": {
    "path_name": "大语言模型系统化学习路径",
    "description": "基于你的计算机专业背景...",
    "total_days": 90,
    "phases": [
      {"name": "基础入门", "days": 30, "focus": "...", "node_ids": [...], "node_names": [...]},
      ...
    ],
    "daily_suggestion": {...},
    "strategy_notes": [...],
    "generation_reason": "基于 Neo4j 知识图谱拓扑分析 + 大模型个性化规划",
    "nodes": [{"id": "...", "name": "...", ...}, ...]
  }
}

Response:
{
  "state_id": "uuid",
  "message": "个性化学习路径已保存",
  "phase": "learning",
  "total_nodes": 45
}
```

**后端逻辑**：
1. 删除/完成该用户同一 subject 的旧 `LearningPathState`
2. 按 AI 生成的 `nodes` 顺序构建 `node_order`
3. 将 `phases`, `strategy_notes`, `daily_suggestion`, `generation_reason` 存入 `LearningPathState.metadata`（新增 JSONB 字段）
4. 设置第一个未掌握节点为 `current_node`
5. 写入 `PathHistory`

#### 断点3：`LearningPathState` 模型扩展

在 `learning_path_states` 表新增一个 JSONB `metadata` 字段：

```python
# app/models/path_state.py
metadata = Column(JSONB, nullable=False, default=dict)
# 存储: {path_name, phases, strategy_notes, daily_suggestion, generation_reason}
```

#### 断点4：KG→Path 上下文传递

```typescript
// KnowledgeGraphPage.tsx — 修改导航
// Before:
<button onClick={() => navigate('/path')}>🎯 生成学习路径</button>

// After:
<button onClick={() => navigate(`/path?subjectId=${kg.subject_id}`)}>🎯 生成学习路径</button>
```

```typescript
// LearningPathPage.tsx — 接收参数
const [searchParams] = useSearchParams();
const subjectIdFromKg = searchParams.get('subjectId');

useEffect(() => {
  if (subjectIdFromKg) {
    setGoalForm(prev => ({ ...prev, subjectId: subjectIdFromKg }));
  }
}, [subjectIdFromKg]);
```

#### 断点5：`GET /path/current` 优先使用状态机数据

```python
# path.py — get_current_path 修改逻辑
# 1. 先查 LearningPathState（用户是否有 AI 生成的活跃路径）
# 2. 有 → 按 state.node_order 返回节点（使用 AI 排序）
# 3. 无 → 按 sort_order 返回（现有降级逻辑）
```

---

## AI 状态维护表

### 人类可读版

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| LP-01 | 路径执行状态机（LearningPathState 模型 + 5阶段流转） | P0 | ✅ 是 | ✅ 是 | - | diagnosis→learning→practice→review→completed |
| LP-02 | 路径初始化 API（POST /path/init + GET /path/state） | P0 | ✅ 是 | ✅ 是 | - | PathStateManager 已实现 |
| LP-03 | 路径进度更新 API（POST /path/progress + complete/skip） | P0 | ✅ 是 | ✅ 是 | - | 完成节点后自动推进游标 |
| LP-04 | 交互式知识图谱（ReactFlow DAG + 领域分组 + 掌握度着色） | P0 | ✅ 是 | ✅ 是 | - | SubjectLearningPage：领域卡片 + 节点状态徽章 + 快操按钮 |
| LP-05 | 知识点直接练习导航（卡片→题库→练习页） | P0 | ✅ 是 | ✅ 是 | - | 知识点的"练习"按钮→查题库→跳转PracticePage |
| LP-06 | 知识点记录学习（标记/取消标记 + 刷新） | P0 | ✅ 是 | ✅ 是 | - | recordKnowledgeStudy API + 可见性自动刷新 |
| LP-07 | 学习路径看板（周统计 + 趋势图 + 薄弱点 + 阶段计划） | P0 | ✅ 是 | ✅ 是 | - | LearningPathPage DashboardScreen，数据从API真实获取 |
| LP-08 | 首页个人学习中心（欢迎横幅 + 统计卡片 + 今日建议） | P0 | ✅ 是 | ✅ 是 | - | 登录后首页，非登录保留Hero |
| LP-09 | 学习画像仪表盘（雷达图 + 趋势图 + 热力图） | P0 | ✅ 是 | ✅ 是 | - | DynamicProfilePage 三维度雷达图 |
| LP-10 | 智能推荐浮窗（毛玻璃 + 动画 + 8类型标签） | P0 | ✅ 是 | ✅ 是 | - | PracticeRecommendPopup 升级版 |
| LP-11 | 题库与知识点掌握度联动（答题→更新mastery_score） | P0 | ✅ 是 | ✅ 是 | - | KnowledgePointRecord 随答题更新 |
| LP-12 | Neo4j 路径规划算法（拓扑排序 + 加权评分 + 深度布局） | P0 | ✅ 是 | ✅ 是 | - | PathPlanner: Kahn排序 + 动态权重(GOAL_WEIGHT_MAP) |
| LP-13 | 个性化资源推荐 API（薄弱点召回 + 排序 + 分页） | P0 | ✅ 是 | ✅ 是 | - | GET /recommendations/personalized |
| LP-14 | 多选题判题修复 + matplotlib 代码绘图 | P0 | ✅ 是 | ✅ 是 | - | 多选数组比较 + POST /code/plot |
| LP-15 | 前端性能优化（React.memo + 图标统一 + goalType传递） | P0 | ✅ 是 | ✅ 是 | - | 4个视图组件memo化 |
| **LP-16** | **AI 个性化路径生成引擎（LLM + Neo4j 混合）** | **P0** | ✅ 是 | 🔴 否 | - | PathPlanningEngine 已实现：Neo4j拓扑+LLM个性化 |
| **LP-17** | **用户画像聚合器（多源数据→PersonalizationContext）** | **P0** | ✅ 是 | 🔴 否 | - | ProfileAggregator: PostgreSQL+Neo4j+MongoDB |
| **LP-18** | **POST /path/generate API + check-api + style-assessment** | **P0** | ✅ 是 | 🔴 否 | - | 3个新端点已实现，LLM未配置时友好引导 |
| **LP-19** | **学习风格评估弹窗（冷启动3题问卷）** | **P0** | ✅ 是 | 🔴 否 | - | LearningStyleModal: Q1→认知风格, Q2→multimodal, Q3→活跃时段 |
| **LP-20** | **路径生成进度动画（4步进度条+超时+重试）** | **P0** | ✅ 是 | 🔴 否 | - | GenerationProgress 组件 |
| **LP-21** | **路径确认持久化（POST /path/confirm）** | **P0** | ✅ 是 | 🔴 否 | - | PathStateManager.confirm_path() 已实现，ai_metadata 持久化 |
| **LP-22** | **KG→Path 上下文传递（携带subject_id跳转）** | **P0** | ✅ 是 | 🔴 否 | - | KnowledgeGraphPage→/path?subjectId=X，LearningPathPage接收URL参数 |
| **LP-23** | **确认后加载状态机排序（前端侧）** | **P0** | ✅ 是 | 🔴 否 | - | handleConfirmPath 改为从状态机 node_order 加载，保留 AI 排序 |
| **LP-24** | **LearningPathState 扩展 metadata 字段** | **P0** | ✅ 是 | 🔴 否 | - | ai_metadata JSONB 字段：path_name/phases/strategy_notes/daily_suggestion |
| LP-25 | 路径跳过 / 回退功能 | P1 | 🔴 否 | 🔴 否 | - | 用户手动调整节点 |
| LP-26 | 多信号融合推荐引擎（6维加权评分） | P1 | 🔴 否 | 🔴 否 | - | Priority = w×urgency + w×mastery_gap + ... |
| LP-27 | 路径自适应调整（回退/短路/解锁） | P2 | ✅ 是 | ✅ 是 | - | 已实现动态重排、错题回退复习、掌握度短路完成、前置依赖锁定/解锁 |
| LP-28 | 路径历史与版本控制 | P2 | 🔴 否 | 🔴 否 | - | 每次调整写入PathHistory，前端展示演变时间线 |
| LP-29 | LeetBook 风格探索地图与知识点章节页 | P1 | ✅ 是 | ✅ 是 | - | 路径总览改为探索知识地图；点击知识点进入独立章节页 |
| LP-30 | 数据结构参考讲义与知识拔高 | P1 | ✅ 是 | ✅ 是 | - | 阅读讲义按基础讲解、知识拔高、易错辨析、练习导向生成，并标注参考来源 |
| LP-31 | GraphRAG 工作台式知识图谱界面 | P0 | ✅ 是 | ✅ 是 | - | 固定顶栏 + 图库/导入/问答侧栏 + 常驻 D3 图谱画布；支持 PDF/DOCX/PPTX 构建并保留 KG→Path 链路；Playwright 已通过 |

### JSON 版

```json
{
  "ai_status": {
    "LP-01_state_machine": {
      "description": "路径执行状态机（LearningPathState 模型 + 5阶段流转）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "PathStateManager 管理 diagnosis→learning→practice→review→completed 生命周期"
    },
    "LP-02_path_init": {
      "description": "路径初始化 API（POST /path/init + GET /path/state）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "PathStateManager.init_path() 按 sort_order 初始化 node_order"
    },
    "LP-03_path_progress": {
      "description": "路径进度更新 API（POST /path/progress + complete/skip/unskip）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "update_progress() 推进游标到下一个pending节点"
    },
    "LP-04_knowledge_graph": {
      "description": "交互式知识图谱（ReactFlow DAG + 领域分组 + 掌握度着色）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "SubjectLearningPage：领域分组卡片+节点卡片(状态徽章/掌握度条/快操按钮)"
    },
    "LP-05_direct_practice_nav": {
      "description": "知识点直接练习导航（卡片→题库→练习页）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "handlePractice：查practice-bank API→跳转PracticePage配置页→无题降级"
    },
    "LP-06_record_study": {
      "description": "知识点记录学习（标记/取消 + 自动刷新）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "recordKnowledgeStudy API + visibilitychange自动刷新path数据"
    },
    "LP-07_learning_dashboard": {
      "description": "学习路径看板（周统计 + 趋势图 + 薄弱点 + 阶段计划）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "数据从API真实获取，空数据时显示引导，无硬编码假数据"
    },
    "LP-08_homepage": {
      "description": "首页个人学习中心（欢迎横幅 + 统计卡片 + 今日建议 + 连续天数）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "登录后个人中心；未登录保留Hero+功能卡片"
    },
    "LP-09_profile_dashboard": {
      "description": "学习画像仪表盘（雷达图 + 趋势图 + 热力图）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "RadarChart+TrendChart+HeatmapCalendar，数据从profileV2Api获取"
    },
    "LP-10_rec_popup": {
      "description": "智能推荐浮窗（毛玻璃 + 动画 + 8类型标签）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "PracticeRecommendPopup：backdrop-filter+入场/退场动画+120s冷却"
    },
    "LP-11_kp_practice_binding": {
      "description": "题库与知识点掌握度联动（答题→更新mastery_score）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "KnowledgePointRecord在submit_answer后更新；遗忘曲线指数衰减(1.5^(days-2))"
    },
    "LP-12_neo4j_planner": {
      "description": "Neo4j 路径规划算法（拓扑排序 + 加权评分 + 深度布局）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "PathPlanner: Kahn排序+加权评分(w1*掌握度差距+w2*重要度+w3*考频-w4*认知负荷)+GOAL_WEIGHT_MAP动态权重"
    },
    "LP-13_resource_recommend": {
      "description": "个性化资源推荐 API（薄弱点召回 + 排序 + 分页 + 反馈）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "GET /recommendations/personalized + POST feedback + RecommendationFeedback表"
    },
    "LP-14_mcq_plot_fix": {
      "description": "多选题判题修复 + matplotlib 代码绘图",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "多选题数组排序比较；POST /code/plot 返回base64 PNG"
    },
    "LP-15_fe_perf": {
      "description": "前端性能优化（React.memo + 图标统一 + goalType传递）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "4视图组件memo化；SettingsIcon统一管理；fetchPath传递goalType"
    },
    "LP-16_ai_path_generation": {
      "description": "AI 个性化路径生成引擎（LLM + Neo4j 拓扑混合）",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ PathPlanningEngine 已实现：Neo4j拓扑(Kahn层级) + LLM个性化(Prompt含画像+知识点+拓扑约束)。支持 DeepSeek 和 Qwen，含启发式降级。"
    },
    "LP-17_profile_aggregator": {
      "description": "用户画像聚合器（PostgreSQL+Neo4j+MongoDB→PersonalizationContext）",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ ProfileAggregator 已实现：聚合 UserProfile(专业/年级/学校)+CognitiveStyle(Neo4j)+活跃时段(MongoDB)+掌握度(KPRecord)+错题(WrongAnswer)+API配置+练习统计。is_cold_start 判断新用户。"
    },
    "LP-18_path_generate_api": {
      "description": "POST /path/generate + GET /path/check-api + POST /path/style-assessment 三个端点",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ 3个端点已实现：generate(聚合画像→引擎生成→写历史)、check-api(查LLM配置+认知数据)、style-assessment(Q1→认知风格,Q2→多模态偏好,Q3→活跃时段 → Neo4j+MongoDB+PostgreSQL)"
    },
    "LP-19_style_modal": {
      "description": "学习风格评估弹窗（冷启动3题问卷→Neo4j+MongoDB）",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ LearningStyleModal 已实现：3题自动推进、提交后自动继续生成路径。Q1→cognitive_style, Q2→multimodal_preference, Q3→active_hours"
    },
    "LP-20_generation_progress": {
      "description": "路径生成进度动画（4步进度条+超时处理+错误重试）",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ GenerationProgress 已实现：画像分析→图谱分析→路径生成→策略生成，30s超时提示，失败重试+取消"
    },
    "LP-21_confirm_path": {
      "description": "POST /path/confirm — AI生成的路径持久化到状态机",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ PathStateManager.confirm_path() 已实现，含 ai_metadata。前端 handleConfirmPath 调用 confirm API 后从状态机加载数据。"
    },
    "LP-22_kg_path_linkage": {
      "description": "KG→Path 上下文传递（从知识图谱页携带subject_id跳转）",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ KnowledgeGraphPage navigate(/path?subjectId=X)，LearningPathPage 接收 URL 参数自动填入学科。KG 上传结果含 subject_id。"
    },
    "LP-23_path_current_priority": {
      "description": "确认后加载状态机 AI 排序（前端侧修复）",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ handleConfirmPath 改为从 GET /path/state?state_id=X 加载 node_order，保留 AI 排序。不再调用 fetchPath()（sort_order）。"
    },
    "LP-24_state_metadata": {
      "description": "LearningPathState 新增 metadata JSONB 字段存储AI元数据",
      "completed": true, "passed": false, "user_feedback": null,
      "notes": "✅ ai_metadata JSONB 列（映射到 'metadata'），存储 path_name/phases/strategy_notes/daily_suggestion/generation_reason/total_days"
    },
    "LP-25_skip_rollback": {
      "description": "路径跳过/回退功能（用户手动调整节点）",
      "completed": false, "passed": false, "user_feedback": null,
      "notes": "P1: 前端操作→后端调整node_order"
    },
    "LP-26_multi_signal_rec": {
      "description": "多信号融合推荐引擎（6维加权评分→精确下一步动作）",
      "completed": false, "passed": false, "user_feedback": null,
      "notes": "P1: Priority=w1×urgency+w2×mastery_gap+w3×dependency+w4×freshness+w5×fatigue+w6×user_goal"
    },
    "LP-27_adaptive_adjust": {
      "description": "路径自适应调整（回退/短路/解锁）",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "2026-07-09 已完成：新增 POST /path/replan；完成节点、掌握度测评和练习提交后按最新 mastery_score、连续错误、reviewing 状态动态重排未完成节点；连续错误或已完成节点掌握度回落会回退为 reviewing；掌握度达标且练习量充足会短路为 done；读取 Neo4j PREREQUISITE 关系并锁定前置未达标节点，前置掌握后自动解锁；前端 AI 生成入口改为 generate→confirm→state 闭环，并展示回退复习/前置锁定状态。"
    },
    "LP-28_path_history": {
      "description": "路径历史与版本控制（PathHistory表+演变时间线）",
      "completed": false, "passed": false, "user_feedback": null,
      "notes": "P2: 每次调整写入PathHistory；前端展示路径演变"
    },
    "LP-29_leetbook_explore_ui": {
      "description": "LeetBook 风格探索知识地图与知识点章节详情页",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "2026-07-09 已完成：LearningPathPage 总览替换为探索知识地图，按领域分组展示知识点卡片；新增 /path/knowledge/:pointId 独立详情页，包含左侧路径目录、章节头图、学习任务、学习内容、练习复盘和前后篇导航；点击线性表等知识点会跳转到对应章节页。Playwright 已验证线性表定义跳转与详情结构。"
    },
    "LP-30_sourced_reading_lecture": {
      "description": "数据结构参考讲义与知识拔高",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "2026-07-09 已完成：新增 knowledge_lecture_builder，根据数据结构复习资料和 CK_0ff 复习笔记的章节索引为知识点构建讲义提示词；线性表等知识点输出基础讲解、知识拔高、易错辨析、练习导向、自测清单和参考来源；无 DeepSeek/Qwen 配置时生成资料参考讲义，有配置时调用模型生成个性化 Markdown 讲义；前端统一为阅读讲义文案。"
    },
    "LP-31_knowledge_graph_workspace": {
      "description": "GraphRAG 工作台式知识图谱界面",
      "completed": true, "passed": true, "user_feedback": null,
      "notes": "2026-07-10 已完成并通过 Playwright：KnowledgeGraphPage 改为固定顶栏、图库/导入/问答侧栏和常驻 D3 图谱画布；测试账号真实图谱渲染 57 个节点，RAG 面板正常；知识点导航和携带 subjectId 生成学习路径链路通过；知识图谱上传新增 DOCX/PPTX 文本解析，旧版 DOC/PPT 中文另存提示与禁用状态通过。"
    }
  }
}
```

---

## 1. 系统架构

### 1.1 整体架构图（含实施状态标注）

```
┌──────────────────────────────────────────────────────────────┐
│                        前端 (React 18 + TypeScript)           │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 首页学习中心│  │ 学习路径页面  │  │ 知识图谱构建页        │  │
│  │ (HomePage) │  │ (PathPage)   │  │ (KnowledgeGraph)     │  │
│  │   ✅ 完成   │  │  🟡 预览可跑  │  │   ✅ 完成             │  │
│  └────────────┘  └──────────────┘  └──────────────────────┘  │
│                         │                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ✅ LearningStyleModal  ✅ GenerationProgress           │    │
│  │ ✅ PathPreview(内嵌)   ✅ KnowledgeGraph               │    │
│  │ 🔴 PathConfirm(缺失)   🔴 KG→Path上下文传递(缺失)      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼───────────────────────────────────┐
│                     后端 (FastAPI + Python 3.11)              │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ PathPlanningEngine│  │ ProfileAggregator│  ← ✅ 已实现     │
│  │ (Neo4j拓扑+LLM)  │  │ (多源数据聚合)    │                 │
│  └──────────────────┘  └──────────────────┘                  │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ PathStateManager │  │ PathPlanner      │  ← ✅ 已有       │
│  │ (路径状态生命周期)│  │ (Neo4j DAG算法)  │                 │
│  └──────────────────┘  └──────────────────┘                  │
│                                                               │
│  API 端点状态:                                                │
│  ✅ POST /path/generate      ✅ GET /path/check-api           │
│  ✅ POST /path/style-assessment                              │
│  🔴 POST /path/confirm       ← 断点1+2: 缺失!                │
│  ✅ POST /path/init  ✅ GET /path/state  ✅ POST /path/progress│
│  🟡 GET /path/current        ← 断点5: 不查状态机             │
└──────┬──────────┬──────────┬──────────┬──────────────────────┘
       │          │          │          │
┌──────▼──┐ ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐
│PostgreSQL│ │ Neo4j  │ │MongoDB │ │ Redis  │
│状态+记录 │ │知识图谱│ │行为数据│ │会话缓存│
└─────────┘ └────────┘ └────────┘ └────────┘
```

### 1.2 设计原则

- **算法 + LLM 混合**：Neo4j 拓扑保证硬约束（前置依赖），LLM 负责软优化（顺序偏好、时间分配、策略建议）
- **用户自配 API**：系统不提供默认 LLM Key，用户必须自己配置 DeepSeek/Qwen API 才能使用 AI 路径生成
- **生成-确认两阶段**：`POST /path/generate` 预览（不持久化）→ 用户审核 → `POST /path/confirm` 持久化到状态机
- **冷启动友好**：新用户无数据时通过风格评估问卷 + 注册信息推断画像
- **可视化优先**：路径数据用图表展示（DAG图、雷达图、趋势图），不用表格
- **空状态引导**：数据为空时显示引导而非报错，绝不用硬编码假数据

---

## 2. 已完成功能（LP-01 ~ LP-20 代码实现）

### 2.1 路径执行状态机（LP-01~03）

**核心思路**：给每个用户的学习路径持久化的执行状态，包括阶段、焦点节点、执行顺序、进度。

**状态流转**：
```
diagnosis → learning → practice → review → completed
    ↑           ↓           ↓          ↓
    └── 用户手动触发重新规划 ────────────┘
```

**数据模型**：`learning_path_states` 表（PostgreSQL），含 phase/current_node_id/node_order/version 字段。

**API**：
- `POST /path/init` — 初始化路径状态（按 sort_order 排序）
- `GET /path/state` — 获取当前路径状态 + DAG数据 + 推荐
- `POST /path/progress` — 上报节点完成/跳过
- `POST /path/restart` — 重新开始路径

**实现文件**：
- `app/models/path_state.py` — SQLAlchemy 模型
- `app/services/path_state_manager.py` — 状态管理逻辑
- `app/api/endpoints/path.py` — API 端点

### 2.2 交互式知识图谱（LP-04~06）

**SubjectLearningPage** 改造为领域分组卡片 + 知识点节点系统：
- 领域分组卡片：标题头显示 X/Y 完成数
- 知识点节点卡片：状态徽章（已掌握/薄弱/学习中）+ 6色掌握度条 + 快操按钮（练习/问AI/标记）
- 流式 AI 对话（SSE）+ 聊天持久化（localStorage 按 subjectId）

**实现文件**：
- `frontend/src/pages/SubjectLearningPage.tsx`
- `frontend/src/pages/LearningPathPage.tsx`
- `frontend/src/api/path.ts`

### 2.3 学习路径看板（LP-07）

LearningPathPage DashboardScreen：
- 周统计卡片 — 从 `/api/v1/dashboard/stats` 获取
- 掌握度趋势图 — 从节点数据聚合派生
- 薄弱知识点列表 — 从节点掌握度筛选（< 40%）
- 阶段计划 — 动态生成
- 空数据状态：所有图表显示引导文案

### 2.4 首页 + 画像 + 推荐（LP-08~10）

- **首页**（LP-08）：登录后展示个人学习中心
- **画像仪表盘**（LP-09）：RadarChart + TrendChart + HeatmapCalendar
- **推荐浮窗**（LP-10）：毛玻璃效果 + 8种推荐类型颜色标签 + 120s冷却

### 2.5 算法与推荐（LP-11~13）

- **题库掌握度联动**（LP-11）：`KnowledgePointRecord` 随答题更新；遗忘曲线指数衰减
- **Neo4j 路径规划**（LP-12）：`PathPlanner` — Kahn 拓扑排序 + 加权评分 + `GOAL_WEIGHT_MAP` 动态权重
- **资源推荐**（LP-13）：`GET /recommendations/personalized` — 薄弱点召回 + 排序 + 分页

### 2.6 AI 个性化路径生成（LP-16~20）✅ 代码已完成

> **注意**：LP-16~20 的后端逻辑和前端组件均已实现，但**未与状态机打通**（见断点分析）。

| 组件 | 文件 | 状态 |
|------|------|------|
| 路径规划引擎 | `app/services/path_planning_engine.py` | ✅ Neo4j拓扑 + LLM个性化 + 启发式降级 |
| 用户画像聚合 | `app/services/profile_aggregator.py` | ✅ 8源数据聚合 → PersonalizationContext |
| API端点 | `app/api/endpoints/path.py` | ✅ generate / check-api / style-assessment |
| Schemas | `app/schemas/path_personalization.py` | ✅ 完整的 Pydantic 模型 |
| 风格评估弹窗 | `frontend/src/components/path/LearningStyleModal.tsx` | ✅ 3题自动推进 → 提交 → 继续生成 |
| 进度动画 | `frontend/src/components/path/GenerationProgress.tsx` | ✅ 4步动画 + 30s超时 + 失败重试 |
| API客户端 | `frontend/src/api/path.ts` | ✅ generatePath / checkApi / submitStyleAssessment |
| 路径页面 | `frontend/src/pages/LearningPathPage.tsx` | ✅ CreateScreen: checkApi→StyleModal→generatePath→预览 |

### 2.7 知识图谱工作台与文档构建

| 组件 | 文件 | 状态 |
|------|------|------|
| KG工作台 | `frontend/src/pages/KnowledgeGraphPage.tsx` | ✅ 图库/导入/问答侧栏 + 常驻 D3 画布 + 异步进度轮询 |
| 工作台样式 | `frontend/src/pages/KnowledgeGraphPage.css` | ✅ GraphRAG 式固定顶栏与分栏布局，含移动端适配 |
| 后端端点 | `app/api/endpoints/knowledge_graph.py` | ✅ upload / status / list / graph / chat；PDF/DOCX/PPTX 解析 |

---

## 3. 待实现：闭合业务闭环（LP-21~24, P0）

### 3.1 核心问题

AI 路径生成和状态机是**两套独立运行的系统**，从未打通：

```
当前实际流程:
  POST /path/generate → AI 返回精美路径 → 前端展示预览
     ↓ 用户点"确认"
  handleConfirmPath() → setPageView('overview') → fetchPath()
     ↓
  GET /path/current → SELECT * FROM knowledge_points ORDER BY sort_order
     ↓
  AI 生成的阶段/策略/排序 → 全部丢弃 ❌
```

### 3.2 修复方案总览

| 优先级 | 编号 | 修复内容 | 涉及文件 |
|--------|------|---------|---------|
| **P0** | LP-21 | 新增 `POST /path/confirm` — AI路径持久化到状态机 | `path.py`, `path_state_manager.py` |
| **P0** | LP-22 | KG→Path 上下文传递（携带subject_id） | `KnowledgeGraphPage.tsx`, `LearningPathPage.tsx` |
| **P0** | LP-23 | `GET /path/current` 优先返回状态机中的AI排序 | `path.py` |
| **P0** | LP-24 | `LearningPathState` 新增 `metadata` JSONB 字段 | `path_state.py` (模型), DB migration |

### 3.3 LP-21: POST /path/confirm（核心）

```json
// Request
{
  "goal_type": "升学备考",
  "goal_description": "目标分数: 130, 截止日期: 2026-12-14",
  "subject_id": "uuid",
  "generated_path": {
    "path_name": "...",
    "description": "...",
    "total_days": 90,
    "phases": [
      {"name": "基础入门", "days": 30, "focus": "...", "node_ids": [...], "node_names": [...]}
    ],
    "daily_suggestion": {"recommended_session_minutes": 90, "best_time": "下午", "tasks_per_day": 3},
    "strategy_notes": ["策略1", "策略2"],
    "generation_reason": "基于 Neo4j 知识图谱拓扑分析 + 大模型个性化规划",
    "nodes": [{"id": "uuid", "name": "知识点", ...}, ...]
  }
}

// Response
{
  "state_id": "uuid",
  "message": "个性化学习路径已保存",
  "phase": "learning",
  "total_nodes": 45
}
```

**后端逻辑（PathStateManager.confirm_path）**：

```python
def confirm_path(self, user_id, subject_id, goal_type, goal_description, generated_path):
    # 1. 完成该用户同一 subject 的旧路径
    old = db.query(LearningPathState).filter(
        user_id=user_id, subject_id=subject_id, phase != "completed"
    ).all()
    for o in old: o.phase = "completed"

    # 2. 按 AI 生成的 nodes 顺序构建 node_order
    node_order = []
    for node in generated_path["nodes"]:
        node_order.append({
            "node_id": node["id"], "name": node["name"],
            "domain_name": node.get("domain_name", ""),
            "status": "pending", "mastery_score": node.get("mastery_score", 0),
        })

    # 3. 设置第一个未掌握节点为 active
    first_pending = next((n for n in node_order if n["mastery_score"] < 80), node_order[0])
    first_pending["status"] = "active"

    # 4. 创建 LearningPathState
    state = LearningPathState(
        user_id=user_id, subject_id=subject_id,
        goal_type=goal_type, goal_description=goal_description,
        phase="learning",
        current_node_id=UUID(first_pending["node_id"]),
        current_node_name=first_pending["name"],
        node_order=node_order,
        total_nodes=len(node_order),
        metadata={
            "path_name": generated_path.get("path_name"),
            "description": generated_path.get("description"),
            "phases": generated_path.get("phases"),
            "strategy_notes": generated_path.get("strategy_notes"),
            "daily_suggestion": generated_path.get("daily_suggestion"),
            "generation_reason": generated_path.get("generation_reason"),
        },
    )
    db.add(state)
    db.commit()
    return state
```

### 3.4 LP-22: KG→Path 上下文传递

```typescript
// KnowledgeGraphPage.tsx — 修改
// Before: <button onClick={() => navigate('/path')}>
// After:
<button onClick={() => {
  const subjectId = kg.subject_id  // KG 关联的学科
  navigate(`/path?subjectId=${subjectId}`)
}}>

// LearningPathPage.tsx — 接收参数
import { useSearchParams } from 'react-router-dom'

const [searchParams] = useSearchParams()
useEffect(() => {
  const sid = searchParams.get('subjectId')
  if (sid) setGoalForm(prev => ({ ...prev, subjectId: sid }))
}, [])
```

### 3.5 LP-23: GET /path/current 优先状态机

```python
# path.py — get_current_path 修改
@router.get("/current")
async def get_current_path(...):
    user_id = str(current_user.student_id)

    # 1. 先查状态机（用户是否有AI生成的活跃路径）
    state = db.query(LearningPathState).filter(
        user_id=user_id, phase != "completed"
    ).order_by(LearningPathState.updated_at.desc()).first()

    if state and state.node_order:
        # 有AI路径 → 按 node_order 返回（使用AI排序）
        return build_response_from_state(state, db)
    
    # 2. 无状态机 → 按 sort_order 返回（降级逻辑）
    return build_response_from_sort_order(db)
```

### 3.6 LP-24: LearningPathState 模型扩展

```python
# app/models/path_state.py
from sqlalchemy.dialects.postgresql import JSONB

class LearningPathState(Base):
    # ... existing columns ...
    
    # 新增: AI 生成的元数据
    metadata = Column(JSONB, nullable=False, default=dict)
    # 存储结构:
    # {
    #   "path_name": "大语言模型系统化学习路径",
    #   "description": "...",
    #   "phases": [{"name": "...", "days": 30, "focus": "...", "node_ids": [...], "node_names": [...]}],
    #   "strategy_notes": ["策略1", "策略2"],
    #   "daily_suggestion": {"recommended_session_minutes": 90, ...},
    #   "generation_reason": "基于 Neo4j 知识图谱拓扑分析 + 大模型个性化规划"
    # }
```

**DB Migration**:
```sql
ALTER TABLE learning_path_states ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
```

---

## 4. API 完整参考

| 方法 | 端点 | 状态 | 描述 |
|------|------|------|------|
| POST | `/api/v1/path/init` | ✅ | 初始化学习路径状态（sort_order排序） |
| GET | `/api/v1/path/state` | ✅ | 获取当前路径执行状态 |
| POST | `/api/v1/path/progress` | ✅ | 上报节点完成/跳过 |
| POST | `/api/v1/path/restart` | ✅ | 重新开始路径 |
| GET | `/api/v1/path/current` | 🟡 | 获取学习路径节点列表（需改为优先状态机） |
| **POST** | **`/api/v1/path/generate`** | ✅ | **AI 个性化路径生成（预览）** |
| **POST** | **`/api/v1/path/confirm`** | 🔴 | **AI路径确认持久化（NEW）** |
| **GET** | **`/api/v1/path/check-api`** | ✅ | **检查 LLM API 可用性** |
| **POST** | **`/api/v1/path/style-assessment`** | ✅ | **提交学习风格评估** |
| GET | `/api/v1/path/agent/recommend` | ✅ | Agent 推荐列表 |
| POST | `/api/v1/path/agent/accept` | ✅ | 接受 Agent 建议 |
| GET | `/api/v1/path/knowledge/{id}` | ✅ | 知识点详情 |
| POST | `/api/v1/path/knowledge/{id}/record-study` | ✅ | 记录知识点学习 |
| GET | `/api/v1/path/history` | ✅ | 路径调整历史 |

---

## 5. 前端组件树

```
src/
├── pages/
│   ├── HomePage.tsx                     # 首页个人学习中心
│   ├── LearningPathPage.tsx             # 学习路径主页面（选择+创建+总览+详情+看板）
│   │   ├── PathSelectScreen             # 路径选择页（多路径卡片）
│   │   ├── CreateScreen                 # 目标设置 + 学情诊断 + AI路径预览
│   │   ├── OverviewScreen               # 路径总览（阶段Tab + 流程图 + 焦点卡片）
│   │   │   ├── PathFlowDiagram          # 阶段流程图（SVG箭头 + 领域分行）
│   │   │   └── PhaseTabBar (内联)       # 阶段切换Tab
│   │   ├── DetailScreen                 # 知识点进度详情
│   │   └── DashboardScreen              # 学习看板（周统计+趋势+薄弱点）
│   ├── SubjectLearningPage.tsx          # 学科学习页（知识图谱+对话）
│   ├── KnowledgeGraphPage.tsx           # PDF上传→KG构建
│   └── DynamicProfilePage.tsx           # 学习画像仪表盘
├── components/
│   ├── path/
│   │   ├── GenerationProgress.tsx       # ✅ 4步进度动画
│   │   └── LearningStyleModal.tsx       # ✅ 3题风格评估弹窗
│   ├── charts/
│   │   ├── RadarChart.tsx               # 雷达图
│   │   ├── TrendChart.tsx               # 趋势图
│   │   └── HeatmapCalendar.tsx          # 热力图
│   └── PracticeRecommendPopup.tsx       # 推荐浮窗
├── api/
│   └── path.ts                          # ✅ 完整路径 API 客户端
└── store/
    └── auth.ts                          # 认证状态
```

### 5.1 路径总览页（OverviewScreen）布局设计

```
┌──────────────────────────────────────────────────────┐
│ ① 总进度概览                                          │
│   65% ██████████░░░░░░░░░░░░  ✓12已掌握 ●3进行中      │
│   诊断 → 学习 → 练习 → 复习 → 完成                     │
├──────────────────────────────────────────────────────┤
│ ② 当前焦点（可操作）                                   │
│   🎯 现在该学：线性代数基础  领域·掌握度35%  [查看详情] │
├──────────────────────────────────────────────────────┤
│ ③ 阶段Tab切换（一次只看一个阶段）                       │
│   [① 基础巩固 80% ▼] [② 强化提升 20%] [③ 冲刺复习 🔒] │
│                                                      │
│   ═══ 阶段1：基础巩固（展开内容）══════                │
│   领域：线性代数（5点）                                │
│   ┌────────┐ → ┌────────┐ → ┌────────┐ → ┌──────┐  │
│   │矩阵    │   │行列式  │   │特征值  │   │二次型 │  │
│   │✅ 90%  │   │✅ 85%  │   │🔵 45%  │   │⚪ 0%  │  │
│   └────────┘   └────────┘   └────────┘   └──────┘  │
│   领域：微积分（4点）                                  │
│   ┌────────┐ → ┌────────┐ → ┌────────┐ → ┌──────┐  │
│   │极限    │   │导数    │   │微分    │   │积分    │  │
│   │✅ 95%  │   │🔵 50%  │   │⚪ 0%   │   │⚪ 0%  │  │
│   └────────┘   └────────┘   └────────┘   └────────┘ │
│                                                      │
│   ★ 箭头=推荐学习顺序  🔵蓝色=前置依赖  ⚫灰色=顺序连接 │
├──────────────────────────────────────────────────────┤
│ ④ AI 学习建议（横向卡片）                              │
│   [建议1] [建议2] [建议3]                             │
└──────────────────────────────────────────────────────┘
```

### 5.2 设计要点

| 设计决策 | 说明 |
|---------|------|
| **双视图模式** | `📋 引导模式`（默认）：阶段Tab + 单阶段流程图，适合小白用户；`🗺️ 全局模式`：所有节点一览，阶段Tab隐藏，领域分行，适合进阶用户自由探索 |
| **阶段Tab切换** | 引导模式下一次只展示一个阶段的知识点流程图（最多15个节点），避免密集 |
| **领域分行** | 每个领域一行，引导模式每行最多8个节点，全局模式最多15个节点 |
| **节点放大** | 148×56px，13px字号，含状态标签+掌握度徽章+进度条 |
| **箭头语义** | 🔵蓝色=Neo4j前置依赖、⚫灰色=推荐顺序、🟢绿色=已掌握 |
| **删除左侧目录** | 原340px侧边栏知识点树形目录删除，与流程图重复 |
| **当前焦点卡片** | 醒目展示"现在该学哪个"，可直接操作 |

---

## 6. 实施步骤（按优先级）

### ✅ 第1步：数据模型扩展（LP-24）
- [x] `LearningPathState` 新增 `ai_metadata` JSONB 字段（映射到DB列"metadata"）
- [x] 数据库迁移：通过 SQLAlchemy 自动添加
- [x] `PathStateManager.confirm_path()` 写入 AI 元数据

### ✅ 第2步：确认端点（LP-21）
- [x] 新增 `POST /api/v1/path/confirm` 端点
- [x] `PathStateManager.confirm_path()` 方法
- [x] 前端 `pathApi.confirmPath()` API 函数
- [x] `LearningPathPage.handleConfirmPath()` 改为调用 confirm API，确认后从状态机加载

### ✅ 第3步：确认后加载状态机排序（LP-23）
- [x] `handleConfirmPath` 改为调用 `GET /path/state?state_id=X` 加载 node_order
- [x] `handleSelectPath` 同样从状态机加载 AI 排序
- [x] 不再依赖 `GET /path/current`（sort_order）

### ✅ 第4步：KG→Path 联动（LP-22）
- [x] `KnowledgeGraphPage` 跳转时携带 `subject_id` 参数
- [x] KG 上传结果新增 `subject_id` 字段
- [x] `LearningPathPage` 通过 `useSearchParams` 接收 URL 参数自动填入学科

### ✅ 第5步：前端总览页重构
- [x] 删除左侧340px知识点树形目录（与流程图重复）
- [x] 新增顶部总进度条 + 阶段指示器
- [x] 新增"当前焦点"卡片（展示当前该学的知识点）
- [x] 新增阶段Tab切换（一次只看一个阶段，节点不密集）
- [x] PathFlowDiagram 重构：节点148×56、13px字号、领域分行、8节点/行
- [x] 阶段卡片可点击切换，展开/折叠流程图
- [x] AI建议横向卡片展示
- [x] 箭头语义化：蓝色=前置依赖、绿色=已掌握、灰色=顺序连接

### ✅ 第6步：端到端测试
- [x] 用 guoketg 登录 → 路径选择 → 总览 → 验证阶段Tab+流程图+箭头
- [x] 测试阶段切换（单阶段节点数 < 30，不再是全部45+）
- [x] Playwright 自动化验证（10/10 tests passed）

---

## 7. 后端文件清单（当前状态）

| 文件 | 职责 | 状态 |
|------|------|------|
| `app/api/endpoints/path.py` | 所有路径相关 API 端点 | ✅ 含 generate/check-api/style-assessment |
| `app/services/path_planning_engine.py` | LLM+Neo4j 混合路径生成引擎 | ✅ 完整实现 |
| `app/services/profile_aggregator.py` | 多源画像数据聚合 | ✅ 完整实现 |
| `app/services/path_state_manager.py` | 路径状态机（生命周期管理 + confirm_path） | ✅ 完成 |
| `app/services/path_planner.py` | Neo4j DAG 路径规划算法 | ✅ 完成 |
| `app/services/path_generator.py` | 辅助函数（build_summary 等） | ✅ 完成 |
| `app/schemas/path_personalization.py` | Pydantic 模型 | ✅ 完整 |
| `app/models/path_state.py` | LearningPathState ORM 模型（含 ai_metadata JSONB） | ✅ 完成 |
| `app/db/neo4j.py` | Neo4j 连接 + 认知风格/错题查询 | ✅ 完成 |
| `app/db/mongodb.py` | MongoDB 连接 + 学习行为查询 | ✅ 完成 |

## 8. 前端文件清单（当前状态）

| 文件 | 职责 | 状态 |
|------|------|------|
| `frontend/src/pages/LearningPathPage.tsx` | 路径规划主页面（5视图：选择+创建+总览+详情+看板） | ✅ 含 PathFlowDiagram + 阶段Tab + 焦点卡片 |
| `frontend/src/pages/KnowledgeGraphPage.tsx` | PDF上传+KG构建+KG列表，携带 subject_id 跳转 | ✅ 完成 |
| `frontend/src/components/path/GenerationProgress.tsx` | 4步进度动画 | ✅ 完成 |
| `frontend/src/components/path/LearningStyleModal.tsx` | 3题风格评估弹窗 | ✅ 完成 |
| `frontend/src/api/path.ts` | 路径 API 客户端（含 confirmPath/listPaths/generatePath） | ✅ 完整 |
| `frontend/src/App.tsx` | 路由配置 | ✅ 已含 /knowledge-graph |

---

## 9. 动态交互模型（v4.1 新增）

### 9.1 核心问题

当前学习路径"建好后就不动了"——状态机写入了但从未被推进：

| 问题 | 根因 |
|------|------|
| 用户标记"已学会"后焦点节点不变化 | `handleToggleStudy` 只调 `recordKnowledgeStudy`，不调 `POST /path/progress` |
| 状态机的 `current_node_id` 从不更新 | 前端从未调用 `pathApi.updateProgress()` |
| 标记学习后数据被覆盖 | `handleToggleStudy` 内 `fetchPath()` 走的是 `GET /path/current`（sort_order），覆盖了状态机数据 |
| 阶段永不自动流转 | `POST /path/progress` 会检查所有节点 done → 自动切 phase，但此端点未被调用 |

### 9.2 动态交互循环

```
用户打开总览页
  → 焦点卡片显示当前该学的知识点（从状态机 current_node_id 读取）
  → 用户操作：
      ├─ [✅ 我已学会] → POST /path/progress (complete)
      │    → 状态机推进 current_node_id 到下一个 pending 节点
      │    → 流程图动画更新（当前焦点节点变绿色，下一个节点高亮）
      │    → 如果阶段内所有节点 done → 自动切换到下一阶段
      ├─ [✏️ 去做练习] → 携带 point_id 跳转到题库练习页
      │    → 练习完成 → 掌握度自动更新 → 回到总览页 → 焦点可能已变
      └─ [🤖 AI讲解] → 弹出 AI 对话窗口，基于当前知识点上下文讲解
  → 刷新：从状态机重新加载，焦点不变（状态机已持久化进展）
```

### 9.3 焦点卡片（交互中心）

```
┌── 🎯 当前焦点 ───────────────────────────────────────┐
│  现在该学：线性代数基础                                │
│  领域：线性代数  |  掌握度：35%  |  阶段：基础巩固       │
│                                                      │
│  [✅ 我已学会]    [✏️ 去做练习]    [🤖 AI讲解]         │
│                                                      │
│  💡 推荐理由：前置知识已掌握，基础知识点优先             │
└──────────────────────────────────────────────────────┘
```

### 9.4 修复清单

| 编号 | 修复项 | 涉及 |
|------|--------|------|
| DX-01 | 新增 `handleAdvanceFocus()` 调 `POST /path/progress` | LearningPathPage |
| DX-02 | 焦点卡片三个快捷按钮 | OverviewScreen |
| DX-03 | `handleToggleStudy` 修复为从状态机重加载（不再调 fetchPath） | LearningPathPage |
| DX-04 | 节点完成/推进动画反馈 | PathFlowDiagram |
| DX-05 | `refreshFromStateMachine()` 统一刷新逻辑 | LearningPathPage |

### 9.5 状态机 API 调用链

```
前端操作            API 调用                        后端行为
─────────          ────────                        ──────
我已学会           POST /path/progress             update_progress()
                   {node_id, action:"complete"}     → node status="done"
                                                   → 推进 current_node_id
                                                   → 检查阶段切换

去做练习           → 跳转到 /banks?point=id        (独立，练习完回到路径)
                   练习完成后 KnowledgePointRecord  自动更新

AI讲解             → 打开 AI 对话窗                 SSE 流式返回讲解
```

---

*本文档由 AI Agent 维护，最后更新：2026-06-14（v4.1 动态交互版）*
