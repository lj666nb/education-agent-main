import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { reviewApi, type DueKnowledgePoint, type DailyTrend, type WeakPoint } from '../api/review'
import { questionBankApi, type WrongAnswerItem } from '../api/questionBank'

/* ────────────────────────────────────────────
   Inline SVG Icons
   ──────────────────────────────────────────── */
function BrainIcon({ size = 20 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V12a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9.5C7.8 8.8 7 7.5 7 6a4 4 0 0 1 4-4z"/>
    <path d="M12 22c-4 0-6-2-6-6 0-1.5.8-2.8 2-3.5V14a4 4 0 0 0 8 0v-1.5c1.2.7 2 2 2 3.5 0 4-2 6-6 6z"/>
  </svg>
)}
function BookIcon({ size = 20 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)}
function ProgressIcon({ size = 20 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)}
function CheckIcon({ size = 16 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)}
function RefreshIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)}
function PracticeIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)}
function ResourceIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)}
function AIIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4v1.5l2.5-.5.5 2.5-2 .5c.3 1 .3 2 0 3l2 .5-.5 2.5-2.5-.5V18a4 4 0 0 1-8 0v-2.5l-2.5.5-.5-2.5 2-.5c-.3-1-.3-2 0-3l-2-.5.5-2.5L6 7.5V6a4 4 0 0 1 4-4z"/>
  </svg>
)}
function CalendarIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)}
function TargetIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
)}
function WrongIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
)}
function ChartIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)}
function StarIcon({ size = 16, filled = false }: { size?: number; filled?: boolean }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)}
function CelebrationIcon({ size = 48 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/>
  </svg>
)}
function ChevronDownIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)}
function ChevronRightIcon({ size = 14 }: { size?: number }) { return (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)}

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */
const masteryColor = (score: number): string => {
  if (score >= 80) return 'var(--app-success)'
  if (score >= 50) return 'var(--app-warning)'
  return 'var(--app-danger)'
}

/** Normalize correct_answer to always be a string[] (DB may store as string or array) */
const normalizeAnswer = (raw: string | string[] | undefined): string[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(a => String(a).trim().toLowerCase())
  return [String(raw).trim().toLowerCase()]
}

const CHINA_DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

type ReviewTab = 'today' | '3days' | '7days'
type UrgencyFilter = 'all' | 'overdue' | 'soon' | 'later'

interface CalendarDay {
  date: Date
  key: string
  dueCount: number
  wrongCount: number
  isToday: boolean
  hasOverdue: boolean
}

