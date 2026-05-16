以下是为 AI Chat 系统编写的详细 PRD，聚焦于你描述的界面交互与 AI 对话核心能力，并与现有画像构建系统无缝衔接。

---

## PRD-003：AI Chat 智能对话平台（React 实现版）

**版本**：v1.0
**优先级**：P0（赛题核心交互入口）
**技术栈**：React 18 + TypeScript（前端），Python 3.11 + FastAPI + LangChain/LangGraph（后端），DeepSeek / Qwen 等模型 API
**关联系统**：对话交互前端、Profile Agent、知识图谱 (Neo4j)、MongoDB、Redis
**关联PRD**：PRD-001（多用户信息维护）、PRD-002（学习画像构建与动态维护系统）

---

## AI 状态维护表（人类可读版）

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| P0_basic_chat | 基础对话框架（布局、Sidebar折叠、消息流式显示、Markdown渲染、模型切换） | P0 | ✅ 是 | 🔴 否 | - | 已完成基础框架，包含ChatPlatform、Sidebar、MessageList、InputArea组件；支持Qwen和DeepSeek双模型切换；SSE流式响应；Markdown代码高亮 |
| P0_chat_history | 对话历史（搜索、新建、切换、折叠） | P0 | ✅ 是 | 🔴 否 | - | 后端 /history API 支持标题和消息内容搜索；前端搜索交互已优化；使用 PostgreSQL 存储 |
| P1_rounds_anchor | 多轮对话锚点（右侧轮次锚点条，点击跳转） | P1 | 🔴 否 | 🔴 否 | - | 与虚拟滚动冲突，已回滚；需重新设计实现方案 |
| P1_virtual_scroll | 虚拟滚动（支持超过1000条消息的对话流畅滚动） | P1 | 🔴 否 | 🔴 否 | - | 虚拟滚动实现与 flex 布局冲突导致显示异常；已回滚；需重新设计实现方案 |
| P2_deep_think | 深度思考模式（展示可折叠思考过程卡片） | P2 | 🔴 否 | 🔴 否 | - | 需要后端支持thinking输出 |
| P2_web_search | 联网检索（回复中引用网络来源） | P2 | 🔴 否 | 🔴 否 | - | 需要配置搜索API |
| P2_image_upload | 图片上传（OCR识别文字或多模态模型直接理解） | P2 | ✅ 是 | ✅ 是 | - | 已完成：InputArea添加📷上传按钮，调用百度OCR识别图片文字，识别结果插入输入框发送给AI；仅支持百度OCR；多模态模型(qwen3.5-plus/3.6-plus)跳过OCR直接处理图片 |
| P2_clipboard_paste | 剪贴板粘贴（支持直接粘贴图片/PDF，最多5个，文件上传服务器；多模态模型直接发送图片；纯文本模型OCR发送；PDF提取5000字符；粘贴后在输入框上方显示缩略图预览区，AI回复时仍可见，点击可查看大图；附件持久化到数据库，切换对话可恢复） | P2 | ✅ 是 | 🔴 否 | - | 已完成：输入框 onPaste 事件，支持直接 Ctrl+V 粘贴图片/PDF；自动上传到服务器；输入框上方显示缩略图预览区（AI回复时仍可见）；点击文件查看大图模态框；发送时后端根据模型类型决定OCR或直接发送图片；PDF提取前5000字符；附件持久化到数据库，切换对话时可恢复 |
| P3_project_system | 项目系统（项目CRUD、提示词注入、参考资料RAG） | P3 | ✅ 是 | 🔴 否 | - | 已完成项目CRUD、提示词管理、文档上传、FAISS混合检索RAG；支持alpha参数控制向量/关键词权重；项目编辑/删除已集成到AI Chat内 |
| P3_project_chat_integration | 项目与AI Chat集成（项目选择器、RAG检索结果注入对话） | P3 | ✅ 是 | 🔴 否 | - | 已完成：AI Chat项目选择器、对话时自动注入项目提示词和FAISS检索结果 |
| P3_chat_project_panel | AI Chat内项目面板（展开项目列表、查看项目对话、新建项目对话） | P3 | ✅ 是 | 🔴 否 | - | 已完成：AI Chat顶部项目选择按钮、点击展开项目列表、选择项目后只显示该项目对话；项目内集成编辑✏️和删除🗑️按钮 |
| P3_chat_create_with_project | AI Chat内创建项目（指明提示词、上传参考文档） | P3 | ✅ 是 | 🔴 否 | - | 已完成：项目列表底部"+"新建项目按钮、弹窗包含名称/描述/提示词/文档上传 |
| P4_global_memory | 全局记忆（跨所有对话与项目的长期记忆） | P4 | 🔴 否 | 🔴 否 | - | 需要记忆管理API |
| P4_project_memory | 项目记忆（仅关联具体项目的记忆） | P4 | 🔴 否 | 🔴 否 | - | 需要记忆管理API |

