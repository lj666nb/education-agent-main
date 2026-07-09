import React, { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { ArrowUp, Paperclip, Brain, Globe, ChevronDown } from 'lucide-react'
import { chatApi } from '../api/auth'
import { cloudDriveApi } from '../api/cloudDrive'

type ModelType = 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'qwen3.5-plus' | 'qwen3.6-plus'

export interface PastedFile {
  id: string
  file: File
  preview: string
  fileId?: string
  cloudFileId?: string
  ocrText?: string
}

interface InputAreaProps {
  onSend: (message: string, model: ModelType, enableThinking: boolean, fileIds?: string[]) => void
  onFilesChange?: (files: PastedFile[]) => void
  isLoading: boolean
  currentModel: ModelType
  onModelChange: (model: ModelType) => void
  enableThinking: boolean
  onEnableThinkingChange: (enabled: boolean) => void
  enableWebsearch: boolean
  onEnableWebsearchChange: (enabled: boolean) => void
  websearchAvailable: boolean
  availableModels?: ModelType[]
  noApiConfigured?: boolean
  pastedFiles: PastedFile[]
  onStopGeneration?: () => void
  prefillText?: string
}

const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'qwen3.5-plus', label: 'Qwen3.5 Plus' },
  { value: 'qwen3.6-plus', label: 'Qwen3.6 Plus' },
]

const MULTIMODAL_MODELS: ModelType[] = ['qwen3.5-plus', 'qwen3.6-plus']

const MAX_FILES = 5

const SUGGESTIONS = [
  '解释一下这个概念',
  '这道题的考点是什么',
  '帮我制定一个学习计划',
]

