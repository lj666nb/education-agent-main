# 题库系统实施计划

> 基于 PRD-6 (v4.0)，将 F1~F14 拆分为独立可测的渐进式阶段。
> 每阶段依次实现 → 测试 → 验证，不跨阶段并行。

---

## 已完成的基线（Phase 0）

| 模块 | 完成度 |
|------|--------|
| 学科三级结构（Subject → Domain → Point） | PostgreSQL 模型 + CRUD API + Neo4j 同步 + React 树形页面 |
| Docker volume 挂载 | backend 代码修改后无需 rebuild |

---

## Phase 1：题目管理系统（核心 CRUD）

**预估工时：2~3 次会话**

### 1.1 题库（Question Bank）管理 — F2

```
/question-banks                    GET   列出我的题库
/question-banks                    POST  创建题库（绑定学科）
/question-banks/{id}               PUT   编辑题库
/question-banks/{id}               DELETE 删除题库
```

- 题库 = 用户的个人收藏/出题集合
- 归属当前用户（JWT）+ 绑定一个 Subject
- 前端：题库列表页（卡片式），与学科结构页面分开

### 1.2 题目 CRUD — F3 + F4

```
/question-banks/{bank_id}/questions   GET    分页+按类型/难度/标签筛选
/question-banks/{bank_id}/questions   POST   创建题目
/questions/{id}                       GET    题目详情
/questions/{id}                       PUT    编辑
/questions/{id}                       DELETE 删除
```

**PostgreSQL 模型 `Question`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| bank_id | FK | 所属题库 |
| question_type | enum | choice_single / choice_multi / fill / judge / short_answer / programming / essay |
| content | JSONB | 题干结构化内容（含选项、填空空位等） |
| difficulty | int(1-5) | 入门/基础/进阶/挑战/竞赛 |
| tags | String[] | 标签数组 |
| answer | Text | 标准答案 |
| explanation | Text | 解析 |
| ai_generated | bool | 是否 AI 生成 |
| source | String | 来源标记: "manual", "ai_chat", "import" |
| status | enum | draft / published / archived |

**前端：**
- 题目编辑器（区分不同类型渲染不同表单）
- 题目列表（分页、筛选器）
- 将已完成的 UniApp 答题组件迁移到 React

### 1.3 标签体系 — F5

- PostgreSQL tags 字段 + Neo4j Tag 节点
- 标签自动提取（从知识点关联派生）
- 前端：标签展示与管理

### 1.4 验收标准

- [ ] 创建题库 → 在题库下创建各类型题目 → 筛选/分页正常
- [ ] 题目支持全部 7 种题型
- [ ] 五级难度可设可显
- [ ] 标签可关联知识点
- [ ] Playwright 登录 guoketg 验证完整 CRUD 流程

---

## Phase 2：知识图谱强化

**预估工时：1~2 次会话**

### 2.1 题目入图 — F6 前置

- 在 Neo4j 创建 `:Question` 节点（uuid 引用）
- `[:TESTS]` 关系连接 Question → KnowledgePoint
- 在题目 CRUD 中自动同步 Neo4j

### 2.2 图谱浏览与关系管理

- 前置依赖 `[:PREREQUISITE]`（Point → Point）
- 相关关系 `[:RELATED_TO]`（Point → Point）
- 前端：知识点图谱可视化（Neo4j 的 d3/vis 简单集成）

### 2.3 错题推荐 — F7

- 用户答错后创建 `[:ANSWERED_WRONG]`（User → Question）
- 聚合为 `[:STRUGGLES_WITH]`（User → KnowledgePoint）
- Neo4j 路径查询：从薄弱知识点出发，找关联知识点下的题目
- 降级方案：PostgreSQL 标签匹配

### 2.4 验收标准

- [ ] 创建题目后 Neo4j 中可见 Question 节点
- [ ] 图谱关联页可浏览知识点间的 PREREQUISITE/RELATED_TO
- [ ] 错题推荐返回相关题目

