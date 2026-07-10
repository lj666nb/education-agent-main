# 项目贡献记录 (CONTRIBUTING)

本文档记录项目的开发时间线和每次贡献的内容。

---

## 2026-05-19 - 主观题自评功能

针对简答题、填空题、论述题等主观题，新增用户自评机制。练习结束后，用户可对照标准答案滑动评分（0.0-1.0），避免严格字符串匹配误判。

- StudentAnswer 模型新增 `self_grade` 列（Float, nullable）
- 新增 `POST /answers/{id}/self-grade` 和 `POST /sessions/{id}/self-grade` API 端点
- PracticePage 结果阶段新增自评面板：逐题展示用户答案 vs 标准答案 + 滑块评分
- 主观题跳过客户端严格对比，`is_correct` 统一提交 `false`，等待用户自评

---

## 2026-05-19 - 视频图表工具集成（思维导图/流程图/甘特图 + ECharts 图表 + JSON 容错）

为视频生成 agent 封装了绘图工具集（思维导图/流程图/甘特图），LLM 可在章节数据中自动选择图表类型。引入 ECharts 渲染柱状图/折线图/饼图/环形图到 Canvas，新增时间线/里程碑可视化。目前支持 icon_text/image/table/bar_chart/line_chart/pie_chart/donut_chart/timeline/mindmap/flowchart/gantt 共 11 种视觉类型。

修复了 PRESENTATION_TEMPLATE 中 ECharts resize JavaScript 未转义 `{}` 导致 `format()` 崩溃的问题（`setTimeout(function(){` 中 `{` 被当成 format 占位符）。同时增加 `_clean_json_output()` 容错处理和 LLM 重试机制。

---

## 2026-05-18 - Unsplash 官方图片搜索 + MCP 工具

替换废弃的 source.unsplash.com，集成官方 Unsplash API。创建 MCP 搜索工具供 Claude 搜索配图，前端 API 设置页面支持配置 Unsplash Access Key。

---

## 2026-05-17 - Draw.io 图表编辑器集成

将 draw.io 编辑器嵌入 AI 对话中。AI 可以 [DRAWIO] 标记输出图表 XML，前端自动解析并加载到编辑器面板，支持历史图表回看和手动开关。

---

## 2026-05-16 - 多项功能

- **知识掌握度/易错点层级化**：从扁平列表改为按 学科→章节→知识点 三级展示
- **错题本 + 测试历史 + 练习统计**：答题记录持久化，支持错题重练、d3 每日统计图表
- **云盘增强**：文件预览（Word/PPT/图片/PDF）、TipTap 富文本编辑器、文件缩略图、PPT 生成
- **答题后自动更新画像**：随学随新，无需手动操作

---

## 2026-05-12 - RAG 系统 + 文件格式兼容

PPT/Word 文档解析支持上传和自动分块索引。RAG 参考来源在 AI 回复底部展示（文档名+相关度+片段）。旧版 Office 格式 (.ppt/.doc) 上传友好提示。前端文件选择器移除 accept 属性，改为 JS 校验（Windows 兼容性修复）。

---

## 2026-05-10 - 多项功能

- **联网搜索**：集成阿里云百炼 MCP WebSearch，AI 可结合实时网络信息回答
- **OCR 图片文字识别**：集成百度 OCR，纯文本模型也能理解图片内容
- **剪贴板粘贴**：支持粘贴图片/PDF，多模态模型直传，纯文本模型 OCR
- **API 设置 + 模型可用性检查**：用户可配置 API Key，灰色显示不可用模型

---

## 2026-05-09 - 前端修复与后端强化

深度思考内容保留、删除确认、导航栏调整、固定返回按钮、登录错误优化。PostgreSQL 强制检查（启动时验证）。API 文档页面 React 重写替代 HTML。账号从标记删除改为物理删除。

---

## 2026-05-09 - LLM 集成 + AI Chat + RAG 项目系统

集成 DeepSeek API 实现 AI 智能对话（SSE 流式输出）。实现项目管理系统（CRUD+提示词+RAG 文档），FAISS 混合检索（向量+关键词），集成到 AI Chat 中作为项目面板。支持按项目筛选对话、新建/编辑/删除项目。

---

## 2026-05-08 - 前端 React/TypeScript 重构 + 画像数据库层

从静态 HTML 完全重构为 React 18 + TypeScript + Vite。实现 8 维学习画像的数据库层（Neo4j/MongoDB/PostgreSQL）和 API。整理测试脚本到 test_script/ 目录。

---

## 2026-05-07 - 项目初始化

创建 FastAPI 后端项目，实现用户认证系统（注册/登录/JWT/登录锁定）、用户角色系统（student/admin）、8 维学习画像设计、多数据库配置（PostgreSQL/Redis/Neo4j/MongoDB）、迁移脚本和 PRD 文档。

---

## 当前实现状态

### 已完成功能
- 用户认证系统（注册/登录/JWT/登录失败锁定）
- 8 维学习画像（Neo4j + MongoDB）
- AI 对话（DeepSeek API + SSE 流式输出）
- 题库系统（按学科→章节→知识点组织）
- 错题本 + 测试历史 + 练习统计
- 项目管理系统（CRUD + RAG）
- 联网搜索（阿里云百炼 MCP）
- OCR 文字识别（百度 OCR）
- Draw.io 图表编辑器
- AI 视频演示生成（11 种视觉类型：ECharts/时间线/思维导图/流程图/甘特图等）
- 云盘系统（文件预览/缩略图/富文本编辑器/PPT 生成）
- Unsplash 官方图片集成 + MCP 工具
- **学习路径规划系统**：Neo4j 知识图谱 DAG 规划 + 加权评分 + 深度层级布局 + ReactFlow 可视化（真实 PREREQUISITE/RELATED_TO 依赖边 + dagre 自动布局 + 双模式降级）

### 规划中
- LangGraph ProfileInitAgent / ProfileUpdateAgent / ExplainabilityAgent
- EventTracker 自动埋点

