import axios from 'axios'
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  RegisterResponse,
  UserWithProfile,
  UserProfile
} from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: {
    serialize: (params) => {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            if (v !== undefined && v !== null && v !== '') {
              searchParams.append(key, String(v))
            }
          }
        } else if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value))
        }
      }
      return searchParams.toString()
    },
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
    })
    if (error.response?.status === 401 && error.config && !error.config._retry) {
      error.config._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const response = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken })
          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)
          error.config.headers.Authorization = `Bearer ${access_token}`
          return api(error.config)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', data),

  register: (data: RegisterRequest) =>
    api.post<RegisterResponse>('/auth/register', data),

  refresh: (refreshToken: string) =>
    api.post<{ access_token: string }>('/auth/refresh', { refresh_token: refreshToken }),
}

export const profileApi = {
  getProfile: () =>
    api.get<UserWithProfile>('/profile'),

  updateProfile: (data: Partial<UserProfile>) =>
    api.put<UserWithProfile>('/profile', data),

  getUsers: () =>
    api.get<UserWithProfile[]>('/profile/users'),

  deleteUser: (userId: string) =>
    api.delete(`/profile/users/${userId}`),

  deleteAccount: () =>
    api.delete('/profile/account'),
}

export const profileV2Api = {
  createProfile: (data: any) =>
    api.post('/profile/v2', data),

  getProfile: () =>
    api.get('/profile/v2'),

  getSummary: () =>
    api.get('/profile/v2/summary'),

  updateProfile: (data: any) =>
    api.put('/profile/v2', data),

  addKnowledge: (data: any) =>
    api.post('/profile/v2/knowledge', data),

  updateKnowledge: (data: any) =>
    api.put('/profile/v2/knowledge', data),

  deleteKnowledge: (knowledgePoint: string) =>
    api.delete(`/profile/v2/knowledge/${knowledgePoint}`),

  recordBehavior: (data: any) =>
    api.post('/profile/v2/behavior', data),

  addErrorTopic: (data: any) =>
    api.post('/profile/v2/error-prone', data),

  getTimeline: (limit?: number, skip?: number) =>
    api.get('/profile/v2/timeline', { params: { limit, skip } }),

  getBehaviorEvents: (eventType?: string, limit?: number, skip?: number) =>
    api.get('/profile/v2/behavior', { params: { event_type: eventType, limit, skip } }),

  deleteProfile: () =>
    api.delete('/profile/v2'),
}

export const chatApi = {
  profileInit: (data: {
    message: string
    conversation_history: Array<{ role: string; content: string }>
    collected_info: Record<string, string>
  }) =>
    api.post('/chat/profile-init', data),

  completions: (data: {
    chat_id?: string
    model: 'deepseek' | 'qwen'
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    stream?: boolean
    temperature?: number
    max_tokens?: number
  }) =>
    api.post('/chat/completions', data, {
      responseType: data.stream ? 'stream' : 'json',
    }),

  listModels: () =>
    api.get('/chat/models'),

  getHistory: (limit?: number, offset?: number, search?: string, projectId?: string) =>
    api.get('/chat/history', { params: { limit, offset, search, project_id: projectId } }),

  getMessages: (chatId: string) =>
    api.get(`/chat/${chatId}/messages`),

  createSession: (data: { title?: string; model: string; project_id?: string }) =>
    api.post('/chat/sessions', data),

  updateSession: (chatId: string, data: { title?: string }) =>
    api.patch(`/chat/sessions/${chatId}`, data),

  deleteSession: (chatId: string) =>
    api.delete(`/chat/sessions/${chatId}`),

  saveMessage: (data: { chat_id: string; role: string; content: string; reasoning_content?: string; citations?: Array<{index: number; title: string; url: string; snippet: string}> }) =>
    api.post('/chat/messages', data),

  ocrRecognize: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/ocr/recognize', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  createAttachment: (data: { session_id: string; file_id: string; file_name: string; file_type: string }) =>
    api.post('/chat/attachments', data),

  getAttachments: (chatId: string) =>
    api.get(`/chat/${chatId}/attachments`),

  deleteAttachment: (attachmentId: string) =>
    api.delete(`/chat/attachments/${attachmentId}`),

  getFileInfo: (fileId: string) =>
    api.get(`/files/${fileId}/info`),

  /** 推演下次可能提问 */
  getNextQuestions: (data: { conversation_history: Array<{ role: string; content: string }> }) =>
    api.post<{ questions: string[] }>('/chat/next-questions', data),
}

