# AI 对话界面全面重设计 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 对话界面整体改造为 Qwen 风格的现代设计，保持浅色主题，全部使用 Lucide React 图标

**Architecture:** 重写 4 个核心前端组件（ChatPlatform / MessageList / InputArea / Sidebar），新增 lucide-react 依赖，追加 CSS 变量和动画。后端零变更，所有现有功能保持不变。

**Tech Stack:** React 18 + TypeScript, Lucide React, ReactMarkdown, Prism SyntaxHighlighter

## Global Constraints

- 保持浅色主题（非暗色）
- 所有图标使用 `lucide-react`（非 emoji、非自定义 SVG）
- 所有用户可见文字为中文
- 后端 API 零变更
- store/chat.ts 接口不变（`Message` 类型保持导出）
- ChatPanel.tsx（旧组件，用 ChatMessages/ChatInputArea）不动
- 所有现有功能必须保持：流式响应、代码高亮、Drawio、Code Runner、文件上传、导出、会话管理、项目选择

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/package.json` | 修改 | 新增 `lucide-react` 依赖 |
| `frontend/src/index.css` | 修改 | 追加新 CSS 变量和动画 keyframes |
| `frontend/src/components/MessageList.tsx` | 重写 | 消息气泡新样式 + 图标操作栏 |
| `frontend/src/components/InputArea.tsx` | 重写 | 居中大卡片输入 + 建议标签 + 功能标签栏 |
| `frontend/src/components/Sidebar.tsx` | 重写 | 可折叠图标模式 + 时间分组 |
| `frontend/src/components/ChatPlatform.tsx` | 重写 | 新布局编排（逻辑保留，JSX 重写） |

---

### Task 1: 安装 lucide-react 依赖

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `lucide-react` 包在 `node_modules` 中可用

- [ ] **Step 1: 安装 lucide-react**

```bash
cd frontend && npm install lucide-react
```

- [ ] **Step 2: 验证安装**

```bash
cd frontend && node -e "const l = require('lucide-react'); console.log(Object.keys(l).slice(0,10))"
```

Expected: 输出 `['AArrowDown', 'AArrowUp', 'ALargeSmall', 'Accessibility', 'Activity', 'AirVent', 'Airplay', 'AlarmClock', 'AlarmClockCheck', 'AlarmClockMinus']` 等图标名

- [ ] **Step 3: 重启前端容器**

```bash
docker-compose restart frontend
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add lucide-react dependency"
```

---

### Task 2: 更新 CSS 设计令牌和动画

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: 新 CSS 变量和动画 keyframes 可供所有组件使用

- [ ] **Step 1: 在 `:root` 块末尾追加新的 CSS 变量**

在 `frontend/src/index.css` 的 `:root` 块内，`--transition-slow` 之后追加：

```css
  /* ── Chat redesign tokens ── */
  --chat-bg: linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%);
  --chat-sidebar-width: 260px;
  --chat-sidebar-collapsed: 56px;
  --chat-header-height: 56px;
  --chat-bubble-ai-bg: #FFFFFF;
  --chat-bubble-ai-border: #F0F0F0;
  --chat-bubble-ai-shadow: 0 1px 3px rgba(0,0,0,0.04);
  --chat-bubble-user-bg: linear-gradient(135deg, #0284C7, #0369A1);
  --chat-input-max-width: 768px;
  --chat-input-bg: #FFFFFF;
  --chat-input-shadow: 0 4px 24px rgba(0,0,0,0.06);
  --chat-input-shadow-focus: 0 4px 24px rgba(2,132,199,0.12);
  --chat-tag-bg: #F1F5F9;
  --chat-tag-active-bg: #0284C7;
  --chat-tag-active-color: #FFFFFF;
```

- [ ] **Step 2: 追加新动画 keyframes**

在文件末尾追加：

```css
@keyframes message-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes dot-pulse {
  0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
  40%           { transform: scale(1);   opacity: 1; }
}

@keyframes sidebar-slide-in {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.chat-message-enter {
  animation: message-slide-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-dot-bounce {
  animation: dot-pulse 1.4s ease-in-out infinite both;
}

.chat-dot-bounce:nth-child(2) { animation-delay: 0.2s; }
.chat-dot-bounce:nth-child(3) { animation-delay: 0.4s; }
```

- [ ] **Step 3: 验证 CSS 文件无语法错误**

```bash
cd frontend && npx tailwindcss -i src/index.css --dry-run 2>&1 | head -5
```

Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: add chat redesign CSS tokens and animations"
```

---

### Task 3: 重写 MessageList.tsx — 消息气泡 + 图标操作栏

**Files:**
- Modify: `frontend/src/components/MessageList.tsx`

**Interfaces:**
- Consumes: lucide-react (`RefreshCw`, `Volume2`, `Copy`), 新 CSS 变量
- Produces: 导出 `Message` 类型（签名不变），导出 `MessageList` 组件（Props 签名不变）
- Props 接口完全不变：`messages`, `isLoading`, `enableThinking`, `onRunCode`, `onRollback`, `onEditDiagram`, `onGenerateMindmap`

- [ ] **Step 1: 更新 import，加入 lucide 图标**

将现有的 SVG 图标函数（`BrainIcon`, `ExportIcon`）替换为 lucide 导入，新增操作栏图标：

```tsx
import { RefreshCw, Volume2, Copy, Brain, Download, ChevronDown, FileText, LinkIcon } from 'lucide-react'
```

删除文件中自定义的 `BrainIcon()` 和 `ExportIcon()` SVG 函数定义。

- [ ] **Step 2: 在 MessageList 组件内新增 `SpeakingManager`**

在组件顶部加入朗读状态管理：

```tsx
const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

const handleSpeak = useCallback((msgId: string, content: string) => {
  if (speakingMsgId === msgId) {
    window.speechSynthesis.cancel()
    setSpeakingMsgId(null)
    return
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(content.replace(/[#*`~\[\]()>!\[\]]/g, ''))
  u.lang = 'zh-CN'
  u.rate = 1.0
  u.onend = () => setSpeakingMsgId(null)
  u.onerror = () => setSpeakingMsgId(null)
  utteranceRef.current = u
  setSpeakingMsgId(msgId)
  window.speechSynthesis.speak(u)
}, [speakingMsgId])