---

## AI 状态维护表（JSON版）

```json
{
  "ai_status": {
    "P0_basic_chat": {
      "description": "基础对话框架（布局、Sidebar折叠、消息流式显示、Markdown渲染、模型切换）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "已完成基础框架，包含ChatPlatform、Sidebar、MessageList、InputArea组件；支持Qwen和DeepSeek双模型切换；SSE流式响应；Markdown代码高亮"
    },
    "P0_chat_history": {
      "description": "对话历史（搜索、新建、切换、折叠）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "后端 /history API 支持标题和消息内容搜索；前端搜索交互已优化；使用 PostgreSQL 存储"
    },
    "P1_rounds_anchor": {
      "description": "多轮对话锚点（右侧轮次锚点条，点击跳转）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "与虚拟滚动冲突，已回滚；需重新设计实现方案"
    },
    "P1_virtual_scroll": {
      "description": "虚拟滚动（支持超过1000条消息的对话流畅滚动）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "虚拟滚动实现与 flex 布局冲突导致显示异常；已回滚；需重新设计实现方案"
    },
    "P2_deep_think": {
      "description": "深度思考模式（展示可折叠思考过程卡片）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需要后端支持thinking输出"
    },
    "P2_web_search": {
      "description": "联网检索（回复中引用网络来源）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需要配置搜索API"
    },
    "P2_image_upload": {
      "description": "图片上传（OCR识别文字或多模态模型直接理解）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成：InputArea添加📷上传按钮，调用百度OCR识别图片文字，识别结果插入输入框发送给AI；仅支持百度OCR；多模态模型(qwen3.5-plus/3.6-plus)跳过OCR直接处理图片"
    },
    "P2_clipboard_paste": {
      "description": "剪贴板粘贴（支持直接粘贴图片/PDF，最多5个，文件上传服务器；多模态模型直接发送图片；纯文本模型OCR发送；PDF提取5000字符；粘贴后在输入框上方显示缩略图预览区，AI回复时仍可见，点击可查看大图；附件持久化到数据库，切换对话可恢复）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "已完成：输入框 onPaste 事件，支持直接 Ctrl+V 粘贴图片/PDF；自动上传到服务器；输入框上方显示缩略图预览区（AI回复时仍可见）；点击文件查看大图模态框；发送时后端根据模型类型决定OCR或直接发送图片；PDF提取前5000字符；附件持久化到数据库，切换对话时可恢复"
    },
    "P3_project_system": {
      "description": "项目系统（项目CRUD、提示词注入、参考资料RAG）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "已完成项目CRUD、提示词管理、文档上传、FAISS混合检索RAG；支持alpha参数控制向量/关键词权重；项目编辑/删除已集成到AI Chat内"
    },
    "P3_project_chat_integration": {
      "description": "项目与AI Chat集成（项目选择器、RAG检索结果注入对话）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "已完成：AI Chat项目选择器、对话时自动注入项目提示词和FAISS检索结果"
    },
    "P3_chat_project_panel": {
      "description": "AI Chat内项目面板（展开项目列表、查看项目对话、新建项目对话）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "已完成：AI Chat顶部项目选择按钮、点击展开项目列表、选择项目后只显示该项目对话；项目内集成编辑和删除按钮"
    },
    "P3_chat_create_with_project": {
      "description": "AI Chat内创建项目（指明提示词、上传参考文档）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "已完成：项目列表底部"+"新建项目按钮、弹窗包含名称/描述/提示词/文档上传"
    },
    "P4_global_memory": {
      "description": "全局记忆（跨所有对话与项目的长期记忆）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需要记忆管理API"
    },
    "P4_project_memory": {
      "description": "项目记忆（仅关联具体项目的记忆）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需要记忆管理API"
    }
  }
}
```

---

### 1. 功能概述

