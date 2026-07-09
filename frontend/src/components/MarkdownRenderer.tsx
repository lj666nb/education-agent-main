import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { splitContentWithDiagrams } from '../utils/drawio'
import DiagramImage from './DiagramImage'
import 'katex/dist/katex.min.css'

// 转换 LaTeX 定界符：\( → $, \[ → $$
function preprocessMath(text: string): string {
  if (!text) return text
  return text.replace(/\\\(/g, '$').replace(/\\\)/g, '$').replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
}

// 清理 Markdown 源码：去除前导空白和解包裹 fences
function cleanMarkdown(text: string): string {
  if (!text) return text
  // 将字面量 \n 转换为真实换行（AI 生成的内容可能包含 \n 转义序列）
  let cleaned = text.replace(/\\n/g, '\n')
  // 解包裹 ```markdown 或 ``` 代码 fence（仅当整个文档被包裹时）
  cleaned = cleaned.replace(/^```(?:markdown)?\s*\n?([\s\S]*?)```\s*$/, '$1')
  return cleaned.trim()
}

/** 检测代码语言 */
function detectLanguage(className?: string): string {
  const match = /language-(\w+)/.exec(className || '')
  if (!match) return 'text'
  const lang = match[1].toLowerCase()
  const langMap: Record<string, string> = {
    py: 'python', js: 'javascript', ts: 'typescript',
    cpp: 'cpp', 'c++': 'cpp', cs: 'csharp', rb: 'ruby',
    go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
    swift: 'swift', sh: 'bash', bash: 'bash', zsh: 'bash',
    yaml: 'yaml', yml: 'yaml', json: 'json', xml: 'xml',
    html: 'html', css: 'css', scss: 'scss', sql: 'sql',
    md: 'markdown', markdown: 'markdown',
  }
  return langMap[lang] || lang
}

/** 渲染纯文本 + 图表的混合内容 */
function RichContent({ content }: { content: string }) {
  const segments = splitContentWithDiagrams(content)

  if (segments.length === 1 && segments[0].type === 'text') {
    // 纯文本，使用 ReactMarkdown 渲染
    return <MarkdownBody content={segments[0].content} />
  }

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <MarkdownBody key={idx} content={seg.content} />
        } else if (seg.type === 'svg') {
          return (
            <div key={idx} style={{
              margin: '0.75rem 0',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: 8,
              border: '1px solid var(--gray-100)',
              overflow: 'auto',
              textAlign: 'center',
            }}>
              <div dangerouslySetInnerHTML={{ __html: seg.content }} />
            </div>
          )
        } else if (seg.type === 'plot') {
          return (
            <div key={idx} style={{
              margin: '0.75rem 0',
              padding: '1rem',
              backgroundColor: '#fff',
              borderRadius: 8,
              border: '1px solid var(--gray-100)',
              textAlign: 'center',
              color: 'var(--gray-500)',
              fontSize: '0.8125rem',
            }}>
              📊 图表将由后端生成，请刷新页面查看
            </div>
          )
        } else {
          return <DiagramImage key={`d-${idx}`} xml={seg.content} />
        }
      })}
    </>
  )
}

