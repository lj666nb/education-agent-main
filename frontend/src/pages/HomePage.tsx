import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { profileV2Api, dashboardApi } from '../api'
import { pathApi, type AgentRecommendation } from '../api/path'
import { recommendApi, type Recommendation } from '../api/recommend'
import { useTheme } from '../store/theme'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircleIcon, EditIcon, BotIcon, ZapIcon, LightbulbIcon,
  AlertTriangleIcon, BookIcon, StarIcon,
  TargetIcon, BookOpenIcon,
  MessageCircleIcon, ClockIcon, TrendingUpIcon,
  AwardIcon,
} from '../components/Icons'

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — unified light/dark palette
   ═══════════════════════════════════════════════════════════════ */
function useTokens() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    isDark,
    // Brand
    brand: '#1677E8',
    brandDark: '#0958D9',
    brandLight: isDark ? 'rgba(22,119,232,0.15)' : '#EFF6FF',
    brandGlow: isDark ? 'rgba(22,119,232,0.25)' : 'rgba(22,119,232,0.08)',
    // Background
    bgPage: isDark ? '#0F172A' : '#F7FAFF',
    bgCard: isDark ? '#1E293B' : '#FFFFFF',
    bgCardAlt: isDark ? '#172033' : '#F8FAFE',
    bgGlass: isDark ? 'rgba(30,41,59,0.75)' : 'rgba(255,255,255,0.75)',
    // Text
    textPrimary: isDark ? '#E2E8F0' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    textMuted: isDark ? '#64748B' : '#94A3B8',
    // Border
    border: isDark ? '#334155' : '#E5EDF7',
    borderLight: isDark ? '#1E3348' : '#E8F0FB',
    // Shadow
    shadowSm: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
    shadowMd: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.06)',
    shadowLg: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.08)',
    shadowGlow: isDark ? '0 0 20px rgba(22,119,232,0.2)' : '0 0 20px rgba(22,119,232,0.1)',
    // Card accent colors (TASK 2.5 — 4专属配色)
    cardBlue: isDark ? '#1E3A5F' : '#EFF6FF',
    cardTeal: isDark ? '#134E4A' : '#F0FDFA',
    cardPurple: isDark ? '#2D1B69' : '#F5F3FF',
    cardOrange: isDark ? '#4A2C0A' : '#FFF7ED',
    cardBlueIcon: '#3B82F6',
    cardTealIcon: '#14B8A6',
    cardPurpleIcon: '#8B5CF6',
    cardOrangeIcon: '#F97316',
    // Semantic
    dangerBg: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    dangerBorder: isDark ? 'rgba(239,68,68,0.25)' : '#FECACA',
    dangerText: isDark ? '#FCA5A5' : '#DC2626',
    warningBg: isDark ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
    warningBorder: isDark ? 'rgba(217,119,6,0.25)' : '#FDE68A',
    warningText: isDark ? '#FCD34D' : '#92400E',
    successBg: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5',
  }
}

/* ────────────────────────────────────────────────────────────
   CountUp Animation Component (unchanged business logic)
   ──────────────────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────────────────
   Mini SVG Charts — TASK 2.1 迷你可视化微型图表
   ──────────────────────────────────────────────────────────── */
function RingProgress({ percent, color, size = 40, strokeWidth = 4 }: { percent: number; color: string; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (percent / 100) * circumference
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={strokeWidth} opacity={0.12} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  )
}

