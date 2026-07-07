import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import ParticleBackground from './ParticleBackground'

interface HeroSectionProps {
  onLoginClick: () => void
}

/* ── Feature Tag Carousel ── */
const tags = [
  'AI个性化学习', '多模态答疑', '智能题库', '自适应路径',
  '学习画像', '知识图谱', 'AI资源生成', '数据分析',
  '多模型切换', '代码辅导', '科研辅助', '学习规划',
]

function TagCarousel() {
  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',
      left: 0,
      right: 0,
      zIndex: 2,
      overflow: 'hidden',
      maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
      WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
    }}>
      <div className="tag-scroll-track" style={{
        display: 'flex',
        gap: '12px',
        width: 'max-content',
        padding: '0 20px',
      }}>
        {/* Double the tags for seamless loop */}
        {[...tags, ...tags].map((tag, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px 6px 14px',
              borderRadius: '20px',
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.12)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.8125rem',
              fontWeight: 400,
              whiteSpace: 'nowrap',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(167,139,250,0.18)'
              e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(167,139,250,0.08)'
              e.currentTarget.style.borderColor = 'rgba(167,139,250,0.12)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#A78BFA', opacity: 0.5, display: 'inline-block',
            }} />
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function HeroSection({ onLoginClick }: HeroSectionProps) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [titleStyle, setTitleStyle] = useState({})

  const handleStart = () => {
    if (isAuthenticated) navigate('/home')
    else onLoginClick()
  }

  /* ── Drag-Stretch Title Effect ── */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!titleRef.current) return
    const rect = titleRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const deltaX = (e.clientX - centerX) / (rect.width / 2)
    const deltaY = (e.clientY - centerY) / (rect.height / 2)

    // Clamp values
    const clampedX = Math.max(-1, Math.min(1, deltaX))
    const clampedY = Math.max(-1, Math.min(1, deltaY))

    if (isDragging) {
      // When "dragging" - more extreme deformation
      setTitleStyle({
        transform: `
          perspective(800px)
          rotateY(${clampedX * 12}deg)
          rotateX(${-clampedY * 8}deg)
          translateX(${dragOffset.current.x + clampedX * 8}px)
          translateY(${dragOffset.current.y + clampedY * 5}px)
          scale(${1 + Math.abs(clampedX) * 0.03})
        `,
        filter: `blur(${Math.abs(clampedX) * 0.5}px)`,
        transition: 'transform 0.08s ease-out, filter 0.08s ease-out',
        letterSpacing: `${0.06 + Math.abs(clampedX) * 0.04}em`,
      })
    } else {
      // Normal hover - subtle parallax
      setTitleStyle({
        transform: `
          perspective(800px)
          rotateY(${clampedX * 4}deg)
          rotateX(${-clampedY * 3}deg)
        `,
        filter: 'blur(0px)',
        transition: 'transform 0.2s ease-out, filter 0.2s ease-out',
      })
    }
  }, [isDragging])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    dragOffset.current = { x: 0, y: 0 }
    e.preventDefault()
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setTitleStyle({
      transform: 'perspective(800px) rotateY(0deg) rotateX(0deg)',
      filter: 'blur(0px)',
      letterSpacing: '0.06em',
      transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(-45deg, #1e1b4b, #312e81, #3730a3, #4f46e5, #6366f1, #4338ca)',
        backgroundSize: '400% 400%',
        animation: 'bgFlow 6s ease infinite',
      }}
    >
      {/* Particle Background (enhanced version) */}
      <ParticleBackground />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(167,139,250,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(129,140,248,0.1) 0%, transparent 60%)',
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 3,
        textAlign: 'center',
        maxWidth: 860,
        padding: '0 32px',
        marginTop: '-40px',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 18px 5px 16px',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 'clamp(0.78rem, 1.2vw, 0.9rem)',
          fontWeight: 300,
          fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          letterSpacing: '0.3em',
          marginBottom: '36px',
          opacity: 0,
          transform: 'translateY(-16px)',
          animation: 'fadeInSlideDown 0.6s ease-out 0.1s forwards',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#A78BFA', opacity: 0.7, display: 'inline-block',
          }} />
          AI驱动的个性化学习平台
        </div>

        {/* Main Title — with drag-stretch effect */}
        <h1
          ref={titleRef}
          onMouseDown={handleMouseDown}
          style={{
            marginBottom: '28px',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            opacity: 0,
            transform: 'translateY(-20px)',
            animation: 'fadeInSlideDown 0.7s ease-out 0.28s forwards',
            ...titleStyle,
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: 'clamp(2.6rem, 6.5vw, 4.5rem)',
              fontWeight: 700,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              color: '#FFFFFF',
              lineHeight: 1.25,
              letterSpacing: '0.06em',
              textShadow: '0 2px 12px rgba(0,0,0,0.08)',
              transform: 'translateX(-3%)',
              marginBottom: '4px',
            }}
          >
            让AI理解你的学习，
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 'clamp(2.2rem, 5.5vw, 3.8rem)',
              fontWeight: 500,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              background: 'linear-gradient(135deg, #C4B5FD, #A78BFA, #818CF8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.2,
              letterSpacing: '0.08em',
              transform: 'translateX(3%)',
            }}
          >
            为每个人因材施教
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(0.88rem, 1.3vw, 1.05rem)',
          fontWeight: 200,
          fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          color: 'rgba(255,255,255,0.58)',
          lineHeight: 1.9,
          letterSpacing: '0.04em',
          maxWidth: 660,
          margin: '0 auto 40px',
          opacity: 0,
          transform: 'translateY(-16px)',
          animation: 'fadeInSlideDown 0.6s ease-out 0.46s forwards',
        }}>
          基于大语言模型的多智能体教育系统，
          <br />
          通过动态学习画像、个性化资源生成与自适应练习路径，
          <br />
          让学习效率提升 300%
        </p>

        {/* Buttons */}
        <div style={{
          display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap',
          opacity: 0, transform: 'translateY(-16px)',
          animation: 'fadeInSlideDown 0.6s ease-out 0.64s forwards',
        }}>
          <button onClick={handleStart}
            style={{
              padding: '16px 44px',
              fontSize: '1.1rem',
              fontWeight: 600,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #A78BFA)',
              backgroundSize: '200% 200%',
              animation: 'gradientFlow 4s ease infinite',
              boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)'
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(99,102,241,0.45)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(99,102,241,0.3)'
            }}
          >
            {/* Shimmer overlay */}
            <span className="shimmer-bg" style={{
              position: 'absolute', inset: 0, borderRadius: '14px',
              pointerEvents: 'none',
            }} />
            <span style={{ position: 'relative', zIndex: 1 }}>
              立即开始体验
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              padding: '16px 34px',
              borderRadius: '14px',
              border: '1.5px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '1rem',
              fontWeight: 300,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              cursor: 'pointer',
              letterSpacing: '0.06em',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(124,92,247,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            了解更多
          </button>
        </div>

        {/* Login link */}
        <div style={{
          marginTop: '52px',
          opacity: 0,
          animation: 'fadeInSlideDown 0.6s ease-out 0.82s forwards',
        }}>
          <button onClick={onLoginClick} style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.25)',
            cursor: 'pointer',
            fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 200,
            letterSpacing: '0.04em',
            padding: '4px 0',
            borderBottom: '1px dashed rgba(255,255,255,0.12)',
            transition: 'color 0.3s ease',
          }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
          >
            已有账号？立即登录 →
          </button>
        </div>
      </div>

      {/* Tag Carousel */}
      <TagCarousel />

      {/* Scroll indicator */}
      <div style={{
        position: 'absolute',
        bottom: '162px',
        zIndex: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        color: 'rgba(255,255,255,0.25)',
        fontSize: '0.72rem',
        fontWeight: 200,
        fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        cursor: 'pointer',
        opacity: 0,
        animation: 'fadeInSlideUp 0.6s ease-out 1s forwards',
      }}
        onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <div style={{
          width: '20px',
          height: '30px',
          borderRadius: '10px',
          border: '2px solid rgba(255,255,255,0.12)',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '5px',
        }}>
          <div className="scroll-arrow-dot" style={{
            width: '3px',
            height: '8px',
            borderRadius: '2px',
            background: 'rgba(255,255,255,0.3)',
          }} />
        </div>
      </div>
    </section>
  )
}
