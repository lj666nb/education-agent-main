import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BookOpen, BrainCircuit, Check, ChevronDown, Code2,
  ExternalLink, Flame, ListFilter, Loader2, Play, RefreshCw,
  Search, Sparkles, Target, TriangleAlert, X,
} from 'lucide-react'
import { reviewApi, type DueKnowledgePoint } from '../api/review'
import { questionBankApi, type WrongAnswerItem } from '../api/questionBank'
import './ReviewCenterPage.css'

type QuestionKind = 'all' | 'quiz' | 'code'

interface KnowledgeMeta {
  name: string
  domain: string
  subject: string
}

interface WrongGroup {
  id: string
  meta: KnowledgeMeta
  items: WrongAnswerItem[]
  codeCount: number
}

const questionTypeLabel: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', essay: '论述题', programming: '代码题',
}

const difficultyLabel: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '困难', competition: '竞赛',
}

const plainText = (value = '') => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

function learningLinks(name: string, hasCode: boolean) {
  const q = encodeURIComponent(name)
  const links = [
    {
      name: 'OI Wiki',
      note: '算法与数据结构原理',
      href: `https://cn.bing.com/search?q=site%3Aoi-wiki.org+${q}`,
      tone: 'cyan',
    },
    {
      name: '中国大学 MOOC',
      note: '系统课程与章节讲解',
      href: `https://www.icourse163.org/search.htm?search=${q}`,
      tone: 'blue',
    },
    {
      name: hasCode ? 'LeetCode' : 'Bilibili',
      note: hasCode ? '同类代码题专项训练' : '换一种方式听讲解',
      href: hasCode
        ? `https://leetcode.cn/problemset/?search=${q}`
        : `https://search.bilibili.com/all?keyword=${q}`,
      tone: hasCode ? 'orange' : 'pink',
    },
  ]
  return links
}

