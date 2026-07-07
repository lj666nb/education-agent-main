import { useEffect, useRef, useState } from 'react'

interface ToolsMatrixProps {
  onLoginClick: () => void
}

const tools = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
        <line x1="8" y1="15" x2="12" y2="15" />
      </svg>
    ),
    title: '智能知识点梳理',
    desc: '自动解析教材、课件、课堂笔记，拆分重难点，生成结构化思维导图与分层知识点注释，一键导出可打印复习资料',
    features: [
      '多格式教材解析（PDF/PPT/Word/图片）',
      '自动提取核心概念与层级关系',
      '生成知识图谱与思维导图预览',
      '支持一键导出复习笔记',
    ],
    color: '#818CF8',
    bg: 'rgba(129,140,248,0.10)',
    tag: '知识管理',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: '专项练习自测生成',
    desc: '基于你的学习画像定位薄弱章节，自动生成分层难度练习题，配套详细解析与步骤推导，做完即时批改并生成错题归档',
    features: [
      '自适应难度分层（基础/进阶/挑战）',
      '覆盖选择、填空、解答、编程多题型',
      'AI自动批改与详细步骤解析',
      '错题自动归档与同类题巩固推送',
    ],
    color: '#6EE7B7',
    bg: 'rgba(16,185,129,0.10)',
    tag: '练习评估',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <path d="M12 7v6" />
        <path d="M9 13h6" />
      </svg>
    ),
    title: '多模态AI答疑导师',
    desc: '支持文字、公式、代码、图片拍照提问，实时拆解难点，通俗化讲解，同步推送同类巩固习题，全天候在线答疑',
    features: [
      '支持文字/公式/代码/图片多模态输入',
      '实时拆解难点，通俗化逐步讲解',
      '追问纠错与举一反三拓展',
      '24h全天候在线，随问随答',
    ],
    color: '#FCD34D',
    bg: 'rgba(252,211,77,0.10)',
    tag: '智能问答',
  },
]

export default function ToolsMatrix({ onLoginClick }: ToolsMatrixProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          // Trigger card entrance animations
          cardRefs.current.forEach((el, i) => {
            if (el) {
              setTimeout(() => {
                el.style.opacity = '1'
                el.style.transform = 'translateY(0)'
              }, i * 150)
            }
          })
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="tools" ref={sectionRef} style={{
      padding: '100px 32px',
      background: '#0F172A',
      borderTop: '1px solid #1E293B',
      borderBottom: '1px solid #1E293B',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient purple glow */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* ── Section Header ── */}
        <div style={{
          textAlign: 'center', marginBottom: '56px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.7s ease-out',
        }}>
          <span style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
            background: 'rgba(251,191,36,0.12)', color: '#FCD34D',
            fontSize: '0.8125rem', fontWeight: 600, marginBottom: '16px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <rect x="2" y="2" width="8" height="8" rx="2" /><rect x="14" y="2" width="8" height="8" rx="2" /><rect x="2" y="14" width="8" height="8" rx="2" /><rect x="14" y="14" width="8" height="8" rx="2" />
            </svg>
            AI 学习工具
          </span>

          <h2 style={{
            fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700,
            color: '#F1F5F9', marginBottom: '16px', letterSpacing: '-0.02em',
          }}>
            三大<span style={{ color: '#A5B4FC' }}>AI</span>学习工具，覆盖全场景
          </h2>

          <p style={{
            fontSize: '0.95rem', color: '#94A3B8', maxWidth: 720,
            margin: '0 auto', lineHeight: 1.8,
          }}>
            一站式覆盖知识点梳理、专项刷题训练、24h疑难答疑、艾宾浩斯复习规划、学习报告生成全链路，
            <br />
            AI工具矩阵适配初高中 / 大学 / 考研全学段学习需求
          </p>
        </div>

        {/* ── 3-Column Card Grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}>
          {tools.map((tool, i) => (
            <div
              key={tool.title}
              ref={(el) => { cardRefs.current[i] = el }}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '20px',
                padding: '36px 28px 32px',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                opacity: 0,
                transform: 'translateY(30px)',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)'
                e.currentTarget.style.borderColor = `${tool.color}44`
                e.currentTarget.style.boxShadow = `0 24px 48px -8px ${tool.color}22, 0 8px 20px rgba(0,0,0,0.2)`
                e.currentTarget.style.background = '#263548'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = '#334155'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'
                e.currentTarget.style.background = '#1E293B'
              }}
            >
              {/* Icon — purple gradient glow on hover */}
              <div className="feature-icon-wrap" style={{
                width: '56px', height: '56px', borderRadius: '14px',
                background: tool.bg,
                color: tool.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '22px',
                transition: 'all 0.3s ease',
                position: 'relative',
              }}>
                {/* Glow behind icon */}
                <div style={{
                  position: 'absolute', inset: '-4px',
                  borderRadius: '18px',
                  background: `radial-gradient(circle, ${tool.color}22 0%, transparent 70%)`,
                  opacity: 0,
                  transition: 'opacity 0.3s ease',
                }} className="icon-glow-bg" />
                {tool.icon}
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: '1.125rem', fontWeight: 600,
                color: '#F1F5F9', marginBottom: '12px',
                fontFamily: 'var(--font-heading)',
              }}>
                {tool.title}
              </h3>

              {/* Description — longer, more detailed */}
              <p style={{
                fontSize: '0.875rem', color: '#94A3B8',
                lineHeight: 1.8, marginBottom: '20px', flex: 1,
              }}>
                {tool.desc}
              </p>

              {/* Feature list */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                marginBottom: '20px',
              }}>
                {tool.features.map((feat, fi) => (
                  <div key={fi} style={{
                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                    fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.6,
                  }}>
                    <span style={{
                      width: '16px', height: '16px', borderRadius: '4px',
                      background: tool.bg, color: tool.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '2px', fontSize: '0.625rem',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {feat}
                  </div>
                ))}
              </div>

              {/* Tag badge */}
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <span style={{
                  padding: '3px 12px', borderRadius: '12px',
                  background: tool.bg, color: tool.color,
                  fontSize: '0.6875rem', fontWeight: 500,
                }}>
                  {tool.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hover icon glow effect */}
      <style>{`
        .feature-icon-wrap:hover .icon-glow-bg { opacity: 1 !important; }
        .feature-icon-wrap:hover { transform: scale(1.05); }
      `}</style>
    </section>
  )
}
