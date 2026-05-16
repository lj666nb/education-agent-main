# prd1-多用户信息维护系统
---
以下是一份可直接交付开发Agent实现的PRD规格说明书，详细描述了多用户信息维护系统的完整设计。

## PRD-001：多用户信息维护系统

**版本**：v1.0
**优先级**：P0（基础架构）
**关联系统**：所有微服务、Profile Agent、Auth Gateway、Event Bus
**关联PRD**：PRD-003（画像动态微调系统）

---

## AI 状态维护表（人类可读版）

| 功能编号 | 功能描述 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|---------|------|
| user_registration | 用户注册（用户名、密码、邮箱、专业） | ✅ 是 | ✅ 是 | - | 已完成字段验证和密码加密 |
| user_login | 用户登录（JWT令牌认证） | ✅ 是 | ✅ 是 | - | 已完成AccessToken和RefreshToken机制 |
| user_logout | 用户登出 | ✅ 是 | ✅ 是 | - | 已完成 |
| user_info_update | 用户信息修改 | ✅ 是 | ✅ 是 | - | 已完成 |
| account_deletion | 账户注销（数据删除） | ✅ 是 | ✅ 是 | - | 已完成，数据物理删除 |
| login_failure_lock | 登录失败锁定（5次后锁定15分钟） | ✅ 是 | ✅ 是 | - | 已完成Redis计数 |
| admin_user_management | 管理员用户管理（查看、删除用户） | ✅ 是 | ✅ 是 | - | 已完成 |
| jwt_refresh | JWT令牌刷新机制 | ✅ 是 | ✅ 是 | - | 已完成RefreshToken 7天过期 |
| multi_user_isolation | 多用户数据隔离 | ✅ 是 | ✅ 是 | - | 已完成，按student_id隔离 |

---

## AI 状态维护表（JSON版）

```json
{
  "ai_status": {
    "user_registration": {
      "description": "用户注册（用户名、密码、邮箱、专业）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成字段验证和密码加密"
    },
    "user_login": {
      "description": "用户登录（JWT令牌认证）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成AccessToken和RefreshToken机制"
    },
    "user_logout": {
      "description": "用户登出",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成"
    },
    "user_info_update": {
      "description": "用户信息修改",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成"
    },
    "account_deletion": {
      "description": "账户注销（数据删除）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成，数据物理删除"
    },
    "login_failure_lock": {
      "description": "登录失败锁定（5次后锁定15分钟）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成Redis计数"
    },
    "admin_user_management": {
      "description": "管理员用户管理（查看、删除用户）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成"
    },
    "jwt_refresh": {
      "description": "JWT令牌刷新机制",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成RefreshToken 7天过期"
    },
    "multi_user_isolation": {
      "description": "多用户数据隔离",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成，按student_id隔离"
    }
  }
}
```

---

### 1. 功能概述

本系统需要支持多用户并发访问，为每位学生提供隔离且个性化的学习体验。核心职责包括：

- 用户账号生命周期管理（注册、登录、信息修改、注销）
- 多类型用户数据的物理分离存储（基础信息、学习画像、行为日志、会话状态）
- 以全局唯一 `student_id` 串联所有存储系统
- 实现数据隔离，保证 A 用户无法访问 B 用户的任何私有数据
- 满足安全合规要求（密码加密、敏感信息脱敏、会话鉴权）

**设计原则**：
- **冷热分离**：高频读写会话数据进缓存；稳定画像进专用数据库；流水日志单独归档。
- **职责分离**：关系型数据库只管账号和静态属性；图库和向量库管关系与偏好；Redis管实时状态。
- **统一身份**：所有数据通过 UUID 格式的 `student_id` 关联，该ID由系统在注册时生成，永不改变。

---

### 2. 用户信息分类与存储方案

