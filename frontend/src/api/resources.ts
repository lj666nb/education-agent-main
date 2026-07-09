import api from './auth'

export interface ResourceListItem {
  id: string
  title: string
  resource_type: string
  knowledge_points: string[]
  source: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ResourceDetail extends ResourceListItem {
  content: string
}

export interface KnowledgePointGroup {
  name: string
  resource_count: number
  resources: ResourceListItem[]
}

export interface ResourcesResponse {
  resources: ResourceListItem[]
  total: number
}

export interface KnowledgePointsResponse {
  knowledge_points: KnowledgePointGroup[]
  total: number
}

export interface GenerateRequest {
  knowledge_points: string[]
  title?: string
  resource_type?: string  // mind_map | code_case | video_script | document | image_text
}

export interface GenerateResponse {
  id: string
  title: string
  content: string
  knowledge_points: string[]
  resource_type?: string
}

export interface UpdateRequest {
  title?: string
  content?: string
  knowledge_points?: string[]
}

export interface AutoGenerateResponse {
  generated: Array<{ knowledge_point: string; resource_id: string; title: string }>
  skipped: string[]
}

// ── Video Generation Types ──

export interface VideoPreviewResponse {
  task_id: string
  script_content: string
  outline_content: string
}

export interface VideoGenStatusResponse {
  task_id: string
  status: string  // pending | preview | confirmed | generating | completed | failed
  progress_message: string | null
  progress_pct: string | null
  script_content: string | null
  outline_content: string | null
  resource_id: string | null
  error_message: string | null
  knowledge_points: string[] | null
  created_at: string | null
}

export interface VideoPlayResponse {
  html: {
    type: string
    title: string
    script: string
    outline: string
    chapters: Array<{
      id: string
      title: string
      steps: Array<{
        narration: string
        visual_desc: string
        visual_type?: string
        image_query?: string
        icon_type?: string
        chart_data?: any
        table_data?: any
        animation_effect?: string
        duration_seconds: number
        audio_file?: string
        audio_url?: string
        bg_image?: string
        image_url?: string
        mindmap_data?: any
        flowchart_data?: any
        gantt_data?: any
        drawio_xml?: string
        diagram_html?: string
      }>
    }>
    html_file: string
    total_steps: number
    has_audio: boolean
  }
}

export const resourcesApi = {
  list: (params?: { knowledge_point?: string; resource_type?: string }) =>
    api.get<ResourcesResponse>('/resources', { params }),

  get: (id: string) =>
    api.get<ResourceDetail>(`/resources/${id}`),

  generate: (data: GenerateRequest) =>
    api.post<GenerateResponse>('/resources/generate', data),

  update: (id: string, data: UpdateRequest) =>
    api.put<ResourceDetail>(`/resources/${id}`, data),

  delete: (id: string) =>
    api.delete(`/resources/${id}`),

  listKnowledgePoints: () =>
    api.get<KnowledgePointsResponse>('/resources/knowledge-points'),

  autoGenerate: (data: { knowledge_points: string[]; source: string; source_ref?: string }) =>
    api.post<AutoGenerateResponse>('/resources/auto-generate', data),

  // ── Video Generation ──

  /** Step 1: 生成预览（口播稿 + 大纲） */
  videoPreview: (data: { knowledge_points: string[] }) =>
    api.post<VideoPreviewResponse>('/resources/video-preview', data),

  /** Step 2: 确认生成完整视频 */
  videoGenerate: (data: { task_id: string }) =>
    api.post<VideoGenStatusResponse>('/resources/video-generate', data),

  /** 轮询视频生成状态 */
  videoStatus: (taskId: string) =>
    api.get<VideoGenStatusResponse>(`/resources/video-gen/${taskId}`),

  /** 获取视频演示数据 */
  videoPlay: (resourceId: string, options?: { signal?: AbortSignal }) =>
    api.get<VideoPlayResponse>(`/resources/${resourceId}/video-play`, options),

  /** 删除视频生成任务 */
  deleteVideoTask: (taskId: string) =>
    api.delete(`/resources/video-gen/${taskId}`),

  /** 列出视频生成任务 */
  listVideoTasks: () =>
    api.get<VideoGenStatusResponse[]>('/resources/video-gen/tasks'),

  // ── Unsplash 图片搜索 ──

  unsplashSearch: (data: { query: string; per_page?: number; orientation?: string }) =>
    api.post<{ images: UnsplashImage[]; total: number }>('/resources/unsplash-search', data),

  // ── AI 智能编排笔记 ──

  composeNote: (data: { resource_ids: string[]; topic_name: string }) =>
    api.post<{ composed_note: string }>('/resources/compose-note', data),
}

export interface UnsplashImage {
  id: string
  description: string
  url_raw: string
  url_regular: string
  url_small: string
  url_thumb: string
  author: string
  width: number
  height: number
}

export default api