---

## 项目规范
- 用户提示信息为中文；所有页面有固定返回首页按钮；空数据引导至初始化流程
- 所有 API 带 JWT 认证（除注册/登录）；列表接口支持分页
- Docker 部署（backend:8000, frontend:3000, PostgreSQL:5432, Redis:6379, Neo4j:7687, MongoDB:27017）
- 文件格式兼容 .pdf/.pptx/.ppt/.docx/.doc（前端 JS 校验，不依赖 accept 属性）
- 修改代码后检查 README/CONTRIBUTING/.env 一致性；README 确保零基础配置
- 新增 Python 依赖后立即更新 requirements.txt，不允许遗漏

## 分支管理
- `main` - 主分支，稳定版本
- `feature/*` - 功能分支

---

## 2026-05-24 - 学习路径规划系统改进（Phase 1：统一路径数据源）

修复了前端 KnowledgeGraph（ReactFlow DAG 图谱）使用假边（按领域顺序连接）的问题，改为消费后端 PathPlanner 从 Neo4j 提取的真实 PREREQUISITE/RELATED_TO 依赖关系。

### 后端变更
- `app/schemas/question_bank.py`：新增 DagNode、DagEdge、DagData Pydantic 模型；LearningPathMarkdownResponse 增加 dag_data 字段
- `app/api/endpoints/path.py`：GET /path/current 调用 PathPlanner.plan()，返回 dag_data 字段（Neo4j 不可用时静默降级）
- `app/services/path_planner.py`：新增加权评分函数（w1=0.4 掌握度差距 / w2=0.25 重要度 / w3=0.2 考察频率 / w4=0.15 认知负荷）；新增深度层级布局（多列替代单列）；新增 domain_name/subject_name 元数据传递；安全异常处理

### 前端变更
- `package.json`：新增 @dagrejs/dagre 依赖
- `frontend/src/api/path.ts`：新增 DagNode/DagEdge/DagData 类型定义
- `frontend/src/components/KnowledgeGraph.tsx`：重构为双模式—有 DAG 数据时使用 dagre 自动布局 + PREREQUISITE 边（蓝色实线带动画箭头）/ RELATED_TO 边（灰色虚线），无 DAG 数据时降级为领域分组排列
- `frontend/src/pages/LearningPathPage.tsx`：传递 dagData 给 KnowledgeGraph

### PRD 更新
- prd-7: LP-2 增强记录
- prd-8: FE-01 dagre布局 + 真实依赖边
- prd-9: BE-04 加权评分 + 深度布局；BE-05 dag_data 字段

---

## 2026-05-24 - 掌握度虚涨问题修复

修复了动态画像中整体掌握度持续上涨（虚高）的问题。共有 4 个根因：

### 根因分析

1. **新记录默认 50% 起步**：KnowledgePointRecord 新建时 `mastery_score=50`，答对 1 题立即跳到 80%
2. **复习次数加成脱离表现**：`study_count * 2` 无条件加 10 分，只看学习次数不看答题表现
3. **首次答题 recent_accuracy = 100**：第 1 题答对 → 100% 正确率 → 50 + 30 = 80 分
4. **Neo4j 独立 +/- delta 不同步**：Neo4j 用 `+0.05/-0.10` 独立于 PostgreSQL 计算，67% 以上正确率就持续上涨，置信度无论对错都 +0.02

### 后端变更

- `app/services/mastery_calculator.py`：
  - 新增**低样本惩罚**（`total_practiced < 3` 时 -30 分），防止 1 对 0 错 = 80 分
  - 复习次数加成改为**表现门控**（仅 `overall_acc >= 60%` 时生效），上限从 10 降至 5 分
- `app/api/endpoints/question_bank.py`：
  - 新建 `KnowledgePointRecord` 默认 `mastery_score=0`（原 50）
  - 首次答题 `recent_accuracy` 从 100 降至 **60**（保守估计）
  - 移除 Neo4j 独立 +/- delta 更新，改为**同步 PostgreSQL 综合计算结果**（`calculate_mastery() / 100`）
  - 置信度改为基于**练习量**（`total_practiced / 20`），不再无条件增长

### 效果

| 场景 | 改前 | 改后 |
|------|------|------|
| 答对 1 题（无历史） | 掌握度 80% | 掌握度 20% |
| 答对 5 题全对 | 掌握度 80 → 90% | 掌握度 80% |
| 答对 3/5 题（60%） | 掌握度 ~60% | 掌握度 ~50% |
| 答错 3 题连续 | 掌握度 60% | 掌握度 ~15%（含连错 -15） |
| 复习 5 次但 0 对 | +10 分 | +0 分（正确率 < 60%） |
| Neo4j 置信度 | 每答必涨 +0.02 | 基于练习量 /20 |

---

## 2026-05-24 - AI 出题速度优化

将 AI 出题模型从 `deepseek-chat` 切换到 `deepseek-v4-flash`（单题重生成已用该模型验证可用），同时降低提示词体积和超时时间。

### 优化项
- **模型切换**：`deepseek-chat` → `deepseek-v4-flash`，LLM 推理速度大幅提升
- **max_tokens 降低**：16384 → 4096，减少 LLM 输出长度预期
- **已有题目上下文**：200 条 → **30 条**，提示词体积降低 85%
- **超时缩短**：300s → 120s，快速失败不再让用户空等

### 涉及文件
- `app/api/endpoints/question_bank.py`：`_call_llm_for_questions`、`_call_llm_stream`、`_get_existing_questions_context`

---

## 2026-05-24 - AI 出题对话持久化修复

修复 AI 出题助手对话框重新打开后，历史消息和生成的题目消失的问题。

### Bug 分析