| 数据类别 | 数据实体 | 存储引擎 | 说明 |
|----------|----------|----------|------|
| 用户账号与基础信息 | `User` | PostgreSQL | 登录凭证、专业、年级、联系方式等结构化字段 |
| 学习画像（长效） | `StudentProfile`（知识点掌握、偏好向量、认知风格等） | Neo4j + Milvus/pgvector | 知识图谱关系 + 高维向量搜索 |
| 短时会话状态 | `SessionProfile` | Redis Hash | 当前模块、认知负荷、最近答题记录，TTL 2小时 |
| 行为事件流水 | `LearningEvent` | MongoDB | 埋点原始事件，用于审计、回放、离线分析 |
| 系统资源与课程 | `Course`, `KnowledgePoint`, `Resource` | PostgreSQL + Neo4j | 课程结构和知识点关系进Neo4j，元数据进PG |

---

### 3. 用户账户模型（PostgreSQL）

#### 3.1 users 表结构

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | 系统内部唯一用户ID，即全局 `student_id` |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | 登录用户名 |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt 加盐哈希，绝不明文存储 |
| `email` | VARCHAR(100) | UNIQUE | 用于找回密码、通知 |
| `phone` | VARCHAR(20) | NULL | 可选联系方式 |
| `role` | VARCHAR(20) | NOT NULL DEFAULT 'student' | 角色：student / admin |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | active / suspended / deleted |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 注册时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 最后修改时间 |

#### 3.2 用户扩展信息表 user_profiles

将非登录必需的静态属性垂直拆分，减少核心表宽度。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `user_id` | UUID | PK, FK(users.id) ON DELETE CASCADE | 关联主用户 |
| `full_name` | VARCHAR(100) | | 真实姓名（可选） |
| `university` | VARCHAR(200) | | 院校 |
| `major` | VARCHAR(200) | NOT NULL | 专业（如“人工智能”） |
| `grade` | VARCHAR(50) | | 年级（大一至研究生） |
| `learning_goal` | TEXT | | 用户自述学习目标，用于画像初始化 |
| `avatar_url` | VARCHAR(500) | | 头像链接 |

#### 3.3 认证相关索引与约束

- 在 `username` 和 `email` 上建唯一索引。
- 密码哈希使用 bcrypt，cost factor >= 12。
- 登录失败次数限制通过 Redis 实现（见会话管理部分），不在此表维护。

---

### 4. 学习画像存储（Neo4j + Milvus + Redis）

#### 4.1 Neo4j 图模型（长效画像）

**节点标签**：
- `Student` （属性：`id` (UUID), `name`）
- `KnowledgePoint` （属性：`id`, `name`, `difficulty`, `module`）
- `LearningStyle` （属性：`id`, `name`，如 “Visual”, “Textual”）

**关系类型**：
- `(:Student)-[:MASTERS {score: Integer, confidence: Float, last_updated: DateTime}]->(:KnowledgePoint)`
- `(:Student)-[:PREFERS {weight: Float}]->(:LearningStyle)`
- `(:KnowledgePoint)-[:PREREQUISITE_OF]->(:KnowledgePoint)`

**数据隔离**：不同学生之间的节点和关系天然隔离（通过 Student 节点 ID 区分），查询时使用 `{student_id}` 参数。

#### 4.2 向量数据库（偏好向量）

- **集合名称**：`student_preference_vectors`
- **向量字段**：`preference_vector`（维度：512，使用 text-embedding-3-small 模型生成）
- **标量字段**：`student_id` (String), `last_updated` (Timestamp)
- **用途**：学生偏好向量由阅读/收藏资源的嵌入加权平均形成，用于相似资源推荐。
- **隔离**：所有搜索操作均带过滤条件 `student_id = ?`，不允许跨用户查询。

#### 4.3 Redis 短时缓存（会话画像）

- **Key 格式**：`session:{student_id}`
- **类型**：Hash
- **字段**：
  - `current_module`: String
  - `recent_answers`: JSON Array ["correct","correct","wrong"]
  - `cognitive_load`: String (low/medium/high)
  - `last_interaction_ts`: Unix timestamp
  - `triggered_review`: String (触发热点的知识点名称)