export const projectApi = {
  createProject: (data: { name: string; description?: string }) =>
    api.post('/projects/', data),

  getProjects: (skip?: number, limit?: number) =>
    api.get('/projects/', { params: { skip, limit } }),

  getProject: (projectId: string) =>
    api.get(`/projects/${projectId}`),

  updateProject: (projectId: string, data: { name?: string; description?: string }) =>
    api.put(`/projects/${projectId}`, data),

  deleteProject: (projectId: string) =>
    api.delete(`/projects/${projectId}`),

  createPrompt: (projectId: string, data: { name: string; content: string; is_active?: boolean; order?: number }) =>
    api.post(`/projects/${projectId}/prompts`, data),

  getPrompts: (projectId: string, activeOnly?: boolean) =>
    api.get(`/projects/${projectId}/prompts`, { params: { active_only: activeOnly } }),

  updatePrompt: (projectId: string, promptId: string, data: { name?: string; content?: string; is_active?: boolean; order?: number }) =>
    api.put(`/projects/${projectId}/prompts/${promptId}`, data),

  deletePrompt: (projectId: string, promptId: string) =>
    api.delete(`/projects/${projectId}/prompts/${promptId}`),

  createDocument: (projectId: string, data: { name: string; file_type?: string; file_size?: number; content_text?: string }) =>
    api.post(`/projects/${projectId}/documents`, data),

  uploadDocument: (projectId: string, formData: FormData) =>
    api.post(`/projects/${projectId}/documents/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getDocuments: (projectId: string) =>
    api.get(`/projects/${projectId}/documents`),

  deleteDocument: (projectId: string, documentId: string) =>
    api.delete(`/projects/${projectId}/documents/${documentId}`),

  retrieve: (projectId: string, data: { query: string; top_k?: number; alpha?: number }) =>
    api.post(`/projects/${projectId}/retrieve`, data),
}

export interface ApiSettingInfo {
  provider: string
  is_configured: boolean
  is_enabled: boolean
  model_version?: string
  api_key_masked?: string
  secret_key_masked?: string
}

export interface AvailableModelsResponse {
  available: string[]
  unavailable: string[]
  all: string[]
}

export interface ModelInfo {
  id: string
  name: string
  supports_streaming: boolean
  supports_thinking: boolean
  is_available: boolean
}

export const apiSettingsApi = {
  getSettings: () =>
    api.get<{ settings: ApiSettingInfo[] }>('/api-settings/'),

  saveSetting: (data: { provider: string; api_key: string; secret_key?: string; base_url?: string; model_version?: string; is_enabled?: boolean }) =>
    api.post('/api-settings/', data),

  getSetting: (provider: string) =>
    api.get(`/api-settings/${provider}`),

  deleteSetting: (provider: string) =>
    api.delete(`/api-settings/${provider}`),

  getAvailableModels: () =>
    api.get<AvailableModelsResponse>('/api-settings/available/models'),

  getModels: () =>
    api.get<{ models: ModelInfo[] }>('/chat/models'),

  validateSetting: (data: { provider: string; api_key: string; secret_key?: string }) =>
    api.post<{ provider: string; is_valid: boolean; message: string }>('/api-settings/validate', data),
}

export interface StudyStats {
  total_study_days: number
  current_streak: number
  longest_streak: number
  today_questions: number
  today_minutes: number
  total_questions: number
  average_mastery: number
  total_minutes: number
}

export const dashboardApi = {
  getStats: () =>
    api.get<StudyStats>('/dashboard/stats'),
}

export default api