// cleanup on unmount
useEffect(() => { return () => window.speechSynthesis.cancel() }, [])
```

- [ ] **Step 3: 重写 AI 消息气泡样式**

将 AI 消息的气泡样式从当前的灰色背景改为白色卡片。找到 AI 消息的渲染处，将 `backgroundColor: 'var(--gray-50)'` 替换为：

```tsx
// AI message bubble outer wrapper
<div style={{
  maxWidth: '85%',
  padding: '20px 24px',
  borderRadius: '12px 12px 12px 4px',
  backgroundColor: 'var(--chat-bubble-ai-bg)',
  border: '1px solid var(--chat-bubble-ai-border)',
  boxShadow: 'var(--chat-bubble-ai-shadow)',
  color: 'var(--gray-800)',
  wordBreak: 'break-word',
  lineHeight: 1.7,
  fontSize: '0.9375rem',
}}>
```

- [ ] **Step 4: 重写 AI 消息操作栏（图标按钮）**

将现有的文字操作按钮替换为纯图标按钮。在 AI 消息内容下方替换操作栏：

```tsx
{/* Action buttons — always visible */}
{message.role === 'assistant' && !isLoading && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    marginTop: '14px', paddingTop: '12px',
    borderTop: '1px solid var(--gray-100)',
  }}>
    {/* 重新生成 */}
    <button
      onClick={() => onRollback?.(message.id)}
      title="重新生成"
      style={iconBtnStyle}
    >
      <RefreshCw size={15} />
    </button>
    {/* 朗读 */}
    <button
      onClick={() => handleSpeak(message.id, message.content)}
      title={speakingMsgId === message.id ? '停止朗读' : '朗读'}
      style={{
        ...iconBtnStyle,
        color: speakingMsgId === message.id ? 'var(--primary)' : 'var(--gray-400)',
      }}
    >
      <Volume2 size={15} />
    </button>
    {/* 复制 */}
    <button
      onClick={() => navigator.clipboard.writeText(message.content).catch(() => {})}
      title="复制"
      style={iconBtnStyle}
    >
      <Copy size={15} />
    </button>
  </div>
)}
```

其中 `iconBtnStyle` 定义在组件顶部：

```tsx
const iconBtnStyle: React.CSSProperties = {
  padding: '6px',
  border: 'none',
  background: 'none',
  color: 'var(--gray-400)',
  cursor: 'pointer',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.15s, background-color 0.15s',
}
```

- [ ] **Step 5: 重写用户消息气泡样式**

替换用户消息样式为蓝色渐变：

```tsx
// User message bubble
<div style={{
  maxWidth: '70%',
  padding: '14px 20px',
  borderRadius: '16px 16px 4px 16px',
  background: 'var(--chat-bubble-user-bg)',
  color: '#FFFFFF',
  wordBreak: 'break-word',
  lineHeight: 1.6,
  fontSize: '0.9375rem',
}}>
```

- [ ] **Step 6: 更新打字指示器为跳动圆点动画**

将加载中的 spinner 替换为：

```tsx
{isLoading && (
  <div className="fade-in" style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '24px' }}>
    <div style={{
      padding: '16px 24px',
      borderRadius: '12px 12px 12px 4px',
      backgroundColor: 'var(--chat-bubble-ai-bg)',
      border: '1px solid var(--chat-bubble-ai-border)',
      boxShadow: 'var(--chat-bubble-ai-shadow)',
      display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      <span className="chat-dot-bounce" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }} />
      <span className="chat-dot-bounce" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }} />
      <span className="chat-dot-bounce" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }} />
    </div>
  </div>
)}
```

- [ ] **Step 7: 更新空状态页面**

将空状态替换为新设计。在 `if (messages.length === 0 && !isLoading)` 分支中，替换返回内容为：

```tsx
// 新空状态
<div style={{
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '48px 24px',
}}>
  <h1 style={{
    fontSize: '1.75rem', fontWeight: 700,
    color: 'var(--gray-800)',
    fontFamily: 'var(--font-heading)',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  }}>
    开始新对话
  </h1>
  <p style={{
    fontSize: '0.9375rem', color: 'var(--gray-500)',
    marginBottom: '40px',
  }}>
    选择模型并开始对话，支持 DeepSeek 和 Qwen
  </p>

  {/* Feature cards */}
  <div style={{
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px', maxWidth: '640px', width: '100%',
  }}>
    {[
      { icon: FileUp, title: '文件上传', desc: '支持 PDF、Word、PPT' },
      { icon: Play, title: '代码运行', desc: 'Python 代码在线执行' },
      { icon: BarChart3, title: '图表生成', desc: 'AI 自动绘制各类图表' },
      { icon: GitBranch, title: '思维导图', desc: '知识结构可视化' },
    ].map(({ icon: Icon, title, desc }) => (
      <div key={title} style={{
        padding: '20px', borderRadius: '12px',
        backgroundColor: '#FFFFFF', border: '1px solid #F0F0F0',
        boxShadow: 'var(--chat-bubble-ai-shadow)',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: '12px', color: 'var(--primary)' }}>
          <Icon size={28} />
        </div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-700)', marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
          {desc}
        </div>
      </div>
    ))}
  </div>
