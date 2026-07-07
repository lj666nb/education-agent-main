import React, { useState, useEffect } from 'react'
import { useTheme } from '../store/theme'

const FloatingActions: React.FC = () => {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [showServicePopover, setShowServicePopover] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    const mainEl = document.querySelector('[data-main-content]')
    const handler = () => {
      const scrollTop = mainEl?.scrollTop || window.scrollY
      setShowBackToTop(scrollTop > 300)
    }
    if (mainEl) {
      mainEl.addEventListener('scroll', handler, { passive: true })
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      mainEl?.removeEventListener('scroll', handler)
      window.removeEventListener('scroll', handler)
    }
  }, [])

  const scrollToTop = () => {
    const mainEl = document.querySelector('[data-main-content]')
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <>
      {/* Customer service button */}
      <div style={{ position: 'fixed', right: 24, bottom: showBackToTop ? 160 : 96, zIndex: 900 }}>
        <div
          className="fab"
          onClick={() => setShowServicePopover(!showServicePopover)}
          style={{ position: 'relative' }}
          title="客服咨询"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        {showServicePopover && (
          <div style={{
            position: 'absolute',
            bottom: 56, right: 0,
            width: 260,
            background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
            borderRadius: 16,
            boxShadow: '0 20px 50px -12px rgba(0,0,0,0.18)',
            border: `1px solid ${theme === 'dark' ? '#334155' : '#E5EDF7'}`,
            padding: 20,
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{
              fontSize: 15, fontWeight: 600,
              color: theme === 'dark' ? '#F1F5F9' : '#2C3A52',
              marginBottom: 12,
            }}>
              咨询信息
            </div>
            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.8 }}>
              <div>📞 客服电话：400-123-4567</div>
              <div>🕐 咨询时间：工作日 9:00-11:00 / 14:00-17:00</div>
              <div>📧 大赛邮箱：a3@softwarecup.cn</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>
                第十五届中国软件杯 A3 赛题
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Back to top button */}
      <div
        className="fab"
        onClick={scrollToTop}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 96,
          zIndex: 900,
          opacity: showBackToTop ? 1 : 0,
          transform: showBackToTop ? 'scale(1)' : 'scale(0.5)',
          pointerEvents: showBackToTop ? 'auto' : 'none',
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        title="回到顶部"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </div>
    </>
  )
}

export default FloatingActions
