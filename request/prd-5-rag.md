以下是已根据你的要求修改后的 PRD-004 全文，将默认 Embedding 模型改为阿里云 **text-embedding-v2**，Reranker 改为阿里云 **gte-rerank**（通用文本排序模型），并调整了相关配置、接口与描述。

***

## PRD-004：项目参考文件 RAG 模块（文档解析与混合检索）

**版本**：v1.1\
**优先级**：P0（修复现有缺陷 + 补全 P3 核心能力）\
**关联PRD**：PRD-003（AI Chat 智能对话平台），尤其 P3\_project\_system、P3\_project\_chat\_integration\
**当前问题**：PDF 文件被直接以二进制形式传入 LLM，导致回复为乱码。\
**目标**：为项目参考文件提供稳定、可扩展的 RAG 管线，支持 PDF / Word / PPT 解析，国内 Embedding API（阿里云 text-embedding-v2），FAISS 混合检索，并在对话中自动注入相关片段。

**本次更新（v1.1）**：

- 默认 Embedding 服务替换为**阿里云 DashScope text-embedding-v2**；
- Reranker 明确采用**阿里云通用文本排序模型 gte-rerank**；
- 相关配置、接口示例与环境变量同步修改。

***

### 1. 功能概述

本模块是 AI Chat 项目系统的文档知识库核心。用户上传项目参考资料（PDF、Word、PPT）后，系统自动：

1. 解析文档为可读纯文本；
2. 将文本拆分为语义块；
3. 调用阿里云 Embedding 服务生成向量并存储至 FAISS 索引；
4. 在用户对话时，根据当前问题混合检索（向量相似度 + 关键词匹配）最相关片段；
5. 将片段注入 LLM 上下文，使回答基于项目文档。

同时，模块需具备**增量更新**能力（新建/修改/删除文档时同步更新索引）和**透明化**显示（前端可展示检索到的参考片段）。

***

### 2. 设计原则

- **文本优先**：绝对禁止将原始文件字节流传给 LLM，必须经解析引擎提取纯文本。
- **服务端全托管**：文件上传、解析、Embedding、检索均在 FastAPI 后端完成，前端只负责上传触发和展示结果。
- **国内生态适配**：Embedding 与 Reranker 必须使用国内 API 或本地部署模型，确保服务可用性。默认选择阿里云服务。
- **混合检索**：兼顾语义召回和精确关键词匹配，通过 alpha 参数控制权重。
- **资源轻量**：向量存储使用本地 FAISS（内存/磁盘持久化），无需额外部署向量数据库集群。

***

### 3. 技术架构

```
┌───────── React Frontend ─────────┐
│  项目面板 → 上传/删除文件        │
│  AI Chat → 发送消息              │
└──────────────┬───────────────────┘
               │ HTTP / SSE
┌──────────────▼────────────────────────────────────────────┐
│  FastAPI Backend                                          │
│                                                           │
│  POST /projects/{id}/files/upload                         │ ←─ 文件上传入口
│  DELETE /projects/{id}/files/{file_id}                    │    触发异步解析任务
│                                                           │
│  POST /chat/completions                                   │ ←─ 对话时触发检索并注入
│       │                                                   │
│       ├─ 项目上下文组装                                   │
│       └─ RAG 检索服务 (混合检索)                          │
└──────────────┬────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────┐
│  RAG Pipeline (Background / Sync)                         │
│                                                           │
│  1. 文件解析器                                            │
│     ├─ PDF: PyMuPDF (fitz) + pdfplumber                   │
│     ├─ Word: python-docx                                  │
│     └─ PPT : python-pptx                                  │
│                                                           │
│  2. 文本分割器 (RecursiveCharacterTextSplitter)            │
│                                                           │
│  3. Embedding 服务 (阿里云 DashScope text-embedding-v2)    │
│                                                           │
│  4. 向量存储 & 检索                                       │
│     ├─ FAISS 索引 (per project)                           │
│     ├─ BM25 关键词索引                                    │
│     └─ 混合检索 (alpha blend) + gte-rerank 精排           │
└───────────────────────────────────────────────────────────┘
```

简化技术栈：文本分割复用 `langchain.text_splitter`，其他均使用原生 Python 库与阿里云 API，避免过度抽象。

***

### 4. 详细功能需求

#### 4.1 文档解析 — 根治二进制乱码

**支持格式**：`.pdf`、`.docx`、`.pptx`（`.doc` 建议用户另存为 `.docx` 或通过后台自动转换后处理）

| 格式      | 解析引擎                          | 策略                                                | 异常处理                                                           |
| ------- | ----------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| **PDF** | `PyMuPDF`（首选）`pdfplumber`（降级） | 先尝试 PyMuPDF 提取每页文本；若为空则用 pdfplumber。合并所有页，保留页码标记。 | 若两者均失败（扫描型图片PDF），返回错误提示“图片型PDF需先进行OCR处理”，记录日志。**绝不回退到读取原始字节**。 |
| Word    | `python-docx`                 | 遍历所有段落，提取完整文本，保留段落换行。                             | 文件损坏则返回明确错误。                                                   |
| PPT     | `python-pptx`                 | 遍历所有幻灯片，提取每个形状中的文本（文本框、表格等），保留幻灯片序号。              | 同上。                                                            |

