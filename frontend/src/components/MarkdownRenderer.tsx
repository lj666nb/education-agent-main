import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

// 转换 LaTeX 定界符：\( → $, \[ → $$
function preprocessMath(text: string): string {
  if (!text) return text
  return text.replace(/\\\(/g, '$').replace(/\\\)/g, '$').replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
}

export default function MarkdownRenderer({ content, inline }: { content: string; inline?: boolean }) {
  if (!content) return null
  const processed = preprocessMath(content)
  if (inline) {
    return <span style={{ lineHeight: 1.7 }}>{processed}</span>
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span style={{ display: 'block', marginBottom: '4px', lineHeight: 1.7 }}>{children}</span>,
        ul: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</div>,
        ol: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</div>,
        li: ({ children }) => <div style={{ marginBottom: '2px', lineHeight: 1.7 }}>• {children}</div>,
        code: ({ children, className }) => {
          if (className) {
            return <code style={{ display: 'block', background: '#1F2937', color: '#E5E7EB', padding: '10px 14px', borderRadius: 8, fontSize: '13px', margin: '8px 0', overflowX: 'auto' }}>{children}</code>
          }
          return <code style={{ background: '#F3F4F6', padding: '1px 4px', borderRadius: 4, fontSize: '13px' }}>{children}</code>
        },
        strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}
