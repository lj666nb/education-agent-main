import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Brain, Code2, Compass, Crosshair, Gauge, Sparkles, Target } from 'lucide-react'
import { profileV2Api } from '../api'
import type { KnowledgeMastery, ProfileV2Response } from '../types/profile'
import './DynamicProfilePage.css'

type FlatPoint = KnowledgeMastery & { subject: string; domain: string }
type Tone = 'excellent' | 'good' | 'developing' | 'weak'
type AbilityKey = 'mastery' | 'coding' | 'stability' | 'focus' | 'calibration'

interface AbilityDimension {
  key: AbilityKey
  label: string
  short: string
  value: number
  color: string
}

const CODE_KEYWORDS = ['代码', '编程', '程序', '算法', 'python', 'java', 'javascript', '函数', '循环', '数组', '列表', '调试']

const STYLE_LABELS: Record<string, string> = {
  visual: '图示优先',
  auditory: '讲解优先',
  reading_writing: '读写优先',
  kinesthetic: '动手优先',
  mixed: '混合学习',
}

const ABILITY_ICONS: Record<AbilityKey, JSX.Element> = {
  mastery: <Brain size={17} />,
  coding: <Code2 size={17} />,
  stability: <Gauge size={17} />,
  focus: <Crosshair size={17} />,
  calibration: <Compass size={17} />,
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

function averageOf(values: number[], fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback
}

function levelFor(score: number): { name: string; tone: Tone; oneLine: string } {
  if (score >= 0.85) return { name: '熟练', tone: 'excellent', oneLine: '整体稳定，可以挑战综合题' }
  if (score >= 0.7) return { name: '进阶', tone: 'good', oneLine: '基础扎实，短板可控' }
  if (score >= 0.5) return { name: '基础', tone: 'developing', oneLine: '框架已建立，需要专项巩固' }
  return { name: '起步', tone: 'weak', oneLine: '先补核心概念最有效' }
}

function pointLooksLikeCode(point: FlatPoint) {
  const text = `${point.knowledge_point} ${point.domain} ${point.subject}`.toLowerCase()
  return CODE_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()))
}

function formatPercent(value: number) {
  return `${Math.round(clamp(value) * 100)}%`
}

function polarPoint(center: number, radius: number, index: number, total: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  }
}

function polygonFor(dimensions: AbilityDimension[], center = 140, maxRadius = 94) {
  return dimensions
    .map((dimension, index) => {
      const point = polarPoint(center, maxRadius * clamp(dimension.value), index, dimensions.length)
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
    })
    .join(' ')
}

function topPoints(points: FlatPoint[], direction: 'strong' | 'weak') {
  return [...points]
    .sort((a, b) => direction === 'strong' ? b.score - a.score : a.score - b.score)
    .slice(0, 2)
}