</div>
```

将新增的 lucide 图标 `FileUp`, `Play`, `BarChart3`, `GitBranch` 加入 import。

- [ ] **Step 8: 给消息容器添加 class**

为每条消息的外层 div 添加 `className="chat-message-enter"` 以启用滑入动画。

- [ ] **Step 9: 删除不再需要的代码**

- 删除旧的 `BrainIcon()` 函数
- 删除旧的 `ExportIcon()` 函数
- 删除消息底部旧的文字操作按钮（`复制`, `撤回` 等带文字的按钮）
- 删除旧的 `生成思维导图` 文字按钮（保留功能，合并到操作栏）

- [ ] **Step 10: 验证编译**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "error" | head -10
```

Expected: 无编译错误，或仅有预先存在的错误（与本次修改无关）

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/MessageList.tsx
git commit -m "refactor: redesign MessageList with new bubble styles and icon-only action bar"
```

---

### Task 4: 重写 InputArea.tsx — 居中大卡片 + 功能标签栏

**Files:**
- Modify: `frontend/src/components/InputArea.tsx`

**Interfaces:**
- Consumes: lucide-react (`ArrowUp`, `Paperclip`, `Brain`, `Globe`, `Folder`, `Presentation`, `ChevronDown`), 新 CSS 变量
- Produces: 导出 `InputArea` 组件，Props 签名不变（`InputAreaProps` 接口不变）
- 所有现有业务逻辑保留：文件上传/粘贴、OCR、云盘保存、模型选择、发送

- [ ] **Step 1: 更新 import，替换 SVG 图标为 lucide**

```tsx
import { ArrowUp, Paperclip, Brain, Globe, Folder, Presentation, ChevronDown, Search } from 'lucide-react'
```

删除文件中 `BrainIcon()`, `SearchIcon()`, `SendIcon()`, `AttachIcon()` 自定义 SVG 函数。

- [ ] **Step 2: 新增建议问题功能**

在组件顶部添加：

```tsx
const SUGGESTIONS = [
  '解释一下这个概念',
  '这道题的考点是什么',
  '帮我制定一个学习计划',
]

