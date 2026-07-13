import api from './auth'

// ===== Subject / Domain / Point =====

export interface SubjectItem {
  id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
  domains: DomainItem[]
}

export interface DomainItem {
  id: string
  subject_id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
  knowledge_points: KnowledgePointItem[]
}

export interface KnowledgePointItem {
  id: string
  domain_id: string
  name: string
  description: string | null
  difficulty: number
  sort_order: number
  created_at: string
  updated_at: string
}

// ===== Question Bank (PRD v3) =====

export interface BankItem {
  id: string
  owner_id: string
  subject_id: string
  name: string
  description: string | null
  visibility: string
  total_questions: number
  tags: string[]
  created_at: string
  updated_at: string
}

// ===== Question (PRD v3) =====
// 存储说明:
// - content: { stem: "题干", options?: [{key: "A", text: "选项"}], ... }
// - answer: { correct_answer: ["B"], explanation: "解析", ... }
// - knowledge_point_uuids: Neo4j 知识点 UUID 列表

export type QuestionType =
  | 'single_choice' | 'multiple_choice' | 'fill_blank'
  | 'true_false' | 'short_answer' | 'programming' | 'essay'

export type QuestionDifficulty =
  | 'beginner' | 'basic' | 'intermediate' | 'advanced' | 'competition'

