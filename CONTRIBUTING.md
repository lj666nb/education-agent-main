# 项目贡献记录 (CONTRIBUTING)

本文档记录项目的开发时间线和每次贡献的内容，供后续开发者（包括 AI Agent）了解项目进度。

---

## 开发时间线

### 2026-05-10 - AGENTS.md AI 开发指南

**贡献者**: AI Assistant

---

### 0. AGENTS.md 开发指南文档

**功能**：编写全面的 AGENTS.md 文档，为 AI Agent 提供高效编码的完整操作指南

**新增文件**:
| 文件 | 说明 |
|------|------|
| `AGENTS.md` | AI Agent 高效开发指南，涵盖角色定位、架构说明、编码规范、API 定义、开发流程等 |

**文档内容**:
- AI Agent 角色定位与能力边界
- 项目概览（背景、核心功能模块、技术栈）
- 完整项目架构与模块划分说明
- 开发环境配置与依赖管理
- 代码编写规范与风格指南（Python/TypeScript）
- API 接口与数据结构定义（含所有路由表）
- 数据库与存储规范
- 前端开发规范（提示策略、可用性校验、多模态处理）
- 代码提交格式与审查流程
- PRD 驱动的开发流程
- 常见问题与解决方案
- Agent 最佳实践（启动流程、编码准则、验证步骤、文档更新地图、沟通规范）
- 文件修改速查表

---

### 2026-05-10 - 联网搜索功能

**贡献者**: AI Assistant

---

### 0. 联网搜索功能

**功能**：集成阿里云百炼 MCP 联网搜索服务，允许 AI 在回答时结合实时网络信息

**新增文件**:
| 文件 | 说明 |
|------|------|
| `app/core/web_search.py` | 联网搜索服务模块，使用 pydantic-ai 的 MCPServerStreamableHTTP |
| `test_script/test_web_search.py` | 联网搜索功能测试脚本 |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/api/endpoints/chat.py` | `ChatCompletionRequest` 添加 `enable_websearch` 字段，集成联网搜索增强逻辑 |
| `frontend/src/components/ChatPlatform.tsx` | 添加 `enableWebsearch` 状态，传递给 API |
| `frontend/src/components/InputArea.tsx` | 添加"联网搜索"开关按钮 |

**使用方式**:
1. 用户在前端聊天界面点击"联网搜索"按钮开启（绿色高亮）
2. 发送消息时，`enable_websearch: true` 传给后端
3. 后端使用阿里云百炼 MCP WebSearch 服务获取搜索结果
4. 搜索结果以 `[联网搜索结果]` 格式插入到用户消息前作为上下文
5. AI 结合搜索结果回答问题

**API 参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `enable_websearch` | boolean | 是否启用联网搜索，默认 false |

**依赖安装**:
```bash
pip install "pydantic-ai-slim[mcp]" "pydantic-ai-slim[openai]"
```

**百炼 MCP 服务**:
- URL: `https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp`
- 需要配置百炼 API Key（通过 `QWEN_API_KEY` 或用户级 API 设置）

---

### 2026-05-10 - OCR 图片文字识别功能

**贡献者**: AI Assistant

---

### 0. OCR 功能

**功能**：集成百度 OCR 通用文字识别服务，允许用户上传图片并识别其中的文字，让纯文本模型也能理解图片内容

**新增文件**:
| 文件 | 说明 |
|------|------|
| `app/core/ocr.py` | OCR 服务模块，使用百度智能云通用文字识别 API |
| `app/api/endpoints/ocr.py` | OCR REST API 端点 `/ocr/recognize` |
| `test_script/test_baidu_ocr.py` | OCR 功能测试脚本 |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/models/api_settings.py` | 添加 `secret_key` 字段存储百度 OCR Secret Key |
| `app/schemas/api_settings.py` | 添加 `secret_key` 字段，`ApiSettingUpdate` 也添加 `secret_key` |
| `app/crud/api_settings.py` | CRUD 操作支持 `secret_key` 字段 |
| `app/main.py` | 注册 `ocr` 路由 |
| `app/api/endpoints/api_settings.py` | 添加 OCR 保存时验证 Secret Key 是否存在 |
| `frontend/src/pages/ApiSettingsPage.tsx` | OCR 配置添加 Secret Key 输入框，保存时传递 `secret_key` |

**API 端点**:
```
POST /api/v1/ocr/recognize
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <图片文件>
```

**响应格式**:
```json
{
  "success": true,
  "texts": ["文字1", "文字2", ...],
  "count": 54
}
```

**OCR 用途**:
- 用户上传包含文字的图片（如截图、文档照片）
- 系统识别图片中的文字
- 识别的文字插入到聊天输入框中
- 发送给 AI 进行处理