const handleSuggestionClick = (text: string) => {
  if (!isLoading) {
    const fileIds = pastedFiles.map(f => f.fileId).filter((id): id is string => !!id)
    onSend(text, currentModel, enableThinking, fileIds)
  }
}
```

- [ ] **Step 3: 重写 JSX 为居中卡片布局**

完全替换 return 的 JSX（保留所有 handler 函数不变）。新结构：

```tsx
return (
  <div style={{
    padding: '20px 24px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  }}>
    {/* Card container */}
    <div style={{
      width: '100%', maxWidth: 'var(--chat-input-max-width)',
      backgroundColor: 'var(--chat-input-bg)',
      borderRadius: '16px',
      boxShadow: 'var(--chat-input-shadow)',
      border: '1px solid var(--gray-100)',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Suggestions row — shown when input is empty */}
      {!input.trim() && !isLoading && (
        <div style={{
          display: 'flex', gap: '8px', padding: '14px 16px 0',
          flexWrap: 'wrap',
        }}>
          {SUGGESTIONS.map(q => (
            <button key={q} onClick={() => handleSuggestionClick(q)} style={{
              padding: '6px 14px', borderRadius: '16px', border: '1px solid var(--gray-200)',
              background: 'var(--chat-tag-bg)', color: 'var(--gray-600)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.color = 'var(--gray-600)' }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: '10px',
        padding: '12px 16px',
      }}>
        {/* Attach button */}
        <>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isOcrLoading || isProcessingPaste}
            title="上传文件"
            style={{
              padding: '8px', border: 'none', background: 'none',
              color: 'var(--gray-400)', cursor: 'pointer',
              borderRadius: '8px', flexShrink: 0,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
          >
            <Paperclip size={20} />
          </button>
        </>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={noApiConfigured ? '请先在 API 设置中配置 API Key' : '输入消息...'}
          disabled={isLoading || noApiConfigured}
          style={{
            flex: 1, backgroundColor: 'transparent', border: 'none',
            outline: 'none', color: 'var(--gray-800)',
            fontSize: '0.9375rem', lineHeight: 1.5, resize: 'none',
            maxHeight: '200px', fontFamily: 'var(--font-body)',
            padding: '6px 0',
          }}
          rows={1}
        />

        {/* Send / Stop button */}
        {isLoading && onStopGeneration ? (
          <button onClick={onStopGeneration} style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: 'none', backgroundColor: 'var(--danger)',
            color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'transform 0.15s',
          }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '2px', backgroundColor: 'white' }} />
          </button>
        ) : (
          <button onClick={handleSend} disabled={!input.trim() || isLoading || noApiConfigured} style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: 'none',
            backgroundColor: input.trim() && !isLoading && !noApiConfigured ? 'var(--primary)' : 'var(--gray-200)',
            color: input.trim() && !isLoading && !noApiConfigured ? 'white' : 'var(--gray-400)',
            cursor: input.trim() && !isLoading && !noApiConfigured ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background-color 0.15s, transform 0.15s',
          }}>
            <ArrowUp size={20} />
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: 'var(--gray-100)', margin: '0 16px' }} />

      {/* Feature tag bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '10px 16px', flexWrap: 'wrap',
      }}>
        {/* Model selector */}
        <div style={{ position: 'relative' }}>
          <select
            value={currentModel}
            onChange={(e) => onModelChange(e.target.value as ModelType)}
            style={{
              padding: '5px 26px 5px 10px', borderRadius: '8px',
              border: '1px solid var(--gray-200)', backgroundColor: 'var(--gray-50)',
              fontSize: '0.75rem', color: 'var(--gray-600)',
              cursor: 'pointer', fontFamily: 'inherit',
              appearance: 'none', WebkitAppearance: 'none',
            }}
          >
            {MODEL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} disabled={!availableModels.includes(opt.value)}>
                {opt.label} {availableModels.includes(opt.value) ? '' : '(未配置)'}
              </option>
            ))}
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
        </div>

        {/* Deep thinking toggle */}
        <TagButton icon={Brain} label="深度思考" active={enableThinking} onClick={() => onEnableThinkingChange(!enableThinking)} />

        {/* Web search toggle */}
        {websearchAvailable ? (
          <TagButton icon={Globe} label="联网搜索" active={enableWebsearch} onClick={() => onEnableWebsearchChange(!enableWebsearch)} />
        ) : (
          <TagButton icon={Globe} label="联网搜索" active={false} disabled />
        )}
      </div>
    </div>
  </div>
)
```

- [ ] **Step 4: 新增 TagButton 辅助组件**

在 InputArea.tsx 文件内（export default 之前）添加：

```tsx
function TagButton({ icon: Icon, label, active, onClick, disabled }: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  active: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '5px 10px', borderRadius: '8px', border: '1px solid',
        borderColor: active ? 'oklch(0.55 0.18 200 / 0.3)' : 'var(--gray-200)',
        backgroundColor: active ? 'oklch(0.55 0.18 200 / 0.08)' : 'var(--gray-50)',
        color: active ? 'var(--primary)' : 'var(--gray-500)',
        fontSize: '0.75rem', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
```

**注意**：此 Task 只实现底部标签栏中的「模型选择」「深度思考」「联网搜索」三个标签。Task 6 中 ChatPlatform 会将「选择项目」和「PPT 生成」标签作为额外 props 传入，届时再扩展。

- [ ] **Step 5: 保留所有业务逻辑函数不动**

handleSend, handleKeyDown, handleInputChange, handlePaste, handleFileUpload, processFile, uploadFileToServer 等函数完整保留。

- [ ] **Step 6: 验证编译**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "error" | head -10
```

Expected: 无新增错误

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/InputArea.tsx
git commit -m "refactor: redesign InputArea as centered card with feature tag bar"
```

---

### Task 5: 重写 Sidebar.tsx — 可折叠图标模式 + 时间分组

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: lucide-react (`Search`, `Plus`, `Star`, `MessageSquare`, `PanelLeftClose`, `PanelLeftOpen`, `Trash2`, `X`), 新 CSS 变量
- Produces: 导出 `Sidebar` 组件，Props 签名不变（`SidebarProps` 接口不变）

- [ ] **Step 1: 更新 import，替换 SVG 为 lucide**

```tsx
import { Search, Plus, Star, MessageSquare, PanelLeftClose, PanelLeftOpen, Trash2, X } from 'lucide-react'
```

删除 `SearchIcon()`, `PlusIcon()`, `StarIcon()` 自定义 SVG 函数。

- [ ] **Step 2: 新增加时间分组辅助函数**

在组件顶部添加：

```tsx
function getTimeGroup(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return '本周'
  if (diffDays < 30) return '本月'
  return '更早'
}
```

- [ ] **Step 3: 重写侧边栏主体为可折叠设计**

新侧边栏结构（替换整个 return）：

```tsx
return (
  <>
    {/* Collapsed sidebar — icon only */}
    {!isOpen && (
      <div style={{
        position: 'fixed', top: 'var(--chat-header-height)', left: 0,
        width: 'var(--chat-sidebar-collapsed)', height: 'calc(100vh - var(--chat-header-height))',
        backgroundColor: '#FFFFFF', borderRight: '1px solid #F0F0F0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '16px', gap: '16px', zIndex: 100,
      }}>
        <button onClick={onToggle} title="展开侧边栏" style={collapseIconBtnStyle}>
          <PanelLeftOpen size={18} />
        </button>
        <button onClick={onNewChat} title="新建对话" style={collapseIconBtnStyle}>
          <Plus size={18} />
        </button>
        {sessions.filter(s => favorites[s.id]).slice(0, 5).map(s => (
          <button key={s.id} onClick={() => onSelectChat(s.id)} title={s.title}
            style={{
              ...collapseIconBtnStyle,
              backgroundColor: currentChatId === s.id ? 'oklch(0.55 0.18 200 / 0.08)' : 'transparent',
              color: currentChatId === s.id ? 'var(--primary)' : 'var(--gray-400)',
            }}>
            <MessageSquare size={18} />
          </button>
        ))}
      </div>
    )}

    {/* Expanded sidebar */}
    <div style={{
      position: 'fixed', top: 'var(--chat-header-height)', left: 0,
      width: isOpen ? 'var(--chat-sidebar-width)' : '0',
      height: 'calc(100vh - var(--chat-header-height))',
      backgroundColor: '#FFFFFF', borderRight: '1px solid #F0F0F0',
      transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden', zIndex: 100,
    }}>
      <div style={{
        width: 'var(--chat-sidebar-width)', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '16px',
        overflow: 'hidden',
      }}>
        {/* Top row: collapse + new chat */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <button onClick={onToggle} title="收起侧边栏" style={collapseIconBtnStyle}>
            <PanelLeftClose size={18} />
          </button>
          <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-700)', fontFamily: 'var(--font-heading)' }}>
            对话历史
          </div>
          <button onClick={onNewChat} title="新建对话"
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: 'none', backgroundColor: 'var(--primary)',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.15s',
            }}>
            <Plus size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '8px',
          border: '1px solid var(--gray-200)', backgroundColor: 'var(--gray-50)',
          marginBottom: '16px',
        }}>
          <Search size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
          <input
            type="text" placeholder="搜索对话..."
            value={localQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              backgroundColor: 'transparent', color: 'var(--gray-700)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-body)',
            }}
          />
        </div>

        {/* Favorites section */}
        {Object.keys(favorites).length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: '8px', paddingLeft: '4px',
            }}>
              <Star size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              收藏
            </div>
            {sessions.filter(s => favorites[s.id]).map(session => (
              <SessionItem key={session.id} session={session} isFav={true} {...itemProps} />
            ))}
          </div>
        )}

        {/* History grouped by time */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {groupSessionsByTime(displayedSessions.filter(s => !favorites[s.id])).map(([group, items]) => (
            <div key={group} style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '8px', paddingLeft: '4px',
              }}>
                {group}
              </div>
              {items.map(session => (
                <SessionItem key={session.id} session={session} isFav={false} {...itemProps} />
              ))}
            </div>
          ))}
          {displayedSessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
              {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Context menu — same logic as before */}
    ...
  </>
)
```

- [ ] **Step 4: 新增 SessionItem 辅助组件**

```tsx
function SessionItem({ session, isFav, currentChatId, onSelectChat, onDeleteChat, onToggleFavorite, formatTime, onContextMenu }: {
  session: ChatSession
  isFav: boolean
  currentChatId: string | null
  onSelectChat: (id: string | null) => void
  onDeleteChat: (id: string) => void
  onToggleFavorite?: (id: string) => void
  formatTime: (ts: string) => string
  onContextMenu: (e: React.MouseEvent, id: string) => void
}) {
  const isActive = currentChatId === session.id
  return (
    <div
      onClick={() => onSelectChat(session.id)}
      onContextMenu={(e) => onContextMenu(e, session.id)}
      className="sidebar-slide-in"
      style={{
        padding: '10px 12px', marginBottom: '2px', borderRadius: '8px',
        backgroundColor: isActive ? 'oklch(0.55 0.18 200 / 0.06)' : 'transparent',
        cursor: 'pointer', transition: 'background-color 0.15s',
        border: isActive ? '1px solid oklch(0.55 0.18 200 / 0.12)' : '1px solid transparent',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--gray-50)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <MessageSquare size={14} style={{ color: isActive ? 'var(--primary)' : 'var(--gray-300)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.8125rem', color: 'var(--gray-700)',
          fontWeight: isActive ? 500 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.4,
        }}>
          {session.title}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: '2px' }}>
          {formatTime(session.updated_at)}
        </div>
      </div>
      {isFav && <Star size={14} style={{ color: '#e67e22', flexShrink: 0 }} fill="#e67e22" />}
    </div>
  )
}
```

- [ ] **Step 5: 新增 groupSessionsByTime 辅助函数**

```tsx
function groupSessionsByTime(sessions: ChatSession[]): [string, ChatSession[]][] {
  const groups: Record<string, ChatSession[]> = {}
  for (const s of sessions) {
    const g = getTimeGroup(s.updated_at)
    if (!groups[g]) groups[g] = []
    groups[g].push(s)
  }
  const order = ['今天', '昨天', '本周', '本月', '更早']
  return order.filter(g => groups[g]).map(g => [g, groups[g]])
}
```

- [ ] **Step 6: 保留 context menu 逻辑**

右键菜单逻辑完全保留（handleContextAction, contextMenu 状态），仅替换其中的图标为 lucide。

- [ ] **Step 7: 验证编译**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "error" | head -10
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "refactor: redesign Sidebar with collapsible icon mode and time grouping"
```

