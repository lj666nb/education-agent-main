import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { chatApi } from '../api/auth'

type ModelType = 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'qwen3.5-plus' | 'qwen3.6-plus'

export interface PastedFile {
  id: string
  file: File
  preview: string
  fileId?: string
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
  pastedFiles: PastedFile[]
}

const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'qwen3.5-plus', label: 'Qwen3.5 Plus' },
  { value: 'qwen3.6-plus', label: 'Qwen3.6 Plus' },
]

const MULTIMODAL_MODELS: ModelType[] = ['qwen3.5-plus', 'qwen3.6-plus']

const MAX_FILES = 5

function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2-1 2.7V10c0 1.1-.9 2-2 2s-2-.9-2-2V8.7c-.6-.7-1-1.6-1-2.7a4 4 0 0 1 4-4z"/>
      <path d="M12 14c2.2 0 6 1.1 6 3v2H6v-2c0-1.9 3.8-3 6-3z"/>
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
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
}: InputAreaProps) {
  const [input, setInput] = useState('')
  const [isOcrLoading, setIsOcrLoading] = useState(false)
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
      padding: 'var(--space-4)',
      borderTop: '1px solid var(--gray-100)',
      backgroundColor: 'white',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        flexWrap: 'wrap',
      }}>
        {/* Model selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>模型:</span>
          <select
            className="input"
            value={currentModel}
            onChange={(e) => {
              const model = e.target.value as ModelType
              if (availableModels.includes(model)) {
                onModelChange(model)
              }
            }}
            style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.625rem', fontSize: '0.8125rem' }}
          >
            {MODEL_OPTIONS.map((option) => {
              const isAvailable = availableModels.includes(option.value)
              return (
                <option key={option.value} value={option.value} disabled={!isAvailable}>
                  {option.label} {isAvailable ? '' : '(未配置)'}
                </option>
              )
            })}
          </select>
        </div>

        {/* Thinking toggle */}
        <button
          onClick={() => onEnableThinkingChange(!enableThinking)}
          className="btn"
          style={{
            padding: '0.375rem 0.625rem',
            fontSize: '0.8125rem',
            backgroundColor: enableThinking ? 'oklch(0.55 0.25 250 / 0.1)' : 'transparent',
            borderColor: enableThinking ? 'oklch(0.55 0.25 250 / 0.3)' : 'var(--gray-200)',
            color: enableThinking ? 'var(--primary)' : 'var(--gray-500)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}
        >
          <BrainIcon />
          深度思考
        </button>

        {/* Websearch toggle */}
        {websearchAvailable ? (
          <button
            onClick={() => onEnableWebsearchChange(!enableWebsearch)}
            className="btn"
            style={{
              padding: '0.375rem 0.625rem',
              fontSize: '0.8125rem',
              backgroundColor: enableWebsearch ? 'oklch(0.62 0.18 145 / 0.1)' : 'transparent',
              borderColor: enableWebsearch ? 'oklch(0.62 0.18 145 / 0.3)' : 'var(--gray-200)',
              color: enableWebsearch ? 'var(--success)' : 'var(--gray-500)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <SearchIcon />
            联网搜索
          </button>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <SearchIcon />
            联网搜索（未配置）
          </span>
        )}
      </div>

      {/* Input area */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 'var(--space-3)',
        backgroundColor: 'var(--gray-50)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        border: '1px solid var(--gray-100)',
        transition: 'border-color var(--transition-fast)',
      }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isOcrLoading || isProcessingPaste}
          title="上传图片或PDF文件"
          className="btn"
          style={{
            padding: '0.5rem',
            borderColor: 'var(--gray-200)',
            backgroundColor: isOcrLoading || isProcessingPaste ? 'var(--gray-100)' : 'white',
            color: isOcrLoading || isProcessingPaste ? 'var(--gray-400)' : 'var(--gray-500)',
            flexShrink: 0,
          }}
        >
          <AttachIcon />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={`输入消息... (Enter 发送，Shift+Enter 换行)\n支持粘贴或上传图片、PDF、PPT（最多${MAX_FILES}个）`}
          disabled={isLoading}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--gray-800)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            resize: 'none',
            maxHeight: '200px',
            fontFamily: 'var(--font-body)',
          }}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            backgroundColor: input.trim() && !isLoading ? 'var(--primary)' : 'var(--gray-200)',
            color: input.trim() && !isLoading ? 'white' : 'var(--gray-400)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            flexShrink: 0,
          }}
        >
          <SendIcon />
          发送
        </button>
      </div>
    </div>
  )
}
