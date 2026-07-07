import { useEffect, useRef, useState } from 'react'

interface BuilderFlowProps {
  onLoginClick: () => void
}

/* ── Typing Text Effect ── */
function TypeText({ text, speed = 30, delay = 0, onComplete }: { text: string; speed?: number; delay?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('')
  const idxRef = useRef(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      idxRef.current = 0
      setDisplayed('')
      const t = setInterval(() => {
        if (idxRef.current < text.length) {
          setDisplayed(text.slice(0, idxRef.current + 1))
          idxRef.current++
        } else {
          clearInterval(t)
          onComplete?.()
        }
      }, speed)
      return () => clearInterval(t)
    }, delay)
    return () => clearTimeout(timeout)
  }, [text, speed, delay, onComplete])

  return <span>{displayed}<span className="typing-cursor" /></span>
}

/* ── Flow Step Item ── */
function FlowStep({
  number, title, desc, isActive, isDone, isLast,
}: {
  number: number; title: string; desc: string; isActive: boolean; isDone: boolean; isLast: boolean
}) {
  return (
    <div style={{
      display: 'flex', gap: '16px', alignItems: 'flex-start',
      opacity: isDone ? 1 : isActive ? 1 : 0.3,
      transform: isDone ? 'none' : isActive ? 'none' : 'translateX(-10px)',
      transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Left: Circle + Connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div className={isActive ? 'step-circle-active' : ''} style={{
          width: '36px', height: '36px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8125rem', fontWeight: 700,
          background: isDone
            ? 'linear-gradient(135deg, #6366F1, #A78BFA)'
            : isActive
              ? 'linear-gradient(135deg, #6366F1, #A78BFA)'
              : '#334155',
          color: '#fff',
          boxShadow: isActive ? '0 0 20px rgba(167,139,250,0.3)' : 'none',
          transition: 'all 0.4s ease',
        }}>
          {isDone ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : number}
        </div>
        {!isLast && (
          <div className="connector-line" style={{
            width: '2px', height: '40px',
            background: isDone ? 'linear-gradient(180deg, #A78BFA, #6366F1)' : '#334155',
            transition: 'background 0.5s ease',
            margin: '6px 0',
          }} />
        )}
      </div>
      {/* Right: Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : '24px' }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: isDone || isActive ? '#F1F5F9' : '#64748B', marginBottom: '4px', transition: 'color 0.3s ease' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.8125rem', color: isDone || isActive ? '#94A3B8' : '#475569', lineHeight: 1.6, transition: 'color 0.3s ease' }}>
          {desc}
        </div>
      </div>
    </div>
  )
}

export default function BuilderFlow({ onLoginClick }: BuilderFlowProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(-1)
  const [chatPhase, setChatPhase] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [doneSteps, setDoneSteps] = useState<number[]>([])

  const steps = [
    { title: '设定学习目标', desc: '输入你想学习的科目或技能，AI会智能拆解学习目标为知识图谱' },
    { title: 'AI评估基础水平', desc: '通过简短问答测试你的当前水平，自动定位薄弱环节' },
    { title: '生成个性化路径', desc: 'AI根据画像动态规划最优学习路径，适配你的学习风格' },
    { title: '自适应学习执行', desc: '按照路径推进，系统实时调整难度与节奏，确保高效吸收' },
    { title: '智能评估反馈', desc: '每阶段结束后AI生成学习报告，指出进步与待加强领域' },
  ]

  // Intersection Observer for triggering animation sequence
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Start sequence when section enters view
          let stepIdx = 0
          const interval = setInterval(() => {
            if (stepIdx <= steps.length) {
              setActiveStep(stepIdx)
              if (stepIdx > 0) {
                setDoneSteps(prev => [...prev, stepIdx - 1])
              }
              stepIdx++
            } else {
              clearInterval(interval)
              setShowPreview(true)
            }
          }, 800)

          observer.unobserve(entry.target)
          return () => clearInterval(interval)
        }
      },
      { threshold: 0.2 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [steps.length])

  // Chat typing sequence
  useEffect(() => {
    if (activeStep < 0) return
    const timers = [
      setTimeout(() => setChatPhase(1), 300),
      setTimeout(() => setChatPhase(2), 1800),
      setTimeout(() => setChatPhase(3), 3500),
    ]
    return () => timers.forEach(t => clearTimeout(t))
  }, [activeStep])

  return (
    <section ref={sectionRef} style={{
      padding: '100px 32px',
      background: 'linear-gradient(180deg, #0B1121 0%, #0F172A 50%, #0B1121 100%)',
      borderTop: '1px solid #1E293B',
      borderBottom: '1px solid #1E293B',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Section Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto 60px', textAlign: 'center' }}>
        <span style={{
          display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
          background: 'rgba(16,185,129,0.12)', color: '#6EE7B7',
          fontSize: '0.8125rem', fontWeight: 600, marginBottom: '16px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          AI 全流程演示
        </span>
        <h2 style={{
          fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700,
          color: '#F1F5F9', marginBottom: '16px',
        }}>
          AI Builder — 智能规划你的<span style={{ color: '#A5B4FC' }}>学习全流程</span>
        </h2>
        <p style={{ fontSize: '1.05rem', color: '#94A3B8', maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>
          从目标设定到效果评估，AI Agent全程驱动，让个性化学习自动运行
        </p>
      </div>

      {/* 3-Column Layout */}
      <div className="responsive-builder-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        gap: '24px',
        maxWidth: 1200,
        margin: '0 auto',
        alignItems: 'start',
      }}>
        {/* ── Left: AI Dialogue Window ── */}
        <div style={{
          background: '#1E293B',
          borderRadius: '20px',
          border: '1px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          minHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Window Header */}
          <div style={{
            padding: '12px 16px', background: '#0F172A',
            borderBottom: '1px solid #334155',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F87171' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FBBF24' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#34D399' }} />
            <span style={{
              fontSize: '0.75rem', color: '#64748B', marginLeft: '8px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              AI 学习助手对话
            </span>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* AI Message 1 */}
            {chatPhase >= 1 && (
              <div className="step-enter" style={{
                padding: '12px 14px', borderRadius: '12px 12px 12px 2px',
                background: 'rgba(99,102,241,0.08)', maxWidth: '90%',
                fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: 1.7,
                border: '1px solid rgba(99,102,241,0.15)',
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#A5B4FC', fontWeight: 600, marginBottom: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                  AI Agent
                </div>
                <TypeText text="你好！我是你的专属学习规划师。请告诉我你想要学习什么科目或技能？" speed={20} delay={0} />
              </div>
            )}
            {/* User Message */}
            {chatPhase >= 2 && (
              <div className="step-enter" style={{
                padding: '12px 14px', borderRadius: '12px 12px 2px 12px',
                background: '#0F172A', maxWidth: '80%',
                fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.7,
                alignSelf: 'flex-end', border: '1px solid #334155',
              }}>
                <TypeText text="我想在3个月内系统学习Python数据分析，包括Pandas和可视化" speed={25} delay={0} />
              </div>
            )}
            {/* AI Response */}
            {chatPhase >= 3 && (
              <div className="step-enter" style={{
                padding: '12px 14px', borderRadius: '12px 12px 12px 2px',
                background: 'rgba(16,185,129,0.06)', maxWidth: '90%',
                fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: 1.7,
                border: '1px solid rgba(16,185,129,0.12)',
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#6EE7B7', fontWeight: 600, marginBottom: '6px' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  已生成学习计划
                </div>
                <TypeText text="太好了！我已经为你拆解了Python数据分析的知识体系，识别出6个核心模块共24个知识点。根据你的时间安排，我推荐每周专注2个模块，配合实战项目巩固。让我为你规划详细的路径..." speed={15} delay={0} />
              </div>
            )}
            {/* Typing indicator */}
            {chatPhase >= 1 && chatPhase < 3 && (
              <div style={{
                display: 'flex', gap: '8px', alignItems: 'center',
                padding: '10px 14px', color: '#64748B', fontSize: '0.75rem',
              }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#A78BFA', animation: 'bounceDown 1.4s ease-in-out infinite' }} />
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#A78BFA', animation: 'bounceDown 1.4s ease-in-out 0.2s infinite' }} />
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#A78BFA', animation: 'bounceDown 1.4s ease-in-out 0.4s infinite' }} />
                </div>
                AI正在分析...
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Flow Steps ── */}
        <div style={{
          background: '#1E293B',
          borderRadius: '20px',
          border: '1px solid #334155',
          padding: '32px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          minHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#6EE7B7', fontWeight: 600, marginBottom: '24px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <line x1="22" y1="12" x2="2" y2="12" /><polyline points="5 9 2 12 5 15" /><polyline points="19 9 22 12 19 15" />
            </svg>
            学习流程拆解
          </div>
          {steps.map((step, i) => (
            <FlowStep
              key={i}
              number={i + 1}
              title={step.title}
              desc={step.desc}
              isActive={activeStep === i}
              isDone={doneSteps.includes(i)}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>

        {/* ── Right: Preview Window ── */}
        <div className="builder-preview" style={{
          background: '#1E293B',
          borderRadius: '20px',
          border: '1px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          minHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
          opacity: showPreview ? 1 : 0,
          transform: showPreview ? 'translateX(0)' : 'translateX(20px)',
          transition: 'all 0.8s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Browser Chrome */}
          <div style={{
            height: '44px', background: '#0F172A',
            borderBottom: '1px solid #334155',
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F87171' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FBBF24' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#34D399' }} />
            <div style={{
              flex: 1, marginLeft: '12px', height: '22px', borderRadius: '6px',
              background: '#1E293B', display: 'flex', alignItems: 'center',
              padding: '0 10px', fontSize: '0.6875rem', color: '#64748B', gap: '4px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              app.education-agent.ai/learning-path
            </div>
          </div>

          {/* Preview Content */}
          <div style={{ padding: '20px', flex: 1 }}>
            {/* Learning Path Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6EE7B7', fontWeight: 600, marginBottom: '4px' }}>我的学习路径</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#F1F5F9' }}>Python数据分析</div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: '20px',
                background: 'rgba(16,185,129,0.1)', color: '#6EE7B7',
                fontSize: '0.6875rem', fontWeight: 600,
              }}>
                进度 42%
              </div>
            </div>

            {/* Content Cards */}
            {[
              { module: 'Python基础语法', progress: '100%', status: '已完成', color: '#6EE7B7' },
              { module: 'NumPy数据处理', progress: '85%', status: '进行中', color: '#A5B4FC' },
              { module: 'Pandas数据操作', progress: '45%', status: '进行中', color: '#A5B4FC' },
              { module: 'Matplotlib可视化', progress: '20%', status: '学习中', color: '#FCD34D' },
              { module: '数据清洗实战', progress: '0%', status: '待开始', color: '#64748B' },
            ].map((item, i) => (
              <div key={i} className="preview-enter" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '10px',
                background: i === 0 ? 'rgba(16,185,129,0.06)' : 'transparent',
                marginBottom: '6px',
                transitionDelay: `${i * 0.1}s`,
                opacity: 0,
                animation: showPreview ? `fadeInSlideUp 0.4s ease-out ${i * 0.12}s forwards` : 'none',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: item.color, flexShrink: 0,
                }} />
                <div style={{ flex: 1, fontSize: '0.8125rem', color: '#E2E8F0' }}>{item.module}</div>
                <div style={{
                  width: '60px', height: '4px', borderRadius: '2px',
                  background: '#334155', overflow: 'hidden',
                }}>
                  <div style={{
                    width: item.progress, height: '100%',
                    borderRadius: '2px',
                    background: `linear-gradient(90deg, #6366F1, ${item.color})`,
                    transition: 'width 1s ease',
                  }} />
                </div>
                <div style={{ fontSize: '0.6875rem', color: item.color, fontWeight: 500, width: '48px', textAlign: 'right' }}>
                  {item.status}
                </div>
              </div>
            ))}

            {/* Next Lesson CTA */}
            <div style={{
              marginTop: '16px', padding: '12px 16px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(167,139,250,0.05))',
              border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#A5B4FC', fontWeight: 600 }}>下一节推荐</div>
                <div style={{ fontSize: '0.8125rem', color: '#E2E8F0' }}>Pandas DataFrame高级操作</div>
              </div>
              <button style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}>
                继续学习
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating label decoration */}
      <div style={{
        position: 'absolute', top: '20%', right: '5%',
        fontSize: '0.6875rem', color: 'rgba(167,139,250,0.15)',
        fontWeight: 700, letterSpacing: '0.3em', transform: 'rotate(90deg)',
        whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 0,
      }}>
        AI-POWERED LEARNING
      </div>
    </section>
  )
}
