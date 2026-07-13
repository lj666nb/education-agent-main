import React, { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { ArrowUp, Plus, Brain, Globe, ChevronDown, FileUp, BarChart3, GitBranch, Cloud } from 'lucide-react'
import { chatApi } from '../api/auth'
import { cloudDriveApi } from '../api/cloudDrive'
import { ModelType, MODEL_OPTIONS, MULTIMODAL_MODELS } from '../constants/models'
import { UPLOAD_LIMITS } from '../constants/config'

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
  enableAutoChart: boolean
  onEnableAutoChartChange: (enabled: boolean) => void
  enableAutoMindmap: boolean
  onEnableAutoMindmapChange: (enabled: boolean) => void
  fileUploadTrigger?: number
  onCloudDriveClick?: () => void
}

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
      className="chat-tag-btn"
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '5px 10px', borderRadius: '8px', border: '1px solid',
        borderColor: active ? 'oklch(0.55 0.18 200 / 0.3)' : 'var(--gray-200)',
        backgroundColor: active ? 'oklch(0.55 0.18 200 / 0.08)' : 'var(--gray-50)',
        color: active ? 'var(--primary)' : 'var(--gray-500)',
        fontSize: '0.75rem', cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
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
  enableAutoChart,
  onEnableAutoChartChange,
  enableAutoMindmap,
  onEnableAutoMindmapChange,
  fileUploadTrigger,
  onCloudDriveClick,
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
  const featurePanelRef = useRef<HTMLDivElement>(null)
  const [showFeaturePanel, setShowFeaturePanel] = useState(false)

  // Close feature panel on click outside
  useEffect(() => {
    if (!showFeaturePanel) return
    const handleClickOutside = (e: MouseEvent) => {
      if (featurePanelRef.current && !featurePanelRef.current.contains(e.target as Node)) {
        setShowFeaturePanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFeaturePanel])

  // Trigger file input from parent (feature card click)
  useEffect(() => {
    if (fileUploadTrigger && fileUploadTrigger > 0) {
      fileInputRef.current?.click()
    }
  }, [fileUploadTrigger])

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
    const remainingSlots = UPLOAD_LIMITS.MAX_FILES - currentCount

    if (remainingSlots <= 0) {
      alert(`最多只能粘贴 ${UPLOAD_LIMITS.MAX_FILES} 个文件`)
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
      alert(`超过了最大数量 ${UPLOAD_LIMITS.MAX_FILES} 个文件，只添加了前 ${remainingSlots} 个`)
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
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
    }}>
      {/* Card container */}
      <div className="chat-input-card" style={{
        width: '100%',
        backgroundColor: 'var(--chat-input-bg)',
        borderRadius: '16px',
        boxShadow: 'var(--chat-input-shadow)',
        border: '1px solid var(--gray-100)',
        overflow: 'hidden',
      }}>
        {/* Suggestions row — shown when input is empty */}
        {!input.trim() && !isLoading && (
          <div style={{
            display: 'flex', gap: '8px', padding: '14px 16px 0',
            flexWrap: 'wrap',
          }}>
            {SUGGESTIONS.map(q => (
              <button key={q} onClick={() => handleSuggestionClick(q)} className="chat-tag-btn" style={{
                padding: '6px 14px', borderRadius: '16px', border: '1px solid var(--gray-200)',
                background: 'var(--chat-tag-bg)', color: 'var(--gray-600)',
                fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Feature panel — shown when Plus is clicked */}
        {showFeaturePanel && (
          <div ref={featurePanelRef} className="fade-in-up" style={{
            display: 'flex', gap: '10px', padding: '8px 16px 4px',
            flexWrap: 'wrap',
          }}>
            {/* Upload file */}
            <div
              onClick={() => { fileInputRef.current?.click() }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                border: '1px solid var(--gray-200)',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                flex: '1 1 auto', minWidth: '140px',
              }}
              className="feature-card-hover"
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.55 0.18 200 / 0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--gray-200)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: 'oklch(0.55 0.18 200 / 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)', flexShrink: 0,
              }}>
                <FileUp size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gray-700)' }}>上传文件</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)' }}>PDF、Word、PPT</div>
              </div>
            </div>

            {/* Chart generation toggle */}
            <div
              onClick={() => onEnableAutoChartChange(!enableAutoChart)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                border: enableAutoChart ? '2px solid var(--primary)' : '1px solid var(--gray-200)',
                backgroundColor: enableAutoChart ? 'oklch(0.55 0.18 200 / 0.06)' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                flex: '1 1 auto', minWidth: '140px',
              }}
              className="feature-card-hover"
              onMouseEnter={e => {
                if (!enableAutoChart) {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.55 0.18 200 / 0.1)'
                }
              }}
              onMouseLeave={e => {
                if (!enableAutoChart) {
                  e.currentTarget.style.borderColor = 'var(--gray-200)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: enableAutoChart ? 'oklch(0.55 0.18 200 / 0.15)' : 'oklch(0.55 0.18 200 / 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: enableAutoChart ? 'var(--primary)' : 'var(--primary)',
                flexShrink: 0,
                transition: 'background-color 0.25s ease',
              }}>
                <BarChart3 size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gray-700)' }}>图表生成</div>
                <div style={{ fontSize: '0.6875rem', color: enableAutoChart ? 'var(--primary)' : 'var(--gray-400)', transition: 'color 0.25s ease' }}>
                  {enableAutoChart ? '已开启 · 自动生成' : 'AI 自动绘制图表'}
                </div>
              </div>
              {enableAutoChart && (
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  flexShrink: 0,
                  boxShadow: '0 0 6px oklch(0.55 0.18 200 / 0.5)',
                }} />
              )}
            </div>

            {/* Mind map toggle */}
            <div
              onClick={() => onEnableAutoMindmapChange(!enableAutoMindmap)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                border: enableAutoMindmap ? '2px solid #7C3AED' : '1px solid var(--gray-200)',
                backgroundColor: enableAutoMindmap ? 'oklch(0.45 0.18 280 / 0.04)' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                flex: '1 1 auto', minWidth: '140px',
              }}
              className="feature-card-hover"
              onMouseEnter={e => {
                if (!enableAutoMindmap) {
                  e.currentTarget.style.borderColor = '#7C3AED'
                  e.currentTarget.style.boxShadow = '0 0 0 3px oklch(0.45 0.18 280 / 0.1)'
                }
              }}
              onMouseLeave={e => {
                if (!enableAutoMindmap) {
                  e.currentTarget.style.borderColor = 'var(--gray-200)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: enableAutoMindmap ? 'oklch(0.45 0.18 280 / 0.12)' : 'oklch(0.45 0.18 280 / 0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#7C3AED',
                flexShrink: 0,
                transition: 'background-color 0.25s ease',
              }}>
                <GitBranch size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gray-700)' }}>思维导图</div>
                <div style={{ fontSize: '0.6875rem', color: enableAutoMindmap ? '#7C3AED' : 'var(--gray-400)', transition: 'color 0.25s ease' }}>
                  {enableAutoMindmap ? '已开启 · 自动生成' : '知识结构可视化'}
                </div>
              </div>
              {enableAutoMindmap && (
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: '#7C3AED',
                  flexShrink: 0,
                  boxShadow: '0 0 6px oklch(0.45 0.18 280 / 0.5)',
                }} />
              )}
            </div>
          </div>
        )}

        {/* Input row */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: '10px',
          padding: '12px 16px',
        }}>
          {/* Plus button — toggles feature panel */}
          <>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            <button
              onClick={() => setShowFeaturePanel(!showFeaturePanel)}
              disabled={isOcrLoading || isProcessingPaste}
              title="添加功能"
              className="icon-btn-animated"
              style={{
                padding: '8px', border: '2px solid transparent', background: 'none',
                color: showFeaturePanel ? 'var(--primary)' : 'var(--gray-400)',
                cursor: 'pointer',
                borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => {
                if (!showFeaturePanel) e.currentTarget.style.color = 'var(--primary)'
                e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)'
              }}
              onMouseLeave={e => {
                if (!showFeaturePanel) e.currentTarget.style.color = 'var(--gray-400)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Plus size={20} />
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
            <button onClick={handleSend} disabled={!input.trim() || isLoading || noApiConfigured} className="icon-btn-animated" style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: '2px solid transparent',
              backgroundColor: input.trim() && !isLoading && !noApiConfigured ? 'var(--primary)' : 'var(--gray-200)',
              color: input.trim() && !isLoading && !noApiConfigured ? 'white' : 'var(--gray-400)',
              cursor: input.trim() && !isLoading && !noApiConfigured ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
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

          {/* Auto chart toggle */}
          <TagButton icon={BarChart3} label="图表生成" active={enableAutoChart} onClick={() => onEnableAutoChartChange(!enableAutoChart)} />

          {/* Auto mindmap toggle */}
          <TagButton icon={GitBranch} label="思维导图" active={enableAutoMindmap} onClick={() => onEnableAutoMindmapChange(!enableAutoMindmap)} />

          {/* 云盘入口 */}
          <TagButton icon={Cloud} label="云盘" active={false} onClick={onCloudDriveClick} />

        </div>
      </div>
    </div>
  )
}
