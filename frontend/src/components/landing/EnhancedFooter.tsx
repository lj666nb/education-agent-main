import { useState, useEffect, useRef, useCallback } from 'react'

interface EnhancedFooterProps {
  onLoginClick: () => void
}

/* ═══════════════════════════════════════════════════════
   PixelArtText — bottom decorative layer
   Only the pixel-sliced text + drag interaction.
   No background (bg is a separate layer below).
   ═══════════════════════════════════════════════════════ */
function PixelArtText({ scrollProgress }: { scrollProgress: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sliceRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const targetOffsets = useRef<number[]>([])
  const currentOffsets = useRef<number[]>([])

  const SLICES = 16
  const [slices] = useState(() =>
    Array.from({ length: SLICES }, (_, i) => ({
      top: (i / SLICES) * 100,
      bottom: ((i + 1) / SLICES) * 100,
      dir: i % 2 === 0 ? 1 : -1,
      intensity: 0.5 + (i / (SLICES - 1)) * 1.8,
    }))
  )

  // Init offset arrays
  useEffect(() => {
    targetOffsets.current = new Array(SLICES).fill(0)
    currentOffsets.current = new Array(SLICES).fill(0)
  }, [])

  // RAF smooth lerp
  const animateSlices = useCallback(() => {
    let needsUpdate = false
    sliceRefs.current.forEach((el, i) => {
      if (!el) return
      const target = targetOffsets.current[i] || 0
      const current = currentOffsets.current[i] || 0
      const diff = target - current
      if (Math.abs(diff) > 0.1) {
        currentOffsets.current[i] = current + diff * 0.18
        needsUpdate = true
      } else {
        currentOffsets.current[i] = target
      }
      el.style.transform = `translateX(${currentOffsets.current[i]}px)`
    })
    if (needsUpdate) {
      rafRef.current = requestAnimationFrame(animateSlices)
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const relX = (e.clientX - centerX) / (rect.width / 2)
    const clampedX = Math.max(-1, Math.min(1, relX))

    slices.forEach((slice, i) => {
      targetOffsets.current[i] = clampedX * 55 * slice.dir * slice.intensity
    })
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animateSlices)
  }, [slices, animateSlices])

  const handleMouseLeave = useCallback(() => {
    slices.forEach((_, i) => { targetOffsets.current[i] = 0 })
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animateSlices)
  }, [slices, animateSlices])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '55%',
        overflow: 'hidden',
        zIndex: 1,
        cursor: 'grab',
        opacity: 0.3,
        userSelect: 'none',
      }}
    >
      {slices.map((slice, i) => (
        <div
          key={i}
          ref={el => { sliceRefs.current[i] = el }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${slice.top}%`,
            height: `${(slice.bottom - slice.top)}%`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            pointerEvents: 'none',
            borderBottom: i < SLICES - 1 ? '0.5px solid rgba(99,102,241,0.06)' : 'none',
          }}
        >
          <span
            style={{
              fontSize: 'clamp(3.5rem, 14vw, 16rem)',
              fontWeight: 900,
              fontFamily: "'Space Grotesk', 'ZCOOL KuaiLe', sans-serif",
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#000000',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transform: 'translateY(12%)',
              textShadow: [
                '1px 1px 0 #818cf8',
                '2px 2px 0 #7c3aed',
                '3px 3px 0 #6366f1',
                '4px 4px 0 #4f46e5',
                '5px 5px 0 #4338ca',
                '6px 6px 0 #3730a3',
              ].join(', '),
            }}
          >
            Education Agent
          </span>
        </div>
      ))}
      {/* Fade to transparent at top so it blends into nav area */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, #0F1426 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

export default function EnhancedFooter({ onLoginClick }: EnhancedFooterProps) {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const footerRef = useRef<HTMLDivElement>(null)

  // Back-to-top visibility
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 800)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll progress for parallax on purple bg only
  const handleViewportScroll = useCallback(() => {
    if (!footerRef.current) return
    const rect = footerRef.current.getBoundingClientRect()
    const wh = window.innerHeight
    const visible = Math.max(0, Math.min(1, (wh - rect.top) / (rect.height + wh)))
    setScrollProgress(visible)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleViewportScroll, { passive: true })
    handleViewportScroll()
    return () => window.removeEventListener('scroll', handleViewportScroll)
  }, [handleViewportScroll])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <footer ref={footerRef} style={{ position: 'relative', zIndex: 1 }}>
      {/* ════════════════════════════════════════════
          LAYER 0: Purple gradient background (z-index: 0)
          — scroll parallax, no interaction
      ════════════════════════════════════════════ */}
      <div
        className="footer-purple-bg"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366F1 35%, #8B5CF6 65%, #A78BFA 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradientFlow 8s ease infinite',
          transform: `translateY(${-scrollProgress * 40}px)`,
          transition: 'transform 0.15s linear',
          pointerEvents: 'none',
        }}
      />

      {/* ════════════════════════════════════════════
          LAYER 1: Pixel-sliced text (z-index: 1)
          — interactive drag, 30% opacity
      ════════════════════════════════════════════ */}
      <PixelArtText scrollProgress={scrollProgress} />

      {/* ════════════════════════════════════════════
          LAYER 2: Semi-transparent nav container (z-index: 2)
          — fixed, no parallax, all text readable
      ════════════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        background: 'rgba(15, 20, 38, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(99,102,241,0.08)',
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '60px 32px 36px',
        }}>
          {/* ── Three-column nav (brand, product, support) ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr 1fr',
            gap: '48px',
            marginBottom: '36px',
          }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
                </svg>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
                  Education Agent
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.8, maxWidth: '280px' }}>
                基于大语言模型的多智能体教育系统，通过动态学习画像、个性化资源生成与自适应练习路径，实现真正意义上的因材施教。
              </p>
            </div>

            {/* 产品 */}
            <div>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '20px', letterSpacing: '0.05em' }}>产品</h4>
              {['核心功能', '产品介绍', 'AI全流程演示', '多模型切换', 'AI学习工具'].map((item) => (
                <button key={item} onClick={() => {
                  const map: Record<string, string> = {
                    '核心功能': 'features', '产品介绍': 'showcase',
                    'AI全流程演示': 'builder', '多模型切换': 'models',
                    'AI学习工具': 'tools',
                  }
                  const id = map[item]
                  if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                }} style={{
                  display: 'block', background: 'none', border: 'none',
                  color: '#94A3B8', fontSize: '0.8125rem', padding: '7px 0',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'color 0.2s ease', textAlign: 'left',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#A5B4FC' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}
                >
                  {item}
                </button>
              ))}
            </div>

            {/* 支持 */}
            <div>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '20px', letterSpacing: '0.05em' }}>支持</h4>
              {['帮助中心', 'API文档', '常见问题', '系统状态', '版本发布'].map((item) => (
                <div key={item} style={{
                  color: '#94A3B8', fontSize: '0.8125rem', padding: '7px 0',
                  cursor: 'pointer', transition: 'color 0.2s ease',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#A5B4FC' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ height: '1px', background: 'rgba(99,102,241,0.06)', marginBottom: '20px' }} />

          {/* ── Bottom row: centered copyright/ICP/version ── */}
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569' }}>
            © {new Date().getFullYear()} Education Agent. All rights reserved.
            <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
            <span style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#64748B' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
            >京ICP备2024000000号</span>
            <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
            <span style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#64748B' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
            >京公网安备 11010802000000号</span>
            <div style={{ marginTop: '6px', fontSize: '0.6875rem', color: '#475569' }}>
              基于大模型的个性化学习多智能体系统 v2.0
            </div>
          </div>
        </div>
      </div>

      {/* Back to Top */}
      {showBackToTop && (
        <button onClick={scrollToTop} className="back-to-top-btn" style={{
          position: 'fixed', bottom: '36px', right: '36px', zIndex: 999,
          width: '48px', height: '48px', borderRadius: '14px',
          border: '1px solid rgba(129,140,248,0.3)',
          background: 'rgba(30,41,59,0.9)',
          backdropFilter: 'blur(12px)', color: '#A5B4FC',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', transition: 'all 0.3s ease',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.9)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(99,102,241,0.4)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(30,41,59,0.9)'; e.currentTarget.style.color = '#A5B4FC'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)' }}
          aria-label="回到顶部"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      )}
    </footer>
  )
}