**解析调用时机**：上传成功后立即启动后台异步任务，将结果全文和元信息存入 MongoDB `project_files` 集合：

```json
{
  "file_id": "uuid",
  "project_id": "uuid",
  "filename": "深度学习入门.pdf",
  "parsed_text": "第1页\n神经网络基础...\n第2页\n卷积层...",
  "parse_status": "completed",
  "error_message": null,
  "chunks": []
}
```

前端通过轮询或 WebSocket 获知状态，并展示“解析中…/完成/失败”。

**绝对约束**：

- 禁止将文件流直接传入 LLM；`/chat/completions` 中若检测到文件引用，一律替换为“用户上传了文件 xxx，已解析为文本”。
- 解析失败必须明确通知用户。

#### 4.2 文本分块策略

- 使用 `RecursiveCharacterTextSplitter`，分隔符优先级：`["\n\n", "\n", "。", "！", "？", " ", ""]`。
- `chunk_size`：默认 800 字符（约 800 tokens），可配置。
- `chunk_overlap`：200 字符。
- 每个块记录：`chunk_id`, `file_id`, `project_id`, `text`, `page_or_slide`, 元数据。

分块结果存入 MongoDB `project_chunks`，同时用于生成向量。

#### 4.3 Embedding 服务选型（指定阿里云 text-embedding-v2）

根据“只能使用国内 API”和易用性，**默认选择阿里云 DashScope 的** **`text-embedding-v2`** **模型**，同时保留通过配置切换其他国内服务的能力。

| 服务商                   | 模型                  | 维度   | 优势                                   | 限制                 |
| --------------------- | ------------------- | ---- | ------------------------------------ | ------------------ |
| **阿里云 DashScope**（默认） | `text-embedding-v2` | 1536 | 中文效果好，支持长文本（2048 token），稳定，与阿里生态集成顺畅 | 需开通 DashScope，按量付费 |
| 智谱 AI                 | `embedding-3`       | 2048 | 免费额度友好，兼容 OpenAI 语法                  | 需实名认证              |
| 百度千帆                  | `Embedding-V1`      | 1024 | 易申请                                  | 维度较低               |
| 腾讯混元                  | `hunyuan-embedding` | 1024 | 腾讯云体系整合                              | 需企业认证              |

后端封装统一的 `EmbeddingClient` 抽象：

```python
class EmbeddingClient:
    def embed_texts(self, texts: List[str]) -> List[List[float]]: ...
    def embed_query(self, query: str) -> List[float]: ...
```

默认实现 `AliyunEmbeddingClient`，通过环境变量 `EMBEDDING_PROVIDER=aliyun` 及 `ALIYUN_DASHSCOPE_API_KEY` 控制。调用时需加指数退避重试与并发限制（≤5 次/秒），并建议对文本 MD5 做本地缓存，避免重复请求。

#### 4.4 向量存储与索引

每个项目独立 FAISS 索引，持久化至磁盘：

```
data/projects/{project_id}/faiss_index/
    ├── project_{uuid}.index
    └── project_{uuid}.id_map.json
```

BM25 索引文件：`data/projects/{project_id}/bm25_index.pkl`

**增量更新策略**：

- 新增文件：解析 → 分块 → 生成向量 → 追加到 FAISS，重建 BM25 索引。
- 删除文件：移除对应 chunk 后，为简单可靠直接重建该项目的 FAISS 与 BM25 索引。
- 服务重启时自动加载磁盘索引。

#### 4.5 混合检索（Hybrid Search）

检索时并行执行向量语义检索和 BM25 关键词检索，再进行分数融合。

```python
async def hybrid_search(project_id: str, query: str, 
                        top_k: int = 5, alpha: float = 0.7) -> List[Chunk]:
    # 1. 获取项目 FAISS 及 BM25 索引
    # 2. query_vector = embedding_client.embed_query(query)
    # 3. vector_results = faiss_index.search(query_vector, top_k * 2)
    # 4. bm25_results = bm25_index.search(query, top_k * 2)
    # 5. 归一化后融合: final = alpha*vec_norm + (1-alpha)*bm25_norm
    # 6. 截取 top_k 返回（含 file_name, page, score）
```

`alpha` 默认 0.7，可在项目设置中由用户调整。

#### 4.6 对话注入流程

`POST /chat/completions` 携带 `project_id` 时：

1. 获取项目自定义系统提示词。
2. 调用 `hybrid_search` 得到 top\_k=3 相关片段。
3. 组装增强系统消息：

```
[系统提示词]
{project_prompt}
---
请参考以下项目文档片段回答问题：
[来源1: 深度学习入门.pdf - 第2页]
... (chunk1.text)
[来源2: 神经网络基础.docx - 第12段]
... (chunk2.text)

[用户问题]
{user_query}
```

1. 片段总长度截断至约 3000 tokens；检索为空则不注入。
2. 调用 LLM 流式生成回复，前端展示回复时可折叠显示“参考来源”。

