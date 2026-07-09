import React, { useState } from 'react'
import type { NotebookResource } from '../../api/recommendationsCenter'
import { RESOURCE_TYPE_CONFIG } from '../../api/recommendationsCenter'
import './notebook.css'

interface ResourceCardProps {
  resource: NotebookResource
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deleting: boolean
}

export default function ResourceCard({ resource, onViewDetail, onDelete, deleting }: ResourceCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const typeCfg = RESOURCE_TYPE_CONFIG[resource.resource_type]
  const badgeColor = typeCfg?.color || '#0369A1'
  const badgeBg = typeCfg?.bg || 'rgba(3,105,161,0.1)'
  const typeLabel = resource.resource_type_label || resource.resource_type
  const content = resource.content || ''

  return (
    <div className="nb-resource-card">
      {/* Header bar — click to toggle content */}
      <div className="nb-resource-card-header" onClick={() => setCollapsed(prev => !prev)} style={{ cursor: 'pointer' }}>
        <span className={`nb-resource-card-chevron${collapsed ? '' : ' nb-resource-card-chevron--open'}`}>▶</span>
        <span className="nb-resource-card-title">{resource.title}</span>
        <span className="nb-resource-card-badge" style={{ background: badgeBg, color: badgeColor }}>{typeLabel}</span>
      </div>

      {/* Inline content — rendered by resource type */}
      {!collapsed && content && (
        <div className="nb-resource-card-body">
          {renderContent(resource.resource_type, content)}
        </div>
      )}
      {!collapsed && !content && (
        <div className="nb-resource-card-body">
          <p className="nb-content-empty">暂无内容预览</p>
        </div>
      )}

      {/* Actions */}
      <div className="nb-resource-card-actions">
        <button className="nb-resource-card-action-btn" onClick={() => onViewDetail(resource.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          全屏查看
        </button>
        <button className="nb-resource-card-action-btn nb-resource-card-action-btn--danger" onClick={() => onDelete(resource.id)} disabled={deleting}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          {deleting ? '删除中...' : '移除'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Content renderers by resource type
   ══════════════════════════════════════════════════════════════ */

function renderContent(type: string, content: string): React.ReactNode {
  switch (type) {
    case 'mind_map': return <MindMapView content={content} />
    case 'code_case': return <CodeView content={content} />
    case 'document':
    case 'image_text': return <MarkdownView content={content} />
    case 'exercise': return <ExerciseView content={content} />
    case 'video_script': return <ScriptView content={content} />
    default: return <MarkdownView content={content} />
  }
}

/** Mind Map — parse markdown list into nested visual tree */
function MindMapView({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length === 0) return <p className="nb-content-empty">暂无内容</p>

  interface Node { text: string; depth: number; children: Node[] }
  const nodes: Node[] = []
  const stack: Node[] = []

  for (const line of lines) {
    const match = line.match(/^(\s*)-\s+(.+)/)
    if (!match) continue
    const depth = Math.floor(match[1].length / 2)
    const text = match[2].replace(/\*\*(.+?)\*\*/g, '$1').trim()
    const node: Node = { text, depth, children: [] }
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop()
    if (stack.length === 0) nodes.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }

  if (nodes.length === 0) return <pre className="nb-content-text">{content.slice(0, 1500)}</pre>

  return <div className="nb-mindmap">{nodes.map((n, i) => renderMindNode(n, i))}</div>
}

function renderMindNode(node: { text: string; children: any[] }, key: number): React.ReactNode {
  if (node.children.length === 0) {
    return <div key={key} className="nb-mindmap-leaf">{node.text}</div>
  }
  return (
    <div key={key} className="nb-mindmap-branch">
      <div className="nb-mindmap-branch-title">{node.text}</div>
      <div className="nb-mindmap-children">{node.children.map((c, i) => renderMindNode(c, i))}</div>
    </div>
  )
}

/** Code — extract code blocks with syntax highlighting */
function CodeView({ content }: { content: string }) {
  const codeMatch = content.match(/```(?:python|py)?\n?([\s\S]*?)```/)
  const code = codeMatch ? codeMatch[1].trim() : content
  const descMatch = content.match(/^([\s\S]*?)```/)
  const description = descMatch ? descMatch[1].trim().slice(0, 300) : ''

  return (
    <div className="nb-code-view">
      {description && <p className="nb-code-desc">{description}</p>}
      <pre className="nb-code-block"><code>{code.slice(0, 2000)}</code></pre>
    </div>
  )
}

/** Markdown — render as formatted HTML */
function MarkdownView({ content }: { content: string }) {
  if (!content) return <p className="nb-content-empty">暂无内容</p>
  const html = simpleMarkdown(content.slice(0, 4000))
  return <div className="nb-markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}

/** Exercise — render stem + options */
function ExerciseView({ content: raw }: { content: string }) {
  try {
    const data = JSON.parse(raw)
    return (
      <div className="nb-exercise-view">
        <p className="nb-exercise-stem">{data.stem || raw}</p>
        {data.options?.length > 0 && (
          <div className="nb-exercise-options">
            {data.options.map((opt: any, i: number) => (
              <div key={i} className="nb-exercise-option">
                <span className="nb-exercise-option-key">{opt.key || String.fromCharCode(65 + i)}</span>
                <span>{opt.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  } catch { return <MarkdownView content={raw} /> }
}

/** Script — render as preformatted text */
function ScriptView({ content }: { content: string }) {
  return <pre className="nb-content-text">{content.slice(0, 2000)}</pre>
}

/* ══════════════════════════════════════════════════════════════
   Minimal markdown → HTML
   ══════════════════════════════════════════════════════════════ */

function simpleMarkdown(md: string): string {
  let h = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Code blocks first
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${lang}">${code.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')}</code></pre>`)
  // Inline
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>')
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
  h = h.replace(/\n\n+/g, '</p><p>')
  h = h.replace(/\n/g, '<br>')
  // Cleanup
  h = h.replace(/<p><(pre|h[1-3]|ul|blockquote)/g, '<$1')
  h = h.replace(/<\/(pre|h[1-3]|ul|blockquote)><\/p>/g, '</$1>')
  return `<p>${h}</p>`
}
