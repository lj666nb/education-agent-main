export interface KnowledgeMastery {
  knowledge_point: string
  score: number
  confidence: number
  last_updated?: string
}

export interface CognitiveStyle {
  style_type: 'visual' | 'auditory' | 'reading_writing' | 'kinesthetic' | 'mixed'
  confidence: number
  last_updated?: string
}

export interface ErrorProneTopic {
  topic: string
  error_count: number
  last_updated?: string
}

export interface ProfileV2Response {
  student_id: string
  knowledge_mastery: KnowledgeMastery[]
  cognitive_style: CognitiveStyle | null
  error_prone_topics: ErrorProneTopic[]
  active_hours: Record<string, number>
  learning_rhythm: Record<string, number>
  metacognitive_calibration: number
  attention_feature: number
  created_at?: string
  updated_at?: string
}

export interface ProfileSummary {
  student_id: string
  cognitive_style: string | null
  metacognitive_calibration: number
  attention_feature: number
  knowledge_point_count: number
  error_prone_topic_count: number
}

export interface BehaviorEvent {
  event_type: string
  event_data: Record<string, any>
  timestamp: string
}

export interface TimelineEvent {
  event_id: string
  event_type: string
  event_data: Record<string, any>
  timestamp: string
}