export default function DynamicProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileV2Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    profileV2Api.getProfile()
      .then(res => setProfile(res.data))
      .catch((err: any) => {
        if (err.response?.status === 404) navigate('/profile/init')
        else setError(err.response?.data?.detail || '学习画像加载失败，请稍后重试')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  const points = useMemo<FlatPoint[]>(() => {
    if (!profile) return []
    return profile.knowledge_mastery.flatMap(subject =>
      subject.domains.flatMap(domain =>
        domain.knowledge_points.map(point => ({
          ...point,
          subject: subject.subject_name,
          domain: domain.domain_name,
        })),
      ),
    )
  }, [profile])

  const profileInsight = useMemo(() => {
    const mastery = averageOf(points.map(point => clamp(point.score)), 0)
    const confidence = averageOf(points.map(point => clamp(point.confidence)), mastery)
    const codePoints = points.filter(pointLooksLikeCode)
    const coding = averageOf(codePoints.map(point => clamp(point.score)), points.length ? mastery : 0)
    const focus = clamp(profile?.attention_feature ?? 0)
    const calibration = clamp(profile?.metacognitive_calibration ?? 0)
    const dimensions: AbilityDimension[] = [
      { key: 'mastery', label: '知识掌握', short: '掌握', value: mastery, color: '#24A1B2' },
      { key: 'coding', label: '代码实现', short: '代码', value: coding, color: '#6E63D6' },
      { key: 'stability', label: '发挥稳定', short: '稳定', value: confidence, color: '#E79B37' },
      { key: 'focus', label: '专注投入', short: '专注', value: focus, color: '#2AA66A' },
      { key: 'calibration', label: '自我校准', short: '校准', value: calibration, color: '#E35D6A' },
    ]
    const overall = averageOf(dimensions.map(item => item.value), 0)
    const weak = topPoints(points, 'weak')
    const strong = topPoints(points, 'strong')
    const lowestAbility = [...dimensions].sort((a, b) => a.value - b.value)[0]
    const highestAbility = [...dimensions].sort((a, b) => b.value - a.value)[0]

    return {
      dimensions,
      overall,
      level: levelFor(overall),
      weak,
      strong,
      lowestAbility,
      highestAbility,
      styleLabel: profile?.cognitive_style ? STYLE_LABELS[profile.cognitive_style.style_type] : '持续观察',
    }
  }, [points, profile])

  const scorePercent = Math.round(profileInsight.overall * 100)
  const crystalPoints = polygonFor(profileInsight.dimensions)
  const crystalStyle = { '--score': `${scorePercent}%` } as CSSProperties

  if (loading) {
    return <div className="profile-loading"><span className="profile-loading-dot" />生成学习画像</div>
  }

  if (error || !profile) {
    return (
      <div className="profile-empty">
        <h2>暂时无法生成学习画像</h2>
        <p>{error || '完成一次练习后，这里会自动生成。'}</p>
        <button className="profile-primary-action" onClick={() => navigate('/banks')}>去做题</button>
      </div>
    )
  }

  return (
    <main className="learning-profile focus-profile">
      <nav className="profile-topbar" aria-label="学习画像导航">
        <button className="profile-back" onClick={() => navigate('/')} aria-label="返回首页">
          <ArrowLeft size={18} />
        </button>
        <button className="profile-review-link" onClick={() => navigate('/review')}>
          复习中心 <ArrowRight size={15} />
        </button>
      </nav>

      <section className={`profile-conclusion ${profileInsight.level.tone}`}>
        <div className="conclusion-copy">
          <span className="profile-eyebrow">动态学习画像</span>
          <h1>{profileInsight.level.name}</h1>
          <p>{profileInsight.level.oneLine}</p>
          <div className="conclusion-tags" aria-label="学习结论标签">
            <span><Sparkles size={14} />{profileInsight.styleLabel}</span>
            <span><Target size={14} />{profileInsight.lowestAbility?.short || '观察'}待加强</span>
          </div>
        </div>

        <div className="score-orb" style={crystalStyle} aria-label={`综合能力 ${scorePercent}%`}>
          <div className="score-orb-inner">
            <span>综合能力</span>
            <strong>{scorePercent}</strong>
            <small>%</small>
          </div>
        </div>

      </section>

      <section className="ability-portrait" aria-label="能力维度画像">
        <div className="ability-crystal" aria-hidden="true">
          <svg viewBox="0 0 280 280" role="img">
            <defs>
              <radialGradient id="profileCrystalGlow" cx="50%" cy="45%" r="70%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".92" />
                <stop offset="48%" stopColor="#BFEAF0" stopOpacity=".54" />
                <stop offset="100%" stopColor="#235E90" stopOpacity=".1" />
              </radialGradient>
              <linearGradient id="profileCrystalStroke" x1="40" y1="40" x2="240" y2="240">
                <stop offset="0%" stopColor="#24A1B2" />
                <stop offset="45%" stopColor="#6E63D6" />
                <stop offset="100%" stopColor="#E35D6A" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75, 1].map(ring => (
              <polygon
                key={ring}
                className="crystal-ring"
                points={profileInsight.dimensions
                  .map((_, index) => {
                    const point = polarPoint(140, 94 * ring, index, profileInsight.dimensions.length)
                    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
                  })
                  .join(' ')}
              />
            ))}

            {profileInsight.dimensions.map((dimension, index) => {
              const axis = polarPoint(140, 104, index, profileInsight.dimensions.length)
              const dot = polarPoint(140, 94 * clamp(dimension.value), index, profileInsight.dimensions.length)
              return (
                <g key={dimension.key}>
                  <line className="crystal-axis" x1="140" y1="140" x2={axis.x} y2={axis.y} />
                  <circle className="crystal-dot" cx={dot.x} cy={dot.y} r="4.5" style={{ '--dot-color': dimension.color } as CSSProperties} />
                </g>
              )
            })}

            <polygon className="crystal-face" points={crystalPoints} />
            <polygon className="crystal-edge" points={crystalPoints} />
          </svg>

          <div className="crystal-labels">
            {profileInsight.dimensions.map((dimension, index) => {
              const labelPoint = polarPoint(50, 47, index, profileInsight.dimensions.length)
              return (
                <span
                  key={dimension.key}
                  className={`crystal-label label-${dimension.key}`}
                  style={{ left: `${labelPoint.x}%`, top: `${labelPoint.y}%` }}
                >
                  {dimension.short}
                </span>
              )
            })}
          </div>
        </div>

        <div className="ability-board">
          <div className="ability-board-heading">
            <span>能力维度</span>
            <strong>{profileInsight.highestAbility?.label || '持续观察'}</strong>
          </div>

          <div className="ability-bars">
            {profileInsight.dimensions.map(dimension => (
              <article className="ability-row" key={dimension.key}>
                <div className="ability-row-title">
                  <span style={{ color: dimension.color }}>{ABILITY_ICONS[dimension.key]}</span>
                  <strong>{dimension.label}</strong>
                  <b>{formatPercent(dimension.value)}</b>
                </div>
                <div className="ability-track">
                  <span style={{ width: formatPercent(dimension.value), background: dimension.color }} />
                </div>
              </article>
            ))}
          </div>

          <div className="knowledge-pills" aria-label="知识点提示">
            {profileInsight.strong.map(point => (
              <span className="pill strong" key={`strong-${point.knowledge_point}`}>{point.knowledge_point}</span>
            ))}
            {profileInsight.weak.map(point => (
              <span className="pill weak" key={`weak-${point.knowledge_point}`}>{point.knowledge_point}</span>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
