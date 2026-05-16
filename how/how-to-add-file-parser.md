# How to Add a New File Parser (以 PPT/Word 为例)

本文记录如何为 RAG 系统新增一种文件格式的解析支持（如 PPT、Word），并让 AI Chat 界面也能兼容该格式。以此为模板，后续新增功能请遵循此流程。

---

## 概览：此次改动涉及哪些文件

```
修改的文件:
├── requirements.txt                          # 添加 python-pptx, python-docx
├── app/api/endpoints/project.py              # 后端 RAG 文档解析
├── app/api/endpoints/files.py                # 后端文件上传系统
├── app/api/endpoints/chat.py                 # 后端 Chat 附件处理 + RAG 来源回传
├── frontend/src/components/InputArea.tsx      # 前端文件上传(仅上传)
└── frontend/src/components/MessageList.tsx    # 前端参考来源展示
└── frontend/src/components/ChatPlatform.tsx   # 前端 SSE 解析 + 来源注入
```

---

## Step 1: 安装依赖

`requirements.txt` 是最基本的起点。缺了这个，解析函数会报 ImportError。

```txt
# 新增
python-pptx       # PPT (.pptx) 解析
python-docx       # Word (.docx) 解析
```

---

## Step 2: 实现文件解析器 — 后端分层注入

RAG 文件解析需要同时影响两套链路，缺一不可：

| 链路 | 触发时机 | 所在文件 | 函数 |
|------|---------|---------|------|
| **项目管理链路** | 用户在项目面板上传参考文档 | `project.py` | `extract_pptx_text()` / `extract_docx_text()` |
| **Chat 附件链路** | 用户在对话中粘贴/上传文件 | `chat.py` | `load_and_process_file()` |

### 2.1 项目管理链路 (`project.py`)

这是 RAG 的核心链路。用户上传的文档经过解析 → 分块 → 向量化 → 建索引。

**解析函数模板**：

```python
def extract_pptx_text(raw_content: bytes, max_chars: int = 50000) -> str:
    """
    模板要点:
    1. try/except 包裹整个逻辑，确保任何异常都返回中文错误提示
    2. 首行用局部导入，避免模块加载时检查依赖
    3. 返回纯文本 + 页码标记，绝不返回原始字节
    4. 有截断保护 (max_chars)
    """
    try:
        from pptx import Presentation        # 局部导入
        from io import BytesIO
        prs = Presentation(BytesIO(raw_content))
        total_slides = len(prs.slides)
        slide_texts = []
        for slide_num, slide in enumerate(prs.slides, 1):
            texts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    texts.append(shape.text.strip())
                if shape.has_table:          # 特殊处理表格
                    table = shape.table
                    for row in table.rows:
                        row_texts = [cell.text.strip() for cell in row.cells]
                        texts.append(" | ".join(row_texts))
            if texts:
                slide_texts.append(f"[第{slide_num}页] " + "\n".join(texts))
        if slide_texts:
            full_text = "\n\n".join(slide_texts)
            if len(full_text) > max_chars:
                full_text = full_text[:max_chars] + f"\n\n... [内容已截断，仅显示前{max_chars}字符]"
            return full_text
        elif total_slides > 0:
            return f"[该PPT共{total_slides}页，未能提取到可识别的文本内容]"
        else:
            return "[PPT文件为空]"
    except ImportError:
        return "[PPT解析库未安装，无法提取文件内容，请安装python-pptx]"
    except Exception as e:
        return f"[PPT文件解析失败: {str(e)}]"
```

**上传端点修改**：在 `upload_document()` 中检测文件扩展名并调用对应解析器：

```python
file_ext = os.path.splitext(file.filename or "")[1].lower()
is_pptx = file_ext == ".pptx" or (file.content_type and "presentationml" in file.content_type)
is_docx = file_ext == ".docx" or (file.content_type and "wordprocessingml" in file.content_type)

if is_pptx:
    content_text = extract_pptx_text(raw_content)
elif is_docx:
    content_text = extract_docx_text(raw_content)
```

### 2.2 Chat 附件链路 (`chat.py`)

用户在聊天中输入 PPT 文件时，`load_and_process_file()` 需要提取文本注入 LLM。

```python
# 在文件扩展名列表中增加 .pptx, .docx
for ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.pdf', '.pptx', '.docx']:
    # ...
    if is_pptx:
        # 解析 PPT 文本，设置 result["type"] = "document"
        # 设置 result["text"] = f"[PPT 文件内容]:\n{doc_text}"
        # 然后 return result
```

> **为什么 Chat 链路也要解析？** 因为在聊天中直接上传的文件不会被送入 RAG 索引，而是作为单次对话的上下文临时注入 LLM。

---

## Step 3: 扩展文件上传系统 (`files.py`)

