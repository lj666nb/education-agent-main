import api from './auth'

export interface GraphNode {
  id: string
  name: string
  domain_id: string
  domain_name: string
  difficulty: number
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  referencedNodes?: string[]
}

export interface SSEEvent {
  phase: 'searching' | 'nodes_found' | 'generating' | 'answer_chunk' | 'done' | 'error'
  message?: string
  content?: string
  node_ids?: string[]
  node_titles?: string[]
  full_answer?: string
  referenced_nodes?: string[]
  tokens_used?: Record<string, number>
}

export const knowledgeGraphApi = {
  /** 获取指定学科的图谱可视化数据 */
  getGraphData: (subjectId: string) =>
    api.get<GraphData>('/knowledge-graph/graph', { params: { subject_id: subjectId } }),

  /** SSE 流式知识图谱 RAG 问答 */
  streamChat: (
    subjectId: string,
    question: string,
    history: ChatMessage[],
    onEvent: (event: SSEEvent) => void,
    onDone: () => void,
    onError: (error: Error) => void,
  ): AbortController => {
    const controller = new AbortController()
    const token = localStorage.getItem('access_token') || ''

    fetch(`/api/v1/knowledge-graph/chat/${subjectId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question, history }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          onError(new Error((errData as any).detail || `HTTP ${response.status}`))
          return
        }
        const reader = response.body?.getReader()
        if (!reader) {
          onError(new Error('浏览器不支持流式响应'))
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: SSEEvent = JSON.parse(line.slice(6))
                onEvent(event)
                if (event.phase === 'done' || event.phase === 'error') {
                  onDone()
                  return
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
        onDone()
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          onError(err)
        }
      })

    return controller
  },
}
