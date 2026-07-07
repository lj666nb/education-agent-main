import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { reviewApi, type DueKnowledgePoint } from '../api/review'

/* ── Inline Icons ── */
function BrainIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V12a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9.5C7.8 8.8 7 7.5 7 6a4 4 0 0 1 4-4z"/>
    <path d="M12 22c-4 0-6-2-6-6 0-1.5.8-2.8 2-3.5V14a4 4 0 0 0 8 0v-1.5c1.2.7 2 2 2 3.5 0 4-2 6-6 6z"/>
  </svg>
)}
function BookIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)}
function ProgressIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)}
function CheckIcon() { return (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)}
function RefreshIcon() { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)}

function PracticeIcon() { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)}
function ResourceIcon() { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)}

function CelebrationIcon() { return (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/>
  </svg>
)}

/* ── Color helpers ── */
function masteryColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 50) return '#F59E0B'
  return '#EF4444'
}

export default function ReviewCenterPage() {
  const navigate = useNavigate()
  const [duePoints, setDuePoints] = useState<DueKnowledgePoint[]>([])
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0)
  const [todayProgress, setTodayProgress] = useState({ reviewed: 0, total_due: 0 })
  const [loading, setLoading] = useState(true)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await reviewApi.getDashboard()
      setDuePoints(res.data.due_points)
      setWrongAnswerCount(res.data.wrong_answer_count)
      setTodayProgress(res.data.today_progress)
    } catch (err: any) {
      console.error('加载复习数据失败:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

  /* 标记复习完成 */
  const handleMarkComplete = async (point: DueKnowledgePoint) => {
    if (!point.point_id || completingIds.has(point.point_id)) return
    setCompletingIds(prev => new Set(prev).add(point.point_id!))
    try {
      await reviewApi.markComplete(point.point_id)
      // 从列表中移除
      setDuePoints(prev => prev.filter(p => p.point_id !== point.point_id))
      // 更新今日进度
      setTodayProgress(prev => ({ ...prev, reviewed: prev.reviewed + 1 }))
      setMessage(`「${point.point_name}」已标记为已复习`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setMessage('标记失败，请重试')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setCompletingIds(prev => {
        const next = new Set(prev)
        next.delete(point.point_id!)
        return next
      })
    }
  }

  /* 去练习 */
  const handlePractice = (point: DueKnowledgePoint) => {
    if (point.point_name) {
      navigate(`/banks?search=${encodeURIComponent(point.point_name)}`)
    } else {
      navigate('/banks')
    }
  }

  /* 查看资料 */
  const handleViewResources = (point: DueKnowledgePoint) => {
    if (point.point_name) {
      navigate(`/resources?search=${encodeURIComponent(point.point_name)}`)
    } else {
      navigate('/resources')
    }
  }

  const progressPct = todayProgress.total_due > 0
    ? Math.round((todayProgress.reviewed / todayProgress.total_due) * 100)
    : 100

  /* ── 加载骨架屏 ── */
  if (loading) {
    return (
      <div style={{ padding: 'var(--space-4) var(--space-8)' }}>
        <div style={{ height: 28, width: 180, background: 'var(--gray-200)', borderRadius: 6, marginBottom: 'var(--space-6)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 120, background: 'var(--gray-100)', borderRadius: 12 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 80, background: 'var(--gray-100)', borderRadius: 10 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-4) var(--space-8)' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)', margin: 0 }}>📚 复习中心</h1>
        <button onClick={fetchDashboard}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <RefreshIcon /> 刷新
        </button>
      </div>

      {/* 提示消息 */}
      {message && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 'var(--space-4)',
          background: message.includes('失败') ? '#FEF2F2' : '#F0FDF4',
          color: message.includes('失败') ? '#DC2626' : '#16A34A',
          fontSize: '0.82rem',
        }}>
          {message}
        </div>
      )}

      {/* ── 顶部三个统计卡片 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* 待复习知识点 */}
        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 14, border: '1px solid var(--gray-200)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1677E8', flexShrink: 0 }}>
            <BrainIcon />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 2 }}>待复习知识点</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: duePoints.length > 0 ? '#DC2626' : '#10B981', lineHeight: 1.2 }}>
              {duePoints.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 2 }}>
              {duePoints.length > 0
                ? `最晚到期: ${duePoints[duePoints.length - 1]?.review_label || '-'}`
                : '暂无待复习项'}
            </div>
          </div>
        </div>

        {/* 待复习错题 */}
        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 14, border: '1px solid var(--gray-200)', cursor: wrongAnswerCount > 0 ? 'pointer' : 'default' }}
          onClick={() => wrongAnswerCount > 0 && navigate('/wrong-answers')}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0 }}>
            <BookIcon />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 2 }}>待复习错题</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: wrongAnswerCount > 0 ? '#D97706' : '#10B981', lineHeight: 1.2 }}>
              {wrongAnswerCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 2 }}>
              {wrongAnswerCount > 0 ? '点击前往错题本' : '暂无错题记录'}
            </div>
          </div>
        </div>

        {/* 今日进度 */}
        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 14, border: '1px solid var(--gray-200)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0 }}>
            <ProgressIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 2 }}>今日复习进度</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1F2937', lineHeight: 1.2 }}>
              {todayProgress.reviewed}<span style={{ fontSize: '1rem', color: 'var(--gray-400)' }}>/{todayProgress.total_due}</span>
            </div>
            {/* 进度条 */}
            <div style={{ marginTop: 8, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(progressPct, 4)}%`, background: progressPct >= 100 ? '#10B981' : '#1677E8', borderRadius: 3, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 空状态 ── */}
      {duePoints.length === 0 && wrongAnswerCount === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <CelebrationIcon />
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1F2937', marginTop: 16 }}>太棒了！所有知识点都已复习</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginTop: 6 }}>继续保持良好的学习节奏</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
            <button onClick={() => navigate('/banks')} className="btn btn-primary" style={{ border: 'none', cursor: 'pointer' }}>去练题</button>
            <button onClick={() => navigate('/resources')} className="btn btn-secondary" style={{ cursor: 'pointer' }}>学新知识</button>
          </div>
        </div>
      )}

      {/* ── 知识点列表 ── */}
      {duePoints.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-heading)', marginBottom: 'var(--space-3)' }}>
            待复习知识点 ({duePoints.length})
          </h2>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {duePoints.map(point => (
              <div key={point.point_id} className="card" style={{
                padding: 'var(--space-4)', border: '1px solid var(--gray-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
              }}>
                {/* 左侧信息 */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1F2937', marginBottom: 4 }}>
                    {point.point_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--gray-400)', flexWrap: 'wrap' }}>
                    <span>
                      掌握度：
                      <span style={{ fontWeight: 600, color: masteryColor(point.mastery_score) }}>
                        {point.mastery_score}%
                      </span>
                    </span>
                    <span>·</span>
                    <span>练习 {point.total_practiced} 次</span>
                    <span>·</span>
                    <span>复习 {point.study_count} 次</span>
                    {point.consecutive_errors > 0 && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#EF4444' }}>连续错 {point.consecutive_errors} 次</span>
                      </>
                    )}
                    <span>·</span>
                    <span style={{ color: point.review_label.includes('逾期') ? '#EF4444' : 'var(--gray-400)', fontWeight: point.review_label.includes('逾期') ? 600 : 400 }}>
                      {point.review_label}
                    </span>
                  </div>
                </div>

                {/* 右侧操作按钮 */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => handlePractice(point)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <PracticeIcon /> 做题练习
                  </button>
                  <button onClick={() => handleViewResources(point)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <ResourceIcon /> 查看资料
                  </button>
                  <button onClick={() => handleMarkComplete(point)}
                    disabled={completingIds.has(point.point_id || '')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1677E8', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: completingIds.has(point.point_id || '') ? 'default' : 'pointer', opacity: completingIds.has(point.point_id || '') ? 0.6 : 1, fontFamily: 'inherit' }}
                  >
                    <CheckIcon /> {completingIds.has(point.point_id || '') ? '处理中...' : '标记已复习'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