**支持的 Provider**:
- `ocr`: 百度智能云通用文字识别 API

**百度 OCR 申请**:
- 地址: https://ai.baidu.com/tech/ocr
- 需要 API Key 和 Secret Key

---

### 2026-05-10 - 剪贴板粘贴功能（文件预览区）

**贡献者**: AI Assistant

---

### 0. 剪贴板粘贴功能（文件预览区）

**功能**：在 AI Chat 输入框中支持直接粘贴图片或 PDF 文件，文件会上传到服务器；多模态模型(qwen3.5-plus/3.6-plus)直接发送图片给AI；纯文本模型使用OCR；粘贴后在输入框上方显示缩略图预览区，AI回复时仍可见，点击可查看大图；附件持久化到数据库，切换对话时可恢复

**新增文件**:
| 文件 | 说明 |
|------|------|
| `app/api/endpoints/files.py` | 文件上传、下载、删除、获取文件信息API |
| `app/models/chat.py` | 添加 ChatAttachment 模型 |
| `migrations/003_create_chat_attachments.sql` | 创建 chat_attachments 表 |
| `uploads/` | 文件存储目录 |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/main.py` | 注册 files 路由 |
| `app/api/endpoints/chat.py` | 添加 file_ids 参数，添加 load_and_process_file 函数处理文件；根据模型类型决定OCR还是直接发送图片；多模态模型返回base64格式给AI；添加附件 CRUD API |
| `frontend/src/api/auth.ts` | 添加 uploadFile、createAttachment、getAttachments、deleteAttachment、getFileInfo API 方法 |
| `frontend/src/components/InputArea.tsx` | 粘贴时上传文件到服务器，发送时带上 file_ids；文件状态通过 onFilesChange 回调传递给 ChatPlatform；多模态模型跳过OCR |
| `frontend/src/components/ChatPlatform.tsx` | 添加 pastedFiles 状态和 previewFile 状态；输入框上方显示文件缩略图预览区；点击文件显示大图模态框；发送消息时保存附件到数据库；加载对话时从数据库恢复附件 |

**功能特性**:
- 粘贴图片/PDF时自动上传到服务器（uploads目录）
- 上传成功后在缩略图显示蓝色"已上传 ✓"标记
- **多模态模型(qwen3.5-plus/3.6-plus)**：跳过OCR，图片直接发送给AI处理
- **纯文本模型(DeepSeek)**：图片自动进行 OCR 识别并显示绿色"OCR ✓"标记
- 发送消息时，后端根据模型类型决定OCR还是直接发送图片
- PDF文件显示为红色PDF图标，内容提取前5000字节
- 可点击文件缩略图右上角的 ✕ 按钮移除单个文件（同时从数据库删除）
- 最多支持 5 个文件
- 输入框上方显示文件缩略图预览区（AI回复时仍可见）
- 点击文件可查看大图/内容的模态框
- **附件持久化到数据库**，切换对话时可恢复

**用户交互**:
1. 用户在输入框中按 Ctrl+V 粘贴图片/PDF
2. 系统自动上传文件到服务器，显示缩略图预览
3. 多模态模型跳过OCR；纯文本模型进行OCR识别
4. 文件显示在输入框上方的预览区（AI回复时仍可见）
5. 用户点击发送后，附件保存到数据库，后端根据模型类型处理文件
6. 多模态模型直接接收图片；纯文本模型接收OCR文本
7. 发送成功后文件保留在预览区（用户可手动移除）
8. 点击文件缩略图可查看大图/内容模态框
9. **切换到其他对话再切回来，附件自动恢复**

---

### 2026-05-10 - API 设置功能 + 模型可用性检查

**贡献者**: AI Assistant

---

### 0. API 设置功能

**问题**：移动端打包后无法使用对话功能，因为不再默认读取 `.env` 中的 DeepSeek API

**解决方案**：实现用户级 API 设置功能，允许用户配置自己的 API Key，并实现模型可用性检查

**新增文件**:
| 文件 | 说明 |
|------|------|
| `app/models/api_settings.py` | API 设置数据库模型 |
| `app/schemas/api_settings.py` | API 设置 Pydantic schemas |
| `app/crud/api_settings.py` | API 设置 CRUD 操作 |
| `app/api/endpoints/api_settings.py` | API 设置 REST 端点 |
| `frontend/src/pages/ApiSettingsPage.tsx` | API 设置前端页面 |
| `frontend/src/api/auth.ts` | 新增 `apiSettingsApi` 和相关类型定义 |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/api/endpoints/chat.py` | 添加 `MODEL_TO_PROVIDER` 映射，在 `chat_completions` 中检查 API 可用性，更新 `list_models` 返回可用性状态 |
| `app/main.py` | 导入 `api_settings` 端点和 `ApiSettings` 模型 |
| `frontend/src/App.tsx` | 添加 `/settings/api` 路由 |
| `frontend/src/pages/index.ts` | 导出 `ApiSettingsPage` |
| `frontend/src/pages/HomePage.tsx` | 导航栏添加"API 设置"链接 |
| `frontend/src/components/ChatPlatform.tsx` | 获取可用模型列表，传递给 `InputArea` |
| `frontend/src/components/InputArea.tsx` | 显示模型可用性状态，禁用不可用模型 |

