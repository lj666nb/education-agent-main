import { DIAGRAM_SYSTEM_PROMPT } from '../constants/diagramPrompt'

/**
 * Escape HTML tags inside XML attribute values.
 * AI-generated draw.io XML often contains raw <br> inside value="..." attribtues,
 * which is invalid XML. The XML parser rejects unescaped '<' in attribtue values.
 */
function escapeHtmlInXmlAttrs(xml: string): string {
  return xml.replace(/(\w+\s*=\s*")([^"]*)(")/g, (_match, prefix: string, inner: string, suffix: string) => {
    const escaped = inner
      .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return prefix + escaped + suffix
  })
}

/** Regex matching [DRAWIO], [SVG], [PLOT], and [MERMAID] markers */
const DIAGRAM_MARKER_RE = /\[(DRAWIO|SVG|PLOT|MERMAID)\]([\s\S]*?)\[\/\1\]/

function _extractMarkerContent(match: RegExpMatchArray): string {
  let content = match[2].trim()
  content = content.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
  if (match[1] === 'DRAWIO') {
    content = escapeHtmlInXmlAttrs(content)
  }
  return content
}

/**
 * Extract the first [DRAWIO]...[/DRAWIO] block from text content.
 * Returns null if no valid block found.
 */
export function extractDrawioXml(content: string): string | null {
  const match = content.match(/\[DRAWIO\]([\s\S]*?)\[\/DRAWIO\]/)
  if (!match) return null
  let xml = match[1].trim()
  xml = xml.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
  xml = escapeHtmlInXmlAttrs(xml)
  return xml.trim() || null
}

/**
 * Extract SVG content from [SVG]...[/SVG] markers.
 */
export function extractSvgContent(content: string): string | null {
  const match = content.match(/\[SVG\]([\s\S]*?)\[\/SVG\]/)
  if (!match) return null
  let svg = match[1].trim()
  svg = svg.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
  return svg.trim() || null
}

/**
 * Remove all [DRAWIO]...[/DRAWIO] / [SVG]...[/SVG] / [PLOT]...[/PLOT] blocks from content.
 */
export function stripDiagramMarkers(content: string): string {
  return content.replace(/\[(DRAWIO|SVG|PLOT|MERMAID)\][\s\S]*?\[\/\1\]/g, '').trim()
}

/**
 * Check if content contains any diagram markers.
 */
export function hasDiagramContent(content: string): boolean {
  return /\[(DRAWIO|SVG|PLOT|MERMAID)\]/.test(content)
}

/** Check if content specifically contains draw.io diagram markers. */
export function hasDrawioContent(content: string): boolean {
  return /\[DRAWIO\]/.test(content)
}

/**
 * Strip ALL diagram markers (both [DRAWIO] and [SVG]) from streaming content,
 * replacing them with a placeholder to avoid showing raw XML/SVG code in the chat.
 * The actual diagram is only rendered after streaming completes (see ChatPlatform.tsx
 * where final setMessages restores fullContent including markers).
 */
export function stripDiagramDuringStreaming(content: string): string {
  const markerMatch = content.match(/\[(DRAWIO|SVG|PLOT|MERMAID)\]/)
  if (markerMatch) {
    // 根据图表类型给出不同的占位提示
    const type = markerMatch[1]
    const label = type === 'DRAWIO' ? '🧠 思维导图生成中...' : type === 'PLOT' ? '📊 图表生成中...' : type === 'SVG' ? '🎨 图形生成中...' : '📐 图表生成中...'
    return content.substring(0, markerMatch.index!).trimEnd() + `\n\n> **${label}**\n> AI 正在为您生成可视化内容，流式传输完成后将自动渲染，请稍候...\n\n`
  }
  return content
}

export interface ContentSegment {
  type: 'text' | 'diagram' | 'svg' | 'plot' | 'mermaid'
  content: string
}

/**
 * Split content into alternating text and diagram/SVG segments,
 * preserving the original order as the AI intended.
 */
export function splitContentWithDiagrams(content: string): ContentSegment[] {
  const parts: ContentSegment[] = []
  let remaining = content
  while (remaining.length > 0) {
    const match = remaining.match(DIAGRAM_MARKER_RE)
    if (!match) {
      const trimmed = remaining.trim()
      if (trimmed) parts.push({ type: 'text', content: trimmed })
      break
    }
    const before = remaining.slice(0, match.index!).trim()
    if (before) parts.push({ type: 'text', content: before })

    const inner = _extractMarkerContent(match)
    if (inner) {
      const markerType = match[1]
      const typeMap: Record<string, ContentSegment['type']> = {
        SVG: 'svg',
        PLOT: 'plot',
        MERMAID: 'mermaid',
        DRAWIO: 'diagram',
      }
      parts.push({
        type: typeMap[markerType] || 'diagram',
        content: inner,
      })
    }

    remaining = remaining.slice(match.index! + match[0].length)
  }
  return parts
}

/**
 * Build the system prompt fragment about diagram capabilities.
 * Content loaded from constants/diagramPrompt.ts
 */
export function getDrawioSystemPrompt(): string {
  return DIAGRAM_SYSTEM_PROMPT
}
