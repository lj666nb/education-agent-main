import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pathApi, type KnowledgePointRecordResponse, type NodeOrderItem } from '../api/path'
import { questionBankApi } from '../api/questionBank'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { ArrowRightIcon, BookOpenIcon, CodeIcon, FileTextIcon } from '../components/Icons'
import { useTheme } from '../store/theme'

/* ── Light mode constants ── */
const BRAND = '#1677E8'
const C_LIGHT = {
  ink: '#1F2937',
  muted: '#64748B',
  line: '#E5EDF7',
  page: '#F5F7FB',
  card: '#ffffff',
  bgAlt: '#EEF2F7',
  mastered: { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
  reviewing: { bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' },
  learning: { bg: '#EFF6FF', fg: BRAND, border: '#BFDBFE' },
  locked: { bg: '#F8FAFC', fg: '#94A3B8', border: '#CBD5E1' },
  default: { bg: '#FFFFFF', fg: '#64748B', border: '#E5EDF7' },
  taskAccent: { bg: '#F7F5FF', iconBg: '#ECE8FF' },
  taskPrimary: { bg: '#F0F7FF', iconBg: '#E1EFFF' },
  taskDefault: { bg: '#ffffff', iconBg: '#F2F5F8' },
}

const C_DARK = {
  ink: '#F1F5F9',
  muted: '#A7B4C5',
  line: '#334155',
  page: 'var(--app-bg-page)',
  card: '#151F2F',
  bgAlt: '#223047',
  mastered: { bg: '#0D2F29', fg: '#6EE7B7', border: '#1E5B4D' },
  reviewing: { bg: '#352811', fg: '#FCD34D', border: '#6A4D15' },
  learning: { bg: '#0F223D', fg: '#60A5FA', border: '#28537F' },
  locked: { bg: '#101A29', fg: '#6B7280', border: '#374151' },
  default: { bg: '#151F2F', fg: '#A7B4C5', border: '#334155' },
  taskAccent: { bg: '#1E1B3D', iconBg: '#1E1B3D' },
  taskPrimary: { bg: '#0F2A3D', iconBg: '#0F223D' },
  taskDefault: { bg: '#151F2F', iconBg: '#1B2738' },
}

function statusText(status: string) {
  if (status === 'mastered' || status === 'done') return '已掌握'
  if (status === 'reviewing') return '复习中'
  if (status === 'learning' || status === 'active') return '学习中'
  if (status === 'locked') return '前置锁定'
  return '未开始'
}

export default function KnowledgeLeetBookDetailPage() {
  const { pointId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const stateId = searchParams.get('state') || ''
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const c = isDark ? C_DARK : C_LIGHT

  const [detail, setDetail] = useState<KnowledgePointRecordResponse | null>(null)
  const [nodes, setNodes] = useState<NodeOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewGenerating, setReviewGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!pointId) {
        setError('缺少知识点 ID')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const [detailResponse, stateResponse] = await Promise.all([
          pathApi.getKnowledgeDetail(pointId),
          pathApi.getPathState(stateId || undefined).catch(() => null),
        ])
        if (cancelled) return
        setDetail(detailResponse.data)
        setNodes(stateResponse?.data.state?.node_order || [])
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.detail || '加载知识点详情失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [pointId, stateId])

  const currentIndex = useMemo(() => nodes.findIndex(node => node.node_id === pointId), [nodes, pointId])
  const currentNode = currentIndex >= 0 ? nodes[currentIndex] : null
  const prevNode = currentIndex > 0 ? nodes[currentIndex - 1] : null
  const nextNode = currentIndex >= 0 && currentIndex < nodes.length - 1 ? nodes[currentIndex + 1] : null
  const domains = useMemo(() => {
    const map = new Map<string, NodeOrderItem[]>()
    nodes.forEach(node => {
      const key = node.domain_name || '未分组'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(node)
    })
    return Array.from(map.entries())
  }, [nodes])

  const mastery = detail?.mastery_score || 0
  const accuracy = detail?.recent_accuracy || 0
  const wrongCount = Math.max(0, (detail?.total_practiced || 0) - (detail?.total_correct || 0))

  const statusKey = currentNode?.status || detail?.status || ''
  const statusToneStyle = {
    mastered: isDark ? C_DARK.mastered : C_LIGHT.mastered,
    reviewing: isDark ? C_DARK.reviewing : C_LIGHT.reviewing,
    learning: isDark ? C_DARK.learning : C_LIGHT.learning,
    active: isDark ? C_DARK.learning : C_LIGHT.learning,
    locked: isDark ? C_DARK.locked : C_LIGHT.locked,
  }[statusKey] || (isDark ? C_DARK.default : C_LIGHT.default)

  const goNode = (nodeId: string) => {
    navigate(`/path/knowledge/${nodeId}${stateId ? `?state=${encodeURIComponent(stateId)}` : ''}`)
  }

  const startPractice = async () => {
    if (!pointId) return
    try {
      const res = await questionBankApi.getKnowledgePointPracticeBank(pointId)
      const params = new URLSearchParams()
      params.set('point', pointId)
      if (stateId) params.set('state', stateId)
      navigate(`/banks/${res.data.bank_id}/practice?${params.toString()}`)
    } catch (_) {
      navigate('/banks')
    }
  }

  const startCodingPractice = () => {
    if (detail?.coding_problem_id) {
      navigate(`/coding-practice/problems/${detail.coding_problem_id}`)
    }
  }

  const markStudy = async () => {
    if (!pointId) return
    await pathApi.recordKnowledgeStudy(pointId, 60, 'mark')
    const refreshed = await pathApi.getKnowledgeDetail(pointId)
    setDetail(refreshed.data)
  }

  const generateReview = async () => {
    if (!pointId) return
    setReviewGenerating(true)
    try {
      await pathApi.generateReviewMaterial(pointId)
      const refreshed = await pathApi.getKnowledgeDetail(pointId)
      setDetail(refreshed.data)
    } finally {
      setReviewGenerating(false)
    }
  }

  if (loading) {
    return <Shell bg={c.page} muted={c.muted}><div style={{ flex: 1, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: 14 }}>正在加载知识点详情...</div></Shell>
  }

  if (error || !detail) {
    return <Shell bg={c.page} muted={c.muted}><div style={{ flex: 1, minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', fontSize: 14 }}>{error || '知识点不存在'}</div></Shell>
  }

  return (
    <Shell bg={c.page} muted={c.muted}>
      {/* ── Left sidebar: directory ── */}
      <aside style={{
        width: 286,
        flexShrink: 0,
        background: c.card,
        borderRight: `1px solid ${c.line}`,
        overflow: 'auto',
      }}>
        <div style={{ padding: '18px 18px 12px', borderBottom: `1px solid ${c.line}` }}>
          <button onClick={() => navigate(stateId ? `/path?view=overview&state=${encodeURIComponent(stateId)}` : '/path')} style={{
            border: 'none',
            background: 'transparent',
            color: BRAND,
            padding: 0,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            返回知识地图
          </button>
          <h2 style={{ margin: '12px 0 4px', color: c.ink, fontSize: 17, lineHeight: 1.35 }}>学习路径目录</h2>
          <p style={{ margin: 0, color: c.muted, fontSize: 12 }}>按当前动态路径顺序浏览章节</p>
        </div>

        <div style={{ padding: '10px 10px 20px' }}>
          {domains.length === 0 ? (
            <div style={{ padding: 14, color: c.muted, fontSize: 13 }}>暂无路径目录</div>
          ) : domains.map(([domain, items], domainIndex) => (
            <div key={domain} style={{ marginBottom: 10 }}>
              <div style={{ padding: '8px 9px', color: c.muted, fontSize: 11, fontWeight: 800 }}>
                {String(domainIndex + 1).padStart(2, '0')} · {domain}
              </div>
              {items.map(item => {
                const active = item.node_id === pointId
                const key = (['mastered', 'reviewing', 'learning', 'locked'] as string[]).includes(item.status) ? item.status : 'default'
                const site = ((isDark ? C_DARK : C_LIGHT) as any)[key] || (isDark ? C_DARK.default : C_LIGHT.default)
                return (
                  <button key={item.node_id} onClick={() => goNode(item.node_id)} style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 10px',
                    border: active ? `1px solid ${BRAND}` : '1px solid transparent',
                    background: active ? (isDark ? '#0F2A3D' : '#F0F7FF') : 'transparent',
                    borderRadius: 6,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: site.fg, flexShrink: 0 }} />
                    <span style={{ color: active ? BRAND : c.ink, fontSize: 13, fontWeight: active ? 800 : 600, lineHeight: 1.35, flex: 1 }}>
                      {item.name}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 940, margin: '0 auto', padding: '24px 28px 44px' }}>
          {/* Header card */}
          <header style={{
            background: c.card,
            border: `1px solid ${c.line}`,
            borderRadius: 8,
            padding: '28px 30px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: BRAND, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  {detail.subject_name} / {detail.domain_name}
                </div>
                <h1 style={{ margin: 0, color: c.ink, fontSize: 34, lineHeight: 1.18, fontWeight: 850 }}>
                  {detail.point_name}
                </h1>
              </div>
              <span style={{
                border: `1px solid ${statusToneStyle.border}`,
                background: statusToneStyle.bg,
                color: statusToneStyle.fg,
                borderRadius: 999,
                padding: '8px 13px',
                fontSize: 12,
                fontWeight: 800,
              }}>
                {statusText(currentNode?.status || detail.status)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(110px, 1fr))', gap: 10, marginTop: 24 }}>
              <Metric label="掌握度" value={`${mastery}%`} color={mastery >= 80 ? '#059669' : BRAND} line={c.line} />
              <Metric label="近期正确率" value={`${accuracy}%`} color={accuracy >= 80 ? '#059669' : '#D97706'} line={c.line} />
              <Metric label="练习题数" value={String(detail.total_practiced || 0)} color={c.ink} line={c.line} />
              <Metric label="错题数" value={String(wrongCount)} color={wrongCount ? '#DC2626' : '#059669'} line={c.line} />
            </div>
          </header>

          {/* Task cards section */}
          <section style={sectionStyle(c)}>
            <div style={{ color: c.ink, fontSize: 18, fontWeight: 850, marginBottom: 14 }}>本章任务</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <TaskCard c={c} isDark={isDark} icon={<BookOpenIcon size={18} />} title="阅读讲义" desc="阅读与本知识点配对的参考来源原文" action="查看讲义" onClick={() => document.getElementById('lecture-section')?.scrollIntoView({ behavior: 'smooth' })} />
              <TaskCard c={c} isDark={isDark} icon={<FileTextIcon size={18} />} title="专项练习" desc="进入题库完成本知识点练习" action="开始练习" onClick={startPractice} primary />
              {detail.coding_problem_id && (
                <TaskCard
                  c={c} isDark={isDark}
                  icon={<CodeIcon size={18} />}
                  title="实战训练"
                  desc={detail.coding_problem_title || '进入对应代码题完成编程实战'}
                  action="打开代码题"
                  onClick={startCodingPractice}
                  accent="#6D5BD0"
                />
              )}
            </div>
          </section>

          {/* Coding practice section */}
          {detail.coding_problem_id && (
            <section style={sectionStyle(c)}>
              <div style={{ color: c.ink, fontSize: 18, fontWeight: 850, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6D5BD0', background: isDark ? '#1E1B3D' : '#ECE8FF' }}><CodeIcon size={18} /></span>
                <div>
                  <span style={{ color: c.ink, fontSize: 18, fontWeight: 850 }}>实战训练</span>
                  <span style={{ display: 'block', color: c.muted, fontSize: 13, marginTop: 2 }}>
                    {detail.coding_problem_title || '编程实战'} · {detail.coding_problem_difficulty === 'basic' ? '入门' : detail.coding_problem_difficulty === 'intermediate' ? '进阶' : detail.coding_problem_difficulty === 'advanced' ? '困难' : detail.coding_problem_difficulty || '基础'}
                  </span>
                </div>
              </div>
              <p style={{ color: c.muted, fontSize: 14, lineHeight: 1.8, margin: '14px 0' }}>
                本知识点配有编程实战题目，在代码编辑器中完成算法实现并通过在线评测。
              </p>
              <button onClick={startCodingPractice} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#6D5BD0',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                打开编程实战 <ArrowRightIcon size={16} />
              </button>
            </section>
          )}

          {/* Lecture section */}
          <section style={sectionStyle(c)} id="lecture-section">
            <div style={{ color: c.ink, fontSize: 18, fontWeight: 850, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>阅读讲义</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={markStudy} style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${c.line}`,
                  background: c.card,
                  color: BRAND,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                  标记已学
                </button>
                {detail.review_source_url && (
                  <a href={detail.review_source_url} target="_blank" rel="noopener noreferrer" style={{ color: BRAND, fontSize: 12, fontWeight: 750 }}>
                    查看原始页面 ↗
                  </a>
                )}
              </div>
            </div>
            {detail.review_material ? (
              <div style={{ color: c.ink, fontSize: 14, lineHeight: 1.9 }}>
                <MarkdownRenderer content={detail.review_material} />
              </div>
            ) : (
              <div style={{
                border: `1px dashed ${c.line}`,
                borderRadius: 8,
                padding: 18,
                color: c.muted,
                fontSize: 14,
                lineHeight: 1.8,
              }}>
                参考原文讲义尚未加载，请点击下方按钮获取。
                <div style={{ marginTop: 12 }}>
                  <button onClick={generateReview} disabled={reviewGenerating} style={{
                    padding: '9px 13px',
                    borderRadius: 6,
                    border: 'none',
                    background: reviewGenerating ? '#CBD5E1' : BRAND,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: reviewGenerating ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}>
                    {reviewGenerating ? '加载中...' : '加载阅读讲义'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Practice & review section */}
          <section style={sectionStyle(c)}>
            <div style={{ color: c.ink, fontSize: 18, fontWeight: 850, marginBottom: 14 }}>练习与复盘</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
              <div style={{ border: `1px solid ${c.line}`, borderRadius: 8, padding: 16 }}>
                <div style={{ color: c.ink, fontSize: 15, fontWeight: 800, marginBottom: 8 }}>练习记录</div>
                <ProgressRow label="掌握度" value={mastery} color={mastery >= 80 ? '#10B981' : BRAND} bgAlt={c.bgAlt} muted={c.muted} />
                <ProgressRow label="近期正确率" value={accuracy} color={accuracy >= 80 ? '#10B981' : '#F59E0B'} bgAlt={c.bgAlt} muted={c.muted} />
                <p style={{ margin: '12px 0 0', color: c.muted, fontSize: 12 }}>
                  已练习 {detail.total_practiced || 0} 题，答对 {detail.total_correct || 0} 题，连续错误 {detail.consecutive_errors || 0} 次。
                </p>
              </div>
              <div style={{ border: `1px solid ${c.line}`, borderRadius: 8, padding: 16 }}>
                <div style={{ color: c.ink, fontSize: 15, fontWeight: 800, marginBottom: 8 }}>复习安排</div>
                <p style={{ margin: 0, color: c.muted, fontSize: 13, lineHeight: 1.8 }}>
                  {detail.next_review_at
                    ? `下次复习：${new Date(detail.next_review_at).toLocaleString('zh-CN')}`
                    : '暂无下次复习时间。完成练习或测评后，系统会根据结果更新路径。'}
                </p>
                {detail.coding_problem_id && (
                  <button onClick={startCodingPractice} style={{
                    padding: '9px 13px', borderRadius: 6, border: `1px solid ${c.line}`,
                    background: c.card, color: '#A78BFA', fontSize: 13, fontWeight: 750,
                    cursor: 'pointer', fontFamily: 'inherit', marginTop: 14,
                  }}>
                    进入本章实战训练
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Footer nav */}
          <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              {prevNode && <button onClick={() => goNode(prevNode.node_id)} style={secondaryButtonStyle(c)}>上一篇：{prevNode.name}</button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate(stateId ? `/path?view=overview&state=${encodeURIComponent(stateId)}` : '/path')} style={secondaryButtonStyle(c)}>返回地图</button>
              {nextNode && <button onClick={() => goNode(nextNode.node_id)} style={{
                padding: '9px 13px', borderRadius: 6, border: 'none',
                background: BRAND, color: '#fff', fontSize: 13, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>下一篇：{nextNode.name}</button>}
            </div>
          </footer>
        </div>
      </main>
    </Shell>
  )
}

/* ── Helper components ── */

function Shell({ children, bg, muted: _muted }: { children: ReactNode; bg: string; muted: string }) {
  return (
    <div style={{ height: '100%', minHeight: 'calc(100vh - 0px)', display: 'flex', background: bg }}>
      {children}
    </div>
  )
}

function Metric({ label, value, color, line }: { label: string; value: string; color: string; line: string }) {
  return (
    <div style={{ borderTop: `1px solid ${line}`, paddingTop: 12 }}>
      <div style={{ color, fontSize: 24, fontWeight: 850, lineHeight: 1 }}>{value}</div>
      <div style={{ color: '#A7B4C5', fontSize: 12, marginTop: 6 }}>{label}</div>
    </div>
  )
}

function TaskCard({ c, isDark, icon, title, desc, action, onClick, primary, accent }: {
  c: typeof C_LIGHT
  isDark: boolean
  icon: ReactNode
  title: string
  desc: string
  action: string
  onClick: () => void
  primary?: boolean
  accent?: string
}) {
  const tone = accent || (primary ? BRAND : c.muted)
  const cardBg = accent ? (isDark ? C_DARK.taskAccent.bg : '#F7F5FF') : primary ? (isDark ? C_DARK.taskPrimary.bg : '#F0F7FF') : c.card
  const iconBg = accent ? (isDark ? C_DARK.taskAccent.iconBg : '#ECE8FF') : primary ? (isDark ? C_DARK.taskPrimary.iconBg : '#E1EFFF') : (isDark ? C_DARK.taskDefault.iconBg : '#F2F5F8')
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${accent || primary ? tone : c.line}`,
      background: cardBg,
      borderRadius: 8,
      padding: 16,
      textAlign: 'left',
      cursor: 'pointer',
      fontFamily: 'inherit',
      minHeight: 132,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <span>
        <span style={{ width: 34, height: 34, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tone, background: iconBg, marginBottom: 12 }}>{icon}</span>
        <span style={{ display: 'block', color: c.ink, fontSize: 16, fontWeight: 850, marginBottom: 7 }}>{title}</span>
        <span style={{ color: c.muted, fontSize: 13, lineHeight: 1.6 }}>{desc}</span>
      </span>
      <span style={{ color: tone, fontSize: 12, fontWeight: 800, marginTop: 12 }}>{action} →</span>
    </button>
  )
}

function ProgressRow({ label, value, color, bgAlt, muted }: { label: string; value: number; color: string; bgAlt: string; muted: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: muted, fontSize: 12, marginBottom: 5 }}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: bgAlt, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  )
}

function sectionStyle(c: typeof C_LIGHT) {
  return {
    background: c.card,
    border: `1px solid ${c.line}`,
    borderRadius: 8,
    padding: 22,
    marginBottom: 16,
  }
}

function secondaryButtonStyle(c: typeof C_LIGHT) {
  return {
    padding: '9px 13px',
    borderRadius: 6,
    border: `1px solid ${c.line}`,
    background: c.card,
    color: c.muted,
    fontSize: 13,
    fontWeight: 750 as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}