**API 可用性检查逻辑**:
1. 用户发起对话请求时，先检查对应 provider 的 API 是否配置
2. 如果 API 未配置，返回 403 错误：`当前模型不可用，请先在设置中配置 API`
3. 模型列表接口 (`/chat/models`) 返回每个模型的 `is_available` 字段

**支持的 Provider**:
- `deepseek`: DeepSeek V4 Flash、DeepSeek V4 Pro
- `qwen`: Qwen3.5 Plus、Qwen3.6 Plus
- `ocr`: 文字识别 API
- `websearch`: 网络搜索 API

---

### 2026-05-09 - UI 优化 + 账号删除逻辑修改 + API 文档 React 重写 + PostgreSQL 强制检查

**贡献者**: AI Assistant

---

### 0. PostgreSQL 强制检查

**问题**：后端默认使用 SQLite（`USE_SQLITE=True`），但项目依赖 PostgreSQL，SQLite 会导致数据不兼容

**解决方案**：在应用启动时强制检查数据库类型，非 PostgreSQL 则报错退出

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/main.py` | 新增 `_check_database()` 函数，启动时检查 USE_SQLITE 配置并连接验证 |
| `app/core/config.py` | `USE_SQLITE` 默认值从 True 改为 False |
| `.env` | PostgreSQL 端口修正为 5432 |

**启动检查逻辑**:
1. 如果 `USE_SQLITE=True`，直接报错：`启动失败：当前配置使用了 SQLite，但本项目要求使用 PostgreSQL`
2. 尝试连接数据库，如果连接被拒绝则报错：`启动失败：无法连接到 PostgreSQL 数据库`
3. 连接成功后检查 `version()` 是否包含 `postgresql`，不是则报错

---

### 1. 深度思考功能修复

**问题**：开启深度思考后，思考内容被清空而不是保留

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/components/ChatPlatform.tsx` | 移除 `thinking_done` 时清空 `reasoning_content` 的逻辑 |
| `frontend/src/components/MessageList.tsx` | 优化思考内容显示逻辑：流式输出时显示思考框，回答完成后折叠但保留内容 |

---

### 2. 删除对话确认对话框

**问题**：点击 X 删除对话时没有确认提示

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/components/ChatPlatform.tsx` | 添加 `window.confirm` 确认对话框 |

---

### 3. 导航栏调整

**问题**：导航栏（Education Agent + 跳转按钮）显示在所有页面，影响其他页面展示

**解决方案**：将导航栏从 Layout 移到 HomePage，只在首页显示

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/components/Layout.tsx` | 移除导航栏代码，只保留 Outlet |
| `frontend/src/pages/HomePage.tsx` | 添加导航栏代码 |

---

### 4. AI 对话平台布局修复

**问题**：历史侧栏与主对话区域有重叠

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/components/Sidebar.tsx` | 侧边栏宽度从 280px 减少到 210px |
| `frontend/src/components/ChatPlatform.tsx` | Header 栏标题居中显示，简化布局 |

---

### 5. 返回首页按钮固定化

**问题**：各页面的返回首页按钮占用页面空间

**解决方案**：将返回首页按钮改为固定定位 (`position: fixed`)，不影响页面布局

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/components/ChatPlatform.tsx` | 固定定位返回按钮，左上角 |
| `frontend/src/pages/DynamicProfilePage.tsx` | 固定定位返回按钮 |
| `frontend/src/pages/BehaviorEventsPage.tsx` | 固定定位返回按钮 |
| `frontend/src/pages/ChatPage.tsx` | 固定定位返回按钮 |
| `frontend/src/pages/ProfilePage.tsx` | 固定定位返回按钮 |
| `frontend/src/pages/ProfileInitPage.tsx` | 固定定位返回按钮 |
| `frontend/src/pages/AdminPage.tsx` | 固定定位返回按钮 |

---

### 6. 账号删除逻辑修改

**问题**：删除账号时只是标记为 deleted 状态，数据仍在数据库中

**解决方案**：改为直接从数据库删除

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/api/endpoints/profile.py` | 用户注销和管理员删除都改为 `db.delete(user)` |

---

### 7. 登录错误信息优化

**问题**：登录失败时总是显示"用户名或密码错误"，不显示具体原因

**解决方案**：前端显示后端返回的具体错误信息

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/pages/LoginPage.tsx` | 401 错误时显示后端返回的 detail |

