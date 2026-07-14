import { useRef, useEffect, type CSSProperties, type MouseEvent } from 'react'
import type { PathNodeStatus } from '../../api/path'
import { useTheme } from '../../store/theme'
import { ArrowRightIcon, BookOpenIcon, CheckCircleIcon, CodeIcon, TargetIcon } from '../Icons'
import './LeetBookExploreMap.css'

const BRAND = '#1677E8'
const INK = '#1F2937'
const MUTED = '#64748B'
const LINE = '#E5EDF7'
const PAGE = '#F5F7FB'

// Dark mode colors
const BRAND_DARK = '#60A5FA'
const INK_DARK = '#F1F5F9'
const MUTED_DARK = '#94A3B8'
const LINE_DARK = '#334155'
const PAGE_DARK = '#0B1220'

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
  subjectName?: string
  onDomainChange: (domain: string | null) => void
  onNodeClick: (node: PathNodeStatus) => void
  onNodeContext?: (event: MouseEvent, node: PathNodeStatus) => void
  onReplan: () => void
  onToggleWeakMode: () => void
}

function statusMeta(node: PathNodeStatus, dark: boolean) {
  if (node.status === 'mastered') return {
    text: '已完成',
    bg: dark ? '#022C22' : '#ECFDF5',
    fg: dark ? '#6EE7B7' : '#047857',
    border: dark ? '#065F46' : '#A7F3D0',
  }
  if (node.status === 'learning') return {
    text: '学习中',
    bg: dark ? '#0F1F3D' : '#EFF6FF',
    fg: dark ? BRAND_DARK : BRAND,
    border: dark ? '#1E3A5F' : '#BFDBFE',
  }
  if (node.status === 'reviewing' || node.needs_review) return {
    text: '复习中',
    bg: dark ? '#451A03' : '#FFFBEB',
    fg: dark ? '#FCD34D' : '#B45309',
    border: dark ? '#78350F' : '#FDE68A',
  }
  if (node.status === 'locked') return {
    text: '前置锁定',
    bg: dark ? '#1F2937' : '#F8FAFC',
    fg: dark ? '#6B7280' : '#94A3B8',
    border: dark ? '#374151' : '#CBD5E1',
  }
  return {
    text: '未开始',
    bg: dark ? '#151F2F' : '#FFFFFF',
    fg: dark ? MUTED_DARK : MUTED,
    border: dark ? LINE_DARK : LINE,
  }
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
  subjectName,
  onDomainChange,
  onNodeClick,
  onNodeContext,
  onReplan,
  onToggleWeakMode,
}: Props) {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  const visibleGroups = selectedDomain ? groups.filter(g => g.domain === selectedDomain) : groups
  const activeNode = nodes.find(n => n.status === 'learning') || nodes.find(n => n.status === 'reviewing')
  // Weak knowledge points: mastery > 0% AND < 50%
  const weakNodes = nodes.filter(n => Math.max(0, n.mastery_score || 0) > 0 && Math.max(0, n.mastery_score || 0) < 50)
  const chapterProgress = groups.map(group => ({
    ...group,
    completed: group.nodes.filter(node => node.status === 'mastered').length,
    percentage: group.nodes.length ? Math.round(group.nodes.filter(node => node.status === 'mastered').length / group.nodes.length * 100) : 0,
  }))

  const weakSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (weakMode) {
      // Delay to ensure React has rendered the weak section DOM before scrolling
      const timer = setTimeout(() => {
        const el = weakSectionRef.current
        if (!el) return
        // Find the nearest ancestor that is actually scrollable (has overflow content)
        let parent: HTMLElement | null = el.parentElement
        let scrollParent: HTMLElement | null = null
        while (parent) {
          const style = window.getComputedStyle(parent)
          const canScroll = style.overflow === 'auto' || style.overflow === 'scroll'
            || style.overflowY === 'auto' || style.overflowY === 'scroll'
          if (canScroll && parent.scrollHeight > parent.clientHeight) {
            scrollParent = parent
            break
          }
          parent = parent.parentElement
        }
        if (scrollParent) {
          const offsetTop = el.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop
          scrollParent.scrollTo({ top: offsetTop - 16, behavior: 'smooth' })
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [weakMode])

  return (
    <div style={{ flex: 1, overflow: 'auto', background: dark ? PAGE_DARK : PAGE }}>
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
              {subjectName ? `${subjectName}知识路径` : '知识路径探索'}
            </h2>
            <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 14, lineHeight: 1.8, maxWidth: 680 }}>
              {subjectName
                ? `按章节推进${subjectName}学习，每个知识点都可以进入独立章节页查看讲义、练习、测评和复习资料。`
                : '按章节推进，每个知识点都可以进入独立章节页查看讲义、练习、测评和复习资料。'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
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
                薄弱知识点
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
                    const meta = statusMeta(node, dark)
                    return (
                      <button
                        key={node.point_id}
                        onClick={() => onNodeClick(node)}
                        onContextMenu={event => {
                          event.preventDefault()
                          onNodeContext?.(event, node)
                        }}
                        style={{
                          border: `1px solid ${meta.border}`,
                          background: meta.bg,
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
                          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = BRAND
                          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,232,0.15), 0 4px 12px rgba(22,119,232,0.08)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = meta.border
                          e.currentTarget.style.boxShadow = node.status === 'learning' ? '0 8px 18px rgba(22,119,232,0.12)' : 'none'
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
                            <span>{Math.max(0, node.mastery_score || 0)}%</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 999, background: '#E5E7EB', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.max(0, node.mastery_score || 0)}%`,
                              background: node.mastery_score >= 80 ? '#10B981' : BRAND,
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

        {/* Weak knowledge points section — shown when weak mode is active */}
        <div ref={weakSectionRef}>
        {weakMode && weakNodes.length > 0 && (
          <section style={{
            background: '#fff',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '18px 20px',
            marginTop: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 8,
                background: '#FEF2F2', color: '#DC2626',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 16, flexShrink: 0,
              }}>⚠</span>
              <div>
                <h3 style={{ margin: 0, color: INK, fontSize: 16, fontWeight: 800 }}>
                  薄弱知识点
                </h3>
                <p style={{ margin: '3px 0 0', color: MUTED, fontSize: 12 }}>
                  掌握度大于 0% 且小于 50%，共 {weakNodes.length} 个知识点需要加强
                </p>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: 12,
            }}>
              {weakNodes.map(node => {
                const meta = statusMeta(node, dark)
                return (
                  <button
                    key={node.point_id}
                    onClick={() => onNodeClick(node)}
                    style={{
                      border: '1px solid #FCA5A5',
                      background: '#FEF2F2',
                      borderRadius: 8,
                      padding: 14,
                      minHeight: 100,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = BRAND
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,232,0.15), 0 4px 12px rgba(22,119,232,0.08)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#FCA5A5'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ color: MUTED, fontSize: 11, fontWeight: 800 }}>{node.domain_name}</span>
                        <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 800 }}>薄弱</span>
                      </div>
                      <div style={{ color: INK, fontSize: 15, fontWeight: 800, marginTop: 9, lineHeight: 1.35 }}>
                        {node.point_name}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED, fontSize: 11, marginBottom: 5 }}>
                        <span>掌握度</span>
                        <span style={{ color: '#DC2626', fontWeight: 700 }}>{Math.max(0, node.mastery_score || 0)}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: '#FEE2E2', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.max(0, node.mastery_score || 0)}%`,
                          background: '#EF4444',
                          borderRadius: 999,
                        }} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {weakMode && weakNodes.length === 0 && (
          <div style={{
            background: '#fff', border: '1px solid #D1FAE5', borderRadius: 8,
            padding: '24px', textAlign: 'center', marginTop: 4,
          }}>
            <span style={{ fontSize: 28 }}>🎉</span>
            <p style={{ margin: '8px 0 0', color: '#059669', fontSize: 14, fontWeight: 600 }}>
              没有薄弱知识点！所有知识点掌握度均达标
            </p>
          </div>
        )}
        </div>

        {!loading && !error && nodes.length > 0 && (
          <>
          <section className="leetbook-afterword">
            <div className="leetbook-afterword-head">
              <div>
                <span className="leetbook-afterword-kicker">PATH COMPASS</span>
                <h3>从地图走向真正掌握</h3>
                <p>章节不是终点。用"读原文—做练习—写代码—再测一次"的闭环，把每个知识点变成可调用的能力。</p>
              </div>
              {activeNode && (
                <button onClick={() => onNodeClick(activeNode)}>
                  继续 {activeNode.point_name}<ArrowRightIcon size={15} />
                </button>
              )}
            </div>

            <div className="leetbook-afterword-grid">
              <article className="leetbook-chapter-rail">
                <div className="leetbook-panel-title"><TargetIcon size={17} /><span>章节推进</span><small>{completed}/{total} 已完成</small></div>
                <div className="leetbook-rail-list">
                  {chapterProgress.map((chapter, index) => (
                    <div className="leetbook-rail-item" key={chapter.domain}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div><div><strong>{chapter.domain}</strong><em>{chapter.completed}/{chapter.nodes.length}</em></div><i><b style={{ width: `${chapter.percentage}%` }} /></i></div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="leetbook-loop-panel">
                <div className="leetbook-panel-title"><CheckCircleIcon size={17} /><span>本章学习闭环</span></div>
                <div className="leetbook-loop-steps">
                  <div><span><BookOpenIcon size={18} /></span><strong>读原文</strong><p>带着定义与边界问题阅读</p></div>
                  <div><span><TargetIcon size={18} /></span><strong>做练习</strong><p>用反馈定位理解断点</p></div>
                  <div><span><CodeIcon size={18} /></span><strong>写代码</strong><p>把结构和操作落到实现</p></div>
                </div>
                <div className="leetbook-loop-note">
                  <strong>{weakNodes.length ? `${weakNodes.length} 个薄弱点等待巩固` : '当前没有明显薄弱点'}</strong>
                  <span>{reviewCount ? `${reviewCount} 个知识点已进入复习队列` : '完成练习后，系统会自动安排复习节点'}</span>
                </div>
              </article>
            </div>
          </section>

          <section style={{
            marginTop: 22,
            padding: 26,
            border: '1px solid var(--app-border)',
            borderRadius: 14,
            background: 'var(--app-bg-card)',
            boxShadow: '0 14px 34px rgba(22, 51, 84, .06)',
          }}>
            <div style={{ paddingBottom: 22, borderBottom: '1px solid var(--app-border)', marginBottom: 18 }}>
              <span style={{ color: 'var(--app-brand)', font: '800 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace', letterSpacing: '.14em' }}>LEARNING RESOURCES</span>
              <h3 style={{ margin: '7px 0 5px', color: 'var(--app-text-heading)', fontSize: 23, letterSpacing: '-.02em' }}>推荐学习资源</h3>
              <p style={{ maxWidth: 720, margin: 0, color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.7 }}>
                以下资源来自成熟学习平台，可帮助加深对{subjectName || '当前学科'}知识点的理解。
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {[
                { name: 'OI Wiki', note: '算法与数据结构原理详解', url: 'https://oi-wiki.org/ds/', tone: '#0891B2', bg: '#ECFEFF' },
                { name: '中国大学 MOOC', note: '系统课程与章节讲解', url: `https://www.icourse163.org/search.htm?search=${encodeURIComponent(subjectName || '')}`, tone: '#2563EB', bg: '#EFF6FF' },
                { name: 'LeetCode 中国', note: '算法与编程专题练习', url: `https://leetcode.cn/problemset/?search=${encodeURIComponent(subjectName || '')}`, tone: '#EA580C', bg: '#FFF7ED' },
                { name: 'VisuAlgo', note: '可视化交互学习数据结构', url: 'https://visualgo.net/zh', tone: '#7C3AED', bg: '#F5F3FF' },
                { name: 'Hello 算法', note: '动画图解数据结构与算法', url: 'https://www.hello-algo.com/', tone: '#059669', bg: '#ECFDF5' },
                { name: 'Bilibili 教程', note: '换个方式听讲解', url: `https://search.bilibili.com/all?keyword=${encodeURIComponent((subjectName || '') + ' 教程')}`, tone: '#DB2777', bg: '#FDF2F8' },
              ].map(resource => (
                <a key={resource.name} href={resource.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--app-border)',
                  background: '#fff',
                  textDecoration: 'none',
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = resource.tone; e.currentTarget.style.boxShadow = `0 4px 16px ${resource.tone}18` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <span style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: resource.bg,
                    color: resource.tone,
                    fontWeight: 800,
                    fontSize: 15,
                    flexShrink: 0,
                  }}>
                    {resource.name.charAt(0)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--app-text-heading)', fontSize: 15, fontWeight: 800 }}>{resource.name}</div>
                    <div style={{ color: 'var(--app-text-muted)', fontSize: 12, marginTop: 3 }}>{resource.note}</div>
                  </div>
                </a>
              ))}
            </div>
          </section>
          </>
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
