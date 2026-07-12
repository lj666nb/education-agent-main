import React, { useMemo, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CitationBadge from './CitationBadge'
import { Citation } from './CitationHoverCard'

interface CitationAwareMarkdownProps {
  content: string
  citations?: Citation[]
}

/** 段落内的片段：文本 或 引用角标 */
type InlineSegment =
  | { type: 'text'; content: string }
  | { type: 'citation'; indices: number[] }

/**
 * 在单行/段落内解析 [citation:X] 标记，
 * 拆分为 text 和 citation 交替的片段（均为内联元素）
 */
function parseInlineCitations(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  const regex = /\[citation:(\d+(?:,\d+)*)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    const indices = match[1].split(',').map(Number).filter(n => !isNaN(n))
    segments.push({ type: 'citation', indices })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

/** 用 \n\n（空行）把内容拆成段落 */
function splitParagraphs(content: string): string[] {
  return content.split(/\n{2,}/).filter(p => p.trim().length > 0)
}

/**
 * 内联 Markdown 渲染 — 不使用 <p> 包裹
 * 只渲染 **bold**、[link](url)、`code` 等行内格式
 */
function InlineMarkdownSpan({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <>{children}</>,
        // Keep lists/blockquotes as blocks if they appear, but normally
        // inline segments shouldn't contain those at this level
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

/** 渲染一个段落：内联文本 + 引用角标，全部包在一个 <p> 里 */
function CitationParagraph({ text, citations }: { text: string; citations: Citation[] }) {
  const segments = parseInlineCitations(text)

  return (
    <p style={{ margin: '0 0 0.5rem 0' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <InlineMarkdownSpan key={i} text={seg.content} />
        }
        if (seg.type === 'citation') {
          return <CitationBadge key={i} indices={seg.indices} citations={citations} />
        }
        return null
      })}
    </p>
  )
}

export default function CitationAwareMarkdown({
  content,
  citations,
}: CitationAwareMarkdownProps) {
  // No citations → full ReactMarkdown with all features
  if (!citations || citations.length === 0) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  }

  // 按段落拆分，每个段落内处理引用角标
  const paragraphs = useMemo(() => splitParagraphs(content), [content])

  return (
    <>
      {paragraphs.map((para, i) => (
        <CitationParagraph key={i} text={para} citations={citations} />
      ))}
    </>
  )
}
