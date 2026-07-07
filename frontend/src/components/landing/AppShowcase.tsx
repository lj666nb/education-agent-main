import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

interface AppShowcaseProps {
  onLoginClick: () => void
}

/* ── Typing AI Dialogue ── */
function AITypingDialogue() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500)
    const t2 = setTimeout(() => setPhase(2), 2500)
    const t3 = setTimeout(() => setPhase(3), 4500)

    // Loop
    const loop = setTimeout(() => {
      setPhase(0)
      setTimeout(() => setPhase(1), 500)
      setTimeout(() => setPhase(2), 2500)
      setTimeout(() => setPhase(3), 4500)
    }, 8000)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(loop) }
  }, [])

  return (
    <div style={{ borderRadius: '12px', border: '1px solid #334155', padding: '14px', marginBottom: '12px' }}>
      {/* AI Header */}
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A5B4FC', marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        AI 助手
      </div>

      {/* AI Message */}
      {phase >= 1 && (
        <div className="step-enter" style={{
          padding: '10px 12px', borderRadius: '8px 8px 8px 2px',
          background: 'rgba(99,102,241,0.08)', fontSize: '0.75rem',
          color: '#CBD5E1', lineHeight: 1.6, marginBottom: '8px',
        }}>
          根据你的学习画像，我发现你在「微积分-极限」部分掌握度较低（42%），
          建议先复习极限的基本概念，然后完成以下练习题巩固...
        </div>
      )}

      {/* User Message */}
      {phase >= 2 && (
        <div className="step-enter" style={{
          padding: '10px 12px', borderRadius: '8px 8px 2px 8px',
          background: '#1E293B', fontSize: '0.75rem', color: '#94A3B8',
          lineHeight: 1.6, textAlign: 'right', maxWidth: '70%', marginLeft: 'auto',
          border: '1px solid #334155',
        }}>
          好的，帮我生成几道练习题吧
          <span className="typing-cursor" />
        </div>
      )}

      {/* AI Response */}
      {phase >= 3 && (
        <div className="step-enter" style={{
          padding: '10px 12px', borderRadius: '8px 8px 8px 2px',
          background: 'rgba(16,185,129,0.06)', fontSize: '0.75rem',
          color: '#CBD5E1', lineHeight: 1.6, marginTop: '8px',
          border: '1px solid rgba(16,185,129,0.1)',
        }}>
          <span style={{ color: '#6EE7B7', fontWeight: 600 }}>已生成5道极限练习题</span>
          <br />
          （包含左右极限、无穷小量比较、洛必达法则应用等题型）
        </div>
      )}

      {/* Thinking dots */}
      {phase >= 1 && phase < 3 && (
        <div style={{ display: 'flex', gap: '3px', padding: '4px 0' }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#A78BFA', animation: 'bounceDown 1.4s ease-in-out infinite' }} />
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#A78BFA', animation: 'bounceDown 1.4s ease-in-out 0.2s infinite' }} />
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#A78BFA', animation: 'bounceDown 1.4s ease-in-out 0.4s infinite' }} />
        </div>
      )}
    </div>
  )
}

/* ── Floating Selling Points ── */
const sellingPoints = [
  { text: '360° 学习者画像', color: '#818CF8', x: '-12%', y: '15%' },
  { text: 'AI 个性化推荐', color: '#6EE7B7', x: '-15%', y: '45%' },
  { text: '自适应学习路径', color: '#FCD34D', x: '-10%', y: '75%' },
]

