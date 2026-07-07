import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { profileV2Api, dashboardApi } from '../api'
import { pathApi, type AgentRecommendation } from '../api/path'
import { recommendApi, type Recommendation } from '../api/recommend'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircleIcon, EditIcon, BotIcon, ZapIcon, LightbulbIcon,
  AlertTriangleIcon, BookIcon, UserIcon, StarIcon,
  TargetIcon, BookOpenIcon, LayersIcon,
  MessageCircleIcon, BrainIcon,
} from '../components/Icons'

/* ─────────────────────────────────────────────
   Brand Design Tokens
   ───────────────────────────────────────────── */
const BRAND_COLOR = '#1677E8'
const BRAND_COLOR_DARK = '#0958D9'
const BRAND_COLOR_LIGHT = '#EFF6FF'
const TEXT_PRIMARY = '#2C3A52'
const TEXT_SECONDARY = '#64748B'
const TEXT_MUTED = '#94A3B8'
const BORDER_LIGHT = '#E5EDF7'
const BG_PAGE = '#F7FAFF'

/* ─────────────────────────────────────────────
   CountUp Animation Component
   ───────────────────────────────────────────── */
function CountUp({ value, suffix = '' }: { value: number | string; suffix?: string }) {
  const [display, setDisplay] = useState('0')
  const ref = useRef<HTMLSpanElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const num = typeof value === 'number' ? value : (parseInt(String(value)) || 0)
    if (num === 0 || value === '--' || value === '' || value === undefined || value === null) {
      setDisplay(String(value ?? '0') + suffix)
      return
    }
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || done.current) return
      done.current = true
      ob.disconnect()
      let current = 0
      const totalSteps = 40
      const step = Math.max(1, Math.ceil(num / totalSteps))
      let frame = 0
      const animate = () => {
        frame++
        if (frame % 2 !== 0) { requestAnimationFrame(animate); return }
        current += step
        if (current >= num) { setDisplay(`${num}${suffix}`); return }
        setDisplay(`${current}${suffix}`)
        requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }, { threshold: 0.2 })
    ob.observe(el)
    return () => ob.disconnect()
  }, [value, suffix])

  return <span ref={ref} style={{ display: 'inline-block' }}>{display}</span>
}

/* ─────────────────────────────────────────────
   Inline SVGs
   ───────────────────────────────────────────── */
const FireIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 23c5.523 0 10-4.477 10-10 0-4.478-2.078-7.742-4.164-10.084C16.394 1.328 14.373 0 12 0 9.627 0 7.606 1.328 6.164 2.916 4.078 5.258 2 8.522 2 13c0 5.523 4.477 10 10 10z" fill="#F97316" />
    <path d="M12 21a1 1 0 0 0 1-1c0-2-1.5-3.5-2.5-4.5S9 14 9 12c0-1 1-2 3-2-1 1.5-.5 3 .5 4.5S15 17 15 19a3 3 0 0 1-3 3z" fill="white" />
  </svg>
)

const initialStats = { total_study_days: 0, current_streak: 0, longest_streak: 0, today_questions: 0, today_minutes: 0, total_questions: 0, average_mastery: 0, total_minutes: 0 }

/* ─────────────────────────────────────────────
   Home Background — 浅紫渐变 + 细微方块暗纹
   ───────────────────────────────────────────── */
function HomeBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
      background: `
        linear-gradient(165deg, #F0F9FF 0%, #E0F2FE 20%, #BAE6FD 40%, #E0F2FE 60%, #F0F9FF 80%, #EFF6FF 100%),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 60px,
          rgba(2,132,199,0.02) 60px,
          rgba(2,132,199,0.02) 61px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 60px,
          rgba(2,132,199,0.02) 60px,
          rgba(2,132,199,0.02) 61px
        )
      `,
      backgroundBlendMode: 'normal, overlay, overlay',
    }}>
      {/* Floating geometric decor */}
      <div style={{
        position: 'absolute', top: '8%', right: '12%', width: 48, height: 48,
        borderRadius: 14, background: 'rgba(2,132,199,0.06)',
        transform: 'rotate(25deg)',
        animation: 'hmFloat1 10s ease infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', left: '8%', width: 36, height: 36,
        borderRadius: '50%', background: 'rgba(56,189,248,0.05)',
        animation: 'hmFloat2 12s ease infinite 1s',
      }} />
      <div style={{
        position: 'absolute', top: '35%', left: '4%', width: 56, height: 56,
        borderRadius: 18, background: 'rgba(14,165,233,0.03)',
        transform: 'rotate(-20deg)',
        animation: 'hmFloat1 14s ease infinite 2s',
      }} />
      <div style={{
        position: 'absolute', bottom: '25%', right: '6%', width: 40, height: 40,
        borderRadius: 10, background: 'rgba(125,211,252,0.04)',
        transform: 'rotate(35deg)',
        animation: 'hmFloat2 9s ease infinite 0.5s',
      }} />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Data overview config — 轻量数据条
   ───────────────────────────────────────────── */
