# 用户画像存储设计文档

**版本**：v1.0
**更新日期**：2026-05-11
**状态**：已实现

---

## 1. 系统概述

用户画像（Student Profile）是一个多维度、动态更新的学生学习特征数据系统。本系统采用**多数据库混合存储**架构，根据数据特性选择最适合的存储引擎：

| 存储引擎 | 用途 |
|---------|------|
| **Neo4j** | 知识图谱、认知风格、易错点（关系型图数据） |
| **MongoDB** | 学习维度、行为事件、时间线（文档型数据） |
| **PostgreSQL (pgvector)** | 用户向量偏好（向量检索） |
| **Redis** | 短时会话状态（实时缓存） |

---

## 2. 数据存储架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户画像系统                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │   Neo4j     │    │  MongoDB    │    │  PostgreSQL     │ │
│  │  (图数据库)  │    │ (文档数据库) │    │   (pgvector)   │ │
│  ├─────────────┤    ├─────────────┤    ├─────────────────┤ │
│  │ · 知识点     │    │ · 学习维度   │    │ · 偏好向量      │ │
│  │ · 认知风格   │    │ · 行为事件   │    │ · 多模态偏好    │ │
│  │ · 易错点     │    │ · 时间线     │    │                 │ │
│  └─────────────┘    └─────────────┘    └─────────────────┘ │
│                                                             │
│            ┌─────────────────────────────────────┐          │
│            │              Redis                    │          │
│            │  (短时缓存：当前模块、认知负荷等)      │          │
│            └─────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 存储责任矩阵

| 数据类型 | 存储引擎 | 说明 |
|---------|---------|------|
| 知识掌握度 | Neo4j | 图关系存储学生与知识点的掌握关系 |
| 认知风格 | Neo4j | 节点关系存储视觉/听觉/读写/动觉/混合 |
| 易错点 | Neo4j | 图关系存储学生的薄弱知识点 |
| 学习时段 | MongoDB | 文档存储各时段学习占比 |
| 学习节奏 | MongoDB | 标量和趋势数据 |
| 元认知校准度 | MongoDB | 自评与实际差距的滑动平均值 |
| 注意力特征 | MongoDB | 基于失焦事件的累积值 |
| 行为事件 | MongoDB | 页面交互、答题等事件日志 |
| 时间线 | MongoDB | 画像变更历史记录 |
| 多模态偏好向量 | PostgreSQL | 512维向量，存储文档/视频/音频偏好 |
| 当前模块 | Redis | 实时缓存当前学习模块 |
| 近期答题序列 | Redis | 最近5题正误序列 |
| 认知负荷 | Redis | low/medium/high |
| 注意力漂移计数 | Redis | 当前会话失焦次数 |

---

## 3. Neo4j 存储设计

### 3.1 图模型

```
        ┌──────────────────────────────────────────────────────────┐
        │                        Neo4j                            │
        │                                                        │
        │    (Student)                                          │
        │        │                                              │
        │        ├──► (CognitiveStyle)                          │
        │        │         type: visual/auditory/                │
        │        │              reading_writing/                 │
        │        │              kinesthetic/mixed                │
        │        │                                              │
        │        ├──► (KnowledgePoint) ─── MASTERS ──► 掌握度    │
        │        │                              score: 0.0-1.0  │
        │        │                              confidence       │
        │        │                                              │
        │        └──► (Topic) ─────── ERROR_PRONE ──► 易错记录  │
        │                              error_count              │
        │                                                        │
        └──────────────────────────────────────────────────────────┘
```

### 3.2 节点类型

#### Student（学生节点）
```cypher
// 属性
student_id: String (唯一标识，对应用户UUID)
```

#### KnowledgePoint（知识点节点）
```cypher
// 属性
name: String (知识点名称，如"高等数学-极限"）
```

#### CognitiveStyle（认知风格节点）
```cypher
// 属性
type: String (枚举值)
  - visual: 视觉型
  - auditory: 听觉型
  - reading_writing: 读写型
  - kinesthetic: 动觉型
  - mixed: 混合型
```

#### Topic（易错点节点）
```cypher
// 属性
name: String (易错点名称)
```

### 3.3 关系类型

| 关系 | 方向 | 属性 | 说明 |
|------|------|------|------|
| `MASTERS` | Student → KnowledgePoint | `score`, `confidence`, `last_updated` | 掌握程度 |
| `HAS_STYLE` | Student → CognitiveStyle | `confidence`, `last_updated` | 认知风格 |
| `ERROR_PRONE` | Student → Topic | `error_count`, `last_updated` | 易错记录 |

### 3.4 Cypher 示例