function MiniSparkLine({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const w = 60, h = 24, pad = 2
  const max = Math.max(...data, 1)
  const points = data.map((v, i) =>
    `${pad + (i / (data.length - 1)) * (w - pad * 2)},${h - pad - (v / max) * (h - pad * 2)}`
  ).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient>
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────
   Background Decor — enhanced with dark mode support
   ──────────────────────────────────────────────────────────── */
function HomeBackground({ isDark }: { isDark: boolean }) {
  const c = isDark ? 'rgba(56,189,248,0.04)' : 'rgba(2,132,199,0.02)'
  const c2 = isDark ? 'rgba(56,189,248,0.06)' : 'rgba(2,132,199,0.06)'
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
      background: isDark
        ? 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(56,189,248,0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139,92,246,0.05), transparent 60%), #0F172A'
        : 'linear-gradient(165deg, #F0F9FF 0%, #E0F2FE 20%, #BAE6FD 40%, #E0F2FE 60%, #F0F9FF 80%, #EFF6FF 100%)',
    }}>
      {/* Floating decor elements */}
      <div style={{
        position: 'absolute', top: '8%', right: '12%', width: 48, height: 48,
        borderRadius: 14, background: c2, transform: 'rotate(25deg)',
        animation: 'hmFloat1 10s ease infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', left: '8%', width: 36, height: 36,
        borderRadius: '50%', background: c, animation: 'hmFloat2 12s ease infinite 1s',
      }} />
      <div style={{
        position: 'absolute', top: '35%', left: '4%', width: 56, height: 56,
        borderRadius: 18, background: c, transform: 'rotate(-20deg)',
        animation: 'hmFloat1 14s ease infinite 2s',
      }} />
      <div style={{
        position: 'absolute', bottom: '25%', right: '6%', width: 40, height: 40,
        borderRadius: 10, background: c, transform: 'rotate(35deg)',
        animation: 'hmFloat2 9s ease infinite 0.5s',
      }} />
      {/* Subtle grid pattern — TASK 5.2 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: isDark
          ? 'radial-gradient(circle, rgba(148,163,184,0.06) 1px, transparent 1px)'
          : 'radial-gradient(circle, rgba(2,132,199,0.04) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Inline SVG Icons
   ──────────────────────────────────────────────────────────── */
const FireIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 23c5.523 0 10-4.477 10-10 0-4.478-2.078-7.742-4.164-10.084C16.394 1.328 14.373 0 12 0 9.627 0 7.606 1.328 6.164 2.916 4.078 5.258 2 8.522 2 13c0 5.523 4.477 10 10 10z" fill="#F97316" />
    <path d="M12 21a1 1 0 0 0 1-1c0-2-1.5-3.5-2.5-4.5S9 14 9 12c0-1 1-2 3-2-1 1.5-.5 3 .5 4.5S15 17 15 19a3 3 0 0 1-3 3z" fill="white" />
  </svg>
)

