# AGENTS.md — AI Agent 高效开发指南

本文档是面向 AI Agent（如 Claude、GPT 等编程助手）的全面开发指南，旨在让 Agent 能够高效、一致、高质量地为 `education-agent` 项目编写代码。本文档与 `CLAUDE.md`（开发规范）、`README.md`（项目手册）、`CONTRIBUTING.md`（贡献记录）互为补充，Agent 在开始任何编码任务前**必须先阅读本文档**。

---

## 目录

1. [AI Agent 角色定位与能力边界](#1-ai-agent-角色定位与能力边界)
2. [项目概览与核心概念](#2-项目概览与核心概念)
3. [项目架构与模块划分](#3-项目架构与模块划分)
4. [开发环境配置与依赖管理](#4-开发环境配置与依赖管理)
5. [代码编写规范与风格指南](#5-代码编写规范与风格指南)
6. [API 接口与数据结构定义](#6-api-接口与数据结构定义)
7. [数据库与存储规范](#7-数据库与存储规范)
8. [前端开发规范](#8-前端开发规范)
9. [代码提交与审查流程](#9-代码提交与审查流程)
10. [PRD 驱动的开发流程](#10-prd-驱动的开发流程)
11. [常见问题解决方案](#11-常见问题解决方案)
12. [与 Agent 协作的最佳实践](#12-与-agent-协作的最佳实践)
13. [文件修改速查表](#13-文件修改速查表)

---

## 1. AI Agent 角色定位与能力边界

### 1.1 角色定位

作为本项目的 AI Agent，你的核心职责是：

- **代码实现者**：根据 PRD 规格说明书将功能需求转化为可运行的代码
- **全栈开发者**：同时负责后端（FastAPI + Python）和前端（React + TypeScript）的实现
- **文档维护者**：及时更新 README.md、CONTRIBUTING.md 和相关 PRD 文档
- **质量保障者**：每次代码修改后进行测试验证，确保前后端一致

### 1.2 能力边界

| 可以做的事 | 不可以做的事 |
|----------|-------------|
| 编写/修改后端 API 端点 | 随意修改/删除 `.env` 文件（需向用户申请） |
| 编写/修改 React 组件和页面 | 覆盖 CONTRIBUTING.md（只能追加） |
| 执行数据库迁移脚本 | 在代码中硬编码密码或密钥 |
| 更新 PRD 文档的 AI 状态维护表 | 跳过测试直接提交代码 |
| 安装 Python/Node.js 依赖 | 假设某个库可用而不检查 |
| 运行测试脚本 | 修改分支管理或 Git 配置 |

### 1.3 决策边界

当你遇到以下情况时，**必须中断当前工作并向用户询问**：

1. 信息不充分（如需求不明确、缺少 API key、缺少数据库连接信息）
2. 存在安全风险（如需要修改认证逻辑、涉及密码/密钥处理）
3. 可能破坏现有功能（如修改核心配置、数据库结构变更）
4. 端口冲突（后端必须在 8000 端口，前端必须在 3000 端口）

---

## 2. 项目概览与核心概念

### 2.1 项目背景

本项目是第十五届"中国软件杯"大赛 A 组赛题——"基于大模型的个性化资源生成与学习多智能体系统开发"。目标是构建一个高等教育个性化学习资源体系，为学生提供专属的个性化资源学习智能体。

**出题企业**：科大讯飞股份有限公司

### 2.2 核心功能模块

| 编号 | 功能模块 | 对应 PRD | 当前状态 |
|------|---------|----------|---------|
| 1 | 用户认证系统（注册/登录/JWT/锁定） | PRD-1, PRD-3 | ✅ 已完成并通过 |
| 2 | 8 维学习画像构建（对话式初始化 + CRUD） | PRD-2 | ✅ 已完成并通过 |
| 3 | AI Chat 智能对话平台（流式输出/多模型/深度思考） | PRD-4 | 🟡 大部分完成 |
| 4 | 项目管理系统（项目 CRUD/提示词/RAG） | PRD-4 (P3) | ✅ 已完成 |
| 5 | 图片 OCR 识别（百度 OCR） | PRD-4 (P2) | ✅ 已完成并通过 |
| 6 | 联网搜索（通义 Web-Search MCP） | PRD-4 (P2) | ✅ 已完成 |
| 7 | 剪贴板粘贴（图片/PDF 上传预览） | PRD-4 (P2) | ✅ 已完成 |
| 8 | API 设置（用户级 API Key 管理） | - | ✅ 已完成 |
| 9 | LangGraph Agent 系统（画像初始化/更新/可解释性） | PRD-2 | 📋 规划中 |
| 10 | 全局记忆与项目记忆 | PRD-4 (P4) | 📋 规划中 |

### 2.3 技术栈速览

| 层级 | 技术 | 版本/说明 |
|------|------|----------|
| 后端框架 | FastAPI | 0.109.0 |
| 前端框架 | React + TypeScript | 18.x |
| 构建工具 | Vite | 5.x |
| 状态管理 | Zustand | - |
| 路由 | React Router | 6.x |
| HTTP 客户端 | Axios | - |
| 关系数据库 | PostgreSQL + pgvector | 端口 5433 |
| 图数据库 | Neo4j | 端口 7687 |
| 文档数据库 | MongoDB | 端口 27017 |
| 缓存 | Redis | 端口 6379 |
| 认证 | JWT (python-jose) + bcrypt | - |
| LLM | DeepSeek API / Qwen API | 支持流式输出 |
| OCR | 百度智能云 OCR | 通用文字识别 |
| PDF 解析 | PyMuPDF (fitz) | PDF 文件正文文本提取 |
| Web Search | 通义 Web-Search MCP 服务 | 阿里云百炼 |

### 2.4 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 测试用户 | guoketg | 123456 |

> 所有用户报告的 Bug，默认可使用 `guoketg / 123456` 账号登录测试。

---

## 3. 项目架构与模块划分

### 3.1 完整目录结构

```
education-agent/
├── app/                              # FastAPI 后端
│   ├── api/
│   │   ├── dependencies.py           # JWT 认证依赖注入
│   │   └── endpoints/                # API 端点
│   │       ├── auth.py               # 注册/登录/刷新/登出
│   │       ├── profile.py            # 用户信息 CRUD
│   │       ├── profile_v2.py         # 画像 CRUD（8维）
│   │       ├── chat.py               # LLM 对话（流式 SSE）
│   │       ├── files.py              # 文件上传/下载/管理
│   │       ├── ocr.py                # 百度 OCR 识别
│   │       ├── api_settings.py       # 用户级 API Key 管理
│   │       └── project.py            # 项目 CRUD
│   ├── core/                         # 核心模块
│   │   ├── config.py                 # 环境配置读取
│   │   ├── security.py               # JWT/密码/bcrypt/Redis 锁定
│   │   ├── web_search.py             # 通义 Web-Search MCP 服务
│   │   └── ocr.py                    # 百度 OCR 客户端
│   ├── crud/                         # 数据库操作层
│   │   ├── profile.py                # 画像 CRUD（Neo4j/MongoDB）
│   │   ├── api_settings.py           # API 设置 CRUD
│   │   └── project.py                # 项目 CRUD
│   ├── db/                           # 数据库连接
│   │   ├── database.py               # PostgreSQL（SQLAlchemy）
│   │   ├── neo4j.py                  # Neo4j 连接
│   │   └── mongodb.py                # MongoDB 连接
│   ├── models/                       # SQLAlchemy 模型
│   │   ├── user.py                   # User, UserProfile
│   │   ├── chat.py                   # ChatSession, ChatMessage, ChatAttachment
│   │   ├── api_settings.py           # ApiSettings
│   │   └── project.py                # Project, Prompt, Document, Chunk
│   ├── schemas/                      # Pydantic 请求/响应模型
│   │   ├── user.py
│   │   ├── api_settings.py
│   │   └── project.py
│   └── main.py                       # FastAPI 应用入口（路由注册/启动检查）
│
├── frontend/                         # React 前端
│   ├── src/
│   │   ├── api/                      # Axios API 客户端
│   │   │   ├── auth.ts               # 认证 + 所有 API 调用
│   │   │   └── index.ts              # 统一导出
│   │   ├── components/               # 公共组件
│   │   │   ├── Layout.tsx            # 页面布局（仅 Outlet）
│   │   │   ├── Sidebar.tsx           # 对话历史侧栏
│   │   │   ├── ChatPlatform.tsx      # AI 对话主平台（核心组件）
│   │   │   ├── MessageList.tsx       # 消息列表渲染
│   │   │   ├── InputArea.tsx         # 输入区（模型切换/搜索/上传/粘贴）
│   │   │   └── ProjectManager.tsx    # 项目管理组件
│   │   ├── pages/                    # 页面组件
│   │   │   ├── HomePage.tsx          # 首页（导航栏）
│   │   │   ├── LoginPage.tsx         # 登录页
│   │   │   ├── RegisterPage.tsx      # 注册页
│   │   │   ├── ProfilePage.tsx       # 个人中心
│   │   │   ├── AdminPage.tsx         # 管理后台
│   │   │   ├── ChatPage.tsx          # AI 对话画像初始化
│   │   │   ├── ProfileInitPage.tsx   # 表单式画像初始化
│   │   │   ├── DynamicProfilePage.tsx # 动态画像仪表盘
│   │   │   ├── BehaviorEventsPage.tsx # 行为事件与时间线
│   │   │   ├── ApiSettingsPage.tsx   # API 设置
│   │   │   ├── SwaggerPage.tsx       # Swagger 文档
│   │   │   ├── RedocPage.tsx         # ReDoc 文档
│   │   │   └── HealthPage.tsx        # 健康检查
│   │   ├── store/                    # Zustand 状态管理
│   │   │   └── auth.ts               # 认证状态
│   │   └── types/                    # TypeScript 类型定义
│   │       └── user.ts
│   ├── package.json
│   └── vite.config.ts                # Vite 配置（API 代理）
│
├── migrations/                       # 数据库迁移脚本（SQL）
│   ├── 001_create_users.sql
│   ├── 002_create_admin_audit_log.sql
│   └── 003_create_chat_attachments.sql
│
├── test_script/                      # 测试脚本（不上传 Git）
│   ├── run_migration.py              # 迁移执行脚本
│   ├── check_user_status.py          # 用户状态检查
│   ├── test_web_search.py            # 联网搜索测试
│   └── test_baidu_ocr.py             # OCR 测试
│
├── request/                          # PRD 文档
│   ├── prd-1.md                      # 多用户信息维护
│   ├── prd-2.md                      # 学习画像构建与动态维护
│   ├── prd-2-phased.md               # 画像阶段实施计划
│   ├── prd-3-auth-system.md          # 认证系统
│   ├── prd-4-AIChat.md              # AI Chat 智能对话平台
│   ├── basic_function.md             # 基础功能规划
│   └── contest_intro.md              # 赛题介绍
│
├── uploads/                          # 用户上传文件存储
├── .env                              # 环境变量（不提交 Git）
├── requirements.txt                  # Python 依赖
├── CLAUDE.md                         # AI 开发规范（必读）
├── AGENTS.md                         # 本文档
├── CONTRIBUTING.md                   # 贡献记录（追加式更新）
└── README.md                         # 项目手册
```

### 3.2 模块依赖关系

```
前端 (React)  ──HTTP/SSE──>  后端 (FastAPI)  ──SQLAlchemy──>  PostgreSQL
                                    │                              │
                                    ├── Neo4j Driver ──────────> Neo4j
                                    ├── PyMongo ───────────────> MongoDB
                                    ├── Redis Client ──────────> Redis
                                    ├── HTTP Client ───────────> DeepSeek/Qwen API
                                    ├── HTTP Client ───────────> 百度 OCR API
                                    └── MCP Client ────────────> 通义 Web-Search
```

---

## 4. 开发环境配置与依赖管理

### 4.1 必需服务

在开发前，确保以下 4 个数据库服务通过 Docker 运行：

| 服务 | 端口 | Docker 命令 |
|------|------|------------|
| PostgreSQL + pgvector | 5433 | `docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 pgvector/pgvector:pg16` |
| Redis | 6379 | `docker run -d --name redis -p 6379:6379 redis:alpine` |
| Neo4j | 7687 | `docker run -d --name neo4j -e NEO4J_AUTH=neo4j/12345678 -p 7687:7687 neo4j:5` |
| MongoDB | 27017 | `docker run -d --name mongodb -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=123456 -p 27017:27017 mongo:6` |

检查服务状态：`docker ps`

### 4.2 Python 环境

```bash
# 激活虚拟环境（Windows PowerShell）
.\venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt
```

**重要**：每次运行 `pip install` 或执行 Python 代码前，**必须先激活虚拟环境**。

### 4.3 前端环境

```bash
cd frontend
npm install
```

### 4.4 启动命令

**后端**（终端 1）：
```bash
.\venv\Scripts\Activate.ps1
$env:PYTHONPATH="d:\code\MyPython\education-agent"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**前端**（终端 2）：
```bash
cd frontend
npm run dev
```

**端口规则**：
- 后端必须在 **8000** 端口
- 前端默认在 **3000** 端口（Vite 自动分配可用端口）
- 如果端口不对，立即中断并报告

### 4.5 依赖管理（AI 必须严格遵守）

**`requirements.txt` 是项目的依赖清单，AI 每次新增 Python 依赖后必须立即更新它，不允许遗漏！** 如果队友因缺少依赖而报错，首先检查 `requirements.txt` 是否已更新。

当需要引入新的 Python 或 Node.js 依赖时：
1. **Python 依赖**：立即添加到 `requirements.txt`，`pip install <package>` 后必须同步更新
2. **Node.js 依赖**：`cd frontend && npm install <package>`，`package.json` 会自动更新
3. **更新 README.md** 的"技术栈"部分

> ⚠️ 检查时机：每次 `pip install` 后、每次提交前，都必须检查 `requirements.txt` 是否最新。

---

## 5. 代码编写规范与风格指南

### 5.1 通用原则

1. **先了解后编写**：修改文件前，先阅读该文件及其周围文件，理解现有代码风格和模式
2. **最小化变更**：只修改必要的代码行，避免大规模重构
3. **不添加注释**：除非用户明确要求，否则不要添加代码注释
4. **模仿现有风格**：遵循项目中已有的命名规范、缩进风格、导入顺序
5. **依赖即文档**：每引入一个新的 Python 包，必须同时更新 `requirements.txt`，不允许有任何遗漏。`pip install` 后忘记同步 `requirements.txt` 是常见的低级错误，AI 必须杜绝

### 5.2 Python 后端规范

#### 5.2.1 文件组织

```
app/api/endpoints/<resource>.py   # 路由处理器（薄层，仅参数校验和调用 CRUD）
app/crud/<resource>.py           # 数据库操作逻辑
app/models/<resource>.py         # SQLAlchemy ORM 模型
app/schemas/<resource>.py        # Pydantic 请求/响应模型
app/core/<module>.py             # 核心功能模块（认证/搜索/OCR）
app/db/<database>.py             # 数据库连接
```

#### 5.2.2 API 端点规范

```python
from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/resource", tags=["resource"])

@router.post("/")
async def create_resource(
    data: ResourceCreate,
    current_user = Depends(get_current_user),  # JWT 认证（注册/登录除外）
    db = Depends(get_db)
):
    # 1. 参数校验
    # 2. 调用 CRUD
    # 3. 返回标准响应
    pass
```

**关键规则**：
- 所有 API（除注册/登录）都必须通过 `Depends(get_current_user)` 进行 JWT 认证
- 错误响应必须包含 `detail` 字段，且为**中文**提示
- 列表接口必须支持分页（`limit` + `offset`）
- 返回字段使用 `response_model` 进行类型约束

#### 5.2.3 错误响应格式

```python
# 400 - 参数错误
raise HTTPException(status_code=400, detail="用户名长度3-50位，仅支持字母、数字和下划线")

# 401 - 认证失败
raise HTTPException(status_code=401, detail="该账号未注册，请先注册")

# 403 - 权限不足/API 未配置
raise HTTPException(status_code=403, detail="当前模型不可用，请先在设置中配置 API")

# 404 - 资源不存在
raise HTTPException(status_code=404, detail="画像不存在，请先创建")

# 429 - 频率限制
raise HTTPException(status_code=429, detail="登录失败次数过多，账号已锁定。请15分钟后重试")
```

### 5.3 TypeScript/React 前端规范

#### 5.3.1 文件组织

```
frontend/src/
├── api/auth.ts           # 所有 API 调用封装（集中管理）
├── components/           # 可复用的 UI 组件
├── pages/                # 页面级组件（每个路由对应一个页面）
├── store/auth.ts         # Zustand 状态管理
└── types/user.ts         # TypeScript 类型定义
```

#### 5.3.2 API 调用模式

```typescript
// 所有 API 方法集中定义在 frontend/src/api/auth.ts
export const chatApi = {
    sendMessage: (data: ChatRequest) => 
        apiClient.post('/api/v1/chat/completions', data),
    getHistory: (params: HistoryParams) =>
        apiClient.get('/api/v1/chat/history', { params }),
    // ...
};
```

#### 5.3.3 组件编写规范

```tsx
// 页面组件必须包含返回首页按钮（固定定位，左上角）
import { useNavigate } from 'react-router-dom';

const BackButton = () => {
    const navigate = useNavigate();
    return (
        <button 
            onClick={() => navigate('/')}
            style={{ position: 'fixed', top: 16, left: 16, zIndex: 1000 }}
        >
            ← 返回首页
        </button>
    );
};
```

### 5.4 中文错误提示规范

所有用户可见的错误信息必须是**中文**，清晰说明问题和解决方案：

| 场景 | ✅ 正确示例 | ❌ 错误示例 |
|------|-----------|-----------|
| API 未配置 | "当前模型不可用，请先在设置中配置 API" | "API key not configured" |
| 登录失败 | "密码错误，还可以尝试3次" | "Invalid credentials" |
| 数据为空 | "画像不存在，请先创建" | "404 Not Found" |

---

## 6. API 接口与数据结构定义

### 6.1 API 路由总览

| 前缀 | 模块 | 认证 | 主要功能 |
|------|------|------|---------|
| `/api/v1/auth` | 认证 | 否（登录/注册） | 注册、登录、刷新令牌、登出 |
| `/api/v1/profile` | 用户信息 | 是 | 个人信息 CRUD、管理员功能 |
| `/api/v1/profile/v2` | 学习画像 | 是 | 画像 CRUD、知识点、易错点、行为事件 |
| `/api/v1/chat` | AI 对话 | 是 | 流式对话、会话管理、模型列表 |
| `/api/v1/files` | 文件管理 | 是 | 文件上传/下载/删除 |
| `/api/v1/ocr` | OCR | 是 | 图片文字识别 |
| `/api/v1/api-settings` | API 设置 | 是 | 用户级 API Key 管理 |
| `/api/v1/project` | 项目管理 | 是 | 项目 CRUD、提示词、文档 |
| `/api/v1/health` | 健康检查 | 否 | 服务状态 |

### 6.2 核心 API 接口详情

#### 认证接口

```
POST /api/v1/auth/register     # 用户注册
Body: { username, password, confirm_password, email?, major }
Response: { message, user_id }

POST /api/v1/auth/login        # 用户登录
Body: { username, password }
Response: { access_token, refresh_token, token_type, user }

POST /api/v1/auth/refresh      # 刷新令牌
Body: { refresh_token }
Response: { access_token, refresh_token }

POST /api/v1/auth/logout       # 登出
Headers: Authorization: Bearer <token>
```

#### AI 对话接口

```
GET  /api/v1/chat/sessions                    # 获取会话列表（支持搜索）
POST /api/v1/chat/sessions                    # 创建新会话
DELETE /api/v1/chat/sessions/{session_id}     # 删除会话
GET  /api/v1/chat/sessions/{session_id}/messages  # 获取会话消息

POST /api/v1/chat/completions                 # 流式对话（SSE）
Body: {
    session_id,           # 会话 ID（新建时可为 null）
    model,                # 模型名称
    messages,             # 消息列表
    deep_think,           # 深度思考开关
    enable_websearch,     # 联网搜索开关
    file_ids,             # 附件 ID 列表
    project_id            # 项目 ID（可选）
}
Response: text/event-stream
  event: message       # 增量文本
  event: thinking      # 思考过程
  event: done          # 完成（含 token 统计）

GET  /api/v1/chat/models                       # 获取可用模型列表
Response: [{ name, display_name, provider, is_available, supports_multimodal, supports_thinking }]
```

#### 画像接口

```
POST   /api/v1/profile/v2                    # 创建画像
GET    /api/v1/profile/v2                    # 获取完整画像（404→跳转初始化）
GET    /api/v1/profile/v2/summary            # 画像摘要
PUT    /api/v1/profile/v2                    # 更新画像
DELETE /api/v1/profile/v2                    # 删除画像

POST   /api/v1/profile/v2/knowledge          # 添加知识点
PUT    /api/v1/profile/v2/knowledge          # 更新知识点
DELETE /api/v1/profile/v2/knowledge/{point}  # 删除知识点

POST   /api/v1/profile/v2/error-prone        # 添加易错点

POST   /api/v1/profile/v2/behavior           # 记录行为事件
GET    /api/v1/profile/v2/behavior           # 获取行为事件列表
GET    /api/v1/profile/v2/timeline           # 获取变更时间线
```

#### 文件管理

```
POST   /api/v1/files/upload                  # 上传文件（multipart/form-data）
GET    /api/v1/files/{file_id}               # 下载/查看文件
DELETE /api/v1/files/{file_id}               # 删除文件
GET    /api/v1/files/{file_id}/info          # 获取文件信息

POST   /api/v1/chat/attachments              # 创建附件记录
GET    /api/v1/chat/sessions/{session_id}/attachments  # 获取会话附件
DELETE /api/v1/chat/attachments/{id}         # 删除附件
```

#### OCR 接口

```
POST /api/v1/ocr/recognize
Content-Type: multipart/form-data
Body: file=<图片文件>
Response: { success, texts: [...], count }
```

### 6.3 数据隔离规范

| 存储引擎 | 隔离方式 |
|---------|---------|
| PostgreSQL | 所有查询通过 `current_user.id` (UUID) 过滤 |
| Neo4j | 查询中包含 `{student_id}` 参数 |
| MongoDB | 文档中 `student_id` 字段过滤 |
| Redis | Key 格式 `session:{student_id}` 或 `signal:{student_id}:{kp}` |
| 文件存储 | 文件关联 `user_id`，访问时校验 |

---

## 7. 数据库与存储规范

### 7.1 数据库职责划分

| 数据库 | 用途 | 数据类别 |
|--------|------|----------|
| **PostgreSQL + pgvector** | 用户账号、对话历史、API设置、项目、偏好向量 | 结构化关系数据 |
| **Neo4j** | 知识点图谱、掌握度关系、认知风格、易错点关联 | 图结构关系数据 |
| **MongoDB** | 行为事件日志、画像时间线、活跃时段、学习节奏 | 半结构化日志数据 |
| **Redis** | 会话状态、登录锁定计数、信号累积 | 临时缓存数据 |

### 7.2 数据库连接方式

```python
# PostgreSQL - 通过 FastAPI 依赖注入
async def get_db():
    async with async_session() as session:
        yield session

# Neo4j - 通过模块级 driver
from app.db.neo4j import neo4j_driver

# MongoDB - 通过模块级 client
from app.db.mongodb import mongodb_db

# Redis - 通过模块级 client
from app.core.security import redis_client
```

### 7.3 迁移脚本规范

- 迁移脚本放在 `migrations/` 目录
- 命名格式：`<序号>_<描述>.sql`
- 执行方式：`python test_script/run_migration.py`
- 新增表/修改结构必须创建对应的迁移脚本

---

## 8. 前端开发规范

### 8.1 页面必备元素

1. **返回首页按钮**：所有页面左上角固定定位（`position: fixed`）
2. **空数据引导**：数据为空时自动跳转至初始化流程，不显示报错
3. **加载状态**：所有 API 调用显示 loading 状态

### 8.2 提示信息策略

| 场景 | 成功提示 | 失败提示 |
|------|---------|---------|
| 注册/登录等核心界面 | ✅ 弹窗/绿色提示 | ✅ 红色提示框展示具体原因 |
| 基础页面跳转 | ❌ 不提示 | ❌ 不提示 |
| AI 对话完成 | ❌ 不提示 | ✅ 展示具体失败原因 |
| 数据增删改操作 | ✅ 绿色提示框 | ✅ 红色提示框展示具体原因 |

### 8.3 API 可用性前端校验

对于 LLM、OCR、Web Search 等功能：
1. 前端先检查对应 provider 的 API 是否已配置
2. 未配置：功能按钮**置灰**，提示"请配置 API"
3. 已配置但 key 错误：后端返回详细错误，前端展示具体原因
4. 模型列表接口返回 `is_available` 字段，前端据此显示/禁用模型

### 8.4 多模态模型与纯文本模型处理

| 模型类型 | 图片处理方式 | PDF 处理方式 | 代表模型 |
|---------|-------------|-------------|---------|
| 多模态模型 | 直接发送图片（base64），**跳过 OCR** | 不支持直接处理 PDF，由后端用 PyMuPDF 提取正文文本 | qwen3.5-plus, qwen3.6-plus |
| 纯文本模型 | 先 OCR 识别文字，再发送给 AI | 由后端用 PyMuPDF 提取正文文本后发送 | DeepSeek V4 Flash/Pro |

> **PDF 解析说明**：后端使用 **PyMuPDF (fitz)** 库对 PDF 文件进行逐页文本提取，每页标注 `[第N页]` 前缀，限制最大 20000 字符（超出部分截断）。提取的完整文本会注入到用户消息中发送给 AI。`PyMuPDF` 是必需依赖，已添加到 `requirements.txt`。

---

## 9. 代码提交与审查流程

### 9.1 提交信息格式

```
<type>: <subject>

<body>

<footer>
```

**Type 类型**：

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加 OCR 图片文字识别功能` |
| `fix` | 修复 Bug | `fix: 修复登录失败提示信息不具体的问题` |
| `docs` | 文档更新 | `docs: 更新 README.md 技术栈说明` |
| `style` | 代码格式 | `style: 统一缩进为 4 空格` |
| `refactor` | 重构 | `refactor: 提取公共认证中间件` |
| `test` | 测试 | `test: 添加登录锁定功能测试` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |

### 9.2 分支管理

- `main` - 主分支，稳定版本
- `feature/*` - 功能开发分支

### 9.3 开发完成后检查清单

- [ ] 代码符合项目规范（Python: FastAPI 风格, TSX: React 规范）
- [ ] 后端 API 和前端页面功能一致
- [ ] README.md、CONTRIBUTING.md 已更新
- [ ] 相关 PRD 文档的 AI 状态维护表已更新
- [ ] 所有用户可见信息为中文
- [ ] 页面有返回首页按钮
- [ ] 空数据有引导流程
- [ ] **`requirements.txt` 已更新**（如有新增 Python 依赖，这是最容易遗漏的步骤，必须确认）
- [ ] 测试脚本放在 `test_script/` 目录

---

## 10. PRD 驱动的开发流程

### 10.1 标准开发流程

```
1. 阅读 PRD → 了解功能需求
       ↓
2. 查看 AI 状态维护表 → 了解当前进度
       ↓
3. 确定实现顺序 → 优先 P0 核心功能
       ↓
4. 实现后端 API → 编写路由/CRUD/Schema
       ↓
5. 实现前端页面 → 编写组件/页面/API 调用
       ↓
6. 测试验证 → 运行测试脚本，功能验收
       ↓
7. 更新文档 → PRD + CONTRIBUTING + README
```

### 10.2 AI 状态维护表更新规则

每个 PRD 文档包含双格式状态表（Markdown 表格 + JSON）：

**当完成功能时**：
1. 将 `completed` 改为 `true`
2. 在 `notes` 中记录实现细节
3. 等待用户测试后，将 `passed` 改为 `true`

**当用户反馈问题时**：
1. 将 `passed` 改为 `false`
2. 在 `user_feedback` 中记录反馈内容
3. 在 `notes` 中记录修复计划

**状态流转**：
```
未开始 → 已完成 (completed=true) → 已通过 (passed=true)
              ↓
        用户反馈 Bug → 修复中 → 已完成 → 已通过
```

### 10.3 CONTRIBUTING.md 更新规范

更新 `CONTRIBUTING.md` 时：
1. **只能追加，不能覆盖**已有内容
2. 按时间倒序添加新的贡献记录
3. 每条记录包含：日期、功能描述、新增文件列表、修改文件列表、功能说明

---

## 11. 常见问题解决方案

### 11.1 后端启动报错

| 报错 | 原因 | 解决方案 |
|------|------|---------|
| `ModuleNotFoundError: No module named 'app'` | PYTHONPATH 未设置 | `$env:PYTHONPATH="d:\code\MyPython\education-agent"` |
| `启动失败：当前配置使用了 SQLite` | `.env` 中 `USE_SQLITE=True` | 改为 `USE_SQLITE=false` |
| `启动失败：无法连接到 PostgreSQL` | PostgreSQL 服务未运行 | `docker start postgres` |
| PostgreSQL 连接异常 | 用户名/密码/端口错误 | 检查 `.env` 配置 |

### 11.2 前端启动问题

| 问题 | 解决方案 |
|------|---------|
| 端口不是 3000 | Vite 自动分配，查看终端输出确认 |
| API 请求 404 | 检查 Vite 代理配置 `vite.config.ts` |
| 热更新不生效 | 重启 `npm run dev` |
| `npm install` 失败 | 删除 `node_modules` 重试 |

### 11.3 功能不可用

| 功能 | 前置条件 | 检查项 |
|------|----------|--------|
| LLM 对话 | DeepSeek/Qwen API Key | `.env` 中 `DEEPSEEK_API_KEY` / `QWEN_API_KEY` |
| OCR 识别 | 百度 OCR Key + Secret | `.env` 中 `BAIDU_OCR_API_KEY` / `BAIDU_OCR_SECRET_KEY` |
| 联网搜索 | 通义 API Key | `.env` 中 `QWEN_API_KEY` |
| PDF 解析 | PyMuPDF (fitz) | `requirements.txt` 中必须包含 `PyMuPDF`，运行 `pip install PyMuPDF` |
| 画像管理 | Neo4j + MongoDB 运行 | `docker ps` 检查 |

### 11.4 数据库问题

| 问题 | 解决方案 |
|------|---------|
| 表不存在 | 执行 `python test_script/run_migration.py` |
| Docker 容器未运行 | `docker start postgres redis neo4j mongodb` |
| 端口冲突 | 检查 `.env` 中的端口配置 |

### 11.5 Bug 排查原则

当用户报告 Bug 时：
1. **前后端一起检查**：前端错误通常伴随后端错误，必须两端都排查
2. 使用默认账号 `guoketg / 123456` 登录测试
3. 先复现问题，再定位根因，最后修复

---

## 12. 与 Agent 协作的最佳实践

### 12.1 Agent 启动时的标准初始化流程

每次开始编码任务时，Agent 应按以下顺序操作：

```
1. 阅读 AGENTS.md（本文档）← 了解开发指南
2. 阅读 CLAUDE.md ← 了解开发规范
3. 阅读相关 PRD 文档 ← 了解功能需求
4. 查看 AI 状态维护表 ← 了解当前进度
5. 阅读目标文件 ← 了解现有代码
6. 使用 TodoWrite 规划任务 ← 拆解实施步骤
7. 开始编码
```

### 12.2 编码前的检查要点

- [ ] 虚拟环境已激活（`.\venv\Scripts\Activate.ps1`）
- [ ] 数据库服务全部运行（`docker ps`）
- [ ] 后端在 8000 端口，前端在 3000 端口
- [ ] 目标文件已阅读，理解现有代码风格

### 12.3 编码中的行为准则

1. **优先搜索已有代码**：使用 SearchCodebase 了解现有实现，避免重复造轮子
2. **小步快跑**：每次修改一个功能点，及时验证
3. **保持一致性**：新代码风格与现有代码保持一致
4. **先后端后前端**：先实现 API 端点，再实现前端页面
5. **同步更新文档**：代码修改后立即更新相关文档

### 12.4 编码后的验证步骤

```bash
# 1. 后端验证 - 启动后端检查有无报错
.\venv\Scripts\Activate.ps1
$env:PYTHONPATH="d:\code\MyPython\education-agent"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. 前端验证 - 启动前端检查有无报错
cd frontend
npm run dev

# 3. 功能验证 - 通过浏览器访问 http://localhost:3004 手动测试
```

### 12.5 文档更新地图

当修改某个功能时，按以下映射关系更新文档：

| 修改内容 | 需更新的文档 |
|---------|-------------|
| 新增 API 端点 | README.md(API接口部分)、CONTRIBUTING.md、PRD 状态表 |
| 新增前端页面 | README.md(系统架构)、CONTRIBUTING.md、PRD 状态表 |
| 新增 Python 依赖 | requirements.txt、README.md(技术栈) |
| 修改数据库结构 | migrations/ 新脚本、README.md(数据库设置) |
| 修改环境变量 | .env.example（如有）、README.md(环境配置) |
| Bug 修复 | CONTRIBUTING.md（追加修复记录） |

### 12.6 安全性规范

1. **绝不硬编码密钥**：所有 API Key、密码等通过 `.env` 读取
2. **绝不提交 `.env`**：确保 `.env` 在 `.gitignore` 中
3. **JWT 保护所有 API**：除注册/登录外的一切 Endpoint
4. **数据隔离**：所有数据库查询必须按 `student_id` 过滤
5. **密码加密**：使用 bcrypt，cost factor ≥ 12

### 12.7 与用户协作的沟通规范

| 情况 | Agent 行为 |
|------|-----------|
| 需求不明确 | **立即中断**，向用户询问 |
| 存在多种实现方案 | 列出选项，让用户决策 |
| 需要修改 `.env` | **询问用户授权** |
| 发现潜在安全风险 | **立即中断**并说明原因 |
| 测试通过 | 报告结果，等待下一步指令 |

---

## 13. 文件修改速查表

### 当需要添加 XXX 功能时，应该修改的文件：

| 新增功能 | 后端文件 | 前端文件 | 文档更新 |
|---------|---------|---------|---------|
| 新 API 端点 | `app/api/endpoints/<name>.py` | `frontend/src/api/auth.ts`（添加调用方法） | README, CONTRIBUTING |
| 新数据库模型 | `app/models/<name>.py` + `migrations/` | - | CONTRIBUTING |
| 新前端页面 | - | `frontend/src/pages/<Name>.tsx` + `App.tsx`（路由） | README, CONTRIBUTING |
| 新 CRUD 操作 | `app/crud/<name>.py` | - | CONTRIBUTING |
| 新 Schema | `app/schemas/<name>.py` | - | CONTRIBUTING |
| 新核心模块 | `app/core/<name>.py` | - | CONTRIBUTING |
| 新组件 | - | `frontend/src/components/<Name>.tsx` | CONTRIBUTING |
| 新数据库连接 | `app/db/<name>.py` | - | README, CONTRIBUTING |
| Bug 修复 | 前后端一起检查 | 前后端一起检查 | CONTRIBUTING（追加） |

---

*本文档由 AI Agent 维护，最后更新：2026-05-10*