`/api/v1/files/upload` 是 Chat 附件的上传入口。需要在所有文件操作函数（upload / info / download / delete）的扩展名列表中增加新格式：

```python
# 文件类型白名单
'.pptx', '.docx'

# get_file_info 中需要处理 MIME type 和 file_type
is_pptx = ext == '.pptx'
is_docx = ext == '.docx'
mime_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
file_type = "pptx"
```

---

## Step 4: 前端文件上传支持 — 三处修改

前端需要修改三个地方才能让文件上传正常工作：

### 4.1 accept 属性 (InputArea.tsx)

文件 `input` 的 `accept` 属性控制 OS 文件选择器显示哪些文件。**必须同时使用扩展名和 MIME 类型**，因为 Windows 文件对话框对 `.pptx` 这样的扩展名支持不稳定：

```jsx
accept="image/*,.pdf,.pptx,.ppt,.docx,.doc,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
```

### 4.2 文件类型校验 (InputArea.tsx)

`processFile()` 和 `handleFileUpload()` 中都需要做文件类型白名单校验。**注意用 `.toLowerCase()` 处理扩展名大小写**：

```typescript
const fileName = file.name.toLowerCase()
const isPptx = file.type.includes('presentationml') || fileName.endsWith('.pptx')
const isDocx = file.type.includes('wordprocessingml') || fileName.endsWith('.docx')
```

> **校验层级**：
> 1. `accept` 属性 = 第一道防线（OS 过滤）
> 2. `handleFileUpload` 校验 = 第二道防线（JS 过滤）
> 3. 后端 `files.py` 校验 = 最终防线（服务端过滤）

### 4.3 项目创建/编辑弹窗 (ChatPlatform.tsx)

项目面板里的文件上传 input 也要更新：

```jsx
<input type="file" ... accept=".txt,.md,.pdf,.doc,.docx,.pptx" />
```

---

## Step 5: RAG 来源回传 (可选但推荐)

让前端展示 RAG 检索到的文档来源，提升透明度。

### 5.1 后端：SSE 流携带来源信息

修改 `build_project_context()` 使其同时返回来源列表：

```python
async def build_project_context(...):
    # ...
    sources = []
    for result in retrieval_results:
        sources.append({
            "document_name": doc_name,
            "content_snippet": content[:150],
            "score": round(float(score), 2)
        })
    return context_string, sources
```

在 SSE 流的最后一个事件中携带 `sources`：

```python
final_data = {'done': True, 'thinking_done': True}
if rag_sources:
    final_data['sources'] = rag_sources
yield f"data: {json.dumps(final_data)}\n\n"
```

### 5.2 前端：打印来源

- `MessageList.tsx`：Message 接口增加 `sources` 字段
- AI 消息气泡底部增加可折叠 "📎 参考来源" 面板
- `ChatPlatform.tsx`：SSE 解析时捕获 `sources` 并注入消息

---

## 检查清单

新增文件格式后，用以下清单确认完整覆盖：

| # | 检查项 | 位置 | 说明 |
|---|--------|------|------|
| 1 | 依赖安装 | `requirements.txt` | 新增 python-pptx / python-docx |
| 2 | RAG 解析 | `project.py` | `extract_pptx_text()` 解析 + `upload_document()` 调度 |
| 3 | 文件系统 | `files.py` | 所有函数的白名单扩展名列表 + MIME type |
| 4 | Chat 附件 | `chat.py` | `load_and_process_file()` 解析分支 |
| 5 | 前端 accept | `InputArea.tsx` | 扩展名 + MIME type 双保险 |
| 6 | 前端校验 | `InputArea.tsx` | `processFile()` + `handleFileUpload()` 大小写不敏感 |
| 7 | 项目面板 | `ChatPlatform.tsx` | 创建/编辑弹窗的 accept 属性 |
| 8 | 来源展示 | `MessageList.tsx` | 如果加 RAG 来源回传，需更新 Message 接口和 UI |
| 9 | 文档更新 | `CONTRIBUTING.md` | 追加本次贡献记录 |
| 10 | 测试验证 | 手动测试 | 上传新格式文件，确认解析成功、索引正常、对话可引用 |

---

## 设计原则

1. **文本优先**：禁止将原始文件字节流传给 LLM，必须经解析引擎提取纯文本
2. **分层防御**：前端 accept → 前端 JS 校验 → 后端文件类型校验 → 后端解析器
3. **异常友好**：所有解析失败返回中文错误提示，绝不崩溃或输出乱码
4. **局部导入**：第三方库在解析函数内部 import，而非模块顶部，避免依赖缺失导致整个服务无法启动
5. **大小写不敏感**：文件扩展名比较前统一 `.toLowerCase()`
