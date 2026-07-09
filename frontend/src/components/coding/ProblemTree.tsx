import { useState } from 'react'
import type { DomainNode } from '../../api/coding'

interface Props {
  domains: DomainNode[]
  selectedId: string | null
  onSelect: (problemId: string) => void
  searchText: string
}

export default function ProblemTree({ domains, selectedId, onSelect, searchText }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(domains.map(d => d.domain_id)))

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filter = searchText.toLowerCase()

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '4px 0' }}>
      {domains.map(domain => {
        const visiblePoints = domain.points.filter(p =>
          p.problems.some(pr => pr.title.toLowerCase().includes(filter))
        )
        if (visiblePoints.length === 0 && filter) return null

        const isExpanded = expanded.has(domain.domain_id)

        return (
          <div key={domain.domain_id}>
            <div
              onClick={() => toggle(domain.domain_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                color: 'var(--app-text-heading)',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 10 }}>{isExpanded ? '▾' : '▸'}</span>
              <span>{domain.domain_name}</span>
              <span style={{ fontSize: 11, color: 'var(--app-text-secondary)', marginLeft: 'auto' }}>
                {domain.completed_count}/{domain.total_problems}
              </span>
            </div>

            {isExpanded && visiblePoints.map(point => (
              <div key={point.point_id} style={{ paddingLeft: 12 }}>
                {point.problems
                  .filter(p => p.title.toLowerCase().includes(filter))
                  .map(problem => {
                    const isSel = problem.id === selectedId
                    const dotColor =
                      problem.status === 'completed' ? 'var(--app-success)' :
                      problem.status === 'attempted' ? 'var(--app-warning)' :
                      'var(--app-text-secondary)'
                    return (
                      <div
                        key={problem.id}
                        onClick={() => onSelect(problem.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 8px 4px 20px', cursor: 'pointer',
                          fontSize: 12,
                          background: isSel ? 'var(--app-bg-active)' : 'transparent',
                          color: isSel ? 'var(--app-primary)' : 'var(--app-text)',
                          borderRadius: 4,
                        }}
                      >
                        <span style={{ color: dotColor, fontSize: 8, flexShrink: 0 }}>●</span>
                        <span style={{
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {problem.title}
                        </span>
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
