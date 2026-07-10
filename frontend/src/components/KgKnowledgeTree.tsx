/**
 * KgKnowledgeTree — 知识图谱知识点树状目录
 *
 * 将图谱中的知识点按领域分组，以可折叠的树状结构展示。
 * 点击知识点可高亮图谱中的对应节点。
 */
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Dot } from 'lucide-react'
import type { GraphNode } from '../api/knowledgeGraph'

interface Props {
  nodes: GraphNode[]
  subjectName: string
  highlightedNodeNames: string[]
  onHighlightNode: (nodeName: string | null) => void
}

interface DomainGroup {
  domainId: string
  domainName: string
  points: GraphNode[]
}

export default function KgKnowledgeTree({ nodes, subjectName, highlightedNodeNames, onHighlightNode }: Props) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState('')

  const domainGroups = useMemo(() => {
    const map = new Map<string, DomainGroup>()
    for (const node of nodes) {
      const domainId = node.domain_id || 'unknown'
      if (!map.has(domainId)) {
        map.set(domainId, { domainId, domainName: node.domain_name || '默认', points: [] })
      }
      map.get(domainId)!.points.push(node)
    }
    return Array.from(map.values())
  }, [nodes])

  // Auto-expand all domains on first load
  useMemo(() => {
    if (domainGroups.length > 0 && expandedDomains.size === 0) {
      setExpandedDomains(new Set(domainGroups.map(d => d.domainId)))
    }
  }, [domainGroups])

  const filter = searchText.trim().toLowerCase()
  const filteredGroups = filter
    ? domainGroups.map(g => ({
        ...g,
        points: g.points.filter(p => p.name.toLowerCase().includes(filter)),
      })).filter(g => g.points.length > 0)
    : domainGroups

  const toggleDomain = (domainId: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      next.has(domainId) ? next.delete(domainId) : next.add(domainId)
      return next
    })
  }

  if (!nodes.length) {
    return (
      <div className="kg-chat-empty">
        <span style={{ fontSize: 32 }}>📂</span>
        <strong>暂无知识点数据</strong>
        <span>请先导入文档构建知识图谱</span>
      </div>
    )
  }

  return (
    <div className="kg-chat-shell">
      <div className="kg-chat-shell__heading">
        <span className="kg-eyebrow">知识点目录</span>
        <strong>{subjectName}</strong>
      </div>

      {/* 搜索框 */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--kg-border)' }}>
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="搜索知识点..."
          style={{
            width: '100%', padding: '6px 10px', borderRadius: 7,
            border: '1px solid var(--kg-border)', fontSize: 12, outline: 'none',
            background: '#FAFAFA', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* 树状目录 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--kg-text-muted)', fontSize: 12 }}>
            没有匹配的知识点
          </div>
        ) : (
          filteredGroups.map(group => {
            const isExpanded = expandedDomains.has(group.domainId)
            return (
              <div key={group.domainId} style={{ marginBottom: 2 }}>
                {/* 领域标题 */}
                <button
                  type="button"
                  onClick={() => toggleDomain(group.domainId)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', border: 'none', background: 'transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    color: 'var(--kg-text)', fontSize: 13, fontWeight: 700,
                  }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{
                    width: 8, height: 8, borderRadius: 999,
                    background: 'var(--kg-primary)', flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{group.domainName}</span>
                  <span style={{
                    fontSize: 11, color: 'var(--kg-text-muted)',
                    background: '#F3F4F6', borderRadius: 999,
                    padding: '1px 8px', fontWeight: 500,
                  }}>
                    {group.points.length}
                  </span>
                </button>

                {/* 知识点列表 */}
                {isExpanded && (
                  <div style={{ paddingLeft: 28, paddingRight: 8 }}>
                    {group.points.map(point => {
                      const isHighlighted = highlightedNodeNames.includes(point.name)
                      return (
                        <button
                          key={point.id}
                          type="button"
                          onClick={() => onHighlightNode(isHighlighted ? null : point.name)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 8px', border: 'none', borderRadius: 6,
                            background: isHighlighted ? 'var(--kg-primary-soft)' : 'transparent',
                            color: isHighlighted ? 'var(--kg-primary)' : 'var(--kg-text-secondary)',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                            textAlign: 'left', fontWeight: isHighlighted ? 600 : 400,
                            transition: 'background 0.15s, color 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!isHighlighted) e.currentTarget.style.background = '#F3F4F6'
                          }}
                          onMouseLeave={e => {
                            if (!isHighlighted) e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <Dot size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
                          <span style={{
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {point.name}
                          </span>
                          <span style={{
                            fontSize: 10, color: 'var(--kg-text-muted)',
                            marginLeft: 'auto', flexShrink: 0,
                          }}>
                            {'⭐'.repeat(Math.min(point.difficulty || 1, 5))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* 底部统计 */}
      <div style={{
        padding: '6px 14px', borderTop: '1px solid var(--kg-border)',
        fontSize: 11, color: 'var(--kg-text-muted)', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{domainGroups.length} 个领域</span>
        <span>{nodes.length} 个知识点</span>
      </div>
    </div>
  )
}