---

## Phase 3：练习系统

**预估工时：2 次会话**

### 3.1 练习会话 — F8

```
/practice/sessions             POST   创建练习（选题库/知识点/难度/题数）
/practice/sessions/{id}        GET    练习详情（逐题进度）
/practice/sessions/{id}/submit POST   提交答案
```

- 前端：练习界面（逐题作答 → 提交 → 显示结果/解析）
- 进度条 + 颜色标记（正确绿/错误红/未答灰）
- 统计面板（正确率、用时、知识点分布）

### 3.2 练习记录 — F9 (P1)

- `practice_answers` 表记录每道题的答题详情
- 事件触发：`quiz:answer:submitted`
- MongoDB 记录详细行为日志（可选）

### 3.3 UniApp 答题页迁移

- 将 `题库前端/src/pages/question/index.vue` 的答题交互迁移至 React
- 保留：逐题切换、答案提交、对错反馈

### 3.4 验收标准

- [ ] 创建练习 → 答题 → 提交 → 显示结果
- [ ] 正确率统计展示
- [ ] 错题自动记录

---

## Phase 4：AI Chat 联动

**预估工时：2~3 次会话**

### 4.1 画像实时联动 — F10

- `POST /internal/profile/analyze-chat` — Chat 服务异步调用
- 解析用户提问 → 提取知识点 → 更新 Neo4j `[:ASKED_ABOUT]` 关系
- Redis 缓存薄弱点快照
- 前端：Chat 侧边栏显示薄弱点小徽章

### 4.2 对话生成题目 — F11

- `POST /question-bank/generate/from-chat` — 从对话上下文生成
- 调用多智能体出题流程 → 写入题库 → 标记 `source:ai_chat`
- 前端：Chat 回复中嵌入"已生成题目"卡片
- 浮动工具栏"根据此内容生成题目"

### 4.3 题目即席答疑 — F12 (P1)

- `POST /questions/{id}/ask` 流式 SSE 答疑
- 不持久化对话（前端维护 history）
- 前端：浮动答疑窗口（迁移 UniApp 的 ChatPanel 组件）

### 4.4 验收标准

- [ ] Chat 提问后画像更新
- [ ] Chat 中可触发生成题目
- [ ] 题目页开启答疑窗口正常对话

---

## Phase 5：完善收尾

**预估工时：1 次会话**

### 5.1 题目质量审核 — F13 (P1)

- AI 自动审核（批量检查题目质量）
- 人工标记（好题/问题题/已废弃）

### 5.2 批量导入导出 — F14 (P2)

- JSON/Markdown 导入导出
- 保留标签与知识点关联

### 5.3 前端迁移收尾

- 迁移 UniApp 剩余页面（历史记录、画像设置）
- 确认所有页面有返回首页
- 中文错误提示

---

## 依赖关系图

```
Phase 1 (题目CRUD) ──────────────────────────┐
     │                                        │
     ▼                                        ▼
Phase 2 (图谱强化) ───→ Phase 3 (练习系统) ──→ Phase 4 (AI联动)
                          │                      │
                          ▼                      ▼
                     Phase 5 (完善) ←────────────┘
```

- **Phase 1** 是其余所有功能的基础（没题目啥都做不了）
- **Phase 2** 依赖 Phase 1（题目入图），是推荐和图谱的基础
- **Phase 3** 依赖 Phase 1（有题目才能练），与 Phase 2 可独立
- **Phase 4** 依赖 Phase 1（题目存在）和已有 Chat 系统
- **Phase 5** 最后收尾

---

## 风险与建议

1. **Neo4j 连接稳定性** — 所有与 Neo4j 的同步都加了 try/except，失败不影响主流程
2. **UniApp 迁移** — 建议 Phase 1 时优先迁移答题交互组件（最核心），其余组件逐步迁移
3. **阶段可调** — 每个阶段完成后你有机会调整方向、增减范围
