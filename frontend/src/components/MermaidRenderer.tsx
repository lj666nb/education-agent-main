import { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'

// Initialize mermaid once
let initialized = false
function initMermaid() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'var(--font-body), "Microsoft YaHei", sans-serif',
    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true },
  })
  initialized = true
}

interface MermaidRendererProps {
  code: string
  onEdit?: (code: string) => void
}

export default function MermaidRenderer({ code, onEdit }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 11)}`)

  const renderDiagram = useCallback(async () => {
    initMermaid()
    try {
      const id = idRef.current
      const { svg: rendered } = await mermaid.render(id, code)
      setSvg(rendered)
      setError(null)
    } catch (e: any) {
      console.error('Mermaid render error:', e)
      setError(e.message || '图表渲染失败')
      setSvg(null)
    }
  }, [code])

  useEffect(() => {
    renderDiagram()
  }, [renderDiagram])

  if (error) {
    return (
      <div style={{
        margin: '0.75rem 0',
        padding: '1rem',
        backgroundColor: '#FFFBEB',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #FDE68A',
        fontSize: '0.8125rem',
        color: '#92400E',
      }}>
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>⚠️ 图表渲染失败</div>
        <details>
          <summary style={{ cursor: 'pointer', color: '#B45309', fontSize: '0.75rem' }}>查看详情</summary>
          <pre style={{
            marginTop: '0.5rem', padding: '0.5rem',
            backgroundColor: '#FEF3C7', borderRadius: '4px',
            fontSize: '0.6875rem', overflow: 'auto', maxHeight: '200px',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {error}
          </pre>
        </details>
        <button
          onClick={renderDiagram}
          style={{
            marginTop: '0.5rem', padding: '4px 12px', fontSize: '0.75rem',
            border: '1px solid #FDE68A', borderRadius: '4px',
            backgroundColor: '#FEF3C7', color: '#92400E', cursor: 'pointer',
          }}
        >
          🔄 重试
        </button>
      </div>
    )
  }

  if (!svg) {
    return (
      <div style={{
        margin: '0.75rem 0', padding: '1rem',
        backgroundColor: 'var(--gray-50)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--gray-100)', textAlign: 'center',
        color: 'var(--gray-400)', fontSize: '0.875rem',
      }}>
        ⏳ 正在渲染图表...
      </div>
    )
  }

  return (
    <div style={{
      margin: '0.75rem 0',
      backgroundColor: 'white',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--gray-100)',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
        backgroundColor: 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-100)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 500 }}>
            📊 图表
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? '展开' : '收起'}
            style={{
              padding: '2px 8px', fontSize: '0.7rem',
              border: '1px solid var(--gray-200)', borderRadius: '4px',
              backgroundColor: 'white', color: 'var(--gray-500)',
              cursor: 'pointer',
            }}
          >
            {collapsed ? '展开' : '收起'}
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(code)}
              title="编辑图表代码"
              style={{
                padding: '2px 8px', fontSize: '0.7rem',
                border: '1px solid var(--gray-200)', borderRadius: '4px',
                backgroundColor: 'white', color: 'var(--gray-500)',
                cursor: 'pointer',
              }}
            >
              ✏️ 编辑
            </button>
          )}
        </div>
      </div>
      {/* Diagram content */}
      {!collapsed && (
        <div
          ref={containerRef}
          style={{
            padding: '16px',
            display: 'flex', justifyContent: 'center',
            overflow: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  )
}
