import api from './auth'

export interface PathNodeStatus {
  point_id: string
  point_name: string
  domain_name: string
  domain_sort_order: number
  sort_order: number
  mastery_score: number
  status: 'not_started' | 'learning' | 'mastered' | 'reviewing' | 'locked'
  is_difficult: boolean
  needs_review: boolean
}

export interface DagNode {
  id: string
  point_id: string
  label: string
  progress: 'completed' | 'in_progress' | 'not_started'
  mastery_score: number
  is_weak: boolean
  domain: string
  subject: string
}

export interface DagEdge {
  id: string
  source: string
  target: string
  label: string
  type: 'PREREQUISITE' | 'RELATED_TO'
  animated: boolean
}

export interface DagData {
  nodes: DagNode[]
  edges: DagEdge[]
  metadata: Record<string, any>
}

export interface LearningPathMarkdownResponse {
  nodes: PathNodeStatus[]
  summary: {
    total: number
    mastered: number
    learning: number
    not_started: number
    reviewing: number
    difficult: number
  }
  dag_data: DagData
}

export interface PathHistoryItem {
  id: string
  agent_reason: string | null
  snapshot_data: Record<string, any>
  created_at: string
}

export interface PathHistoryResponse {
  items: PathHistoryItem[]
  total: number
}

export interface AgentRecommendation {
  type: 'review' | 'practice' | 'study_rest' | 'study' | 'unlock' | 'breakthrough'
  title: string
  description: string
  priority: 'high' | 'normal' | 'low'
  related_point_id: string | null
  related_point_name: string | null
  action_label: string
  action_url: string
}

export interface AgentRecommendationListResponse {
  recommendations: AgentRecommendation[]
  total: number
}

export interface KnowledgePointRecordResponse {
  point_id: string
  point_name: string
  domain_name: string
  subject_name: string
  mastery_score: number
  recent_accuracy: number
  consecutive_errors: number
  total_practiced: number
  total_correct: number
  total_time_spent_seconds: number
  study_count: number
  last_study_at: string | null
  last_practice_at: string | null
  next_review_at: string | null
  status: string
  video_url: string | null
  review_material: string | null
}

// ═══════════════════════════════════════════════════
//  V3 新增：路径执行状态机
// ═══════════════════════════════════════════════════

export interface NodeOrderItem {
  node_id: string
  name: string
  domain_name: string
  status: 'pending' | 'active' | 'done' | 'skipped' | 'locked' | 'reviewing'
  mastery_score: number
  sort_order: number
  started_at: string | null
  completed_at: string | null
}

export interface CurrentNodeInfo {
  node_id: string
  name: string
  domain_name: string
  mastery_score: number
  status: string
  reason: string
}

export interface PathProgress {
  total: number
  completed: number
  skipped: number
  percentage: number
}

