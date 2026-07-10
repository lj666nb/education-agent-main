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
| 代码判题 | 独立 Python 隔离运行器（Unix Socket + 资源限制） |

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

# 2. 一键启动所有服务
docker-compose up -d

# 3. 访问
# 前端: http://localhost:3000
# 后端 API 文档: http://localhost:8000/api/v1/docs
```
> 首次启动时后端会自动执行所需的版本化数据库迁移、创建数据库表并注入种子数据（测试用户、题库、知识图谱等），无需手动初始化。升级已有 Docker 数据卷时也会幂等执行尚未应用的迁移。

### 启用 AI 功能（可选）

如果需要使用 AI 对话、AI 出题、学习路径生成等功能，创建 `.env` 并配置 API Key：

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

```env
# DeepSeek（推荐，二选一即可）
DEEPSEEK_API_KEY=sk-your-key-here

# Qwen（备选）
QWEN_API_KEY=your-key-here
```

> 修改 `.env` 后重启生效：`docker-compose restart backend`
> 
> 不配置 API Key 也能正常使用：浏览种子题库、查看学习资源、练习题目等离线功能完全可用。

### 种子数据

**容器首次启动时，后端会自动注入以下种子数据（幂等操作，不会重复创建）：**

| 数据类别 | 内容 | 说明 |
|---------|------|------|
| **测试用户** | guoketg / 123456 | 可用于直接登录体验 |
| **学科** | 数据结构（C语言版 第2版） | 9 大章节 |
| **知识点** | 80+ 个知识点 | 覆盖线性表、栈队列、树、图、排序、查找等 |
| **题库** | 数据结构题库 | 130+ 道题目（含选择题和简答题） |
| **代码练习** | 21 道数据结构编程题 | 7 个知识点，每个知识点固定简单/中等/困难各 1 题，题目来源信息可追溯 |
| **代码案例** | 19 个可运行的 Python 代码案例 | 绑定到 guoketg 用户的个性化资源中 |
| **知识图谱** | Neo4j 知识图谱 | 知识点间的 PREREQUISITE 和 RELATED_TO 关系 |

启动后即可使用测试账号 `guoketg / 123456` 登录，在「个性化学习资源」页面查看代码案例，在「题库练习」中做题。

> ⚠️ **学习路径、个性化推荐**等数据需要用户实际使用 AI 功能后生成（非静态种子数据）。首次登录后使用「学习路径规划」功能即可生成。

### 知识图谱工作台

登录后打开 `/knowledge-graph`，可在同一工作台内完成以下流程：

1. 从左侧图库选择已有学科，右侧查看可缩放、拖拽和切换布局的知识图谱。
2. 导入 PDF、DOCX 或 PPTX 学习材料，查看解析、实体抽取、知识融合和数据库导入的真实进度。
3. 在“问答”标签中基于当前图谱进行 RAG 流式问答，并在画布中高亮引用节点。
4. 携带当前 `subjectId` 进入知识点列表或个性化学习路径生成流程。

旧版 `.doc`、`.ppt` 文件可选择，但无法直接解析文本；界面会提示先另存为 `.docx`、`.pptx`。知识图谱构建依赖用户已配置的 DeepSeek 或 Qwen API。

### 数据结构代码练习

登录后打开 `/coding-practice`，可按知识点和难度选择代码题。内置题库共 21 题，覆盖数组、单链表、栈、队列、哈希表、二叉树遍历和图 7 个知识点；每个知识点最多 3 题，分别为简单、中等、困难。题目记录牛客网或力扣的来源名称、编号和原题链接，题面、提示、代码模板及测试数据为项目内独立适配内容。

完整做题流程如下：

1. 选择知识点与难度，阅读学习目标、任务步骤、输入输出、样例、约束和边界条件。
2. 在带 `TODO` 的 Python 模板中完成代码；需要帮助时按顺序展开三级提示。
3. 点击“运行”执行公开样例，查看逐用例的实际输出、期望输出和真实运行轨迹。
4. 点击“提交”运行服务端隐藏测试；判题结果和代码由服务端写入提交记录，前端不能自行声明通过。
5. 完成至少一次提交后，可查看参考解法并继续修正代码。

代码不会在后端 Web 进程中直接执行。Docker Compose 会同时启动无网络、只读文件系统的 `code-runner` 服务，并通过共享 Unix Socket 接收任务；单次运行设有时间、内存、进程数、文件大小和输出大小限制。为了获得完整且一致的判题环境，代码练习功能建议使用上面的 Docker Compose 启动方式。

### 常用命令

```bash
# 重启后端（代码修改后）
docker-compose restart backend

# 重启前端
docker-compose restart frontend

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f code-runner

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