export default function ReviewCenterPage() {
  const navigate = useNavigate()
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerItem[]>([])
  const [duePoints, setDuePoints] = useState<DueKnowledgePoint[]>([])
  const [knowledgeMeta, setKnowledgeMeta] = useState<Record<string, KnowledgeMeta>>({})
  const [todayProgress, setTodayProgress] = useState({ reviewed: 0, total_due: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeKnowledge, setActiveKnowledge] = useState('all')
  const [kind, setKind] = useState<QuestionKind>('all')
  const [search, setSearch] = useState('')
  const [startingId, setStartingId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [showAllDue, setShowAllDue] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dashboard, wrong, subjects] = await Promise.all([
        reviewApi.getDashboard(),
        questionBankApi.listWrongAnswers({ page: 1, page_size: 100 }),
        questionBankApi.listSubjects(),
      ])
      const meta: Record<string, KnowledgeMeta> = {}
      subjects.data.subjects.forEach(subject => subject.domains.forEach(domain =>
        domain.knowledge_points.forEach(point => {
          meta[point.id] = { name: point.name, domain: domain.name, subject: subject.name }
        }),
      ))
      setKnowledgeMeta(meta)
      setWrongAnswers(wrong.data.items || [])
      setDuePoints(dashboard.data.due_points || [])
      setTodayProgress(dashboard.data.today_progress)
    } catch (err) {
      console.error(err)
      setError('复习数据没有加载成功，请检查网络后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo<WrongGroup[]>(() => {
    const map = new Map<string, WrongGroup>()
    wrongAnswers.forEach(item => {
      const ids = item.question?.knowledge_point_uuids?.length
        ? item.question.knowledge_point_uuids
        : ['uncategorized']
      ids.forEach(id => {
        const meta = knowledgeMeta[id] || {
          name: id === 'uncategorized' ? '待归类' : `知识点 ${id.slice(0, 6)}`,
          domain: '其他', subject: '未归类',
        }
        if (!map.has(id)) map.set(id, { id, meta, items: [], codeCount: 0 })
        const group = map.get(id)!
        if (!group.items.some(existing => existing.id === item.id)) group.items.push(item)
        if (item.question?.type === 'programming') group.codeCount += 1
      })
    })
    return [...map.values()].sort((a, b) => b.items.length - a.items.length)
  }, [wrongAnswers, knowledgeMeta])

  const visibleGroups = useMemo(() => groups
    .filter(group => activeKnowledge === 'all' || group.id === activeKnowledge)
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const isCode = item.question?.type === 'programming'
        const matchesKind = kind === 'all' || (kind === 'code' ? isCode : !isCode)
        const matchesSearch = !search.trim() ||
          group.meta.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          plainText(item.question?.content?.stem).toLowerCase().includes(search.trim().toLowerCase())
        return matchesKind && matchesSearch
      }),
    }))
    .filter(group => group.items.length > 0), [groups, activeKnowledge, kind, search])

  const codeTotal = wrongAnswers.filter(item => item.question?.type === 'programming').length
  const repeatedTotal = wrongAnswers.filter(item => item.wrong_count > 1).length
  const progress = todayProgress.total_due
    ? Math.min(100, Math.round(todayProgress.reviewed / todayProgress.total_due * 100))
    : 100

  const openQuestion = async (item: WrongAnswerItem) => {
    setStartingId(item.id)
    try {
      // 代码题直接跳转到编程练习页面（coding OJ 系统）
      if (item.question?.type === 'programming') {
        navigate(`/coding-practice/problems/${item.question_id}`)
        return
      }
      const session = await questionBankApi.createPracticeSession(item.bank_id, {
        mode: 'wrong_answer', question_order: [item.question_id], answer_mode: 'during',
      })
      navigate(`/banks/${item.bank_id}/practice?session_id=${session.data.id}`)
    } catch {
      setError('暂时无法打开这道题，请稍后重试。')
      setStartingId(null)
    }
  }

  const completeReview = async (point: DueKnowledgePoint) => {
    if (!point.point_id) return
    setCompletingId(point.point_id)
    try {
      await reviewApi.markComplete(point.point_id)
      setDuePoints(current => current.filter(item => item.point_id !== point.point_id))
      setTodayProgress(current => ({ ...current, reviewed: current.reviewed + 1 }))
    } finally {
      setCompletingId(null)
    }
  }

  if (loading) {
    return <div className="rc-page"><div className="rc-loading"><Loader2 /><span>正在整理你的错题档案…</span></div></div>
  }

  return (
    <main className="rc-page">
      <header className="rc-hero">
        <div className="rc-hero-copy">
          <span className="rc-kicker"><BrainCircuit size={15} /> REVIEW DESK · 复习工作台</span>
          <h1>别再重做一遍，<br /><em>找到每次出错的原因。</em></h1>
          <p>错题按知识点归档，代码题单独标记。选一个薄弱点，直接回到题目，再用精选资料补齐理解。</p>
        </div>
        <div className="rc-hero-score" aria-label={`今日复习进度 ${progress}%`}>
          <div className="rc-score-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}>
            <strong>{progress}<small>%</small></strong>
          </div>
          <div><span>今日复习</span><b>{todayProgress.reviewed} / {todayProgress.total_due || 0} 个知识点</b></div>
        </div>
      </header>

      {error && <div className="rc-alert"><TriangleAlert size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="关闭"><X size={16} /></button></div>}

      <section className="rc-metrics" aria-label="错题概况">
        <div><span>错题总数</span><strong>{wrongAnswers.length}</strong><small>当前错题档案</small></div>
        <div><span>知识点</span><strong>{groups.length}</strong><small>已自动归类</small></div>
        <div className="is-code"><span>代码题</span><strong>{codeTotal}</strong><small>可直接进入编辑器</small></div>
        <div className="is-warning"><span>反复出错</span><strong>{repeatedTotal}</strong><small>错误次数 ≥ 2</small></div>
      </section>

      <section className="rc-workbench">
        <aside className="rc-index">
          <div className="rc-index-title"><span><ListFilter size={16} />知识点索引</span><b>{groups.length}</b></div>
          <button className={activeKnowledge === 'all' ? 'active' : ''} onClick={() => setActiveKnowledge('all')}>
            <span><i className="rc-index-mark all"><Target size={15} /></i><span>全部错题<small>跨知识点浏览</small></span></span><b>{wrongAnswers.length}</b>
          </button>
          {groups.map((group, index) => (
            <button key={group.id} className={activeKnowledge === group.id ? 'active' : ''} onClick={() => setActiveKnowledge(group.id)}>
              <span><i className="rc-index-mark">{String(index + 1).padStart(2, '0')}</i><span>{group.meta.name}<small>{group.meta.domain}</small></span></span>
              <b>{group.items.length}</b>
            </button>
          ))}
        </aside>

        <div className="rc-library">
          <div className="rc-library-bar">
            <div>
              <span>WRONG ANSWER LIBRARY</span>
              <h2>{activeKnowledge === 'all' ? '全部错题' : groups.find(group => group.id === activeKnowledge)?.meta.name}</h2>
            </div>
            <div className="rc-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索题干或知识点" aria-label="搜索错题" /></div>
          </div>
          <div className="rc-filter-tabs" role="tablist" aria-label="题目类型">
            {([['all', '全部题型', wrongAnswers.length], ['quiz', '练习题', wrongAnswers.length - codeTotal], ['code', '代码题', codeTotal]] as const).map(([value, label, count]) => (
              <button key={value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>{value === 'code' && <Code2 size={14} />}{label}<b>{count}</b></button>
            ))}
          </div>

          {visibleGroups.length === 0 ? (
            <div className="rc-empty"><Search size={28} /><h3>没有匹配的错题</h3><p>换一个题型或清空搜索条件。</p><button onClick={() => { setSearch(''); setKind('all'); setActiveKnowledge('all') }}>清空筛选</button></div>
          ) : visibleGroups.map(group => (
            <article className="rc-group" key={group.id}>
              <div className="rc-group-heading">
                <div><span>{group.meta.subject} / {group.meta.domain}</span><h3>{group.meta.name}</h3></div>
                <button onClick={() => navigate(`/chat/new?prompt=${encodeURIComponent(`请针对「${group.meta.name}」梳理核心概念，并分析常见错误。`)}`)}><Sparkles size={15} />让 AI 拆解</button>
              </div>
              <div className="rc-question-grid">
                <div className="rc-question-list">
                  {group.items.map((item, index) => {
                    const isCode = item.question?.type === 'programming'
                    const stem = plainText(item.question?.content?.stem) || '题目内容暂不可用'
                    return (
                      <button className={`rc-question ${isCode ? 'is-code' : ''}`} key={`${group.id}-${item.id}`} onClick={() => openQuestion(item)}>
                        <span className="rc-question-no">{String(index + 1).padStart(2, '0')}</span>
                        <span className="rc-question-body">
                          <span className="rc-question-meta">
                            <b>{isCode && <Code2 size={13} />}{questionTypeLabel[item.question?.type] || '练习题'}</b>
                            <i>{difficultyLabel[item.question?.difficulty] || '基础'}</i>
                            <i>错 {item.wrong_count} 次</i>
                          </span>
                          <strong>{stem}</strong>
                        </span>
                        <span className="rc-question-go">{startingId === item.id ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}</span>
                      </button>
                    )
                  })}
                </div>
                <aside className="rc-resources">
                  <span className="rc-resources-label"><BookOpen size={14} />疑难加餐</span>
                  <h4>换一个讲法，<br />把这里真正弄懂。</h4>
                  <p>以下链接将在新窗口打开，内容来自成熟学习平台。</p>
                  {learningLinks(group.meta.name, group.codeCount > 0).map(link => (
                    <a key={link.name} className={`tone-${link.tone}`} href={link.href} target="_blank" rel="noreferrer">
                      <span><b>{link.name}</b><small>{link.note}</small></span><ExternalLink size={15} />
                    </a>
                  ))}
                </aside>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rc-due">
        <button className="rc-due-heading" onClick={() => setShowAllDue(value => !value)} aria-expanded={showAllDue}>
          <span><i><Flame size={18} /></i><span><b>今日待复习</b><small>完成后会自动安排下一次复习</small></span></span>
          <span><b>{duePoints.length} 个</b><ChevronDown className={showAllDue ? 'open' : ''} size={18} /></span>
        </button>
        {showAllDue && <div className="rc-due-list">
          {duePoints.length === 0 ? <div className="rc-due-empty"><Check size={17} />今天的计划已清空</div> : duePoints.map(point => (
            <div key={point.point_id}>
              <span><b>{point.point_name}</b><small>掌握度 {point.mastery_score}% · {point.review_label}</small></span>
              <div>
                <button onClick={() => navigate(`/path/knowledge/${point.point_id}`)}>查看知识点</button>
                <button className="primary" disabled={completingId === point.point_id} onClick={() => completeReview(point)}>{completingId === point.point_id ? <Loader2 className="spin" size={15} /> : <Check size={15} />}完成复习</button>
              </div>
            </div>
          ))}
        </div>}
      </section>

      <footer className="rc-footer"><span>需要重新同步？</span><button onClick={load}><RefreshCw size={14} />刷新错题档案</button></footer>
    </main>
  )
}
