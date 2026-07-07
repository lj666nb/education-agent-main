import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileV2Api } from '../api'
import type { ProfileV2Response, SubjectMastery, DomainMastery, KnowledgeMastery, ErrorProneSubject, ErrorProneDomain, ErrorProneTopic } from '../types/profile'
import RadarChart from '../components/charts/RadarChart'
import HeatmapCalendar from '../components/charts/HeatmapCalendar'
import TrendChart from '../components/charts/TrendChart'

const COGNITIVE_STYLE_MAP: Record<string, { label: string; desc: string }> = {
  visual: { label: '视觉型', desc: '偏好图像、图表学习' },
  auditory: { label: '听觉型', desc: '偏好听力、讲解学习' },
  reading_writing: { label: '阅读型', desc: '偏好文字、笔记学习' },
  kinesthetic: { label: '实践型', desc: '偏好动手、操作学习' },
  mixed: { label: '混合型', desc: '多种学习方式结合' },
}

/* ── SVG Icons ── */

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2-1 2.7V10c0 1.1-.9 2-2 2s-2-.9-2-2V8.7c-.6-.7-1-1.6-1-2.7a4 4 0 0 1 4-4z"/>
      <path d="M12 14c2.2 0 6 1.1 6 3v2H6v-2c0-1.9 3.8-3 6-3z"/>
    </svg>
  )
}

function BookOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}

function AlertTriangleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

function TrendingUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  )
}

const getScoreColor = (score: number) => {
  if (score >= 0.8) return 'var(--success)'
  if (score >= 0.6) return 'var(--primary)'
  if (score >= 0.4) return 'var(--warning)'
  return 'var(--danger)'
}

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return '高'
  if (confidence >= 0.5) return '中'
  return '低'
}

const getTrendLabel = (value: number, baseline: number) => {
  const diff = value - baseline
  if (diff > 0.05) return `↑ 上升 ${(diff * 100).toFixed(0)}%`
  if (diff < -0.05) return `↓ 下降 ${(Math.abs(diff) * 100).toFixed(0)}%`
  return '→ 平稳'
}

const getScoreHexColor = (score: number) => {
  if (score >= 0.7) return 'var(--app-success)'
  if (score >= 0.3) return 'var(--app-warning)'
  return 'var(--app-danger)'
}

/** 从知识掌握度数据中提取趋势（按更新日期聚合） */
function buildTrendData(knowledgeMastery: SubjectMastery[]): { date: string; value: number }[] {
  const dateMap: Record<string, { total: number; count: number }> = {}
  for (const sub of knowledgeMastery) {
    for (const dom of sub.domains) {
      for (const kp of dom.knowledge_points) {
        if (kp.last_updated) {
          const date = kp.last_updated.slice(0, 10)
          if (!dateMap[date]) dateMap[date] = { total: 0, count: 0 }
          dateMap[date].total += kp.score * 100
          dateMap[date].count += 1
        }
      }
    }
  }
  return Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)  // 最近 14 天
    .map(([date, { total, count }]) => ({
      date,
      value: Math.round(total / count),
    }))
}

/** 从画像数据中构建热力图数据 */
function buildHeatmapData(profile: ProfileV2Response): { date: string; count: number }[] {
  const dateMap: Record<string, number> = {}
  for (const sub of profile.knowledge_mastery) {
    for (const dom of sub.domains) {
      for (const kp of dom.knowledge_points) {
        if (kp.last_updated) {
          const date = kp.last_updated.slice(0, 10)
          dateMap[date] = (dateMap[date] || 0) + 1
        }
      }
    }
  }
  return Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-90)
    .map(([date, count]) => ({ date, count }))
}

/** 判断画像是否包含真实学习数据（非初始默认值） */
function hasRealLearningData(profile: ProfileV2Response | null): boolean {
  if (!profile) return false
  const totalKnowledge = profile.knowledge_mastery.reduce(
    (sum, sub) => sum + sub.domains.reduce((s, d) => s + d.knowledge_points.length, 0),
    0
  )
  return totalKnowledge > 0
}