AI Chat 平台是学生与智能体系统交互的统一入口。它不再局限于学习画像初始化，而是面向学习全流程的通用对话界面。平台支持：

- **多模型对话**：用户可切换不同 LLM（DeepSeek-V4-Flash/Pro、Qwen 3.6-Plus 等），并独立控制“深度思考”模式。
- **联网检索**：当配置 API 后，可将实时网络信息注入对话上下文。
- **多模态输入**：支持图片上传，多模态模型直接理解图片；纯文本模型则通过 OCR API 提取文字后发送。
- **对话历史管理**：左侧可折叠/展开的历史列表，支持搜索、新建对话，保留完整对话记录。
- **对话内跳转锚点**：多轮问答自动在右侧生成轮次锚点，通过滚动或点击快速定位到第 N 轮对话。
- **项目（Project）**：类似“工作区”，每个项目可定义专属提示词、上传参考资料、维护项目记忆，项目间隔离。
- **全局记忆与项目记忆**：由模型自动维护记忆库，根据对话上下文判断记忆的添加、更新或废弃，用户仅可删除。

该平台同时也是学习画像初始化（PRD-002 的对话式收集信息）、资源生成请求、智能辅导的入口，通过与后端 Agent 系统协同，驱动所有后续功能。

---

### 2. 设计原则

- **对话优先**：所有复杂操作一律收敛为自然语言交互，减少弹窗与表单。
- **模型无关性**：前端 UI 适应单模态/多模态模型，自动调整输入区功能。
- **上下文连续性**：对话历史、项目记忆、全局记忆三者无缝融合，让模型“记住”长期信息。
- **渐进式高级功能**：联网搜索、深度思考为可选项，默认保持简洁。
- **可解释反馈**：当模型执自动记忆操作时，仅以轻量系统消息提示，不打断用户。

---

### 3. 技术架构（Chat 系统视角）

```
┌───────────────────── React Frontend ─────────────────────┐
│  ChatPlatform (主布局)                                    │
│  ├─ Sidebar (对话历史、搜索、新建、折叠)                   │
│  ├─ ChatArea (消息流、锚点、输入区)                        │
│  │   ├─ MessageList (虚拟滚动)                            │
│  │   │   ├─ UserMessage (深蓝色圆角框)                    │
│  │   │   ├─ AssistantMessage (背景色、无框)               │
│  │   │   └─ SystemMessage (轻量提示，如记忆更新)          │
│  │   ├─ RoundsAnchor (右侧轮次锚点条)                     │
│  │   └─ InputArea (文本框、模型切换、联网/深度思考开关、图片上传) │
│  ├─ ProjectSelector (顶部或侧边栏内)                      │
│  └─ MemoryManager (弹窗，仅展示与删除)                    │
└───────────────────────────────────────────────────────────┘
           │ HTTP/SSE (流式传输)
┌──────────▼───────────┐
│  FastAPI Chat Gateway │
│  ├─ /v1/chat/completions (对话核心)                      │
│  ├─ /v1/chat/memory (记忆 CRUD)                          │
│  ├─ /v1/chat/projects (项目管理)                          │
│  ├─ /v1/chat/ocr (图片文字提取)                           │
│  └─ /v1/chat/search (联网检索代理)                       │
└──────────────────────┘
           │
┌──────────▼───────────┐
│  LangGraph Agent      │
│  ├─ ProfileInitAgent (画像初始化对话，复用 Chat 通道)     │
│  ├─ ResourceGenAgent (资源生成对话)                      │
│  └─ MemoryAgent (记忆管理决策)                            │
└──────────────────────┘
           │
┌──────────▼───────────┐
│  Data Stores           │
│  ├─ MongoDB (对话历史、项目配置、记忆库)                  │
│  ├─ Redis (会话级模型状态、问答轮次计数)                  │
│  └─ MinIO/OSS (项目参考资料、上传图片)                   │
└──────────────────────┘
```

---

### 4. 详细功能需求

#### 4.1 界面布局与交互

**默认布局**（宽度 > 1024px）：
- 左侧边栏宽度 = 窗口宽度的 1/6 （约 280px ~ 320px），包含：新建对话按钮、对话历史列表（含搜索框）、项目切换下拉、全局记忆管理入口。
- 右侧主聊天区占据剩余宽度。
- 分隔线可用拖拽调整比例，但最小左侧宽度 240px，最大 400px。