/** 纯 Markdown 文本渲染（不含图表标记） */
function MarkdownBody({ content }: { content: string }) {
  const processed = preprocessMath(cleanMarkdown(content))
  if (!processed) return null

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // ── 段落 ──
        p({ children }) {
          return <p style={{ margin: '0.5rem 0', lineHeight: 1.7 }}>{children}</p>
        },

        // ── 标题 ──
        h1({ children }) {
          return <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1.25rem 0 0.5rem', lineHeight: 1.3 }}>{children}</h1>
        },
        h2({ children }) {
          return <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1rem 0 0.5rem', lineHeight: 1.3 }}>{children}</h2>
        },
        h3({ children }) {
          return <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.875rem 0 0.375rem', lineHeight: 1.3 }}>{children}</h3>
        },

        // ── 列表 ──
        ul({ children }) {
          return <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 1.7 }}>{children}</ul>
        },
        ol({ children }) {
          return <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 1.7 }}>{children}</ol>
        },
        li({ children }) {
          return <li style={{ marginBottom: '2px' }}>{children}</li>
        },

        // ── 引用块 ──
        blockquote({ children }) {
          return (
            <blockquote style={{
              borderLeft: '4px solid var(--primary)',
              paddingLeft: '1rem',
              margin: '0.75rem 0',
              color: 'var(--gray-500)',
            }}>
              {children}
            </blockquote>
          )
        },

        // ── 链接 ──
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
              {children}
            </a>
          )
        },

        // ── 图片 ──
        img({ src, alt }) {
          const [failed, setFailed] = useState(false)
          if (failed) {
            return (
              <div style={{
                padding: '12px 16px', margin: '0.5rem 0',
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 8, fontSize: '0.8125rem',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>🖼️</span>
                <span style={{ color: '#92400E' }}>{alt || '图片'}</span>
                <a href={src} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  查看原图 →
                </a>
              </div>
            )
          }
          return (
            <img
              src={src}
              alt={alt || '图片'}
              style={{ maxWidth: '100%', borderRadius: 8, margin: '0.5rem 0' }}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          )
        },

        // ── 表格 ──
        table({ children }) {
          return (
            <div style={{ overflowX: 'auto', margin: '0.75rem 0' }}>
              <table style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontSize: '0.875rem',
                lineHeight: 1.6,
              }}>
                {children}
              </table>
            </div>
          )
        },
        thead({ children }) {
          return <thead style={{ backgroundColor: 'var(--gray-50)', borderBottom: '2px solid var(--gray-300)' }}>{children}</thead>
        },
        tbody({ children }) {
          return <tbody>{children}</tbody>
        },
        tr({ children }) {
          return <tr style={{ borderBottom: '1px solid var(--gray-200)' }}>{children}</tr>
        },
        th({ children, style }) {
          return (
            <th style={{
              border: '1px solid var(--gray-300)',
              padding: '0.5rem 0.75rem',
              textAlign: 'left',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              ...style,
            }}>
              {children}
            </th>
          )
        },
        td({ children, style }) {
          return (
            <td style={{
              border: '1px solid var(--gray-200)',
              padding: '0.5rem 0.75rem',
              ...style,
            }}>
              {children}
            </td>
          )
        },

        // ── 代码 ──
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match && !className
          const codeString = String(children).replace(/\n$/, '')
          const [copied, setCopied] = useState(false)

          if (isInline) {
            return (
              <code style={{
                backgroundColor: 'var(--gray-100)',
                padding: '0.2em 0.4em',
                borderRadius: 4,
                fontSize: '0.875em',
                color: 'var(--danger)',
              }} {...props}>
                {children}
              </code>
            )
          }

          const lang = detectLanguage(className)

          return (
            <div style={{ margin: '0.75rem 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #333' }}>
              {/* 代码块头部 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.375rem 0.75rem',
                backgroundColor: '#1a1a2e',
                borderBottom: '1px solid #333',
              }}>
                <span style={{
                  fontSize: '0.7rem',
                  color: '#888',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {lang}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(codeString).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                  style={{
                    padding: '0.125rem 0.5rem',
                    fontSize: '0.65rem',
                    border: '1px solid #444',
                    borderRadius: 3,
                    backgroundColor: copied ? '#10B981' : '#2d2d2d',
                    color: copied ? '#fff' : '#aaa',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match ? match[1] : 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          )
        },

        // ── 粗体/强调 ──
        strong({ children }) {
          return <strong style={{ fontWeight: 600 }}>{children}</strong>
        },
        em({ children }) {
          return <em style={{ fontStyle: 'italic' }}>{children}</em>
        },

        // ── 分割线 ──
        hr() {
          return <hr style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '1rem 0' }} />
        },

        // ── 删除线 ──
        del({ children }) {
          return <del style={{ textDecoration: 'line-through', color: 'var(--gray-400)' }}>{children}</del>
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}

export default function MarkdownRenderer({ content: rawContent, inline }: { content: string; inline?: boolean }) {
  // 安全转换非字符串内容
  const content = typeof rawContent === 'string' ? rawContent : (rawContent ? String(rawContent) : '')
  if (!content) return null

  if (inline) {
    const processed = preprocessMath(cleanMarkdown(content))
    return <span style={{ lineHeight: 1.7 }}>{processed}</span>
  }

  // 先检查是否包含图表标记，如有则分段渲染
  return <RichContent content={content} />
}