---

### 8. API 文档页面 React 重写

**问题**：API 文档（Swagger/ReDoc/健康检查）使用 HTML 页面，在 Vite 开发模式下无法加载

**解决方案**：使用 React 组件重写，通过 Vite 代理访问后端 API

**新增文件**:
| 文件 | 描述 |
|------|------|
| `frontend/src/pages/SwaggerPage.tsx` | Swagger UI React 组件 |
| `frontend/src/pages/RedocPage.tsx` | ReDoc React 组件 |
| `frontend/src/pages/HealthPage.tsx` | 健康检查 React 组件 |
| `frontend/src/types/swagger-ui-react.d.ts` | Swagger UI 类型声明 |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/App.tsx` | 添加 /swagger、/redoc、/health 路由 |
| `frontend/src/pages/HomePage.tsx` | 链接改为 React Router Link |
| `frontend/vite.config.ts` | 添加 /swagger、/redoc-doc、/health、/static、/docs 代理 |

**安装依赖**:
```bash
npm install swagger-ui-react redoc
```

---

## 当前实现状态

### 已完成功能 ✅

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户认证系统 | ✅ 已完成 | 注册/登录/JWT/登录失败锁定 |
| 8维学习画像 | ✅ 已完成 | Neo4j + MongoDB 存储 |
| AI 对话初始化 | ✅ 已完成 | DeepSeek API 集成 |
| LLM 流式输出 | ✅ 已完成 | Server-Sent Events |
| 深度思考功能 | ✅ 已完成 | DeepSeek/Qwen 模型支持 |
| 动态画像管理 | ✅ 已完成 | 知识点/易错点 CRUD |
| 行为事件记录 | ✅ 已完成 | 时间线 + 手动记录 |
| 聊天历史持久化 | ✅ 已完成 | PostgreSQL 存储 |
| Markdown 表格渲染 | ✅ 已完成 | remark-gfm 支持 |
| API 文档页面 | ✅ 已完成 | React 重写版本 |
| 健康检查页面 | ✅ 已完成 | React 重写版本 |
| 前端固定返回按钮 | ✅ 已完成 | 所有页面左上角固定 |

### 规划中功能 📋

| 模块 | 状态 | 说明 |
|------|------|------|
| LangGraph ProfileInitAgent | 📋 规划中 | LLM 驱动的对话 Agent |
| LangGraph ProfileUpdateAgent | 📋 规划中 | 信号累积与自动更新 |
| LangGraph ExplainabilityAgent | 📋 规划中 | 可解释时间线生成 |
| EventTracker 自动埋点 | 📋 规划中 | 页面级事件自动采集 |

---

### 2026-05-09 - LLM 集成 + 前端修复

**贡献者**: AI Assistant

---

### 1. LLM 对话功能实现

**问题**：ChatPage 使用硬编码的固定问答流程，无法动态适应用户回答

**解决方案**：集成 DeepSeek API 实现智能对话

**新增文件**:
| 文件 | 描述 |
|------|------|
| `app/api/endpoints/chat.py` | LLM 对话 API 端点，集成 DeepSeek API |
| `frontend/src/api/auth.ts` (更新) | 添加 `chatApi` 客户端 |
| `frontend/src/api/index.ts` (更新) | 导出 `chatApi` |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/core/config.py` | 添加 DeepSeek API 配置项 |
| `.env` | 添加 DEEPSEEK_API_KEY 等配置 |
| `app/main.py` | 注册 chat 路由 |
| `frontend/src/pages/ChatPage.tsx` | 重写为 LLM 驱动对话 |
| `request/prd-2.md` | 更新到 v2.2，记录 LLM 集成规格 |

**API 端点**:
```python
POST /api/v1/chat/profile-init
Body: {
    "message": "我是计算机专业",
    "conversation_history": [...],
    "collected_info": {"major": ""}
}
Response: {
    "reply": "很好！那你的年级是？",
    "collected_info": {"major": "计算机专业"},
    "is_complete": false
}
```

---

### 2. 空数据报错问题修复

**问题**：用户未初始化画像时，访问动态画像页面白屏报错

**原因**：
1. `DynamicProfilePage.tsx` 使用 `navigate` 但未导入 `useNavigate`
2. 缺少 404 错误处理

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/pages/DynamicProfilePage.tsx` | 导入 `useNavigate`，添加 404 跳转逻辑 |
| `frontend/src/pages/BehaviorEventsPage.tsx` | 已有的 404 跳转逻辑正常 |

---

### 3. ChatPage 欢迎消息重复问题修复

**问题**：React 18 严格模式下，`useEffect` 执行两次导致欢迎消息重复显示

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/pages/ChatPage.tsx` | 添加 `hasInitialized` ref 防止重复初始化 |

