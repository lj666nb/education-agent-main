import api from './auth'

export type CodingDifficulty = 'basic' | 'intermediate' | 'advanced' | string
export type JudgeVerdict = 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit' | string

export interface ProblemSummary {
  id: string
  title: string
  difficulty: CodingDifficulty
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

export interface ProblemExample {
  input: string
  output: string
  explanation?: string
}

export interface ProblemHint {
  level?: number
  title?: string
  content: string
}

export interface PublicTestCase {
  id: string
  name: string
  input: string
  expected_output: string
}

export interface CodingProblemContent {
  stem?: string
  description?: string
  learning_objectives?: string[]
  task_steps?: string[]
  input_format?: string
  output_format?: string
  examples?: ProblemExample[]
  sample_input?: string
  sample_output?: string
  constraints?: string[]
  edge_cases?: string[]
  interface?: {
    mode?: string
    language?: string
    entry?: string
    [key: string]: unknown
  }
  supported_languages?: string[]
  code_template?: string | Record<string, string>
  hints?: Array<ProblemHint | string>
  source_problem_id?: string
  source_url?: string
  source_platform?: string
  visual_type?: string
  judge_mode?: string
  [key: string]: unknown
}

export interface CodingProblemResponse {
  id: string
  title: string
  type: string
  content: CodingProblemContent
  answer: {
    explanation?: string
    complexity?: string
    suggested_time_seconds?: number
    [key: string]: unknown
  }
  difficulty: CodingDifficulty
  knowledge_point_uuids: string[]
  tags: string[]
  source: string | null
  user_last_code: string | null
  attempt_count: number
  public_cases: PublicTestCase[]
}

export interface TraceDataStructure {
  type: string
  elements?: unknown[]
  top?: number
  nodes?: Array<{ id: string; label?: string }>
  edges?: Array<{ from: string; to: string }>
  [key: string]: unknown
}

export interface AnalyzeStep {
  step: number
  line: number
  line_code: string
  action: string
  variables: Record<string, unknown>
  data_structure: TraceDataStructure | null
  explanation: string
}

export interface JudgeRequest {
  code: string
  language: string
  trace?: boolean
}

export interface JudgeCaseResult {
  case_no: number
  name: string
  visibility: 'sample' | 'hidden' | string
  status: JudgeVerdict
  passed: boolean
  input: string | null
  expected: string | null
  actual: string | null
  stderr: string
  execution_time: number
}

export interface JudgeResponse {
  verdict: JudgeVerdict
  passed_cases: number
  total_cases: number
  all_passed: boolean
  runtime: number
  cases: JudgeCaseResult[]
  trace: AnalyzeStep[]
  submission_id: string | null
}

export interface SubmissionHistoryItem {
  id: string
  created_at: string
  language: string
  verdict: JudgeVerdict
  is_correct: boolean
  passed_cases: number
  total_cases: number
  runtime: number
}

export interface CodingSolutionResponse {
  explanation: string
  complexity: string
  standard_answer: string | Record<string, string>
}

export const codingApi = {
  getTree: (subjectId?: string, source?: string) =>
    api.get<CodingTreeResponse>('/coding/tree', {
      params: {
        ...(subjectId ? { subject_id: subjectId } : {}),
        ...(source ? { source } : {}),
      },
    }),

  getProblem: (id: string) =>
    api.get<CodingProblemResponse>(`/coding/problems/${id}`),

  runProblem: (id: string, data: JudgeRequest) =>
    api.post<JudgeResponse>(`/coding/problems/${id}/run`, data),

  submitProblem: (id: string, data: JudgeRequest) =>
    api.post<JudgeResponse>(`/coding/problems/${id}/submit`, data),

  getSubmissions: (id: string, page = 1, pageSize = 20) =>
    api.get<SubmissionHistoryItem[]>(`/coding/problems/${id}/submissions`, {
      params: { page, page_size: pageSize },
    }),

  getSolution: (id: string) =>
    api.get<CodingSolutionResponse>(`/coding/problems/${id}/solution`),
}