1. **`cleanAIMessage` 把整条回复清空了**：当 LLM 回复只有 `[[GENERATE]]\n{...}` 时，`content.substring(0, idx)` 返回空字符串
2. **`generatedQuestions` 不持久化**：Redis 只存了 `history` + `params`，没有存 `generated_questions`，重新打开后预览面板消失
3. **单题 JSON 解析失败**：LLM 有时输出单对象 `{...}` 而非数组 `[{...}]`，后端只搜 `[` 导致 0 题

### 后端变更

- `app/api/endpoints/question_bank.py`：
  - `AIContextResponse` 新增 `generated_questions` 字段
  - `_save_ai_context()` / `_load_ai_context()` 增加 `generated_questions` 参数
  - 流式/非流式端点在保存上下文时传入 `generated_questions`
  - 新增 `_parse_generated_questions()` 工具函数，同时兼容 `[{...}]` 数组和 `{...}` 单对象两种 LLM 输出格式
  - 流式/非流式端点均改用 `_parse_generated_questions()` 解析

### 前端变更

- `frontend/src/pages/BankDetailPage.tsx`：
  - init 恢复对话时清理 `[[GENERATE]]` 标记，空消息自动替换为 "✅ 已生成 X 道题目"
  - 恢复 `generatedQuestions` 状态，使预览面板重新显示
  - 渲染层增加空消息兜底文字
- `frontend/src/api/questionBank.ts`：`getAIContext` 响应类型增加 `generated_questions` 字段

---

## 2026-05-24 - AI 出题重复保存修复

修复 AI 出题助手保存题目后重新打开对话框，仍显示旧题目的"保存选中"按钮，可能导致重复保存的问题。

### Bug 分析

`handleSaveSelected` 保存题目到题库后调用 `onSaved()` 关闭弹窗，但没有清除 Redis 中的 AI 上下文。用户重新打开对话框时，`getAIContext` 返回旧 `generated_questions`，前端恢复这些题目到预览面板，用户再次点击"保存选中"即产生重复题目。

### 修复

- `frontend/src/pages/BankDetailPage.tsx`：`handleSaveSelected` 保存成功后调用 `questionBankApi.clearAIContext(bankId)` 清除 Redis 上下文。使用 fire-and-forget（`.catch(() => {})`）不阻塞弹窗关闭。

---

## 2026-05-24 - 跨学科薄弱点推荐污染修复

修复了练习时推荐系统展示其他学科薄弱知识点的问题。例如在 fastapi 题库连续答错时，出现"离散数学中的群没学好"的提示。

### Bug 分析

`PracticeRecommendPopup` 调用 `GET /recommend` 和 `GET /path/agent/recommend` 时未传递学科范围，后端返回所有学科的薄弱点推荐。练习时出现跨学科提示，干扰用户体验。

同时 `_ensure_knowledge_points` 未校验已有 UUID 是否属于当前学科，AI 出题可能引用其他学科的知识点。

### 后端变更

- `app/services/resource_recommender.py`：`get_all_recommendations()` 和 `_weak_point_recommendations()` 新增 `subject_id` 参数，非空时通过 `KnowledgePointRecord → KnowledgePoint → KnowledgeDomain` 连接过滤只返回目标学科的薄弱点
- `app/services/learning_agent.py`：`get_recommendations()` 新增 `subject_id` 参数，同样过滤
- `app/api/endpoints/recommend.py`：`GET /recommend` 和 `/recommend/weak-points` 新增可选 `subject_id` Query 参数
- `app/api/endpoints/path.py`：`GET /path/agent/recommend` 新增可选 `subject_id` Query 参数
- `app/api/endpoints/question_bank.py`：`_ensure_knowledge_points` 增加已有 UUID 的学科归属校验（`KnowledgePoint → KnowledgeDomain.subject_id`），不匹配的 UUID 自动丢弃

### 前端变更

- `frontend/src/pages/PracticePage.tsx`：新增 `subjectId` 状态，加载题库时从 `bank.subject_id` 获取，传递给 `PracticeRecommendPopup`
- `frontend/src/components/PracticeRecommendPopup.tsx`：接收 `subjectId` prop，API 请求时携带 `subject_id` 参数
- `frontend/src/api/recommend.ts` / `path.ts`：`getAll()` / `getAgentRecommendations()` 新增可选 `params` 参数
- `frontend/src/pages/SubjectLearningPage.tsx`：`recommendApi.getAll()` 调用时传入 `subject_id`

---

## 2026-05-24 - AI 出题助手对话持久化修复（LLM 多对象 JSON 解析）

修复 AI 出题助手生成的题目在退出对话框后未能恢复的问题。

### Bug 分析

`_parse_generated_questions()` 函数只能解析标准数组 `[{...}]` 和单对象 `{...}` 格式，但 LLM 实际输出的是流式多对象格式：

```
[[GENERATE]]
{...第一题...}
{...第二题...}
```

该格式无外层数组。原解析器先查找 `[`，但第一个 `[` 是题目中 `options` 数组的起始，导致 `arr_start` 指向选项数组内部而非外层，`json.loads` 报 `Extra data` 错误。回退到单对象解析时 `{...}{...}` 也不是合法 JSON。最终返回 `[]`，空列表被保存到 Redis，重新打开对话框时无题目可恢复。

### 修复

- `app/api/endpoints/question_bank.py`：`_parse_generated_questions()` 新增流式多对象分割步骤，用正则 `}\s*\n\s*{` 拆分为独立 JSON 分别解析。同时增加 `json.JSONDecoder.raw_decode()` 逐段解析作为兜底。

### 验证

```
第一次 getAIContext: has_context=True, questions=2
第二次 getAIContext: has_context=True, questions=2  ✅
```

---

## 2026-05-24 - AI 出题助手保存后对话恢复修复

修复 AI 出题生成题目后，点击"保存选中"按钮无响应、对话框不会自动回到对话界面的问题。

### Bug 分析

前次修复在 `handleSaveSelected` 中移除了 `onSaved()`（关闭弹窗+刷新题库）和 `clearAIContext()`，替换为 `savedQuestionIds` 状态追踪。但未触发任何可见的 UI 变化——预览面板和保存按钮保持不动，用户点击保存后看不到任何反馈。