---

### 4. 文档更新

**更新文件**:
| 文件 | 更新内容 |
|------|----------|
| `README.md` | 更新技术栈（添加 DeepSeek）、API 文档、功能演示、访问地址 |
| `request/prd-2.md` | 更新到 v2.2，详细记录 LLM 集成规格 |

---

## 当前实现状态

### 已完成功能 ✅

| 模块 | 状态 | 说明 |
|------|------|------|
| 后端 API (profile/v2) | ✅ 已完成 | 所有 CRUD 端点已实现 |
| 后端 API (chat) | ✅ 已完成 | LLM 对话端点已实现 |
| 前端 ChatPage (LLM) | ✅ 已完成 | 集成 DeepSeek API 实现智能对话 |
| 前端 DynamicProfilePage | ✅ 已完成 | 6 维指标、知识点管理、易错点管理 |
| 前端 BehaviorEventsPage | ✅ 已完成 | 时间线、行为事件、手动记录 |
| 前端 ProfileInitPage | ✅ 已完成 | 5 步表单式初始化（备选方案） |
| 空数据容错处理 | ✅ 已完成 | 404 错误自动跳转至初始化页面 |
| React 热更新 | ✅ 已完成 | Vite HMR 工作正常 |

### 规划中功能 📋

| 模块 | 状态 | 说明 |
|------|------|------|
| LangGraph ProfileInitAgent | 📋 规划中 | 待实现 LLM 驱动的对话 Agent |
| LangGraph ProfileUpdateAgent | 📋 规划中 | 待实现信号累积与自动更新 |
| LangGraph ExplainabilityAgent | 📋 规划中 | 待实现可解释时间线生成 |
| EventTracker 自动埋点 | 📋 规划中 | 待实现页面级事件自动采集 |

---

### 2026-05-08 - 前端重构 + React + TypeScript 迁移

**贡献者**: AI Assistant

---

### 1. 前端完全重构

**新增目录** (`frontend/`):

使用 React + TypeScript + Vite 重构前端，替代原有的静态 HTML：

| 目录/文件 | 描述 |
|-----------|------|
| `frontend/src/api/` | Axios API 客户端封装 |
| `frontend/src/components/Layout.tsx` | 页面布局组件（导航栏） |
| `frontend/src/pages/HomePage.tsx` | 首页 |
| `frontend/src/pages/LoginPage.tsx` | 登录页 |
| `frontend/src/pages/RegisterPage.tsx` | 注册页 |
| `frontend/src/pages/ProfilePage.tsx` | 个人中心页 |
| `frontend/src/pages/AdminPage.tsx` | 管理后台页 |
| `frontend/src/pages/ProfileInitPage.tsx` | 画像初始化引导页（5步对话） |
| `frontend/src/store/auth.ts` | Zustand 认证状态管理 |
| `frontend/src/types/user.ts` | TypeScript 类型定义 |
| `frontend/vite.config.ts` | Vite 配置（含 API 代理） |
| `frontend/package.json` | 前端依赖 |

**技术选型**:
- React 18 + TypeScript
- Vite 5 (构建工具)
- React Router 6 (路由)
- Zustand (状态管理)
- Axios (HTTP 客户端)

---

### 2. 数据库层完成 (PRD-2 阶段0)

**新增文件** (`app/`):

| 文件 | 描述 |
|------|------|
| `app/db/neo4j.py` | Neo4j 连接和操作封装 |
| `app/db/mongodb.py` | MongoDB 连接和操作封装 |
| `app/models/profile.py` | 画像数据模型 |
| `app/crud/profile.py` | 画像 CRUD 操作 |
| `app/api/endpoints/profile_v2.py` | 画像 API 端点 |

**配置文件更新**:
- `.env` - Neo4j/MongoDB 配置
- `app/core/config.py` - 添加 Neo4j/MongoDB 配置项

---

### 3. 测试脚本整理

**变更**:
- 创建 `test_script/` 目录存放所有测试脚本
- 所有根目录的 `.py` 测试文件移至 `test_script/`
- 更新 `.gitignore` 排除 `test_script/` 目录

---

## 早期贡献记录

### 2026-05-07 - 项目初始化与基础功能

**贡献者**: AI Assistant

#### 1. 项目框架搭建

