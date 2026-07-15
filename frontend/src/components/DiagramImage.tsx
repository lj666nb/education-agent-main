import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { DrawIoEmbed, type DrawIoEmbedRef } from 'react-drawio'
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { DRAWIO_CONFIG } from '../utils/drawio-config'

interface DiagramImageProps {
  xml: string
  onEdit?: (xml: string) => void
}

/** Base64 + URL-encode draw.io XML for viewer URL */
function encodeXmlForDrawio(xml: string): string {
  try {
    return btoa(unescape(encodeURIComponent(xml)))
  } catch {
    // Fallback: basic encoding
    let encoded = ''
    for (let i = 0; i < xml.length; i++) {
      encoded += String.fromCharCode(xml.charCodeAt(i) & 0xff)
    }
    return btoa(encoded)
  }
}

export default function DiagramImage({ xml, onEdit }: DiagramImageProps) {
  const drawioRef = useRef<DrawIoEmbedRef>(null)
  const [loadError, setLoadError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [retryKey, setRetryKey] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const viewerUrl = useMemo(() => {
    const encoded = encodeXmlForDrawio(xml)
    return `${DRAWIO_CONFIG.baseUrl}/?embed=1&spin=0&nav=0&layers=0&lightbox=0&fit=1#R${encoded}`
  }, [xml])

  // Reset state when xml or retryKey changes
  useEffect(() => {
    setIsLoading(true)
    setLoadError(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(() => {
      setIsLoading(false)
      setLoadError(true)
    }, DRAWIO_CONFIG.timeoutMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [xml, retryKey])

  const handleIframeLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsLoading(false)
    setLoadError(false)
  }, [])

  const handleRetry = useCallback(() => {
    setRetryKey(k => k + 1)
  }, [])

  return (
    <>
      <div
        style={{ margin: '0.75rem 0', position: 'relative' }}
        onMouseEnter={e => {
          const btn = e.currentTarget.querySelector('.diagram-edit-btn') as HTMLElement
          if (btn) btn.style.opacity = '1'
        }}
        onMouseLeave={e => {
          const btn = e.currentTarget.querySelector('.diagram-edit-btn') as HTMLElement
          if (btn) btn.style.opacity = '0'
        }}
      >
        {/* ── Error state ── */}
        {loadError && !isLoading && (
          <div style={{
            margin: '0.75rem 0',
            padding: '1.25rem',
            backgroundColor: '#FFFBEB',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #FDE68A',
            textAlign: 'center',
            color: '#92400E',
            fontSize: '0.875rem',
          }}>
            <p style={{ margin: 0, marginBottom: '0.75rem', fontWeight: 500 }}>
              ⚠️ 思维导图加载超时，请检查网络连接后重试。
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={handleRetry} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
                🔄 重新加载
              </button>
              {onEdit && (
                <button onClick={() => onEdit(xml)} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
                  ✏️ 在编辑器中打开
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── DrawIoEmbed — ALWAYS renders when not errored (loading overlay covers it) ── */}
        {!loadError && (
          <div style={{ position: 'relative', minHeight: isLoading ? '140px' : undefined }}>
            {/* Loading overlay — absolutely positioned on TOP of the DrawIoEmbed iframe */}
            {isLoading && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '2rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                border: '2px dashed var(--gray-200)',
                background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
                textAlign: 'center',
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ animation: 'diagram-spin 1s linear infinite', color: 'var(--primary)' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '6px' }}>
                  🧠 思维导图生成中...
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--gray-400)', lineHeight: 1.6 }}>
                  正在连接 draw.io 渲染引擎生成思维导图
                </div>
              </div>
            )}

            {/* DrawIoEmbed — always in DOM, loads behind the overlay */}
            <DrawIoEmbed
              key={retryKey}
              ref={drawioRef}
              xml={xml}
              baseUrl={DRAWIO_CONFIG.baseUrl}
              onLoad={handleIframeLoad}
              urlParameters={{
                lightbox: false,
                spin: false,
                nav: false,
                layers: false,
              }}
            />

            {/* Action buttons overlay — only when loaded */}
            {!isLoading && (
              <div style={{
                position: 'absolute', top: '0.5rem', right: '0.5rem',
                display: 'flex', gap: '4px', zIndex: 2,
              }}>
                <button
                  onClick={() => { setFullscreen(true); setZoomLevel(1) }}
                  title="全屏查看思维导图"
                  className="diagram-edit-btn"
                  style={{
                    opacity: 0, transition: 'opacity 0.15s',
                    padding: '0.25rem 0.5rem', fontSize: '0.7rem',
                    border: '1px solid var(--gray-200)', borderRadius: '6px',
                    backgroundColor: 'white', color: 'var(--gray-600)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                    fontWeight: 500, boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.color = 'var(--primary)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--gray-200)'
                    e.currentTarget.style.color = 'var(--gray-600)'
                  }}
                >
                  <Maximize2 size={12} /> 全屏查看
                </button>
                {onEdit && (
                  <button
                    onClick={() => onEdit(xml)}
                    className="diagram-edit-btn"
                    title="在编辑器中打开"
                    style={{
                      opacity: 0, transition: 'opacity 0.15s',
                      padding: '0.25rem 0.5rem', fontSize: '0.7rem',
                      border: '1px solid var(--gray-200)', borderRadius: '6px',
                      backgroundColor: 'white', color: 'var(--gray-600)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                      fontWeight: 500, boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary)'
                      e.currentTarget.style.color = 'var(--primary)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--gray-200)'
                      e.currentTarget.style.color = 'var(--gray-600)'
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    编辑
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fullscreen: iframe fills entire viewport, floating toolbar on top ── */}
      {fullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: '#1E1E2E',
        }}>
          {/* Floating toolbar — semi-transparent, at top */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '8px 16px',
            background: 'rgba(30,30,46,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#CBD5E1', marginRight: '8px' }}>
                🧠 思维导图 · 全屏
              </span>
              <button
                onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.5))}
                title="缩小"
                style={{
                  padding: '6px 12px', fontSize: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                <ZoomOut size={14} />
              </button>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8', minWidth: '45px', textAlign: 'center', fontWeight: 600 }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(z => Math.min(5, z + 0.5))}
                title="放大"
                style={{
                  padding: '6px 12px', fontSize: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                title="重置缩放"
                style={{
                  padding: '6px 12px', fontSize: '0.7rem',
                  border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px',
                  backgroundColor: 'transparent', color: '#94A3B8',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <RotateCcw size={12} /> 重置
              </button>
              <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <button
                onClick={() => setFullscreen(false)}
                title="关闭 (ESC)"
                style={{
                  padding: '6px 14px', fontSize: '0.8rem',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
                  backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  fontWeight: 600,
                }}
              >
                <X size={14} /> 关闭
              </button>
            </div>
          </div>

          {/* Iframe container — fills entire viewport, scrollable when zoomed in */}
          <div style={{
            position: 'absolute', inset: 0,
            overflow: 'auto',
          }}>
            <div style={{
              width: `${100 * zoomLevel}%`,
              height: `${100 * zoomLevel}%`,
              minWidth: '100%',
              minHeight: '100%',
            }}>
              <iframe
                src={viewerUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                  backgroundColor: '#FFFFFF',
                }}
                title="思维导图"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes diagram-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