---

### Task 6: 重写 ChatPlatform.tsx — 新布局编排

**Files:**
- Modify: `frontend/src/components/ChatPlatform.tsx`

**Interfaces:**
- Consumes: 重写后的 Sidebar, MessageList, InputArea，lucide-react 图标
- Produces: 导出 `ChatPlatform` 组件（签名不变）
- 所有业务逻辑保留不变（~800 行业务代码），只重写 JSX 布局

- [ ] **Step 1: 更新 import**

```tsx
import { PanelLeft, Folder, Presentation, Code, PenTool, Plus } from 'lucide-react'
```

替换/删除旧的 SVG 图标函数：`ArrowLeftIcon`, `FolderIcon`, `PlusIcon`, `EditIcon`, `TrashIcon`, `ImageIcon`, `FileIcon`, `CloseIcon`, `UploadIcon`。
保留仍然被非 JSX 逻辑引用的图标。

- [ ] **Step 2: 扩展 InputAreaProps（项目选择 + PPT 生成）**

在 `InputArea.tsx` 的 `InputAreaProps` 接口中追加两个可选 prop：

```tsx
interface InputAreaProps {
  // ... 所有现有 prop 保持不变 ...
  /** 项目选择回调 */
  onProjectClick?: () => void
  /** 当前选中的项目名称 */
  selectedProjectName?: string
  /** PPT 生成开关 */
  enablePpt?: boolean
  onEnablePptChange?: (enabled: boolean) => void
}
```