创建 FastAPI 后端项目结构：
```
app/
├── api/
│   ├── endpoints/
│   │   ├── auth.py          # 登录/注册/刷新令牌
│   │   └── profile.py       # 用户信息/管理员功能
│   └── dependencies.py      # 认证依赖
├── core/
│   ├── config.py            # 配置（从.env读取）
│   └── security.py          # 密码加密/JWT/Redis
├── db/
│   └── database.py          # SQLAlchemy 连接
├── models/
│   └── user.py              # User, UserProfile 模型
├── schemas/
│   └── user.py              # Pydantic 模型
└── static/                   # 静态HTML页面
    ├── index.html           # 主页
    ├── login.html           # 登录页
    ├── register.html        # 注册页
    ├── profile.html         # 个人中心
    ├── admin.html            # 管理员页面
    ├── health.html           # 健康检查
    ├── swagger.html          # Swagger 文档
    └── redoc.html           # ReDoc 文档
```

#### 2. API 结构

```
/api/v1/auth/        - 认证相关（注册/登录/刷新令牌/登出）
/api/v1/profile/     - 用户信息管理（查看/更新/注销/管理员功能）
```

#### 3. 用户认证系统

**功能**:
- 用户注册 / 登录 / 注销
- JWT 令牌认证（AccessToken 24小时 / RefreshToken 7天）
- 登录失败锁定（5次后锁定15分钟）
- 用户状态管理（active/suspended/deleted）

**文件**:
- `app/api/endpoints/auth.py` - 认证 API
- `app/core/security.py` - 密码加密/JWT/Redis session
- `app/models/user.py` - User, UserProfile 模型

#### 4. 用户角色系统

- `student` - 普通学生（默认角色）
- `admin` - 管理员

管理员初始账号：`admin` / `admin123`

#### 5. 数据库配置

| 数据库 | 用途 | 端口 |
|--------|------|------|
| PostgreSQL + pgvector | 用户数据 + 偏好向量 | 5433 |
| Redis | 会话缓存 + 登录失败限制 | 6379 |
| Neo4j | 知识图谱 + 画像关系 | 7687 |
| MongoDB | 行为日志 + 短时会话 | 27017 |

#### 6. 迁移脚本

**新增目录**: `migrations/`

| 文件 | 描述 |
|------|------|
| `001_create_users.sql` | 创建 users 和 user_profiles 表 |
| `002_create_admin_audit_log.sql` | 管理员操作审计日志表 |

#### 7. 8维学习画像设计

| 维度 | 类型 | 存储 |
|------|------|------|
| 知识基础 | 知识点-掌握度映射 | Neo4j |
| 认知风格 | 枚举+置信度 | Neo4j |
| 易错点偏好 | 知识点标签聚类 | Neo4j |
| 多模态偏好 | 向量 (512维) | pgvector |
| 学习活跃时段 | 时段概率分布 | MongoDB |
| 学习节奏 | 标量+趋势 | MongoDB |
| 元认知校准度 | 偏差值 (-1到+1) | MongoDB |
| 注意力特征 | 标量 | MongoDB |

#### 8. PRD 文档

| 文档 | 描述 |
|------|------|
| `request/prd-1.md` | 用户账号信息维护 |
| `request/prd-2.md` | 学习画像构建 |
| `request/prd-2-phased.md` | 8维画像阶段计划 |
| `request/basic_function.md` | 基础功能规划 |

---

## 项目规范

### 用户提示信息

- 所有用户可见的错误信息必须是**中文**
- 成功/失败提示需要清晰明了，让用户立刻知道怎么做

### 前端规范

- 所有页面必须有**返回首页**按钮（左上角固定定位）
- 空数据时自动引导至初始化流程
- 遵循 CLAUDE.md 的页面导航规范

### 后端规范

- 后端设计时要考虑前端展示需求
- 修改代码后检查 README.md, CONTRIBUTING.md, .env 一致性

---

## 分支管理

- `main` - 主分支，稳定版本
- `feature/*` - 功能分支

---

## 提交规范

```
<type>: <subject>

<body>

<footer>
```

Types:
- `feat`: 鏂板姛鑳?
- `fix`: 淇€柀ug
- `docs`: 鏂囨。鏇存柊
- `style`: 浠ｇ爜鏍煎紡
- `refactor`: 閲嶆瀯
- `test`: 娴€瘯
- `chore`: 鏋勫缓/宸ュ叿

---

## 2026-05-09 - 项目系统 + FAISS 混合检索

**贡献者**: AI Assistant

---

### 1. 项目管理系统 (P3_project_system)

**功能**:
- 项目 CRUD（创建、查询、更新、删除）
- 提示词管理（添加、启用/禁用、删除）
- 参考资料文档上传（支持文本内容）
- 文档自动分块存储

