import api from './auth'

export interface RecommendationResource {
  id: string
  title: string
  resource_type: string
  resource_type_label: string
  knowledge_points: string[]
  difficulty_level: number | null
  source: string | null
  source_label: string | null
  tags: string[]
  created_at: string
  mastery_score: number | null
}

export interface PersonalizedResponse {
  resources: RecommendationResource[]
  total: number
}

export interface FeedbackResponse {
  success: boolean
  message: string
}

export const recommendationsCenterApi = {
  getPersonalized: (params?: {
    resource_type?: string
    subject_id?: string
    page?: number
    page_size?: number
  }) =>
    api.get<PersonalizedResponse>('/recommendations/personalized', { params }),

  submitFeedback: (resourceId: string, useful: boolean) =>
    api.post<FeedbackResponse>(`/recommendations/${resourceId}/feedback`, { useful }),

  deleteResource: (resourceId: string) =>
    api.delete(`/resources/${resourceId}`),

  getNotebook: (params?: { subject_id?: string }) =>
    api.get<NotebookResponse>('/recommendations/notebook', { params }),
}

// Resource type config
export const RESOURCE_TYPE_CONFIG: Record<string, {
  label: string; icon: string; color: string; bg: string; section: string
}> = {
  mind_map:           { label: '思维导图', icon: '导图', color: '#1677E8', bg: 'rgba(2,132,199,0.1)', section: '知识梳理' },
  document:           { label: '知识文档', icon: '文档', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', section: '知识梳理' },
  image_text:         { label: '图文讲解', icon: '图文', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', section: '知识梳理' },
  explanation:        { label: '知识讲解', icon: '讲解', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', section: '知识梳理' },
  exercise:           { label: '练习题',   icon: '练习', color: '#10B981', bg: 'rgba(16,185,129,0.1)', section: '练习巩固' },
  review_question:    { label: '复习题',   icon: '复习', color: '#14B8A6', bg: 'rgba(20,184,166,0.1)', section: '练习巩固' },
  variation_exercise: { label: '变式练习', icon: '变式', color: '#1677E8', bg: 'rgba(2,132,199,0.1)', section: '练习巩固' },
  code_case:          { label: '代码案例', icon: '代码', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', section: '实践应用' },
  video_script:       { label: '视频脚本', icon: '脚本', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', section: '视频学习' },
  video:              { label: '视频讲解', icon: '视频', color: '#EC4899', bg: 'rgba(236,72,153,0.1)', section: '视频学习' },
  extra_reading:      { label: '拓展阅读', icon: '阅读', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', section: '拓展资源' },
  memory_card:        { label: '记忆卡片', icon: '卡片', color: '#F97316', bg: 'rgba(249,115,22,0.1)', section: '练习巩固' },
  flash_card:         { label: '闪卡',     icon: '闪卡', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', section: '练习巩固' },
  knowledge_comic:    { label: '知识漫画', icon: '漫画', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', section: '拓展资源' },
  infographic:        { label: '信息图解', icon: '图解', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', section: '拓展资源' },
  summary_report:     { label: '总结报告', icon: '报告', color: '#84CC16', bg: 'rgba(132,204,22,0.1)', section: '学习报告' },
}

// ── Notebook types ──

export interface NotebookResource {
  id: string
  title: string
  resource_type: string
  resource_type_label: string
  knowledge_points: string[]
  difficulty_level: number | null
  source: string | null
  source_label: string | null
  tags: string[]
  created_at: string
  mastery_score: number | null
  content: string | null  // 完整资源内容（Markdown），用于内联渲染
}

export interface NotebookSection {
  type: string
  type_label: string
  resources: NotebookResource[]
}

export interface NotebookTopic {
  id: string
  title: string
  resource_count: number
  mastery_score: number | null
  sections: NotebookSection[]
}

export interface NotebookCategory {
  id: string
  title: string
  sort_order: number
  topics: NotebookTopic[]
}

export interface NotebookResponse {
  categories: NotebookCategory[]
  total_resources: number
  total_topics: number
}
