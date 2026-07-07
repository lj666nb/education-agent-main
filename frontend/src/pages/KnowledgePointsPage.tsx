import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { reviewApi } from '../api/review'

/* ── Icons ── */
function BackIcon() { return (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)}
function ChevronDown({ expanded }: { expanded: boolean }) { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  mastered:    { label: '已掌握', bg: '#F0FDF4', color: '#10B981' },
  reviewing:   { label: '复习中', bg: '#FFFBEB', color: '#D97706' },
  learning:    { label: '学习中', bg: '#F0F9FF', color: '#1677E8' },
  not_started: { label: '未开始', bg: '#F9FAFB', color: '#9CA3AF' },
}

function masteryColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 50) return '#F59E0B'
  if (score >= 20) return '#F97316'
  return '#EF4444'
}

export default function KnowledgePointsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const subjectId = searchParams.get('subjectId')
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<string>('all') // all | learning | reviewing | mastered

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await reviewApi.getKnowledgePoints(subjectId || undefined)
      const allSubjects = res.data.subjects || []
      // 如果有 subjectId 参数，只显示对应学科
      const filtered = subjectId
        ? allSubjects.filter((s: any) => s.id === subjectId)
        : allSubjects
      setSubjects(filtered)
      // 学科和章节默认收起，用户可手动展开
      setExpandedSubjects(new Set())
      setExpandedDomains(new Set())
    } catch (err) {
      console.error('加载知识点失败:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [subjectId])

  const toggleSubject = (id: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleDomain = (id: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filterPoints = (points: any[]) => {
    if (filter === 'all') return points
    return points.filter(p => p.status === filter)
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ padding: 'var(--space-4) var(--space-8)' }}>
        <div style={{ height: 28, width: 160, background: 'var(--gray-200)', borderRadius: 6, marginBottom: 'var(--space-6)' }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 100, background: 'var(--gray-100)', borderRadius: 10, marginBottom: 'var(--space-3)' }} />
        ))}
      </div>
    )
  }

  const totalPoints = subjects.reduce((s: number, sub: any) => s + (sub.total_points || 0), 0)
  const masteredPoints = subjects.reduce((s: number, sub: any) =>
    s + sub.domains.reduce((sd: number, d: any) =>
      sd + d.points.filter((p: any) => p.status === 'mastered').length, 0), 0)

  return (
    <div style={{ padding: 'var(--space-4) var(--space-8)' }}>
      {/* 返回 + 标题 */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <BackIcon /> 返回
        </button>
      </div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)', margin: '0 0 var(--space-4)' }}>
        🧠 知识点总览
      </h1>

      {/* 统计概览 */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '12px 20px', border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>知识点总数</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1F2937' }}>{totalPoints}</div>
        </div>
        <div className="card" style={{ padding: '12px 20px', border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>已掌握</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10B981' }}>{masteredPoints}</div>
        </div>
        <div className="card" style={{ padding: '12px 20px', border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>学科数</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1677E8' }}>{subjects.length}</div>
        </div>
        {/* 筛选 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          {['all', 'learning', 'reviewing', 'mastered'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: '4px 12px', borderRadius: 16, border: filter === s ? 'none' : '1px solid #D1D5DB',
                background: filter === s ? '#1677E8' : '#fff',
                color: filter === s ? '#fff' : '#6B7280',
                fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            >
              {STATUS_CONFIG[s]?.label || '全部'}
            </button>
          ))}
        </div>
      </div>

      {/* 空状态 */}
      {subjects.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937' }}>暂无知识点数据</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginTop: 6 }}>完成练习后，知识点掌握情况将自动生成</div>
          <button onClick={() => navigate('/banks')} className="btn btn-primary" style={{ marginTop: 16, border: 'none', cursor: 'pointer' }}>去练题</button>
        </div>
      )}

      {/* 学科列表 */}
      {subjects.map(sub => {
        const subExpanded = expandedSubjects.has(sub.id)
        return (
        <div key={sub.id} className="card" style={{ marginBottom: 'var(--space-4)', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
          {/* 学科头 — 点击可展开/收起 */}
          <div
            onClick={() => toggleSubject(sub.id)}
            style={{ padding: '14px 20px', background: '#F9FAFB', borderBottom: subExpanded ? '1px solid var(--gray-200)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ChevronDown expanded={subExpanded} />
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F2937' }}>{sub.name}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{sub.total_points} 个知识点</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>平均掌握度</span>
              <div style={{ width: 80, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${sub.avg_mastery}%`, height: '100%', background: masteryColor(sub.avg_mastery), borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: masteryColor(sub.avg_mastery) }}>{sub.avg_mastery}%</span>
            </div>
          </div>

          {/* 章节列表（仅在学科展开时显示） */}
          {subExpanded && sub.domains?.filter((d: any) => filterPoints(d.points).length > 0 || filter === 'all').map((domain: any) => {
            const visiblePoints = filterPoints(domain.points)
            if (filter !== 'all' && visiblePoints.length === 0) return null
            return (
              <div key={domain.id}>
                {/* 章节标题（可折叠） */}
                <div
                  onClick={() => toggleDomain(domain.id)}
                  style={{
                    padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                    background: expandedDomains.has(domain.id) ? '#FAFAFA' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ChevronDown expanded={expandedDomains.has(domain.id)} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{domain.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{visiblePoints.length} 知识点</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['mastered','reviewing','learning','not_started'].map(s => {
                      const count = domain.points.filter((p: any) => p.status === s).length
                      if (count === 0) return null
                      return (
                        <span key={s} style={{
                          fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10,
                          background: STATUS_CONFIG[s]?.bg || '#F9FAFB',
                          color: STATUS_CONFIG[s]?.color || '#9CA3AF',
                        }}>
                          {STATUS_CONFIG[s]?.label}{count}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* 知识点列表（折叠控制） */}
                {expandedDomains.has(domain.id) && (
                  <div style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {visiblePoints.map((point: any) => (
                      <div key={point.point_id} style={{
                        padding: '10px 20px 10px 44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: 8, borderBottom: '1px solid #F9FAFB',
                        transition: 'background 0.15s ease',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 150 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1F2937' }}>{point.point_name}</span>
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10, background: STATUS_CONFIG[point.status]?.bg, color: STATUS_CONFIG[point.status]?.color, whiteSpace: 'nowrap' }}>
                            {STATUS_CONFIG[point.status]?.label || point.status}
                          </span>
                          {point.needs_review && (
                            <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626' }}>
                              待复习
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                          {/* 掌握度进度条 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>掌握</span>
                            <div style={{ width: 60, height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${point.mastery_score}%`, height: '100%', background: masteryColor(point.mastery_score), borderRadius: 3, transition: 'width 0.3s ease' }} />
                            </div>
                            <span style={{ fontWeight: 600, color: masteryColor(point.mastery_score), minWidth: 28 }}>{point.mastery_score}%</span>
                          </div>
                          <span>练习 {point.total_practiced} 次</span>
                          {point.consecutive_errors > 0 && (
                            <span style={{ color: '#EF4444' }}>连错 {point.consecutive_errors} 次</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )
      })}
    </div>
  )
}