export default function AppShowcase({ onLoginClick }: AppShowcaseProps) {
  const navigate = useNavigate()
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const { isAuthenticated } = useAuthStore()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            if (textRef.current) textRef.current.classList.add('visible')
            if (previewRef.current) previewRef.current.classList.add('visible')
            itemRefs.current.forEach((el) => { if (el) el.classList.add('visible') })
          }
        })
      },
      { threshold: 0.2 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const items = [
    { title: '动态学习画像', desc: '实时追踪掌握度、薄弱点、学习偏好，构建360°学习者画像' },
    { title: 'AI 资源生成', desc: '根据画像自动生成个性化学习资料与练习题' },
    { title: '自适应路径规划', desc: '动态调整学习计划，确保最高效的知识获取路径' },
  ]

  return (
    <section id="showcase" ref={sectionRef} style={{
      padding: '100px 32px',
      background: '#0B1121',
      borderTop: '1px solid #1E293B',
      borderBottom: '1px solid #1E293B',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="responsive-stack">

          {/* Left: Text Content */}
          <div ref={textRef} className="anim-slide-up" style={{ minWidth: 0, position: 'relative' }}>
            <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: '#6EE7B7', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '16px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              产品介绍
            </span>
            <h2 style={{
              fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700, color: '#F1F5F9',
              letterSpacing: '-0.02em', marginBottom: '20px', fontFamily: 'var(--font-heading)', lineHeight: 1.3,
            }}>
              重新定义<span style={{ color: '#A5B4FC' }}>个性化学习</span>的方式
            </h2>
            <p style={{ fontSize: '1rem', color: '#94A3B8', lineHeight: 1.8, marginBottom: '32px' }}>
              Education Agent 是一个基于大语言模型的多智能体教育系统，
              通过构建动态学习画像、大模型驱动的内容生成与自适应学习路径规划，
              实现真正意义上的因材施教。系统集成了智能题库、多模态答疑、
              学习分析等模块，为每位学习者提供专属的AI导师体验。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {items.map((item, i) => (
                <div key={i} ref={(el) => { itemRefs.current[i] = el }}
                  className="anim-slide-down"
                  style={{
                    display: 'flex', gap: '14px', alignItems: 'flex-start',
                    padding: '16px 20px', borderRadius: '12px',
                    background: 'rgba(30,41,59,0.6)', border: '1px solid #1E293B',
                    transition: 'all 0.3s ease', transitionDelay: `${i * 0.12}s`,
                  }}
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginTop: '2px',
                    transition: 'all 0.3s ease',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(124,92,247,0.4)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.9375rem', marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => { if (isAuthenticated) navigate('/home'); else onLoginClick() }}
              className="btn-gradient" style={{ marginTop: '32px', padding: '14px 36px', fontSize: '1rem', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }}>
              开始体验
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>

            {/* Floating selling point tags */}
            {visible && sellingPoints.map((sp, i) => (
              <div key={i} style={{
                position: 'absolute', left: sp.x,
                top: sp.y,
                padding: '6px 14px', borderRadius: '20px',
                background: `linear-gradient(135deg, ${sp.color}18, ${sp.color}08)`,
                border: `1px solid ${sp.color}33`,
                color: sp.color,
                fontSize: '0.75rem', fontWeight: 600,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(8px)',
                pointerEvents: 'none',
                animation: `floatCube${(i % 3) + 1} ${6 + i * 2}s ease-in-out infinite`,
                boxShadow: `0 4px 12px ${sp.color}11`,
                zIndex: 5,
              }}>
                ✦ {sp.text}
              </div>
            ))}
          </div>

          {/* Right: Simulated Preview with Typing Chat */}
          <div ref={previewRef} className="anim-slide-right" style={{ minWidth: 0, position: 'relative' }}>
            <div style={{
              position: 'relative', borderRadius: '24px', overflow: 'hidden',
              animation: 'breathe 4s ease-in-out infinite',
              boxShadow: '0 20px 60px rgba(99,102,241,0.15)',
              aspectRatio: '4 / 3', background: '#1E293B', border: '1px solid #334155',
            }}>
              {/* Browser Chrome */}
              <div style={{ height: '44px', background: '#0F172A', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F87171' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FBBF24' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#34D399' }} />
                <div style={{ flex: 1, marginLeft: '12px', height: '22px', borderRadius: '6px', background: '#1E293B', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '0.6875rem', color: '#64748B', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  app.education-agent.ai
                </div>
              </div>

              {/* Dashboard Preview with Typing AI Dialogue */}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }} />
                    <div style={{ width: '80px', height: '10px', borderRadius: '4px', background: '#475569', marginTop: '7px' }} />
                  </div>
                  <div style={{
                    width: '60px', height: '24px', borderRadius: '6px',
                    background: 'rgba(99,102,241,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.625rem', color: '#A5B4FC', fontWeight: 600,
                  }}>
                    AI对话
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[{ label: '掌握度', value: '78%', color: '#6EE7B7', bg: 'rgba(16,185,129,0.1)' }, { label: '练习', value: '342', color: '#A5B4FC', bg: 'rgba(99,102,241,0.1)' }, { label: '知识点', value: '56', color: '#FCD34D', bg: 'rgba(251,191,36,0.1)' }, { label: '学习', value: '12天', color: '#F9A8D4', bg: 'rgba(236,72,153,0.1)' }].map((s, i) => (
                    <div key={i} style={{ padding: '12px', borderRadius: '10px', background: s.bg }}>
                      <div style={{ fontSize: '0.625rem', color: '#64748B', marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* AI Typing Chat Dialogue */}
                <AITypingDialogue />

                {/* Knowledge bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: '#0F172A', border: '1px solid #1E293B' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                  <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#334155' }}>
                    <div style={{ width: '62%', height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, #6366F1, #A78BFA)', transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>知识掌握度 62%</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8125rem', color: '#64748B' }}>
              <span style={{ background: '#1E293B', padding: '4px 16px', borderRadius: '20px', border: '1px solid #334155' }}>
                🖥 产品界面示意 <span style={{ color: '#6EE7B7', fontSize: '0.6875rem' }}>· 实时AI对话</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 768px) { .responsive-stack { grid-template-columns: 1fr !important; gap: 48px !important; } }`}</style>
    </section>
  )
}