**新增文件**:
| 文件 | 描述 |
|------|------|
| `app/models/project.py` | 项目、提示词、文档、分块数据模型 |
| `app/crud/project.py` | 项目 CRUD 操作 |
| `app/schemas/project.py` | Pydantic Schema 定义 |
| `app/api/endpoints/project.py` | 项目管理 API 端点 |
| `frontend/src/components/ProjectManager.tsx` | 项目管理 React 组件 |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/main.py` | 注册 project 路由 |
| `frontend/src/api/auth.ts` | 添加 projectApi |
| `frontend/src/App.tsx` | 添加 /projects 路由 |
| `frontend/src/pages/HomePage.tsx` | 导航栏添加项目管理入口 |

**API 端点**:
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/projects/` | 创建项目 |
| GET | `/api/v1/projects/` | 获取项目列表 |
| GET | `/api/v1/projects/{id}` | 获取项目详情 |
| PUT | `/api/v1/projects/{id}` | 更新项目 |
| DELETE | `/api/v1/projects/{id}` | 删除项目 |
| POST | `/api/v1/projects/{id}/prompts` | 添加提示词 |
| GET | `/api/v1/projects/{id}/prompts` | 获取提示词列表 |
| POST | `/api/v1/projects/{id}/documents` | 添加文档 |
| GET | `/api/v1/projects/{id}/documents` | 获取文档列表 |
| DELETE | `/api/v1/projects/{id}/documents/{did}` | 删除文档 |
| POST | `/api/v1/projects/{id}/retrieve` | RAG 检索 |

---

### 2. FAISS 混合检索

**功能**:
- 使用 FAISS 向量数据库实现语义检索
- 使用 sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2) 生成向量
- 混合检索 = 0.7 × 向量相似度 + 0.3 × 关键词匹配
- 支持配置向量检索权重 (alpha 参数)

**新增文件**:
| 文件 | 描述 |
|------|------|
| `app/core/vector_store.py` | FAISS 向量存储和混合检索工具 |

**新增依赖** (requirements.txt):
```
faiss-cpu==1.7.4
sentence-transformers==2.2.2
numpy==1.26.3
```

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/core/config.py` | 添加 DATA_DIR 配置 |
| `app/crud/project.py` | retrieve_relevant_chunks 使用混合检索 |
| `app/schemas/project.py` | RetrievalRequest 添加 alpha 参数 |

**检索算法**:
```python
combined_score = alpha × vector_score + (1 - alpha) × bm25_score
```
- alpha=0.7: 70% 向量检索 + 30% 关键词检索
- alpha=0.0: 100% 关键词检索
- alpha=1.0: 100% 向量检索

---

### 3. 依赖安装

首次运行需要安装新的 Python 依赖：

```bash
cd education-agent
pip install -r requirements.txt
```

---

### 4. 文档更新

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `request/prd-4-AIChat.md` | P3_project_system 状态更新为已完成 |

---

## 2026-05-09 - AI Chat 项目集成

**贡献者**: AI Assistant

---

### 1. AI Chat 项目面板 (P3_chat_project_panel)

**功能**:
- AI Chat 顶部添加项目选择按钮
- 点击按钮展开项目列表
- 选择项目后只显示该项目的对话
- 选择"全局对话"可查看所有非项目对话
- 项目内集成编辑✏️和删除🗑️按钮

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/models/chat.py` | ChatSession 添加 project_id 外键 |
| `app/models/project.py` | Project 添加 chat_sessions 关系 |
| `app/api/endpoints/chat.py` | 创建/查询会话支持 project_id；历史查询支持按项目筛选 |
| `app/schemas/chat.py` | ChatSession 添加 project_id, project_name |
| `frontend/src/api/auth.ts` | getHistory/createSession 支持 projectId 参数 |
| `frontend/src/components/ChatPlatform.tsx` | 添加项目选择按钮和面板、编辑/删除按钮 |

**API 变更**:
| 方法 | 路径 | 参数 | 功能 |
|------|------|------|------|
| POST | `/api/v1/chat/sessions` | project_id | 创建项目对话 |
| GET | `/api/v1/chat/history` | project_id | 按项目筛选会话 |

---

### 2. AI Chat 内创建/编辑项目 (P3_chat_create_with_project)

**功能**:
- 项目列表底部添加"+"新建项目按钮
- 弹窗包含：项目名称、项目描述、项目提示词、参考文档上传
- 创建后自动切换到新项目并刷新项目列表
- 点击编辑按钮可修改项目名称、描述、提示词
- 点击删除按钮可删除项目（需确认）

**新增/修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/api/endpoints/project.py` | 添加 `/documents/upload` 文件上传端点 |
| `frontend/src/api/auth.ts` | 添加 uploadDocument API |
| `frontend/src/components/ChatPlatform.tsx` | 添加新建项目弹窗、编辑项目弹窗和表单处理 |

**API 端点**:
| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/v1/projects/{id}/documents/upload` | 上传文档并自动分块 |

