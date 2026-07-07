import { useState, useEffect, useRef } from 'react'

interface ModelSwitcherProps {
  onLoginClick: () => void
}

const models = [
  {
    id: 'edu-base',
    name: 'Edu-Base 通用教学模型',
    desc: '覆盖K12到高等教育全学科知识，擅长概念讲解、知识点梳理与作业辅导',
    icon: '🎓',
    color: '#818CF8',
    features: ['全学科覆盖', '概念精准讲解', '作业智能批改'],
    scenario: '适合日常学习辅导与知识巩固',
  },
  {
    id: 'edu-research',
    name: 'Edu-Research 科研增强模型',
    desc: '专为学术研究设计，擅长论文分析、实验设计指导、文献综述与研究方法论',
    icon: '🔬',
    color: '#6EE7B7',
    features: ['论文分析', '实验设计', '文献综述'],
    scenario: '适合研究生、科研人员的学术研究',
  },
  {
    id: 'edu-code',
    name: 'Edu-Code 编程实训模型',
    desc: '专注编程教育，支持代码生成、Debug调试、算法讲解与项目实战辅导',
    icon: '💻',
    color: '#FCD34D',
    features: ['代码生成', 'Debug调试', '项目实战'],
    scenario: '适合计算机编程学习与技术面试准备',
  },
]

