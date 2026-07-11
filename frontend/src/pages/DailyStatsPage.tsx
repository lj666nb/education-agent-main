import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionBankApi, type DailyStatsItem } from '../api/questionBank'
import AccuracyChart from '../components/AccuracyChart'
import {
  ArrowRightIcon,
  BarChartIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  TargetIcon,
  TrendingUpIcon,
  ZapIcon,
} from '../components/Icons'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/shared'
import './DailyStatsPage.css'

const DAY_OPTIONS = [7, 30, 90]

export default function DailyStatsPage() {
  const { bankId: paramsBankId } = useParams<{ bankId: string }>()
  const navigate = useNavigate()
  const [items, setItems] = useState<DailyStatsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(7)
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([])
  const [selectedBankId, setSelectedBankId] = useState(paramsBankId || '')
  const [selectedMode, setSelectedMode] = useState('')

  useEffect(() => {
    if (paramsBankId) return
    questionBankApi.listBanks({ page_size: 100 })
      .then(response => setBanks(response.data.banks))
      .catch(() => undefined)
  }, [paramsBankId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    questionBankApi.getDailyStats({
      bank_id: selectedBankId || undefined,
      mode: selectedMode || undefined,
      days,
    }).then(response => {
      if (!cancelled) setItems(response.data.items)
    }).catch(() => {
      if (!cancelled) setError('加载统计数据失败')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [selectedBankId, selectedMode, days])

  const analysis = useMemo(() => analyze(items, days), [items, days])

  return (
    <div className="analysis-page">
      <div className="analysis-shell">
        <PageHeader backTo={paramsBankId ? `/banks/${paramsBankId}` : '/banks'} title="学习分析" />

        <section className="analysis-hero">
          <div className="analysis-hero-copy">
            <span className="analysis-kicker"><span /> LEARNING SIGNAL</span>
            <h1>把每次练习，变成下一步行动</h1>
            <p>从正确率、投入时长和练习节奏三个维度查看近期状态，找到最值得加强的一环。</p>
          </div>
          <div className="analysis-hero-score" aria-label={`综合状态 ${analysis.score} 分`}>
            <div className="analysis-score-ring" style={{ '--score': analysis.score } as React.CSSProperties}>
              <strong>{analysis.score}</strong><span>状态分</span>
            </div>
            <p>{analysis.summary}</p>
          </div>
        </section>

        <section className="analysis-toolbar" aria-label="统计筛选">
          <div className="analysis-selects">
            {!paramsBankId && (
              <label><span>题库</span><select value={selectedBankId} onChange={event => setSelectedBankId(event.target.value)}>
                <option value="">全部题库</option>
                {banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
              </select></label>
            )}
            <label><span>练习模式</span><select value={selectedMode} onChange={event => setSelectedMode(event.target.value)}>
              <option value="">全部模式</option>
              <option value="random">随机练习</option>
              <option value="sequential">顺序练习</option>
              <option value="exam">模拟考试</option>
            </select></label>
          </div>
          <div className="analysis-range" aria-label="统计周期">
            {DAY_OPTIONS.map(option => (
              <button key={option} className={days === option ? 'is-active' : ''} onClick={() => setDays(option)}>{option} 天</button>
            ))}
          </div>
        </section>

        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : items.length === 0 ? (
          <section className="analysis-empty-card">
            <EmptyState icon={<BarChartIcon size={48} />} title="还没有可分析的练习" description="完成一组练习后，这里会生成趋势、投入与节奏建议。" />
            <button onClick={() => navigate('/banks')}>选择题库开始练习 <ArrowRightIcon size={15} /></button>
          </section>
        ) : (
          <>
            <section className="analysis-metrics">
              <Metric icon={<CheckCircleIcon />} label="综合正确率" value={`${analysis.accuracy}%`} note={analysis.accuracyNote} tone="blue" />
              <Metric icon={<ZapIcon />} label="累计答题" value={String(analysis.totalQuestions)} note={`${analysis.activeDays} 个活跃日`} tone="violet" />
              <Metric icon={<ClockIcon />} label="专注时长" value={formatDuration(analysis.totalSeconds)} note={`${analysis.sessions} 次练习会话`} tone="green" />
              <Metric icon={<TrendingUpIcon />} label="当前连续" value={`${analysis.currentStreak} 天`} note={`最长连续 ${analysis.longestStreak} 天`} tone="orange" />
            </section>

            <section className="analysis-grid">
              <article className="analysis-card analysis-trend-card">
                <CardHeading eyebrow="趋势" title="正确率走势" detail={`${days} 天内共完成 ${analysis.totalQuestions} 题`} />
                <div className="analysis-chart"><AccuracyChart data={analysis.sortedItems.map(item => ({ date: item.date, accuracy: item.accuracy, total_questions: item.total_questions }))} /></div>
              </article>

              <article className="analysis-card analysis-diagnosis">
                <CardHeading eyebrow="诊断" title="学习状态拆解" detail="根据当前筛选实时计算" />
                <Diagnosis label="答题质量" value={analysis.accuracy} note={analysis.accuracy >= 80 ? '正确率保持在目标区间' : '先复盘错题，再增加新题'} color="#1677E8" />
                <Diagnosis label="练习节奏" value={analysis.consistency} note={`${analysis.activeDays}/${days} 天有练习记录`} color="#6D5BD0" />
                <Diagnosis label="训练投入" value={analysis.volumeProgress} note={`周期目标 ${analysis.volumeTarget} 题`} color="#0F9F7F" />
                <div className="analysis-prescription">
                  <TargetIcon size={18} />
                  <div><strong>下一步建议</strong><p>{analysis.advice}</p></div>
                </div>
              </article>
            </section>

            <section className="analysis-card analysis-pulse-card">
              <CardHeading eyebrow="节奏" title="练习脉冲" detail="柱高表示题量，圆点颜色表示当日正确率" />
              <div className="analysis-pulse-scroll">
                <div className="analysis-pulse" style={{ minWidth: Math.max(620, analysis.timeline.length * 34) }}>
                  {analysis.timeline.map(day => (
                    <div className="analysis-pulse-day" key={day.date} title={`${day.date} · ${day.total_questions} 题 · 正确率 ${day.accuracy}%`}>
                      <div className="analysis-pulse-track">
                        <span className="analysis-pulse-bar" style={{ height: `${Math.max(day.total_questions ? 10 : 2, day.height)}%` }} />
                        {day.total_questions > 0 && <i style={{ bottom: `${Math.max(5, day.height)}%` }} className={day.accuracy >= 80 ? 'good' : day.accuracy >= 60 ? 'medium' : 'low'} />}
                      </div>
                      <span>{formatDay(day.date, analysis.timeline.length)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="analysis-lower-grid">
              <article className="analysis-card analysis-highlight">
                <FlagIcon size={20} />
                <span>本周期表现最好的一天</span>
                <strong>{analysis.bestDay ? formatFullDate(analysis.bestDay.date) : '暂无'}</strong>
                <p>{analysis.bestDay ? `${analysis.bestDay.total_questions} 题 · ${analysis.bestDay.accuracy}% 正确率` : '继续完成练习来刷新记录'}</p>
              </article>

              <article className="analysis-card analysis-table-card">
                <CardHeading eyebrow="明细" title="每日练习记录" detail={`平均每个活跃日 ${analysis.avgDaily} 题`} />
                <div className="analysis-table-wrap">
                  <table>
                    <thead><tr><th>日期</th><th>题量</th><th>正确 / 错误</th><th>时长</th><th>正确率</th></tr></thead>
                    <tbody>{analysis.sortedItems.slice().reverse().map(item => (
                      <tr key={item.date}>
                        <td>{formatFullDate(item.date)}</td>
                        <td>{item.total_questions}</td>
                        <td><span className="analysis-correct">{item.correct_count}</span> / <span className="analysis-wrong">{item.incorrect_count}</span></td>
                        <td>{formatDuration(item.total_time_spent_seconds)}</td>
                        <td><span className={`analysis-accuracy is-${item.accuracy >= 80 ? 'good' : item.accuracy >= 60 ? 'medium' : 'low'}`}>{item.accuracy}%</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className={`analysis-metric is-${tone}`}><span className="analysis-metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>
}

function CardHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="analysis-card-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div><p>{detail}</p></div>
}

function Diagnosis({ label, value, note, color }: { label: string; value: number; note: string; color: string }) {
  return <div className="analysis-diagnosis-row"><div><strong>{label}</strong><span>{value}%</span></div><div className="analysis-meter"><i style={{ width: `${value}%`, background: color }} /></div><p>{note}</p></div>
}

function analyze(items: DailyStatsItem[], days: number) {
  const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const totalQuestions = sortedItems.reduce((sum, item) => sum + item.total_questions, 0)
  const totalCorrect = sortedItems.reduce((sum, item) => sum + item.correct_count, 0)
  const totalSeconds = sortedItems.reduce((sum, item) => sum + (item.total_time_spent_seconds || 0), 0)
  const sessions = sortedItems.reduce((sum, item) => sum + (item.session_count || 0), 0)
  const activeItems = sortedItems.filter(item => item.total_questions > 0)
  const activeDays = activeItems.length
  const accuracy = totalQuestions ? Math.round(totalCorrect / totalQuestions * 100) : 0
  const consistency = Math.min(100, Math.round(activeDays / Math.max(1, days) * 100))
  const volumeTarget = Math.max(35, days * 5)
  const volumeProgress = Math.min(100, Math.round(totalQuestions / volumeTarget * 100))
  const { current: currentStreak, longest: longestStreak } = streaks(activeItems.map(item => item.date))
  const score = Math.round(accuracy * 0.55 + consistency * 0.25 + volumeProgress * 0.2)
  const bestDay = activeItems.reduce<DailyStatsItem | null>((best, item) => !best || item.accuracy * item.total_questions > best.accuracy * best.total_questions ? item : best, null)
  const avgDaily = activeDays ? Math.round(totalQuestions / activeDays) : 0
  const timeline = buildTimeline(sortedItems, days)
  const summary = score >= 85 ? '状态优秀' : score >= 70 ? '稳步推进' : score >= 55 ? '节奏待稳' : '需要启动'
  const accuracyNote = accuracy >= 80 ? '已达到推荐目标' : accuracy >= 60 ? '距离 80% 目标仍有空间' : '建议优先处理错题'
  const advice = accuracy < 60
    ? '先进入错题本复盘最近错误，再完成一组 5 题巩固练习。'
    : consistency < 35
      ? '正确率不错，但练习间隔偏长；尝试连续 3 天各完成一组短练习。'
      : volumeProgress < 60
        ? '节奏已经形成，可以适度增加每次练习题量，巩固稳定性。'
        : '继续保持当前节奏，并把下一组练习放到薄弱知识点上。'
  return { sortedItems, totalQuestions, totalSeconds, sessions, activeDays, accuracy, consistency, volumeTarget, volumeProgress, currentStreak, longestStreak, score, bestDay, avgDaily, timeline, summary, accuracyNote, advice }
}

function buildTimeline(items: DailyStatsItem[], days: number) {
  const map = new Map(items.map(item => [item.date, item]))
  const dates: string[] = []
  const end = new Date()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end)
    date.setDate(end.getDate() - offset)
    dates.push(toLocalDate(date))
  }
  const max = Math.max(1, ...items.map(item => item.total_questions))
  return dates.map(date => {
    const item = map.get(date)
    return { date, total_questions: item?.total_questions || 0, accuracy: item?.accuracy || 0, height: Math.round((item?.total_questions || 0) / max * 88) }
  })
}

function streaks(dates: string[]) {
  if (!dates.length) return { current: 0, longest: 0 }
  let longest = 1
  let run = 1
  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(`${dates[index - 1]}T00:00:00`)
    const current = new Date(`${dates[index]}T00:00:00`)
    run = Math.round((current.getTime() - previous.getTime()) / 86400000) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  const last = new Date(`${dates[dates.length - 1]}T00:00:00`)
  const today = new Date(`${toLocalDate(new Date())}T00:00:00`)
  const gap = Math.round((today.getTime() - last.getTime()) / 86400000)
  return { current: gap <= 1 ? run : 0, longest }
}

function toLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDuration(seconds: number) {
  if (!seconds) return '0 分钟'
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} 分钟`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round(seconds % 3600 / 60)
  return `${hours}小时${minutes ? `${minutes}分` : ''}`
}

function formatFullDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`))
}

function formatDay(date: string, count: number) {
  if (count > 31) return date.endsWith('-01') ? `${Number(date.slice(5, 7))}月` : ''
  if (count > 10) return Number(date.slice(-2)) % 3 === 1 ? date.slice(5).replace('-', '/') : ''
  return date.slice(5).replace('-', '/')
}
