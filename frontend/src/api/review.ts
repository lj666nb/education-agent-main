import api from './auth'

export interface DueKnowledgePoint {
  point_id: string
  point_name: string
  mastery_score: number
  recent_accuracy: number
  consecutive_errors: number
  total_practiced: number
  study_count: number
  status: string
  last_study_at: string | null
  next_review_at: string | null
  review_label: string
}

export interface DashboardResponse {
  due_points: DueKnowledgePoint[]
  wrong_answer_count: number
  today_progress: {
    reviewed: number
    total_due: number
  }
}

export interface KnowledgePointData {
  point_id: string | null
  point_name: string
  mastery_score: number
  recent_accuracy: number
  consecutive_errors: number
  total_practiced: number
  study_count: number
  status: string
  last_practice_at: string | null
  next_review_at: string | null
  needs_review: boolean
}

export interface KnowledgeDomainData {
  id: string
  name: string
  points: KnowledgePointData[]
}

export interface SubjectData {
  id: string
  name: string
  total_points: number
  avg_mastery: number
  domains: KnowledgeDomainData[]
}

// 复习趋势
export interface DailyTrend {
  date: string
  review_count: number
  avg_mastery: number
}

export interface ReviewTrendsResponse {
  total_reviews: number
  avg_mastery: number
  daily: DailyTrend[]
}

// 薄弱知识点
export interface WeakPoint {
  point_id: string | null
  point_name: string
  mastery_score: number
  consecutive_errors: number
  domain_name: string
  subject_name: string
  needs_review: boolean
}

export interface WeakPointsResponse {
  weak_points: WeakPoint[]
  total: number
}

export const reviewApi = {
  getDashboard: () => api.get<DashboardResponse>('/review/dashboard'),
  markComplete: (pointId: string) => api.post(`/review/${pointId}/complete`),
  getKnowledgePoints: (subjectId?: string) =>
    api.get<{subjects: SubjectData[]}>('/review/knowledge-points', { params: subjectId ? { subject_id: subjectId } : {} }),
  getTrends: (days: number = 30) =>
    api.get<ReviewTrendsResponse>('/review/trends', { params: { days } }),
  getWeakPoints: (threshold: number = 30) =>
    api.get<WeakPointsResponse>('/review/weak-points', { params: { threshold } }),
}
