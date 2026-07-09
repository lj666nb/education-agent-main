import type { CSSProperties, MouseEvent } from 'react'
import type { PathNodeStatus } from '../../api/path'

const BRAND = '#1677E8'
const INK = '#1F2937'
const MUTED = '#64748B'
const LINE = '#E5EDF7'
const PAGE = '#F5F7FB'

type NodeGroup = {
  domain: string
  nodes: PathNodeStatus[]
}

type Props = {
  nodes: PathNodeStatus[]
  groups: NodeGroup[]
  progressRate: number
  completed: number
  total: number
  reviewCount: number
  loading?: boolean
  error?: string | null
  selectedDomain?: string | null
  weakMode?: boolean
  onDomainChange: (domain: string | null) => void
  onNodeClick: (node: PathNodeStatus) => void
  onNodeContext?: (event: MouseEvent, node: PathNodeStatus) => void
  onReplan: () => void
  onToggleWeakMode: () => void
}

function statusMeta(node: PathNodeStatus) {
  if (node.status === 'mastered') return { text: '已完成', bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' }
  if (node.status === 'learning') return { text: '学习中', bg: '#EFF6FF', fg: BRAND, border: '#BFDBFE' }
  if (node.status === 'reviewing' || node.needs_review) return { text: '复习中', bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' }
  if (node.status === 'locked') return { text: '前置锁定', bg: '#F8FAFC', fg: '#94A3B8', border: '#CBD5E1' }
  return { text: '未开始', bg: '#FFFFFF', fg: MUTED, border: LINE }
}

function chapterIndex(index: number) {
  return String(index + 1).padStart(2, '0')
}

export default function LeetBookExploreMap({
  nodes,
  groups,
  progressRate,
  completed,
  total,
  reviewCount,
  loading,
  error,
  selectedDomain,
  weakMode,
  onDomainChange,
  onNodeClick,
  onNodeContext,
  onReplan,
  onToggleWeakMode,
}: Props) {
  const visibleGroups = selectedDomain ? groups.filter(g => g.domain === selectedDomain) : groups
  const activeNode = nodes.find(n => n.status === 'learning') || nodes.find(n => n.status === 'reviewing')

  return (
    <div style={{ flex: 1, overflow: 'auto', background: PAGE }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 24px 36px' }}>
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gap: 18,
          alignItems: 'stretch',
        }}>
          <div style={{
            background: '#fff',
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '24px 26px',
            minHeight: 156,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: BRAND, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: BRAND, display: 'inline-block' }} />
              探索知识地图
            </div>
            <h2 style={{ margin: 0, color: INK, fontSize: 30, lineHeight: 1.2, fontWeight: 800 }}>
              数据结构知识路径
            </h2>
            <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 14, lineHeight: 1.8, maxWidth: 680 }}>
              按章节推进，每个知识点都可以进入独立章节页查看讲义、练习、测评和复习资料。
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={onReplan} disabled={loading} style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: 'none',
                background: loading ? '#CBD5E1' : BRAND,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}>
                动态重排
              </button>
              <button onClick={onToggleWeakMode} style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: `1px solid ${weakMode ? '#FCA5A5' : LINE}`,
                background: weakMode ? '#FEF2F2' : '#fff',
                color: weakMode ? '#DC2626' : MUTED,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                薄弱高亮
              </button>
            </div>
          </div>

          <aside style={{
            background: '#fff',
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 42, lineHeight: 1, color: progressRate >= 80 ? '#059669' : BRAND, fontWeight: 800 }}>{progressRate}%</span>
                <span style={{ color: MUTED, fontSize: 12 }}>{completed}/{total}</span>
              </div>
              <div style={{ height: 8, background: '#EEF2F7', borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ width: `${progressRate}%`, height: '100%', background: progressRate >= 80 ? '#10B981' : BRAND, borderRadius: 999 }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{groups.length}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>章节</div>
              </div>
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: reviewCount ? '#D97706' : INK }}>{reviewCount}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>待复习</div>
              </div>
            </div>
          </aside>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '18px 0 12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => onDomainChange(null)} style={filterStyle(!selectedDomain)}>全部章节</button>
            {groups.map(group => (
              <button key={group.domain} onClick={() => onDomainChange(group.domain)} style={filterStyle(selectedDomain === group.domain)}>
                {group.domain} · {group.nodes.length}
              </button>
            ))}
          </div>
          {activeNode && (
            <button onClick={() => onNodeClick(activeNode)} style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${LINE}`,
              background: '#fff',
              color: BRAND,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              继续学习：{activeNode.point_name}
            </button>
          )}
        </div>

        {loading ? (
          <EmptyBlock text="正在加载知识地图..." />
        ) : error ? (
          <EmptyBlock text={error} danger />
        ) : nodes.length === 0 ? (
          <EmptyBlock text="暂无路径数据，请先创建学习路径。" />
        ) : (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {visibleGroups.map((group, groupIndex) => (
              <section key={group.domain} style={{
                background: '#fff',
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: '18px 18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{
                    width: 42,
                    height: 42,
                    borderRadius: 8,
                    background: '#F0F7FF',
                    color: BRAND,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                    flexShrink: 0,
                  }}>{chapterIndex(groupIndex)}</span>
                  <div>
                    <h3 style={{ margin: 0, color: INK, fontSize: 18, fontWeight: 800 }}>{group.domain}</h3>
                    <p style={{ margin: '3px 0 0', color: MUTED, fontSize: 12 }}>
                      {group.nodes.length} 个知识点，按当前动态路径顺序展开
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: 12,
                }}>
                  {group.nodes.map((node, index) => {
                    const meta = statusMeta(node)
                    const weak = weakMode && (node.mastery_score || 0) < 40
                    return (
                      <button
                        key={node.point_id}
                        onClick={() => onNodeClick(node)}
                        onContextMenu={event => {
                          event.preventDefault()
                          onNodeContext?.(event, node)
                        }}
                        style={{
                          border: `1px solid ${weak ? '#FCA5A5' : meta.border}`,
                          background: weak ? '#FEF2F2' : meta.bg,
                          borderRadius: 8,
                          padding: 14,
                          minHeight: 112,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 12,
                          boxShadow: node.status === 'learning' ? '0 8px 18px rgba(22,119,232,0.12)' : 'none',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>#{chapterIndex(index)}</span>
                            <span style={{ color: meta.fg, fontSize: 11, fontWeight: 800 }}>{meta.text}</span>
                          </div>
                          <div style={{ color: INK, fontSize: 15, fontWeight: 800, marginTop: 9, lineHeight: 1.35 }}>
                            {node.point_name}
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED, fontSize: 11, marginBottom: 5 }}>
                            <span>掌握度</span>
                            <span>{node.mastery_score || 0}%</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 999, background: '#E5E7EB', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${node.mastery_score || 0}%`,
                              background: node.mastery_score >= 80 ? '#10B981' : weak ? '#EF4444' : BRAND,
                              borderRadius: 999,
                            }} />
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function filterStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 6,
    border: `1px solid ${active ? BRAND : LINE}`,
    background: active ? '#F0F7FF' : '#fff',
    color: active ? BRAND : MUTED,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }
}

function EmptyBlock({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <div style={{
      minHeight: 260,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fff',
      border: `1px solid ${danger ? '#FECACA' : LINE}`,
      borderRadius: 8,
      color: danger ? '#DC2626' : MUTED,
      fontSize: 14,
    }}>
      {text}
    </div>
  )
}
