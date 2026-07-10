/**
 * KnowledgeGraphPage — knowledge graph workspace.
 *
 * Business flow:
 * 1. Select an existing subject or import a document.
 * 2. Track the real asynchronous extraction task.
 * 3. Inspect the graph and browse knowledge points in a tree.
 * 4. Continue to the knowledge list or personalized learning path with subject_id.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileText,
  FolderKanban,
  FolderTree,
  LoaderCircle,
  Network,
  Route,
  UploadCloud,
} from 'lucide-react'
import { knowledgeGraphApi, type GraphEdge, type GraphNode } from '../api/knowledgeGraph'
import KnowledgeGraphViz from '../components/KnowledgeGraphViz'
import KgKnowledgeTree from '../components/KgKnowledgeTree'
import './KnowledgeGraphPage.css'

const API_BASE = '/api/v1'
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx']
const LEGACY_EXTENSIONS = ['.doc', '.ppt']

type WorkspaceTab = 'graphs' | 'import' | 'tree'

type KGInfo = {
  id: string
  name: string
  description: string
  domains: number
  knowledge_points: number
}

type TaskStatus = {
  task_id: string
  status: string
  progress: number
  message: string
  result?: {
    entities: number
    triples: number
    prerequisites: number
    source: string
    subject_id?: string
  }
}

type ActiveGraph = {
  subjectId: string
  subjectName: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  loading: boolean
  error: string
}

const EMPTY_GRAPH: ActiveGraph = {
  subjectId: '',
  subjectName: '',
  nodes: [],
  edges: [],
  loading: false,
  error: '',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '等待处理',
  parsing: '正在解析文档',
  extracting: '正在提取知识实体',
  fusing: '正在融合知识关系',
  importing: '正在写入知识库',
  done: '构建完成',
  failed: '构建失败',
}

function fileExtension(filename: string) {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : ''
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function requestErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: string
      response?: { data?: { detail?: string } }
    }
    return candidate.response?.data?.detail || candidate.message || fallback
  }
  return fallback
}

export default function KnowledgeGraphPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSelectedRef = useRef(false)

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('graphs')
  const [kgList, setKgList] = useState<KGInfo[]>([])
  const [kgListLoading, setKgListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [activeGraph, setActiveGraph] = useState<ActiveGraph>(EMPTY_GRAPH)
  const [highlightedNodeNames, setHighlightedNodeNames] = useState<string[]>([])
  const [focusNodeName, setFocusNodeName] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [llmAvailable, setLlmAvailable] = useState(true)

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const refreshKgList = useCallback(async () => {
    setListError('')
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE}/knowledge-graph/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || '知识图谱列表加载失败')
      }
      const data = await response.json()
      const nextList: KGInfo[] = data.knowledge_graphs || []
      setKgList(nextList)
      return nextList
    } catch (error) {
      setListError(requestErrorMessage(error, '知识图谱列表加载失败，请稍后重试'))
      return []
    } finally {
      setKgListLoading(false)
    }
  }, [])

  const openGraph = useCallback(async (kg: KGInfo) => {
    if (kg.knowledge_points <= 0) return
    setActiveGraph({
      subjectId: kg.id,
      subjectName: kg.name,
      nodes: [],
      edges: [],
      loading: true,
      error: '',
    })
    setHighlightedNodeNames([])
    setFocusNodeName(null)
    try {
      const response = await knowledgeGraphApi.getGraphData(kg.id)
      setActiveGraph({
        subjectId: kg.id,
        subjectName: kg.name,
        nodes: response.data.nodes,
        edges: response.data.edges,
        loading: false,
        error: '',
      })
    } catch (error) {
      setActiveGraph({
        subjectId: kg.id,
        subjectName: kg.name,
        nodes: [],
        edges: [],
        loading: false,
        error: requestErrorMessage(error, '图谱数据加载失败，请稍后重试'),
      })
    }
  }, [])

  const finishTask = useCallback(async (status: TaskStatus) => {
    clearPollTimer()
    setUploading(false)
    localStorage.removeItem('kg_active_task_id')
    if (status.status !== 'done') return

    const nextList = await refreshKgList()
    const createdSubjectId = status.result?.subject_id
    if (!createdSubjectId) return
    const createdGraph = nextList.find(item => item.id === createdSubjectId)
    if (createdGraph) await openGraph(createdGraph)
  }, [clearPollTimer, openGraph, refreshKgList])

  const pollTask = useCallback((taskId: string) => {
    clearPollTimer()
    const token = localStorage.getItem('access_token')
    pollTimerRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/knowledge-graph/status?task_id=${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) return
        const status: TaskStatus = await response.json()
        setTaskStatus(status)
        if (status.status === 'done' || status.status === 'failed') {
          await finishTask(status)
        }
      } catch {
        // A temporary polling failure should not discard a running server task.
      }
    }, 2000)
  }, [clearPollTimer, finishTask])

  useEffect(() => {
    void refreshKgList()
    void (async () => {
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(`${API_BASE}/api-settings/available/models`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setLlmAvailable((data.available || []).length > 0)
        }
      } catch {
        // Keep the action available if the capability check itself is unavailable.
      }
    })()

    const savedTaskId = localStorage.getItem('kg_active_task_id')
    if (savedTaskId) {
      const token = localStorage.getItem('access_token')
      void fetch(`${API_BASE}/knowledge-graph/status?task_id=${savedTaskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async response => {
        if (!response.ok) {
          localStorage.removeItem('kg_active_task_id')
          return
        }
        const status: TaskStatus = await response.json()
        setTaskStatus(status)
        if (status.status === 'done' || status.status === 'failed') {
          await finishTask(status)
        } else {
          setUploading(true)
          pollTask(savedTaskId)
        }
      }).catch(() => {
        setUploadError('无法恢复上次构建进度，请刷新后重试')
      })
    }

    return clearPollTimer
  }, [clearPollTimer, finishTask, pollTask, refreshKgList])

  useEffect(() => {
    if (autoSelectedRef.current || kgListLoading || activeGraph.subjectId) return
    const firstAvailableGraph = kgList.find(item => item.knowledge_points > 0)
    if (firstAvailableGraph) {
      autoSelectedRef.current = true
      void openGraph(firstAvailableGraph)
    }
  }, [activeGraph.subjectId, kgList, kgListLoading, openGraph])

  const validateAndSelectFile = (file: File | undefined) => {
    if (!file) return
    const extension = fileExtension(file.name)
    setTaskStatus(null)
    setUploadError('')

    if (LEGACY_EXTENSIONS.includes(extension)) {
      setSelectedFile(file)
      setUploadError(`检测到旧版 ${extension} 文件，当前无法解析其中的文本。建议另存为 ${extension === '.doc' ? '.docx' : '.pptx'} 格式后重新选择。`)
      return
    }
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setSelectedFile(null)
      setUploadError('仅支持 PDF、DOCX、PPTX 文档；旧版 DOC、PPT 请另存为新格式')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setSelectedFile(null)
      setUploadError('文档不能超过 50MB')
      return
    }
    setSelectedFile(file)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSelectFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    validateAndSelectFile(event.dataTransfer.files?.[0])
  }

  const handleUpload = async () => {
    if (!selectedFile || !SUPPORTED_EXTENSIONS.includes(fileExtension(selectedFile.name))) return
    setUploading(true)
    setUploadError('')
    try {
      const token = localStorage.getItem('access_token')
      const formData = new FormData()
      formData.append('file', selectedFile)
      const response = await fetch(`${API_BASE}/knowledge-graph/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || '文档上传失败')
      }
      const data = await response.json()
      localStorage.setItem('kg_active_task_id', data.task_id)
      const initialStatus: TaskStatus = {
        task_id: data.task_id,
        status: 'pending',
        progress: 0,
        message: data.message || '文档已接收',
      }
      setTaskStatus(initialStatus)
      pollTask(data.task_id)
    } catch (error) {
      setUploadError(requestErrorMessage(error, '文档上传失败，请重试'))
      setUploading(false)
    }
  }

  const openCreatedGraph = async () => {
    const subjectId = taskStatus?.result?.subject_id
    if (!subjectId) return
    const kg = kgList.find(item => item.id === subjectId)
    if (kg) {
      await openGraph(kg)
      setActiveTab('graphs')
    }
  }

  const isLegacyFile = selectedFile ? LEGACY_EXTENSIONS.includes(fileExtension(selectedFile.name)) : false
  const isProcessing = Boolean(taskStatus && !['done', 'failed'].includes(taskStatus.status))
  const progressPercent = Math.round((taskStatus?.progress || 0) * 100)

  return (
    <div className="kg-workspace">
      <header className="kg-header">
        <div className="kg-header__identity">
          <div className="kg-header__mark" aria-hidden="true"><Network size={19} /></div>
          <div>
            <div className="kg-header__title-row">
              <h1>知识图谱工作台</h1>
              {activeGraph.subjectId && (
                <span className="kg-header__stats">
                  {activeGraph.nodes.length} 节点 · {activeGraph.edges.length} 关系
                </span>
              )}
            </div>
            <p>从学习材料构建、检索并理解知识之间的联系</p>
          </div>
        </div>
        <nav className="kg-header__nav" aria-label="知识图谱页面导航">
          <button type="button" onClick={() => navigate('/')}><ArrowLeft size={15} />返回首页</button>
        </nav>
      </header>

      <div className="kg-workspace__body">
        <aside className="kg-sidebar">
          <div className="kg-tabs" role="tablist" aria-label="知识图谱工具">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'graphs'}
              className={activeTab === 'graphs' ? 'is-active' : ''}
              onClick={() => setActiveTab('graphs')}
            >
              <FolderKanban size={15} />图库
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'import'}
              className={activeTab === 'import' ? 'is-active' : ''}
              onClick={() => setActiveTab('import')}
            >
              <UploadCloud size={15} />导入
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tree'}
              className={activeTab === 'tree' ? 'is-active' : ''}
              onClick={() => setActiveTab('tree')}
            >
              <FolderTree size={15} />知识点
            </button>
          </div>

          <div className={`kg-sidebar__content ${activeTab === 'tree' ? 'kg-sidebar__content--chat' : ''}`}>
            {activeTab === 'graphs' && (
              <section className="kg-panel" aria-labelledby="kg-library-title">
                <div className="kg-panel__heading">
                  <div>
                    <span className="kg-eyebrow">知识库</span>
                    <h2 id="kg-library-title">已构建图谱</h2>
                  </div>
                  <button type="button" className="kg-small-action" onClick={() => setActiveTab('import')}>新建</button>
                </div>

                {kgListLoading ? (
                  <div className="kg-inline-state"><LoaderCircle className="kg-spin" size={18} />正在加载图谱...</div>
                ) : listError ? (
                  <div className="kg-notice kg-notice--error"><CircleAlert size={17} /><span>{listError}</span></div>
                ) : kgList.length === 0 ? (
                  <button type="button" className="kg-empty-card" onClick={() => setActiveTab('import')}>
                    <UploadCloud size={25} />
                    <strong>还没有知识图谱</strong>
                    <span>导入学习材料开始构建</span>
                  </button>
                ) : (
                  <div className="kg-library-list">
                    {kgList.map(kg => {
                      const isActive = activeGraph.subjectId === kg.id
                      const hasGraph = kg.knowledge_points > 0
                      return (
                        <article key={kg.id} className={`kg-library-item ${isActive ? 'is-active' : ''} ${!hasGraph ? 'is-disabled' : ''}`}>
                          <button type="button" className="kg-library-item__main" disabled={!hasGraph} onClick={() => void openGraph(kg)}>
                            <span className="kg-library-item__icon"><BookOpen size={17} /></span>
                            <span className="kg-library-item__copy">
                              <strong>{kg.name}</strong>
                              <span>{hasGraph ? `${kg.domains} 个领域 · ${kg.knowledge_points} 个知识点` : '暂无知识点'}</span>
                            </span>
                            {isActive && <span className="kg-current-badge">当前</span>}
                            {!isActive && hasGraph && <ChevronRight size={15} className="kg-library-item__chevron" />}
                          </button>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'import' && (
              <section className="kg-panel" aria-labelledby="kg-import-title">
                <div className="kg-panel__heading kg-panel__heading--stacked">
                  <span className="kg-eyebrow">材料入库</span>
                  <h2 id="kg-import-title">构建新图谱</h2>
                  <p>系统会解析文档，并通过已配置的 AI 服务提取知识点与关系。</p>
                </div>

                {!isProcessing && taskStatus?.status !== 'done' && (
                  <>
                    <button
                      type="button"
                      className={`kg-dropzone ${dragging ? 'is-dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={event => { event.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                    >
                      <input ref={fileInputRef} type="file" onChange={handleFileSelect} />
                      {selectedFile ? (
                        <>
                          <span className="kg-dropzone__icon"><FileText size={26} /></span>
                          <strong>{selectedFile.name}</strong>
                          <span>{fileSizeLabel(selectedFile.size)} · 点击重新选择</span>
                        </>
                      ) : (
                        <>
                          <span className="kg-dropzone__icon"><UploadCloud size={28} /></span>
                          <strong>拖拽文档到这里</strong>
                          <span>或点击选择，最大 50MB</span>
                          <small>PDF · DOCX · PPTX</small>
                        </>
                      )}
                    </button>

                    {uploadError && (
                      <div className="kg-notice kg-notice--error" role="alert"><CircleAlert size={17} /><span>{uploadError}</span></div>
                    )}
                    {!llmAvailable && (
                      <div className="kg-notice kg-notice--warning">
                        <BrainCircuit size={18} />
                        <span>AI 服务尚未配置。请先完成 <button type="button" onClick={() => navigate('/settings/api')}>API 设置</button>。</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="kg-primary-action"
                      disabled={!selectedFile || isLegacyFile || uploading || !llmAvailable || Boolean(uploadError)}
                      onClick={() => void handleUpload()}
                    >
                      <BrainCircuit size={17} />开始构建知识图谱
                    </button>
                  </>
                )}

                {taskStatus && (
                  <div className={`kg-task-card kg-task-card--${taskStatus.status}`}>
                    <div className="kg-task-card__heading">
                      <span className="kg-task-card__icon">
                        {taskStatus.status === 'done' ? <CheckCircle2 size={20} /> : taskStatus.status === 'failed' ? <CircleAlert size={20} /> : <LoaderCircle className="kg-spin" size={20} />}
                      </span>
                      <div>
                        <strong>{STATUS_LABELS[taskStatus.status] || taskStatus.status}</strong>
                        <p>{taskStatus.message}</p>
                      </div>
                      {isProcessing && <span className="kg-task-card__percent">{progressPercent}%</span>}
                    </div>
                    {isProcessing && (
                      <div className="kg-progress" aria-label={`构建进度 ${progressPercent}%`}>
                        <span style={{ width: `${progressPercent}%` }} />
                      </div>
                    )}
                    {taskStatus.status === 'done' && taskStatus.result && (
                      <>
                        <dl className="kg-result-grid">
                          <div><dt>知识点</dt><dd>{taskStatus.result.entities}</dd></div>
                          <div><dt>关系</dt><dd>{taskStatus.result.triples}</dd></div>
                          <div><dt>前置依赖</dt><dd>{taskStatus.result.prerequisites}</dd></div>
                        </dl>
                        <div className="kg-task-card__actions">
                          <button type="button" className="kg-primary-action" onClick={() => void openCreatedGraph()}><Network size={16} />查看图谱</button>
                          <button type="button" className="kg-secondary-action" onClick={() => navigate(`/path?subjectId=${taskStatus.result?.subject_id || ''}`)}><Route size={16} />生成学习路径</button>
                          <button type="button" className="kg-text-action" onClick={() => { setSelectedFile(null); setTaskStatus(null); setUploadError('') }}>继续导入</button>
                        </div>
                      </>
                    )}
                    {taskStatus.status === 'failed' && (
                      <button type="button" className="kg-secondary-action" onClick={() => { setTaskStatus(null); setUploadError('') }}>重新选择文档</button>
                    )}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'tree' && (
              activeGraph.subjectId ? (
                <KgKnowledgeTree
                  nodes={activeGraph.nodes}
                  subjectName={activeGraph.subjectName}
                  highlightedNodeNames={highlightedNodeNames}
                  onHighlightNode={(nodeName) => setHighlightedNodeNames(nodeName ? [nodeName] : [])}
                />
              ) : (
                <div className="kg-chat-empty">
                  <FolderTree size={28} />
                  <strong>先选择一个图谱</strong>
                  <span>在图库中打开图谱后，即可查看知识点的树状目录结构。</span>
                  <button type="button" onClick={() => setActiveTab('graphs')}>前往图库</button>
                </div>
              )
            )}
          </div>
        </aside>

        <main className="kg-canvas" aria-label="知识图谱画布">
          {activeGraph.subjectId && (
            <div className="kg-canvas__toolbar">
              <div>
                <span>当前图谱</span>
                <strong>{activeGraph.subjectName}</strong>
              </div>
            </div>
          )}

          <div className="kg-canvas__stage">
            {activeGraph.loading ? (
              <div className="kg-canvas-state"><LoaderCircle className="kg-spin" size={26} /><strong>正在加载图谱</strong><span>读取节点与关系数据...</span></div>
            ) : activeGraph.error ? (
              <div className="kg-canvas-state kg-canvas-state--error"><CircleAlert size={28} /><strong>图谱加载失败</strong><span>{activeGraph.error}</span><button type="button" onClick={() => { const kg = kgList.find(item => item.id === activeGraph.subjectId); if (kg) void openGraph(kg) }}>重新加载</button></div>
            ) : activeGraph.subjectId && activeGraph.nodes.length > 0 ? (
              <KnowledgeGraphViz
                nodes={activeGraph.nodes}
                edges={activeGraph.edges}
                highlightNodeNames={highlightedNodeNames}
                focusNodeName={focusNodeName}
                onFocusNode={(name) => setFocusNodeName(name)}
              />
            ) : (
              <div className="kg-canvas-state">
                <span className="kg-canvas-state__mark"><Network size={32} /></span>
                <strong>{kgList.length === 0 && !kgListLoading ? '从第一份材料开始' : '选择一个知识图谱'}</strong>
                <span>{kgList.length === 0 && !kgListLoading ? '导入 PDF、Word 或 PowerPoint，系统会在这里呈现知识结构。' : '从左侧图库打开学科，查看节点、关系和知识依赖。'}</span>
                <button type="button" onClick={() => setActiveTab(kgList.length === 0 ? 'import' : 'graphs')}>{kgList.length === 0 ? '导入学习材料' : '浏览图库'}</button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