**全屏模式**：
- 点击侧边栏左上角的“折叠”图标（☰ 或 ◀），整个左侧边栏滑出隐藏，主聊天区扩展至 100%。
- 全屏时，在屏幕左上角出现一个悬浮的“展开历史”按钮（▶），点击后恢复左侧边栏。

**响应式**：
- 屏幕宽度 < 768px 时，左侧边栏默认隐藏，通过顶部汉堡菜单图标呼出（抽屉式覆盖）。

#### 4.2 对话历史侧边栏

- **对话列表**：以时间倒序展示用户的所有对话项，每项显示标题（由模型根据首条消息自动生成，或用户可重命名）、最后活跃时间、所属项目标签（如有）。
- **搜索**：顶部固定搜索框，支持按标题/消息内容模糊搜索历史对话，选中后加载完整对话。
- **新建对话**：搜索框右侧常驻「+」按钮，点击创建一个空白新对话，自动聚焦输入框。
- **对话操作**：右键菜单（或悬停三点图标）支持重命名、删除、复制对话 ID。
- **项目筛选**：列表顶部可筛选“全部对话”或“只显示某项目的对话”。

#### 4.3 聊天区域

##### 4.3.1 消息展示

- **用户消息**：深蓝色背景（`#2563EB` 或可自定义主题色），白色文字，圆角 16px 气泡，靠右对齐，最大宽度 70%。
- **AI 回复**：无背景色（透明），深色文字，直接跟随聊天背景，靠左对齐，最大宽度 80%。支持 Markdown 渲染（代码高亮、表格、LaTeX）。
- **系统消息**：浅灰色斜体小字，居中显示，如“模型已为你记住：偏好学习风格为视觉型”。
- **深度思考过程**：若开启深度思考，AI 回复前可展示“思考中…”折叠卡片，内部包含模型推理链（透明化），用户可展开查看。
- **联网检索标记**：当本次回复使用了网络检索结果，在回复下方显示“🔍 已联网搜索”标签，并可展开查看引用源。

##### 4.3.2 多轮对话锚点

- 当同一对话内出现两个以上不同的问答阶段（由后端的轮次分割算法判断，或基于用户“让我们开始……”等语义标记），在聊天区最右侧出现一个**竖直锚点条**。
- 每个锚点对应一问一答（或一个主题块）的起始位置，以圆形标记。
- **交互**：鼠标悬停锚点时浮现该轮次的简要摘要（用户提问首句）。点击锚点，聊天区自动滚动到对应位置。支持在锚点条上鼠标滚轮快速上下切换。
- 锚点条仅在该对话有多段时出现，且完全不影响消息列表布局。

##### 4.3.3 输入区

- **输入框**：底部固定，自适应高度（最小 2 行，最大 8 行），支持 Shift+Enter 换行，Enter 发送。
- **左侧控制项**（输入框左上方）：
  - **模型选择下拉框**：显示当前模型名称，点击列出可选模型列表（DeepSeek-V4-Flash、DeepSeek-V4-Pro、Qwen3.6-Plus、self-defined 等）。每个模型右侧有标识：是否支持多模态、是否支持深度思考。
  - **深度思考开关**：仅当所选模型支持时显示（带灯泡💡图标），切换为蓝色激活状态。
  - **联网检索开关**：带地球🌐图标，需在设置中配置 API Key 后方可激活，否则置灰并提示“请配置搜索API”。
  - **图片上传按钮**：📎 图标，支持点击上传或粘贴剪贴板图片。若当前模型是多模态，图片直接作为消息的一部分发送；若为纯文本模型，则自动调用 OCR API，将提取的文字填入输入框（并提示“已通过OCR提取文字”）。
- **发送区**：右侧有渲染 Markdown 预览按钮（可选），以及发送按钮。

#### 4.4 项目（Project）机制

- **创建项目**：通过侧边栏或顶部导航“新建项目”进入，需填写：
  - 项目名称（必需）
  - 项目自定义系统提示词（可选，覆盖全局 system prompt，用于限定模型回答风格或领域知识）
  - 上传参考资料（PDF、PPT、Word、Markdown），存储于文件服务，并在对话上下文中作为 RAG 数据源。
