import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Folder, Code, Plus, X, FileUp, Image, Trash2, Pencil } from 'lucide-react'
import Sidebar from './Sidebar'
import MessageList, { Message } from './MessageList'
import InputArea, { PastedFile } from './InputArea'
import { useChatStore } from '../store/chat'
import { AlertTriangleIcon, ArrowLeftIcon as ChevronLeftIcon, ArrowRightIcon } from './Icons'
import { chatApi, projectApi } from '../api/auth'
import { cloudDriveApi } from '../api/cloudDrive'
import { resourcesApi } from '../api/resources'
import DrawioEditor, { type DrawioEditorHandle } from './DrawioEditor'
import CodeRunnerPanel from './CodeRunnerPanel'
import DraggableWindow from './DraggableWindow'
import { extractDrawioXml, hasDrawioContent, getDrawioSystemPrompt, stripDiagramDuringStreaming } from '../utils/drawio'
import { ModelType, DEFAULT_MODEL } from '../constants/models'

interface ChatSession {
  id: string
  title: string
  user_id: string
  model: string
  project_id?: string
  project_name?: string
  created_at: string
  updated_at: string
  message_count: number
}

interface Project {
  id: string
  name: string
  description?: string
}

interface ProjectDocument {
  id: string
  name: string
  file_type?: string
  file_size?: number
  chunk_count: number
  created_at: string
}

