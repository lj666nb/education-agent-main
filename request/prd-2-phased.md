# PRD-2 阶段化实施计划

## 概述

本文档将 PRD-2（学习画像构建与动态维护系统）拆分为4个阶段，逐步实施。

**当前组件状态：**
- ✅ PostgreSQL - 已安装
- ✅ Redis - 已安装
- ✅ Neo4j - 已安装
- ✅ MongoDB - 已安装
- ❌ ~~Milvus~~ - 版本冲突，放弃。使用 **pgvector** (PostgreSQL 扩展) 替代

---

## 存储方案变更

| 原设计 | 变更后 | 说明 |
|--------|--------|------|
| Milvus (偏好向量) | PostgreSQL + pgvector | 利用现有 PostgreSQL，无需额外组件 |

---

## 阶段划分总览

| 阶段 | 名称 | 前置依赖 | 优先级 |
|------|------|----------|--------|
| P0 | 画像数据模型与存储层 | Neo4j + MongoDB + pgvector | P0 |
| P1 | 画像初始化（对话式构建） | P0 | P0 |
| P2 | 轻量行为事件采集 | P1 | P1 |
| P3 | Profile Agent 信号累积 | P2 | P1 |

---

## 阶段 0：画像数据模型与存储层

**前置依赖**：Neo4j, MongoDB, pgvector

**目标**：建立画像的底层数据结构，不涉及业务逻辑

### 0.1 画像维度定义（8维）

| 维度 | 类型 | 存储引擎 |
|------|------|----------|
| 知识基础 | 知识点-掌握度映射 | Neo4j |
| 认知风格 | 枚举+置信度 | Neo4j |
| 易错点偏好 | 知识点标签聚类 | Neo4j |
| 多模态偏好 | 向量 (512维) | PostgreSQL + pgvector |
| 学习活跃时段 | 时段概率分布 | MongoDB |
| 学习节奏 | 标量+趋势 | MongoDB |
| 元认知校准度 | 偏差值 (-1到+1) | MongoDB |
| 注意力特征 | 标量 | MongoDB |

### 0.2 存储结构设计

```
Neo4j:
  - (:Student {student_id}) -[:MASTERS]-> (:KnowledgePoint {score, confidence, last_updated})
  - (:Student) -[:HAS_STYLE]-> (:CognitiveStyle {type, confidence})

PostgreSQL + pgvector:
  - student_preference_vectors (id, student_id, preference_vector vector(512), created_at)

MongoDB:
  - student_profiles (student_id, dimensions: {...}, timeline: [...])
  - behavior_events (student_id, event_type, event_data, timestamp)

Redis:
  - session:{student_id} (current_module, recent_answers, cognitive_load, attention_drift)
```

### 0.3 实施任务

- [ ] 安装 pgvector (PostgreSQL 扩展)
- [ ] 编写 Neo4j 连接配置
- [ ] 编写 MongoDB 连接配置
- [ ] 编写 pgvector 配置
- [ ] 创建 Neo4j 节点和关系模型
- [ ] 创建 pgvector 表
- [ ] 创建 MongoDB Collections 和索引
- [ ] 编写 CRUD 操作封装

### 0.4 验收标准

- [ ] 可连接 Neo4j, MongoDB, PostgreSQL (pgvector)
- [ ] 可创建/读取/更新/删除学生画像数据
- [ ] 数据隔离（按 student_id）

---

## 阶段 1：画像初始化（对话式构建）

**前置依赖**：P0 完成

**目标**：新用户通过3-5轮对话初始化8维画像

### 1.1 对话引导流程

```
1. 背景收集 -> 提取: 专业、年级
2. 目标明确 -> 提取: 学习目标类型
3. 基础探测 -> 提取: 自述掌握/薄弱知识点
4. 偏好挖掘 -> 提取: 多模态偏好
5. 风格测试 -> 提取: 认知风格
```

### 1.2 信息抽取规则

- 使用 LLM 从对话中抽取画像维度
- 知识点对齐课程知识图谱
- 预设默认值（置信度 0.3）

### 1.3 实施任务

- [ ] 设计对话模板
- [ ] 编写 LLM 抽取逻辑
- [ ] 实现画像初始化 API
- [ ] 前端对话界面开发
- [ ] 画像展示卡片（雷达图/热力图）

### 1.4 验收标准

- [ ] 3-5轮对话生成8维画像
- [ ] 画像数据写入 Neo4j/MongoDB/pgvector
- [ ] 前端展示画像卡片

---

## 阶段 2：轻量行为事件采集

**前置依赖**：P1 完成

**目标**：采集无视频事件的学习行为，触发画像更新信号

### 2.1 行为事件列表

| 事件 | 采集方式 | 信号 |
|------|----------|------|
| 文档阅读 >30秒 | 页面卸载事件 | exposure +1, engagement +2 |
| 收藏/下载资源 | 按钮点击 | 偏好信号 +1 |
| 完成练习题 | 答题提交 | mastery_boost +3 / weak_point +5 |
| 修改答案 | 答题提交 | metacognitive +2 |
| 搜索/提问 | 对话记录 | attention_hotspot |
| 自评打分 | 弹窗反馈 | 元认知校准更新 |
| 页面失焦 | visibilitychange | attention_drift +1 |
| 长时间无操作 | 空闲检测 | idle +2 |
| 登录时间 | 时间戳 | 活跃时段更新 |

### 2.2 实施任务

- [ ] 埋点SDK（前端事件采集）
- [ ] 事件 API 接口
- [ ] 信号生成逻辑
- [ ] 行为日志存储

### 2.3 验收标准

- [ ] 事件采集并存储到 MongoDB
- [ ] 信号生成并缓存到 Redis
- [ ] 前端时间线展示

---

## 阶段 3：Profile Agent 信号累积

**前置依赖**：P2 完成

**目标**：实现"信号累积->阈值触发->正式更新"机制

### 3.1 累积与触发规则

| 信号类型 | 阈值 | 触发动作 |
|----------|------|----------|
| weak_point (同一知识点) | ≥15 | 掌握度-5, 置信度→0.8, 触发补救资源 |
| 视频偏好 | ≥8 | 多模态偏好向量更新 |
| attention_drift (单会话) | ≥5 | cognitive_load=high, 暂停高难度内容 |

### 3.2 实施任务

- [ ] 信号累积逻辑
- [ ] 阈值触发器
- [ ] 画像更新逻辑
- [ ] 资源推荐联动
- [ ] 前端可解释性时间线

### 3.3 验收标准

- [ ] 答错3次后知识点掌握度下降
- [ ] 画像变更可追溯到具体事件
- [ ] 推荐内容随画像变化

---

## 组件安装参考

### pgvector (PostgreSQL 扩展)

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建偏好向量表
CREATE TABLE student_preference_vectors (
    id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL,
    preference_vector vector(512),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_preference_student ON student_preference_vectors(student_id);
```

### Neo4j

```bash
# Docker 启动
docker run -d --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

### MongoDB

```bash
# Docker 启动
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest
```

---

## 下一步行动

1. 安装 pgvector: `pip install pgvector psycopg2-binary`
2. 验证组件连接
3. 开始 **阶段 0** 实施

---

## pgvector 说明

pgvector 是 PostgreSQL 的向量扩展，适合存储 512 维偏好向量，优点：
- 无需额外组件，复用现有 PostgreSQL
- 支持余弦相似度查询
- 安装简单：`CREATE EXTENSION vector`

---

*文档版本: v1.1*
*更新日期: 2026-05-07*
*变更: Milvus 替换为 pgvector*
