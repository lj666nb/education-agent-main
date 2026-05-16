import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import MessageList, { Message } from './MessageList'
import InputArea, { PastedFile } from './InputArea'
import { chatApi, projectApi } from '../api/auth'

type ModelType = 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'qwen3.5-plus' | 'qwen3.6-plus'

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

/* ── SVG Icons ── */

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

/* ── Shared Modal ── */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
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
        onClick={e => e.stopPropagation()}
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
            <CloseIcon />
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
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentModel, setCurrentModel] = useState<ModelType>('deepseek-v4-flash')
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [enableThinking, setEnableThinking] = useState(false)
  const [enableWebsearch, setEnableWebsearch] = useState(false)
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
  const [previewFile, setPreviewFile] = useState<PastedFile | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [availableModels, setAvailableModels] = useState<ModelType[]>(['deepseek-v4-flash', 'deepseek-v4-pro', 'qwen3.5-plus', 'qwen3.6-plus'])
  const [projectDocuments, setProjectDocuments] = useState<Record<string, ProjectDocument[]>>({})

  const loadSessions = useCallback(async (search?: string, projectId?: string | null) => {
    try {
      const projectIdParam = projectId ?? undefined
      const response = await chatApi.getHistory(50, 0, search, projectIdParam)
      if (response.data.chats) {
        setSessions(response.data.chats)
      }
    } catch (error) {
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
        if (available.length > 0 && !available.includes(currentModel)) {
          setCurrentModel(available[0])
        }
      }
    } catch (error) {
      console.error('加载可用模型失败:', error)
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
    setCurrentChatId(null)
    setMessages([])
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
    if (isLoading) return
    let activeChatId = currentChatId
    if (!activeChatId) {
      try {
        const sessionResponse = await chatApi.createSession({ title: message.slice(0, 20), model, project_id: selectedProjectForChat || undefined })
        if (sessionResponse.data.id) {
          activeChatId = sessionResponse.data.id
          setCurrentChatId(activeChatId)
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
    if (!activeChatId) return

    if (pastedFiles.length > 0) {
      try {
        for (const pf of pastedFiles) {
          if (pf.fileId) {
            await chatApi.createAttachment({ session_id: activeChatId, file_id: pf.fileId, file_name: pf.file.name, file_type: pf.file.type || 'application/octet-stream' })
          }
        }
      } catch (error) { console.error('保存附件失败:', error) }
    }

    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date() }
    const assistantMessage: Message = { id: `assistant-${Date.now()}`, role: 'assistant', content: '', reasoning_content: '', timestamp: new Date() }
    setMessages(prev => [...prev, userMessage, { ...assistantMessage }])
    setIsLoading(true)
    let reasoningDone = false

    try {
      await chatApi.saveMessage({ chat_id: activeChatId, role: 'user', content: message })
      const conversationHistory = messages.map(msg => ({ role: msg.role, content: msg.content }))
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: JSON.stringify({ chat_id: activeChatId, model, messages: [...conversationHistory, { role: 'user', content: message }], stream: true, enable_thinking: enableThinking, enable_websearch: enableWebsearch, project_id: selectedProjectForChat, file_ids: fileIds || [] }),
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
      let fullContent = ''
      let lastSources: Array<{document_name: string; content_snippet: string; score: number}> | null = null
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
                if (parsed.thinking_done) {
                  reasoningDone = true
                  if (parsed.sources) {
                    lastSources = parsed.sources
                  }
                  continue
                }
                if (parsed.reasoning_content && !reasoningDone) {
                  setMessages(prev => prev.map(msg => msg.id === assistantMessage.id ? { ...msg, reasoning_content: (msg.reasoning_content || '') + parsed.reasoning_content } : msg))
                }
                if (parsed.content) {
                  if (!reasoningDone && parsed.reasoning_content === undefined) reasoningDone = true
                  fullContent += parsed.content
                  setMessages(prev => prev.map(msg => msg.id === assistantMessage.id ? { ...msg, content: fullContent } : msg))
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
        }
        if (lastSources && lastSources.length > 0) {
          setMessages(prev => prev.map(msg => msg.id === assistantMessage.id ? { ...msg, sources: lastSources! } : msg))
        }
      }
      if (fullContent) {
        try { await chatApi.saveMessage({ chat_id: activeChatId, role: 'assistant', content: fullContent }) }
        catch (error) { console.error('保存AI回复失败:', error) }
      }
    } catch (error: any) {
      console.error('发送消息失败:', error)
      setMessages(prev => prev.map(msg => msg.id === assistantMessage.id ? { ...msg, content: `发送消息失败: ${error.response?.data?.detail || error.message}` } : msg))
    } finally { setIsLoading(false) }
  }

  const handleNewChat = () => {
    if (messages.length > 0) {
      if (!window.confirm('当前对话还未发送消息，确定要开始新的对话吗？')) return
    }
    setMessages([]); setCurrentChatId(null); setPastedFiles([])
  }

  const handleSelectChat = async (chatId: string | null) => {
    if (!chatId) { handleNewChat(); return }
    setCurrentChatId(chatId)
    try {
      const response = await chatApi.getMessages(chatId)
      if (response.data.messages) {
        setMessages(response.data.messages.map((msg: any, index: number) => ({ id: `msg-${index}`, role: msg.role as 'user' | 'assistant', content: msg.content, timestamp: new Date(msg.created_at) })))
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
    } catch (error) { console.error('加载消息失败:', error); handleNewChat() }
  }

  const handleDeleteChat = async (chatId: string) => {
    if (!window.confirm('确定要删除这个对话吗？此操作不可恢复。')) return
    try {
      await chatApi.deleteSession(chatId)
      setSessions(prev => prev.filter(s => s.id !== chatId))
      if (currentChatId === chatId) handleNewChat()
    } catch (error) { console.error('删除会话失败:', error) }
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
            <UploadIcon /> 上传
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
                  <span style={{ color: 'var(--gray-400)', flexShrink: 0 }}>{isImage ? <ImageIcon /> : <FileIcon />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--gray-700)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: '2px' }}>
                      {sizeStr && <span>{sizeStr}</span>}
                      {doc.chunk_count > 0 && <span>{doc.chunk_count} 分块</span>}
                      <span>{new Date(doc.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <button onClick={e => handleDeleteDocument(editingProject.id, doc.id, e)} title="删除文档" style={{ padding: '4px', border: 'none', background: 'none', color: 'var(--gray-400)', cursor: 'pointer', flexShrink: 0 }}>
                    <TrashIcon />
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
            <FileIcon />
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Floating back button */}
      <button
        onClick={() => navigate('/')}
        className="btn btn-secondary"
        style={{
          position: 'fixed', top: '1rem', left: '1rem',
          padding: 'var(--space-2) var(--space-3)',
          zIndex: 1001,
          boxShadow: 'var(--shadow-md)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}
      >
        <ArrowLeftIcon />
        首页
      </button>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0.75rem 1rem', borderBottom: '1px solid var(--gray-100)', position: 'relative', zIndex: 102,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1rem' }}>AI 对话平台</span>
          <button
            onClick={() => setProjectPanelOpen(!projectPanelOpen)}
            className="btn"
            style={{
              padding: '0.25rem 0.5rem', fontSize: '0.75rem',
              backgroundColor: selectedProjectForChat ? 'oklch(0.55 0.25 250 / 0.08)' : 'var(--gray-50)',
              borderColor: selectedProjectForChat ? 'oklch(0.55 0.25 250 / 0.2)' : 'var(--gray-200)',
              color: selectedProjectForChat ? 'var(--primary)' : 'var(--gray-500)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
            }}
            title="选择项目"
          >
            <FolderIcon />
            {selectedProjectForChat ? (projects.find(p => p.id === selectedProjectForChat)?.name || '项目') : '选择项目'}
          </button>
        </div>

        {/* Project dropdown */}
        {projectPanelOpen && (
          <div className="fade-in" style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.5rem',
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
                    <EditIcon />
                  </button>
                  <button onClick={e => handleDeleteProject(project.id, e)} title="删除项目" className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '0.75rem', borderColor: 'var(--gray-200)', color: 'var(--danger)' }}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
            <div onClick={() => { setProjectPanelOpen(false); setShowCreateProjectModal(true) }}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--success)', fontWeight: 500, borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <PlusIcon /> 新建项目
            </div>
          </div>
        )}

        <button onClick={() => { handleNewChat(); if (!sidebarOpen) setSidebarOpen(true) }}
          className="btn btn-primary"
          style={{ position: 'absolute', right: '1rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <PlusIcon /> 新建对话
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 56px)' }}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} currentChatId={currentChatId}
          onSelectChat={handleSelectChat} onNewChat={handleNewChat} sessions={sessions} onDeleteChat={handleDeleteChat}
          onSearch={handleSearch} searchQuery={searchQuery} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingLeft: sidebarOpen ? '220px' : '0', transition: 'padding-left var(--transition-slow)', overflow: 'hidden' }}>
          {/* Attachments bar */}
          {pastedFiles.length > 0 && (
            <div style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', overflowX: 'auto' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>附件:</span>
              {pastedFiles.map(file => (
                <div key={file.id} onClick={() => setPreviewFile(file)} style={{ position: 'relative', width: '44px', height: '44px', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--gray-100)', flexShrink: 0, transition: 'border-color var(--transition-fast)' }}>
                  {file.file.type.startsWith('image/') ? (
                    <img src={file.preview} alt={file.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      <FileIcon />
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

          <MessageList messages={messages} isLoading={isLoading} enableThinking={enableThinking} />

          <InputArea onSend={handleSend} onFilesChange={setPastedFiles} isLoading={isLoading} currentModel={currentModel}
            onModelChange={setCurrentModel} enableThinking={enableThinking} onEnableThinkingChange={setEnableThinking}
            enableWebsearch={enableWebsearch} onEnableWebsearchChange={setEnableWebsearch} websearchAvailable={websearchAvailable}
            availableModels={availableModels} pastedFiles={pastedFiles} />

          {/* Create Project Modal */}
          {showCreateProjectModal && <Modal title="新建项目" onClose={() => { setShowCreateProjectModal(false); setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('') }}>{projectFormFields}</Modal>}

          {/* Edit Project Modal */}
          {showEditProjectModal && editingProject && <Modal title="编辑项目" onClose={() => { setShowEditProjectModal(false); setEditingProject(null); setNewProjectName(''); setNewProjectDesc(''); setNewProjectPrompt(''); setNewProjectDoc(null); setNewProjectDocName('') }}>{editFormFields}</Modal>}

          {/* File Preview Overlay */}
          {previewFile && (
            <div onClick={() => setPreviewFile(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'oklch(0 0 0 / 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 'var(--space-8)', backdropFilter: 'blur(4px)' }}>
              <div onClick={e => e.stopPropagation()} className="fade-in" style={{ maxWidth: '90%', maxHeight: '90%', backgroundColor: 'white', borderRadius: 'var(--radius-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-heading)' }}>{previewFile.file.name}</span>
                  <button onClick={() => setPreviewFile(null)} className="btn btn-secondary" style={{ padding: 'var(--space-1)', border: 'none', background: 'none', color: 'var(--gray-400)' }}>
                    <CloseIcon />
                  </button>
                </div>
                <div style={{ padding: 'var(--space-4)', overflow: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
                  {previewFile.file.type.startsWith('image/') ? (
                    <img src={previewFile.preview} alt={previewFile.file.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />
                  ) : (
                    <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--gray-50)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                      {previewFile.file.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