然后在 InputArea 底部标签栏的 JSX 中，在现有标签后追加：

```tsx
{/* 选择项目 */}
{onProjectClick && (
  <TagButton icon={Folder} label={selectedProjectName || '选择项目'} active={!!selectedProjectName} onClick={onProjectClick} />
)}

{/* PPT 生成 */}
{onEnablePptChange && (
  <TagButton icon={Presentation} label="PPT 生成" active={enablePpt ?? false} onClick={() => onEnablePptChange?.(!(enablePpt ?? false))} />
)}
```

- [ ] **Step 3: 重写整体布局 JSX（保留所有业务逻辑不变）**

新 JSX 结构（替换从 `return (` 开始到文件末尾的全部 JSX）：

```tsx
return (
  <div style={{
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: 'var(--chat-bg)',
  }}>
    {/* ═══ Header — 透明/玻璃态 ═══ */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 'var(--chat-header-height)', padding: '0 16px',
      backgroundColor: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      position: 'relative', zIndex: 200, flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--gray-200)',
            backgroundColor: 'white', color: 'var(--gray-500)',
            fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          首页
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>
          AI 对话
        </span>
      </div>

      {/* Right — feature buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => setProjectPanelOpen(!projectPanelOpen)}
          style={headerBtnStyle(!!selectedProjectForChat)}>
          <Folder size={14} />
          {selectedProjectForChat ? (projects.find(p => p.id === selectedProjectForChat)?.name || '项目') : '项目'}
        </button>
        <button onClick={() => setDiagramOpen(!diagramOpen)}
          style={headerBtnStyle(diagramOpen)}>
          <PenTool size={14} />
          Diagram
        </button>
        <button onClick={() => { if (!codeRunnerOpen) { setCodeRunnerCode('# 在此编写代码\nprint("Hello World")'); setCodeRunnerLanguage('python') } setCodeRunnerOpen(!codeRunnerOpen) }}
          style={headerBtnStyle(codeRunnerOpen)}>
          <Code size={14} />
          Code
        </button>
        <button onClick={() => { handleNewChat(); if (!sidebarOpen) setSidebarOpen(true) }}
          style={{
            ...headerBtnStyle(false), backgroundColor: 'var(--primary)',
            color: 'white', borderColor: 'var(--primary)',
          }}>
          <Plus size={14} />
          新建对话
        </button>
      </div>

      {/* Project dropdown — same as before */}
      {projectPanelOpen && ( /* ... 保留项目面板代码 ... */ )}
    </div>

    {/* ═══ API 未配置警告条 — 保留 ═══ */}
    {noApiConfigured && ( /* ... 保留原警告条代码 ... */ )}

    {/* ═══ Body ═══ */}
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentChatId={currentChatId} onSelectChat={handleSelectChat}
        onNewChat={handleNewChat} sessions={sortedSessions}
        onDeleteChat={handleDeleteChat} onSearch={handleSearch}
        searchQuery={searchQuery} favorites={favorites}
        onToggleFavorite={handleToggleFavorite} />

      {/* Chat area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        marginLeft: sidebarOpen ? 'var(--chat-sidebar-width)' : 'var(--chat-sidebar-collapsed)',
        transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden', minWidth: 0,
      }}>
        {/* Attachments bar — 保留 */}
        {pastedFiles.length > 0 && ( /* ... 保留附件栏代码 ... */ )}

        {/* Messages — scrollable */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <MessageList
            messages={messages}
            isLoading={isLoading}
            enableThinking={enableThinking}
            onRunCode={handleRunCode}
            onRollback={handleRollback}
            onGenerateMindmap={handleGenerateMindmap}
            onEditDiagram={(xml) => { setActiveDiagramXml(xml); if (!diagramOpen) setDiagramOpen(true) }}
          />
        </div>

        {/* 无关内容警告 — 保留 */}
        {irrelevantContentWarning && ( /* ... 保留 ... */ )}

        {/* Suggested questions — 移到 InputArea 内部处理 */}
        {suggestedQuestions.length > 0 && ( /* ... 保留 ... */ )}

        {/* Input area */}
        <InputArea onSend={handleSend} onFilesChange={setPastedFiles}
          isLoading={isLoading} currentModel={currentModel}
          onModelChange={setCurrentModel} enableThinking={enableThinking}
          onEnableThinkingChange={storeSetEnableThinking}
          enableWebsearch={enableWebsearch}
          onEnableWebsearchChange={storeSetEnableWebsearch}
          websearchAvailable={websearchAvailable}
          availableModels={availableModels} pastedFiles={pastedFiles}
          onStopGeneration={handleStopGeneration}
          noApiConfigured={noApiConfigured} prefillText={prefillInput}
          onProjectClick={() => setProjectPanelOpen(true)}
          selectedProjectName={selectedProjectForChat ? projects.find(p => p.id === selectedProjectForChat)?.name : undefined}
        />
      </div>
    </div>

    {/* Floating windows + Modals — 全部保留 */}
    {diagramOpen && ( /* DraggableWindow + DrawioEditor — 保留 */ )}
    {codeRunnerOpen && ( /* DraggableWindow + CodeRunnerPanel — 保留 */ )}
    {showCreateProjectModal && ( /* Modal — 保留 */ )}
    {showEditProjectModal && ( /* Modal — 保留 */ )}
    {previewFile && ( /* Preview overlay — 保留 */ )}
  </div>
)
```