- **TTL**：7200 秒（2小时），每次交互时续期。
- **隔离**：Key 中包含 student_id，天然隔离。

---

### 5. 行为事件流水存储（MongoDB）

**集合**：`learning_events`

**文档结构**（与 PRD-003 事件模型一致）：
```json
{
  "event_id": "evt_1715000000_a1b2c3",
  "student_id": "uuid-xxx",
  "session_id": "sess-abc",
  "event_type": "video.exit",
  "timestamp": ISODate("2026-05-07T14:02:00Z"),
  "payload": { ... },
  "device_meta": { ... }
}
```

**索引**：
- `student_id` + `timestamp` 复合索引（支持按用户按时间查询）
- `event_type` + `timestamp` 复合索引（支持全局分析）
- TTL 索引：根据存储策略，90天后自动删除或归档（可选）

**隔离**：所有写入接口均从 JWT 中提取 `student_id` 并强制写入；读取接口（如查询历史）必须过滤 `student_id`。

---

### 6. 多用户数据隔离与接口安全

#### 6.1 身份认证与鉴权

- 采用 JWT 令牌机制，登录成功后签发 Access Token（有效期 24h）和 Refresh Token（有效期 7天）。
- Token payload 包含：`student_id`, `role`, `exp`。
- 所有 API 请求通过 API Gateway 校验 JWT，解出 `student_id` 注入请求上下文，后端所有数据库操作均使用该 ID 进行数据隔离，禁止客户端传入 `student_id` 参数。

#### 6.2 数据访问规则

| 操作 | 隔离规则 |
|------|----------|
| 读取/更新画像 (Neo4j) | MATCH 语句必须包含 `{student_id}`，使用参数化查询防止注入 |
| 查询偏好向量 (Milvus) | 向量搜索时必须设置 `filter: "student_id == 'xxx'"` |
| 读取/写入会话 (Redis) | Key 中直接包含 `student_id` |
| 读取行为日志 (MongoDB) | 查询条件必须包含 `student_id` |
| 用户信息修改 (PG) | 只能修改自己的 `user_profiles` 记录，`id` 来自 JWT |

#### 6.3 跨用户操作审计

任何涉及管理角色查询其他用户信息的行为（如管理员查看学习报表）必须记录于 `admin_audit_log` 表（PG），包含操作时间、操作者ID、目标用户ID、操作类型。

---

### 7. 用户数据一致性策略

#### 7.1 统一 ID 生成

所有 `student_id` 均由 PostgreSQL 在注册时使用 `gen_random_uuid()` 生成，作为全局唯一标识。其他系统（Neo4j, Milvus, Redis, MongoDB）的 `student_id` 均同步此值，不自行生成。

#### 7.2 画像数据最终一致性

- 行为事件通过 Kafka 异步处理，Profile Agent 负责合并短时状态到长效画像，属于最终一致性模型（延迟 < 5s）。
- 用户主动更新专业、学习目标等基础信息时，同步更新 PostgreSQL，并发送 `UserProfileUpdated` 消息到 Kafka，由画像 Agent 异步更新 Neo4j 中的相关属性。

#### 7.3 会话缓存刷新

- 登录时从 Neo4j/向量库加载长效画像摘要注入 Redis。
- 登出或 Token 过期时，触发清理 `session:{student_id}`。
- 异常退出：依赖 Redis TTL 自动清理。

---

### 8. 用户信息 CRUD 接口规格

#### 8.1 注册

- **端点**：`POST /api/auth/register`
- **请求体**：
```json
{
  "username": "zhangsan",
  "password": "******",
  "email": "zhangsan@university.edu.cn",
  "major": "人工智能"
}
```
- **后端逻辑**：
  1. 校验字段合法性，检查用户名/邮箱唯一性。
  2. 生成 `student_id` (UUID)。
  3. 密码 bcrypt 哈希。
  4. 插入 `users` 表，同时插入一条 `user_profiles`（major 必填）。
  5. 在 Neo4j 中创建 Student 节点 `(s:Student {id: student_id, name: username})`。
  6. 在 Milvus 中插入初始偏好向量（零向量或专业默认向量）。
  7. 返回 `student_id` 和 JWT。

