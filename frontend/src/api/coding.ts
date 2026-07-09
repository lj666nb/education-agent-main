import api from './auth'

export interface ProblemSummary {
  id: string
  title: string
  difficulty: string
  status: 'not_started' | 'attempted' | 'completed'
}

export interface PointNode {
  point_id: string
  point_name: string
  problems: ProblemSummary[]
}

export interface DomainNode {
  domain_id: string
  domain_name: string
  sort_order: number
  total_problems: number
  completed_count: number
  points: PointNode[]
}

export interface CodingTreeResponse {
  domains: DomainNode[]
}

export interface CodingProblemResponse {
  id: string
  title: string
  type: string
  content: Record<string, any>
  difficulty: string
  knowledge_point_uuids: string[]
  tags: string[]
  user_last_code: string | null
}

export interface AnalyzeStep {
  step: number
  line: number
  line_code: string
  action: string
  variables: Record<string, any>
  data_structure: {
    type: string
    elements: any[]
    top?: number
    [key: string]: any
  }
  explanation: string
}

export const codingApi = {
  getTree: (subjectId?: string) =>
    api.get<CodingTreeResponse>('/coding/tree', {
      params: subjectId ? { subject_id: subjectId } : {},
    }),

  getProblem: (id: string) =>
    api.get<CodingProblemResponse>(`/coding/problems/${id}`),

  analyzeCode: (
    data: { problem_id: string; code: string; language: string },
    callbacks: {
      onStatus: (msg: string) => void
      onStep: (step: AnalyzeStep) => void
      onComplete: (result: { output: string }, summary: string) => void
      onError: (msg: string) => void
    },
  ) => {
    const token = localStorage.getItem('access_token')
    return fetch('/api/v1/coding/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).then(async (response) => {
      if (!response.ok) {
        callbacks.onError(`请求失败: ${response.status}`)
        return
      }
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          try {
            const event = JSON.parse(trimmed.slice(6))
            switch (event.type) {
              case 'status':
                callbacks.onStatus(event.content)
                break
              case 'step':
                callbacks.onStep(event.data)
                break
              case 'complete':
                callbacks.onComplete(event.result, event.summary)
                break
              case 'error':
                callbacks.onError(event.content)
                break
            }
          } catch { /* skip malformed events */ }
        }
      }
    }).catch((err) => {
      callbacks.onError(err.message || '网络错误')
    })
  },

  submitResult: (data: {
    problem_id: string
    code: string
    language: string
    is_correct: boolean
    time_spent_seconds?: number
  }) => api.post<{ success: boolean; answer_id: string }>('/coding/submit-result', data),
}