function TagButton({ icon: Icon, label, active, onClick, disabled }: {
  icon: React.ComponentType<{ size?: number | string }>
  label: string
  active: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '5px 10px', borderRadius: '8px', border: '1px solid',
        borderColor: active ? 'oklch(0.55 0.18 200 / 0.3)' : 'var(--gray-200)',
        backgroundColor: active ? 'oklch(0.55 0.18 200 / 0.08)' : 'var(--gray-50)',
        color: active ? 'var(--primary)' : 'var(--gray-500)',
        fontSize: '0.75rem', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

export default function InputArea({
  onSend,
  onFilesChange,
  isLoading,
  currentModel,
  onModelChange,
  enableThinking,
  onEnableThinkingChange,
  enableWebsearch,
  onEnableWebsearchChange,
  websearchAvailable,
  availableModels = [],
  pastedFiles,
  onStopGeneration,
  noApiConfigured,
  prefillText,
}: InputAreaProps) {
  const [input, setInput] = useState('')
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  useEffect(() => {
    if (prefillText) {
      setInput(prefillText)
    }
  }, [prefillText])
  const [isProcessingPaste, setIsProcessingPaste] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      const fileIds = pastedFiles.map(f => f.fileId).filter((id): id is string => !!id)
      onSend(input.trim(), currentModel, enableThinking, fileIds)
      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleSuggestionClick = (text: string) => {
    if (!isLoading) {
      const fileIds = pastedFiles.map(f => f.fileId).filter((id): id is string => !!id)
      onSend(text, currentModel, enableThinking, fileIds)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024

  const uploadFileToServer = async (file: File): Promise<{fileId: string | null; error: string | null}> => {
    if (file.size > MAX_FILE_SIZE) {
      return { fileId: null, error: `文件过大，单个文件不能超过 50MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` }
    }
    try {
      const response = await chatApi.uploadFile(file)
      return { fileId: response.data.file_id, error: null }
    } catch (error: any) {
      const detail = error.response?.data?.detail
      const errMsg = detail || `上传失败（${error.response?.status || '网络错误'}）`
      return { fileId: null, error: errMsg }
    }
  }

  const processFile = async (file: File): Promise<PastedFile | null> => {
    const fileName = file.name.toLowerCase()
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const isPptx = file.type.includes('presentationml') || fileName.endsWith('.pptx')
    const isDocx = file.type.includes('wordprocessingml') || fileName.endsWith('.docx')
    const isOldFormat = fileName.endsWith('.ppt') || fileName.endsWith('.doc')

    if (!isImage && !isPdf && !isPptx && !isDocx && !isOldFormat) {
      return null
    }

    const id = `paste-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const preview = URL.createObjectURL(file)

    const pastedFile: PastedFile = { id, file, preview }

    const { fileId, error } = await uploadFileToServer(file)
    if (error) {
      alert(error)
      return null
    }
    if (fileId) {
      pastedFile.fileId = fileId
    }

    // 自动保存到云盘
    try {
      const cloudResp = await cloudDriveApi.uploadFile(file)
      if (cloudResp.data?.id) {
        pastedFile.cloudFileId = cloudResp.data.id
      }
    } catch {
      // 云盘保存失败不影响对话
    }

    if (isImage && !MULTIMODAL_MODELS.includes(currentModel)) {
      setIsOcrLoading(true)
      try {
        const response = await chatApi.ocrRecognize(file)
        if (response.data.success && response.data.texts.length > 0) {
          const ocrText = response.data.texts.join('\n')
          pastedFile.ocrText = ocrText
        }
      } catch (error: any) {
        const detail = error.response?.data?.detail || '图片识别失败'
        if (detail.includes('未配置') || detail.includes('无效')) {
          console.log('OCR不可用，图片将由AI直接处理')
        }
      } finally {
        setIsOcrLoading(false)
      }
    }

    return pastedFile
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length === 0) return

    e.preventDefault()
    setIsProcessingPaste(true)

    const currentCount = pastedFiles.length
    const remainingSlots = MAX_FILES - currentCount

    if (remainingSlots <= 0) {
      alert(`最多只能粘贴 ${MAX_FILES} 个文件`)
      setIsProcessingPaste(false)
      return
    }

    const filesToProcess = files.slice(0, remainingSlots)

    const newFiles: PastedFile[] = []
    for (const file of filesToProcess) {
      const pastedFile = await processFile(file)
      if (pastedFile) {
        newFiles.push(pastedFile)
      }
    }

    if (newFiles.length > 0 && onFilesChange) {
      onFilesChange([...pastedFiles, ...newFiles])
    }

    if (files.length > remainingSlots) {
      alert(`超过了最大数量 ${MAX_FILES} 个文件，只添加了前 ${remainingSlots} 个`)
    }

    setIsProcessingPaste(false)
    textareaRef.current?.focus()
  }

  useEffect(() => {
    return () => {
      pastedFiles.forEach(f => URL.revokeObjectURL(f.preview))
    }
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileName = file.name.toLowerCase()
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const isPptx = file.type.includes('presentationml') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')
    const isDocx = file.type.includes('wordprocessingml') || fileName.endsWith('.docx') || fileName.endsWith('.doc')

    if (!isImage && !isPdf && !isPptx && !isDocx) {
      alert('不支持的文件类型，仅支持图片、PDF、PPT和Word文件')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setIsProcessingPaste(true)

    try {
      const result = await processFile(file)
      if (result && onFilesChange) {
        onFilesChange([...pastedFiles, result])
      }
    } catch (error) {
      console.error('文件上传失败:', error)
    } finally {
      setIsProcessingPaste(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      textareaRef.current?.focus()
    }
  }

  return (
    <div style={{
      padding: '20px 24px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Card container */}
      <div style={{
        width: '100%', maxWidth: 'var(--chat-input-max-width)',
        backgroundColor: 'var(--chat-input-bg)',
        borderRadius: '16px',
        boxShadow: 'var(--chat-input-shadow)',
        border: '1px solid var(--gray-100)',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
      }}>
        {/* Suggestions row — shown when input is empty */}
        {!input.trim() && !isLoading && (
          <div style={{
            display: 'flex', gap: '8px', padding: '14px 16px 0',
            flexWrap: 'wrap',
          }}>
            {SUGGESTIONS.map(q => (
              <button key={q} onClick={() => handleSuggestionClick(q)} style={{
                padding: '6px 14px', borderRadius: '16px', border: '1px solid var(--gray-200)',
                background: 'var(--chat-tag-bg)', color: 'var(--gray-600)',
                fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.color = 'var(--gray-600)' }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: '10px',
          padding: '12px 16px',
        }}>
          {/* Attach button */}
          <>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isOcrLoading || isProcessingPaste}
              title="上传文件"
              style={{
                padding: '8px', border: 'none', background: 'none',
                color: 'var(--gray-400)', cursor: 'pointer',
                borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.15s, background-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
            >
              <Paperclip size={20} />
            </button>
          </>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={noApiConfigured ? '请先在 API 设置中配置 API Key' : '输入消息...'}
            disabled={isLoading || noApiConfigured}
            style={{
              flex: 1, backgroundColor: 'transparent', border: 'none',
              outline: 'none', color: 'var(--gray-800)',
              fontSize: '0.9375rem', lineHeight: 1.5, resize: 'none',
              maxHeight: '200px', fontFamily: 'var(--font-body)',
              padding: '6px 0',
            }}
            rows={1}
          />

          {/* Send / Stop button */}
          {isLoading && onStopGeneration ? (
            <button onClick={onStopGeneration} style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: 'none', backgroundColor: 'var(--danger)',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'transform 0.15s',
            }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '2px', backgroundColor: 'white' }} />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim() || isLoading || noApiConfigured} style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: 'none',
              backgroundColor: input.trim() && !isLoading && !noApiConfigured ? 'var(--primary)' : 'var(--gray-200)',
              color: input.trim() && !isLoading && !noApiConfigured ? 'white' : 'var(--gray-400)',
              cursor: input.trim() && !isLoading && !noApiConfigured ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background-color 0.15s, transform 0.15s',
            }}>
              <ArrowUp size={20} />
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: 'var(--gray-100)', margin: '0 16px' }} />

        {/* Feature tag bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '10px 16px', flexWrap: 'wrap',
        }}>
          {/* Model selector */}
          <div style={{ position: 'relative' }}>
            <select
              value={currentModel}
              onChange={(e) => onModelChange(e.target.value as ModelType)}
              style={{
                padding: '5px 26px 5px 10px', borderRadius: '8px',
                border: '1px solid var(--gray-200)', backgroundColor: 'var(--gray-50)',
                fontSize: '0.75rem', color: 'var(--gray-600)',
                cursor: 'pointer', fontFamily: 'inherit',
                appearance: 'none', WebkitAppearance: 'none',
              }}
            >
              {MODEL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} disabled={!availableModels.includes(opt.value)}>
                  {opt.label} {availableModels.includes(opt.value) ? '' : '(未配置)'}
                </option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
          </div>

          {/* Deep thinking toggle */}
          <TagButton icon={Brain} label="深度思考" active={enableThinking} onClick={() => onEnableThinkingChange(!enableThinking)} />

          {/* Web search toggle */}
          {websearchAvailable ? (
            <TagButton icon={Globe} label="联网搜索" active={enableWebsearch} onClick={() => onEnableWebsearchChange(!enableWebsearch)} />
          ) : (
            <TagButton icon={Globe} label="联网搜索" active={false} disabled />
          )}
        </div>
      </div>
    </div>
  )
}
