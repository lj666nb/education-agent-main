import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, CheckCircle2, Code2, Layers3, Search } from 'lucide-react'
import ProblemTree from '../components/coding/ProblemTree'
import CodePlayground from '../components/coding/CodePlayground'
import { codingApi, type CodingProblemResponse, type DomainNode } from '../api/coding'
import './CodingPracticePage.css'

export default function CodingPracticePage() {
  const navigate = useNavigate()
  const { problemId } = useParams()
  const [searchParams] = useSearchParams()
  const legacyProblemId = searchParams.get('problem')
  const selectedId = problemId || legacyProblemId

  const [domains, setDomains] = useState<DomainNode[]>([])
  const [problem, setProblem] = useState<CodingProblemResponse | null>(null)
  const [loadingTree, setLoadingTree] = useState(true)
  const [loadingProblem, setLoadingProblem] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (legacyProblemId && !problemId) {
      navigate(`/coding-practice/problems/${legacyProblemId}`, { replace: true })
    }
  }, [legacyProblemId, navigate, problemId])

  const loadTree = useCallback(() => {
    setLoadingTree(true)
    setError('')
    codingApi.getTree(undefined, 'oj_curated')
      .then((res) => setDomains(res.data?.domains || []))
      .catch(() => setError('代码题目录加载失败，请稍后重试'))
      .finally(() => setLoadingTree(false))
  }, [])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  useEffect(() => {
    if (!selectedId) {
      setProblem(null)
      return
    }

    setLoadingProblem(true)
    setProblem(null)
    setError('')
    codingApi.getProblem(selectedId)
      .then((res) => setProblem(res.data))
      .catch(() => setError('题目加载失败，请返回目录重新选择'))
      .finally(() => setLoadingProblem(false))
  }, [selectedId])

  const totals = useMemo(() => {
    const totalProblems = domains.reduce((sum, domain) => sum + domain.total_problems, 0)
    const completedProblems = domains.reduce((sum, domain) => sum + domain.completed_count, 0)
    const pointCount = domains.reduce((sum, domain) => sum + domain.points.length, 0)
    return { totalProblems, completedProblems, pointCount }
  }, [domains])

  if (selectedId) {
    return (
      <div className="coding-practice-workspace">
        {loadingProblem ? (
          <CenteredState text="正在加载题目..." />
        ) : problem ? (
          <CodePlayground problem={problem} onBack={() => navigate('/coding-practice')} />
        ) : (
          <CenteredState
            text={error || '未找到这道代码题'}
            actionLabel="返回题目目录"
            onAction={() => navigate('/coding-practice')}
          />
        )}
      </div>
    )
  }

  return (
    <div className="coding-practice-page">
      <main className="coding-practice-main">
        <div className="coding-practice-topbar">
          <button type="button" className="coding-practice-back" onClick={() => navigate('/home')}>
            <ArrowLeft size={16} />
            返回首页
          </button>
        </div>

        <section className="coding-practice-hero">
          <div className="coding-practice-intro">
            <div className="coding-practice-eyebrow">
              <BookOpen size={16} />
              数据结构 · 在线编程训练
            </div>
            <h1>从“知道概念”到“能独立写出代码”</h1>
            <p>
              每个知识点最多收录 3 道题，按简单、中等、困难各一题递进。进入题目后先读清目标、输入输出和边界条件，再运行公开样例，最后提交隐藏测试判题。
            </p>
            <div className="coding-practice-flow" aria-label="做题流程">
              <span>1 阅读题意</span>
              <span>2 编写代码</span>
              <span>3 运行样例</span>
              <span>4 提交判题</span>
            </div>
          </div>

          <div className="coding-practice-metrics" aria-label="练习进度">
            <Metric icon={<CheckCircle2 size={18} />} label="已通过" value={`${totals.completedProblems}/${totals.totalProblems}`} />
            <Metric icon={<Layers3 size={18} />} label="知识点" value={`${totals.pointCount}`} />
            <Metric icon={<Code2 size={18} />} label="题目数" value={`${totals.totalProblems}`} />
          </div>
        </section>

        <section className="coding-practice-catalog">
          <div className="coding-practice-catalog-head">
            <div>
              <div className="coding-practice-catalog-title">
                <Code2 size={18} />
                选择一道题开始练习
              </div>
              <p>按知识点查看三档难度，圆点状态会记录你的真实提交进度。</p>
            </div>
            <label className="coding-practice-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="搜索题目或知识点"
                placeholder="搜索题目或知识点"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
          </div>

          {loadingTree ? (
            <CenteredState text="正在加载代码题目录..." compact />
          ) : error ? (
            <CenteredState text={error} actionLabel="重新加载" onAction={loadTree} compact />
          ) : domains.length === 0 ? (
            <CenteredState text="暂无可练习的代码题，请先联系管理员初始化题库" compact />
          ) : (
            <ProblemTree
              domains={domains}
              selectedId={null}
              onSelect={(id) => navigate(`/coding-practice/problems/${id}`)}
              searchText={searchText}
            />
          )}
        </section>
      </main>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="coding-practice-metric">
      <span className="coding-practice-metric-icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  )
}

function CenteredState({
  text,
  actionLabel,
  onAction,
  compact = false,
}: {
  text: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}) {
  return (
    <div className={`coding-practice-state${compact ? ' is-compact' : ''}`}>
      <span>{text}</span>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  )
}
