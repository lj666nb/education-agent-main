import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import Navbar from '../components/landing/Navbar'
import HeroSection from '../components/landing/HeroSection'
import BuilderFlow from '../components/landing/BuilderFlow'
import FeatureCards from '../components/landing/FeatureCards'
import AppShowcase from '../components/landing/AppShowcase'
import ModelSwitcher from '../components/landing/ModelSwitcher'
import AdvantagesSection from '../components/landing/AdvantagesSection'
import ToolsMatrix from '../components/landing/ToolsMatrix'
import EnhancedFooter from '../components/landing/EnhancedFooter'
import AuthModal from '../components/landing/AuthModal'

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState<'login' | 'register' | null>(null)
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  // If already authenticated, redirect to saved target or /home
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = sessionStorage.getItem('loginRedirect')
      if (redirectTo) {
        sessionStorage.removeItem('loginRedirect')
        navigate(redirectTo, { replace: true })
      } else {
        navigate('/home', { replace: true })
      }
    }
  }, [isAuthenticated, navigate])

  // Handle hash-based routing (support /#login, /#register)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'login') setShowAuth('login')
    else if (hash === 'register') setShowAuth('register')
  }, [])

  const openLogin = () => setShowAuth('login')
  const openRegister = () => setShowAuth('register')
  const closeAuth = () => setShowAuth(null)

  if (isAuthenticated) return null

  return (
    <>
      <style>{`
        /* Skip rendering for off-screen sections — massive scroll perf boost */
        .landing-page > section,
        .landing-page > .section-wrap {
          content-visibility: auto;
          contain-intrinsic-size: 500px;
        }
        /* Hero must render immediately (above the fold) */
        .landing-page > #hero {
          content-visibility: visible;
          contain-intrinsic-size: none;
        }
      `}</style>
      <div className="landing-page" style={{
        minHeight: '100vh',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#0F172A',
        WebkitOverflowScrolling: 'touch',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}>
      {/* Navbar (fixed, not scrolled with content) */}
      <Navbar onLoginClick={openLogin} onRegisterClick={openRegister} />

      {/* ═══ 1. Hero Section ═══ */}
      <HeroSection onLoginClick={openLogin} />

      {/* ═══ 2. Builder AI Learning Flow Demo (NEW) ═══ */}
      <section id="builder">
        <BuilderFlow onLoginClick={openLogin} />
      </section>

      {/* ═══ 3. Six Core Features ═══ */}
      <FeatureCards onLoginClick={openLogin} />

      {/* ═══ 4. Product Showcase ═══ */}
      <AppShowcase onLoginClick={openLogin} />

      {/* ═══ 5. Multi-Model Switcher (NEW) ═══ */}
      <section id="models">
        <ModelSwitcher onLoginClick={openLogin} />
      </section>

      {/* ═══ 6. Advantages / Stats ═══ */}
      <AdvantagesSection onLoginClick={openLogin} />

      {/* ═══ CTA Banner (between data cards and tools) ═══ */}
      <section style={{
        padding: '80px 32px',
        background: 'linear-gradient(135deg, #4f46e5 0%, #6366F1 30%, #8B5CF6 60%, #A78BFA 100%)',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        <div style={{
          position: 'absolute', top: '-60%', left: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-40%', right: '-5%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '5px 16px 5px 14px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.8)', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '24px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            立即开始你的AI学习之旅
          </div>
          <h2 style={{
            fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 700,
            color: '#fff', lineHeight: 1.3, marginBottom: '16px',
          }}>
            准备好开启<span style={{ textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)', textUnderlineOffset: '6px' }}>高效学习</span>之旅了吗？
          </h2>
          <p style={{
            fontSize: '1.05rem', color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.7, maxWidth: 520, margin: '0 auto 36px',
          }}>
            无需等待，即刻体验AI驱动的个性化学习系统，让学习效率提升300%
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { if (isAuthenticated) navigate('/home'); else openLogin() }}
              style={{
                padding: '16px 44px', borderRadius: '14px', border: 'none',
                background: '#fff', color: '#6366F1',
                fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)'
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.25)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'
              }}
            >
              免费开始使用
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                padding: '16px 34px', borderRadius: '14px',
                border: '1.5px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.08)', color: '#fff',
                fontSize: '1rem', fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-heading)', backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
                e.currentTarget.style.transform = ''
              }}
            >
              了解更多
            </button>
          </div>
        </div>
      </section>

      {/* ═══ 7. AI Learning Tools Matrix (NEW) ═══ */}
      <section id="tools">
        <ToolsMatrix onLoginClick={openLogin} />
      </section>

      {/* ═══ 8. Enhanced CTA + Footer (NEW) ═══ */}
      <EnhancedFooter onLoginClick={openLogin} />

      {/* Auth Modal (Login / Register) */}
      {showAuth && (
        <AuthModal
          initialMode={showAuth}
          onClose={closeAuth}
        />
      )}
    </div>
    </>
  )
}
