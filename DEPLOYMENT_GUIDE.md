# Education Agent 部署指南

本文档为 Education Agent 项目的本地 Docker 部署说明。

---

## 1. 环境准备

### 1.1 软件要求

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| Docker Desktop | 最新版 | [下载地址](https://www.docker.com/products/docker-desktop/) |
| Windows 10/11 | 专业版或以上 | 需要支持 WSL2 |

### 1.2 安装步骤

1. 下载并安装 **Docker Desktop**
2. 安装过程中勾选 **WSL 2**（如果未安装）
3. 安装完成后启动 Docker Desktop
4. 等待托盘图标显示绿色鲸鱼，确认 Docker 已运行

### 1.3 验证安装

打开 PowerShell，运行以下命令验证：

```powershell
docker --version
docker compose version
docker ps
```

---

## 2. 项目准备

### 2.1 获取项目

**方式一：解压提供的压缩包**

```powershell
# 解压项目（假设压缩包名为 education-agent.zip）
Expand-Archive -Path education-agent.zip -DestinationPath .
cd education-agent
```

**方式二：从 Git 克隆**

```powershell
git clone <仓库地址>
cd education-agent
```

### 2.2 配置环境变量

```powershell
# 复制环境变量模板
copy .env.example .env
```

默认配置已包含所有必要的环境变量，无需修改。

### 2.3 文件目录结构

```
education-agent/
├── app/                    # 后端代码
├── frontend/               # 前端代码
├── migrations/             # 数据库迁移脚本
├── docker-compose.yml      # Docker Compose 配置
├── Dockerfile.backend       # 后端镜像构建文件
├── Dockerfile.frontend     # 前端镜像构建文件
├── requirements.txt        # Python 依赖
├── all-images.tar          # 预打包的 Docker 镜像（可选）
└── .env                    # 环境变量配置
```

---

## 3. 启动服务

### 3.1 方式一：使用预打包镜像（推荐，网络不佳时）

如果项目包含 `all-images.tar` 文件，先加载镜像：

```powershell
# 加载所有镜像（约 3.7GB）
docker load -i all-images.tar

# 启动所有服务
docker compose up -d
```

### 3.2 方式二：自动构建（网络良好时）

```powershell
# 构建并启动所有服务
docker compose up -d --build
```

### 3.3 验证启动状态

```powershell
# 查看所有容器状态
docker compose ps

# 预期输出应显示所有容器状态为 healthy/running
```

---

## 4. 服务访问

启动成功后可通过以下地址访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端首页 | http://localhost:3000 | 教育智能体主界面 |
| 后端 API | http://localhost:8000 | FastAPI 服务 |
| API 文档 | http://localhost:8000/docs | Swagger UI |
| Neo4j 浏览器 | http://localhost:7474 | 图数据库管理界面 |
| Neo4j Bolt | bolt://localhost:7687 | Neo4j 连接地址 |

### 4.1 登录账号

- 用户名：`guoketg`
- 密码：`123456`

---

## 5. 常用操作命令

### 5.1 查看服务状态

```powershell
# 查看所有容器
docker compose ps

# 查看实时日志
docker compose logs -f

# 查看指定服务日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 5.2 查看日志与错误排查

**查看所有服务日志：**

```powershell
# 实时查看所有服务日志
docker compose logs -f

# 查看最近 100 行日志
docker compose logs --tail=100

# 查看指定服务的日志
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
docker compose logs redis
docker compose logs neo4j
docker compose logs mongodb
```

**查看后端详细日志（最重要的排查手段）：**

```powershell
# 实时查看后端日志
docker compose logs -f backend

# 查看后端最近 200 行日志
docker compose logs --tail=200 backend

# 查看后端启动以来的所有日志
docker compose logs backend

# 搜索日志中的错误关键字
docker compose logs backend | Select-String -Pattern "error|Error|ERROR|Exception|failed"

# 搜索日志中的警告
docker compose logs backend | Select-String -Pattern "warning|WARNING"
```

**查看前端详细日志：**

```powershell
# 实时查看前端 nginx 日志
docker compose logs -f frontend

# 查看前端访问日志（谁访问了页面）
docker compose logs --tail=100 frontend | Select-String -Pattern "GET|POST|PUT|DELETE"

# 查看前端错误日志
docker compose logs frontend | Select-String -Pattern "error|Error|ERROR"
```

**进入容器内部查看日志文件：**

```powershell
# 进入后端容器
docker exec -it ea-backend /bin/bash

# 注意：后端日志直接输出到 stdout，没有单独的文件
# 退出容器后用 docker compose logs 查看（见上方）

# 退出容器
exit

# 进入前端容器
docker exec -it ea-frontend /bin/sh

# 在容器内查看 nginx 日志
cat /var/log/nginx/access.log
cat /var/log/nginx/error.log

# 退出容器
exit
```

**重要：后端日志查看方式**

后端使用 uvicorn 运行，日志**直接输出到容器 stdout**，没有写入文件。

正确查看方式：
```powershell
# 在宿主机（不是容器内）执行
docker compose logs -f backend
```

而不是进入容器后查看文件。

**查看数据库相关日志：**

```powershell
# 查看 PostgreSQL 日志
docker compose logs --tail=100 postgres

# 查看 Redis 日志
docker compose logs --tail=100 redis

# 查看 MongoDB 日志
docker compose logs --tail=100 mongodb

# 查看 Neo4j 日志
docker compose logs --tail=100 neo4j
```

**常见日志关键词搜索：**

| 关键词 | 含义 |
|--------|------|
| `ModuleNotFoundError` | Python 缺少某个模块（依赖未安装） |
| `Connection refused` | 连接被拒绝，服务未启动或端口错误 |
| `Connection timeout` | 连接超时，网络问题或服务未响应 |
| `404` | 资源不存在 |
| `500` | 服务器内部错误 |
| `health check failed` | 健康检查失败 |
| `healthy` | 服务正常运行 |

**综合日志分析示例：**

```powershell
# 查看最近 1 分钟的后端错误日志
docker compose logs --since=1m backend | Select-String -Pattern "error|Error|Exception|Traceback"

# 搜索包含 "postgres" 或 "database" 的日志
docker compose logs backend | Select-String -Pattern "postgres|database|Database"

# 搜索包含 "redis" 或 "cache" 的日志
docker compose logs backend | Select-String -Pattern "redis|cache|Cache"

# 实时监控错误输出（Ctrl+C 停止）
docker compose logs -f backend | Select-String -Pattern "error|Error|ERROR|FATAL"
```

---

### 5.4 停止/重启服务

```powershell
# 停止所有服务
docker compose down

# 重启所有服务
docker compose restart

# 重启指定服务
docker compose restart backend
```

### 5.5 进入容器

```powershell
# 进入后端容器
docker exec -it ea-backend /bin/bash

# 进入 PostgreSQL 容器
docker exec -it ea-postgres psql -U postgres -d education_agent
```

### 5.6 清理环境

```powershell
# 停止并删除所有容器
docker compose down

# 删除所有数据卷（会清除数据库数据！）
docker compose down -v

# 删除构建缓存
docker compose build --no-cache
```

---

## 6. 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | frontend | 前端页面 |
| 5432 | postgres | PostgreSQL 数据库 |
| 6379 | redis | Redis 缓存 |
| 7474 | neo4j | Neo4j 浏览器 |
| 7687 | neo4j | Neo4j Bolt 协议 |
| 8000 | backend | 后端 API |
| 27017 | mongodb | MongoDB 数据库 |

**如果端口被占用：**

```powershell
# 查看端口占用
netstat -ano | findstr :3000

# 或者修改 docker-compose.yml 中的端口映射
```

---

## 7. 常见问题排查

### 7.1 Docker Desktop 无法启动

**问题**：提示 `The system cannot find the file specified`

**解决**：
1. 重启电脑
2. 打开任务管理器 → 服务 → 找到 "Docker Desktop" 并启动
3. 如果仍无法启动，尝试卸载重装 Docker Desktop

### 7.2 容器一直处于 restarting 状态

**排查步骤**：

```powershell
# 1. 查看具体容器的错误日志
docker compose logs backend
docker compose logs frontend

# 2. 查看容器详细状态
docker compose ps

# 3. 如果是端口冲突，检查端口
netstat -ano | findstr :5432
netstat -ano | findstr :6379
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# 4. 检查 docker-desktop-linux 引擎是否运行
# 打开任务管理器 → 服务 → 确保 Docker Desktop 相关服务正在运行
```

### 7.3 后端连接数据库失败

**常见错误**：
```
ModuleNotFoundError: No module named 'xxx'
psycopg2.OperationalError: could not connect to server
redis.exceptions.ConnectionError
neo4j.exceptions.ServiceUnavailable
pymongo.errors.ServerSelectionTimeoutError
```

**排查步骤**：

```powershell
# 1. 检查数据库容器是否健康
docker compose ps postgres
docker compose ps redis
docker compose ps neo4j
docker compose ps mongodb

# 2. 查看后端详细错误
docker compose logs backend | Select-String -Pattern "error|Error|Exception|Traceback"

# 3. 检查数据库连接配置
# 查看 docker-compose.yml 中的环境变量配置是否正确

# 4. 进入数据库容器测试连接
docker exec -it ea-postgres pg_isready -U postgres
docker exec -it ea-redis redis-cli ping
docker exec -it ea-mongodb mongosh --eval "db.runCommand('ping')"

# 5. 如果是依赖缺失，需要修改 requirements.txt 后重新构建
# 在宿主机修改 requirements.txt 添加缺失的包，然后：
docker compose up -d --build backend
```

### 7.4 前端无法访问

**排查步骤**：

```powershell
# 1. 检查 nginx 容器状态
docker compose ps frontend

# 2. 查看 nginx 错误日志
docker compose logs frontend

# 3. 进入容器检查 nginx 配置
docker exec -it ea-frontend /bin/sh
cat /etc/nginx/conf.d/default.conf
nginx -t

# 4. 检查静态文件是否存在
ls -la /usr/share/nginx/html/

# 5. 如果是构建失败，查看构建日志
docker compose build frontend
```

### 7.5 前端构建失败（TS/JS 错误）

**常见错误**：
```
error TS6133: 'xxx' is declared but its value is never read
error TS2339: Property 'xxx' does not exist on type 'xxx'
SyntaxError: Cannot use import statement outside a module
```

**排查步骤**：

```powershell
# 1. 查看前端构建日志
docker compose logs frontend | Select-String -Pattern "error|Error|ERROR"

# 2. 在宿主机本地构建前端检查错误
cd frontend
npm run build

# 3. 常见解决方法：
# - TS6133: 删除未使用的变量，或在 tsconfig.json 中设置 noUnusedLocals: false
# - TS2339: 检查类型定义是否正确导入
# - 修复后重新构建
docker compose up -d --build frontend
```

### 7.6 拉取镜像失败（网络问题）

```powershell
# 方式一：配置 Docker 镜像加速
# 打开 Docker Desktop → 设置 → Docker Engine
# 添加镜像源：
# "registry-mirrors": ["https://docker.1ms.run"]

# 方式二：使用预打包的 all-images.tar
docker load -i all-images.tar
```

### 7.7 数据库迁移失败

```powershell
# 1. 查看迁移日志
docker compose logs backend | Select-String -Pattern "migrate|migration|Alembic"

# 2. 手动执行数据库迁移
docker exec -it ea-backend python -m alembic upgrade head

# 3. 查看迁移脚本
ls -la migrations/

# 4. 如果迁移脚本有问题，可能需要重置数据库
docker compose down -v  # 警告：会删除所有数据
docker compose up -d
```

### 7.8 内存不足导致构建失败

**问题**：构建过程中提示 OOM (Out of Memory)

**解决**：
1. 关闭其他占用内存的程序
2. 在 Docker Desktop 设置中增加内存分配
3. 打开 Docker Desktop → Settings → Resources → Memory → 调整为 8GB 或更多

---

## 8. 数据备份与恢复

### 8.1 备份数据库

```powershell
# 备份 PostgreSQL
docker exec -it ea-postgres pg_dump -U postgres education_agent > backup.sql

# 备份 MongoDB
docker exec -it ea-mongodb mongodump --archive=backup.archive
```

### 8.2 恢复数据

```powershell
# 恢复 PostgreSQL
docker exec -it ea-postgres psql -U postgres -d education_agent < backup.sql

# 恢复 MongoDB
docker exec -it ea-mongodb mongorestore --archive=backup.archive
```

---

## 9. 开发相关

### 9.1 修改代码后重新构建

```powershell
# 重新构建并启动
docker compose up -d --build

# 只重新构建某个服务
docker compose up -d --build backend
```

### 9.2 前端开发模式

前端代码修改后自动重新构建，无需手动操作。

### 9.3 后端调试

```powershell
# 查看后端实时日志
docker compose logs -f backend

# 后端代码修改后自动重载
# uvicorn 已配置 --reload 选项
```

---

## 10. 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 后端 | FastAPI + Python 3.12 | Web 框架 |
| 数据库 | PostgreSQL 16 (pgvector) | 主数据库 + 向量存储 |
| 缓存 | Redis 7 | 缓存服务 |
| 图数据库 | Neo4j 5 | 知识图谱 |
| 文档数据库 | MongoDB 7 | 文档存储 |
| 前端 | React + TypeScript + Vite | 用户界面 |
| Web 服务器 | Nginx | 前端资源服务 |
