import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

interface FeatureCardsProps {
  onLoginClick: () => void
}

const features = [
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>),
    title: '智能学习画像', desc: '通过练习记录与AI对话，自动构建多维学习画像，精准识别知识薄弱点与学习风格偏好。', color: '#818CF8', bg: 'rgba(129,140,248,0.12)', route: '/profile/dynamic', tag: '学习诊断',
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="9" y1="10" x2="15" y2="10" /></svg>),
    title: 'AI 多模态答疑', desc: '支持文字、代码、图像等多种形式的智能问答，即时解答学习中的疑问，如私人导师般耐心细致。', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', route: '/chat/new', tag: '即时问答',
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>),
    title: '个性化资源生成', desc: 'AI根据你的学习进度与薄弱点，自动生成定制化的学习资料、练习题与知识总结。', color: '#93C5FD', bg: 'rgba(147,197,253,0.12)', route: '/recommendations', tag: '智能生成',
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
    title: '自适应学习路径', desc: '设定学习目标，系统根据掌握度自动规划学习路径，并根据掌握程度动态调整学习计划。', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)', route: '/path', tag: '路径规划',
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>),
    title: '智能题库系统', desc: '海量题目资源，支持错题自动归类、薄弱知识点定向练习，让每一道题都练在刀刃上。', color: '#6EE7B7', bg: 'rgba(110,231,183,0.12)', route: '/banks', tag: '海量题库',
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>),
    title: '学习数据分析', desc: '可视化的学习报告与知识掌握度分析，每日学习统计，帮助你科学规划学习时间。', color: '#F9A8D4', bg: 'rgba(249,168,212,0.12)', route: '/profile', tag: '数据驱动',
  },
]

export default function FeatureCards({ onLoginClick }: FeatureCardsProps) {
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    cardsRef.current.forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  const handleFeatureClick = (route: string) => {
    if (isAuthenticated) navigate(route)
    else {
      sessionStorage.setItem('loginRedirect', route)
      onLoginClick()
    }
  }

  return (
    <section id="features" style={{ padding: '100px 32px', background: '#0F172A', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(129,140,248,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Section Header */}
        <div className="anim-slide-up" ref={(el) => { if (el) setTimeout(() => el?.classList.add('visible'), 100) }} style={{ textAlign: 'center', marginBottom: '64px' }}>
          <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '20px', background: 'rgba(99,102,241,0.15)', color: '#A5B4FC', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '16px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            核心功能
          </span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em', marginBottom: '16px' }}>六大核心能力</h2>
          <p style={{ fontSize: '1.05rem', color: '#94A3B8', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>从画像到路径，从答疑到分析，覆盖学习全流程</p>
        </div>

        {/* Feature Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {features.map((feature, i) => (
            <div key={feature.title} ref={(el) => { cardsRef.current[i] = el }}
              className="anim-slide-up feature-card-hover"
              style={{
                background: '#1E293B', border: '1px solid #334155', borderRadius: '20px', padding: '32px 28px',
                cursor: 'pointer', transitionDelay: `${i * 0.1}s`,
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)'
                e.currentTarget.style.background = '#263548'
                e.currentTarget.style.boxShadow = `0 16px 40px -8px ${feature.color}44`
                e.currentTarget.style.borderColor = feature.color + '55'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.background = '#1E293B'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
                e.currentTarget.style.borderColor = '#334155'
              }}
              onClick={() => handleFeatureClick(feature.route)}
            >
              {/* Hover glow effect */}
              <div style={{
                position: 'absolute', top: '-50%', right: '-50%',
                width: '100px', height: '100px',
                background: `radial-gradient(circle, ${feature.color}11 0%, transparent 70%)`,
                pointerEvents: 'none', transition: 'all 0.3s ease',
              }} className="feature-hover-glow" />

              {/* Icon with glow */}
              <div className="feature-icon-wrap" style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: feature.bg, color: feature.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '20px', transition: 'transform 0.25s ease',
                position: 'relative',
              }}>
                <div className="icon-breathe" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {feature.icon}
                </div>
              </div>

              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '10px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.7, margin: 0, marginBottom: '16px' }}>{feature.desc}</p>

              {/* Tag badge at bottom right */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{
                  padding: '2px 10px', borderRadius: '12px',
                  background: feature.bg, color: feature.color,
                  fontSize: '0.6875rem', fontWeight: 500,
                }}>
                  {feature.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
