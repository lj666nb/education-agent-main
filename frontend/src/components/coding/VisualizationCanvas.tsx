import { useEffect, useRef } from 'react'

interface DSState {
  type: string
  elements?: any[]
  top?: number
  nodes?: Array<{ id: string; label?: string }>
  edges?: Array<{ from: string; to: string }>
  [key: string]: any
}

interface Props {
  dataStructure: DSState | null
  width?: number
  height?: number
  liveCode?: string
  liveLanguage?: string
}

const C = {
  bg: '#111827',
  node: '#3B82F6',
  nodeAlt: '#10B981',
  text: '#E5E7EB',
  muted: '#94A3B8',
  line: '#475569',
  highlight: '#F97316',
  arrow: '#CBD5E1',
}

export default function VisualizationCanvas({ dataStructure, width = 520, height = 260, liveCode, liveLanguage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Lightweight client-side live preview from code text
  const liveData = useLivePreview(liveCode, liveLanguage)

  // Use live data when no backend data available
  const effectiveDs = dataStructure || liveData

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !effectiveDs) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = window.devicePixelRatio || 1
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, width, height)

    const type = effectiveDs.type
    if (type === 'array' || type === 'stack' || type === 'queue') {
      drawLinear(ctx, effectiveDs, width, height)
    } else if (type === 'linked_list') {
      drawLinkedList(ctx, effectiveDs, width, height)
    } else if (type === 'tree' || type === 'heap') {
      drawSimpleTree(ctx, effectiveDs, width, height)
    } else if (type === 'graph') {
      drawGraph(ctx, effectiveDs, width, height)
    } else {
      drawPlaceholder(ctx, type, width, height)
    }
  }, [effectiveDs, height, width])

  if (!effectiveDs) {
    return (
      <div style={{
        width: '100%',
        maxWidth: width,
        height,
        background: C.bg,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.text,
        fontSize: 13,
        textAlign: 'center',
        padding: 16,
        boxSizing: 'border-box',
      }}>
        编辑代码后会在这里显示数据结构推演
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth: width,
        height,
        borderRadius: 8,
        display: 'block',
      }}
    />
  )
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string, w: number) {
  ctx.fillStyle = C.muted
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(title, 14, 12)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)'
  ctx.beginPath()
  ctx.moveTo(14, 34)
  ctx.lineTo(w - 14, 34)
  ctx.stroke()
}

function drawLinear(ctx: CanvasRenderingContext2D, ds: DSState, w: number, h: number) {
  const elements = ds.elements || []
  drawTitle(ctx, ds.type === 'stack' ? 'Stack' : ds.type === 'queue' ? 'Queue' : 'Array', w)

  if (elements.length === 0) {
    drawCenteredText(ctx, '(空)', w, h)
    return
  }

  const n = elements.length
  const boxW = Math.min(58, (w - 46) / Math.max(n, 1))
  const boxH = 40
  const startX = (w - n * boxW) / 2
  const startY = h / 2 - boxH / 2 + 12

  ctx.font = '13px Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < n; i++) {
    const x = startX + i * boxW
    const isActive = ds.top !== undefined && i === ds.top

    ctx.fillStyle = isActive ? C.highlight : C.node
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1

    ctx.beginPath()
    roundRect(ctx, x + 3, startY + 2, boxW - 6, boxH - 4, 6)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#fff'
    const valStr = String(elements[i])
    ctx.fillText(valStr.length > 8 ? `${valStr.slice(0, 7)}...` : valStr, x + boxW / 2, startY + boxH / 2)

    ctx.fillStyle = C.muted
    ctx.font = '10px Consolas, monospace'
    ctx.fillText(String(i), x + boxW / 2, startY + boxH + 10)
    ctx.font = '13px Consolas, monospace'
  }

  if (ds.type === 'stack' && ds.top !== undefined && ds.top >= 0) {
    ctx.fillStyle = C.text
    ctx.font = '11px sans-serif'
    ctx.fillText('栈顶', startX + ds.top * boxW + boxW / 2, startY - 11)
  }
  if (ds.type === 'queue' && n > 0) {
    ctx.fillStyle = C.text
    ctx.font = '11px sans-serif'
    ctx.fillText('队首', startX + boxW / 2, startY - 11)
    ctx.fillText('队尾', startX + (n - 1) * boxW + boxW / 2, startY - 11)
  }
}