### 修复

- `frontend/src/pages/BankDetailPage.tsx`：
  - `handleSaveSelected`：保存成功后，自动将全部题目索引通过 `updateSavedQuestions` 写入上下文；清空 `generatedQuestions` / `selectedQuestions` / `savedQuestionIds` 隐藏预览面板；在消息列表追加一条成功提示 `"✅ 已成功保存 N 道题目到题库"`，用户可继续出题或关闭
  - Init effect：检测到 `saved_indices` 覆盖全部生成题目时，不恢复预览面板（`setGeneratedQuestions([])`），避免重新打开后仍显示保存按钮
- `app/api/endpoints/question_bank.py`：新增 `POST /banks/{bank_id}/ai-context/saved-questions` 端点，将已保存索引持久化到上下文 params

### 流程

```
生成题目 → 预览面板显示保存按钮 → 点击保存 → 题目入库
→ 预览面板收起 → 成功消息出现在对话中 → 上下文保留
→ 关闭并重新打开 → 对话记录可见，预览面板不出现（已保存）
```
---

## 2026-06-12 - 学习路径优化：动态权重 + 遗忘曲线 + 前端性能

### 后端优化

1. **动态路径规划权重（P0）**：`app/services/path_planner.py`
   - 新增 `GOAL_WEIGHT_MAP` 根据 `goal_type` 查询参数自动切换权重
   - 学期提升（侧重基础掌握）：mastery_gap=0.45, cognitive_penalty=0.20
   - 升学备考（侧重考点）：exam_frequency=0.30, importance=0.30
   - 考级考证（侧重效率）：importance=0.35, cognitive_penalty=0.10
   - `GET /path/current` 新增 `goal_type` 查询参数
   - 前端 `fetchPath(goalType)` 统一传递 `goalForm.goalType`

2. **遗忘曲线优化（P0）**：`app/services/mastery_calculator.py`
   - 遗忘衰减起始天数从 7 天缩短至 3 天
   - 衰减方式从线性（-2/天）改为指数衰减（`1.5^(days-2)`）
   - 第 4 天扣 5 分，第 7 天扣 15 分，第 14 天封顶 30 分
   - 更符合艾宾浩斯遗忘曲线规律

### 前端优化

3. **学习路径页面性能优化**：`frontend/src/pages/LearningPathPage.tsx`
   - 4 个视图组件（CreateScreen/OverviewScreen/DetailScreen/DashboardScreen）使用 `React.memo` 包装，避免无关状态变化触发重渲染
   - 移除 Content div 的 `paddingLeft: 220px`，输入框区域左移与主内容区对齐
   - `SettingsIcon` 添加至 `Icons.tsx` 统一管理
   - 所有 `fetchPath()` 调用统一传递 `goal_type` 参数

### 文件变更