**创建学生节点并设置认知风格：**
```cypher
MATCH (s:Student {student_id: $student_id})
MERGE (s)-[r:HAS_STYLE]->(c:CognitiveStyle {type: $style_type})
SET r.confidence = $confidence,
    r.last_updated = datetime()
RETURN r
```

**添加知识点掌握度：**
```cypher
MATCH (s:Student {student_id: $student_id})
MERGE (s)-[r:MASTERS]->(k:KnowledgePoint {name: $knowledge_point})
SET r.score = $score,
    r.confidence = $confidence,
    r.last_updated = datetime()
RETURN r
```

**查询学生画像数据：**
```cypher
// 获取所有相关信息
MATCH (s:Student {student_id: $student_id})
OPTIONAL MATCH (s)-[r1:MASTERS]->(k:KnowledgePoint)
OPTIONAL MATCH (s)-[r2:HAS_STYLE]->(c:CognitiveStyle)
OPTIONAL MATCH (s)-[r3:ERROR_PRONE]->(t:Topic)
RETURN
  collect({kp: k.name, score: r1.score, confidence: r1.confidence}) as knowledge_mastery,
  c.type as cognitive_style_type,
  collect({topic: t.name, error_count: r3.error_count}) as error_prone_topics
```

---

## 4. MongoDB 存储设计

### 4.1 集合结构

#### student_profiles（学生画像集合）

