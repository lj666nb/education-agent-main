import { useRef, useEffect } from 'react'

interface DSState {
  type: string
  elements: any[]
  top?: number
  [key: string]: any
}

interface Props {
  dataStructure: DSState | null
  width?: number
  height?: number
}

const C = {
  bg: '#1a1a2e',
  node: '#4a9eff',
  text: '#e0e0e0',
  line: '#555',
  highlight: '#ff6b6b',
  arrow: '#888',
}

export default function VisualizationCanvas({ dataStructure, width = 400, height = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !dataStructure) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, width, height)

    const { type, elements } = dataStructure
    if (type === 'array' || type === 'stack' || type === 'queue') {
      drawLinear(ctx, dataStructure, width, height)
    } else if (type === 'linked_list') {
      drawLinkedList(ctx, dataStructure, width, height)
    } else if (type === 'tree' || type === 'heap') {
      drawSimpleTree(ctx, dataStructure, width, height)
    } else {
      drawPlaceholder(ctx, type, width, height)
    }
  }, [dataStructure, width, height])

  if (!dataStructure) {
    return (
      <div style={{
        width, height, background: C.bg, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.text, fontSize: 13, textAlign: 'center', padding: 16,
      }}>
        点击「运行分析」查看数据结构推演
      </div>
    )
  }

  return <canvas ref={canvasRef} width={width} height={height} style={{ borderRadius: 8 }} />
}

/* ---- 线性结构: 数组/栈/队列 ---- */
function drawLinear(ctx: CanvasRenderingContext2D, ds: DSState, w: number, h: number) {
  const elements = ds.elements || []
  const n = elements.length
  if (n === 0) {
    ctx.fillStyle = C.text
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('(空)', w / 2, h / 2)
    return
  }

  const boxW = Math.min(56, (w - 30) / Math.max(n, 1))
  const boxH = 36
  const startX = (w - n * boxW) / 2
  const startY = h / 2 - boxH / 2

  ctx.font = '13px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < n; i++) {
    const x = startX + i * boxW
    const isActive = ds.top !== undefined && i === ds.top

    ctx.fillStyle = isActive ? C.highlight : C.node
    ctx.strokeStyle = C.line
    ctx.lineWidth = 1

    ctx.beginPath()
    roundRect(ctx, x + 2, startY + 2, boxW - 4, boxH - 4, 5)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#fff'
    const valStr = String(elements[i])
    ctx.fillText(valStr.length > 8 ? valStr.slice(0, 7) + '…' : valStr, x + boxW / 2, startY + boxH / 2)
  }

  // 标签
  if (ds.type === 'stack' && ds.top !== undefined) {
    ctx.fillStyle = C.text
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`栈顶  ↑`, startX + ds.top * boxW + boxW / 2, startY - 10)
  }
  if (ds.type === 'queue') {
    ctx.fillStyle = C.text
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`队首 →`, startX + boxW / 2, startY - 10)
    ctx.fillText(`← 队尾`, startX + (n - 1) * boxW + boxW / 2, startY + boxH + 18)
  }
}

/* ---- 链表 ---- */
function drawLinkedList(ctx: CanvasRenderingContext2D, ds: DSState, w: number, h: number) {
  const elements = ds.elements || []
  if (elements.length === 0) {
    ctx.fillStyle = C.text
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('(空链表)', w / 2, h / 2)
    return
  }

  const r = 18
  const gap = 65
  const maxPerRow = Math.floor((w - 40) / gap)
  const y = h / 2
  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < elements.length; i++) {
    const row = Math.floor(i / maxPerRow)
    const col = i % maxPerRow
    const rowCount = Math.min(maxPerRow, elements.length - row * maxPerRow)
    const rowStartX = (w - rowCount * gap) / 2 + gap / 2
    const x = rowStartX + col * gap
    const cy = y + row * 50

    ctx.fillStyle = C.node
    ctx.beginPath()
    ctx.arc(x, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    const valStr = String(elements[i])
    ctx.fillText(valStr.length > 6 ? valStr.slice(0, 5) + '…' : valStr, x, cy)

    // 箭头到下一个
    if (i < elements.length - 1 && col < maxPerRow - 1) {
      ctx.strokeStyle = C.arrow
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + r, cy)
      ctx.lineTo(x + gap - r - 4, cy)
      ctx.stroke()
      drawArrowHead(ctx, x + gap - r, cy, 'right')
    }
  }
}

/* ---- 简单树 ---- */
function drawSimpleTree(ctx: CanvasRenderingContext2D, ds: DSState, w: number, h: number) {
  const elements = ds.elements || []
  if (!Array.isArray(elements) || elements.length === 0) {
    ctx.fillStyle = C.text
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('(空树)', w / 2, h / 2)
    return
  }

  // 用数组表示完全二叉树的方式渲染
  const n = elements.length
  const nodeR = 16
  const levels = Math.ceil(Math.log2(n + 1))
  const levelH = (h - 40) / Math.max(levels, 1)

  for (let i = 0; i < n; i++) {
    const level = Math.floor(Math.log2(i + 1))
    const posInLevel = i - Math.pow(2, level) + 1
    const nodesInLevel = Math.pow(2, level)
    const x = w / 2 + (posInLevel - (nodesInLevel - 1) / 2) * 50
    const y = 30 + level * levelH

    // 连线到父节点
    if (i > 0) {
      const parentIdx = Math.floor((i - 1) / 2)
      const parentLevel = Math.floor(Math.log2(parentIdx + 1))
      const parentPos = parentIdx - Math.pow(2, parentLevel) + 1
      const parentNodes = Math.pow(2, parentLevel)
      const px = w / 2 + (parentPos - (parentNodes - 1) / 2) * 50
      const py = 30 + parentLevel * levelH

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
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const valStr = String(elements[i])
    ctx.fillText(valStr.length > 4 ? valStr.slice(0, 3) + '…' : valStr, x, y)
  }
}

/* ---- 其他 ---- */
function drawPlaceholder(ctx: CanvasRenderingContext2D, type: string, w: number, h: number) {
  ctx.fillStyle = C.text
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labels: Record<string, string> = {
    graph: '图结构 (节点+边)',
    hash_table: '哈希表',
    heap: '堆结构',
  }
  ctx.fillText(labels[type] || type, w / 2, h / 2)
}

/* ---- helpers ---- */
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