| 文件 | 变更 |
|------|------|
| `app/services/path_planner.py` | 新增 GOAL_WEIGHT_MAP 动态权重体系 |
| `app/services/mastery_calculator.py` | 遗忘衰减改为指数曲线 + 缩短起步天数 |
| `app/api/endpoints/path.py` | GET /path/current 新增 goal_type 参数 |
| `frontend/src/api/path.ts` | getCurrentPath 接受 goal_type 参数 |
| `frontend/src/pages/LearningPathPage.tsx` | React.memo + 输入栏对齐修复 + goalType 传递 |
| `frontend/src/components/Icons.tsx` | 新增 SettingsIcon |
| `frontend/src/components/Sidebar.tsx` | （回退）保持原 left: 0 覆盖效果 |
| `frontend/src/components/ChatPlatform.tsx` | 移除多余 paddingLeft: 220px |
| `request/prd-7-*.md` | 更新 AI 状态表（LP-15） |
| `request/prd-9-*.md` | 更新 AI 状态表（BE-04 动态权重 + BE-15 遗忘曲线） |
```


---

## 2026-07-07 - 种子数据整合（自动初始化完整数据）

整合了分散的种子数据脚本，新克隆项目的用户**启动容器后即可获得完整数据**，无需手动执行种子脚本。

### 背景

项目数据存储在 Docker 卷中（PostgreSQL/Neo4j/MongoDB），git 不跟踪卷数据。之前：
- `app/scripts/seed.py` 自动运行但只注入 82 题（从 JSON 文件读取）
- `scripts/seed_data_structures.py` 有完整数据（132+ 题、9 章节）但需手动 `docker exec`
- `app/scripts/seed_code_cases.py` 提供 19 个代码案例，也需手动执行
- 测试用户 guoketg 需要手动注册

### 变更

- **`app/scripts/seed.py`**：重写为综合种子脚本，启动时自动执行：
  1. 创建测试用户 guoketg（如不存在）
  2. 注入完整数据结构数据（9 章节、80+ 知识点、132+ 题）
  3. 注入 19 个代码案例资源到 guoketg
  4. 构建 Neo4j 知识图谱（PREREQUISITE + RELATED_TO 关系）
  5. 所有操作幂等（已存在则跳过）
- **README.md**：新增「种子数据」说明表格
- 保留 `scripts/seed_data_structures.py` 和 `app/scripts/seed_code_cases.py` 作为独立脚本（可用于重新注入）
---

## 2026-07-09 - 学习路径动态重排闭环

### 背景

学习路径页面虽然已有状态机、AI 生成和掌握度记录，但主创建入口仍走 `POST /path/init`，用户点击“AI生成路径”后实际得到的是固定顺序清单。学习/测评后也只推进到下一个 pending 节点，没有根据最新掌握度重新规划未完成路径。

### 变更

- `frontend/src/pages/LearningPathPage.tsx`
  - AI 创建入口改为 `POST /path/generate` → `POST /path/confirm` → `GET /path/state` 的完整链路，手动模式保留 `initPath`。
  - 路径总览新增“动态重排”按钮，调用 `POST /path/replan` 后刷新当前状态机。
- `frontend/src/api/path.ts`
  - 新增 `replanPath()` API 客户端。
  - `PathProgressResult` 和测评提交响应补充动态重排字段。
- `app/services/path_state_manager.py`
  - 新增 `replan_path()`，按最新 `KnowledgePointRecord` 的掌握度、连续错误、reviewing 状态动态重排未完成节点。
  - `update_progress()` 完成/跳过节点后先重排未完成节点，再激活新的焦点节点。
- `app/api/endpoints/path.py`
  - 新增 `POST /path/replan`，并记录 `PathHistory`。
  - 掌握度测评提交后自动触发当前活跃路径重排，并返回 `path_replanned/path_changed_count`。
- `request/prd-learning-path.md`
  - 更新 LP-27 状态：第一阶段动态重排闭环已完成并通过浏览器验证。

### 验证

- `docker-compose exec -T backend python -m py_compile app/services/path_state_manager.py app/api/endpoints/path.py` 通过。
- `npm run build` / `npx tsc --noEmit` 仍被既有问题阻塞：`src/components/KnowledgeGraphViz.tsx(355,61): Property 'radius' does not exist on type 'SimulationNodeDatum'`，非本次修改文件。
- Docker 已重启 `backend`、`frontend`。
- Playwright 使用 `guoketg / 123456` 登录，打开 `/path?view=overview&state=...`，点击“动态重排”，`POST /api/v1/path/replan` 返回 200，页面无白屏或控制台错误。截图：`test_script/screenshot-path-dynamic-replan.png`。

---

## 2026-07-09 - 学习路径高级动态策略

### 背景

在动态重排闭环基础上继续补齐“高级动态”：路径不能只根据分数排序，还需要能因为错题回退复习、因为已掌握跳过重复学习、因为前置知识未达标而锁定后续节点，并在练习提交后自动调整。

### 变更

- `app/services/path_state_manager.py`
  - `_build_dynamic_order()` 增加三类高级策略：
    - 回退：已完成节点若连续错误达到阈值、掌握度低于 60 或状态为 reviewing，则回退到复习队列。
    - 短路：掌握度达到 80 且练习量不少于 3 的节点自动标记为 done，避免重复学习。
    - 锁定/解锁：读取 Neo4j 前置关系，前置节点未完成且掌握度低于 70 时锁定后续节点；前置达标后自动释放。
  - `_activate_first_pending()` 支持 reviewing 作为新的学习焦点，locked 节点不会被激活。
- `app/api/endpoints/question_bank.py`
  - 单题提交和批量提交后自动触发当前活跃路径重排。
  - 连续错误达到阈值时，知识点状态进入 reviewing。
- `app/api/endpoints/path.py`
  - 掌握度测评后若连续错误达到阈值，状态进入 reviewing，并自动触发路径重排。
- `frontend/src/pages/LearningPathPage.tsx`
  - 总览图支持“回退复习”和“前置锁定”两种状态展示。
  - locked 节点不可点击进入学习详情，避免用户绕过前置条件。
- `request/prd-learning-path.md`
  - LP-27 更新为已完成/已通过，并记录高级动态规则。

### 验证

- `docker-compose exec -T backend python -m py_compile app/services/path_state_manager.py app/api/endpoints/path.py app/api/endpoints/question_bank.py` 通过。
- `npx tsc --noEmit --pretty false` 仍被既有问题阻塞：`src/components/KnowledgeGraphViz.tsx(355,61): Property 'radius' does not exist on type 'SimulationNodeDatum'`，非本次修改文件。
- Docker 已重启 `backend`、`frontend`。
- Playwright 使用 `guoketg / 123456` 登录，打开 `/path?view=overview&state=...`，点击“动态重排”，`POST /api/v1/path/replan` 返回 200，返回 `changed_count=53`，页面无白屏、无控制台错误。截图：`test_script/screenshot-path-advanced-dynamic.png`。

---

## 2026-07-09 - LeetBook 风格学习路径探索页

### 背景

用户希望学习路径改成类似 LeetBook 探索知识地图的体验：总览页按知识章节展示，点击“线性表”等知识点后进入独立章节详情页，详情页结构参考 LeetBook 书籍章节页。

### 变更

- `frontend/src/components/path/LeetBookExploreMap.tsx`
  - 新增探索知识地图组件：顶部路径进度、章节筛选、继续学习入口、按领域分组的知识点卡片。
  - 知识点卡片展示状态、掌握度、复习/锁定/学习中状态。
- `frontend/src/pages/KnowledgeLeetBookDetailPage.tsx`
  - 新增独立知识点详情页 `/path/knowledge/:pointId`。
  - 页面包含左侧路径目录、章节标题、掌握度指标、本章任务、学习内容、练习复盘和前后篇导航。
  - 空复习资料时展示生成引导，不伪造内容。
- `frontend/src/pages/LearningPathPage.tsx`
  - 路径总览渲染切换为探索知识地图。
  - 点击知识点跳转到 `/path/knowledge/{pointId}?state={stateId}`，例如“线性表定义”进入对应章节页。
- `frontend/src/App.tsx`
  - 注册 `path/knowledge/:pointId` 受保护路由。
- `request/prd-learning-path.md`
  - 新增 LP-29 状态记录。

### 验证

- `git diff --check` 通过。
- `npx tsc --noEmit --pretty false` 未发现本次新增文件错误；仍被既有问题阻塞：
  - `src/components/KnowledgeGraphViz.tsx(355,61): Property 'radius' does not exist on type 'SimulationNodeDatum'`
  - `src/components/MessageList.tsx(695,20): Cannot find name 'Link'`
- Docker 已重启 `frontend`。
- Playwright 使用 `guoketg / 123456` 登录，打开 `/path?view=overview&state=...`，确认“探索知识地图”渲染；点击“线性表定义”跳转到 `/path/knowledge/f5aae3af-3be6-4dbc-ab36-52132cc60968?state=...`，详情页包含“学习路径目录 / 本章任务 / 学习内容”，无控制台错误。截图：
  - `test_script/screenshot-path-leetbook-map.png`
  - `test_script/screenshot-path-leetbook-detail.png`

---

## 2026-07-09 - 数据结构阅读讲义与知识拔高

### 背景

用户希望学习路径中每个知识点的阅读讲义以公开数据结构复习资料为基础：基础讲解参考“数据结构与算法设计复习笔记”，知识拔高参考 CK_0ff 的“数据结构复习笔记”及其章节链接。

### 变更

- `app/services/knowledge_lecture_builder.py`
  - 新增数据结构讲义构建服务。
  - 按线性表、栈和队列、数组和广义表、树和二叉树、图、查找、排序等章节归类知识点。
  - 为每类知识点维护基础讲解要点、拔高角度、易错对比和参考链接。
- `app/api/endpoints/path.py`
  - `POST /path/knowledge/{point_id}/review-material` 从“通用复习资料”改为“阅读讲义”生成。
  - 有 DeepSeek/Qwen 配置时生成包含基础讲解、知识拔高、易错辨析、练习导向、自测清单、参考来源的 Markdown 讲义。
  - 无 DeepSeek/Qwen 配置时生成资料参考讲义，不再让阅读讲义完全空置。
  - 用户个人 API 配置优先，`.env` 全局配置作为兜底，但不修改 `.env`。
- `frontend/src/pages/KnowledgeLeetBookDetailPage.tsx`
  - “学习内容”改为“阅读讲义”，生成按钮改为“生成阅读讲义”。
  - 任务卡说明改为基础讲解、知识拔高和易错辨析。
- `frontend/src/pages/LearningPathPage.tsx`
  - 旧详情页的“AI复习”文案同步改为“阅读讲义”。
- `frontend/src/api/path.ts`
  - 讲义生成接口类型补充 `source_mode` 和 `message`。
- `request/prd-learning-path.md`
  - 新增 LP-30 状态记录。

### 验证

- `python -m py_compile app/services/knowledge_lecture_builder.py app/api/endpoints/path.py` 通过。
- `git diff --check` 通过。
- `npx tsc --noEmit --pretty false` 仍被既有问题阻塞：`src/components/KnowledgeGraphViz.tsx(355,61): Property 'radius' does not exist on type 'SimulationNodeDatum'`。
- Docker 已执行 `docker-compose up -d` 并重启 `backend`、`frontend`。
- Playwright 使用 `guoketg / 123456` 登录，打开 `/path?view=overview&state=...`，确认“探索知识地图”渲染；点击“线性表定义”进入 `/path/knowledge/f5aae3af-3be6-4dbc-ab36-52132cc60968?state=...`，点击“生成/更新阅读讲义”，`POST /api/v1/path/knowledge/{point_id}/review-material` 返回 200，页面包含“基础讲解 / 知识拔高 / 参考来源 / 线性表”，无控制台错误。截图：
  - `test_script/screenshot-lecture-map.png`
  - `test_script/screenshot-lecture-flow-generated.png`
  - `test_script/screenshot-lecture-direct-generated.png`

---

## 2026-07-10 - 图码来源数据结构代码题库

### 背景

用户希望将“数据结构过程推演题目”替换为来自图码（totuma.cn）的代码题，并按 LeetCode 学习计划式目录展示；题目详情参考图码算法页布局，交换代码区与可视化区，增加代码可视化编辑器、标准答案和右下角智能导师。

### 变更

- `app/seed_data/data_structures_seed.json`
  - 将“数据结构过程推演题库”替换为 58 道 `totuma_coding` 编程题。
  - 每题保留 `source_url`、图码来源标识、可视化初始状态、Python/C++ 标准答案。
- `app/scripts/build_totuma_coding_seed.py`
  - 新增可复用生成脚本，用稳定 UUID 从图码目录生成代码题 seed。
- `app/api/endpoints/coding.py` / `app/schemas/coding.py`
  - 编程题详情返回 `answer` 与 `source`。
  - 默认学科按“数据结构”名称解析，兼容新旧 seed 主键。
- `frontend/src/pages/CodingPracticePage.tsx`
  - 页面标题更新为“数据结构代码题库”，只加载 `source=totuma_coding`。
  - 自动选中第一题，接入数据结构笔记页同款右下角 AI 编程导师。
- `frontend/src/components/coding/ProblemTree.tsx`
  - 改为学习计划式章节目录：章节进度、知识点分组、题目状态与难度标签。
- `frontend/src/components/coding/CodePlayground.tsx`
  - 题目详情重排为左侧代码可视化编辑器、右侧代码/标准答案编辑器。
  - 支持编辑可视化 JSON、查看运行推演状态、切换标准答案。

### 验证

- `python -X utf8 -m py_compile app/schemas/coding.py app/api/endpoints/coding.py app/scripts/seed.py app/scripts/build_totuma_coding_seed.py` 通过。
- `git diff --check` 通过。
- `/api/v1/coding/tree?source=totuma_coding` 返回 8 个章节、58 道题；题目详情包含 `answer.standard_answer.python`。
- `npm run build` 仍被既有问题阻塞：
  - `src/components/KnowledgeGraphViz.tsx(355,61): Property 'radius' does not exist on type 'SimulationNodeDatum'`
  - `src/components/MermaidRenderer.tsx(2,21): Cannot find module 'mermaid'`
  - `src/components/path/LeetBookExploreMap.tsx(330,82): Cannot find name 'weak'`
- Docker 已执行 `docker-compose up -d` 并重启 `backend`、`frontend`。
- Playwright 使用 `guoketg / 123456` 登录，打开 `/coding-practice`，确认目录、图码来源、代码可视化编辑器、标准答案、来源链接、右下角 AI 编程导师均正常；Monaco 编辑器加载完成且无页面错误。截图：
  - `test_script/screenshot-totuma-coding-page.png`
  - `test_script/screenshot-totuma-coding-answer.png`
  - `test_script/screenshot-totuma-coding-agent.png`
  - `test_script/screenshot-totuma-coding-editor-loaded.png`

---

## 2026-07-10 - 数据结构代码题库目录页与 LeetCode 风格做题页

### 背景

用户希望点击题库里的“数据结构代码题库”后，先进入类似 LeetCode 学习计划的题目目录页；只有点击某道代码题后，才进入类似 LeetCode 题目详情的写代码界面。做题页需要把可视化编辑器放在题目介绍下面，并自动显示当前编辑代码的可视化结果。

### 变更

- `frontend/src/pages/CodingPracticePage.tsx`
  - `/coding-practice` 改为独立目录页，不再自动选中第一题。
  - 旧的 `?problem=` 参数会重定向到 `/coding-practice/problems/:problemId`。
  - 目录页中间展示学习计划式题目目录、章节数、知识点数、完成进度和搜索框。
- `frontend/src/App.tsx`
  - 注册 `/coding-practice/problems/:problemId` 受保护路由。
- `frontend/src/components/coding/ProblemTree.tsx`
  - 改为居中的学习计划目录样式：章节展开、知识点分组、题目状态、难度标签。
- `frontend/src/components/coding/CodePlayground.tsx`
  - 做题页改为左侧题面/可视化、右侧代码编辑器的分栏布局。
  - 可视化区放在题目介绍和示例下方，默认开启自动可视化，代码停顿后触发分析刷新画布。
  - 保留手动“运行可视化”、标准答案切换、完成记录提交。
- `frontend/src/components/coding/VisualizationCanvas.tsx` / `StepController.tsx`
  - 修复乱码文案和语法风险，增强数组、栈、队列、链表、树、图的画布渲染。
- `frontend/package.json` / `frontend/package-lock.json`
  - 补齐既有 `MermaidRenderer` 依赖的 `mermaid` 包，使前端构建可解析该模块。
- `frontend/src/components/KnowledgeGraphViz.tsx`
  - 修复 `forceCollide` 泛型缺失导致的 TypeScript 类型错误。
- `Dockerfile.backend`
  - 将 `BACKEND_PORT` 从 build arg 同步为运行时环境变量，修复重建后 uvicorn 端口参数为空的问题。

### 验证

- `npm run build` 通过。
- `npx tsc --noEmit --pretty false` 通过。
- 已执行 `docker-compose up -d --build frontend`、`docker-compose up -d --build backend`、`docker-compose restart frontend`，当前服务：
  - 前端：`http://localhost:3000`
  - 后端：`http://localhost:8000`