/* ── Shared Modal ── */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'oklch(0 0 0 / 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="fade-in"
        style={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          width: '90%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>{title}</h2>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: 'var(--space-1)', border: 'none', background: 'none', color: 'var(--gray-400)' }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Main Component ── */

export default function ChatPlatform() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentModel, setCurrentModel] = useState<ModelType>(DEFAULT_MODEL)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  // Chat state from persistent store (survives navigation)
  const currentChatId = useChatStore(s => s.currentChatId)
  const messages = useChatStore(s => s.messagesByChat[currentChatId ?? ''] || [])
  const isLoading = useChatStore(s => s.isLoading)
  const enableThinking = useChatStore(s => s.enableThinking)
  const enableWebsearch = useChatStore(s => s.enableWebsearch)
  const storeSetCurrentChatId = useChatStore(s => s.setCurrentChatId)
  const storeAppendMessages = useChatStore(s => s.appendMessages)
  const storeUpdateLastAssistant = useChatStore(s => s.updateLastAssistant)
  const storeSetIsLoading = useChatStore(s => s.setIsLoading)
  const storeSetEnableThinking = useChatStore(s => s.setEnableThinking)
  const storeSetEnableWebsearch = useChatStore(s => s.setEnableWebsearch)
  const storeResetChat = useChatStore(s => s.resetChat)
  const storeSetMessagesForChat = useChatStore(s => s.setMessagesForChat)
  const [websearchAvailable, setWebsearchAvailable] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectPanelOpen, setProjectPanelOpen] = useState(false)
  const [selectedProjectForChat, setSelectedProjectForChat] = useState<string | null>(null)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [newProjectPrompt, setNewProjectPrompt] = useState('')
  const [newProjectDoc, setNewProjectDoc] = useState<string | Blob | null>(null)
  const [newProjectDocName, setNewProjectDocName] = useState('')
  const [pastedFiles, setPastedFiles] = useState<PastedFile[]>([])
  const [irrelevantContentWarning, setIrrelevantContentWarning] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<PastedFile | null>(null)
  const [previewDocxHtml, setPreviewDocxHtml] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [previewSlides, setPreviewSlides] = useState<string[][] | null>(null)
  const [previewCurrentSlide, setPreviewCurrentSlide] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [availableModels, setAvailableModels] = useState<ModelType[]>([])
  const [noApiConfigured, setNoApiConfigured] = useState(true)
  const [projectDocuments, setProjectDocuments] = useState<Record<string, ProjectDocument[]>>({})
  const [diagramOpen, setDiagramOpen] = useState(false)
  const [activeDiagramXml, setActiveDiagramXml] = useState<string | null>(null)
  const drawioRef = useRef<DrawioEditorHandle>(null)
  const [codeRunnerOpen, setCodeRunnerOpen] = useState(false)
  const [codeRunnerCode, setCodeRunnerCode] = useState('')
  const [codeRunnerLanguage, setCodeRunnerLanguage] = useState('python')
  const [codeRunnerKey, setCodeRunnerKey] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  const sendingChatIdRef = useRef<string | null>(null)
  const messagesRef = useRef<Message[]>([])
  const handleSendRef = useRef<typeof handleSend | null>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [prefillInput, setPrefillInput] = useState('')
  const [enableAutoChart, setEnableAutoChart] = useState(false)
  const [enableAutoMindmap, setEnableAutoMindmap] = useState(false)
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  // Keep messagesRef in sync with messages
  
  useEffect(() => { messagesRef.current = useChatStore.getState().messagesByChat[currentChatId ?? ''] || [] }, [currentChatId])

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const [favorites, setFavorites] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('chat_favorites') || '{}') } catch { return {} }
  })

  const handleToggleFavorite = useCallback((chatId: string) => {
    setFavorites(prev => {
      const next = { ...prev }
      if (next[chatId]) {
        delete next[chatId]
      } else {
        next[chatId] = Date.now()
      }
      localStorage.setItem('chat_favorites', JSON.stringify(next))
      return next
    })
  }, [])

  const sortedSessions = useMemo(() => {
    const favIds = Object.keys(favorites)
    const favSet = new Set(favIds)
    const favSessions = sessions
      .filter(s => favSet.has(s.id))
      .sort((a, b) => (favorites[b.id] || 0) - (favorites[a.id] || 0))
    const normalSessions = sessions.filter(s => !favSet.has(s.id))
    return [...favSessions, ...normalSessions]
  }, [sessions, favorites])

  const loadSessions = useCallback(async (search?: string, projectId?: string | null) => {
    try {
      const projectIdParam = projectId ?? undefined
      const response = await chatApi.getHistory(50, 0, search, projectIdParam)
      if (response.data.chats) {
        setSessions(response.data.chats)
      }
    } catch (error: any) {
      console.error('加载会话列表失败:', error)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    try {
      const response = await projectApi.getProjects()
      setProjects(response.data || [])
    } catch (error) {
      console.error('加载项目列表失败:', error)
    }
  }, [])

  useEffect(() => {
    loadSessions()
    loadProjects()
    loadAvailableModels()
    loadApiSettings()
  }, [loadSessions, loadProjects])

  const loadAvailableModels = async () => {
    try {
      const response = await chatApi.listModels()
      if (response.data.models) {
        const available = response.data.models
          .filter((m: any) => m.is_available)
          .map((m: any) => m.id as ModelType)
        setAvailableModels(available)
        setNoApiConfigured(available.length === 0)
        if (available.length > 0 && !available.includes(currentModel)) {
          setCurrentModel(available[0])
        }
      } else {
        setNoApiConfigured(true)
      }
    } catch (error) {
      console.error('加载可用模型失败:', error)
      setNoApiConfigured(true)
    }
  }

  const loadApiSettings = async () => {
    try {
      const response = await fetch('/api/v1/api-settings/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        const settings = data.settings || []
        const websearchSetting = settings.find((s: any) => s.provider === 'websearch')
        setWebsearchAvailable(websearchSetting?.is_configured || false)
      }
    } catch (error) {
      console.error('加载API设置失败:', error)
    }
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    loadSessions(query || undefined, selectedProjectForChat)
  }, [loadSessions, selectedProjectForChat])

  const handleSelectProject = useCallback((projectId: string | null) => {
    setSelectedProjectForChat(projectId)
    setProjectPanelOpen(false)
    storeSetCurrentChatId(null)
    loadSessions(searchQuery || undefined, projectId)
  }, [loadSessions, searchQuery])

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('请输入项目名称')
      return
    }
    setIsCreatingProject(true)
    try {
      const createResponse = await projectApi.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      })
      if (createResponse.data.id) {
        const projectId = createResponse.data.id
        if (newProjectPrompt.trim()) {
          await projectApi.createPrompt(projectId, {
            name: '默认提示词', content: newProjectPrompt.trim(), is_active: true, order: 0,
          })
        }
        if (newProjectDoc && newProjectDocName && newProjectDoc instanceof Blob) {
          const formData = new FormData()
          formData.append('file', newProjectDoc, newProjectDocName)
          await projectApi.uploadDocument(projectId, formData)
        }
        await loadProjects()
        setSelectedProjectForChat(projectId)
        loadSessions(searchQuery || undefined, projectId)
        setShowCreateProjectModal(false)
        setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('')
      }
    } catch (error) {
      console.error('创建项目失败:', error)
      alert('创建项目失败，请重试')
    } finally {
      setIsCreatingProject(false)
    }
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      alert(`文件过大，单个文件不能超过 50MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      e.target.value = ''
      return
    }
    setNewProjectDoc(file)
    setNewProjectDocName(file.name)
  }

  const loadProjectDocuments = async (projectId: string) => {
    try {
      const response = await projectApi.getDocuments(projectId)
      setProjectDocuments(prev => ({ ...prev, [projectId]: response.data || [] }))
    } catch (error) { console.error('加载项目文档失败:', error) }
  }

  const handleDeleteDocument = async (projectId: string, documentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除此文档吗？')) return
    try {
      await projectApi.deleteDocument(projectId, documentId)
      setProjectDocuments(prev => ({
        ...prev,
        [projectId]: (prev[projectId] || []).filter(d => d.id !== documentId)
      }))
    } catch (error) { console.error('删除文档失败:', error); alert('删除文档失败，请重试') }
  }

  const handleOpenEditProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProject(project)
    setNewProjectName(project.name)
    setNewProjectDesc(project.description || '')
    setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('')
    try {
      const promptsResponse = await projectApi.getPrompts(project.id)
      const prompts = promptsResponse.data || []
      if (prompts.length > 0) setNewProjectPrompt(prompts[0].content || '')
    } catch (error) { console.error('加载项目提示词失败:', error) }
    setShowEditProjectModal(true)
    loadProjectDocuments(project.id)
  }

  const handleEditProject = async () => {
    if (!editingProject || !newProjectName.trim()) { alert('请输入项目名称'); return }
    setIsCreatingProject(true)
    try {
      await projectApi.updateProject(editingProject.id, { name: newProjectName.trim(), description: newProjectDesc.trim() || undefined })
      if (newProjectPrompt.trim()) {
        const promptsResponse = await projectApi.getPrompts(editingProject.id)
        const prompts = promptsResponse.data || []
        if (prompts.length > 0) {
          await projectApi.updatePrompt(editingProject.id, prompts[0].id, { name: '默认提示词', content: newProjectPrompt.trim(), is_active: true })
        } else {
          await projectApi.createPrompt(editingProject.id, { name: '默认提示词', content: newProjectPrompt.trim(), is_active: true, order: 0 })
        }
      }
      if (newProjectDoc && newProjectDocName && newProjectDoc instanceof Blob) {
        const formData = new FormData()
        formData.append('file', newProjectDoc, newProjectDocName)
        await projectApi.uploadDocument(editingProject.id, formData)
      }
      await loadProjects()
      if (editingProject) loadProjectDocuments(editingProject.id)
      setShowEditProjectModal(false); setEditingProject(null)
      setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('')
    } catch (error) { console.error('更新项目失败:', error); alert('更新项目失败，请重试') }
    finally { setIsCreatingProject(false) }
  }

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个项目吗？删除后无法恢复。')) return
    try {
      await projectApi.deleteProject(projectId)
      if (selectedProjectForChat === projectId) { setSelectedProjectForChat(null); loadSessions(searchQuery || undefined, null) }
      await loadProjects()
    } catch (error) { console.error('删除项目失败:', error); alert('删除项目失败，请重试') }
  }

  const handleSend = async (message: string, model: ModelType, enableThinking: boolean, fileIds?: string[]) => {
    if (isLoading || sendingRef.current) return
    if (noApiConfigured) {
      alert('请先在「API 设置」中配置 LLM 的 API Key 后再使用对话功能')
      return
    }
    sendingRef.current = true
    let activeChatId = currentChatId
    if (!activeChatId) {
      try {
        const sessionResponse = await chatApi.createSession({ title: message.slice(0, 20), model, project_id: selectedProjectForChat || undefined })
        if (sessionResponse.data.id) {
          activeChatId = sessionResponse.data.id
          storeSetCurrentChatId(activeChatId)
          setSessions(prev => [{
            id: sessionResponse.data.id,
            title: sessionResponse.data.title || message.slice(0, 20),
            user_id: '', model, project_id: sessionResponse.data.project_id,
            project_name: sessionResponse.data.project_name,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 0,
          }, ...prev])
        }
      } catch (error) { console.error('创建会话失败:', error) }
    }
    if (!activeChatId) { sendingRef.current = false; return }
    sendingChatIdRef.current = activeChatId

    if (pastedFiles.length > 0) {
      try {
        for (const pf of pastedFiles) {
          if (pf.fileId) {
            await chatApi.createAttachment({ session_id: activeChatId, file_id: pf.fileId, file_name: pf.file.name, file_type: pf.file.type || 'application/octet-stream' })
          }
        }
      } catch (error) { console.error('保存附件失败:', error) }
    }

    // 清除之前的意图检测状态
    setIrrelevantContentWarning(null)
    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date() }
    const assistantMessage: Message = { id: `assistant-${Date.now()}`, role: 'assistant', content: '', reasoning_content: '', timestamp: new Date() }
    if (activeChatId) { storeAppendMessages(activeChatId, [userMessage, { ...assistantMessage }]) }
    storeSetIsLoading(true)
    setSuggestedQuestions([])
    setPrefillInput('')
    let reasoningDone = false
    let fullContent = ''

    try {
      await chatApi.saveMessage({ chat_id: activeChatId, role: 'user', content: message })
      const conversationHistory = messagesRef.current.map(msg => ({ role: msg.role, content: msg.content }))
      const diagramContext = diagramOpen && activeDiagramXml ? `\n\n[Current diagram XML for modification reference:\n${activeDiagramXml}\n]` : ''

      // Build system prompt with auto chart/mindmap instructions
      let systemPrompt = getDrawioSystemPrompt()
      if (enableAutoChart) {
        systemPrompt += '\n\n**自动图表模式已开启**：请在每次回复中使用 [PLOT] 代码块生成一张与内容相关的图表（如柱状图、折线图、流程图等），帮助用户可视化理解。'
      } else {
        systemPrompt += '\n\n**重要规则**：当前未开启图表生成功能，你绝对不能使用 [PLOT] 代码块生成任何图表。如果用户明确要求生成图表，或你的回答内容确实需要图表来辅助说明（如数据对比、趋势分析、结构关系等），请友好地提醒用户："如果您需要图表来更直观地理解，可以点击输入框左侧的加号按钮，开启「图表生成」功能哦~"。不要在其他情况下主动提及此功能。'
      }
      if (enableAutoMindmap) {
        systemPrompt += '\n\n**自动思维导图模式已开启**：请在每次回复中使用 [DRAWIO] 代码块生成一张思维导图，将回复内容的核心知识点以层级结构展示。'
      }

      abortRef.current = new AbortController()
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          chat_id: activeChatId, model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message + diagramContext },
          ],
          stream: true, enable_thinking: enableThinking,
          enable_websearch: enableWebsearch, project_id: selectedProjectForChat,
          file_ids: fileIds || [],
        }),
      })
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        let detail = '请求失败'
        try { const errorJson = JSON.parse(errorText); detail = errorJson.detail ? (typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail)) : errorText || `服务器错误 (${response.status})` }
        catch { detail = errorText || `服务器错误 (${response.status})` }
        throw new Error(detail)
      }
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let lastSources: Array<{document_name: string; content_snippet: string; score: number}> | null = null
      let lastDetectedXml: string | null = null
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                // 意图检测事件：无关内容警告
                if (parsed.type === 'irrelevant_content') {
                  setIrrelevantContentWarning(parsed.message)
                  continue
                }
                if (parsed.thinking_done) {
                  reasoningDone = true
                  if (parsed.sources) {
                    lastSources = parsed.sources
                  }
                  continue
                }
                if (parsed.reasoning_content && !reasoningDone) {
                  if (activeChatId) { storeUpdateLastAssistant(activeChatId, msg => ({ ...msg, reasoning_content: (msg.reasoning_content || '') + parsed.reasoning_content })) }
                }
                if (parsed.content) {
                  if (!reasoningDone && parsed.reasoning_content === undefined) reasoningDone = true
                  fullContent += parsed.content
                  const displayContent = stripDiagramDuringStreaming(fullContent)
                  if (activeChatId) { storeUpdateLastAssistant(activeChatId, msg => ({ ...msg, content: displayContent })) }

                  // Extract diagram XML from accumulated content
                  const detectedXml = extractDrawioXml(fullContent)
                  if (detectedXml && detectedXml !== lastDetectedXml) {
                    lastDetectedXml = detectedXml
                    setActiveDiagramXml(detectedXml)
                  }
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
        }
        // Restore full content (with [DRAWIO] markers) from accumulated fullContent,
        // so splitContentWithDiagrams in MessageList can properly extract and render diagrams.
        if (activeChatId) {
          const updates: Record<string, any> = {}
          if (fullContent) updates.content = fullContent
          if (lastSources?.length) updates.sources = lastSources
          if (lastDetectedXml) updates.diagramXml = lastDetectedXml
          if (Object.keys(updates).length > 0) {
            storeUpdateLastAssistant(activeChatId, msg => ({ ...msg, ...updates }))
          }
        }
      }
      if (fullContent) {
        let saveRes: any = null
        try {
          saveRes = await chatApi.saveMessage({ chat_id: activeChatId, role: 'assistant', content: fullContent })
          // 后端 save_message 已将 [PLOT] 执行并替换为图片 URL，更新前端消息内容
          if (activeChatId && saveRes.data?.content && saveRes.data.content !== fullContent) {
            storeUpdateLastAssistant(activeChatId, msg => ({ ...msg, content: saveRes.data.content, diagramXml: extractDrawioXml(saveRes.data.content) || undefined }))
          }
        }
        catch (error) { console.error('保存AI回复失败:', error) }

        // 推演下次提问
        if (fullContent && activeChatId) {
          try {
            const store = useChatStore.getState()
            const history = store.getMessages(activeChatId) || []
            const recentHistory = history.slice(-6).map((m: any) => ({
              role: m.role,
              content: m.content || '',
            }))
            const qRes = await chatApi.getNextQuestions({ conversation_history: recentHistory })
            if (qRes.data?.questions?.length) {
              setSuggestedQuestions(qRes.data.questions)
            }
          } catch { /* 静默 */ }
        }

        // 图表自动保存云盘
        if (saveRes?.data?.content) {
          try {
            const imgRegex = /!\[.*?\]\((.*?)\)/g
            const urls: string[] = []
            let m
            while ((m = imgRegex.exec(saveRes.data.content)) !== null) {
              if (m[1].startsWith('/api/v1/chat/plots/') || m[1].startsWith('/api/v1/resources/plots/')) {
                urls.push(m[1])
              }
            }
            if (urls.length > 0) {
              let folderId: string | undefined
              try {
                const folderRes = await cloudDriveApi.createFolder('AI 生成图表')
                folderId = folderRes.data.id
              } catch { /* 文件夹可能已存在 */ }

              for (const url of urls) {
                try {
                  const resp = await fetch(url)
                  const blob = await resp.blob()
                  const file = new File([blob], `plot_${Date.now()}.png`, { type: 'image/png' })
                  await cloudDriveApi.uploadFile(file, folderId)
                } catch { /* 单张失败跳过 */ }
              }

              // 追加保存提示到消息内容
              if (activeChatId) {
                storeUpdateLastAssistant(activeChatId, msg => ({
                  ...msg,
                  content: (msg.content || '') + '\n\n> ✅ 图表已保存到云盘',
                }))
              }
            }
          } catch { /* 静默 */ }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (activeChatId) {
          storeUpdateLastAssistant(activeChatId, msg => ({ ...msg, content: (msg.content || '') + '\\n\\n**（已停止生成）**' }))
        }
        if (fullContent && activeChatId) {
          try {
            const saveRes = await chatApi.saveMessage({ chat_id: activeChatId, role: 'assistant', content: fullContent })
            if (saveRes.data?.content && saveRes.data.content !== fullContent) {
              storeUpdateLastAssistant(activeChatId, msg => ({ ...msg, content: saveRes.data.content }))
            }
          } catch {}
        }
      } else {
        console.error('发送消息失败:', error)
        if (activeChatId) { storeUpdateLastAssistant(activeChatId, msg => ({ ...msg, content: `发送消息失败: ${error.response?.data?.detail || error.message}` })) }
      }
    } finally { storeSetIsLoading(false); abortRef.current = null; sendingRef.current = false; sendingChatIdRef.current = null }
  }

  // Keep handleSendRef in sync
  handleSendRef.current = handleSend

  // Enhanced preview: load file content when opening preview
  useEffect(() => {
    if (!previewFile) { setPreviewDocxHtml(''); setPreviewText(''); setPreviewSlides(null); return }
    const file = previewFile.file
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const fileName = file.name.toLowerCase()
    const isDocx = fileName.endsWith('.docx') || fileName.endsWith('.doc')
    const isPptx = fileName.endsWith('.pptx') || fileName.endsWith('.ppt')
    const isText = fileName.endsWith('.txt') || fileName.endsWith('.md')

    if (isImage || isPdf) return // handled directly in overlay

    setPreviewLoading(true)
    const loadPreviewContent = async () => {
      try {
        // If the file was saved to cloud drive, use cloud drive API for preview (richer data)
        if (previewFile.cloudFileId) {
          if (isPptx) {
            try {
              const resp2 = await cloudDriveApi.getPreviewText(previewFile.cloudFileId)
              if (resp2.data?.slides) {
                setPreviewSlides(resp2.data.slides)
                setPreviewCurrentSlide(0)
                setPreviewLoading(false)
                return
              }
            } catch {}
          }
          if (isDocx) {
            try {
              const detail = await cloudDriveApi.getFileDetail(previewFile.cloudFileId)
              if (detail.data?.content_text) {
                try {
                  const mammoth = await import('mammoth')
                  const binaryStr = atob(detail.data.base64)
                  const bytes = new Uint8Array(binaryStr.length)
                  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
                  const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
                  setPreviewDocxHtml(result.value)
                  setPreviewLoading(false)
                  return
                } catch {}
              }
            } catch {}
          }
          if (isText) {
            try {
              const detail = await cloudDriveApi.getFileDetail(previewFile.cloudFileId)
              if (detail.data?.base64) {
                try {
                  const text = decodeURIComponent(Array.from(atob(detail.data.base64), c =>
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                  ).join(''))
                  setPreviewText(text)
                  setPreviewLoading(false)
                  return
                } catch {}
              }
            } catch {}
          }
        }

        // Fallback: use chat file API
        if (previewFile.fileId) {
          const resp = await chatApi.getFileInfo(previewFile.fileId)
          if (resp.data) {
            const base64 = resp.data.base64
            if (isDocx) {
              try {
                const mammoth = await import('mammoth')
                const binaryStr = atob(base64)
                const bytes = new Uint8Array(binaryStr.length)
                for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
                const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
                setPreviewDocxHtml(result.value)
              } catch {
                setPreviewText('[无法解析此Word文档]')
              }
            } else if (isPptx) {
              // Try to extract text from the binary
              try {
                const binaryStr = atob(base64)
                const bytes = new Uint8Array(binaryStr.length)
                for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
                // Use slide text parsing with a simple approach
                setPreviewText('[PPT文件，请在云盘中查看详细预览]')
              } catch {
                setPreviewText('[无法解析此PPT文件]')
              }
            } else if (isText) {
              try {
                const text = decodeURIComponent(Array.from(atob(base64), c =>
                  '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                ).join(''))
                setPreviewText(text)
              } catch {
                setPreviewText(atob(base64))
              }
            }
          }
        }
      } catch {
        setPreviewText('[无法加载文件内容]')
      } finally {
        setPreviewLoading(false)
      }
    }
    loadPreviewContent()
  }, [previewFile])

  const handleNewChat = () => {
    if (currentChatId) storeResetChat(currentChatId)
    storeSetCurrentChatId(null)
    setPastedFiles([]); setIrrelevantContentWarning(null); setActiveDiagramXml(null); setDiagramOpen(false); setCodeRunnerOpen(false)
  }

  const handleSelectChat = async (chatId: string | null) => {
    if (!chatId) { handleNewChat(); return }
    // 如果正在向同一会话发送消息，不重复加载
    if (chatId === currentChatId) return
    // 如果正在向其他会话发送消息，先中断再切换，避免竞态导致闪烁
    if (sendingRef.current) {
      abortRef.current?.abort()
      storeSetIsLoading(false)
      sendingRef.current = false
      sendingChatIdRef.current = null
    }
    storeSetCurrentChatId(chatId)
    setIrrelevantContentWarning(null)
    try {
      const response = await chatApi.getMessages(chatId)
      if (response.data.messages) {
        storeSetMessagesForChat(chatId, response.data.messages.map((msg: any, index: number) => {
          const base: any = { id: `msg-${index}`, role: msg.role as 'user' | 'assistant', content: msg.content, timestamp: new Date(msg.created_at) }
          if (msg.role === 'assistant') {
            const xml = extractDrawioXml(msg.content)
            if (xml) base.diagramXml = xml
          }
          return base
        }))
      }
      const attachmentsResponse = await chatApi.getAttachments(chatId)
      if (attachmentsResponse.data.attachments?.length > 0) {
        const loadedFiles: PastedFile[] = []
        for (const att of attachmentsResponse.data.attachments) {
          try {
            const fileInfoResponse = await chatApi.getFileInfo(att.file_id)
            if (fileInfoResponse.data) {
              const info = fileInfoResponse.data
              const byteCharacters = atob(info.base64)
              const byteNumbers = new Array(byteCharacters.length)
              for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
              const byteArray = new Uint8Array(byteNumbers)
              const blob = new Blob([byteArray], { type: info.mime_type })
              const file = new File([blob], att.file_name, { type: info.mime_type })
              const preview = info.file_type === 'image' ? `data:${info.mime_type};base64,${info.base64}` : ''
              loadedFiles.push({ id: att.id, file, preview, fileId: att.file_id })
            }
          } catch (error) { console.error('加载附件失败:', error) }
        }
        setPastedFiles(loadedFiles)
      } else { setPastedFiles([]) }

      // Restore last diagram from message history (store XML but don't open side panel)
      let lastDiagramXml: string | null = null
      for (const msg of response.data.messages) {
        if (msg.role === 'assistant' && hasDrawioContent(msg.content)) {
          const xml = extractDrawioXml(msg.content)
          if (xml) lastDiagramXml = xml
        }
      }
      setActiveDiagramXml(lastDiagramXml)
      setDiagramOpen(false)
    } catch (error) { console.error('加载消息失败:', error); handleNewChat() }
  }

  const handleRunCode = (code: string, language: string) => {
    setCodeRunnerCode(code)
    setCodeRunnerLanguage(language)
    setCodeRunnerKey(k => k + 1)
    if (!codeRunnerOpen) setCodeRunnerOpen(true)
  }

  const handleRollback = useCallback((messageId: string) => {
    // Stop generation if active
    if (isLoading) {
      abortRef.current?.abort()
      storeSetIsLoading(false)
      sendingRef.current = false
    }
    if (currentChatId) {
      const prev = useChatStore.getState().messagesByChat[currentChatId] || []
      const aiIdx = prev.findIndex(m => m.id === messageId)
      if (aiIdx < 0) return
      // Find the user message right before this AI message
      let userIdx = -1
      for (let i = aiIdx - 1; i >= 0; i--) {
        if (prev[i].role === 'user') { userIdx = i; break }
      }
      if (userIdx < 0) return
      const userMsg = prev[userIdx]
      // Roll back to before the user message (remove user + AI pair)
      storeSetMessagesForChat(currentChatId, prev.slice(0, userIdx))
      // Re-send the user message to regenerate AI response
      const fileIds = pastedFiles.map(f => f.fileId).filter((id): id is string => !!id)
      setTimeout(() => {
        handleSendRef.current?.(userMsg.content, currentModel, enableThinking, fileIds)
      }, 100)
    }
    setIrrelevantContentWarning(null)
  }, [isLoading, currentChatId, currentModel, enableThinking, pastedFiles])

  const handleDeleteChat = async (chatId: string) => {
    try {
      await chatApi.deleteSession(chatId)
      setSessions(prev => prev.filter(s => s.id !== chatId))
      if (currentChatId === chatId) handleNewChat()
    } catch (error) { console.error('删除会话失败:', error) }
  }

  const handleClearAll = () => {
    if (sessions.length === 0) return
    setShowClearAllModal(true)
  }

  const confirmClearAll = async () => {
    setClearingAll(true)
    try {
      // Delete all sessions sequentially
      for (const session of sessions) {
        try { await chatApi.deleteSession(session.id) } catch { /* skip individual failures */ }
      }
      setSessions([])
      handleNewChat()
    } catch (error) { console.error('清空对话失败:', error) }
    finally { setClearingAll(false); setShowClearAllModal(false) }
  }

  /* ── Project Form Fields ── */
  const projectFormFields = (
    <>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="project-name">项目名称 *</label>
        <input id="project-name" type="text" className="input" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="例如：计算机视觉项目" />
      </div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="project-desc">项目描述</label>
        <textarea id="project-desc" className="input" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} placeholder="项目的简要描述（可选）" rows={2} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="project-prompt">项目提示词</label>
        <textarea id="project-prompt" className="input" value={newProjectPrompt} onChange={e => setNewProjectPrompt(e.target.value)} placeholder="为这个项目设置一个系统提示词，例如：你是一个计算机视觉专家..." rows={4} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label>参考文档</label>
        <div style={{ border: '1.5px dashed var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', textAlign: 'center' }}>
          <input type="file" id="project-doc-upload" onChange={handleFileChange} style={{ display: 'none' }} />
          <label htmlFor="project-doc-upload" style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 500 }}>
            点击上传文件
          </label>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 'var(--space-1)' }}>支持 .txt, .md, .pdf, .docx, .pptx 等文件</div>
          {newProjectDocName && <span style={{ display: 'inline-block', marginTop: 'var(--space-2)', padding: '0.25rem 0.5rem', backgroundColor: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--gray-700)' }}>{newProjectDocName}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <button onClick={() => { setShowCreateProjectModal(false); setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('') }} className="btn btn-secondary">取消</button>
        <button onClick={handleCreateProject} disabled={isCreatingProject} className="btn btn-primary">{isCreatingProject ? '创建中...' : '创建项目'}</button>
      </div>
    </>
  )

  const editFormFields = (
    <>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="edit-project-name">项目名称 *</label>
        <input id="edit-project-name" type="text" className="input" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="例如：计算机视觉项目" />
      </div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="edit-project-desc">项目描述</label>
        <textarea id="edit-project-desc" className="input" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} placeholder="项目的简要描述（可选）" rows={2} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor="edit-project-prompt">项目提示词</label>
        <textarea id="edit-project-prompt" className="input" value={newProjectPrompt} onChange={e => setNewProjectPrompt(e.target.value)} placeholder="为这个项目设置一个系统提示词..." rows={4} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <label style={{ marginBottom: 0 }}>参考文档</label>
          <label htmlFor="edit-project-doc-upload" className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
            <FileUp size={14} /> 上传
          </label>
          <input type="file" id="edit-project-doc-upload" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
        {editingProject && projectDocuments[editingProject.id]?.length > 0 && (
          <div style={{ border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
            {projectDocuments[editingProject.id].map((doc, index) => {
              const isImage = doc.file_type?.startsWith('image/')
              const sizeStr = doc.file_size
                ? doc.file_size > 1024 * 1024 ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(doc.file_size / 1024)} KB`
                : ''
              return (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: index < projectDocuments[editingProject.id].length - 1 ? '1px solid var(--gray-50)' : 'none', backgroundColor: 'var(--gray-50)' }}>
                  <span style={{ color: 'var(--gray-400)', flexShrink: 0 }}>{isImage ? <Image size={16} /> : <FileUp size={16} />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--gray-700)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: '2px' }}>
                      {sizeStr && <span>{sizeStr}</span>}
                      {doc.chunk_count > 0 && <span>{doc.chunk_count} 分块</span>}
                      <span>{new Date(doc.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <button onClick={e => handleDeleteDocument(editingProject.id, doc.id, e)} title="删除文档" style={{ padding: '4px', border: 'none', background: 'none', color: 'var(--gray-400)', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {(!editingProject || !projectDocuments[editingProject.id]?.length) && !newProjectDocName && (
          <div style={{ border: '1.5px dashed var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-400)' }}>暂无文档</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--gray-300)', marginTop: 'var(--space-1)' }}>支持 .txt, .md, .pdf, .docx, .pptx 等文件</div>
          </div>
        )}
        {newProjectDocName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid oklch(from var(--success) l c h / 0.3)' }}>
            <FileUp size={16} />
            <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--gray-700)' }}>{newProjectDocName}</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--success)' }}>待上传</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <button onClick={() => { setShowEditProjectModal(false); setEditingProject(null); setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('') }} className="btn btn-secondary">取消</button>
        <button onClick={handleEditProject} disabled={isCreatingProject} className="btn btn-primary">{isCreatingProject ? '保存中...' : '保存修改'}</button>
      </div>
    </>
  )

  const handleGenerateMindmap = async (messageId: string, content: string) => {
    try {
      // Extract key topics from the AI response content for mindmap generation
      const res = await resourcesApi.generate({
        knowledge_points: [content.slice(0, 500)],
        title: '对话思维导图',
        resource_type: 'mind_map',
      })
      if (res.data?.id) {
        alert('✅ 思维导图已生成')
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败')
    }
  }

  const headerBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: '8px', border: '1px solid',
    borderColor: active ? 'oklch(0.55 0.18 200 / 0.2)' : 'var(--gray-200)',
    backgroundColor: active ? 'oklch(0.55 0.18 200 / 0.06)' : 'white',
    color: active ? 'var(--primary)' : 'var(--gray-500)',
    fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: '5px',
    transition: 'all 0.2s ease', whiteSpace: 'nowrap',
  })

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--chat-bg)',
    }}>
      {/* ═══ Header — 透明/玻璃态 ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 'var(--chat-header-height)', padding: '0 16px',
        backgroundColor: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        position: 'relative', zIndex: 200, flexShrink: 0,
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--gray-200)',
              backgroundColor: 'white', color: 'var(--gray-500)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            首页
          </button>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>
            AI 对话
          </span>
        </div>

        {/* Right — feature buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setProjectPanelOpen(!projectPanelOpen)}
              style={headerBtnStyle(!!selectedProjectForChat)}
              onMouseEnter={e => {
                if (!selectedProjectForChat) {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px oklch(0.55 0.18 200 / 0.08)'
                }
              }}
              onMouseLeave={e => {
                if (!selectedProjectForChat) {
                  e.currentTarget.style.borderColor = 'var(--gray-200)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              <Folder size={14} />
              {selectedProjectForChat ? (projects.find(p => p.id === selectedProjectForChat)?.name || '项目') : '项目'}
            </button>
            {/* Project dropdown — appears directly below the button */}
            {projectPanelOpen && (
              <div className="fade-in" style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem',
                backgroundColor: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)', minWidth: '220px', maxHeight: '320px', overflowY: 'auto', zIndex: 1000,
              }}>
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 500 }}>
                  选择项目
                </div>
                <div onClick={() => handleSelectProject(null)}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem', color: selectedProjectForChat === null ? 'var(--primary)' : 'var(--gray-700)', backgroundColor: selectedProjectForChat === null ? 'oklch(0.55 0.25 250 / 0.06)' : 'transparent', fontWeight: selectedProjectForChat === null ? 500 : 400, transition: 'background-color var(--transition-fast)' }}>
                  全局对话（无项目）
                </div>
                {projects.map(project => (
                  <div key={project.id} onClick={() => handleSelectProject(project.id)}
                    style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem', color: selectedProjectForChat === project.id ? 'var(--primary)' : 'var(--gray-700)', backgroundColor: selectedProjectForChat === project.id ? 'oklch(0.55 0.25 250 / 0.06)' : 'transparent', fontWeight: selectedProjectForChat === project.id ? 500 : 400, borderBottom: '1px solid var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color var(--transition-fast)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{project.name}</div>
                      {project.description && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={e => handleOpenEditProject(project, e)} title="编辑项目" className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '0.75rem', borderColor: 'var(--gray-200)' }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={e => handleDeleteProject(project.id, e)} title="删除项目" className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '0.75rem', borderColor: 'var(--gray-200)', color: 'var(--danger)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                <div onClick={() => { setProjectPanelOpen(false); setShowCreateProjectModal(true) }}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--success)', fontWeight: 500, borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <Plus size={14} /> 新建项目
                </div>
              </div>
            )}
          </div>
          <button onClick={() => { if (!codeRunnerOpen) { setCodeRunnerCode('# 在此编写代码\nprint("Hello World")'); setCodeRunnerLanguage('python') } setCodeRunnerOpen(!codeRunnerOpen) }}
            style={headerBtnStyle(codeRunnerOpen)}
            onMouseEnter={e => {
              if (!codeRunnerOpen) {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.boxShadow = '0 0 0 2px oklch(0.55 0.18 200 / 0.08)'
              }
            }}
            onMouseLeave={e => {
              if (!codeRunnerOpen) {
                e.currentTarget.style.borderColor = 'var(--gray-200)'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            <Code size={14} />
            Code
          </button>
          <button onClick={() => { handleNewChat(); if (!sidebarOpen) setSidebarOpen(true) }}
            style={{
              ...headerBtnStyle(false), backgroundColor: 'var(--primary)',
              color: 'white', borderColor: 'var(--primary)',
            }}>
            <Plus size={14} />
            新建对话
          </button>
        </div>
      </div>

      {/* ═══ API 未配置警告条 ═══ */}
      {noApiConfigured && (
        <div style={{
          padding: '0.5rem 1rem', backgroundColor: '#FEF3C7', borderBottom: '1px solid #FDE68A',
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, fontSize: '0.8125rem', color: '#92400E',
        }}>
          <AlertTriangleIcon size={16} />
          <span>
            未检测到可用的 LLM API 配置。请前往
            <a href="/settings/api" style={{ color: '#0284C7', fontWeight: 600, margin: '0 4px', textDecoration: 'underline' }}>API 设置</a>
            配置 API Key 后即可使用 AI 对话功能。
          </span>
          <button onClick={() => navigate('/settings/api')} style={{
            marginLeft: 'auto', padding: '0.25rem 0.75rem', borderRadius: 6, border: 'none',
            background: '#0284C7', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap',
          }}>去配置</button>
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} currentChatId={currentChatId}
          onSelectChat={handleSelectChat} onNewChat={handleNewChat} sessions={sortedSessions} onDeleteChat={handleDeleteChat}
          onSearch={handleSearch} searchQuery={searchQuery} favorites={favorites} onToggleFavorite={handleToggleFavorite}
          onClearAll={handleClearAll}
 />

        {/* Chat area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minWidth: 0,
        }}>
          {/* Attachments bar */}
          {pastedFiles.length > 0 && (
            <div style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', overflowX: 'auto', flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>附件:</span>
              {pastedFiles.map(file => (
                <div key={file.id} onClick={() => setPreviewFile(file)} style={{ position: 'relative', width: '44px', height: '44px', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--gray-100)', flexShrink: 0, transition: 'border-color var(--transition-fast)' }}>
                  {file.file.type.startsWith('image/') ? (
                    <img src={file.preview} alt={file.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      <FileUp size={16} />
                    </div>
                  )}
                  <div onClick={e => { e.stopPropagation(); const isDb = file.id.includes('-') && file.id.length > 20; if (isDb && file.fileId) chatApi.deleteAttachment(file.id).catch(() => {}); setPastedFiles(pastedFiles.filter(f => f.id !== file.id)) }}
                    style={{ position: 'absolute', top: '-5px', right: '-5px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--danger)', color: 'white', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    ×
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chat Area — only this scrolls */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MessageList
              messages={messages}
              isLoading={isLoading}
              enableThinking={enableThinking}
              onRunCode={handleRunCode}
              onRollback={handleRollback}
              onGenerateMindmap={handleGenerateMindmap}
              onEditDiagram={(xml) => {
                setActiveDiagramXml(xml)
                if (!diagramOpen) setDiagramOpen(true)
              }}
            />
          </div>

          {/* 无关内容警告条 */}
          {irrelevantContentWarning && (
            <div style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'oklch(0.95 0.05 85)',
              borderBottom: '1px solid oklch(0.9 0.05 85)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '0.8125rem',
              color: 'oklch(0.5 0.08 85)',
              flexShrink: 0,
            }}>
              <AlertTriangleIcon size={16} />
              <span>{irrelevantContentWarning}</span>
              <button
                onClick={() => setIrrelevantContentWarning(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1rem', padding: '2px 4px' }}
              >
                ×
              </button>
            </div>
          )}

          {/* Suggested questions */}
          {suggestedQuestions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '4px 12px 0', flexWrap: 'wrap' }}>
              {suggestedQuestions.map(q => (
                <button key={q} onClick={() => { setPrefillInput(q); setSuggestedQuestions([]) }}
                  style={{
                    padding: '4px 10px', borderRadius: 12, border: '1px solid #E5E7EB',
                    background: '#F9FAFB', color: '#6B7280', fontSize: '0.75rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <InputArea onSend={handleSend} onFilesChange={setPastedFiles}
            isLoading={isLoading} currentModel={currentModel}
            onModelChange={setCurrentModel} enableThinking={enableThinking}
            onEnableThinkingChange={storeSetEnableThinking}
            enableWebsearch={enableWebsearch}
            onEnableWebsearchChange={storeSetEnableWebsearch}
            websearchAvailable={websearchAvailable}
            availableModels={availableModels} pastedFiles={pastedFiles}
            onStopGeneration={handleStopGeneration}
            noApiConfigured={noApiConfigured} prefillText={prefillInput}
            enableAutoChart={enableAutoChart}
            onEnableAutoChartChange={setEnableAutoChart}
            enableAutoMindmap={enableAutoMindmap}
            onEnableAutoMindmapChange={setEnableAutoMindmap}
          />
        </div>
      </div>

      {/* Floating Diagram Window */}
      {diagramOpen && (
        <DraggableWindow
          title="图表编辑器"
          visible={diagramOpen}
          onClose={() => setDiagramOpen(false)}
          defaultWidth={700} defaultHeight={500} defaultX={80} defaultY={60}
        >
          <DrawioEditor
            ref={drawioRef}
            visible={true}
            xml={activeDiagramXml}
            onDiagramChange={(xml) => setActiveDiagramXml(xml)}
            onClose={() => setDiagramOpen(false)}
          />
        </DraggableWindow>
      )}

      {/* Floating Code Runner Window */}
      {codeRunnerOpen && (
        <DraggableWindow
          title="代码运行器"
          visible={codeRunnerOpen}
          onClose={() => setCodeRunnerOpen(false)}
          defaultWidth={650} defaultHeight={450} defaultX={160} defaultY={100}
        >
          <CodeRunnerPanel
            key={codeRunnerKey}
            code={codeRunnerCode}
            language={codeRunnerLanguage}
            onClose={() => setCodeRunnerOpen(false)}
          />
        </DraggableWindow>
      )}

      {/* Clear All History Modal */}
      {showClearAllModal && (
        <Modal title="清空全部对话" onClose={() => setShowClearAllModal(false)}>
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              backgroundColor: 'oklch(0.55 0.2 20 / 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}>
              <Trash2 size={28} style={{ color: 'var(--danger)' }} />
            </div>
            <p style={{ fontSize: '0.9375rem', color: 'var(--gray-700)', margin: '0 0 var(--space-2)', fontWeight: 500 }}>
              确定要清空全部对话记录吗？
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', margin: '0 0 var(--space-6)' }}>
              此操作将删除全部 {sessions.length} 个对话，不可恢复。
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button
                onClick={() => setShowClearAllModal(false)}
                disabled={clearingAll}
                className="btn btn-secondary"
                style={{ padding: '8px 20px', fontSize: '0.875rem' }}
              >
                取消
              </button>
              <button
                onClick={confirmClearAll}
                disabled={clearingAll}
                style={{
                  padding: '8px 20px', fontSize: '0.875rem',
                  borderRadius: 'var(--radius-md)', border: 'none',
                  backgroundColor: 'var(--danger)', color: 'white',
                  cursor: clearingAll ? 'default' : 'pointer',
                  opacity: clearingAll ? 0.6 : 1,
                  fontWeight: 500,
                }}
              >
                {clearingAll ? '清空中...' : '确认清空'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && <Modal title="新建项目" onClose={() => { setShowCreateProjectModal(false); setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('') }}>{projectFormFields}</Modal>}

      {/* Edit Project Modal */}
      {showEditProjectModal && editingProject && <Modal title="编辑项目" onClose={() => { setShowEditProjectModal(false); setEditingProject(null); setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('') }}>{editFormFields}</Modal>}

      {/* File Preview Overlay */}
      {previewFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'oklch(0 0 0 / 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 'var(--space-8)', backdropFilter: 'blur(4px)' }}>
          <div className="fade-in" style={{
            maxWidth: '95%', maxHeight: '95%',
            width: (() => {
              const t = previewFile.file.type; const n = previewFile.file.name.toLowerCase()
              if (t === 'application/pdf' || n.endsWith('.docx') || n.endsWith('.doc')) return '100%'
              return 'auto'
            })(),
            height: (() => {
              const t = previewFile.file.type; const n = previewFile.file.name.toLowerCase()
              if (t === 'application/pdf' || n.endsWith('.docx') || n.endsWith('.doc')) return '90vh'
              return 'auto'
            })(),
            backgroundColor: 'white', borderRadius: 'var(--radius-xl)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewFile.file.name}</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={async () => {
                  if (previewFile.fileId) {
                    try {
                      const resp = await chatApi.getFileInfo(previewFile.fileId)
                      if (resp.data) {
                        const binaryStr = atob(resp.data.base64)
                        const bytes = new Uint8Array(binaryStr.length)
                        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
                        const blob = new Blob([bytes], { type: resp.data.mime_type })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url; a.download = previewFile.file.name; a.click()
                        URL.revokeObjectURL(url)
                      }
                    } catch {}
                  }
                }} title="下载" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button onClick={() => setPreviewFile(null)} className="btn btn-secondary" style={{ padding: 'var(--space-1)', border: 'none', background: 'none', color: 'var(--gray-400)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{
              overflow: 'auto', flex: 1,
              padding: (() => {
                const t = previewFile.file.type; const n = previewFile.file.name.toLowerCase()
                if (t === 'application/pdf' || n.endsWith('.docx') || n.endsWith('.doc')) return 0
                return 'var(--space-4)'
              })(),
            }}>
              {(() => {
                const t = previewFile.file.type
                const n = previewFile.file.name.toLowerCase()
                const isImage = t.startsWith('image/')
                const isPdf = t === 'application/pdf'
                const isDocx = n.endsWith('.docx') || n.endsWith('.doc')
                const isPptx = n.endsWith('.pptx') || n.endsWith('.ppt')
                const isText = n.endsWith('.txt') || n.endsWith('.md')

                if (isImage) {
                  return <img src={previewFile.preview} alt={previewFile.file.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />
                }
                if (isPdf) {
                  return <iframe src={previewFile.preview} style={{ width: '100%', height: 'calc(90vh - 52px)', border: 'none' }} title={previewFile.file.name} />
                }
                if (isDocx && previewDocxHtml) {
                  return (
                    <div className="markdown-content" style={{ padding: 'var(--space-8)', maxWidth: 800, margin: '0 auto', lineHeight: 1.8, fontSize: '0.9375rem' }}
                      dangerouslySetInnerHTML={{ __html: previewDocxHtml }} />
                  )
                }
                if (isPptx && previewSlides) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 300 }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', backgroundColor: 'var(--gray-50)' }}>
                        <div style={{ width: '100%', maxWidth: 600, minHeight: 200, backgroundColor: 'white', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-3)', textAlign: 'center' }}>
                            幻灯片 {previewCurrentSlide + 1} / {previewSlides.length}
                          </div>
                          {(previewSlides[previewCurrentSlide] || []).length > 0 ? (
                            <ul style={{ fontSize: '1rem', lineHeight: 2, color: 'var(--gray-800)', paddingLeft: 'var(--space-5)', margin: 0 }}>
                              {previewSlides[previewCurrentSlide].map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          ) : (
                            <div style={{ textAlign: 'center', color: 'var(--gray-400)' }}>此幻灯片无文字内容</div>
                          )}
                        </div>
                      </div>
                      {previewSlides.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderTop: '1px solid var(--gray-100)' }}>
                          <button onClick={() => setPreviewCurrentSlide(s => Math.max(0, s - 1))} disabled={previewCurrentSlide <= 0}
                            className="btn btn-secondary" style={{ padding: '0.375rem 1rem', fontSize: '0.8125rem' }}><ChevronLeftIcon size={13} /> 上一页</button>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>{previewCurrentSlide + 1} / {previewSlides.length}</span>
                          <button onClick={() => setPreviewCurrentSlide(s => Math.min(previewSlides.length - 1, s + 1))} disabled={previewCurrentSlide >= previewSlides.length - 1}
                            className="btn btn-secondary" style={{ padding: '0.375rem 1rem', fontSize: '0.8125rem' }}>下一页 <ArrowRightIcon size={13} /></button>
                        </div>
                      )}
                    </div>
                  )
                }
                if (isText && previewText) {
                  return (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem', lineHeight: 1.7, color: 'var(--gray-700)', margin: 0, padding: 'var(--space-4)' }}>
                      {previewText}
                    </pre>
                  )
                }
                // Loading or fallback
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-8)', backgroundColor: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                    {previewLoading ? (
                      <div style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>加载中...</div>
                    ) : (
                      <>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--gray-300)' }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>{previewFile.file.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>此文件类型暂不支持在线预览，请下载后查看</div>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