export interface PathStateData {
  id: string
  phase: 'diagnosis' | 'learning' | 'practice' | 'review' | 'completed'
  goal_type: string
  goal_description: string
  current_node: CurrentNodeInfo | null
  node_order: NodeOrderItem[]
  progress: PathProgress
  version: number
  subject_id: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PathStateResponse {
  has_active_path: boolean
  state: PathStateData | null
}

export interface PathInitRequest {
  subject_id: string
  goal_type: string
  goal_description: string
}

export interface PathInitResponse {
  state_id: string
  message: string
  phase: string
  total_nodes: number
}

export interface PathProgressUpdate {
  node_id: string
  action: 'complete' | 'skip' | 'unskip'
  state_id?: string  // 指定路径ID，确保操作正确的状态机
}

export interface PathProgressResult {
  success: boolean
  message: string
  current_node: CurrentNodeInfo | null
  phase: string
  progress: PathProgress
  replanned?: boolean
  changed_count?: number
}

// ═══════════════════════════════════════════════════
//  AI 个性化路径生成
// ═══════════════════════════════════════════════════

export interface PathGenerationRequest {
  subject_id: string
  goal_type: string
  goal_description: string
  target_score: string
  deadline: string
}

export interface PhaseInfo {
  name: string
  days: number
  focus: string
  node_ids: string[]
  node_names: string[]
}

export interface DailySuggestion {
  recommended_session_minutes: number
  best_time: string
  tasks_per_day: number
  note: string
}

export interface PathGenerationResponse {
  path_id: string
  path_name: string
  description: string
  total_days: number
  total_nodes: number
  phases: PhaseInfo[]
  daily_suggestion: DailySuggestion | null
  strategy_notes: string[]
  generation_reason: string
  nodes: {
    id: string
    name: string
    domain_name: string
    difficulty: number
    mastery_score: number
  }[]
  edges: {
    id: string
    source: string
    target: string
    label: string
    type: string
    animated: boolean
  }[]
}

export interface ApiCheckResponse {
  has_llm: boolean
  has_cognitive_data: boolean
  message: string
  providers: string[]
}

export interface StyleAssessmentRequest {
  q1: string
  q2: string
  q3: string
}

export interface StyleAssessmentResponse {
  cognitive_style: string
  active_hours: Record<string, number>
  message: string
}

export interface ConfirmPathRequest {
  goal_type: string
  goal_description: string
  subject_id: string
  generated_path: PathGenerationResponse
}

export interface ConfirmPathResponse {
  state_id: string
  message: string
  phase: string
  total_nodes: number
}

export interface PathListItem {
  state_id: string
  path_name: string
  subject_id: string
  subject_name: string
  goal_type: string
  phase: string
  total_nodes: number
  completed_nodes: number
  progress_pct: number
  total_days: number
  phases_count: number
  created_at: string
  updated_at: string
}

export interface PathListResponse {
  paths: PathListItem[]
  total: number
}

export const pathApi = {
  /** 获取已有路径列表（路径选择页使用） */
  listPaths: () =>
    api.get<PathListResponse>('/path/list'),

  /** AI 个性化路径生成 */
  generatePath: (data: PathGenerationRequest) =>
    api.post<PathGenerationResponse>('/path/generate', data),

  /** 检查 LLM API 可用性 */
  checkApi: () =>
    api.get<ApiCheckResponse>('/path/check-api'),

  /** 提交学习风格评估 */
  submitStyleAssessment: (data: StyleAssessmentRequest) =>
    api.post<StyleAssessmentResponse>('/path/style-assessment', data),

  /** 确认 AI 生成的个性化路径，持久化到状态机 */
  confirmPath: (data: ConfirmPathRequest) =>
    api.post<ConfirmPathResponse>('/path/confirm', data),

  /** 获取学习路径（节点状态列表 + DAG 图数据） */
  getCurrentPath: (goalType?: string) =>
    api.get<LearningPathMarkdownResponse>('/path/current', { params: { goal_type: goalType || '' } }),

  /** 获取 Agent 推荐列表 */
  getAgentRecommendations: (params?: Record<string, any>) =>
    api.get<AgentRecommendationListResponse>('/path/agent/recommend', { params }),

  /** 接受 Agent 建议 */
  acceptRecommendation: (data: {
    recommendation_type: string
    point_id?: string
  }) =>
    api.post('/path/agent/accept', data),

  /** 拒绝 Agent 建议 */
  rejectRecommendation: (data: {
    recommendation_type: string
    point_id?: string
  }) =>
    api.post('/path/agent/reject', data),

  /** 获取单个知识点详情 */
  getKnowledgeDetail: (pointId: string) =>
    api.get<KnowledgePointRecordResponse>(`/path/knowledge/${pointId}`),

  /** 记录知识点了解行为（标记/取消标记已学习） */
  recordKnowledgeStudy: (pointId: string, durationSeconds?: number, action?: 'mark' | 'unmark') =>
    api.post(`/path/knowledge/${pointId}/record-study`, {
      study_duration_seconds: durationSeconds ?? 30,
      action: action ?? 'mark',
    }),

  /** 获取路径调整历史 */
  getPathHistory: () =>
    api.get<PathHistoryResponse>('/path/history'),

  // ═══════════════════════════════════════════════════
  //  V3 新增：路径执行状态机
  // ═══════════════════════════════════════════════════

  /** 初始化学习路径 */
  initPath: (data: PathInitRequest) =>
    api.post<PathInitResponse>('/path/init', data),

  /** 获取当前路径执行状态 */
  getPathState: (stateId?: string) =>
    api.get<PathStateResponse>('/path/state', { params: stateId ? { state_id: stateId } : {} }),

  /** 上报节点学习进度 */
  updateProgress: (data: PathProgressUpdate) =>
    api.post<PathProgressResult>('/path/progress', data),

  /** 重新开始路径 */
  restartPath: () =>
    api.post<{ success: boolean; message: string }>('/path/restart'),

  replanPath: (data?: { state_id?: string; trigger?: string }) =>
    api.post<{
      success: boolean
      message: string
      changed_count: number
      current_node: { node_id: string; name: string } | null
      phase: string
      progress: PathProgress
    }>('/path/replan', data || {}),

  /** 设置知识点视频链接 */
  updateVideoUrl: (pointId: string, videoUrl: string) =>
    api.put<{ success: boolean; video_url: string }>(`/path/knowledge/${pointId}/video-url`, { video_url: videoUrl }),

  /** 生成知识点阅读讲义 */
  generateReviewMaterial: (pointId: string) =>
    api.post<{ success: boolean; content: string; source_mode?: string; message?: string }>(`/path/knowledge/${pointId}/review-material`),

  /** 获取掌握度测评题目 */
  assess: (pointId: string) =>
    api.post<AssessStartResponse>(`/path/knowledge/${pointId}/assess`),

  /** 提交掌握度测评答案 */
  submitAssess: (pointId: string, answers: AssessAnswer[]) =>
    api.post<AssessSubmitResponse>(`/path/knowledge/${pointId}/assess/submit`, { answers }),

  /** 批量生成知识点阅读讲义（point_ids 为空则自动发现全部空讲义） */
  batchGenerateReviewMaterials: (pointIds?: string[]) =>
    api.post<BatchReviewResponse>('/path/knowledge/batch-review-materials', { point_ids: pointIds || [] }),
}

export interface AssessQuestion {
  question_id: string
  type: string
  stem: string
  options: string[]
  correct_answer: string
  explanation: string
}

export interface AssessStartResponse {
  bank_id: string
  point_name: string
  questions: AssessQuestion[]
  total: number
}

export interface AssessAnswer {
  question_id: string
  user_choice: string
}

export interface AssessSubmitResponse {
  success: boolean
  correct: number
  total: number
  score: number
  path_replanned?: boolean
  path_changed_count?: number
}

export interface BatchReviewItem {
  point_id: string
  point_name: string
  success: boolean
  content: string
  message: string
}

export interface BatchReviewResponse {
  total_found: number
  generated: number
  failed: number
  items: BatchReviewItem[]
}