#### 4.7 Reranker（精排，推荐）

为进一步提升 Top-K 准确性，在混合检索之后接入 **阿里云通用文本排序模型 gte-rerank**。该模型基于 GTE 系列，中文效果出色，通过 DashScope API 调用，无需本地 GPU。

**流程**：

- `hybrid_search` 召回 `top_k * 2` 个候选；
- 调用阿里云文本排序 API（模型名 `gte-rerank`），对 (query, chunk\_text) 列表重打分；
- 按新分数排序，最终取 `top_k` 注入对话。

若开启 Reranker，alpha 可适当调低（如 0.5），让召回更宽，由精排筛选。

**配置**：同样使用 `ALIYUN_DASHSCOPE_API_KEY`，与 Embedding 共用认证。开启方式通过环境变量 `ENABLE_RERANK=1` 或项目设置开关。

***

### 5. 数据流示例

```
用户发送消息（project_id=A）
  → FastAPI ChatGateway
     → 获取项目提示词
     → embedding_client.embed_query(user_query)   # 阿里 text-embedding-v2
     → hybrid_search(...)                         # FAISS + BM25
        → (可选) gte-rerank 精排
     → 组装上下文
     → 调用 LLM API 流式回复
  → 前端展示回复 + 参考来源标签
```

***

### 6. API 接口扩展

#### 6.1 文件上传响应（修改）

**POST /api/v1/chat/projects/{project\_id}/upload**

```json
{
  "file_id": "f1",
  "filename": "paper.pdf",
  "parse_status": "processing",
  "message": "文件已上传，正在解析并建立索引，请稍候..."
}
```

#### 6.2 检索测试接口（调试用）

**POST /api/v1/chat/projects/{project\_id}/search**

```json
{
  "query": "CNN是什么",
  "top_k": 3,
  "alpha": 0.7,
  "enable_rerank": true
}
```

返回匹配片段及分数，便于验证索引与重排效果。

***

### 7. 异常处理与边界情况

| 场景                  | 处理策略                                         |
| ------------------- | -------------------------------------------- |
| PDF 为扫描图片无文字        | 明确报错“图片型 PDF 暂不支持”，标记 `parse_status: failed` |
| 文件过大（>30MB）         | 后端拒绝并提示“文件过大，请拆分上传”                          |
| Embedding API 超时/限流 | 指数退避重试 3 次，仍失败则标记为“待处理”并由定时任务重试              |
| 多文件并发上传             | 限制同一项目同时解析数为 1，防止 FAISS 写入冲突                 |
| 项目无文档               | 跳过检索，只注入系统提示词，正常对话                           |
| Reranker API 不可用    | 降级为仅混合检索结果，不阻断对话                             |

***

### 8. 前端展示配合

- **文件列表**：显示解析状态（⌛ 处理中 / ✅ 已索引 / ❌ 失败，hover 显示详情）。
- **AI 回复底部**：若使用参考文件，展示 📎 **参考来源** 折叠面板，列出文件名、页码与片段摘要。
- **项目设置**：增加检索配置项：`alpha` 滑块（语义 ↔ 关键词）、`top_k` 选择器、Reranker 开关。

***

### 9. 部署与配置

- FAISS 索引存储：`data/projects/{project_id}/faiss_index/`
- BM25 索引：`data/projects/{project_id}/bm25_index.pkl`
- 环境变量：
  - `EMBEDDING_PROVIDER=aliyun` （默认）
  - `ALIYUN_DASHSCOPE_API_KEY=sk-...`
  - `ENABLE_RERANK=1` （可选）
- Embedding 本地缓存：MD5(text) → vector，减少重复调用

***

### 10. 验收标准

1. 上传文本型 PDF，解析成功，对话中 AI 准确引用原文片段，无乱码。
2. 上传 Word、PPT，均可正常检索并回答相关问题。
3. 上传图片扫描 PDF，系统正确提示失败，不输出乱码。
4. 删除文件后，对应内容不再被检索到。
5. 调整 alpha 为 0（纯关键词）和 1（纯语义），回复引用的侧重点明显不同。
6. AI 回复底部正确展示参考来源（文件名、页码）。
7. Embedding/ Reranker API 异常时，系统可优雅降级或提示，对话不中断。

***

### 11. 实施顺序

| 阶段      | 内容                   | 关键动作                                           |
| ------- | -------------------- | ---------------------------------------------- |
| 紧急修复    | PDF 解析替换为 PyMuPDF    | 替换原有读取逻辑，保证文本提取                                |
| Phase 1 | Word/PPT 解析 + 基础 RAG | 增加解析器，实现文本分块与阿里 text-embedding-v2，单文件 FAISS 检索 |
| Phase 2 | 混合检索 + 增量索引          | BM25 + 向量融合；全项目索引管理；前端来源展示                     |
| Phase 3 | Reranker 精度增强 + 健壮性  | 接入 gte-rerank，任务队列、缓存、自动重建索引                   |

***

此 PRD 已全面替换为阿里云 text-embedding-v2 与 gte-rerank，既符合国内 API 要求，又保证了中文场景下的稳定和高精度，可直接作为后端开发的实施依据。