const getAlert = (type: string, value: number): string | null => {
  if (type === 'calibration') {
    if (value < 0.3) return '自评与实测偏差过大，建议暂停反思'
    if (value > 0.7) return '自我认知准确，继续保持'
  }
  if (type === 'attention') {
    if (value < 0.3) return '建议休息5分钟或切换学习方式'
    if (value > 0.7) return '当前状态良好，适合攻克难点'
  }
  if (type === 'rhythm') {
    if (value < 0.3) return '建议调整学习单元大小或休息间隔'
    if (value > 0.7) return '当前学习节奏适合你'
  }
  return null
}

/* ── Subject Section (collapsible) ── */
function SubjectSection({ subject, onDeleteKnowledge }: { subject: SubjectMastery; onDeleteKnowledge: (kp: string) => void }) {
  const [open, setOpen] = useState(true)
  const totalKps = subject.domains.reduce((sum, d) => sum + d.knowledge_points.length, 0)

  return (
    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Subject header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'var(--gray-100)', cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--gray-500)', display: 'flex', transition: 'transform 0.2s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>
          <ChevronDownIcon />
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--gray-800)' }}>
          {subject.subject_name}
        </span>
        <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '0 0.5rem' }}>
          {totalKps} 个知识点
        </span>
      </div>

      {/* Domain list */}
      {open && (
        <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
          {subject.domains.map((domain: DomainMastery) => (
            <DomainSection key={domain.domain_id || domain.domain_name} domain={domain} onDeleteKnowledge={onDeleteKnowledge} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Domain Section ── */
function DomainSection({ domain, onDeleteKnowledge }: { domain: DomainMastery; onDeleteKnowledge: (kp: string) => void }) {
  if (domain.knowledge_points.length === 0) return null

  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      {domain.domain_name !== '未分类' && (
        <div style={{
          fontSize: '0.8125rem', fontWeight: 500, color: 'var(--gray-500)',
          padding: 'var(--space-2) var(--space-3) var(--space-1)',
        }}>
          {domain.domain_name}
        </div>
      )}
      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
        {domain.knowledge_points.map((kp: KnowledgeMastery) => (
          <div key={kp.knowledge_point} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--gray-50)', borderRadius: 'var(--radius-md)',
            marginLeft: domain.domain_name !== '未分类' ? 'var(--space-4)' : 0,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{kp.knowledge_point}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '2px' }}>
                置信度: {getConfidenceLabel(kp.confidence)} ({Math.round(kp.confidence * 100)}%)
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ width: '100px' }}>
                <div style={{ height: '6px', backgroundColor: 'var(--gray-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${kp.score * 100}%`, backgroundColor: getScoreColor(kp.score), borderRadius: 'var(--radius-full)', transition: 'width var(--transition-slow)' }} />
                </div>
                <div style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '2px', color: getScoreColor(kp.score), fontFamily: 'var(--font-heading)' }}>
                  {(kp.score * 100).toFixed(0)}%
                </div>
              </div>
              <button onClick={() => onDeleteKnowledge(kp.knowledge_point)} className="btn btn-secondary" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'oklch(from var(--danger) l c h / 0.2)' }}>
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Error-Prone Subject Section (collapsible) ── */
function ErrorProneSubjectSection({ subject }: { subject: ErrorProneSubject }) {
  const [open, setOpen] = useState(true)
  const totalTopics = subject.domains.reduce((sum, d) => sum + d.topics.length, 0)

  return (
    <div style={{ border: '1px solid oklch(from var(--danger) l c h / 0.15)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Subject header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'oklch(from var(--danger) l c h / 0.04)', cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--gray-500)', display: 'flex', transition: 'transform 0.2s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>
          <ChevronDownIcon />
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--gray-800)' }}>
          {subject.subject_name}
        </span>
        <span className="badge badge-danger" style={{ fontSize: '0.7rem', padding: '0 0.5rem' }}>
          {totalTopics} 个易错点
        </span>
      </div>

      {/* Domain list */}
      {open && (
        <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
          {subject.domains.map((domain: ErrorProneDomain) => (
            <ErrorProneDomainSection key={domain.domain_id || domain.domain_name} domain={domain} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Error-Prone Domain Section ── */
function ErrorProneDomainSection({ domain }: { domain: ErrorProneDomain }) {
  if (domain.topics.length === 0) return null

  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      {domain.domain_name !== '未分类' && (
        <div style={{
          fontSize: '0.8125rem', fontWeight: 500, color: 'var(--gray-500)',
          padding: 'var(--space-2) var(--space-3) var(--space-1)',
        }}>
          {domain.domain_name}
        </div>
      )}
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {domain.topics.map((topic: ErrorProneTopic) => (
          <div key={topic.topic} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-md)',
            border: '1px solid oklch(from var(--danger) l c h / 0.1)',
            marginLeft: domain.domain_name !== '未分类' ? 'var(--space-4)' : 0,
          }}>
            <div style={{ fontWeight: 500 }}>{topic.topic}</div>
            <span className="badge badge-danger">错误 {topic.error_count} 次</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DynamicProfilePage() {
  const [profile, setProfile] = useState<ProfileV2Response | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showAddKnowledge, setShowAddKnowledge] = useState(false)
  const [showAddErrorTopic, setShowAddErrorTopic] = useState(false)
  const [newKnowledge, setNewKnowledge] = useState({ knowledge_point: '', score: 0.5, confidence: 0.5 })
  const [newErrorTopic, setNewErrorTopic] = useState({ topic: '', error_count: 1 })
  const navigate = useNavigate()

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    try {
      const response = await profileV2Api.getProfile()
      setProfile(response.data)
    } catch (err: any) {
      if (err.response?.status === 404) navigate('/profile/init')
      else setError(err.response?.data?.detail || '获取画像失败')
    } finally { setIsLoading(false) }
  }

  const handleAddKnowledge = async () => {
    try {
      await profileV2Api.addKnowledge(newKnowledge)
      setMessage('知识点添加成功')
      setShowAddKnowledge(false)
      setNewKnowledge({ knowledge_point: '', score: 0.5, confidence: 0.5 })
      loadProfile()
    } catch (err: any) { setError(err.response?.data?.detail || '添加知识点失败') }
  }

  const handleDeleteKnowledge = async (knowledgePoint: string) => {
    try {
      await profileV2Api.deleteKnowledge(knowledgePoint)
      setMessage('知识点删除成功')
      loadProfile()
    } catch (err: any) { setError(err.response?.data?.detail || '删除知识点失败') }
  }

  const handleAddErrorTopic = async () => {
    try {
      await profileV2Api.addErrorTopic(newErrorTopic)
      setMessage('易错点添加成功')
      setShowAddErrorTopic(false)
      setNewErrorTopic({ topic: '', error_count: 1 })
      loadProfile()
    } catch (err: any) { setError(err.response?.data?.detail || '添加易错点失败') }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--gray-400)', fontFamily: 'var(--font-body)' }}>
        加载中...
      </div>
    )
  }

  const statCards = [
    {
      label: '认知风格',
      value: profile?.cognitive_style
        ? (COGNITIVE_STYLE_MAP[profile.cognitive_style.style_type]?.label || profile.cognitive_style.style_type)
        : '未设置',
      sub: profile?.cognitive_style ? `置信度 ${Math.round(profile.cognitive_style.confidence * 100)}%` : null,
      icon: <BrainIcon />,
      color: 'var(--primary)',
    },
    {
      label: '知识点',
      value: String(
        profile?.knowledge_mastery.reduce(
          (sum, sub) => sum + sub.domains.reduce((s, d) => s + d.knowledge_points.length, 0),
          0
        ) || 0
      ),
      icon: <BookOpenIcon />,
      color: 'var(--primary)',
    },
    {
      label: '易错点',
      value: String(
        profile?.error_prone_topics.reduce(
          (sum, sub) => sum + sub.domains.reduce((s, d) => s + d.topics.length, 0),
          0
        ) || 0
      ),
      icon: <AlertTriangleIcon />,
      color: 'var(--danger)',
    },
    {
      label: '元认知校准',
      value: `${((profile?.metacognitive_calibration || 0) * 100).toFixed(0)}%`,
      sub: getTrendLabel(profile?.metacognitive_calibration ?? 0.5, 0.5),
      icon: <TargetIcon />,
      color: getScoreHexColor(profile?.metacognitive_calibration ?? 0),
      alert: getAlert('calibration', profile?.metacognitive_calibration ?? 0.5),
    },
    {
      label: '注意力特征',
      value: `${((profile?.attention_feature || 0) * 100).toFixed(0)}%`,
      sub: getTrendLabel(profile?.attention_feature ?? 0.5, 0.5),
      icon: <TrendingUpIcon />,
      color: getScoreHexColor(profile?.attention_feature ?? 0.5),
      alert: getAlert('attention', profile?.attention_feature ?? 0.5),
    },
    {
      label: '学习节奏',
      value: `${((profile?.learning_rhythm?.scalar ?? 0.5) * 100).toFixed(0)}%`,
      sub: profile?.learning_rhythm?.preferred_unit
        ? `偏好单元: ${Math.round(profile.learning_rhythm.preferred_unit / 60)}分`
        : getTrendLabel(profile?.learning_rhythm?.scalar ?? 0.5, 0.5),
      icon: <ClockIcon />,
      color: getScoreHexColor(profile?.learning_rhythm?.scalar ?? 0.5),
      alert: getAlert('rhythm', profile?.learning_rhythm?.scalar ?? 0.5),
    },
  ]

  return (
    <div className="fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="btn btn-secondary"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-6)',
        }}
      >
        <ArrowLeftIcon /> 首页
      </button>

      <h1 style={{
        fontSize: '1.5rem', marginBottom: 'var(--space-6)',
        fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em',
      }}>
        动态画像
      </h1>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error} <button onClick={() => setError('')} style={{ marginLeft: 'var(--space-2)', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', float: 'right' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>}
      {message && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{message} <button onClick={() => setMessage('')} style={{ marginLeft: 'var(--space-2)', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', float: 'right' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>}

      {/* Dashboard Charts */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 'var(--space-4)', marginBottom: 'var(--space-8)',
      }}>
        {/* Radar Chart */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TargetIcon /> 学习画像维度
          </h3>
          {hasRealLearningData(profile) ? (
            <>
              <RadarChart
                dimensions={[
                  { name: '元认知校准', value: profile?.metacognitive_calibration ?? 0, color: 'var(--app-success)' },
                  { name: '注意力特征', value: profile?.attention_feature ?? 0, color: 'var(--app-indigo)' },
                  { name: '学习节奏', value: profile?.learning_rhythm?.scalar ?? 0, color: 'var(--app-warning)' },
                ]}
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
                {[
                  { label: '元认知', value: profile?.metacognitive_calibration ?? 0, color: 'var(--app-success)' },
                  { label: '注意力', value: profile?.attention_feature ?? 0, color: 'var(--app-indigo)' },
                  { label: '学习节奏', value: profile?.learning_rhythm?.scalar ?? 0, color: 'var(--app-warning)' },
                ].map(d => (
                  <div key={d.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--app-text-muted)' }}>{d.label}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: d.color }}>
                      {d.value > 0 ? `${(d.value * 100).toFixed(0)}%` : '--'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🧠</div>
                <p>尚无学习数据，完成学习和练习后自动生成画像</p>
              </div>
            </div>
          )}
        </div>

        {/* Trend Chart */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUpIcon /> 掌握度趋势
          </h3>
          {profile?.knowledge_mastery && profile.knowledge_mastery.length > 0 ? (
            <TrendChart
              data={buildTrendData(profile.knowledge_mastery)}
              height={220}
              color="#1677E8"
            />
          ) : (
            <div className="empty-state" style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📈</div>
                <p>尚无学习数据，完成知识点学习后将自动生成趋势图</p>
                <button
                  onClick={() => navigate('/path')}
                  className="btn btn-primary"
                  style={{ marginTop: 'var(--space-2)', fontSize: '0.8125rem' }}
                >
                  开始学习
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ClockIcon /> 学习活跃度
        </h3>
        {profile?.active_hours && Object.keys(profile.active_hours).length > 0 ? (
          <HeatmapCalendar
            data={buildHeatmapData(profile)}
          />
        ) : (
          <div className="empty-state" style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📅</div>
              <p>尚未记录学习行为，开始学习后自动追踪活跃度</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {statCards.map((stat: any) => (
          <div key={stat.label} className="card" style={{
            padding: 'var(--space-4)', animation: 'fadeIn 0.3s ease-out',
            borderLeft: stat.alert ? `3px solid ${stat.color}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <h3 style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', fontWeight: 500, margin: 0, fontFamily: 'var(--font-body)' }}>
                {stat.label}
              </h3>
              <span style={{ color: stat.color, opacity: 0.6, flexShrink: 0 }}>{stat.icon}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              {stat.value}
            </div>
            {stat.sub && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 'var(--space-1)' }}>{stat.sub}</div>}
            {stat.alert && (
              <div style={{
                marginTop: 'var(--space-2)', padding: '6px 10px', borderRadius: 6,
                fontSize: '0.75rem', lineHeight: 1.4,
                background: stat.color === 'var(--app-danger)' ? 'var(--app-bg-danger)' : stat.color === 'var(--app-warning)' ? '#FFFBEB' : '#ECFDF5',
                color: stat.color,
              }}>
                <AlertTriangleIcon /> {stat.alert}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active hours */}
      {profile?.active_hours && Object.keys(profile.active_hours).length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-heading)' }}>
            活跃时间分布
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
            {Object.entries(profile.active_hours).map(([period, value]) => {
              const label = period === 'morning' ? '上午' : period === 'afternoon' ? '下午' : period === 'evening' ? '傍晚' : '夜晚'
              return (
                <div key={period} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: 'var(--space-2)' }}>{label}</div>
                  <div style={{ height: '8px', backgroundColor: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${value * 100}%`, backgroundColor: 'var(--primary)', borderRadius: 'var(--radius-full)', transition: 'width var(--transition-slow)' }} />
                  </div>
                  <div style={{ fontSize: '0.875rem', marginTop: 'var(--space-1)', color: 'var(--gray-700)', fontFamily: 'var(--font-heading)' }}>
                    {(value * 100).toFixed(0)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Knowledge mastery — hierarchical by subject → domain */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-heading)' }}>知识点掌握</h2>
          <button onClick={() => setShowAddKnowledge(!showAddKnowledge)} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <PlusIcon /> 添加知识点
          </button>
        </div>

        {showAddKnowledge && (
          <div className="fade-in" style={{ backgroundColor: 'var(--gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <input type="text" className="input" placeholder="知识点名称" value={newKnowledge.knowledge_point}
                onChange={e => setNewKnowledge({ ...newKnowledge, knowledge_point: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', marginBottom: 'var(--space-1)' }}>掌握度 (0-1)</label>
                  <input type="number" className="input" min="0" max="1" step="0.1" value={newKnowledge.score}
                    onChange={e => setNewKnowledge({ ...newKnowledge, score: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', marginBottom: 'var(--space-1)' }}>置信度 (0-1)</label>
                  <input type="number" className="input" min="0" max="1" step="0.1" value={newKnowledge.confidence}
                    onChange={e => setNewKnowledge({ ...newKnowledge, confidence: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button onClick={handleAddKnowledge} className="btn btn-primary">确认添加</button>
                <button onClick={() => setShowAddKnowledge(false)} className="btn btn-secondary">取消</button>
              </div>
            </div>
          </div>
        )}

        {!profile?.knowledge_mastery.length ? (
          <div className="empty-state"><p>暂无知识点</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {profile.knowledge_mastery.map((subject: SubjectMastery) => (
              <SubjectSection
                key={subject.subject_id || subject.subject_name}
                subject={subject}
                onDeleteKnowledge={handleDeleteKnowledge}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error-prone topics */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-heading)' }}>易错点</h2>
          <button onClick={() => setShowAddErrorTopic(!showAddErrorTopic)} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <PlusIcon /> 添加易错点
          </button>
        </div>

        {showAddErrorTopic && (
          <div className="fade-in" style={{ backgroundColor: 'var(--gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <input type="text" className="input" placeholder="易错点名称" value={newErrorTopic.topic}
                onChange={e => setNewErrorTopic({ ...newErrorTopic, topic: e.target.value })} />
              <div>
                <label style={{ fontSize: '0.75rem', marginBottom: 'var(--space-1)' }}>错误次数</label>
                <input type="number" className="input" min="1" value={newErrorTopic.error_count}
                  onChange={e => setNewErrorTopic({ ...newErrorTopic, error_count: parseInt(e.target.value) })} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button onClick={handleAddErrorTopic} className="btn btn-primary">确认添加</button>
                <button onClick={() => setShowAddErrorTopic(false)} className="btn btn-secondary">取消</button>
              </div>
            </div>
          </div>
        )}

        {!profile?.error_prone_topics.length ? (
          <div className="empty-state"><p>暂无易错点</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {profile.error_prone_topics.map((subj: ErrorProneSubject) => (
              <ErrorProneSubjectSection key={subj.subject_id || subj.subject_name} subject={subj} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