function drawLinkedList(ctx: CanvasRenderingContext2D, ds: DSState, w: number, _h: number) {
  const elements = ds.elements || []
  drawTitle(ctx, 'Linked list', w)

  if (elements.length === 0) {
    drawCenteredText(ctx, '(空链表)', w, _h)
    return
  }

  const r = 18
  const gap = 72
  const maxPerRow = Math.max(1, Math.floor((w - 56) / gap))
  const firstY = 86
  ctx.font = '12px Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < elements.length; i++) {
    const row = Math.floor(i / maxPerRow)
    const col = i % maxPerRow
    const rowCount = Math.min(maxPerRow, elements.length - row * maxPerRow)
    const rowStartX = (w - rowCount * gap) / 2 + gap / 2
    const x = rowStartX + col * gap
    const y = firstY + row * 56

    ctx.fillStyle = C.nodeAlt
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    const valStr = String(elements[i])
    ctx.fillText(valStr.length > 6 ? `${valStr.slice(0, 5)}...` : valStr, x, y)

    if (i < elements.length - 1 && col < maxPerRow - 1) {
      ctx.strokeStyle = C.arrow
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + gap - r - 4, y)
      ctx.stroke()
      drawArrowHead(ctx, x + gap - r, y, 'right')
    }
  }
}

function drawSimpleTree(ctx: CanvasRenderingContext2D, ds: DSState, w: number, h: number) {
  const elements = flattenTreeElements(ds.elements || ds.root || [])
  drawTitle(ctx, ds.type === 'heap' ? 'Heap' : 'Tree', w)

  if (!Array.isArray(elements) || elements.length === 0) {
    drawCenteredText(ctx, '(空树)', w, h)
    return
  }

  const n = Math.min(elements.length, 31)
  const nodeR = 16
  const levels = Math.ceil(Math.log2(n + 1))
  const levelH = Math.max(38, (h - 70) / Math.max(levels - 1, 1))

  for (let i = 0; i < n; i++) {
    const level = Math.floor(Math.log2(i + 1))
    const posInLevel = i - Math.pow(2, level) + 1
    const nodesInLevel = Math.pow(2, level)
    const x = w / 2 + (posInLevel - (nodesInLevel - 1) / 2) * Math.max(38, w / Math.pow(2, level + 1))
    const y = 58 + level * levelH

    if (i > 0) {
      const parentIdx = Math.floor((i - 1) / 2)
      const parentLevel = Math.floor(Math.log2(parentIdx + 1))
      const parentPos = parentIdx - Math.pow(2, parentLevel) + 1
      const parentNodes = Math.pow(2, parentLevel)
      const px = w / 2 + (parentPos - (parentNodes - 1) / 2) * Math.max(38, w / Math.pow(2, parentLevel + 1))
      const py = 58 + parentLevel * levelH

      ctx.strokeStyle = C.line
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, py + nodeR)
      ctx.lineTo(x, y - nodeR)
      ctx.stroke()
    }

    ctx.fillStyle = C.node
    ctx.beginPath()
    ctx.arc(x, y, nodeR, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = '11px Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const valStr = String(elements[i])
    ctx.fillText(valStr.length > 4 ? `${valStr.slice(0, 3)}...` : valStr, x, y)
  }
}

function drawGraph(ctx: CanvasRenderingContext2D, ds: DSState, w: number, h: number) {
  const nodes = ds.nodes || (ds.elements || []).map((value, index) => ({ id: String(index), label: String(value) }))
  const edges = ds.edges || []
  drawTitle(ctx, 'Graph', w)

  if (!nodes.length) {
    drawCenteredText(ctx, '(空图)', w, h)
    return
  }

  const cx = w / 2
  const cy = h / 2 + 14
  const radius = Math.min(w, h) / 2 - 52
  const positions = new Map<string, { x: number; y: number }>()

  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2
    positions.set(node.id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    })
  })

  ctx.strokeStyle = C.line
  ctx.lineWidth = 1.4
  edges.forEach(edge => {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (!from || !to) return
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  })

  nodes.forEach(node => {
    const pos = positions.get(node.id)
    if (!pos) return
    ctx.fillStyle = C.nodeAlt
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '11px Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(node.label || node.id).slice(0, 6), pos.x, pos.y)
  })
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, type: string, w: number, h: number) {
  const labels: Record<string, string> = {
    hash_table: '哈希表结构',
    heap: '堆结构',
  }
  drawTitle(ctx, labels[type] || type || 'Data structure', w)
  drawCenteredText(ctx, labels[type] || type || '暂不支持的数据结构', w, h)
}