---

### 3. 删除独立项目管理页面

**变更原因**: 项目高度依赖于 AI Chat，独立项目管理界面无意义

**删除文件**:
| 文件 | 说明 |
|------|------|
| `frontend/src/components/ProjectManager.tsx` | 独立项目管理组件（已删除） |

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `frontend/src/App.tsx` | 移除 /projects 路由和 ProjectManager 导入 |
| `frontend/src/pages/HomePage.tsx` | 移除导航栏"项目管理"链接 |

---

---

## 2026-05-12 - RAG 系统 PPT/Word 格式兼容 + AI Chat 参考来源展示

**贡献者**: AI Assistant

---

### 1. PPT/Word 文档解析支持

**功能**：
- 后端支持上传 `.pptx` 和 `.docx` 格式的参考文档
- 使用 `python-pptx` 提取 PPT 幻灯片文本（含表格）
- 使用 `python-docx` 提取 Word 文档段落文本
- 解析后的文本自动分块并建立向量索引

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `requirements.txt` | 新增 `python-pptx`, `python-docx` |
| `app/api/endpoints/project.py` | 新增 `extract_pptx_text()` 和 `extract_docx_text()`；`upload_document()` 增加 PPT/Word 解析分支 |
| `app/api/endpoints/files.py` | 扩展支持 `.pptx`, `.docx` 文件类型（上传/信息/下载/删除） |

---

### 2. Chat 附件支持 PPT/Word

**功能**：
- 用户在 AI 对话中可上传 PPT 和 Word 文件作为附件
- 后端 `load_and_process_file()` 解析文档内容，以文本形式注入 LLM
- 前端文件上传支持 `.pptx`, `.docx` 格式

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/api/endpoints/chat.py` | `load_and_process_file()` 增加 PPT/Word 解析分支 |
| `frontend/src/components/InputArea.tsx` | 文件上传允许 `.pptx`, `.docx` 格式 |

---

### 3. RAG 参考来源前端展示

**功能**：
- 后端 SSE 流式响应末尾发送 RAG 来源信息（文档名、内容片段、相关度分数）
- 前端 AI 回复底部添加可折叠「📎 参考来源」面板
- 来源展示：文档名称 + 相关度 + 内容片段

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/api/endpoints/chat.py` | `build_project_context()` 返回结构化来源列表；`stream_generator` 末帧携带 `sources` 字段 |
| `frontend/src/components/MessageList.tsx` | `Message` 接口新增 `sources` 字段；AI 气泡底部添加可折叠参考来源面板 |
| `frontend/src/components/ChatPlatform.tsx` | SSE 解析新增 `sources` 字段处理，流结束后更新消息来源数据 |

---

### 新增依赖

```bash
pip install python-pptx python-docx
```

---

## 2026-05-12 - 文件格式全面兼容 + 文件选择器修复

**贡献者**: AI Assistant

---

### 1. 文件选择器修复

**问题**: Windows 文件对话框对 `.pptx`/`.docx` 等扩展名的 `accept` 过滤支持不稳定，文件在对话框中不可见

**修改**:
- 移除 Chat 输入框文件上传的 `accept` 属性（`InputArea.tsx`），文件对话框展示所有文件
- 文件类型校验完全由 JavaScript 处理（`.toLowerCase().endsWith()` 做大小写不敏感检测）

---

### 2. 旧版 Office 格式兼容 (.ppt/.doc)

**功能**:
- 后端所有文件上传入口支持 `.ppt` 和 `.doc` 扩展名
- 旧版格式无法解析文本内容，返回中文提示："建议另存为 .pptx/.docx 格式后重新上传"

**修改文件**:
| 文件 | 修改内容 |
|------|----------|
| `app/api/endpoints/files.py` | 扩展名白名单增加 `.ppt`, `.doc`；get_file_info 处理对应的 MIME type |
| `app/api/endpoints/project.py` | `upload_document()` 检测 `.ppt`/`.doc`，返回转换提示文本 |
| `app/api/endpoints/chat.py` | `load_and_process_file()` 检测 `.ppt`/`.doc`，返回转换提示文本 |
| `frontend/src/components/InputArea.tsx` | 移除 `accept` 属性；JS 校验使用 `.toLowerCase()` 支持大小写不敏感 |

---

### 3. CLAUDE.md 更新

- 新增 7.10 Docker 部署章节（端口映射、重启命令）
- 新增 7.11 文件格式兼容规范
- 新增 7.12 测试工具（Playwright）使用说明

---

### 4. 新增 how/ 文档

**新增文件**: `how/how-to-add-file-parser.md`

记录本次 PPT/Word 解析的完整实现流程和设计原则，作为后续新增文件格式的模板。
