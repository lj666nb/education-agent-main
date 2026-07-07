import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

interface AdvantagesSectionProps {
  onLoginClick: () => void
}

/* ── Enhanced CountUp with smoother animation ── */
function StatCount({ target, prefix = '', suffix = '' }: { target: string; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState('0')
  const ref = useRef<HTMLSpanElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const num = parseInt(target.replace(/[^0-9]/g, '')) || 0
    if (num === 0) { setDisplay(target); return }
    const suffixText = target.replace(/[0-9]/g, '')

    const ob = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done.current) return
      done.current = true
      let current = 0

      // Smoother count-up with ease-out
      const duration = 1800
      const steps = 50
      const increment = num / steps
      const startTime = performance.now()

      const update = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        current = Math.round(eased * num)
        setDisplay(`${current}${suffixText}`)

        if (progress < 1) {
          requestAnimationFrame(update)
        } else {
          setDisplay(`${num}${suffixText}`)
        }
      }

      requestAnimationFrame(update)
    }, { threshold: 0.3 })

    if (ref.current) ob.observe(ref.current)
    return () => ob.disconnect()
  }, [target])

  return (
    <span ref={ref} className="count-enter" style={{ display: 'inline-block' }}>
      <span style={{ opacity: 0.4, fontSize: '0.6em', fontWeight: 400, verticalAlign: 'super' }}>{prefix}</span>
      {display}
    </span>
  )
}

const advantages = [
  {
    icon: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>),
    stat: '300%', label: '学习效率提升', desc: '自适应学习路径和多模态答疑使知识吸收效率提升3倍', color: '#818CF8',
  },
  {
    icon: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>),
    stat: '100万+', label: '智能题库', desc: '涵盖多学科、多类型的海量练习题目与解析资源', color: '#A78BFA',
  },
  {
    icon: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M12 14v4" /><path d="M8 22h8" /></svg>),
    stat: '24/7', label: 'AI 即时答疑', desc: '全天候智能问答支持，随时解决学习中的任何疑问', color: '#93C5FD',
  },
  {
    icon: (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>),
    stat: '95%', label: '知识点覆盖率', desc: '系统知识图谱覆盖主要学科的绝大部分知识点', color: '#6EE7B7',
  },
]

export default function AdvantagesSection({ onLoginClick }: AdvantagesSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add('visible') }
        })
      },
      { threshold: 0.15 }
    )
    const cards = containerRef.current?.querySelectorAll('.anim-slide-up')
    cards?.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section id="advantages" ref={containerRef} style={{
      padding: '100px 32px',
      background: 'linear-gradient(180deg, #0B1121 0%, #0F172A 50%, #0B1121 100%)',
      borderTop: '1px solid #1E293B',
      borderBottom: '1px solid #1E293B',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: '-30%', left: '20%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(129,140,248,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '20%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className="anim-slide-up" style={{ textAlign: 'center', marginBottom: '64px' }}>
          <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '20px', background: 'rgba(167,139,250,0.12)', color: '#C4B5FD', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '16px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            优势亮点
          </span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em', marginBottom: '16px' }}>
            用<span className="text-gradient-shimmer">数据</span>说话
          </h2>
          <p style={{ fontSize: '1.05rem', color: '#94A3B8', maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>
            先进的大模型技术与教育理论结合，带来真实可量化的学习效果提升
          </p>
        </div>

        {/* Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
        }}>
          {advantages.map((item, i) => (
            <div key={item.label}
              className="anim-slide-up"
              style={{
                background: '#1E293B', border: '1px solid #334155', borderRadius: '20px', padding: '36px 28px',
                textAlign: 'center', transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                transitionDelay: `${i * 0.1}s`, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)'
                e.currentTarget.style.background = 'linear-gradient(180deg, #1E293B, #263548)'
                e.currentTarget.style.boxShadow = `0 24px 48px -12px rgba(0,0,0,0.5)`
                e.currentTarget.style.borderColor = item.color + '44'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.background = '#1E293B'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
                e.currentTarget.style.borderColor = '#334155'
              }}
            >
              {/* Icon with breathing glow */}
              <div className="icon-breathe" style={{
                width: '60px', height: '60px', borderRadius: '16px',
                background: `${item.color}15`, color: item.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', transition: 'transform 0.3s ease',
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.15)'
                  e.currentTarget.style.boxShadow = `0 0 30px ${item.color}44`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {item.icon}
              </div>

              {/* Stat with count-up */}
              <div style={{
                fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800,
                color: item.color, lineHeight: 1.1, marginBottom: '6px',
                fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em',
              }}>
                <StatCount target={item.stat} />
              </div>

              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '10px' }}>
                {item.label}
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
