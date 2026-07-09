import React from 'react'
import type { NotebookTopic } from '../../api/recommendationsCenter'
import ResourceTypeSection from './ResourceTypeSection'
import './notebook.css'

interface ResourceArticleProps {
  topic: NotebookTopic | null
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
  composedNote: string | null
  onCloseComposed: () => void
}

export default function ResourceArticle({ topic, onViewDetail, onDelete, deletingId, composedNote, onCloseComposed }: ResourceArticleProps) {
  // ── Composed Note View ──
  if (composedNote && topic) {
    return (
      <div className="nb-article">
        <button className="nb-composed-note-back" onClick={onCloseComposed}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          返回资源列表
        </button>
        <div
          className="nb-composed-note"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(composedNote) }}
        />
      </div>
    )
  }

  // ── Empty state ──
  if (!topic) {
    return (
      <div className="nb-article" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="nb-empty">
          <div className="nb-empty-icon">📖</div>
          <div className="nb-empty-title">选择一个知识点</div>
          <div className="nb-empty-desc">从左侧目录中选择一个知识点，查看系统为你整理的学习资源。</div>
        </div>
      </div>
    )
  }

  const totalResources = topic.sections.reduce((sum, s) => sum + s.resources.length, 0)

  const typeLabels = topic.sections
    .filter(s => s.resources.length > 0)
    .map(s => s.type_label)

  const orderedTypes = topic.sections
    .filter(s => s.resources.length > 0)
    .map(s => s.type_label)
  const suggestedOrder = orderedTypes.length > 0
    ? orderedTypes.join(' → ')
    : '暂无'

  return (
    <div className="nb-article">
      <h1 className="nb-article-title">{topic.title}</h1>

      <p className="nb-article-subtitle">
        系统为「{topic.title}」整理了 {totalResources} 个学习资源。
        {orderedTypes.length > 0 && (
          <>建议按顺序学习：{suggestedOrder}。</>
        )}
      </p>

      <hr className="nb-article-divider" />

      <div className="nb-article-section" id="section-overview">
        <h3 className="nb-article-section-title">📊 推荐概览</h3>
        <div className="nb-overview">
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">推荐数量</div>
            <div className="nb-overview-item-value">{totalResources}</div>
          </div>
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">资源类型</div>
            <div className="nb-overview-item-value">{typeLabels.length} 种</div>
          </div>
          {topic.mastery_score != null && (
            <div className="nb-overview-item">
              <div className="nb-overview-item-label">当前掌握度</div>
              <div className="nb-overview-item-value">{Math.round(topic.mastery_score)}%</div>
            </div>
          )}
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">建议顺序</div>
            <div className="nb-overview-item-value" style={{ fontSize: 12 }}>{suggestedOrder}</div>
          </div>
        </div>
      </div>

      {topic.sections.map(section => (
        <ResourceTypeSection
          key={section.type}
          section={section}
          sectionId={`section-${section.type}`}
          onViewDetail={onViewDetail}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </div>
  )
}

/** Simple markdown → HTML renderer (handles common patterns) */
function renderMarkdown(md: string): string {
  let html = md
    // Escaping
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks first (before other transformations)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_: string, lang: string, code: string) => {
      const escaped = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      return `<pre><code class="language-${lang}">${escaped}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // Merge adjacent blockquotes
    .replace(/<\/blockquote>\n<blockquote>/g, '<br>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Tables
    .replace(/^\|(.+)\|$/gm, (row: string) => {
      const cells = row.split('|').filter(c => c.trim()).map(c => {
        const isHeader = /^[\s-]+$/.test(c.trim())
        if (isHeader) return ''
        return c.trim().replace(/^[-:]+$/, '') ? `<td>${c.trim()}</td>` : ''
      }).join('')
      return cells ? `<tr>${cells}</tr>` : ''
    })
    // Paragraphs (double newlines)
    .replace(/\n\n+/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br>')

  // Fix: unwrap pre/code content that got caught in other rules
  html = html.replace(/<p><pre>/g, '<pre>').replace(/<\/pre><\/p>/g, '</pre>')
  html = html.replace(/<p><h([1-4])>/g, '<h$1>').replace(/<\/h[1-4]><\/p>/g, '</h$1>')
  html = html.replace(/<p><ul>/g, '<ul>').replace(/<\/ul><\/p>/g, '</ul>')
  html = html.replace(/<p><blockquote>/g, '<blockquote>').replace(/<\/blockquote><\/p>/g, '</blockquote>')
  html = html.replace(/<p><hr><\/p>/g, '<hr>')
  html = html.replace(/<li><p>/g, '<li>').replace(/<\/p><\/li>/g, '</li>')

  return `<p>${html}</p>`
}