function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, w: number, h: number) {
  ctx.fillStyle = C.text
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2)
}

function flattenTreeElements(input: any): any[] {
  if (Array.isArray(input)) return input
  if (!input || typeof input !== 'object') return []
  const result: any[] = []
  const queue = [input]
  while (queue.length) {
    const node = queue.shift()
    if (!node) {
      result.push(null)
      continue
    }
    result.push(node.val ?? node.value ?? node.label ?? '')
    if (node.left || node.right) {
      queue.push(node.left || null)
      queue.push(node.right || null)
    }
  }
  return result
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, dir: string) {
  ctx.beginPath()
  if (dir === 'right') {
    ctx.moveTo(x, y)
    ctx.lineTo(x - 6, y - 4)
    ctx.lineTo(x - 6, y + 4)
  }
  ctx.closePath()
  ctx.fillStyle = C.arrow
  ctx.fill()
}

/* ── Lightweight live preview: parse code text without backend ── */

function useLivePreview(code?: string, language?: string): DSState | null {
  if (!code || !code.trim()) return null

  try {
    if (language === 'python' || language === 'python3') {
      return parsePythonLive(code)
    }
    // JS/TS-like languages
    if (language === 'javascript' || language === 'typescript' || language === 'java' || language === 'cpp' || language === 'c' || language === 'go' || language === 'rust') {
      return parseJSLive(code)
    }
    // Default: try both
    return parsePythonLive(code) || parseJSLive(code)
  } catch {
    return null
  }
}

function parsePythonLive(code: string): DSState | null {
  // Match `varname = [...]` or `varname = [...]  # comment`
  const arrMatch = code.match(/(\w+)\s*=\s*\[([^\]]*)\]/)
  if (arrMatch) {
    const elements = arrMatch[2]
      .split(',')
      .map(s => {
        const trimmed = s.trim()
        const num = Number(trimmed)
        return isNaN(num) ? trimmed.replace(/['"]/g, '') : num
      })
      .filter(s => s !== '')
    if (elements.length > 0) {
      return { type: 'array', elements, name: arrMatch[1] }
    }
  }
  // Match standalone list literal `[...]`
  const listMatch = code.match(/\[([^\]]*)\]/)
  if (listMatch) {
    const elements = listMatch[1]
      .split(',')
      .map(s => {
        const trimmed = s.trim()
        const num = Number(trimmed)
        return isNaN(num) ? trimmed.replace(/['"]/g, '') : num
      })
      .filter(s => s !== '')
    if (elements.length > 0) {
      return { type: 'array', elements }
    }
  }
  return null
}

function parseJSLive(code: string): DSState | null {
  // Match `let/var/const name = [...]` or `name = [...]`
  const arrMatch = code.match(/(?:let|var|const)\s+(\w+)\s*=\s*\[([^\]]*)\]/) || code.match(/(\w+)\s*=\s*\[([^\]]*)\]/)
  if (arrMatch) {
    const elements = arrMatch[2]
      .split(',')
      .map(s => {
        const trimmed = s.trim()
        const num = Number(trimmed)
        return isNaN(num) ? trimmed.replace(/['"`]/g, '') : num
      })
      .filter(s => s !== '')
    if (elements.length > 0) {
      return { type: 'array', elements, name: arrMatch[1] }
    }
  }
  // Match standalone array literal
  const listMatch = code.match(/\[([^\]]*)\]/)
  if (listMatch) {
    const elements = listMatch[1]
      .split(',')
      .map(s => {
        const trimmed = s.trim()
        const num = Number(trimmed)
        return isNaN(num) ? trimmed.replace(/['"`]/g, '') : num
      })
      .filter(s => s !== '')
    if (elements.length > 0) {
      return { type: 'array', elements }
    }
  }
  return null
}