export interface QuestionItem {
  id: string
  bank_id: string
  type: QuestionType
  content: { stem: string; options?: { key: string; text: string }[]; code_template?: string; images?: string[] }
  answer: { correct_answer: string[]; explanation: string; difficulty_rationale?: string; suggested_time_seconds?: number }
  difficulty: QuestionDifficulty
  priority: number
  knowledge_point_uuids: string[]
  tags: string[]
  ai_generated: boolean
  source: string
  status: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export const questionBankApi = {
  // === Subjects ===
  listSubjects: () =>
    api.get<{ subjects: SubjectItem[]; total: number }>('/question-bank/subjects'),
  getSubject: (id: string) =>
    api.get<SubjectItem>(`/question-bank/subjects/${id}`),
  createSubject: (data: { name: string; description?: string; sort_order?: number }) =>
    api.post<SubjectItem>('/question-bank/subjects', data),
  updateSubject: (id: string, data: { name: string; description?: string; sort_order?: number }) =>
    api.put<SubjectItem>(`/question-bank/subjects/${id}`, data),
  deleteSubject: (id: string) =>
    api.delete(`/question-bank/subjects/${id}`),

  // === Domains ===
  listDomains: (subjectId: string) =>
    api.get<DomainItem[]>(`/question-bank/subjects/${subjectId}/domains`),
  createDomain: (subjectId: string, data: { name: string; description?: string; sort_order?: number }) =>
    api.post<DomainItem>(`/question-bank/subjects/${subjectId}/domains`, data),
  updateDomain: (id: string, data: { name: string; description?: string; sort_order?: number }) =>
    api.put<DomainItem>(`/question-bank/domains/${id}`, data),
  deleteDomain: (id: string) =>
    api.delete(`/question-bank/domains/${id}`),

  // === Knowledge Points ===
  listPoints: (domainId: string) =>
    api.get<KnowledgePointItem[]>(`/question-bank/domains/${domainId}/points`),
  createPoint: (domainId: string, data: { name: string; description?: string; difficulty?: number; sort_order?: number }) =>
    api.post<KnowledgePointItem>(`/question-bank/domains/${domainId}/points`, data),
  updatePoint: (id: string, data: { name: string; description?: string; difficulty?: number; sort_order?: number }) =>
    api.put<KnowledgePointItem>(`/question-bank/points/${id}`, data),
  deletePoint: (id: string) =>
    api.delete(`/question-bank/points/${id}`),

  // === Banks ===
  listBanks: (params?: { subject_id?: string; search?: string; page?: number; page_size?: number }) =>
    api.get<{ banks: BankItem[]; total: number }>('/question-bank/banks', { params }),
  createBank: (data: { name: string; subject_id: string; description?: string; visibility?: string; tags?: string[] }) =>
    api.post<BankItem>('/question-bank/banks', data),
  getBank: (id: string) =>
    api.get<BankItem>(`/question-bank/banks/${id}`),
  updateBank: (id: string, data: { name?: string; description?: string; visibility?: string; tags?: string[] }) =>
    api.put<BankItem>(`/question-bank/banks/${id}`, data),
  deleteBank: (id: string) =>
    api.delete(`/question-bank/banks/${id}`),

  // === Questions ===
  listQuestions: (bankId: string, params?: {
    type?: string; difficulty?: string; status?: string;
    knowledge_point_uuid?: string; search?: string; page?: number; page_size?: number
  }) =>
    api.get<{ questions: QuestionItem[]; total: number; page: number; page_size: number }>(
      `/question-bank/banks/${bankId}/questions`, { params }),
  createQuestion: (bankId: string, data: {
    type: string; content: Record<string, any>; answer?: Record<string, any>;
    difficulty?: string; priority?: number; knowledge_point_uuids?: string[];
    tags?: string[]; status?: string; ai_generated?: boolean; source?: string
  }) =>
    api.post<QuestionItem>(`/question-bank/banks/${bankId}/questions`, data),
  getQuestion: (id: string) =>
    api.get<QuestionItem>(`/question-bank/questions/${id}`),
  updateQuestion: (id: string, data: Record<string, any>) =>
    api.put<QuestionItem>(`/question-bank/questions/${id}`, data),
  deleteQuestion: (id: string) =>
    api.delete(`/question-bank/questions/${id}`),
  regenerateQuestion: (id: string, feedback: string) =>
    api.post<QuestionItem>(`/question-bank/questions/${id}/regenerate`, { feedback }),

  // === AI Generate ===
  aiGenerate: (bankId: string, data: {
    message: string; conversation_history?: { role: string; content: string }[];
    collected_params?: Record<string, any>;
  }) => api.post<{
    reply: string; collected_params: Record<string, any>;
    generated_questions: any[]; is_complete: boolean;
  }>(`/question-bank/banks/${bankId}/ai-generate`, data),

  // === AI Generate Stream (SSE) ===
  aiGenerateStream: (
    bankId: string,
    data: {
      message: string; conversation_history?: { role: string; content: string }[];
      collected_params?: Record<string, any>;
    },
    callbacks: {
      onChunk: (text: string) => void;
      onComplete: (result: { reply: string; generated_questions: any[]; is_complete: boolean; collected_params?: Record<string, any> }) => void;
      onError: (error: string) => void;
    },
  ) => {
    const token = localStorage.getItem('access_token')
    return fetch(`/api/v1/question-bank/banks/${bankId}/ai-generate-stream`, {
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
              case 'chunk':
                callbacks.onChunk(event.content)
                break
              case 'complete':
                callbacks.onComplete(event)
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

  // === AI Context Persistence ===
  getAIContext: (bankId: string) =>
    api.get<{ has_context: boolean; history: { role: string; content: string }[]; collected_params: Record<string, any>; generated_questions: any[] }>(
      `/question-bank/banks/${bankId}/ai-context`),
  clearAIContext: (bankId: string) =>
    api.delete(`/question-bank/banks/${bankId}/ai-context`),
  updateSavedQuestions: (bankId: string, savedIndices: number[]) =>
    api.post(`/question-bank/banks/${bankId}/ai-context/saved-questions`, { saved_indices: savedIndices }),

  // === Domain Counts ===
  getDomainCounts: (bankId: string, config: {
    question_types?: string[]
    domain_ids?: string[]
    knowledge_point_uuids?: string[]
    only_unanswered?: boolean
    only_wrong?: boolean
    only_error_prone?: boolean
    answer_mode?: string
  }) => api.post<{ domain_id: string; domain_name: string; total: number; unanswered: number; wrong: number }[]>(
    `/question-bank/banks/${bankId}/domain-counts`, config),

  // === Practice Sessions ===
  createPracticeSession: (bankId: string, data: {
    mode?: string; answer_mode?: string; question_order?: string[]
  }) => api.post<{
    id: string; bank_id: string; mode: string; status: string;
    question_order: string[]; stats: Record<string, any>; answer_mode: string;
    started_at: string; finished_at: string | null;
  }>(`/question-bank/banks/${bankId}/practice-sessions`, data),

  updatePracticeSession: (sessionId: string, data: {
    status?: string; current_index?: number; stats?: Record<string, any>; finished_at?: string
  }) => api.put<Record<string, any>>(`/question-bank/practice-sessions/${sessionId}`, data),

  listPracticeSessions: (params?: { bank_id?: string; page?: number; page_size?: number }) =>
    api.get<{ sessions: any[]; total: number }>('/question-bank/practice-sessions', { params }),

  getPracticeSession: (sessionId: string) =>
    api.get<Record<string, any>>(`/question-bank/practice-sessions/${sessionId}`),

  getPracticeSessionQuestions: (sessionId: string) =>
    api.get<QuestionItem[]>(`/question-bank/practice-sessions/${sessionId}/questions`),

  // === Knowledge Point → Practice Bank ===
  getKnowledgePointPracticeBank: (kpUuid: string) =>
    api.get<{ bank_id: string; bank_name: string }>(
      `/question-bank/knowledge-points/${kpUuid}/practice-bank`),

  // === Practice ===
  startPractice: (bankId: string, config: {
    time_limit_minutes?: number | null
    question_count?: number | null
    question_types?: string[]
    domain_ids?: string[]
    knowledge_point_uuids?: string[]
    only_unanswered?: boolean
    only_wrong?: boolean
    only_error_prone?: boolean
    answer_mode?: string
  }) => api.post<QuestionItem[]>(
    `/question-bank/banks/${bankId}/practice-questions`, config),

  submitAnswer: (questionId: string, data: {
    answer_content: Record<string, any>
    is_correct: boolean
    time_spent_seconds?: number | null
    session_id?: string | null
  }) => api.post<{
    is_correct: boolean
    recommended_resources?: Array<{ id: string; title: string; resource_type: string; knowledge_points: string[] }>
  }>(`/question-bank/questions/${questionId}/submit-answer`, data),

  submitAnswers: (bankId: string, data: {
    answers: { question_id: string; answer_content: Record<string, any>; is_correct: boolean; time_spent_seconds?: number | null; session_id?: string | null }[]
  }) => api.post<{
    results: Array<{
      is_correct: boolean
      recommended_resources?: Array<{ id: string; title: string; resource_type: string; knowledge_points: string[] }>
    }>
  }>(`/question-bank/banks/${bankId}/submit-answers`, data),

  // === Exam Papers ===
  listExamPapers: (bankId: string, params?: { page?: number; page_size?: number }) =>
    api.get<{ papers: any[]; total: number }>(`/question-bank/banks/${bankId}/exam-papers`, { params }),

  getExamPaper: (paperId: string) =>
    api.get<any>(`/question-bank/exam-papers/${paperId}`),

  createExamPaper: (bankId: string, data: {
    title: string; description?: string; total_score?: number; time_limit_minutes?: number | null;
    generate_method?: string; sections: any[];
  }) => api.post<any>(`/question-bank/banks/${bankId}/exam-papers`, data),

  deleteExamPaper: (paperId: string) =>
    api.delete(`/question-bank/exam-papers/${paperId}`),

  suggestQuestions: (bankId: string, data: {
    sections: { name: string; question_type: string; count: number; score_per_question: number; difficulty?: string | null; domain_ids: string[] }[];
    exclude_question_ids?: string[];
    deterministic?: boolean;
    seed_only?: boolean;
  }) => api.post<{ sections: any[]; total_questions: number }>(
    `/question-bank/banks/${bankId}/exam-papers/suggest-questions`, data),

  parseUpload: (bankId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ filename: string; suggested_title: string; parsed_sections: any[]; full_text: string }>(
      `/question-bank/banks/${bankId}/exam-papers/parse-upload`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  aiGenerateExamQuestions: (bankId: string, data: {
    message: string; conversation_history?: { role: string; content: string }[];
    collected_params?: Record<string, any>;
  }) => api.post<{
    reply: string; collected_params: Record<string, any>;
    generated_questions: any[]; is_complete: boolean;
  }>(`/question-bank/banks/${bankId}/exam-papers/ai-generate`, data),

  exportExamPDF: (paperId: string) =>
    api.get(`/question-bank/exam-papers/${paperId}/export/pdf`, { responseType: 'blob' }),

  exportExamWord: (paperId: string) =>
    api.get(`/question-bank/exam-papers/${paperId}/export/word`, { responseType: 'blob' }),

  startExamPractice: (paperId: string) =>
    api.post<{ session_id: string; practice_url: string }>(
      `/question-bank/exam-papers/${paperId}/start-practice`),

  // === Error-Prone Tags (F5) ===
  listErrorProneQuestions: (params?: { bank_id?: string; page?: number; page_size?: number }) =>
    api.get<{ questions: QuestionItem[]; total: number }>('/question-bank/questions/error-prone', { params }),

  tagErrorProne: (questionId: string) =>
    api.post<{ question_id: string; tags: string[] }>(`/question-bank/questions/${questionId}/tag-error-prone`),

  untagErrorProne: (questionId: string) =>
    api.delete<{ question_id: string; tags: string[] }>(`/question-bank/questions/${questionId}/untag-error-prone`),

  // === Wrong Answer Book ===
  listWrongAnswers: (params?: {
    bank_id?: string; subject_id?: string; domain_id?: string;
    page?: number; page_size?: number
  }) => api.get<{ items: WrongAnswerItem[]; total: number }>(
    '/question-bank/wrong-answers', { params }),

  removeWrongAnswer: (recordId: string) =>
    api.delete(`/question-bank/wrong-answers/${recordId}`),

  getWrongReview: (bankId: string) =>
    api.get<WrongReviewResponse>(`/question-bank/banks/${bankId}/wrong-review`),

  diagnoseWrongAnswer: (recordId: string) =>
    api.post<{
      error_type: string; error_type_label: string;
      root_cause: string; suggestions: string[]; recommended_action: string
    }>(`/question-bank/wrong-answers/${recordId}/diagnose`),

  generatePracticeFromWrongAnswers: (params?: {
    bank_id?: string; question_count?: number; domain_ids?: string[]
  }) => api.post<QuestionItem[]>(
    '/question-bank/wrong-answers/generate-practice', null, { params }),

  // === Session Answers (Test History Detail) ===
  getSessionAnswers: (sessionId: string) =>
    api.get<{ session_id: string; items: SessionAnswerItem[]; total: number }>(
      `/question-bank/practice-sessions/${sessionId}/answers`),

  // === Self-Grade ===
  submitSelfGrade: (answerId: string, selfGrade: number) =>
    api.post<{ answer_id: string; self_grade: number }>(
      `/question-bank/answers/${answerId}/self-grade`, { self_grade: selfGrade }),

  submitBatchSelfGrade: (sessionId: string, grades: { answer_id: string; self_grade: number }[]) =>
    api.post<{ session_id: string; updated: { answer_id: string; self_grade: number }[] }>(
      `/question-bank/sessions/${sessionId}/self-grade`, { grades }),

  // === Daily Stats ===
  getDailyStats: (params?: {
    bank_id?: string; mode?: string; days?: number;
    start_date?: string; end_date?: string
  }) => api.get<{ items: DailyStatsItem[]; total: number }>(
    '/question-bank/daily-stats', { params }),

  // === Domain Completion ===
  getDomainCompletion: (domainId: string) =>
    api.get<DomainCompletion>(`/question-bank/domains/${domainId}/completion`),

  markDomainMastered: (domainId: string) =>
    api.post<MarkMasteredResponse>(`/question-bank/domains/${domainId}/mark-mastered`),
}

// === Domain Completion Types ===
export interface DomainCompletion {
  domain_id: string
  domain_name: string
  total_questions: number
  answered_questions: number
  wrong_count: number
  all_done: boolean
}

export interface MarkMasteredResponse {
  success: boolean
  marked_count: number
  message: string
}

// ===== Wrong Answer Book Types =====

export interface WrongAnswerItem {
  id: string
  question_id: string
  bank_id: string
  wrong_count: number
  first_wrong_at: string
  last_wrong_at: string
  question: QuestionItem
}

// === Wrong Review ===

export interface WrongReviewItem {
  question_id: string
  stem: string
  type: string
  options: Record<string, string> | null
  user_answer: string
  correct_answer: string[]
  explanation: string | null
  knowledge_points: string[]
  wrong_count: number
  last_wrong_at: string
}

export interface WrongReviewResponse {
  wrong_records: WrongReviewItem[]
  total: number
  bank_name: string
}

export interface SessionAnswerItem {
  answer_id: string
  question_id: string
  question: QuestionItem | null
  answer_content: Record<string, any>
  is_correct: boolean
  self_grade: number | null
  time_spent_seconds: number | null
  answered_at: string | null
}

export interface DailyStatsItem {
  date: string
  total_questions: number
  correct_count: number
  incorrect_count: number
  total_time_spent_seconds: number
  session_count: number
  accuracy: number
}
