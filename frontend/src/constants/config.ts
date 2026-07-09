/** 前端全局配置常量 */

/** 分页默认值 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  BANKS_LIST_SIZE: 100,
  BANK_QUESTIONS_SIZE: 500,
  PRACTICE_SIZE: 100,
  WRONG_ANSWERS_SIZE: 50,
  REVIEW_CENTER_SIZE: 50,
  AGENT_TASKS_LIMIT: 20,
  TEST_HISTORY_SIZE: 20,
} as const

/** API / 网络超时（毫秒） */
export const TIMEOUTS = {
  DRAWIO_EDITOR_LOAD: 25000,
  VIDEO_LOAD: 30000,
  TOAST_DURATION: 3000,
  MESSAGE_DISAPPEAR_DELAY: 3000,
  POLL_INTERVAL: 3000,
  LOGIN_NAVIGATE_DELAY: 1000,
  REGISTER_NAVIGATE_DELAY: 1500,
  COPY_FEEDBACK_DURATION: 2000,
} as const

/** 文件上传限制 */
export const UPLOAD_LIMITS = {
  AVATAR_MAX_SIZE: 5 * 1024 * 1024,  // 5MB
  MAX_FILES: 5,
} as const

/** TTS 语音偏好 (Web Speech API) */
export const TTS_VOICE_PREFERENCES = [
  'Microsoft Yunyang',
  'Google 普通话（中国大陆）',
  'zh-CN',
] as const