- Playwright 使用 `guoketg / 123456` 登录，完成完整链路：
  - 打开 `/coding-practice`，目录页加载 58 道题。
  - 点击第一道题跳转到 `/coding-practice/problems/d785f6d5-7b0e-5c7a-b61d-65d2314b222a`。
  - 做题页出现可视化区、运行按钮、Monaco 编辑器和 canvas，控制台/pageerror 错误数为 0。
  - 截图：
    - `test_script/screenshot-coding-directory.png`
    - `test_script/screenshot-coding-problem.png`

---

## 2026-07-10 - 做题页标签切换、测试结果与可视化同级化

### 背景

用户希望代码题详情进一步对齐力扣题目页：左侧需要支持“题目描述 / 题解 / 提交记录”的切换，并把“可视化编辑器”提升为同级标签；右侧代码区需要提供还原默认代码模板、全屏、运行与测试结果查看。可视化编辑器需要实时自动跟踪用户正在编辑的代码；编程语言选择只放在题解区域。

### 变更

- `frontend/src/components/coding/CodePlayground.tsx`
  - 左侧改为四个同级标签：题目描述、题解、提交记录、可视化编辑器。
  - 题解页内提供语言选择，并按当前语言展示标准答案；右侧代码区仅展示当前语言，不再放语言下拉。
  - 右侧代码工具条新增还原默认代码模板、全屏/退出全屏、测试结果开关、运行、提交。
  - 接入 `/api/v1/code/execute` 展示 stdout、stderr、退出码、耗时和示例输入/期望输出。
  - 提交后在“提交记录”标签展示本次练习记录。
  - 可视化分析不再依赖当前标签，代码变化后会自动跟踪刷新。
