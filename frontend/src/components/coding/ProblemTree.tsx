import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Circle, PlayCircle } from 'lucide-react'
import type { DomainNode, ProblemSummary } from '../../api/coding'

interface Props {
  domains: DomainNode[]
  selectedId: string | null
  onSelect: (problemId: string) => void
  searchText: string
}

const DIFFICULTY_ORDER = ['basic', 'intermediate', 'advanced'] as const

const DIFFICULTY_LABELS: Record<string, string> = {
  basic: '简单',
  intermediate: '中等',
  advanced: '困难',
}

const STATUS_LABELS: Record<ProblemSummary['status'], string> = {
  not_started: '未开始',
  attempted: '尝试过',
  completed: '已通过',
}

function statusIcon(status: ProblemSummary['status'], active: boolean) {
  const color = active
    ? 'var(--app-primary)'
    : status === 'completed'
      ? 'var(--app-success)'
      : status === 'attempted'
        ? 'var(--app-warning)'
        : 'var(--app-text-tertiary)'

  if (status === 'completed') return <CheckCircle2 size={18} color={color} />
  if (status === 'attempted') return <PlayCircle size={18} color={color} />
  return <Circle size={17} color={color} />
}

function selectThreeTiers(problems: ProblemSummary[]) {
  return DIFFICULTY_ORDER.flatMap((difficulty) => {
    const problem = problems.find((item) => item.difficulty === difficulty)
    return problem ? [problem] : []
  })
}

export default function ProblemTree({ domains, selectedId, onSelect, searchText }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setExpanded(new Set(domains.map((domain) => domain.domain_id)))
  }, [domains])

  const totalProblems = useMemo(
    () => domains.reduce((sum, domain) => sum + domain.total_problems, 0),
    [domains],
  )
  const completedProblems = useMemo(
    () => domains.reduce((sum, domain) => sum + domain.completed_count, 0),
    [domains],
  )
  const progress = totalProblems ? Math.round((completedProblems / totalProblems) * 100) : 0
  const filter = searchText.trim().toLocaleLowerCase('zh-CN')

  const visibleDomains = useMemo(() => domains.map((domain) => ({
    ...domain,
    points: domain.points
      .map((point) => {
        const tieredProblems = selectThreeTiers(point.problems)
        const contextMatches = `${point.point_name} ${domain.domain_name}`
          .toLocaleLowerCase('zh-CN')
          .includes(filter)
        return {
          ...point,
          problems: !filter || contextMatches
            ? tieredProblems
            : tieredProblems.filter((problem) => problem.title.toLocaleLowerCase('zh-CN').includes(filter)),
        }
      })
      .filter((point) => point.problems.length > 0),
  })).filter((domain) => domain.points.length > 0), [domains, filter])

  const toggle = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!visibleDomains.length) {
    return (
      <div className="problem-tree-empty">
        没有匹配的代码题，请尝试其他关键词
      </div>
    )
  }

  return (
    <div className="problem-tree">
      <div className="problem-tree-progress">
        <div>
          <span>总体通过进度</span>
          <strong>{completedProblems}/{totalProblems} · {progress}%</strong>
        </div>
        <div className="problem-tree-progress-track" aria-label={`总体通过进度 ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {visibleDomains.map((domain, domainIndex) => {
        const isExpanded = expanded.has(domain.domain_id)
        const domainProgress = domain.total_problems
          ? Math.round((domain.completed_count / domain.total_problems) * 100)
          : 0

        return (
          <section className="problem-tree-domain" key={domain.domain_id}>
            <button
              type="button"
              className="problem-tree-domain-toggle"
              onClick={() => toggle(domain.domain_id)}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronDown size={19} /> : <ChevronRight size={19} />}
              <span className="problem-tree-domain-name">
                <small>模块 {String(domainIndex + 1).padStart(2, '0')}</small>
                <strong>{domain.domain_name}</strong>
              </span>
              <span className="problem-tree-domain-count">
                {domain.completed_count}/{domain.total_problems} 已通过 · {domainProgress}%
              </span>
            </button>

            {isExpanded && (
              <div className="problem-tree-points">
                {domain.points.map((point) => {
                  const completedInPoint = point.problems.filter((problem) => problem.status === 'completed').length
                  return (
                    <article className="problem-tree-point" key={point.point_id}>
                      <div className="problem-tree-point-head">
                        <span>
                          <i aria-hidden="true" />
                          {point.point_name}
                        </span>
                        <small>{completedInPoint}/{point.problems.length} 已通过</small>
                      </div>

                      <div className="problem-tree-problems">
                        {point.problems.map((problem) => {
                          const active = problem.id === selectedId
                          return (
                            <button
                              type="button"
                              data-testid="coding-problem-row"
                              className={`problem-tree-problem${active ? ' is-active' : ''}`}
                              key={problem.id}
                              onClick={() => onSelect(problem.id)}
                            >
                              <span className={`problem-tree-difficulty is-${problem.difficulty}`}>
                                {DIFFICULTY_LABELS[problem.difficulty] || problem.difficulty}
                              </span>
                              <span className="problem-tree-problem-title" title={problem.title}>
                                {problem.title}
                              </span>
                              <span className="problem-tree-status">
                                {statusIcon(problem.status, active)}
                                {STATUS_LABELS[problem.status]}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
