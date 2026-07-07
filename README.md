# Education Agent - 个性化学习资源生成与学习多智能体系统

基于大模型的个性化资源生成与学习多智能体系统，为学生提供专属的个性化学习智能体。包含 AI 对话（含 Draw.io 图表生成）、题库练习、学习画像、项目管理等功能。

> 详细开发记录见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 技术栈

| 层 | 技术 |
|------|------|
| 后端 | FastAPI (Python 3.12) |
| 前端 | React 18 + TypeScript + Vite |
| LLM | DeepSeek API / Qwen API（流式输出 + 深度思考） |
| 图表 | Draw.io 嵌入（[react-drawio](https://github.com/datkat21/react-drawio)）+ AI 自动生成 |
| 数据库 | PostgreSQL + pgvector, Neo4j, MongoDB |
| 缓存 | Redis |
| 认证 | JWT + bcrypt |
| 向量检索 | FAISS + sentence-transformers |

---

## 🎨 Draw.io 智能图表

AI 对话中内置 **Draw.io 图表编辑器**，支持 AI 自动生成和修改各种专业图表：

| 图表类型 | 示例用途 |
|---------|---------|
| **流程图** | 算法流程、业务流程、决策路径 |
| **思维导图** | 知识梳理、概念展开、学习规划 |
| **架构图** | 系统架构、网络拓扑、云服务部署 |
| **UML 图** | 类图、时序图、用例图 |
| **实体关系图** | 数据库设计、数据模型 |
| **网络拓扑图** | 网络架构、服务器部署 |
| **泳道图** | 跨部门流程、角色分工 |
| **ER 图** | 数据库关系建模 |

**使用方式**：在 AI 对话中描述你想画的图表（如"画一个冒泡排序流程图"），AI 自动生成可编辑的 Draw.io 图表并显示在右侧面板中。你可以继续要求 AI 修改（如"加一个初始化标志位"），或手动拖拽编辑。

**界面布局**：聊天界面右侧可打开 Draw.io 编辑器面板，支持拖拽调整大小。图表会被保存到对话历史中，回看时自动恢复。

---

## 快速启动（Docker Compose，推荐）

### 前置条件

- Docker & Docker Compose
- 端口 3000、8000、5432、6379、7687、27017 未被占用

### 启动步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd education-agent

# 2. 配置环境变量（可选，默认即可启动）
# 编辑 .env 填入 API Key 等配置（见下方说明）

# 3. 一键启动所有服务
docker-compose up -d

# 4. 查看启动状态
docker-compose ps

# 5. 初始化数据库
docker exec -it ea-backend python -m app.scripts.run_migration

# 6. 访问
# 前端: http://localhost:3000
# 后端: http://localhost:8000
```

### 首次配置

编辑 `.env`，至少配置一个 LLM API Key 才能使用 AI 对话和出题功能：

```env
# DeepSeek（推荐）
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-v4-pro

# Qwen（可选）
QWEN_API_KEY=your-key-here
QWEN_MODEL=qwen-turbo
```

> 完整的 `.env` 配置项参见 `.env` 文件。Docker 模式下数据库连接已自动配置，无需修改。

### 种子数据

**容器首次启动时，后端会自动注入以下种子数据（幂等操作，不会重复创建）：**

| 数据类别 | 内容 | 说明 |
|---------|------|------|
| **测试用户** | guoketg / 123456 | 可用于直接登录体验 |
| **学科** | 数据结构（C语言版 第2版） | 9 大章节 |
| **知识点** | 80+ 个知识点 | 覆盖线性表、栈队列、树、图、排序、查找等 |
| **题库** | 数据结构题库 | 130+ 道题目（含选择题和简答题） |
| **代码案例** | 19 个可运行的 Python 代码案例 | 绑定到 guoketg 用户的个性化资源中 |
| **知识图谱** | Neo4j 知识图谱 | 知识点间的 PREREQUISITE 和 RELATED_TO 关系 |

启动后即可使用测试账号 `guoketg / 123456` 登录，在「个性化学习资源」页面查看代码案例，在「题库练习」中做题。

> ⚠️ **学习路径、个性化推荐**等数据需要用户实际使用 AI 功能后生成（非静态种子数据）。首次登录后使用「学习路径规划」功能即可生成。

### 常用命令

```bash
# 重启后端（代码修改后）
docker-compose restart backend

# 重启前端
docker-compose restart frontend

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 停止所有服务
docker-compose down

# 停止并删除数据卷（清空数据库）
docker-compose down -v
```

---

## 本地开发（非 Docker）

### 1. 启动数据库服务

```bash
docker-compose up -d postgres redis neo4j mongodb
```

### 2. 后端

```bash
# 创建虚拟环境
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate   # Linux/Mac

# 安装依赖
pip install -r requirements.txt

# 设置 PYTHONPATH
$env:PYTHONPATH="d:\code\MyPython\education-agent"  # Windows PowerShell

# 执行数据库迁移
python -m app.scripts.run_migration

# 启动后端（热更新）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 http://localhost:3000，端口被占用时会自动递增。

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 测试用户 | guoketg | 123456 |

> 首次部署请修改管理员密码。

---

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000/api/v1 |

---

## 项目结构

```
education-agent/
├── app/                    # FastAPI 后端
│   ├── api/endpoints/      # API 端点
│   ├── core/               # 核心模块（配置、安全、向量检索等）
│   ├── crud/               # CRUD 操作
│   ├── db/                 # 数据库连接（PostgreSQL/Neo4j/MongoDB）
│   ├── models/             # 数据模型
│   └── schemas/            # Pydantic 模型
├── frontend/               # React 前端
│   └── src/
│       ├── api/            # API 客户端
│       ├── components/     # 公共组件
│       ├── pages/          # 页面
│       └── store/          # 状态管理
├── migrations/             # 数据库迁移脚本
├── request/                # PRD 文档
└── docker-compose.yml      # Docker 编排
```

---

## 了解更多

- [开发规范与贡献记录](CONTRIBUTING.md) — 详细开发时间线、功能实现记录、项目规范
- [AI 开发指南](AGENTS.md) — 面向 AI Agent 的编码指南

---

## License

MIT