- `frontend/src/components/coding/VisualizationCanvas.tsx`
  - 清理中文乱码和空态文案，保留数组、栈、队列、链表、树、图的画布渲染。
- `frontend/src/components/coding/StepController.tsx`
  - 修复步骤控制按钮中文文案。
- `frontend/src/components/CodeEditor.tsx`
  - 修复 Monaco 加载态中文文案。
- `frontend/src/api/coding.ts`
  - 修复可视化分析接口失败时的中文错误提示。

### 验证

- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 在主体改动后通过；最后补充代码执行关闭的中文提示后，`npx tsc --noEmit --pretty false` 仍通过，重复构建在 Vite transform 阶段长时间无输出后已停止。
- `git diff --check` 通过，仅有 CRLF 换行提示。
- 已执行 `docker-compose restart frontend`，前端 `http://localhost:3000` 返回 200。
- Playwright 使用 `guoketg / 123456` 登录验证：
  - `/coding-practice` 加载 58 道题。
  - 点击第一题进入 `/coding-practice/problems/d785f6d5-7b0e-5c7a-b61d-65d2314b222a`。
  - “题目描述”页没有语言选择，“题解”页有 1 个语言选择。
  - “可视化编辑器”标签中 canvas 正常渲染。
  - 点击“运行”后测试结果面板显示中文提示：当前部署未开启代码执行安全沙箱。
  - 截图：`test_script/screenshot-coding-tabs-result.png`。

---

## 2026-07-10 - 知识图谱改为 GraphRAG 工作台布局