export default function ModelSwitcher({ onLoginClick }: ModelSwitcherProps) {
  const [selectedModel, setSelectedModel] = useState(models[0])
  const [isOpen, setIsOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [showResponse, setShowResponse] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Scroll entrance
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )
    if (sectionRef.current) {
      sectionRef.current.classList.remove('visible')
      observer.observe(sectionRef.current)
    }
    return () => observer.disconnect()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSend = () => {
    if (!inputText.trim()) return
    setShowResponse(true)
    setTimeout(() => {
      setShowResponse(false)
    }, 5000)
  }

  return (
    <section ref={sectionRef} className="anim-slide-up" style={{
      padding: '100px 32px',
      background: '#0F172A',
      borderTop: '1px solid #1E293B',
      borderBottom: '1px solid #1E293B',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: '-50%', right: '-20%',
        width: '600px', height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
            background: 'rgba(129,140,248,0.12)', color: '#A5B4FC',
            fontSize: '0.8125rem', fontWeight: 600, marginBottom: '16px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            多模型切换
          </span>
          <h2 style={{
            fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700,
            color: '#F1F5F9', marginBottom: '16px',
          }}>
            智能切换<span style={{ color: '#A5B4FC' }}>教育专用大模型</span>
          </h2>
          <p style={{ fontSize: '1.05rem', color: '#94A3B8', maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>
            不同学习场景匹配不同AI引擎，让每段对话都用最合适的模型
          </p>
        </div>

        {/* Main Content: Chat + Model Panel Side by Side */}
        <div className="responsive-models-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '32px',
          alignItems: 'start',
        }}>
          {/* ── Left: Chat Input Area ── */}
          <div style={{
            background: '#1E293B',
            borderRadius: '20px',
            border: '1px solid #334155',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            {/* Chat Header */}
            <div style={{
              padding: '16px 20px', background: '#0F172A',
              borderBottom: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#F1F5F9', fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                AI 对话
              </span>
              {/* Active Model Badge */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '8px',
                    border: '1px solid rgba(129,140,248,0.3)',
                    background: 'rgba(129,140,248,0.08)',
                    color: '#A5B4FC', fontSize: '0.75rem', fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(129,140,248,0.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(129,140,248,0.08)' }}
                >
                  <span style={{ fontSize: '0.875rem' }}>{selectedModel.icon}</span>
                  {selectedModel.name.split(' ')[0]}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown */}
                {isOpen && (
                  <div className="model-dropdown" style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    width: '280px', zIndex: 100,
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '8px 12px', fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #334155' }}>
                      选择AI模型
                    </div>
                    {models.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => { setSelectedModel(model); setIsOpen(false) }}
                        style={{
                          display: 'flex', gap: '12px', padding: '12px 14px',
                          width: '100%', border: 'none', background: 'transparent',
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          transition: 'background 0.15s ease',
                          borderBottom: '1px solid rgba(51,65,85,0.5)',
                          background: selectedModel.id === model.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (selectedModel.id !== model.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={(e) => { if (selectedModel.id !== model.id) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>{model.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: selectedModel.id === model.id ? '#A5B4FC' : '#E2E8F0' }}>
                            {model.name}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                            {model.scenario}
                          </div>
                        </div>
                        {selectedModel.id === model.id && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A5B4FC" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div style={{ padding: '20px', minHeight: '200px' }}>
              <div style={{
                padding: '14px 16px', borderRadius: '12px',
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.12)',
                marginBottom: '16px',
              }}>
                <div style={{ fontSize: '0.75rem', color: selectedModel.color, fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{selectedModel.icon}</span>
                  当前模型: {selectedModel.name}
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>
                  {selectedModel.desc}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {selectedModel.features.map((f, i) => (
                    <span key={i} style={{
                      padding: '2px 10px', borderRadius: '12px',
                      background: `${selectedModel.color}15`,
                      color: selectedModel.color,
                      fontSize: '0.6875rem', fontWeight: 500,
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Simulated Response */}
              {showResponse && (
                <div className="step-enter" style={{
                  padding: '12px 14px', borderRadius: '12px',
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.12)',
                  fontSize: '0.8125rem', color: '#CBD5E1', lineHeight: 1.7,
                }}>
                  <div style={{ fontSize: '0.6875rem', color: '#6EE7B7', fontWeight: 600, marginBottom: '6px' }}>
                    {selectedModel.icon} {selectedModel.name.split(' ')[0]} 响应
                  </div>
                  {selectedModel.id === 'edu-base' && '根据你的问题，这涉及微积分中的链式法则...'}
                  {selectedModel.id === 'edu-research' && '这篇论文的主要创新点在于提出了一种新的实验设计方法...'}
                  {selectedModel.id === 'edu-code' && '这个问题可以通过动态规划优化，以下是具体实现代码...'}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div style={{
              padding: '16px 20px', borderTop: '1px solid #334155',
              background: '#0F172A',
              display: 'flex', gap: '10px',
            }}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={`向${selectedModel.name.split(' ')[0]}提问...`}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #334155', background: '#1E293B',
                  color: '#F1F5F9', fontSize: '0.8125rem', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleSend}
                style={{
                  padding: '10px 18px', borderRadius: '10px', border: 'none',
                  background: inputText.trim() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#334155',
                  color: '#fff', cursor: inputText.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s ease', display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Right: Model Info Panel ── */}
          <div>
            <div style={{
              background: '#1E293B',
              borderRadius: '20px',
              border: '1px solid #334155',
              padding: '32px 28px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginBottom: '20px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                模型能力对比
              </div>

              {/* Model Comparison Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {models.map((model) => {
                  const isSelected = selectedModel.id === model.id
                  return (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 16px', borderRadius: '14px',
                        border: isSelected ? `1.5px solid ${model.color}` : '1px solid #334155',
                        background: isSelected ? `${model.color}08` : 'transparent',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        transition: 'all 0.25s ease',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          e.currentTarget.style.borderColor = '#475569'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.borderColor = '#334155'
                        }
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{model.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: isSelected ? model.color : '#E2E8F0' }}>
                          {model.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px', lineHeight: 1.5 }}>
                          {model.scenario}
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: model.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Scenario Badge */}
              <div style={{
                marginTop: '20px', padding: '14px 16px', borderRadius: '12px',
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.12)',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#A5B4FC', fontWeight: 600, marginBottom: '4px' }}>
                  推荐场景
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>
                  {selectedModel.scenario} — {selectedModel.desc.split('，')[0]}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
