# Education Agent - 个性化学习资源生成与学习多智能体系统

基于大模型的个性化资源生成与学习多智能体系统，为学生提供专属的个性化资源学习智能体。

---

## 目录

- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [环境配置](#环境配置)
- [快速开始](#快速开始)
- [数据库设置](#数据库设置)
- [访问地址](#访问地址)
- [API 接口](#api-接口)
- [功能演示](#功能演示)
- [常见问题](#常见问题)
- [项目贡献](#项目贡献)

---

## 技术栈

### 后端
- **框架**: FastAPI 0.109.0
- **LLM**: DeepSeek API / Qwen API (支持流式输出 + 深度思考)
- **数据库**: PostgreSQL + pgvector
- **图数据库**: Neo4j
- **文档数据库**: MongoDB
- **缓存**: Redis
- **认证**: JWT (python-jose) + bcrypt
- **PDF 解析**: PyMuPDF (fitz)

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **路由**: React Router 6
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
- **Markdown**: react-markdown + remark-gfm

---

## 系统架构

```
education-agent/
├── app/                          # FastAPI 后端
│   ├── api/endpoints/            # API 端点
│   │   ├── auth.py               # 认证接口
│   │   ├── api_settings.py       # API 配置管理（含 text-embedding 版本选择）
│   │   ├── profile.py            # 用户信息接口
│   │   ├── profile_v2.py         # 画像接口
│   │   ├── chat.py               # LLM 对话接口
│   │   ├── files.py              # 文件上传与管理
│   │   ├── ocr.py                # OCR 文字识别
│   │   └── project.py            # 项目管理与 RAG 检索
│   ├── core/                     # 核心模块
│   │   ├── config.py             # 配置管理
│   │   ├── security.py           # 安全工具
│   │   └── vector_store.py       # RAG 向量存储（阿里 text-embedding API）
│   ├── crud/                     # CRUD 操作
│   │   ├── api_settings.py       # API 配置 CRUD
│   │   ├── profile.py            # 画像 CRUD
│   │   └── project.py            # 项目 CRUD
│   ├── db/                       # 数据库连接
│   │   ├── database.py           # PostgreSQL
│   │   ├── neo4j.py             # Neo4j
│   │   └── mongodb.py            # MongoDB
│   ├── models/                   # 数据模型
│   │   ├── api_settings.py       # API 配置模型
│   │   ├── user.py              # 用户模型
│   │   ├── project.py           # 项目与 RAG 文档模型
│   │   └── chat.py              # 聊天会话模型
│   └── schemas/                  # Pydantic schemas
│       ├── api_settings.py       # API 配置 Schema
│       └── project.py           # 项目 Schema
│
├── frontend/                     # React 前端
│   └── src/
│       ├── api/                  # API 客户端
│       ├── components/           # 公共组件
│       │   ├── Layout.tsx        # 页面布局
│       │   ├── Sidebar.tsx       # 侧边栏
│       │   ├── ChatPlatform.tsx  # AI 对话平台
│       │   └── MessageList.tsx   # 消息列表
│       ├── pages/                # 页面组件
│       │   ├── HomePage.tsx          # 首页
│       │   ├── LoginPage.tsx         # 登录页
│       │   ├── RegisterPage.tsx      # 注册页
│       │   ├── ProfilePage.tsx       # 个人中心
│       │   ├── AdminPage.tsx        # 管理后台
│       │   ├── ChatPage.tsx         # AI 对话初始化
│       │   ├── ProfileInitPage.tsx  # 表单初始化
│       │   ├── DynamicProfilePage.tsx # 动态画像
│       │   ├── BehaviorEventsPage.tsx # 行为事件
│       │   ├── SwaggerPage.tsx       # Swagger 文档
│       │   ├── RedocPage.tsx         # ReDoc 文档
│       │   └── HealthPage.tsx        # 健康检查
│       ├── store/                # Zustand 状态
│       └── types/                # TypeScript 类型
│
├── migrations/                    # 数据库迁移脚本
├── test_script/                  # 测试脚本（不上传 Git）
├── request/                      # PRD 文档
│   ├── prd-1.md                 # 用户账号信息维护
│   ├── prd-2.md                 # 学习画像构建 (v2.2)
│   ├── prd-3-auth-system.md    # 认证系统
│   └── prd-2-phased.md          # 画像阶段计划
├── requirements.txt               # Python 依赖
├── CLAUDE.md                      # AI 开发规范
├── AGENTS.md                      # AI Agent 开发指南
└── .env                          # 环境变量
```

---

## 环境配置

### 1. 数据库服务状态

本项目依赖 4 个数据库服务，确认本地已安装并运行：

| 服务 | 状态 | 用途 | 端口 | Docker 启动命令 |
|------|------|------|------|-----------------|
| PostgreSQL + pgvector | ✅ 已安装 | 用户数据 + 偏好向量 | 5433 | `docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 pgvector/pgvector:pg16` |
| Redis | ✅ 已安装 | 会话缓存 + 登录限制 | 6379 | `docker run -d --name redis -p 6379:6379 redis:alpine` |
| Neo4j | ✅ 已安装 | 知识图谱 + 画像关系 | 7687 | `docker run -d --name neo4j -e NEO4J_AUTH=neo4j/12345678 -p 7687:7687 neo4j:5` |
| MongoDB | ✅ 已安装 | 行为日志 + 短时会话 | 27017 | `docker run -d --name mongodb -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=123456 -p 27017:27017 mongo:6` |

> **注意**：本项目**强制使用 PostgreSQL**。如果启动后端时未连接 PostgreSQL，会直接报错退出。
>
> 常见报错及解决：
> - `启动失败：当前配置使用了 SQLite` → 请确保 `.env` 中 `USE_SQLITE=false`
> - `启动失败：无法连接到 PostgreSQL` → 请启动 PostgreSQL 服务或检查连接配置
> - `启动失败：PostgreSQL 连接异常` → 请检查用户名/密码/端口是否正确

### 2. 克隆项目

```bash
git clone <repository-url>
cd education-agent
```

### 3. 安装 Python 依赖

```bash
# 激活虚拟环境（Windows PowerShell）
.\venv\Scripts\Activate.ps1

# 如果没有虚拟环境，创建并激活
python -m venv venv
.\venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt
```

### 4. 安装 Node.js 依赖

```bash
cd frontend
npm install
cd ..
```

### 5. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
# Windows PowerShell
Copy-Item .env.example .env
```

编辑 `.env` 文件，配置数据库密码和 API：

```env
# PostgreSQL (Docker pgvector)
POSTGRES_SERVER=localhost
POSTGRES_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres      # 修改为你的密码
POSTGRES_DB=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=12345678       # 修改为你的密码

# MongoDB
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_USER=root
MONGODB_PASSWORD=123456        # 修改为你的密码
MONGODB_DB=education_agent

# DeepSeek API (LLM)
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# Qwen API (LLM)
QWEN_API_KEY=your_api_key
QWEN_MODEL=qwen-turbo
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 百度 OCR API (图片文字识别)
# 仅支持百度智能云通用文字识别服务
# 申请地址: https://ai.baidu.com/tech/ocr
BAIDU_OCR_API_KEY=your_api_key
BAIDU_OCR_SECRET_KEY=your_secret_key
```

### 6. 启动数据库服务

使用上表中列出的 Docker 命令启动数据库服务：

```bash
# PostgreSQL + pgvector
docker run -d --name postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_USER=postgres `
  -p 5433:5432 `
  pgvector/pgvector:pg16

# Redis
docker run -d --name redis -p 6379:6379 redis:alpine

# Neo4j
docker run -d --name neo4j `
  -e NEO4J_AUTH=neo4j/12345678 `
  -p 7687:7687 `
  neo4j:5

# MongoDB
docker run -d --name mongodb `
  -e MONGO_INITDB_ROOT_USERNAME=root `
  -e MONGO_INITDB_ROOT_PASSWORD=123456 `
  -p 27017:27017 `
  mongo:6
```

#### 检查数据库状态

```bash
docker ps
```

确保 4 个容器都在运行：
- `postgres` (5433)
- `redis` (6379)
- `neo4j` (7687)
- `mongodb` (27017)

---

## 快速开始

### 1. 初始化数据库表

首次运行或数据库表不存在时，需要执行迁移：

```bash
# 使用 Python 脚本执行迁移（推荐）
.\venv\Scripts\python.exe test_script\run_migration.py
```

### 2. 启动后端

```bash
# 确保虚拟环境已激活
.\venv\Scripts\Activate.ps1

# 设置 PYTHONPATH（Windows PowerShell）
$env:PYTHONPATH="d:\code\MyPython\education-agent"

# 启动后端（支持热更新）
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 启动前端（新终端窗口）

```bash
cd frontend
npm run dev
```

前端会自动选择可用端口（默认 3004），会显示类似：
```
VITE ready in 468 ms
Local: http://localhost:3004/
```

### 4. 完整启动流程

```bash
# ==================== 终端 1：后端 ====================
.\venv\Scripts\Activate.ps1
$env:PYTHONPATH="d:\code\MyPython\education-agent"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# ==================== 终端 2：前端 ====================
cd frontend
npm run dev
```

### 5. 访问应用

1. 打开浏览器访问前端地址（通常是 http://localhost:3004）
2. 注册新账号或登录已有账号
3. 通过 AI 对话初始化学习画像
4. 查看和管理动态画像

---

## 数据库设置

### 创建数据库用户

```sql
-- 连接到 PostgreSQL
psql -h localhost -p 5433 -U postgres
```

### 执行数据库迁移

首次运行或数据库表不存在时，需要执行迁移：

```bash
# 使用 Python 脚本执行迁移（推荐）
.\venv\Scripts\python.exe test_script\run_migration.py
```

#### 迁移文件说明

`migrations/` 目录包含按顺序编号的 SQL 迁移文件：

| 文件 | 说明 |
|------|------|
| `001_create_users.sql` | 用户表和用户画像表 |
| `002_create_admin_audit_log.sql` | 管理员审计日志表 |
| `003_create_chat_tables.sql` | 聊天会话和消息表 |
| `003_create_chat_attachments.sql` | 聊天附件表 |
| `004_add_model_version_to_api_settings.sql` | 为 text-embedding 添加模型版本字段 |

> **注意**：当遇到 API 设置页面"加载失败"错误时，通常是数据库表缺少新加的列。请运行最新的迁移文件或执行：
> ```sql
> ALTER TABLE api_settings ADD COLUMN IF NOT EXISTS model_version VARCHAR(20);
> ```

---

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| React 前端 | http://localhost:3004 | React 应用（端口可能变化） |
| 后端 API | http://localhost:8000/api/v1 | REST API |
| Swagger 文档 | http://localhost:3004/swagger | API 文档 |
| ReDoc 文档 | http://localhost:3004/redoc | 备用 API 文档 |
| 健康检查 | http://localhost:3004/health | 服务状态 |

> **注意**：API 文档已迁移到 React 页面，通过 Vite 代理访问后端 OpenAPI 规范。

---

## API 接口

### 认证接口 (`/api/v1/auth`)

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/register` | 用户注册 |
| POST | `/login` | 用户登录 |
| POST | `/refresh` | 刷新 Token |

### 用户信息接口 (`/api/v1/profile`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/` | 获取个人信息 | 需要 |
| PUT | `/` | 更新个人信息 | 需要 |
| DELETE | `/account` | 注销账户（物理删除） | 需要 |
| GET | `/users` | 获取所有用户列表 | 管理员 |
| DELETE | `/users/{user_id}` | 删除用户（物理删除） | 管理员 |

### 画像接口 (`/api/v1/profile/v2`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 创建画像 | 需要 |
| GET | `/` | 获取完整画像 | 需要 |
| GET | `/summary` | 获取画像摘要 | 需要 |
| PUT | `/` | 更新画像 | 需要 |
| DELETE | `/` | 删除画像 | 需要 |
| POST | `/knowledge` | 添加知识点 | 需要 |
| PUT | `/knowledge` | 更新知识点 | 需要 |
| DELETE | `/knowledge/{point}` | 删除知识点 | 需要 |
| POST | `/error-prone` | 添加易错点 | 需要 |
| POST | `/behavior` | 记录行为事件 | 需要 |
| GET | `/timeline` | 获取时间线 | 需要 |
| GET | `/behavior` | 获取行为事件 | 需要 |

### LLM 对话接口 (`/api/v1/chat`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/profile-init` | 画像初始化对话 | 需要 |
| GET | `/sessions` | 获取聊天会话列表 | 需要 |
| POST | `/sessions` | 创建新聊天会话 | 需要 |
| DELETE | `/sessions/{session_id}` | 删除聊天会话 | 需要 |
| GET | `/sessions/{session_id}/messages` | 获取会话消息 | 需要 |

### API 设置接口 (`/api/v1/api-settings`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/` | 获取所有 API 设置状态（含 text-embedding 版本） | 需要 |
| POST | `/` | 保存 API 配置（DeepSeek/Qwen/OCR/网络检索/text-embedding） | 需要 |
| GET | `/{provider}` | 获取指定提供商的 API 配置 | 需要 |
| DELETE | `/{provider}` | 删除指定提供商的 API 配置 | 需要 |
| GET | `/available/models` | 获取可用模型列表 | 需要 |

> text-embedding 支持 v1/v2/v3 三个版本选择，通过 `model_version` 参数指定。

### 项目管理与 RAG 接口 (`/api/v1/projects`)

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 创建项目 | 需要 |
| GET | `/` | 获取项目列表 | 需要 |
| GET | `/{id}` | 获取项目详情 | 需要 |
| PUT | `/{id}` | 更新项目 | 需要 |
| DELETE | `/{id}` | 删除项目 | 需要 |
| POST | `/{id}/documents/upload` | 上传文档并自动分块 | 需要 |
| GET | `/{id}/build-index/estimate` | 预估向量索引构建时间 | 需要 |
| POST | `/{id}/build-index` | 构建 RAG 向量索引（支持后台） | 需要 |
| GET | `/{id}/build-index/status` | 查询索引构建状态 | 需要 |
| POST | `/{id}/retrieve` | 混合检索（向量+BM25） | 需要 |

> RAG 使用阿里 text-embedding-v2 API 生成向量，需先在 API 设置中配置 text_embedding 密钥。

### 健康检查接口 (`/api/v1/health`)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/` | 获取系统健康状态 |

---

## 功能演示

### 1. AI 对话式画像初始化

用户注册后，可以通过与 AI 助手对话完成学习画像初始化：

1. 访问 `/chat` 页面
2. AI 助手会询问专业、年级、学习目标、学习风格、自我评估
3. 对话完成后自动创建画像并跳转到动态画像页面

### 2. AI 对话平台

访问 `/chat-platform` 使用完整的 AI 对话平台：

- **模型选择**：支持 DeepSeek (v4-flash, v4-pro) 和 Qwen (3.5-plus, 3.6-plus)
- **深度思考**：可开启/关闭 AI 思考过程显示
- **联网搜索**：可开启联网搜索，让 AI 结合实时网络信息回答
- **图片识别（OCR）**：上传图片自动识别文字，让纯文本模型也能理解图片内容；多模态模型(qwen3.5-plus/3.6-plus)直接处理图片
- **剪贴板粘贴**：支持直接粘贴图片或PDF文件（最多5个），粘贴后在输入框上方显示缩略图预览区（AI回复时仍可见），点击可查看大图；多模态模型直接发送图片，纯文本模型OCR识别；PDF提取前5000字符；附件持久化到数据库，切换对话时可恢复
- **流式输出**：实时显示 AI 回复，无需等待完整响应
- **Markdown 渲染**：支持表格、代码高亮等格式
- **聊天历史**：自动保存会话，支持历史记录查看

### 3. 动态画像管理

访问 `/profile/dynamic` 查看和管理：

- **认知风格**：视觉型/听觉型/阅读型/实践型/混合型
- **知识点掌握**：添加、更新、删除知识点及掌握度
- **易错点**：记录易错知识点及错误次数
- **活跃时间**：可视化展示学习时段分布
- **学习节奏**：进度快慢及趋势
- **元认知校准**：自评与实际差距
- **注意力特征**：分心程度指标

### 4. 行为事件记录

访问 `/profile/events` 查看：

- **时间线**：画像变更历史
- **行为事件**：答题、资源浏览等行为记录
- **手动记录**：支持手动添加行为事件

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |

> ⚠️ **重要**：首次部署请修改管理员密码！

---

## 常见问题

### 1. 启动后端报错 `ModuleNotFoundError: No module named 'app'`

```bash
# 设置 PYTHONPATH
$env:PYTHONPATH="d:\code\MyPython\education-agent"
```

或使用完整路径启动：
```bash
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. 前端端口不是 3000

Vite 会自动选择可用端口，如果 3000-3003 被占用，会使用 3004 或更高。请查看终端输出的实际地址。

### 3. 数据库连接失败

检查：
1. Docker 容器是否运行：`docker ps`
2. 数据库密码是否正确配置在 `.env`
3. 端口是否被占用：`netstat -an | findstr 5433`

### 4. LLM 对话功能不可用

1. 检查 `.env` 中是否配置了 `DEEPSEEK_API_KEY` 或 `QWEN_API_KEY`
2. 检查网络是否能访问对应的 API 域名

### 5. 热更新说明

- **前端修改**：保存后自动刷新，无需重启（Vite HMR）
- **后端修改**：使用 `--reload` 参数时自动重启

### 6. API 设置页面加载失败

如果 API 设置页面提示"加载失败"，检查浏览器控制台（F12）和后端日志：

**常见原因 1：数据库列缺失**

数据库表缺少 `model_version` 列。执行迁移：
```bash
# 连接 PostgreSQL 后执行
psql -h localhost -p 5433 -U postgres -d postgres
# 然后执行：
ALTER TABLE api_settings ADD COLUMN IF NOT EXISTS model_version VARCHAR(20);
```

**常见原因 2：API 密钥未配置**

如使用 RAG 向量检索功能，需先在 API 设置页面配置 `text_embedding` 的 API 密钥。

### 7. 画像数据为空时报错

已实现自动跳转：访问 `/profile/dynamic` 或 `/profile/events` 时：
- 如果用户未初始化画像，自动跳转到 `/profile/init`
- 如果也没有初始化，跳转到 `/chat` 进行 AI 对话初始化

---

## 项目贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md) 了解项目开发规范和贡献记录。

---

## License

MIT
