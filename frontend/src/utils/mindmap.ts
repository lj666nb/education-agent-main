/**
 * 客户端 Markdown → Mermaid mindmap 转换器
 *
 * 从 AI 回复的 Markdown 文本中提取标题层级（# ## ###），
 * 构建为 Mermaid mindmap 格式，由 MermaidRenderer 渲染。
 * 无需调用任何后端 API。
 */

interface MindmapNode {
  text: string
  level: number
  children: MindmapNode[]
}

/** 限制节点文本长度，移除 markdown 格式标记 */
function cleanNodeText(text: string, maxLen = 20): string {
  let cleaned = text
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/\*(.+?)\*/g, '$1')            // italic
    .replace(/`(.+?)`/g, '$1')              // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[#\s]+/, '')                  // heading markers
    .replace(/^\d+\.\s*/, '')                // numbered list
    .replace(/^[-*+]\s*/, '')                // bullet list
    .trim()

  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen - 1) + '…'
  }
  return cleaned
}

/** 转义 Mermaid 特殊字符（括号会干扰 mindmap 语法） */
function escapeMermaidText(text: string): string {
  return text
    .replace(/[\(\)\[\]\{\}]/g, '')  // 移除括号
    .replace(/:/g, '：')              // 冒号转全角
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/"/g, "'")
    .trim()
}

/**
 * 递归构建 Mermaid mindmap 缩进行。
 * Mermaid mindmap 要求唯一根节点，使用 root((text)) 语法。
 *
 * @param nodes 当前层级的节点列表
 * @param depth 当前缩进深度（0 = 直接在 mindmap 声明下一行）
 * @param isRoot 是否作为根节点（使用 root((...)) 语法）
 */
function buildMermaidLines(nodes: MindmapNode[], depth: number, isRoot: boolean): string[] {
  const lines: string[] = []
  const prefix = '  '.repeat(depth)

  for (const node of nodes) {
    if (!node.text) continue
    const escaped = escapeMermaidText(node.text)
    if (!escaped) continue

    if (isRoot) {
      // 根节点使用 root((...)) 语法
      lines.push(`${prefix}root((${escaped}))`)
    } else {
      lines.push(`${prefix}${escaped}`)
    }

    // 子节点增加一级缩进
    if (node.children.length > 0) {
      lines.push(...buildMermaidLines(node.children, depth + 1, false))
    }
  }
  return lines
}

/**
 * 从 Markdown 文本提取标题层级，构建 Mermaid mindmap。
 *
 * Mermaid mindmap 要求唯一的根节点。如果解析出多个顶级标题，
 * 则创建「思维导图」作为合成根节点，所有顶级标题成为其子节点。
 *
 * 规则：
 * - # → 顶级节点（h1）
 * - ## → 二级节点
 * - ### → 三级节点
 * - 列表项 / 粗体文本 → 附加到当前标题下
 */
export function markdownToMindmap(markdown: string): string {
  const lines = markdown.split('\n')
  const topNodes: MindmapNode[] = []
  const stack: MindmapNode[] = [] // 标题路径栈

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过非内容行
    if (
      trimmed.startsWith('```') ||
      /^[-*_]{3,}$/.test(trimmed) ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('![') ||
      /^\[(DRAWIO|PLOT|SVG|MERMAID)\]/.test(trimmed)
    ) continue

    // 标题行
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = cleanNodeText(headingMatch[2])
      if (!text) continue

      const node: MindmapNode = { text, level, children: [] }

      // 弹出所有层级 >= 当前层级的节点（它们不再是父节点）
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length === 0) {
        topNodes.push(node)
      } else {
        stack[stack.length - 1].children.push(node)
      }
      stack.push(node)
      continue
    }

    // 列表项 / 粗体 → 附加到当前标题下
    const listMatch = trimmed.match(/^[-*+]\s+(.+)/)
    const boldMatch = trimmed.match(/\*\*(.+?)\*\*/)
    let itemText = ''
    if (listMatch) {
      itemText = cleanNodeText(listMatch[1])
    } else if (boldMatch && stack.length > 0) {
      itemText = cleanNodeText(boldMatch[1])
    }

    if (itemText && stack.length > 0) {
      const parent = stack[stack.length - 1]
      parent.children.push({ text: itemText, level: parent.level + 1, children: [] })
    }
  }

  // 如果没有标题，尝试从粗体文本构建
  if (topNodes.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const boldMatch = trimmed.match(/\*\*(.+?)\*\*/)
      if (boldMatch) {
        const text = cleanNodeText(boldMatch[1])
        if (text) topNodes.push({ text, level: 1, children: [] })
        if (topNodes.length >= 8) break
      }
    }
  }

  if (topNodes.length === 0) return ''

  // Mermaid mindmap 要求唯一根节点
  let rootNode: MindmapNode
  if (topNodes.length === 1 && topNodes[0].children.length > 0) {
    // 恰好一个顶级标题且有子标题 → 直接作为根
    rootNode = topNodes[0]
  } else {
    // 多个顶级标题 / 单个但无子标题 → 合成根节点
    rootNode = {
      text: '思维导图',
      level: 0,
      children: topNodes,
    }
  }

  const lines_out = ['mindmap']
  lines_out.push(...buildMermaidLines([rootNode], 0, true))
  return lines_out.join('\n')
}

/**
 * 将 Markdown 文本转换为完整的 [MERMAID] 思维导图块，
 * 可直接追加到消息内容末尾。
 */
export function convertMarkdownToMindmapBlock(markdown: string): string {
  const mindmapCode = markdownToMindmap(markdown)
  if (!mindmapCode) return ''
  return `\n\n[MERMAID]\n${mindmapCode}\n[/MERMAID]`
}