#### 8.2 登录

- **端点**：`POST /api/auth/login`
- **请求体**：`username` + `password`
- **逻辑**：
  1. 根据 username 查询用户，校验密码。
  2. 检查账户状态（active）。
  3. 若失败，记录失败次数（Redis: `login_fail:{username}`），5分钟内超过5次则锁定15分钟。
  4. 成功：签发 JWT，清除失败计数，初始化 Redis 会话画像（从 Neo4j 加载摘要）。

#### 8.3 修改个人信息

- **端点**：`PUT /api/profile`
- **Headers**：`Authorization: Bearer <jwt>`
- **请求体**（部分更新）：
```json
{
  "full_name": "张三",
  "learning_goal": "掌握深度学习基础，通过期末考试"
}
```
- **逻辑**：
  1. 从 JWT 解析 `student_id`。
  2. 更新 `user_profiles` 对应字段。
  3. 发送 `UserProfileUpdated` 事件到 Kafka，触发画像 Agent 同步 Neo4j 中可能受影响的属性。

#### 8.4 查询个人信息

- **端点**：`GET /api/profile`
- **响应**：合并 `users` + `user_profiles` 的 JSON 对象（不包含密码哈希）。

#### 8.5 注销账户

- **端点**：`DELETE /api/account`
- **逻辑**：
  1. 将 `users.status` 设为 `deleted`，不物理删除数据。
  2. 删除 Redis 会话。
  3. 用户画像数据保留 30 天以符合数据留存要求，之后可异步清理。

---

### 9. 非功能需求

#### 9.1 性能

- **注册/登录**：响应时间 < 500ms（P95）
- **个人资料读写**：< 100ms（P95），借助 Redis 缓存热用户减少 PG 压力
- **并发用户数**：支持 1000 并发登录会话，Redis 和 PG 连接池需合理配置

#### 9.2 安全性

- 所有传输使用 HTTPS。
- 密码哈希使用 bcrypt（cost >= 12）。
- JWT 密钥长度 >= 256 位，定期轮换。
- 输入校验防 SQL 注入、NoSQL 注入、XSS。
- API 速率限制：同一 IP 登录接口 10次/分钟。

#### 9.3 可扩展性

- PostgreSQL 支持读写分离（主库写，从库读）。
- Redis 采用哨兵或集群模式支持高可用。
- Neo4j 使用单实例可满足初期规模，后续可考虑集群。

#### 9.4 可观测性

- 所有关键操作（注册、登录、画像更新）须输出结构化日志。
- 集成 Prometheus + Grafana 监控各存储系统的延迟、错误率和连接池状态。

---

### 10. 开发任务分解（供 Agent 实施）

1. **数据库迁移脚本**：创建 PostgreSQL 表 `users`, `user_profiles`，索引。
2. **Neo4j 初始化脚本**：创建约束和索引（Student节点唯一id约束）。
3. **Milvus 集合初始化**：创建 `student_preference_vectors`。
4. **用户注册 API**：含所有存储系统的原子性初始化（若无法完全保证事务，实现补偿逻辑）。
5. **用户登录 API**：JWT 生成，会话初始化。
6. **用户信息修改 API**：PG 更新 + 事件发送。
7. **用户查询 API**：聚合查询。
8. **认证中间件**：JWT 校验与上下文注入。
9. **数据隔离单元测试**：模拟不同用户ID，验证无法访问他人数据。

---

此PRD完整定义了多用户信息维护的所有细节，可直接交付开发Agent进行代码实现。如需进一步细化某个子系统的接口或数据模型，请提出。
*本文档整合自赛题原文与系统设计交流内容，供团队开发参考。*