- **项目对话**：在项目下新建的对话自动归属该项目，对话时自动注入项目提示词和文档知识（通过向量检索相关片段）。
- **项目记忆**：每个项目拥有独立的记忆库，模型根据对话上下文自动更新项目相关事实（如项目背景、用户进度等）。用户可在“项目设置”里查看记忆列表并**只能删除**，不能手动添加或修改。
- 项目与全局对话平行：用户也可以在无项目的“全局空间”进行一般聊天，此时仅使用全局记忆。

#### 4.5 记忆管理

- **全局记忆**：跨所有对话与项目，存储用户长期偏好、个人描述等（例如“我是大二计算机学生，喜欢 Python 编程”）。由模型在对话中自动“记忆”，展示为系统消息“🧠 已记住：…”。
- **项目记忆**：仅关联具体项目，如“项目 A 中正在实现 CNN 分类器，准确率 95%”。
- **记忆更新规则**：
  - 模型收到用户消息后，在生成回复前，分析当前对话与历史记忆是否冲突或新增信息。
  - 若提取到新事实，生成“记忆操作”指令（add/update/delete）发送给记忆管理模块，后端执行并返回确认。
  - 用户对记忆只有**查看和删除**权限，不能手动编辑，防止与模型内部不一致。
- **记忆界面**：
  - 侧边栏下方有“全局记忆”入口，弹出 Modal，显示所有全局记忆条目，每条右侧有删除图标。
  - 项目设置内有“项目记忆”标签页，同理管理。
  - 所有记忆展示时间戳和来源对话，支持搜索过滤。

---

### 5. 前端组件与状态管理

#### 5.1 组件树

```
<App>
  <AuthProvider>
    <ChatPlatform>
      <Sidebar>
        <SidebarToggle />
        <NewChatButton />
        <ChatHistorySearch />
        <ChatList>
          <ChatListItem /> * N
        </ChatList>
        <ProjectSelector />
        <GlobalMemoryButton />
      </Sidebar>
      <ChatArea>
        <ChatHeader>
          <CurrentChatTitle />
          <ProjectBadge />
          <ClearChatButton />
        </ChatHeader>
        <MessageList>
          <MessageItem type="user|assistant|system" />
          <ThinkingCard /> (for deep think)
          <SearchRefTag />
        </MessageList>
        <RoundsAnchorBar>
          <AnchorPoint /> * N
        </RoundsAnchorBar>
        <InputArea>
          <ModelSelector />
          <DeepThinkToggle />
          <WebSearchToggle />
          <ImageUploader />
          <TextArea />
          <SendButton />
        </InputArea>
      </ChatArea>
    </ChatPlatform>
  </AuthProvider>
</App>
```

#### 5.2 状态管理

使用 **Zustand** 管理全局状态，主要包括：

- `chatStore`：当前对话 ID、消息列表、历史列表、流式文本缓冲区
- `projectStore`：项目列表、当前激活项目、项目记忆
- `memoryStore`：全局记忆列表
- `uiStore`：侧边栏折叠状态、模型选择、开关状态
- `authStore`：JWT 及用户信息

数据获取通过自定义 React Hook（例：`useChat(chatId)`）负责 API 调用、SSE 流解析、自动重新获取。

---

### 6. 后端接口定义

#### 6.1 对话流式 API

**POST /api/v1/chat/completions**
- 功能：发起一次对话，返回 SSE 流。
- Body:
```json
{
  "chat_id": "uuid or null (for new)",
  "project_id": "optional project uuid",
  "model": "deepseek-v4-pro",
  "messages": [{"role": "user", "content": "你好"}],
  "deep_think": false,
  "enable_search": false,
  "image": "base64 or object store url (optional)"
}
```
- Response: `text/event-stream`
  - 事件类型：
    - `message`: 增量文本
    - `thinking`: 思考过程文本（仅 deep_think 开启）
    - `search_results`: 网络检索结果列表
    - `memory_ops`: 记忆操作提示（add/update/delete）
    - `round_split`: 轮次切分标记（用于锚点）
    - `done`: 完整回复的元数据（token 统计、对话 ID 等）

#### 6.2 对话历史管理

- **GET /api/v1/chat/history?limit=50&offset=0&project_id=** 获取历史列表
- **GET /api/v1/chat/{chat_id}/messages** 获取完整消息
- **PATCH /api/v1/chat/{chat_id}** 更新标题
- **DELETE /api/v1/chat/{chat_id}** 删除对话

#### 6.3 项目管理