export default function ReviewCenterPage() {
  const navigate = useNavigate()

  /* ── State ── */
  const [duePoints, setDuePoints] = useState<DueKnowledgePoint[]>([])
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0)
  const [todayProgress, setTodayProgress] = useState({ reviewed: 0, total_due: 0 })
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerItem[]>([])
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([])
  const [trends, setTrends] = useState<DailyTrend[]>([])
  const [trendsTotal, setTrendsTotal] = useState(0)
  const [trendsAvgMastery, setTrendsAvgMastery] = useState(0)

  const [loading, setLoading] = useState(true)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [showCelebration, setShowCelebration] = useState(false)
  const [showOverdueModal, setShowOverdueModal] = useState(false)
  const [showTrends, setShowTrends] = useState(false)

  // Filters
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [wrongTab, setWrongTab] = useState<ReviewTab>('today')
  const [knowledgeFilter, setKnowledgeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'knowledge' | 'wrong'>('all')
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all')

  // Practice popup state
  const [practiceItem, setPracticeItem] = useState<WrongAnswerItem | null>(null)
  const [practiceAnswers, setPracticeAnswers] = useState<Set<string>>(new Set())
  const [practiceSubmitted, setPracticeSubmitted] = useState(false)
  const [practiceCorrect, setPracticeCorrect] = useState<boolean | null>(null)

  /* ── Data fetching ── */
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await reviewApi.getDashboard()
      setDuePoints(res.data.due_points)
      setWrongAnswerCount(res.data.wrong_answer_count)
      setTodayProgress(res.data.today_progress)
    } catch (err: any) {
      console.error('加载复习数据失败:', err)
    }
  }, [])

  const fetchWrongAnswers = useCallback(async () => {
    try {
      const res = await questionBankApi.listWrongAnswers({ page: 1, page_size: 50 })
      setWrongAnswers(res.data.items || [])
    } catch { /* silent */ }
  }, [])

  const fetchWeakPoints = useCallback(async () => {
    try {
      const res = await reviewApi.getWeakPoints(30)
      setWeakPoints(res.data.weak_points || [])
    } catch { /* silent */ }
  }, [])

  const fetchTrends = useCallback(async () => {
    try {
      const res = await reviewApi.getTrends(30)
      setTrends(res.data.daily || [])
      setTrendsTotal(res.data.total_reviews)
      setTrendsAvgMastery(res.data.avg_mastery)
    } catch { /* silent */ }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchDashboard(), fetchWrongAnswers(), fetchWeakPoints(), fetchTrends()])
    setLoading(false)
  }, [fetchDashboard, fetchWrongAnswers, fetchWeakPoints, fetchTrends])

  useEffect(() => { loadAll() }, [])

  /* ── 30-min auto refresh ── */
  useEffect(() => {
    const timer = setInterval(() => { fetchDashboard(); fetchWrongAnswers() }, 1800000)
    return () => clearInterval(timer)
  }, [fetchDashboard, fetchWrongAnswers])

  /* ── Overdue reminder modal ── */
  useEffect(() => {
    const hasOverdue = duePoints.some(p => p.review_label.includes('逾期'))
    if (hasOverdue && !showOverdueModal) {
      const dismissed = sessionStorage.getItem('review_overdue_dismissed')
      if (!dismissed) setShowOverdueModal(true)
    }
  }, [duePoints, showOverdueModal])

  /* ── Celebration check ── */
  useEffect(() => {
    if (todayProgress.total_due > 0 && todayProgress.reviewed >= todayProgress.total_due && !showCelebration) {
      const celebrated = sessionStorage.getItem('review_celebrated_today')
      const today = new Date().toDateString()
      if (celebrated !== today) {
        setShowCelebration(true)
        sessionStorage.setItem('review_celebrated_today', today)
      }
    }
  }, [todayProgress, showCelebration])

  /* ── Actions ── */
  const handleMarkComplete = async (point: DueKnowledgePoint) => {
    if (!point.point_id || completingIds.has(point.point_id)) return
    setCompletingIds(prev => new Set(prev).add(point.point_id!))
    try {
      await reviewApi.markComplete(point.point_id)
      setDuePoints(prev => prev.filter(p => p.point_id !== point.point_id))
      setTodayProgress(prev => ({ ...prev, reviewed: prev.reviewed + 1 }))
      setMessage(`「${point.point_name}」已标记为已复习`)
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('标记失败，请重试')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setCompletingIds(prev => { const next = new Set(prev); next.delete(point.point_id!); return next })
    }
  }

  const handlePractice = (point: { point_name?: string }) => {
    navigate(point.point_name ? `/banks?search=${encodeURIComponent(point.point_name)}` : '/banks')
  }

  const handleViewResources = (point: { point_name?: string }) => {
    navigate(point.point_name ? `/resources?search=${encodeURIComponent(point.point_name)}` : '/resources')
  }

  const handleGoKnowledgePoint = (pointId: string | null) => {
    if (pointId) navigate(`/knowledge-points?pointId=${pointId}`)
    else navigate('/knowledge-points')
  }

  const handleAIReview = (pointName?: string) => {
    if (pointName) navigate(`/chat/new?prompt=${encodeURIComponent(`请帮我复习讲解：${pointName}`)}`)
    else navigate('/chat/new')
  }

  const handleBatchReviewWrong = () => {
    navigate('/banks?mode=practice&source=wrong')
  }

  /* ── Computed values ── */
  const now = new Date()

  const overduePoints = useMemo(() =>
    duePoints.filter(p => p.review_label.includes('逾期')),
  [duePoints])

  const soonPoints = useMemo(() =>
    duePoints.filter(p => !p.review_label.includes('逾期') && (p.review_label.includes('小时') || p.review_label === '今天')),
  [duePoints])

  const laterPoints = useMemo(() =>
    duePoints.filter(p => !p.review_label.includes('逾期') && p.review_label.includes('天')),
  [duePoints])

  // 错题按知识点分组
  const wrongByKnowledge = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {}
    wrongAnswers.forEach(w => {
      const kps = w.question?.knowledge_point_uuids || ['未分类']
      kps.forEach((kp: string) => {
        if (!map[kp]) map[kp] = { name: kp.length > 6 ? kp.slice(0, 6) + '…' : kp, count: 0 }
        map[kp].count++
      })
    })
    return Object.values(map).slice(0, 5)
  }, [wrongAnswers])

  // 7-day calendar
  const calendarDays = useMemo((): CalendarDay[] => {
    const days: CalendarDay[] = []
    const dueMap: Record<string, number> = {}
    duePoints.forEach(p => {
      if (p.next_review_at) {
        const d = new Date(p.next_review_at).toISOString().slice(0, 10)
        dueMap[d] = (dueMap[d] || 0) + 1
      }
    })
    const wrongMap: Record<string, number> = {}
    wrongAnswers.forEach(w => {
      if (w.last_wrong_at) {
        const d = new Date(w.last_wrong_at).toISOString().slice(0, 10)
        wrongMap[d] = (wrongMap[d] || 0) + 1
      }
    })

    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const dueCount = dueMap[key] || 0
      const wrongCount = wrongMap[key] || 0
      days.push({
        date: d,
        key,
        dueCount,
        wrongCount,
        isToday: i === 0,
        hasOverdue: i === 0 && dueCount > 0,
      })
    }
    return days
  }, [duePoints, wrongAnswers, now])

  // Filtered due points
  const filteredDuePoints = useMemo(() => {
    let pts = [...duePoints]
    if (selectedDate) {
      pts = pts.filter(p => p.next_review_at?.startsWith(selectedDate))
    }
    if (typeFilter === 'knowledge') pts = pts
    if (urgencyFilter === 'overdue') pts = overduePoints
    if (urgencyFilter === 'soon') pts = soonPoints
    if (urgencyFilter === 'later') pts = laterPoints
    return pts
  }, [duePoints, selectedDate, typeFilter, urgencyFilter, overduePoints, soonPoints, laterPoints])

  // 错题按时间分层
  const wrongTiered = useMemo(() => {
    const nowTs = now.getTime()
    const day1 = nowTs - 86400000
    const day3 = nowTs - 3 * 86400000
    const day7 = nowTs - 7 * 86400000
    return {
      today: wrongAnswers.filter(w => new Date(w.last_wrong_at).getTime() > day1),
      threeDays: wrongAnswers.filter(w => {
        const t = new Date(w.last_wrong_at).getTime()
        return t <= day1 && t > day3
      }),
      sevenDays: wrongAnswers.filter(w => {
        const t = new Date(w.last_wrong_at).getTime()
        return t <= day3 && t > day7
      }),
    }
  }, [wrongAnswers, now])

  const displayedWrong = wrongTab === 'today' ? wrongTiered.today : wrongTab === '3days' ? wrongTiered.threeDays : wrongTiered.sevenDays

  const progressPct = todayProgress.total_due > 0
    ? Math.round((todayProgress.reviewed / todayProgress.total_due) * 100)
    : 100

  const overdueCount = overduePoints.length

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div style={{ padding: 'var(--space-4) var(--space-8)', animation: 'reviewSlideUp 0.3s ease-out' }}>
        <div style={{ height: 28, width: 200, background: 'var(--gray-200)', borderRadius: 6, marginBottom: 'var(--space-6)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 140, background: 'var(--gray-100)', borderRadius: 12 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div style={{ height: 200, background: 'var(--gray-100)', borderRadius: 12 }} />
          <div style={{ height: 200, background: 'var(--gray-100)', borderRadius: 12 }} />
        </div>
        <div style={{ height: 160, background: 'var(--gray-100)', borderRadius: 12 }} />
      </div>
    )
  }

  /* ── Render ── */
  return (
    <div style={{ padding: 'var(--space-4) var(--space-8)', maxWidth: 1280, animation: 'reviewSlideUp 0.35s ease-out' }}>
      {/* ═══ Celebration Modal ═══ */}
      {showCelebration && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowCelebration(false)}>
          <div className="review-card" style={{
            padding: 'var(--space-8)', textAlign: 'center', maxWidth: 400, borderRadius: 20,
            animation: 'reviewSlideUp 0.4s ease-out',
          }} onClick={e => e.stopPropagation()}>
            <CelebrationIcon size={64} />
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--app-text-heading)', marginTop: 16 }}>🎉 太棒了！</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--app-text-secondary)', marginTop: 8 }}>
              今日全部复习任务已完成！已复习 {todayProgress.reviewed} 个知识点。
            </div>
            <button onClick={() => setShowCelebration(false)}
              className="btn btn-primary" style={{ marginTop: 20, border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
              继续加油 💪
            </button>
          </div>
        </div>
      )}

      {/* ═══ Overdue Reminder Modal ═══ */}
      {showOverdueModal && overdueCount > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
        }} onClick={() => { setShowOverdueModal(false); sessionStorage.setItem('review_overdue_dismissed', '1') }}>
          <div className="review-card" style={{
            padding: 'var(--space-6)', maxWidth: 420, borderRadius: 16,
            animation: 'reviewSlideUp 0.4s ease-out',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="review-stat-icon" style={{ background: '#FEF2F2', color: 'var(--app-danger)' }}>
                <WrongIcon size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--app-text-heading)' }}>到期复习提醒</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--app-text-secondary)' }}>
                  您有 <span style={{ color: 'var(--app-danger)', fontWeight: 700 }}>{overdueCount}</span> 个逾期未复习的知识点
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--app-text-secondary)', marginBottom: 16 }}>
              {overduePoints.slice(0, 3).map((p, i) => (
                <div key={i} style={{ padding: '4px 0' }}>• {p.point_name} — <span style={{ color: 'var(--app-danger)', fontWeight: 600 }}>{p.review_label}</span></div>
              ))}
              {overduePoints.length > 3 && <div style={{ color: 'var(--app-text-muted)' }}>...还有 {overduePoints.length - 3} 个</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                setShowOverdueModal(false)
                sessionStorage.setItem('review_overdue_dismissed', '1')
                window.scrollTo({ top: 300, behavior: 'smooth' })
              }}
                className="btn btn-primary" style={{ flex: 1, border: 'none', cursor: 'pointer' }}>
                立即复习
              </button>
              <button onClick={() => { setShowOverdueModal(false); sessionStorage.setItem('review_overdue_dismissed', '1') }}
                className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                延后提醒
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Header + Filter Bar ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)', margin: 0, color: 'var(--app-text-heading)' }}>📚 复习中心</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--app-text-muted)', background: 'var(--app-brand-bg)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            🔄 每30分钟自动刷新
          </span>
        </div>
        <div className="review-filter-bar">
          <select className="review-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
            <option value="all">全部类型</option>
            <option value="knowledge">知识点复习</option>
            <option value="wrong">错题复习</option>
          </select>
          <select className="review-filter-select" value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value as UrgencyFilter)}>
            <option value="all">全部紧急度</option>
            <option value="overdue">已逾期</option>
            <option value="soon">即将到期</option>
            <option value="later">远期复习</option>
          </select>
          {selectedDate && (
            <span style={{ fontSize: '0.78rem', color: 'var(--app-brand)', display: 'flex', alignItems: 'center', gap: 4 }}>
              📅 {selectedDate}
              <button onClick={() => setSelectedDate(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', fontSize: '1rem', lineHeight: 1 }}>×</button>
            </span>
          )}
          <button onClick={loadAll}
            className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem', cursor: 'pointer' }}>
            <RefreshIcon /> 刷新
          </button>
        </div>
      </div>

      {/* ═══ Message Toast ═══ */}
      {message && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 'var(--space-4)',
          background: message.includes('失败') ? 'var(--app-bg-danger)' : '#F0FDF4',
          color: message.includes('失败') ? 'var(--app-danger-dark)' : 'var(--app-green-dark)',
          fontSize: '0.82rem', animation: 'reviewSlideUp 0.25s ease-out',
        }}>{message}</div>
      )}

      {/* ══════════════════════════════════════════════════════
         Three Stat Cards
         ══════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* Card 1: 待复习知识点 */}
        <div className="review-card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div className="review-stat-icon" style={{ background: 'var(--app-brand-bg)', color: 'var(--app-brand)' }}>
              <BrainIcon />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)', marginBottom: 2 }}>待复习知识点</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: duePoints.length > 0 ? 'var(--app-danger)' : 'var(--app-success)', lineHeight: 1.2 }}>
                {duePoints.length}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                {overdueCount > 0 && (
                  <span className="review-badge" style={{ background: '#FEF2F2', color: 'var(--app-danger)' }} title="到期必复习">
                    🔴 到期 {overdueCount}
                  </span>
                )}
                {soonPoints.length > 0 && (
                  <span className="review-badge" style={{ background: '#FFFBEB', color: 'var(--app-amber-dark)' }} title="即将复习">
                    🟡 即将 {soonPoints.length}
                  </span>
                )}
                {laterPoints.length > 0 && (
                  <span className="review-badge" style={{ background: '#F0FDF4', color: 'var(--app-green-dark)' }} title="远期复习">
                    🟢 远期 {laterPoints.length}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Tooltip: hover show first few overdue items */}
          {overdueCount > 0 && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: '#FEF2F2', borderRadius: 8, fontSize: '0.72rem', color: 'var(--app-danger-dark)' }}>
              {overduePoints.slice(0, 3).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>{p.point_name}</span>
                  <span style={{ fontWeight: 600 }}>{p.review_label}</span>
                </div>
              ))}
              {overduePoints.length > 3 && <div style={{ color: 'var(--app-text-muted)' }}>...还有 {overduePoints.length - 3} 个</div>}
            </div>
          )}
          {duePoints.length === 0 && (
            <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--app-success)' }}>暂无待复习知识点 ✅</div>
          )}
        </div>

        {/* Card 2: 待复习错题 */}
        <div className="review-card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div className="review-stat-icon" style={{ background: '#FFFBEB', color: 'var(--app-amber-dark)' }}>
              <BookIcon />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)', marginBottom: 2 }}>待复习错题</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: wrongAnswerCount > 0 ? 'var(--app-amber-dark)' : 'var(--app-success)', lineHeight: 1.2 }}>
                {wrongAnswerCount}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                {wrongByKnowledge.map(kp => (
                  <span key={kp.name} className="review-badge" style={{ background: 'var(--gray-100)', color: 'var(--app-text-secondary)' }}
                    title={`${kp.name}: ${kp.count}题`}>
                    {kp.name.length > 6 ? kp.name.slice(0, 6) + '…' : kp.name} {kp.count}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {wrongAnswerCount > 0 && (
            <button onClick={() => navigate('/wrong-answers')}
              style={{ marginTop: 10, width: '100%', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--app-border)', background: 'var(--app-bg-card)',
                color: 'var(--app-text-body)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
              查看全部错题 →
            </button>
          )}
          {wrongAnswerCount === 0 && (
            <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--app-text-muted)' }}>暂无错题记录 ✅</div>
          )}
        </div>

        {/* Card 3: 今日复习进度 */}
        <div className="review-card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div className="review-stat-icon" style={{ background: '#F0FDF4', color: 'var(--app-success)' }}>
              <ProgressIcon />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)', marginBottom: 2 }}>今日复习进度</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--app-text-heading)', lineHeight: 1.2 }}>
                {todayProgress.reviewed}<span style={{ fontSize: '1rem', color: 'var(--app-text-muted)', fontWeight: 500 }}>/{todayProgress.total_due}</span>
              </div>
              <div className="review-progress-bar" style={{ marginTop: 8 }}>
                <div className="review-progress-fill" style={{
                  width: `${Math.max(progressPct, 3)}%`,
                  background: progressPct >= 100 ? 'var(--app-success)' : 'var(--app-brand)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem', color: 'var(--app-text-muted)' }}>
                <span>{progressPct >= 100 ? '✅ 全部完成' : `剩余 ${todayProgress.total_due - todayProgress.reviewed} 个任务`}</span>
                <span>{progressPct}%</span>
              </div>
            </div>
          </div>
          {/* Ebbinghaus hover hint */}
          <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--gray-50)', borderRadius: 6, fontSize: '0.68rem', color: 'var(--app-text-muted)', lineHeight: 1.5 }}>
            💡 艾宾浩斯复习周期：第1天 → 第2天 → 第4天 → 第7天 → 第15天
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
         Two-Column: Calendar + Weak Points
         ══════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* ── 艾宾浩斯 7-Day Calendar ── */}
        <div className="review-card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarIcon /><span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--app-text-heading)' }}>艾宾浩斯复习计划（7天）</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {calendarDays.map(d => (
              <div key={d.key}
                className={`review-calendar-cell${d.isToday ? ' today' : ''}${d.hasOverdue && !d.isToday ? '' : ''}`}
                style={{ background: d.hasOverdue && !d.isToday ? '#FEF2F2' : undefined }}
                onClick={() => setSelectedDate(selectedDate === d.key ? null : d.key)}
                title={`${d.key}: ${d.dueCount}知识点, ${d.wrongCount}错题`}
              >
                <div style={{ fontSize: '0.65rem', color: 'var(--app-text-muted)' }}>{CHINA_DAY_NAMES[d.date.getDay()]}</div>
                <div className="day-num" style={{ color: d.hasOverdue ? 'var(--app-danger)' : 'var(--app-text-heading)' }}>
                  {d.date.getDate()}
                </div>
                {d.dueCount > 0 && (
                  <span className="badge-count" style={{ background: d.hasOverdue ? 'var(--app-danger)' : 'var(--app-warning)', color: '#fff' }}>
                    {d.dueCount}
                  </span>
                )}
                {d.wrongCount > 0 && (
                  <span className="badge-count" style={{ background: 'var(--app-text-muted)', color: '#fff', marginTop: 2 }}>
                    {d.wrongCount}错
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.68rem', color: 'var(--app-text-muted)' }}>
            <span>🔴 到期日标红</span><span>📅 点击日期筛选内容</span>
          </div>
        </div>

        {/* ── Weak Points ── */}
        <div className="review-card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TargetIcon /><span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--app-text-heading)' }}>薄弱点专项复习</span>
          </div>
          {weakPoints.length > 0 ? (
            <>
              <div style={{ display: 'grid', gap: 6, marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
                {weakPoints.slice(0, 5).map(wp => (
                  <div key={wp.point_id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    background: 'var(--gray-50)', borderRadius: 8, fontSize: '0.78rem', cursor: 'pointer',
                  }} onClick={() => handleGoKnowledgePoint(wp.point_id)}>
                    <span style={{ color: 'var(--app-danger)', fontWeight: 600, flexShrink: 0 }}>{wp.mastery_score}%</span>
                    <span style={{ color: 'var(--app-text-body)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wp.point_name}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--app-text-muted)', flexShrink: 0 }}>{wp.domain_name}</span>
                    <ChevronRightIcon size={12} />
                  </div>
                ))}
                {weakPoints.length > 5 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--app-text-muted)', textAlign: 'center' }}>
                    还有 {weakPoints.length - 5} 个薄弱点
                  </div>
                )}
              </div>
              <button onClick={() => navigate('/home')}
                style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: 'var(--app-danger)',
                  color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                🎯 去首页攻克薄弱点
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--app-text-muted)', fontSize: '0.82rem' }}>
              <TargetIcon size={24} />
              <div style={{ marginTop: 8 }}>暂无薄弱知识点 🎉</div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
         Wrong Answer Tiered Management
         ══════════════════════════════════════════════════════ */}
      {wrongAnswerCount > 0 && (
        <div className="review-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WrongIcon size={16} /><span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--app-text-heading)' }}>错题分层管理</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { key: 'today', label: `今日错题 ${wrongTiered.today.length}` },
                { key: '3days', label: `3天内 ${wrongTiered.threeDays.length}` },
                { key: '7days', label: `7天遗忘 ${wrongTiered.sevenDays.length}` },
              ] as { key: ReviewTab; label: string }[]).map(tab => (
                <button key={tab.key} className={`review-wrong-tab${wrongTab === tab.key ? ' active' : ''}`}
                  onClick={() => setWrongTab(tab.key)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {displayedWrong.length > 0 ? (
            <>
              <div style={{ display: 'grid', gap: 6, maxHeight: 250, overflowY: 'auto' }}>
                {displayedWrong.slice(0, 8).map(w => (
                  <div key={w.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8,
                    fontSize: '0.8rem', flexWrap: 'wrap', gap: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ color: 'var(--app-text-body)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                        📊 {w.question?.content?.stem?.replace(/<[^>]*>/g, '').slice(0, 40) || '无题目内容'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--app-text-muted)', marginTop: 2 }}>
                        错 {w.wrong_count} 次 · {new Date(w.first_wrong_at).toLocaleDateString('zh-CN')}
                        {(w.question?.knowledge_point_uuids || []).length > 0 && (
                          <> · 知识点 {w.question!.knowledge_point_uuids!.length}个</>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setPracticeItem(w); setPracticeAnswers(new Set()); setPracticeSubmitted(false); setPracticeCorrect(null) }}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--app-brand)', background: 'var(--app-brand-bg)',
                          color: 'var(--app-brand)', fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        立即练习
                      </button>
                      <button onClick={() => navigate('/wrong-answers')}
                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--app-text-muted)',
                          color: '#fff', fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        查看详情
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={handleBatchReviewWrong}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--app-warning)',
                    color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                  ⚡ 批量加入复习计划
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--app-text-muted)', fontSize: '0.82rem' }}>
              ✅ 该时间段内暂无错题
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
         Historical Review Trends (Collapsible)
         ══════════════════════════════════════════════════════ */}
      <div className="review-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setShowTrends(!showTrends)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChartIcon size={16} /><span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--app-text-heading)' }}>历史复习记录（近30天）</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--app-text-secondary)' }}>📊 复习题量：<strong style={{ color: 'var(--app-text-heading)' }}>{trendsTotal}</strong></span>
              <span style={{ color: 'var(--app-text-secondary)' }}>📈 平均掌握度：<strong style={{ color: 'var(--app-success)' }}>{trendsAvgMastery}%</strong></span>
            </div>
            <ChevronDownIcon size={16} />
          </div>
        </div>
        {showTrends && (
          <div style={{ marginTop: 12, animation: 'reviewSlideUp 0.25s ease-out' }}>
            {/* Simple trend bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, marginBottom: 8 }}>
              {trends.filter(t => t.review_count > 0).slice(-28).map((t, i) => {
                const maxH = 70
                const h = Math.max(3, (t.review_count / Math.max(...trends.map(x => x.review_count), 1)) * maxH)
                return (
                  <div key={i} title={`${t.date}: ${t.review_count}次复习, 掌握度${t.avg_mastery}%`}
                    style={{
                      flex: 1, height: h, borderRadius: '2px 2px 0 0',
                      background: t.avg_mastery >= 80 ? 'var(--app-success)' : t.avg_mastery >= 50 ? 'var(--app-warning)' : 'var(--app-danger)',
                      opacity: 0.7, transition: 'opacity 0.15s',
                      minWidth: 4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--app-text-muted)' }}>
              <span>{trends[0]?.date?.slice(5) || ''}</span>
              <span>{trends[trends.length - 1]?.date?.slice(5) || ''}</span>
            </div>
            <button onClick={() => navigate('/stats')}
              style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--app-border)', background: 'var(--app-bg-card)',
                color: 'var(--app-text-body)', fontSize: '0.75rem', cursor: 'pointer' }}>
              📊 查看完整学习分析 →
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
         Empty State
         ══════════════════════════════════════════════════════ */}
      {duePoints.length === 0 && wrongAnswerCount === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', animation: 'reviewSlideUp 0.4s ease-out' }}>
          <CelebrationIcon size={64} />
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--app-text-heading)', marginTop: 16 }}>太棒了！所有知识点都已复习</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--app-text-secondary)', marginTop: 6 }}>继续保持良好的学习节奏</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
            <button onClick={() => navigate('/banks')} className="btn btn-primary" style={{ border: 'none', cursor: 'pointer' }}>去练题</button>
            <button onClick={() => navigate('/resources')} className="btn btn-secondary" style={{ cursor: 'pointer' }}>学新知识</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
         Knowledge Point Review List
         ══════════════════════════════════════════════════════ */}
      {(filteredDuePoints.length > 0 || (typeFilter !== 'all' || urgencyFilter !== 'all')) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--app-text-heading)', margin: 0 }}>
              待复习知识点 ({filteredDuePoints.length})
            </h2>
            {/* Review mode toggle */}
            <div style={{ display: 'flex', gap: 6, fontSize: '0.72rem', color: 'var(--app-text-muted)' }}>
              <span style={{
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--app-brand-bg)', color: 'var(--app-brand)', fontWeight: 600,
              }}>
                🔵 快速刷题复习
              </span>
              <span style={{ padding: '4px 10px' }}>
                🤖 AI对话讲解
              </span>
            </div>
          </div>
          {filteredDuePoints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--app-text-muted)', fontSize: '0.85rem' }}>
              当前筛选条件下无待复习项
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {filteredDuePoints.map(point => (
                <div key={point.point_id} className="review-card" style={{
                  padding: 'var(--space-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12,
                }}>
                  {/* 左侧信息 */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--app-text-heading)', marginBottom: 4 }}>
                      {point.point_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--app-text-secondary)', flexWrap: 'wrap' }}>
                      <span>掌握度：<span style={{ fontWeight: 600, color: masteryColor(point.mastery_score) }}>{point.mastery_score}%</span></span>
                      <span>·</span>
                      <span>练习 {point.total_practiced} 次</span>
                      <span>·</span>
                      <span>复习 {point.study_count} 次</span>
                      {point.consecutive_errors > 0 && (
                        <>
                          <span>·</span>
                          <span style={{ color: 'var(--app-danger)' }}>连续错 {point.consecutive_errors} 次</span>
                        </>
                      )}
                      <span>·</span>
                      <span style={{
                        color: point.review_label.includes('逾期') ? 'var(--app-danger)' : 'var(--app-text-secondary)',
                        fontWeight: point.review_label.includes('逾期') ? 600 : 400,
                      }}>
                        {point.review_label}
                      </span>
                    </div>
                  </div>
                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => handlePractice(point)}
                      className="btn btn-secondary" style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <PracticeIcon /> 做题练习
                    </button>
                    <button onClick={() => handleAIReview(point.point_name)}
                      className="btn btn-secondary" style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <AIIcon /> AI讲解
                    </button>
                    <button onClick={() => handleViewResources(point)}
                      className="btn btn-secondary" style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ResourceIcon /> 查看资料
                    </button>
                    <button onClick={() => handleMarkComplete(point)}
                      disabled={completingIds.has(point.point_id || '')}
                      className="btn btn-primary" style={{
                        fontSize: '0.75rem', cursor: completingIds.has(point.point_id || '') ? 'default' : 'pointer',
                        opacity: completingIds.has(point.point_id || '') ? 0.6 : 1, border: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                      <CheckIcon /> {completingIds.has(point.point_id || '') ? '处理中...' : '标记已复习'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {/* ══════════════════════════════════════════════════════
         Practice Popup Modal
         ══════════════════════════════════════════════════════ */}
      {practiceItem && practiceItem.question && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
        }} onClick={() => setPracticeItem(null)}>
          <div className="review-card" style={{
            width: 600, maxWidth: '94vw', maxHeight: '85vh', overflowY: 'auto',
            borderRadius: 16, padding: 'var(--space-6)',
            animation: 'reviewSlideUp 0.3s ease-out',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="review-badge" style={{
                background: 'var(--app-brand-bg)', color: 'var(--app-brand)', fontSize: '0.72rem',
              }}>
                {practiceItem.question.type === 'single_choice' ? '单选题' :
                 practiceItem.question.type === 'multiple_choice' ? '多选题' :
                 practiceItem.question.type === 'true_false' ? '判断题' : '练习'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', color: 'var(--app-text-muted)' }}>
                <span>错 {practiceItem.wrong_count} 次</span>
                <button onClick={() => setPracticeItem(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Stem */}
            <div style={{
              fontSize: '0.92rem', color: 'var(--app-text-heading)', fontWeight: 500,
              marginBottom: 20, lineHeight: 1.7, whiteSpace: 'pre-wrap',
            }}>
              {(() => {
                const stem = practiceItem.question.content?.stem || ''
                // Strip HTML tags for clean display
                return stem.replace(/<[^>]*>/g, '')
              })()}
            </div>

            {/* Options */}
            {practiceItem.question.content?.options && practiceItem.question.content.options.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                {practiceItem.question.content.options.map(opt => {
                  const isSelected = practiceAnswers.has(opt.key)
                  const isMulti = practiceItem.question?.type === 'multiple_choice'
                  let bg = 'var(--app-bg-card)'
                  let borderColor = 'var(--app-border)'
                  let textColor = 'var(--app-text-body)'

                  if (practiceSubmitted) {
                    const correctAnswers = normalizeAnswer(practiceItem.question?.answer?.correct_answer)
                    const userCorrect = correctAnswers.includes(opt.key.toLowerCase())
                    if (userCorrect) {
                      bg = '#F0FDF4'; borderColor = 'var(--app-success)'; textColor = 'var(--app-green-dark)'
                    } else if (isSelected) {
                      bg = '#FEF2F2'; borderColor = 'var(--app-danger)'; textColor = 'var(--app-danger-dark)'
                    }
                  } else if (isSelected) {
                    bg = 'var(--app-brand-bg)'; borderColor = 'var(--app-brand)'; textColor = 'var(--app-brand)'
                  }

                  return (
                    <button key={opt.key}
                      disabled={practiceSubmitted}
                      onClick={() => {
                        if (isMulti) {
                          setPracticeAnswers(prev => {
                            const next = new Set(prev)
                            if (next.has(opt.key)) next.delete(opt.key); else next.add(opt.key)
                            return next
                          })
                        } else {
                          setPracticeAnswers(new Set([opt.key]))
                        }
                      }}
                      style={{
                        padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${borderColor}`,
                        background: bg, color: textColor, fontSize: '0.85rem', cursor: practiceSubmitted ? 'default' : 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'all var(--transition-fast)',
                      }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: isMulti ? 6 : '50%',
                        border: `2px solid ${isSelected ? (practiceSubmitted ? borderColor : 'var(--app-brand)') : 'var(--app-text-muted)'}`,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                        background: isSelected && !practiceSubmitted ? 'var(--app-brand)' : 'transparent',
                        color: isSelected && !practiceSubmitted ? '#fff' : 'transparent',
                      }}>
                        {isSelected && !practiceSubmitted ? '✓' : opt.key}
                      </span>
                      <span>{opt.text}</span>
                      {practiceSubmitted && normalizeAnswer(practiceItem.question?.answer?.correct_answer).includes(opt.key.toLowerCase()) && (
                        <span style={{ marginLeft: 'auto', color: 'var(--app-success)', fontSize: '0.75rem' }}>✓ 正确答案</span>
                      )}
                      {practiceSubmitted && isSelected && !normalizeAnswer(practiceItem.question?.answer?.correct_answer).includes(opt.key.toLowerCase()) && (
                        <span style={{ marginLeft: 'auto', color: 'var(--app-danger)', fontSize: '0.75rem' }}>✗ 你的选择</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* True/False quick buttons (if no options defined) */}
            {!practiceItem.question.content?.options?.length && practiceItem.question.type === 'true_false' && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 20, gridTemplateColumns: '1fr 1fr' }}>
                {['正确', '错误'].map(label => {
                  const key = label === '正确' ? 'true' : 'false'
                  const isSelected = practiceAnswers.has(key)
                  let bg = isSelected ? 'var(--app-brand-bg)' : 'var(--app-bg-card)'
                  let borderColor = isSelected ? 'var(--app-brand)' : 'var(--app-border)'
                  if (practiceSubmitted) {
                    const correct = normalizeAnswer(practiceItem.question?.answer?.correct_answer)
                    const userCorrect = correct.includes(key)
                    if (userCorrect) { bg = '#F0FDF4'; borderColor = 'var(--app-success)' }
                    else if (isSelected) { bg = '#FEF2F2'; borderColor = 'var(--app-danger)' }
                  }
                  return (
                    <button key={key} disabled={practiceSubmitted}
                      onClick={() => setPracticeAnswers(new Set([key]))}
                      style={{ padding: '12px', borderRadius: 10, border: `1.5px solid ${borderColor}`, background: bg,
                        fontSize: '0.85rem', cursor: practiceSubmitted ? 'default' : 'pointer', textAlign: 'center' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Submit / Result */}
            {!practiceSubmitted ? (
              <button onClick={() => {
                if (practiceAnswers.size === 0) return
                const correctAnswers = normalizeAnswer(practiceItem.question?.answer?.correct_answer)
                const userAnswers = Array.from(practiceAnswers).map(a => a.trim().toLowerCase())
                // Check if user answers match correct answers (order-independent)
                const isCorrect = correctAnswers.length > 0 &&
                  userAnswers.length === correctAnswers.length &&
                  correctAnswers.every(c => userAnswers.includes(c)) &&
                  userAnswers.every(u => correctAnswers.includes(u))
                setPracticeCorrect(isCorrect)
                setPracticeSubmitted(true)
              }}
                disabled={practiceAnswers.size === 0}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.9rem',
                  border: 'none', cursor: practiceAnswers.size > 0 ? 'pointer' : 'not-allowed',
                  opacity: practiceAnswers.size > 0 ? 1 : 0.5 }}>
                提交答案
              </button>
            ) : (
              <div>
                {/* Result banner */}
                <div style={{
                  padding: '12px 16px', borderRadius: 10, marginBottom: 12,
                  background: practiceCorrect ? '#F0FDF4' : '#FEF2F2',
                  color: practiceCorrect ? 'var(--app-green-dark)' : 'var(--app-danger-dark)',
                  fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {practiceCorrect ? '✅ 回答正确！' : '❌ 回答错误'}
                </div>

                {/* Explanation */}
                {practiceItem.question?.answer?.explanation && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 10, background: 'var(--gray-50)',
                    fontSize: '0.82rem', color: 'var(--app-text-body)', lineHeight: 1.7, marginBottom: 12,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--app-text-heading)' }}>📖 解析：</div>
                    {practiceItem.question.answer.explanation}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => {
                    // Find next wrong answer
                    const currentIdx = wrongAnswers.findIndex(w => w.id === practiceItem.id)
                    const next = wrongAnswers[currentIdx + 1]
                    if (next) {
                      setPracticeItem(next); setPracticeAnswers(new Set()); setPracticeSubmitted(false); setPracticeCorrect(null)
                    } else {
                      setPracticeItem(null)
                    }
                  }}
                    className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                    {wrongAnswers.findIndex(w => w.id === practiceItem.id) < wrongAnswers.length - 1 ? '下一题 →' : '返回列表'}
                  </button>
                  <button onClick={() => setPracticeItem(null)}
                    className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    关闭
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