```json
{
  "_id": ObjectId,
  "student_id": "uuid-string",
  "dimensions": {
    "active_hours": {
      "morning": 0.25,
      "afternoon": 0.25,
      "evening": 0.25,
      "night": 0.25
    },
    "learning_rhythm": {
      "scalar": 0.5,
      "trend": 0.0
    },
    "metacognitive_calibration": 0.0,
    "attention_feature": 0.5
  },
  "timeline": [
    {
      "event_id": "uuid",
      "event_type": "profile_update",
      "event_data": {...},
      "timestamp": ISODate
    }
  ],
  "created_at": ISODate,
  "updated_at": ISODate
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `student_id` | String | 学生唯一标识 |
| `dimensions.active_hours` | Object | 学习活跃时段分布（0-1之间） |
| `dimensions.learning_rhythm.scalar` | Float | 学习节奏标量（0-1） |
| `dimensions.learning_rhythm.trend` | Float | 学习趋势（-1到1） |
| `dimensions.metacognitive_calibration` | Float | 元认知校准度（-1到1） |
| `dimensions.attention_feature` | Float | 注意力特征（0到1，越高越易分心） |
| `timeline` | Array | 画像变更时间线 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

#### behavior_events（行为事件集合）

```json
{
  "_id": ObjectId,
  "student_id": "uuid-string",
  "event_type": "page_view|quiz_answer|search|...",
  "event_data": {
    "page": "/chat",
    "duration": 120,
    "question_id": "...",
    "correct": true
  },
  "timestamp": ISODate
}
```

**索引设计：**
```python
student_profiles.create_index([("student_id", ASCENDING)], unique=True)
behavior_events.create_index([("student_id", ASCENDING), ("timestamp", DESCENDING)])
behavior_events.create_index([("student_id", ASCENDING), ("event_type", ASCENDING)])
```

### 4.2 学习维度详解

#### active_hours（学习活跃时段）
```python
{
    "morning": 0.25,    # 6:00-12:00 学习占比 25%
    "afternoon": 0.25,  # 12:00-18:00 学习占比 25%
    "evening": 0.25,    # 18:00-22:00 学习占比 25%
    "night": 0.25       # 22:00-6:00 学习占比 25%
}
# 约束：四个值之和 = 1.0
```

#### learning_rhythm（学习节奏）
```python
{
    "scalar": 0.5,     # 学习速度标量，0=极慢，1=极快
    "trend": 0.0       # 趋势，-1=减速，0=稳定，+1=加速
}
```

#### metacognitive_calibration（元认知校准度）
```python
# 范围：-1 到 +1
# -1: 严重高估自己（实际很差但觉得自己很强）
#  0: 准确评估
# +1: 严重低估自己（实际很强但觉得自己很差）
# 计算方式：(自评分数 - 实际分数) 的滑动平均值
```

#### attention_feature（注意力特征）
```python
# 范围：0 到 1
# 0: 注意力非常集中
# 1: 非常容易分心
# 基于失焦事件次数和页面空闲时间累积计算
```

---

## 5. PostgreSQL (pgvector) 存储设计

### 5.1 表结构

```sql
CREATE TABLE student_preference_vectors (
    id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL UNIQUE,
    preference_vector TEXT,  -- JSON 格式存储 512 维向量
    multimodal_preference TEXT,  -- JSON 格式存储多模态偏好
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 可选：创建向量相似度索引
-- CREATE INDEX idx_preference_vector ON student_preference_vectors
-- USING ivfflat (preference_vector vector_cosine_ops);
```

### 5.2 向量说明

```python
preference_vector: List[float]  # 512 维浮点数向量
    # 索引 0-127: 文档偏好
    # 索引 128-255: 视频偏好
    # 索引 256-383: 音频偏好
    # 索引 384-511: 练习偏好

multimodal_preference: {
    "document": 0.8,   # 文档偏好权重
    "video": 0.6,      # 视频偏好权重
    "audio": 0.4,      # 音频偏好权重
    "exercise": 0.7    # 练习偏好权重
}
```

---

## 6. Redis 缓存设计

### 6.1 键设计

| 键模式 | 类型 | 说明 | TTL |
|-------|------|------|-----|
| `session:{student_id}:current_module` | String | 当前学习模块 | 2小时 |
| `session:{student_id}:recent_answers` | List | 最近5题正误 | 1小时 |
| `session:{student_id}:cognitive_load` | String | 认知负荷状态 | 30分钟 |
| `session:{student_id}:attention_drift_cnt` | String | 失焦次数 | 会话结束 |
| `login_fail:{username}` | String | 登录失败计数 | 15分钟 |

### 6.2 使用场景

```python
# 当前模块追踪
redis.set(f"session:{student_id}:current_module", "高等数学-第一章")

# 答题序列更新（保留最近5条）
redis.lpush(f"session:{student_id}:recent_answers", json.dumps({"q_id": "xxx", "correct": True}))
redis.ltrim(f"session:{student_id}:recent_answers", 0, 4)

# 认知负荷评估
redis.set(f"session:{student_id}:cognitive_load", "medium", ex=1800)
```

---

## 7. API 接口设计

### 7.1 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/profile/v2` | 创建画像 |
| GET | `/api/v1/profile/v2` | 获取完整画像 |
| GET | `/api/v1/profile/v2/summary` | 获取画像摘要 |
| PUT | `/api/v1/profile/v2` | 更新画像维度 |
| DELETE | `/api/v1/profile/v2` | 删除画像 |
| POST | `/api/v1/profile/v2/knowledge` | 添加知识点 |
| PUT | `/api/v1/profile/v2/knowledge` | 更新知识点 |
| DELETE | `/api/v1/profile/v2/knowledge/{kp}` | 删除知识点 |
| POST | `/api/v1/profile/v2/error-prone` | 添加易错点 |
| POST | `/api/v1/profile/v2/behavior` | 记录行为事件 |
| GET | `/api/v1/profile/v2/timeline` | 获取时间线 |
| GET | `/api/v1/profile/v2/behavior` | 获取行为事件 |

### 7.2 请求/响应示例

**POST `/api/v1/profile/v2` - 创建画像**

Request:
```json
{
  "cognitive_style": "visual",
  "cognitive_style_confidence": 0.7,
  "active_hours": {
    "morning": 0.3,
    "afternoon": 0.3,
    "evening": 0.3,
    "night": 0.1
  },
  "learning_rhythm_scalar": 0.6,
  "learning_rhythm_trend": 0.1,
  "metacognitive_calibration": 0.1,
  "attention_feature": 0.3,
  "knowledge_points": [
    {"knowledge_point": "高等数学-极限", "score": 0.8, "confidence": 0.9}
  ]
}
```

Response:
```json
{
  "message": "画像创建成功"
}
```

**GET `/api/v1/profile/v2` - 获取完整画像**

Response:
```json
{
  "student_id": "550e8400-e29b-41d4-a716-446655440000",
  "knowledge_mastery": [
    {
      "knowledge_point": "高等数学-极限",
      "score": 0.8,
      "confidence": 0.9,
      "last_updated": "2026-05-11T10:30:00"
    }
  ],
  "cognitive_style": {
    "style_type": "visual",
    "confidence": 0.7,
    "last_updated": "2026-05-11T10:30:00"
  },
  "error_prone_topics": [
    {
      "topic": "积分计算",
      "error_count": 3,
      "last_updated": "2026-05-10T15:20:00"
    }
  ],
  "active_hours": {
    "morning": 0.3,
    "afternoon": 0.3,
    "evening": 0.3,
    "night": 0.1
  },
  "learning_rhythm": {
    "scalar": 0.6,
    "trend": 0.1
  },
  "metacognitive_calibration": 0.1,
  "attention_feature": 0.3,
  "created_at": "2026-05-11T10:00:00",
  "updated_at": "2026-05-11T10:30:00"
}
```

---

## 8. 数据流设计

### 8.1 画像创建流程

```
用户注册
    │
    ▼
对话式初始化（ChatPage）
    │ 收集：专业/年级/学习目标/认知风格
    ▼
API: POST /api/v1/profile/v2
    │
    ├──► Neo4j: 创建学生节点 + 认知风格关系
    ├──► MongoDB: 创建画像文档 + 初始维度
    └──► PostgreSQL: 创建偏好向量（可选）
    │
    ▼
返回成功响应
```

### 8.2 行为事件记录流程

```
用户行为（答题/页面访问/搜索）
    │
    ▼
API: POST /api/v1/profile/v2/behavior
    │
    ▼
MongoDB: 写入 behavior_events 集合
    │
    ├──► 同步更新 timeline
    └──► 触发 Redis 缓存更新
    │
    ▼
可选：LangGraph Profile Agent 消费事件
    │ 累积信号达到阈值后
    ▼
更新 Neo4j（知识点/易错点）
```

### 8.3 画像查询流程

```
API: GET /api/v1/profile/v2
    │
    ├──► Neo4j: 查询知识掌握度 + 认知风格 + 易错点
    │
    ├──► MongoDB: 查询学习维度 + 时间线
    │
    └──► 聚合返回完整画像
```

---

## 9. 关键代码实现

### 9.1 ProfileCRUD 类

```python
class ProfileCRUD:
    def __init__(self, neo4j: Neo4jConnection, mongodb: MongoDBConnection):
        self.neo4j = neo4j
        self.mongodb = mongodb

    def create_profile(self, request: ProfileCreateRequest) -> bool:
        # 1. 创建 Neo4j 学生节点
        self.neo4j.create_student_node(request.student_id)

        # 2. 设置认知风格
        if request.cognitive_style:
            self.neo4j.set_cognitive_style(
                request.student_id,
                request.cognitive_style.value,
                request.cognitive_style_confidence
            )

        # 3. 添加知识点掌握度
        if request.knowledge_points:
            for kp in request.knowledge_points:
                self.neo4j.add_knowledge_mastery(
                    request.student_id,
                    kp["knowledge_point"],
                    kp.get("score", 0.0),
                    kp.get("confidence", 0.3)
                )

        # 4. 创建 MongoDB 画像文档
        self.mongodb.create_student_profile(
            student_id=request.student_id,
            active_hours=request.active_hours,
            learning_rhythm_scalar=request.learning_rhythm_scalar,
            learning_rhythm_trend=request.learning_rhythm_trend,
            metacognitive_calibration=request.metacognitive_calibration,
            attention_feature=request.attention_feature
        )

        return True
```

---

## 10. 与其他系统的关联

### 10.1 依赖关系

```
用户画像系统
    │
    ├──► 依赖：用户认证系统（获取 student_id）
    ├──► 依赖：DeepSeek API（对话式初始化）
    │
    └──► 被依赖：
            ├── Chat Agent（查询用户画像个性化回复）
            ├── RAG 系统（查询用户偏好过滤资源）
            └── 推荐系统（向量相似度匹配）
```

### 10.2 数据共享

| 消费者 | 使用数据 |
|--------|---------|
| Chat Agent | 认知风格、学习目标、知识点掌握度 |
| RAG | 用户画像上下文 |
| 推荐系统 | 偏好向量 |

---

## 11. 安全与隐私

### 11.1 数据隔离
- 每个学生的画像数据通过 `student_id` 严格隔离
- API 请求需要 JWT Token 认证
- 只能访问当前登录用户自己的画像

### 11.2 敏感信息
- 画像数据仅包含学习相关特征，不包含真实姓名、身份证等敏感信息
- 用户可自主删除自己的画像数据

---

## 12. 未来优化方向

1. **LangGraph Profile Agent**：实现信号累积触发的自动化画像更新
2. **向量索引优化**：为 pgvector 添加 IVF 索引提升相似度查询性能
3. **实时推送**：通过 WebSocket 推送画像变更通知
4. **数据分析**：聚合统计所有学生的学习特征分布

---

## 附录：数据库连接配置

```python
# Neo4j 配置
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=12345678

# MongoDB 配置
MONGODB_HOST=mongodb
MONGODB_PORT=27017
MONGODB_USER=root
MONGODB_PASSWORD=123456
MONGODB_DB=education_agent

# PostgreSQL 配置（pgvector）
POSTGRES_SERVER=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=education_agent
POSTGRES_PORT=5432

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
```