- **POST /api/v1/chat/projects** 创建项目
- **GET /api/v1/chat/projects** 列表
- **GET /api/v1/chat/projects/{project_id}** 详情（含记忆）
- **PUT /api/v1/chat/projects/{project_id}** 更新（提示词、名称）
- **DELETE /api/v1/chat/projects/{project_id}** 删除
- **POST /api/v1/chat/projects/{project_id}/upload** 上传参考资料
- **GET /api/v1/chat/projects/{project_id}/files** 文件列表

#### 6.4 记忆管理

- **GET /api/v1/chat/memory?scope=global|project_id** 获取记忆列表
- **DELETE /api/v1/chat/memory/{memory_id}** 删除记忆（仅用户可用）
- 记忆的增加/修改由后端 Agent 在对话流中自动触发，不提供前端直接新增的接口。

#### 6.5 其他

- **POST /api/v1/chat/ocr** 上传图片，返回提取文本
- **POST /api/v1/chat/search** 测试用：传入查询词，返回网络检索结果片段

---

### 7. 与原有系统的集成

原有的 **ChatPage**（画像初始化对话）将**迁移并升级**为此 AI Chat 平台的一个“预置系统项目”：

- 在项目列表内置一个“📝 学习画像初始化”项目，该项目自带固定系统提示词和五轮策略（调用 ProfileInitAgent）。
- 新建该项目的对话时，自动进入初始化流程，完成后结果写入画像库，并跳转到画像页面。
- 所有画像后续更新对话也都复用在项目内，保持对话历史连续性。

此外，**EventTracker 埋点**需扩展监听 Chat 界面行为（切换模型、上传图片、联网检索等），为画像动态更新提供丰富事件。

---

### 8. 非功能需求

- **流式响应体验**：从用户发送消息到第一个 token 显示 < 1.5s，平均 token 生成速率 > 30 tokens/s。
- **长对话性能**：前端使用虚拟滚动，支持超过 1000 条消息的对话流畅滚动。
- **图片上传**：限制 10MB，前端压缩后再上传；OCR 处理延迟 < 2s。
- **安全性**：所有对话、项目数据按用户隔离，JWT 鉴权；网络检索代理在后端执行，防止 SSRF。
- **可扩展性**：模型列表通过配置下发，无需前端硬编码。
- **降级**：若联网检索 API 不可用，自动忽略并提示“联网搜索暂时不可用”；OCR 失败时提示用户重新上传或直接以图片形式发送（多模态模型）。

---

### 9. 验收标准

1. 用户可选择一个模型开始新对话，发送文本，获得流式回复，Markdown 正确渲染。
2. 左侧历史列表可搜索，可新建、切换对话，隐藏/展开正常。
3. 多轮锚点正确生成，点击跳转，鼠标滚轮切换有效。
4. 开启深度思考时，AI 回复前展示可折叠思考过程。
5. 配置搜索 API 后，开启联网检索，回复中引用网络来源。
6. 上传图片，纯文本模型通过 OCR 识别文字并填入输入框，多模态模型直接理解图片。
7. 创建项目，设定提示词和上传资料后，对话中模型回答体现项目上下文。
8. 对话过程中，系统自动生成记忆，用户可在全局/项目记忆管理界面查看并删除。
9. 所有界面操作均有符合规范的加载/成功/失败提示。
10. 与学习画像初始化流程无缝衔接，在 AI Chat 内可完成五轮对话构建画像。

---

### 10. 阶段拆分

| 阶段 | 内容 | 关键产出 |
|------|------|----------|
| P0 | 基础对话框架 | React ChatPlatform 布局、Sidebar 折叠、消息流式显示、Markdown 渲染、模型切换 |
| P1 | 对话管理与锚点 | 历史搜索/新建/切换，虚拟滚动，多轮锚点组件 |
| P2 | 高级模式 | 深度思考展示、联网检索开关及 UI、图片上传与 OCR/多模态兼容 |
| P3 | 项目系统 | 项目 CRUD，提示词注入，参考资料 RAG 接入，项目记忆 |
| P4 | 记忆系统 | 全局/项目记忆自动生成与显示，用户删除，记忆冲突处理 |

---

该 PRD 完全围绕 AI Chat 展开，细节充分覆盖你提到的所有交互点，同时保持了与比赛要求和现有系统的兼容性。可以直接交付给前端工程师作为开发依据。