### 背景

知识图谱原页面采用纵向上传表单、图谱列表和全屏弹窗，图谱查看、材料导入与 RAG 问答之间需要频繁切换。此次参考 `GraphRAG-Example-master` 的工作台信息架构，将现有真实业务能力统一到固定顶栏、左侧工具区和右侧图谱画布中。

### 变更

- `frontend/src/pages/KnowledgeGraphPage.tsx`
  - 改为“图库 / 导入 / 问答”三标签侧栏与常驻 D3 图谱画布。
  - 页面加载后自动打开第一个可用图谱；切换图库时同步当前学科、节点和关系统计。
  - 保留真实列表、图谱、RAG SSE、异步构建进度、知识点导航和携带 `subjectId` 的学习路径跳转。
  - 文件选择器取消 `accept` 限制，改为 JavaScript 校验；旧版 DOC/PPT 显示中文另存提示。
- `frontend/src/pages/KnowledgeGraphPage.css`
  - 新增 GraphRAG 式固定顶栏、功能侧栏、全尺寸画布和响应式移动端布局。
- `app/api/endpoints/knowledge_graph.py`
  - 知识图谱构建从仅 PDF 扩展为 PDF、DOCX、PPTX。
  - DOCX 复用统一 Word 解析器，PPTX 按幻灯片抽取文本和表格，统一切分为 RAG 文本块。
  - 无有效文本、旧版 Office、超大文件和不支持格式均返回中文错误提示。
- `README.md`、`request/prd-learning-path.md`
  - 同步知识图谱工作台使用流程、文件格式和 LP-31 双格式状态记录。

### 验证

- `npx tsc` 已通过；完整 Vite 生产打包在项目整体 transform 阶段长时间无新输出后停止，未出现 TypeScript 或本次页面相关错误。
- `docker-compose up -d`、`docker-compose restart backend frontend` 已执行；前端 3000 端口和后端 API 均可访问。
- 容器内 `python -m py_compile app/api/endpoints/knowledge_graph.py` 通过；内存构造 DOCX/PPTX 后调用统一解析器均成功生成文本块。
- Playwright 使用 `guoketg / 123456` 完成真实用户链路：
  - `/knowledge-graph` 自动打开 1 个可用图谱，D3 画布渲染 57 个真实节点。
  - 图库、导入、问答三个标签正常；RAG 输入区正常显示。
  - 文件选择器无 `accept` 属性；选择旧版 DOC 后出现中文另存提示且构建按钮禁用。
  - 点击画布工具栏“生成学习路径”后进入 `/path?subjectId=d91a4645-ab5f-4819-8379-d9e6524f0937`。
  - 页面错误、知识图谱接口 5xx、浏览器控制台错误均为 0。
  - 截图：`test_script/screenshot-kg-workspace.png`、`test_script/screenshot-kg-import-legacy.png`、`test_script/screenshot-kg-chat.png`。

---

## 2026-07-10 - 数据结构代码练习改造为服务端 OJ 闭环

### 背景

原代码练习题面信息不足，学生读完题后缺少明确的实现入口；运行功能没有安全执行环境，提交结果由前端自行判断；可视化又会基于默认数据或延时分析自动生成，无法证明是当前代码的真实执行过程。此次参照主流在线判题流程，并使用牛客网与力扣公开题目的来源元数据，重建从读题、编写、运行到服务端提交的完整业务链路。

### 变更

- `app/seed_data/coding_oj_catalog.py` / `app/scripts/seed.py`
  - 建立 21 道来源可追溯的数据结构编程题：数组、单链表、栈、队列、哈希表、二叉树遍历、图共 7 个知识点，每点简单/中等/困难各 1 题。
  - 题目保存来源名称、题号、标题和原题链接；项目内独立编写学习目标、任务步骤、输入输出、样例、约束、边界条件、三级提示、`TODO` 模板和测试用例。
  - 使用稳定 ID 幂等同步题目及测试数据，归档旧的非精选编程题，避免同知识点同难度重复堆叠。
- `migrations/013_add_coding_judge.sql` / `app/db/migration_runner.py` / `app/main.py`
  - 新增编程题主知识点、公开/隐藏测试用例和唯一性约束。
  - 后端启动时自动、幂等应用所需版本化迁移，已有 Docker 数据卷无需手动执行 SQL。
- `app/api/endpoints/coding.py` / `app/services/code_judge.py`
  - 题目详情只返回结构化题面、代码模板和公开样例，不泄露隐藏测试及参考答案。
  - 新增公开运行、隐藏测试提交、分页提交记录和提交后查看参考解法接口。
  - 判题结果由服务端根据实际输出计算并保存，旧的客户端自报正确接口停用。
- `runner/sandbox_runner.py` / `Dockerfile.runner` / `docker-compose.yml`
  - 增加独立 Python 代码运行容器，后端通过共享 Unix Socket 调用。
  - 运行器禁用网络、使用只读根文件系统和临时目录，并限制 CPU、内存、进程数、文件与输出大小。
- `frontend/src/pages/CodingPracticePage.tsx` / `frontend/src/components/coding/CodePlayground.tsx`
  - 目录按知识点和简单/中等/困难组织，每知识点最多展示 3 题。
  - 做题页重构为结构化题面、递进提示、草稿自动保存、公开测试、隐藏提交、真实执行轨迹、提交记录和参考解法闭环。
  - 删除默认业务数据和定时自动生成的伪可视化；代码修改后旧判题结果和轨迹立即失效。
- `README.md` / `request/prd-6-question-bank-v4.md`
  - 补充代码练习流程、21 题范围、隔离运行器、Docker 自动迁移及 F20 双格式状态记录。

### 当前验收状态

- 功能代码已实现，PRD 的 F20 标记为 `completed: true`。
- 本轮自动化回归完成后仍需用户实际体验确认，因此暂记 `passed: false`，`user_feedback: null`；未使用伪造业务数据或预填验收结论。