const overviewDataConfig = [
  {
    label: '已掌握进度',
    icon: <CheckCircleIcon size={18} color={BRAND_COLOR} />,
    getValue: (_s: Record<string, number>, stats: typeof initialStats) => stats.average_mastery || 0,
    suffix: '%',
  },
  {
    label: '累计练习',
    icon: <EditIcon size={18} color={BRAND_COLOR} />,
    getValue: (_s: Record<string, number>, stats: typeof initialStats) => stats.total_questions || 0,
    suffix: '',
  },
  {
    label: '进行中学习',
    icon: <BookIcon size={18} color="#F59E0B" />,
    getValue: (s: Record<string, number>) => s.learning || 0,
    suffix: '',
  },
  {
    label: '学习天数',
    icon: <FireIcon />,
    getValue: (_s: Record<string, number>, stats: typeof initialStats) => stats.total_study_days || 0,
    suffix: '天',
  },
]

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore()
  const [hasProfile, setHasProfile] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([])
  const [personRecs, setPersonRecs] = useState<Recommendation[]>([])
  const [studyStats, setStudyStats] = useState(initialStats)

  useEffect(() => {
    if (isAuthenticated) { checkProfile(); loadDashboard() }
    else setIsChecking(false)
  }, [isAuthenticated])

  const checkProfile = async () => {
    try { await profileV2Api.getProfile(); setHasProfile(true) }
    catch { setHasProfile(false) }
    finally { setIsChecking(false) }
  }

  const loadDashboard = useCallback(async () => {
    try {
      const [pathRes, agentRes, recRes, statsRes] = await Promise.allSettled([
        pathApi.getCurrentPath(), pathApi.getAgentRecommendations(),
        recommendApi.getAll(), dashboardApi.getStats(),
      ])
      if (pathRes.status === 'fulfilled') setSummary(pathRes.value.data.summary)
      if (agentRes.status === 'fulfilled') setRecommendations(agentRes.value.data.recommendations.slice(0, 3))
      if (recRes.status === 'fulfilled') setPersonRecs(recRes.value.data.recommendations.slice(0, 3))
      if (statsRes.status === 'fulfilled') setStudyStats(statsRes.value.data)
    } catch {}
  }, [])

  const todayRecs = recommendations.filter(r => r.priority === 'high').slice(0, 4)
  const totalDifficult = summary.difficult || 0

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    }}>
      <style>{`
        @keyframes hmFloat1 {
          0%, 100% { transform: translateY(0) rotate(25deg); opacity: 0.4; }
          50% { transform: translateY(-20px) rotate(30deg); opacity: 0.7; }
        }
        @keyframes hmFloat2 {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.05); opacity: 0.6; }
        }
        @keyframes hmFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hmDataPop {
          0% { opacity: 0; transform: scale(0.8); }
          60% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        .hm-fade-up { opacity: 0; animation: hmFadeUp 0.5s ease forwards; }
        .hm-data-val { animation: hmDataPop 0.4s ease forwards; }
        .hm-qck-btn {
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1),
                      box-shadow 0.25s cubic-bezier(0.4,0,0.2,1),
                      background 0.25s ease !important;
        }
        .hm-qck-btn:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 20px -6px rgba(0,0,0,0.08) !important;
        }
      `}</style>

      <HomeBackground />

      {isAuthenticated ? (
        <main style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 28px 32px',
        }}>
          {/* ─── ① 数据概览区 — 横向通栏轻量数据条 ─── */}
          <section style={{
            marginTop: 16,
            marginBottom: 28,
            background: '#FFFFFF',
            borderRadius: 16,
            border: `1px solid ${BORDER_LIGHT}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            padding: '18px 8px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
            }}>
              {overviewDataConfig.map((cfg, i) => {
                const val = cfg.getValue(summary, studyStats)
                return (
                  <div key={cfg.label} style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    padding: '4px 12px',
                    borderRight: i < overviewDataConfig.length - 1 ? `1px solid ${BORDER_LIGHT}` : 'none',
                  }}>
                    {/* 图标 */}
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: BRAND_COLOR_LIGHT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {cfg.icon}
                    </div>
                    {/* 数字 + 说明 */}
                    <div>
                      <div className="hm-data-val" style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: BRAND_COLOR,
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                      }}>
                        <CountUp value={val} suffix={cfg.suffix} />
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: TEXT_MUTED,
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ─── ② 左右分栏 (58/42) ─── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 24,
            alignItems: 'start',
          }}>

            {/* ═══ 左栏：今日学习建议 ═══ */}
            <div className="hm-fade-up" style={{ animationDelay: '0.15s' }}>
              <div style={{
                background: '#FFFFFF',
                borderRadius: 16,
                border: `1px solid ${BORDER_LIGHT}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                padding: '32px 32px 36px',
                minHeight: 400,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* 标题行 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 24,
                  paddingBottom: 18,
                  borderBottom: `1px solid ${BORDER_LIGHT}`,
                }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: BRAND_COLOR_LIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: BRAND_COLOR,
                    flexShrink: 0,
                  }}>
                    <BotIcon size={18} color={BRAND_COLOR} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: TEXT_PRIMARY,
                      margin: 0,
                      fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                    }}>
                      今日学习建议
                    </h3>
                    <span style={{
                      fontSize: '0.72rem',
                      color: TEXT_MUTED,
                      background: '#F5F5F5',
                      padding: '1px 8px',
                      borderRadius: 6,
                    }}>
                      {todayRecs.length + personRecs.length > 0
                        ? `${todayRecs.length + personRecs.length} 项建议`
                        : '暂无建议'}
                    </span>
                  </div>
                </div>

                {/* 内容区 */}
                {todayRecs.length === 0 && personRecs.length === 0 ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '20px 10px',
                    color: TEXT_MUTED,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                      <div style={{
                        width: 100, height: 68, borderRadius: 10,
                        background: BRAND_COLOR_LIGHT, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', opacity: 0.5, flexShrink: 0,
                      }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BRAND_COLOR} strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 500, color: TEXT_MUTED, marginBottom: 4 }}>
                          暂无学习建议
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#B0B7C3', lineHeight: 1.6, marginBottom: 16 }}>
                          AI 正在分析你的学习数据<br />
                          完成练习后将生成个性化建议
                        </div>
                        <Link to="/banks" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '10px 28px', borderRadius: 8,
                          background: BRAND_COLOR, color: '#fff',
                          fontSize: '0.85rem', fontWeight: 500,
                          textDecoration: 'none', fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                          border: 'none', cursor: 'pointer',
                          transition: 'background 0.2s ease',
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = BRAND_COLOR_DARK }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = BRAND_COLOR }}
                        >
                          开始练习
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {todayRecs.map((rec, i) => (
                      <Link key={`agent-${i}`} to="/path" style={{
                        textDecoration: 'none', color: 'inherit',
                        padding: '16px 20px', borderRadius: 10,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderLeft: `4px solid #EF4444`,
                        transition: 'all 0.2s ease', display: 'block',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {rec.priority === 'high' && <AlertTriangleIcon size={12} color="#EF4444" />}
                          {rec.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: TEXT_SECONDARY, lineHeight: 1.5 }}>{rec.description}</div>
                      </Link>
                    ))}
                    {personRecs.slice(0, 2).map((rec, i) => (
                      <Link key={`person-${i}`} to="/path" style={{
                        textDecoration: 'none', color: 'inherit',
                        padding: '16px 20px', borderRadius: 10,
                        background: BRAND_COLOR_LIGHT, border: '1px solid #E9D5FF',
                        borderLeft: `4px solid ${BRAND_COLOR}`,
                        transition: 'all 0.2s ease', display: 'block',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 4 }}>{rec.title}</div>
                        <div style={{ fontSize: '0.75rem', color: TEXT_SECONDARY, lineHeight: 1.5 }}>{rec.reason}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ 右栏 ═══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ① 快速开始 — 2×2 浅底色小按钮 */}
              <div className="hm-fade-up" style={{ animationDelay: '0.25s' }}>
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  border: `1px solid ${BORDER_LIGHT}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  padding: '24px 22px 26px',
                }}>
                  <h3 style={{
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    margin: '0 0 16px',
                    color: TEXT_PRIMARY,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                  }}>
                    <ZapIcon size={15} color={BRAND_COLOR} /> 快速开始
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: '开始练习', desc: '从题库选择题目', to: '/banks', color: '#3B82F6', bg: '#EFF6FF' },
                      { label: 'AI 对话', desc: '与 AI 讨论问题', to: '/chat/new', color: '#1677E8', bg: '#F0F9FF' },
                      { label: '学习规划', desc: '规划学习路径', to: '/path', color: '#06B6D4', bg: '#ECFEFF' },
                      { label: '资源推荐', desc: '个性化资源推送', to: '/recommendations', color: '#10B981', bg: '#ECFDF5' },
                    ].map((action, i) => (
                      <Link key={i} to={action.to} className="hm-qck-btn"
                        style={{
                          textDecoration: 'none',
                          padding: '20px 16px',
                          borderRadius: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 8,
                          background: action.bg,
                          border: `1px solid ${action.color}15`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = action.color + '35'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = action.color + '15'
                        }}
                      >
                        <div style={{ marginBottom: 2 }}>
                          {i === 0 ? <EditIcon size={20} color={action.color} /> :
                           i === 1 ? <MessageCircleIcon size={20} color={action.color} /> :
                           i === 2 ? <TargetIcon size={20} color={action.color} /> :
                           <StarIcon size={20} color={action.color} />}
                        </div>
                        <div style={{
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: TEXT_PRIMARY,
                          fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                        }}>
                          {action.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: TEXT_MUTED }}>
                          {action.desc}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* ② 学习小贴士 — 米黄色便签卡片 */}
              <div className="hm-fade-up" style={{ animationDelay: '0.35s' }}>
                <div style={{
                  borderRadius: 16,
                  padding: '26px 24px 28px',
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  boxShadow: 'inset 0 2px 4px rgba(251,191,36,0.06), 0 1px 3px rgba(0,0,0,0.03)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* 装饰圆点 */}
                  <div style={{
                    position: 'absolute', left: '12%', top: 12, width: 6, height: 6,
                    borderRadius: '50%', background: '#FCD34D', opacity: 0.35, pointerEvents: 'none',
                    animation: 'hmFloat2 4s ease-in-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', right: '18%', bottom: 12, width: 5, height: 5,
                    borderRadius: '50%', background: '#F59E0B', opacity: 0.25, pointerEvents: 'none',
                    animation: 'hmFloat1 5s ease-in-out infinite 1s',
                  }} />
                  {/* 右上角便签折角装饰 */}
                  <div style={{
                    position: 'absolute', right: 0, top: 0,
                    width: 0, height: 0,
                    borderRight: '22px solid #FDE68A',
                    borderTop: '22px solid #FDE68A',
                    borderLeft: '22px solid transparent',
                    borderBottom: '22px solid transparent',
                    opacity: 0.35,
                    pointerEvents: 'none',
                  }} />

                  <h3 style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    margin: '0 0 14px',
                    color: '#92400E',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                  }}>
                    <LightbulbIcon size={15} color="#D97706" /> 学习小贴士
                  </h3>

                  <div style={{
                    fontSize: '0.8rem',
                    color: '#92400E',
                    lineHeight: 1.9,
                    opacity: 0.88,
                    fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                  }}>
                    艾宾浩斯遗忘曲线提示：学完新知识后，在 <strong>1天、2天、4天、7天</strong> 后分别复习一次，能有效提升长期记忆效果。
                    {totalDifficult > 0 && (
                      <div style={{
                        marginTop: 14,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'rgba(220,38,38,0.06)',
                        border: '1px solid rgba(220,38,38,0.1)',
                        fontWeight: 500,
                        fontSize: '0.78rem',
                        color: '#DC2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <AlertTriangleIcon size={12} color="#DC2626" />
                        你有 <strong>{totalDifficult}</strong> 个薄弱知识点，建议优先攻克。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ③ 初始化画像（条件渲染） */}
              {!isChecking && !hasProfile && (
                <div className="hm-fade-up" style={{ animationDelay: '0.45s' }}>
                  <div style={{
                    borderRadius: 16,
                    padding: '22px 20px',
                    textAlign: 'center',
                    background: '#FFFFFF',
                    border: `1px solid ${BORDER_LIGHT}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <p style={{ fontSize: '0.85rem', color: BRAND_COLOR, margin: '0 0 16px', fontWeight: 500 }}>
                      初始化你的学习画像，获得更精准的学习建议
                    </p>
                    <Link to="/profile/init"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '10px 28px', borderRadius: 8,
                        background: BRAND_COLOR,
                        color: '#fff', fontSize: '0.85rem', fontWeight: 500,
                        textDecoration: 'none',
                        fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = BRAND_COLOR_DARK
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = BRAND_COLOR
                      }}
                    >
                      初始化画像
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── ③ 底部版权栏 ─── */}
          <footer style={{
            textAlign: 'center',
            padding: '32px 0 8px',
            fontSize: '0.75rem',
            color: TEXT_MUTED,
            borderTop: `1px solid ${BORDER_LIGHT}`,
            marginTop: 44,
          }}>
            © {new Date().getFullYear()} Education Agent · 让AI理解你的学习，为每个人因材施教
          </footer>
        </main>
      ) : (
        <div style={{
          position: 'relative', zIndex: 1,
          flex: 1, padding: '40px 32px',
          color: TEXT_MUTED, fontSize: '0.875rem',
        }}>
          <p>请先登录</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   顶部导航栏组件 — 白底文字导航 + 右侧简约控件
   ═══════════════════════════════════════════════════════════ */
