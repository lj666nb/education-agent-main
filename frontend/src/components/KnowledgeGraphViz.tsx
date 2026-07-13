/**
 * KnowledgeGraphViz — D3 力导向知识图谱可视化组件
 *
 * 完整迁移自 GraphRAG-Example-master (ZSTP)，包含：
 * - D3 force-directed/circular/grid/concentric 四种布局
 * - 缩放/拖拽/平移
 * - 节点悬浮提示 + 颜色图例
 * - 关系边 + 标签
 * - 高亮节点同步（从 RAG 问答传入）
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '../api/knowledgeGraph'

// ── 颜色常量 ──
const TYPE_COLORS = [
  '#4f6df5', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#a855f7', '#e11d48', '#0891b2', '#ca8a04', '#059669',
]

const BG_COLOR = 'var(--kg-canvas, #FAFBFC)'

// ── 边样式映射 ──
const RELATION_STYLES: Record<string, { color: string; dash: string }> = {
  PREREQUISITE: { color: '#4f6df5', dash: 'none' },
  CONTAINS: { color: '#22c55e', dash: 'none' },
  RELATED_TO: { color: '#9CA3AF', dash: '6,3' },
  APPLIES: { color: '#f59e0b', dash: 'none' },
  DEPENDS_ON: { color: '#ef4444', dash: '4,2' },
}

function getTypeColor(type: string): string {
  const key = (type || 'default').toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length]
}

function getNodeRadius(degree: number): number {
  return Math.max(8, Math.min(22, 8 + Math.sqrt(degree || 0) * 2.5))
}

function getRelationStyle(relation: string) {
  return RELATION_STYLES[relation] || { color: '#D1D5DB', dash: 'none' }
}

// ── 内部节点数据结构 ──
interface D3Node extends d3.SimulationNodeDatum {
  id: string
  label: string
  type: string
  domainName: string
  difficulty: number
  color: string
  radius: number
  degree: number
  highlighted: boolean
  isSeed: boolean
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string
  source: string | D3Node
  target: string | D3Node
  label: string
  relation: string
  color: string
  dash: string
}

type LayoutType = 'force' | 'circular' | 'grid' | 'concentric'

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick?: (node: GraphNode) => void
  highlightNodeNames?: string[]
  focusNodeName?: string | null
  onFocusNode?: (nodeName: string | null) => void
}

export default function KnowledgeGraphViz({ nodes, edges, onNodeClick, highlightNodeNames, focusNodeName, onFocusNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [currentLayout, setCurrentLayout] = useState<LayoutType>('force')
  const [typeSet, setTypeSet] = useState<Map<string, string>>(new Map())
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const d3NodesRef = useRef<D3Node[]>([])
  const d3LinksRef = useRef<D3Link[]>([])

  // ── 构建 D3 数据 ──
  const buildData = useCallback(() => {
    // 计算每个节点的度
    const degreeMap = new Map<string, number>()
    for (const e of edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1)
      degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1)
    }

    const highlightSet = new Set(highlightNodeNames || [])
    const typeColors = new Map<string, string>()

    const d3nodes: D3Node[] = nodes.map(n => {
      const domainName = n.domain_name || '默认'
      if (!typeColors.has(domainName)) {
        typeColors.set(domainName, getTypeColor(domainName))
      }
      const deg = degreeMap.get(n.id) || 0
      return {
        id: n.id,
        label: n.name,
        type: domainName,
        domainName: domainName,
        difficulty: n.difficulty || 3,
        color: typeColors.get(domainName)!,
        radius: getNodeRadius(deg),
        degree: deg,
        highlighted: highlightSet.has(n.name),
        isSeed: highlightSet.has(n.name),
      }
    })

    const nodeIdSet = new Set(d3nodes.map(n => n.id))
    const d3links: D3Link[] = edges
      .filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map(e => {
        const style = getRelationStyle(e.relation)
        return {
          id: `${e.source}-${e.target}-${e.relation}`,
          source: e.source,
          target: e.target,
          label: e.relation === 'PREREQUISITE' ? '前置' : e.relation === 'CONTAINS' ? '包含' : e.relation === 'RELATED_TO' ? '' : e.relation,
          relation: e.relation,
          color: style.color,
          dash: style.dash,
        }
      })

    setTypeSet(typeColors)
    return { d3nodes, d3links }
  }, [nodes, edges, highlightNodeNames])

  // ── 主渲染逻辑 ──
  useEffect(() => {
    const container = containerRef.current
    const svg = svgRef.current
    if (!container || !svg) return

    const { width, height } = container.getBoundingClientRect()
    if (width === 0 || height === 0) return

    const { d3nodes, d3links } = buildData()
    d3NodesRef.current = d3nodes
    d3LinksRef.current = d3links

    if (d3nodes.length === 0) {
      d3.select(svg).selectAll('*').remove()
      return
    }

    // 清理
    d3.select(svg).selectAll('*').remove()
    if (simRef.current) { simRef.current.stop(); simRef.current = null }

    const g = d3.select(svg).append('g').attr('class', 'graph-group')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })
    d3.select(svg).call(zoom)
    zoomRef.current = zoom

    // ── 渲染边 ──
    const linkG = g.append('g').attr('class', 'links')
    const linkLines = linkG.selectAll<SVGLineElement, D3Link>('line')
      .data(d3links)
      .join('line')
      .attr('stroke', d => d.color)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => d.dash || 'none')
      .attr('opacity', 0.6)

    const linkLabels = linkG.selectAll<SVGTextElement, D3Link>('text')
      .data(d3links.filter(l => l.label))
      .join('text')
      .text(d => d.label)
      .attr('font-size', 9)
      .attr('fill', 'var(--kg-text-muted, #9CA3AF)')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)

    // ── 渲染节点 ──
    const nodeG = g.append('g').attr('class', 'nodes')
    const nodeGroups = nodeG.selectAll<SVGGElement, D3Node>('g')
      .data(d3nodes)
      .join('g')
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')

    nodeGroups.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', d => d3.color(d.color)!.darker(0.3).toString())
      .attr('stroke-width', d => d.isSeed ? 3 : 1)
      .attr('opacity', 0.9)

    // 种子节点光环
    nodeGroups.filter(d => d.isSeed)
      .append('circle')
      .attr('r', d => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2')
      .attr('class', 'seed-ring')
      .lower()

    nodeGroups.append('text')
      .text(d => d.label.length > 8 ? d.label.slice(0, 8) + '..' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 13)
      .attr('font-size', 10)
      .attr('fill', 'var(--kg-text, #374151)')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')

    // ── 事件绑定 ──
    nodeGroups
      .on('mouseenter', (event: MouseEvent, d: D3Node) => {
        setHoveredNode(d)
        setTooltipPos({ x: event.offsetX + 14, y: event.offsetY + 14 })
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltipPos({ x: event.offsetX + 14, y: event.offsetY + 14 })
      })
      .on('mouseleave', () => {
        setHoveredNode(null)
      })
      .on('click', (event: MouseEvent, d: D3Node) => {
        event.stopPropagation()
        onNodeClick?.(nodes.find(n => n.id === d.id)!)
      })

    // Drag
    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) => {
        if (currentLayout === 'force' && simRef.current) {
          simRef.current.alphaTarget(0.3).restart()
        }
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) => {
        d.fx = event.x; d.fy = event.y
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) => {
        if (currentLayout === 'force' && simRef.current) {
          simRef.current.alphaTarget(0)
        }
        if (currentLayout !== 'force') {
          d.fx = d.x; d.fy = d.y  // 静态布局保持拖拽位置
        } else {
          d.fx = null; d.fy = null
        }
      })
    nodeGroups.call(drag)

    // SVG 背景点击取消选择
    d3.select(svg).on('click', (event: MouseEvent) => {
      if (event.target === svg) {
        // 点击空白区域
      }
    })

    // ── 解析引用：将 link 的字符串 source/target 替换为节点对象 ──
    function resolveLinks() {
      const nodeMap = new Map(d3nodes.map(n => [n.id, n]))
      for (const link of d3links) {
        if (typeof link.source === 'string') link.source = nodeMap.get(link.source) || link.source
        if (typeof link.target === 'string') link.target = nodeMap.get(link.target) || link.target
      }
    }

    // ── 布局函数 ──
    function applyLayout(layout: LayoutType) {
      d3nodes.forEach(n => { n.fx = null; n.fy = null })

      const cx = width / 2, cy = height / 2

      switch (layout) {
        case 'circular': {
          const r = Math.min(width, height) * 0.38
          d3nodes.forEach((n, i) => {
            const angle = (2 * Math.PI * i) / d3nodes.length - Math.PI / 2
            n.x = cx + r * Math.cos(angle); n.y = cy + r * Math.sin(angle)
            n.fx = n.x; n.fy = n.y
          })
          break
        }
        case 'grid': {
          const cols = Math.ceil(Math.sqrt(d3nodes.length))
          const rows = Math.ceil(d3nodes.length / cols)
          const cellW = width / (cols + 1), cellH = height / (rows + 1)
          d3nodes.forEach((n, i) => {
            n.x = (i % cols + 1) * cellW; n.y = (Math.floor(i / cols) + 1) * cellH
            n.fx = n.x; n.fy = n.y
          })
          break
        }
        case 'concentric': {
          const maxR = Math.min(width, height) * 0.38
          const maxDeg = Math.max(...d3nodes.map(n => n.degree), 1)
          const innerR = maxR * 0.3
          d3nodes.forEach((n, i) => {
            const t = n.degree / maxDeg
            const r = innerR + t * (maxR - innerR)
            const angle = (2 * Math.PI * i) / d3nodes.length - Math.PI / 2
            n.x = cx + r * Math.cos(angle); n.y = cy + r * Math.sin(angle)
            n.fx = n.x; n.fy = n.y
          })
          break
        }
        case 'force':
        default:
          break
      }
      // 静态布局：解析边引用 → 更新 DOM
      resolveLinks()
      ticked()
    }

    // ── Tick ──
    function ticked() {
      nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`)
      linkLines
        .attr('x1', d => (d.source as D3Node).x!)
        .attr('y1', d => (d.source as D3Node).y!)
        .attr('x2', d => (d.target as D3Node).x!)
        .attr('y2', d => (d.target as D3Node).y!)
      linkLabels
        .attr('x', d => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr('y', d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2 - 4)
    }

    // ── Force Simulation ──
    function runForce() {
      if (simRef.current) simRef.current.stop()
      const sim = d3.forceSimulation<D3Node>(d3nodes)
        .force('link', d3.forceLink<D3Node, D3Link>(d3links).id(d => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-150))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', d3.forceCollide<D3Node>().radius(d => d.radius + 6))
        .on('tick', ticked)
      simRef.current = sim
    }

    // ── 根据当前布局初始化 ──
    if (currentLayout === 'force') {
      runForce()
    } else {
      applyLayout(currentLayout)
    }

    // ── 清理 ──
    return () => {
      if (simRef.current) { simRef.current.stop(); simRef.current = null }
    }
  }, [nodes, edges, currentLayout, highlightNodeNames])

  // ── 高亮更新（增量） ──
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const highlightSet = new Set(highlightNodeNames || [])
    d3.select(svg).selectAll<SVGGElement, D3Node>('g.graph-node')
      .select('circle:first-child')
      .attr('stroke-width', d => highlightSet.has(d.label) ? 3 : 1)
      .attr('stroke', d => highlightSet.has(d.label) ? '#f59e0b' : d3.color(d.color)!.darker(0.3).toString())
    d3.select(svg).selectAll<SVGGElement, D3Node>('g.graph-node')
      .select('.seed-ring')
      .style('display', d => highlightSet.has(d.label) ? 'block' : 'none')
  }, [highlightNodeNames])

  // ── 聚焦节点（zoom to node） ──
  useEffect(() => {
    if (!focusNodeName || !svgRef.current || !zoomRef.current || !containerRef.current) return
    const targetNode = d3NodesRef.current.find(n => n.label === focusNodeName)
    if (!targetNode || targetNode.x == null || targetNode.y == null) return

    const rect = containerRef.current.getBoundingClientRect()
    const w = rect.width, h = rect.height
    const scale = 2.5
    const tx = w / 2 - targetNode.x * scale
    const ty = h / 2 - targetNode.y * scale

    d3.select(svgRef.current).transition().duration(600)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }, [focusNodeName])

  // ── Zoom 控制 ──
  const zoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3)
  }
  const zoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7)
  }
  const resetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity)
  }
  const fitToView = () => {
    if (!svgRef.current || !zoomRef.current || d3NodesRef.current.length === 0) return
    const ns = d3NodesRef.current
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of ns) {
      minX = Math.min(minX, (n.x || 0) - n.radius)
      minY = Math.min(minY, (n.y || 0) - n.radius)
      maxX = Math.max(maxX, (n.x || 0) + n.radius)
      maxY = Math.max(maxY, (n.y || 0) + n.radius)
    }
    const rect = containerRef.current?.getBoundingClientRect()
    const w = rect?.width || 800, h = rect?.height || 600
    const pad = 50, gw = maxX - minX + pad * 2, gh = maxY - minY + pad * 2
    const scale = Math.min(w / gw, h / gh, 2)
    const tx = (w - (minX + maxX) * scale) / 2
    const ty = (h - (minY + maxY) * scale) / 2
    d3.select(svgRef.current).transition().duration(500)
      .call(zoomRef.current!.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }

  const handleLayout = (layout: LayoutType) => {
    setCurrentLayout(layout)
  }

  // ── 空状态 ──
  if (nodes.length === 0) {
    return (
      <div ref={containerRef} style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: BG_COLOR, color: '#9CA3AF', fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🕸️</div>
          <p style={{ margin: 0 }}>暂无图谱数据</p>
          <p style={{ fontSize: 12, marginTop: 4, color: '#D1D5DB' }}>上传 PDF 构建知识图谱后查看</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%', position: 'relative',
      overflow: 'hidden', background: BG_COLOR,
    }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* ── 知识点列表（左下角，可点击聚焦） ── */}
      <div style={{
        position: 'absolute', left: 12, bottom: 12,
        background: 'var(--app-bg-elevated)', borderRadius: 10,
        border: '1px solid #E5E7EB', padding: '6px 0',
        fontSize: 11, maxWidth: 200, maxHeight: 260, overflowY: 'auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontWeight: 600, color: '#374151', padding: '4px 12px 6px',
          borderBottom: '1px solid #F3F4F6', marginBottom: 2,
          fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>知识点</span>
          <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 400 }}>{d3NodesRef.current.length} 个</span>
        </div>
        {d3NodesRef.current.map(node => {
          const isFocused = focusNodeName === node.label
          const isHighlighted = node.isSeed
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                if (onFocusNode) {
                  onFocusNode(isFocused ? null : node.label)
                }
              }}
              title={`点击聚焦: ${node.label}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 12px', border: 'none', borderRadius: 0,
                background: isFocused ? 'var(--kg-primary-soft)' : 'transparent',
                color: isFocused ? '#4f6df5' : '#6B7280',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                textAlign: 'left', width: '100%',
                fontWeight: isFocused ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                if (!isFocused) { e.currentTarget.style.background = 'var(--app-bg-hover)'; e.currentTarget.style.color = 'var(--kg-text)' }
              }}
              onMouseLeave={e => {
                if (!isFocused) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--kg-text-secondary)' }
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                background: node.color,
                boxShadow: isHighlighted ? '0 0 0 2px #f59e0b' : 'none',
              }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── 关系线样式说明 ── */}
      <div style={{
        position: 'absolute', left: 12, top: 12,
        background: 'var(--app-bg-elevated)', borderRadius: 10,
        border: '1px solid #E5E7EB', padding: '6px 10px',
        fontSize: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>关系</div>
        {Object.entries(RELATION_STYLES).map(([rel, style]) => (
          <div key={rel} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <svg width={16} height={12}><line x1={0} y1={6} x2={16} y2={6}
              stroke={style.color} strokeWidth={1.5} strokeDasharray={style.dash} /></svg>
            <span style={{ color: '#6B7280', fontSize: 10 }}>
              {rel === 'PREREQUISITE' ? '前置依赖' : rel === 'CONTAINS' ? '包含关系' : rel === 'RELATED_TO' ? '相关关联' : rel === 'APPLIES' ? '应用关系' : rel === 'DEPENDS_ON' ? '依赖关系' : rel}
            </span>
          </div>
        ))}
      </div>

      {/* ── 控制栏 ── */}
      <div style={{
        position: 'absolute', right: 12, top: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <ControlBtn label="+" title="放大" onClick={zoomIn} />
        <ControlBtn label="−" title="缩小" onClick={zoomOut} />
        <ControlBtn label="⟲" title="重置缩放" onClick={resetZoom} />
        <ControlBtn label="⊡" title="适应窗口" onClick={fitToView} />
      </div>

      {/* ── 布局切换栏 ── */}
      <div style={{
        position: 'absolute', right: 12, bottom: 12,
        display: 'flex', gap: 3, background: 'var(--app-bg-elevated)',
        borderRadius: 10, border: '1px solid #E5E7EB', padding: 3,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        {([
          ['force', '⟳'],
          ['circular', '○'],
          ['grid', '⊞'],
          ['concentric', '◎'],
        ] as [LayoutType, string][]).map(([layout, icon]) => (
          <button key={layout}
            onClick={() => handleLayout(layout)}
            title={layout === 'force' ? '力导向' : layout === 'circular' ? '环形' : layout === 'grid' ? '网格' : '同心圆'}
            style={{
              width: 30, height: 28, borderRadius: 7, border: 'none',
              background: currentLayout === layout ? '#4f6df5' : 'transparent',
              color: currentLayout === layout ? '#fff' : 'var(--kg-text-secondary)',
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {icon}
          </button>
        ))}
      </div>

      {/* ── 悬浮提示 ── */}
      {hoveredNode && (
        <div style={{
          position: 'absolute', left: tooltipPos.x, top: tooltipPos.y,
          padding: '8px 12px', background: 'rgba(30,41,59,0.92)', color: '#fff',
          borderRadius: 8, fontSize: 12, maxWidth: 220,
          pointerEvents: 'none', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{hoveredNode.label}</div>
          <div style={{ display: 'flex', gap: 8, opacity: 0.85, fontSize: 11 }}>
            <span>{hoveredNode.domainName}</span>
            <span>难度 {'⭐'.repeat(hoveredNode.difficulty)}</span>
          </div>
          <div style={{ opacity: 0.7, fontSize: 10, marginTop: 2 }}>
            关联数: {hoveredNode.degree}
            {hoveredNode.isSeed && ' · 🔍 检索命中'}
          </div>
        </div>
      )}
    </div>
  )
}

/** 缩放控制按钮 */
function ControlBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title}
      style={{
        width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB',
        background: 'var(--app-bg-elevated)', color: 'var(--kg-text)',
        fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
      {label}
    </button>
  )
}
