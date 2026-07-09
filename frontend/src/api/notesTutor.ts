import api from './auth'

export interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TutorRequest {
  message: string
  chapter_title?: string | null
  section_title?: string | null
  section_content?: string | null
  conversation_history: TutorMessage[]
}

export interface TutorResponse {
  reply: string
  model: string
}

export const notesTutorApi = {
  async ask(data: TutorRequest): Promise<TutorResponse> {
    const res = await api.post('/notes/tutor', data)
    return res.data
  },
}
