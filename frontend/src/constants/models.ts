/**
 * AI 模型相关常量
 * 统一管理模型名称、类型和选项
 */

/** 支持的模型类型 */
export type ModelType = 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'qwen3.5-plus' | 'qwen3.6-plus'

/** 默认模型 */
export const DEFAULT_MODEL: ModelType = 'deepseek-v4-flash'

/** 模型选项列表（供下拉框使用） */
export const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'qwen3.5-plus', label: 'Qwen 3.5 Plus' },
  { value: 'qwen3.6-plus', label: 'Qwen 3.6 Plus' },
]

/** 支持多模态（图片识别）的模型 */
export const MULTIMODAL_MODELS: ModelType[] = ['qwen3.5-plus', 'qwen3.6-plus']

/** 提供者默认模型映射 */
export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-v4-flash',
  qwen: 'qwen3.5-plus',
}