- [ ] **Step 4: 新增 headerBtnStyle 辅助函数**

在 ChatPlatform 组件顶部添加：

```tsx
const headerBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: '8px', border: '1px solid',
  borderColor: active ? 'oklch(0.55 0.18 200 / 0.2)' : 'var(--gray-200)',
  backgroundColor: active ? 'oklch(0.55 0.18 200 / 0.06)' : 'white',
  color: active ? 'var(--primary)' : 'var(--gray-500)',
  fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: '5px',
  transition: 'all 0.15s', whiteSpace: 'nowrap',
})
```

- [ ] **Step 5: 删除旧的 SVG 图标函数**

删除 ChatPlatform 中不再使用的自定义 SVG 函数：`ArrowLeftIcon`, `FolderIcon`, `PlusIcon`, `EditIcon`, `TrashIcon`, `ImageIcon`, `FileIcon`, `CloseIcon`, `UploadIcon`。

- [ ] **Step 6: 删除 `chat-bg.png` 背景图引用**

移除旧的 `backgroundImage: 'url(/chat-bg.png)'` 相关代码。

- [ ] **Step 7: 验证编译**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "error" | head -20
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ChatPlatform.tsx frontend/src/components/InputArea.tsx
git commit -m "refactor: redesign ChatPlatform layout with glass-morphism header and new component integration"
```

---

### Task 7: 集成测试 — 端到端验证

**Files:**
- 无文件变更（纯测试验证）

**Interfaces:**
- Consumes: Task 1-6 的所有产出

- [ ] **Step 1: 重启前端容器**

```bash
docker-compose restart frontend
```

- [ ] **Step 2: 等待前端就绪**

```bash
sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200`

- [ ] **Step 3: Playwright E2E 测试 — 登录 + 打开对话页**

```bash
cd frontend && node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type=\"text\"]', 'guoketg');
    await page.fill('input[type=\"password\"]', '123456');
    await page.click('button[type=\"submit\"]');
    await page.waitForTimeout(3000);

    // Navigate to chat
    await page.goto('http://localhost:3000/chat');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'test_script/screenshot-chat-redesign.png', fullPage: false });
    console.log('✓ 对话页截图已保存');

    // Verify key elements
    const hasSidebar = await page.locator('text=对话历史').isVisible().catch(() => false);
    console.log('侧边栏可见:', hasSidebar);

    const hasInput = await page.locator('textarea[placeholder*=\"输入\"]').isVisible().catch(() => false);
    console.log('输入框可见:', hasInput);

    // Test sending a message
    await page.fill('textarea', '你好，请介绍一下你自己');
    await page.click('button[title=\"发送\"]');
    console.log('✓ 消息已发送');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test_script/screenshot-chat-message.png', fullPage: false });
    console.log('✓ 回复截图已保存');

    // Verify AI response rendered
    const body = await page.textContent('body');
    const hasResponse = body.length > 100;
    console.log('AI 响应已渲染:', hasResponse);

  } catch(e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
"
```

- [ ] **Step 4: 验证关键功能**

- 侧边栏能展开/折叠
- 消息气泡新样式正确渲染
- 输入卡片居中显示
- 功能标签可见（模型选择、深度思考、联网搜索）
- 流式消息正常接收
- 空状态页面正常显示

- [ ] **Step 5: 如有 Bug，截图+日志上报并修复**

- [ ] **Step 6: Commit（如有修复）**

```bash
git add -A && git commit -m "fix: E2E test fixes for chat redesign"
```

---

## 完成检查

- [ ] 所有 7 个 Task 已完成
- [ ] `npx tsc --noEmit` 无新增错误
- [ ] Docker 前端容器正常运行
- [ ] Playwright E2E 测试通过
- [ ] 消息气泡新样式正确
- [ ] 输入卡片居中显示
- [ ] 功能标签工作正常
- [ ] 侧边栏可折叠 + 时间分组
- [ ] 空状态页面美观
- [ ] 所有现有功能保持正常（流式、代码高亮、图表、导出、文件上传）