function IconPractice({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function IconTargetCrosshair({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function IconPlayVideo({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" fill={color} stroke="none" />
    </svg>
  )
}

const initialStats = { total_study_days: 0, current_streak: 0, longest_streak: 0, today_questions: 0, today_minutes: 0, total_questions: 0, average_mastery: 0, total_minutes: 0 }

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const t = useTokens()
  const { isAuthenticated } = useAuthStore()
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

  // Simulated trend data (derived from real stats for visual enhancement)
  const totalQ = studyStats.total_questions || 0
  const totalDays = studyStats.total_study_days || 0
  const mastery = studyStats.average_mastery || 0
  const todayQ = studyStats.today_questions || 0
  const todayMin = studyStats.today_minutes || 0
  const accuracyRate: number | null = null

  // Card config with trends (TASK 2.2)
  const statCards = [
    {
      label: '已掌握进度', icon: <CheckCircleIcon size={18} color={t.cardBlueIcon} />,
      value: mastery, suffix: '%', color: t.cardBlueIcon,
      bg: t.cardBlue, trend: null, trendUp: true,
      ringPercent: mastery || 0,
    },
    {
      label: '累计练习', icon: <EditIcon size={18} color={t.cardTealIcon} />,
      value: totalQ, suffix: '', color: t.cardTealIcon,
      bg: t.cardTeal, trend: todayQ > 0 ? `今日新增${todayQ}次` : null, trendUp: true,
      ringPercent: totalQ > 0 ? Math.min(100, Math.round((totalQ / 50) * 100)) : 0,
    },
    {
      label: '进行中学习', icon: <BookIcon size={18} color={t.cardPurpleIcon} />,
      value: summary.learning || 0, suffix: '', color: t.cardPurpleIcon,
      bg: t.cardPurple, trend: (summary.learning || 0) > 0 ? '学习中' : null, trendUp: true,
      ringPercent: (summary.learning || 0) > 0 ? 50 : 0,
    },
    {
      label: '学习天数', icon: <FireIcon />,
      value: totalDays, suffix: '天', color: t.cardOrangeIcon,
      bg: t.cardOrange, trend: totalDays > 1 ? `最长连续${studyStats.longest_streak || totalDays}天` : null, trendUp: true,
      ringPercent: totalDays > 0 ? Math.min(100, Math.round((totalDays / 30) * 100)) : 0,
    },
  ]

  /* ── Render ── */
  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Inter', sans-serif",
      color: t.textPrimary,
      background: t.bgPage,
    }}>
      {/* ─── Global Styles & Animations ─── */}
      <style>{`
        /* ── Keyframes ── */
        @keyframes hmFloat1 {
          0%, 100% { transform: translateY(0) rotate(25deg); opacity: 0.4; }
          50% { transform: translateY(-20px) rotate(30deg); opacity: 0.7; }
        }
        @keyframes hmFloat2 {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.05); opacity: 0.6; }
        }
        @keyframes hmFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes hmSlideInRight {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes hmPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes hmShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes hmRingFill {
          from { stroke-dashoffset: var(--ring-circ); }
          to { stroke-dashoffset: var(--ring-offset); }
        }
        /* Cards animation classes */
        .hm-card { opacity: 0; animation: hmFadeUp 0.5s ease forwards; }
        .hm-card:nth-child(1) { animation-delay: 0.05s; }
        .hm-card:nth-child(2) { animation-delay: 0.12s; }
        .hm-card:nth-child(3) { animation-delay: 0.19s; }
        .hm-card:nth-child(4) { animation-delay: 0.26s; }
        /* Hover effects */
        .hm-hover-lift {
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1),
                      box-shadow 0.25s cubic-bezier(0.4,0,0.2,1),
                      border-color 0.25s ease !important;
        }
        .hm-hover-lift:hover {
          transform: translateY(-2px) !important;
        }
        .hm-qck-btn {
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1) !important;
          cursor: pointer;
        }
        .hm-qck-btn:hover {
          transform: translateY(-3px) !important;
        }
        .hm-qck-btn:active {
          transform: scale(0.97) !important;
        }
        /* Nav active indicator — TASK 3.1 */
        .hm-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        /* Skeleton shimmer */
        .hm-skeleton {
          background: linear-gradient(90deg, ${t.isDark ? '#1E293B' : '#E5EDF7'} 25%, ${t.isDark ? '#334155' : '#F1F5F9'} 50%, ${t.isDark ? '#1E293B' : '#E5EDF7'} 75%);
          background-size: 200% 100%;
          animation: hmShimmer 2s ease infinite;
          border-radius: 8px;
        }
        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.isDark ? '#334155' : '#CBD5E1'}; border-radius: 3px; }
      `}</style>

      <HomeBackground isDark={t.isDark} />

      {isAuthenticated ? (
        <main style={{
          position: 'relative', zIndex: 1,
          maxWidth: 1200, margin: '0 auto',
          padding: '0 28px 32px',
        }}>
          {/* ════════════════════════════════════════════════════════
              SECTION ① — 4 Stat Cards (TASK 2: fully enhanced)
              ════════════════════════════════════════════════════════ */}
          <section style={{
            marginTop: 16, marginBottom: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}>
            {statCards.map((card, i) => (
              <div key={card.label} className="hm-card hm-hover-lift" style={{
                background: t.bgCard,
                borderRadius: 16,
                border: `1px solid ${t.border}`,
                boxShadow: t.shadowSm,
                padding: '20px 20px 18px',
                display: 'flex', flexDirection: 'column', gap: 12,
                position: 'relative', overflow: 'hidden',
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = t.shadowMd
                  e.currentTarget.style.borderColor = card.color + '40'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = t.shadowSm
                  e.currentTarget.style.borderColor = t.border
                }}
              >
                {/* Subtle gradient top bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${card.color}, ${card.color}88)`,
                  borderTopLeftRadius: 16, borderTopRightRadius: 16,
                }} />
                {/* Top row: icon + label */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: card.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {card.icon}
                    </div>
                    <span style={{
                      fontSize: '0.78rem', color: t.textSecondary, fontWeight: 500,
                    }}>
                      {card.label}
                    </span>
                  </div>
                  {/* Mini ring chart (TASK 2.1) */}
                  <RingProgress percent={card.ringPercent} color={card.color} size={40} strokeWidth={4} />
                </div>
                {/* Value + suffix */}
                <div style={{
                  fontSize: '1.8rem', fontWeight: 700, color: t.textPrimary,
                  lineHeight: 1.1, letterSpacing: '-0.02em',
                }}>
                  <CountUp value={card.value} suffix={card.suffix} />
                </div>
                {/* Trend label (TASK 2.2) */}
                {card.trend && (
                  <div style={{
                    fontSize: '0.7rem', color: card.trendUp ? '#10B981' : t.textMuted,
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: card.trendUp ? 'rgba(16,185,129,0.08)' : t.isDark ? 'rgba(148,163,184,0.1)' : '#F1F5F9',
                    padding: '2px 8px', borderRadius: 12, alignSelf: 'flex-start',
                  }}>
                    {card.trendUp && <TrendingUpIcon size={10} color="#10B981" />}
                    {card.trend}
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* ════════════════════════════════════════════════════════
              SECTION ② — Left/Right Split (58/42) grid
              ════════════════════════════════════════════════════════ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 24,
            alignItems: 'start',
          }}>

            {/* ── LEFT COLUMN: Today's Learning Suggestions (TASK 3) ── */}
            <div className="hm-card" style={{ animationDelay: '0.32s' }}>
              <div style={{
                background: t.bgCard,
                borderRadius: 16,
                border: `1px solid ${t.border}`,
                boxShadow: t.shadowSm,
                padding: '28px 28px 32px',
                minHeight: 400,
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 20, paddingBottom: 16,
                  borderBottom: `1px solid ${t.border}`,
                }}>
                  <div className="hm-section-title">
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: t.brandLight, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BotIcon size={18} color={t.brand} />
                    </div>
                    <div>
                      <h3 style={{
                        fontSize: '1rem', fontWeight: 600, color: t.textPrimary,
                        margin: 0,
                      }}>
                        今日学习建议
                      </h3>
                      {/* TASK 3.1: 标题辅助信息 */}
                      <span style={{
                        fontSize: '0.7rem', color: t.textMuted,
                      }}>
                        优先级 · 剩余 {Math.max(0, 3 - todayRecs.length - personRecs.length)} 项待处理
                      </span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.72rem', color: t.textMuted,
                    background: t.isDark ? 'rgba(148,163,184,0.1)' : '#F1F5F9',
                    padding: '4px 10px', borderRadius: 8,
                  }}>
                    {todayRecs.length + personRecs.length > 0
                      ? `${todayRecs.length + personRecs.length} 项建议`
                      : '暂无建议'}
                  </div>
                </div>

                {/* Content area */}
                {todayRecs.length === 0 && personRecs.length === 0 ? (
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    padding: '20px 10px', color: t.textMuted, alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: 20,
                      background: t.brandLight, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: 0.5, marginBottom: 16,
                    }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.brand} strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 500, color: t.textMuted, marginBottom: 6 }}>
                      暂无学习建议
                    </div>
                    <div style={{
                      fontSize: '0.8rem', color: t.isDark ? '#64748B' : '#B0B7C3',
                      lineHeight: 1.6, marginBottom: 16, textAlign: 'center',
                    }}>
                      AI 正在分析你的学习数据<br />
                      完成练习后将生成个性化建议
                    </div>
                    <Link to="/banks" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 28px', borderRadius: 8,
                      background: t.brand, color: '#fff',
                      fontSize: '0.85rem', fontWeight: 500,
                      textDecoration: 'none',
                      border: 'none', cursor: 'pointer',
                    }}>
                      开始练习
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                      {/* TASK 3.2: Enhanced recommendation items */}
                      {todayRecs.map((rec, i) => (
                        <Link key={`agent-${i}`} to="/path" style={{
                          textDecoration: 'none', color: 'inherit',
                          padding: '16px 20px', borderRadius: 12,
                          background: t.dangerBg,
                          border: `1px solid ${t.dangerBorder}`,
                          borderLeft: `4px solid #EF4444`,
                          transition: 'all 0.2s ease', display: 'flex',
                          alignItems: 'flex-start', gap: 14,
                          position: 'relative', overflow: 'hidden',
                        }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateX(4px)'
                            e.currentTarget.style.boxShadow = t.shadowMd
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = ''
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          {/* Status icon (TASK 3.2 ①) */}
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'rgba(239,68,68,0.12)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0,
                            marginTop: 1,
                          }}>
                            <AlertTriangleIcon size={14} color="#EF4444" />
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.85rem', fontWeight: 600, color: t.textPrimary,
                              marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                              {rec.title}
                              <span style={{
                                fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                                background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                                fontWeight: 500, whiteSpace: 'nowrap',
                              }}>
                                需重点攻克
                              </span>
                            </div>
                            <div style={{
                              fontSize: '0.75rem', color: t.textSecondary, lineHeight: 1.5,
                              marginBottom: 8,
                            }}>
                              {rec.description}
                            </div>
                            {/* Progress bar (TASK 3.2 ②) */}
                            <div style={{
                              height: 4, borderRadius: 2, background: t.isDark ? '#334155' : '#F1F5F9',
                              overflow: 'hidden', marginBottom: 8,
                            }}>
                              <div style={{
                                height: '100%', width: '0%', borderRadius: 2,
                                background: 'linear-gradient(90deg, #EF4444, #F97316)',
                                transition: 'width 1.5s ease',
                              }} ref={el => {
                                if (el) setTimeout(() => { el.style.width = '0%' }, 100)
                              }} />
                            </div>
                            {/* Quick action buttons (TASK 3.2 ③) */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.7rem', color: t.brand, cursor: 'pointer',
                                padding: '3px 10px', borderRadius: 6,
                                background: t.brandLight, fontWeight: 500,
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}
                                onClick={(e) => { e.preventDefault(); window.location.href = '/banks' }}
                              >
                                <IconPractice size={11} color={t.brand} /> 立即刷题
                              </span>
                              <span style={{
                                fontSize: '0.7rem', color: t.textSecondary, cursor: 'pointer',
                                padding: '3px 10px', borderRadius: 6,
                                background: t.isDark ? '#334155' : '#F1F5F9', fontWeight: 500,
                              }}
                                onClick={(e) => { e.preventDefault(); window.location.href = '/knowledge-points' }}
                              >
                                查看知识点
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {/* Person recs (blue style) */}
                      {personRecs.slice(0, 2).map((rec, i) => (
                        <Link key={`person-${i}`} to="/path" style={{
                          textDecoration: 'none', color: 'inherit',
                          padding: '16px 20px', borderRadius: 12,
                          background: t.brandLight,
                          border: `1px solid ${t.isDark ? 'rgba(22,119,232,0.25)' : '#BFDBFE'}`,
                          borderLeft: `4px solid ${t.brand}`,
                          transition: 'all 0.2s ease', display: 'flex',
                          alignItems: 'flex-start', gap: 14,
                        }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateX(4px)'
                            e.currentTarget.style.boxShadow = t.shadowMd
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = ''
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: t.isDark ? 'rgba(22,119,232,0.2)' : 'rgba(22,119,232,0.1)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0,
                            marginTop: 1,
                          }}>
                            <TargetIcon size={14} color={t.brand} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.85rem', fontWeight: 600, color: t.textPrimary,
                              marginBottom: 4,
                            }}>
                              {rec.title}
                            </div>
                            <div style={{
                              fontSize: '0.75rem', color: t.textSecondary, lineHeight: 1.5,
                              marginBottom: 8,
                            }}>
                              {rec.reason}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <span style={{
                                fontSize: '0.7rem', color: t.brand, cursor: 'pointer',
                                padding: '3px 10px', borderRadius: 6,
                                background: t.isDark ? 'rgba(22,119,232,0.2)' : '#DBEAFE',
                                fontWeight: 500,
                              }}
                                onClick={(e) => { e.preventDefault(); window.location.href = '/path' }}
                              >
                                查看路径
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>

                  </>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* ── Quick Start 4-grid (TASK 4) ── */}
              <div className="hm-card" style={{ animationDelay: '0.4s' }}>
                <div style={{
                  background: t.bgCard,
                  borderRadius: 16,
                  border: `1px solid ${t.border}`,
                  boxShadow: t.shadowSm,
                  padding: '24px 22px 26px',
                }}>
                  <h3 style={{
                    fontSize: '0.92rem', fontWeight: 600,
                    margin: '0 0 16px', color: t.textPrimary,
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <ZapIcon size={15} color={t.brand} /> 快速开始
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: '开始练习', desc: '随机组卷 / 专项刷题', tag: '推荐', tagColor: '#EF4444',
                        to: '/banks', icon: <EditIcon size={22} color="#3B82F6" />,
                        gradient: t.isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))' : 'linear-gradient(135deg, #EFF6FF, #F8FAFE)',
                        borderColor: t.isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.12)',
                      },
                      { label: 'AI 对话', desc: '一对一答疑 · 思路讲解', tag: 'AI实时', tagColor: '#8B5CF6',
                        to: '/chat/new', icon: <MessageCircleIcon size={22} color="#8B5CF6" />,
                        gradient: t.isDark ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))' : 'linear-gradient(135deg, #F5F3FF, #FAFAFE)',
                        borderColor: t.isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.12)',
                      },
                      { label: '学习规划', desc: '生成 7 天专属路线', tag: '个性化', tagColor: '#14B8A6',
                        to: '/path', icon: <TargetIcon size={22} color="#14B8A6" />,
                        gradient: t.isDark ? 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(20,184,166,0.04))' : 'linear-gradient(135deg, #F0FDFA, #F8FAFE)',
                        borderColor: t.isDark ? 'rgba(20,184,166,0.25)' : 'rgba(20,184,166,0.12)',
                      },
                      { label: '资源推荐', desc: '课件 · 习题 · 视频', tag: '更新中', tagColor: '#F97316',
                        to: '/recommendations', icon: <StarIcon size={22} color="#F97316" />,
                        gradient: t.isDark ? 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))' : 'linear-gradient(135deg, #FFF7ED, #F8FAFE)',
                        borderColor: t.isDark ? 'rgba(249,115,22,0.25)' : 'rgba(249,115,22,0.12)',
                      },
                    ].map((action, i) => (
                      <Link key={i} to={action.to} className="hm-qck-btn"
                        style={{
                          textDecoration: 'none', padding: '18px 14px',
                          borderRadius: 12, display: 'flex',
                          flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                          background: action.gradient,
                          border: `1px solid ${action.borderColor}`,
                          position: 'relative', overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = t.shadowMd
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        {/* Tag badge */}
                        <span style={{
                          position: 'absolute', top: 8, right: 8,
                          fontSize: '0.62rem', fontWeight: 600, color: '#fff',
                          background: action.tagColor, padding: '1px 7px', borderRadius: 6,
                          letterSpacing: '0.01em',
                        }}>
                          {action.tag}
                        </span>
                        {/* Icon */}
                        <div style={{ marginBottom: 2 }}>
                          {action.icon}
                        </div>
                        {/* Title */}
                        <div style={{
                          fontSize: '0.88rem', fontWeight: 600, color: t.textPrimary,
                        }}>
                          {action.label}
                        </div>
                        {/* Description (TASK 4.1) */}
                        <div style={{
                          fontSize: '0.7rem', color: t.textMuted, lineHeight: 1.4,
                        }}>
                          {action.desc}
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* TASK 4.2: Mini dashboard below the 4-grid */}
                  <div style={{
                    marginTop: 16, display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
                  }}>
                    {[
                      { label: '今日学习时长', value: `${todayMin || 0}`, unit: '分钟', icon: <ClockIcon size={14} color="#3B82F6" />, color: '#3B82F6' },
                      { label: '今日做题数量', value: `${todayQ || 0}`, unit: '题', icon: <EditIcon size={14} color="#8B5CF6" />, color: '#8B5CF6' },
                      { label: '今日正确率', value: accuracyRate === null ? '--' : `${accuracyRate}`, unit: accuracyRate === null ? '' : '%', icon: <AwardIcon size={14} color="#14B8A6" />, color: '#14B8A6' },
                    ].map((item, i) => (
                      <div key={i} style={{
                        background: t.isDark ? 'rgba(148,163,184,0.05)' : '#F8FAFE',
                        borderRadius: 10, padding: '12px 10px', textAlign: 'center',
                        border: `1px solid ${t.border}`,
                      }}>
                        <div style={{
                          fontSize: '0.62rem', color: t.textMuted, marginBottom: 4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                          {item.icon} {item.label}
                        </div>
                        <div style={{
                          fontSize: '1.1rem', fontWeight: 700, color: item.color,
                          lineHeight: 1.2,
                        }}>
                          {item.value}
                          <span style={{ fontSize: '0.65rem', fontWeight: 500, color: t.textMuted }}>
                            {item.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Learning Tips (TASK 5: enhanced yellow card) ── */}
              <div className="hm-card" style={{ animationDelay: '0.48s' }}>
                <div style={{
                  borderRadius: 16, padding: '24px 22px 26px',
                  background: t.warningBg,
                  border: `1px solid ${t.warningBorder}`,
                  boxShadow: t.isDark
                    ? 'inset 0 2px 4px rgba(251,191,36,0.04), 0 1px 3px rgba(0,0,0,0.15)'
                    : 'inset 0 2px 4px rgba(251,191,36,0.06), 0 1px 3px rgba(0,0,0,0.03)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {/* Decorative dots */}
                  <div style={{
                    position: 'absolute', left: '12%', top: 12, width: 6, height: 6,
                    borderRadius: '50%', background: '#FCD34D', opacity: 0.4, pointerEvents: 'none',
                    animation: 'hmFloat2 4s ease-in-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', right: '18%', bottom: 12, width: 5, height: 5,
                    borderRadius: '50%', background: '#F59E0B', opacity: 0.3, pointerEvents: 'none',
                    animation: 'hmFloat1 5s ease-in-out infinite 1s',
                  }} />
                  {/* Fold corner */}
                  <div style={{
                    position: 'absolute', right: 0, top: 0,
                    width: 0, height: 0,
                    borderRight: '22px solid #FDE68A',
                    borderTop: '22px solid #FDE68A',
                    borderLeft: '22px solid transparent',
                    borderBottom: '22px solid transparent',
                    opacity: 0.35, pointerEvents: 'none',
                  }} />

                  <h3 style={{
                    fontSize: '0.88rem', fontWeight: 600,
                    margin: '0 0 14px', color: t.warningText,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <LightbulbIcon size={15} color="#D97706" /> 学习小贴士
                  </h3>

                  {/* TASK 5.1: split text with timeline icons */}
                  <div style={{
                    fontSize: '0.8rem', color: t.warningText, lineHeight: 1.9,
                    opacity: 0.9,
                  }}>
                    {/* Ebbinghaus content with mini timeline */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{
                        fontWeight: 600, marginBottom: 4, fontSize: '0.82rem',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <ClockIcon size={13} color="#D97706" /> 艾宾浩斯遗忘曲线
                      </div>
                      <div style={{ paddingLeft: 4 }}>
                        学完新知识后，在 <strong style={{ color: t.isDark ? '#FBBF24' : '#B45309' }}>1天、2天、4天、7天</strong> 后分别复习一次，能有效提升长期记忆效果。
                      </div>
                      {/* Mini timeline visual */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                        paddingLeft: 4,
                      }}>
                        {[
                          { day: '1天', color: '#EF4444' },
                          { day: '2天', color: '#F97316' },
                          { day: '4天', color: '#F59E0B' },
                          { day: '7天', color: '#10B981' },
                        ].map((step, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: step.color + '20', border: `2px solid ${step.color}40`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.6rem', fontWeight: 700, color: step.color,
                            }}>
                              {i + 1}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: t.warningText, opacity: 0.8 }}>
                              {step.day}
                            </span>
                            {i < 3 && (
                              <div style={{
                                width: 16, height: 1,
                                background: t.isDark ? '#78350F' : '#FDE68A',
                              }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weak knowledge reminder (TASK 5.2: red badge) */}
                    {totalDifficult > 0 && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(220,38,38,0.08)',
                        border: '1px solid rgba(220,38,38,0.15)',
                        fontWeight: 500, fontSize: '0.78rem', color: '#DC2626',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: '#DC2626', color: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          !
                        </span>
                        <span>
                          <AlertTriangleIcon size={12} color="#DC2626" style={{ marginRight: 4 }} />
                          你有 <strong>{totalDifficult}</strong> 个薄弱知识点，建议优先攻克。
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Profile Init (conditional) ── */}
              {!isChecking && !hasProfile && (
                <div className="hm-card" style={{ animationDelay: '0.56s' }}>
                  <div style={{
                    borderRadius: 16, padding: '22px 20px', textAlign: 'center',
                    background: t.bgCard,
                    border: `1px solid ${t.border}`,
                    boxShadow: t.shadowSm,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: t.brandLight, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', margin: '0 auto 12px',
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <p style={{
                      fontSize: '0.85rem', color: t.brand, margin: '0 0 16px', fontWeight: 500,
                    }}>
                      初始化你的学习画像，获得更精准的学习建议
                    </p>
                    <Link to="/profile/init" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 28px', borderRadius: 8,
                      background: t.brand, color: '#fff',
                      fontSize: '0.85rem', fontWeight: 500,
                      textDecoration: 'none',
                      transition: 'background 0.2s ease',
                    }}>
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

          {/* ════════════════════════════════════════════════════════
              SECTION ③ — Learning Activity Timeline (TASK 6.1)
              ════════════════════════════════════════════════════════ */}
          <section className="hm-card" style={{
            animationDelay: '0.6s', marginTop: 24,
            background: t.bgCard,
            borderRadius: 16,
            border: `1px solid ${t.border}`,
            boxShadow: t.shadowSm,
            padding: '24px 28px',
          }}>
            <h3 style={{
              fontSize: '0.92rem', fontWeight: 600, color: t.textPrimary,
              margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <ClockIcon size={15} color={t.brand} /> 学习动态
            </h3>
            <div style={{
              padding: '18px 16px',
              borderRadius: 10,
              background: t.isDark ? 'rgba(148,163,184,0.04)' : '#F8FAFE',
              border: `1px solid ${t.border}`,
              color: t.textSecondary,
              fontSize: '0.8rem',
            }}>
              暂无可展示的真实学习动态。完成练习、答疑或资源学习后，这里会显示实际记录。
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              SECTION ④ — Footer
              ════════════════════════════════════════════════════════ */}
          <footer style={{
            textAlign: 'center', padding: '32px 0 8px',
            fontSize: '0.75rem', color: t.textMuted,
            borderTop: `1px solid ${t.border}`,
            marginTop: 32,
          }}>
            © {new Date().getFullYear()} Education Agent · 让AI理解你的学习，为每个人因材施教
          </footer>
        </main>
      ) : (
        <div style={{
          position: 'relative', zIndex: 1,
          flex: 1, padding: '40px 32px',
          color: t.textMuted, fontSize: '0.875rem',
        }}>
          <p>请先登录</p>
        </div>
      )}
    </div>
  )
}
