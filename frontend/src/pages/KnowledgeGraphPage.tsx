/**
 * KnowledgeGraphPage — PDF 上传 → 知识图谱抽取
 *
 * 流程：
 *   1. 上传 PDF 文件（拖拽或点击）
 *   2. 后台异步抽取知识图谱（实时进度条）
 *   3. 完成后展示节点/关系统计
 *   4. 引导用户跳转到学习路径生成
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { knowledgeGraphApi, type GraphNode, type GraphEdge } from '../api/knowledgeGraph'
import KnowledgeGraphViz from '../components/KnowledgeGraphViz'
import KgChatPanel from '../components/KgChatPanel'

const API_BASE = '/api/v1'
const BRAND_COLOR = '#1677E8'

type KGInfo = {
  id: string
  name: string
  description: string
  domains: number
  knowledge_points: number
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

type TaskStatus = {
  task_id: string
  status: string  // pending/parsing/extracting/fusing/importing/done/failed
  progress: number
  message: string
  result?: { entities: number; triples: number; prerequisites: number; source: string; subject_id?: string }
}

export default function KnowledgeGraphPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [error, setError] = useState('')
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null)
  const [kgList, setKgList] = useState<KGInfo[]>([])
  const [kgListLoading, setKgListLoading] = useState(true)

  // LLM 可用性检查（知识图谱构建需要 AI）
  const [llmAvailable, setLlmAvailable] = useState(true)

  // 启动时检查 LLM 是否可用
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('access_token')
        const res = await fetch(`${API_BASE}/api-settings/available/models`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setLlmAvailable(data.available?.length > 0)
        }
      } catch { /* 忽略 */ }
    })()
  }, [])

  // 图谱可视化
  const [graphModal, setGraphModal] = useState<{ open: boolean; subjectName: string; subjectId: string; nodes: GraphNode[]; edges: GraphEdge[]; loading: boolean; activeTab: 'graph' | 'chat' }>({
    open: false, subjectName: '', subjectId: '', nodes: [], edges: [], loading: false, activeTab: 'graph',
  })
  const [highlightedNodeNames, setHighlightedNodeNames] = useState<string[]>([])

  // 页面加载时获取已构建的知识图谱列表，并检查是否有未完成任务
  useEffect(() => {
    const fetchKgList = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const res = await fetch(`${API_BASE}/knowledge-graph/list`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setKgList(data.knowledge_graphs || [])
        }
      } catch { /* silent */ }
      finally { setKgListLoading(false) }
    }
    fetchKgList()

    // 恢复上次未完成的任务进度（localStorage 记忆）
    const savedTaskId = localStorage.getItem('kg_active_task_id')
    if (savedTaskId && !taskStatus) {
      const token = localStorage.getItem('access_token')
      fetch(`${API_BASE}/knowledge-graph/status?task_id=${savedTaskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.ok) return res.json()
        localStorage.removeItem('kg_active_task_id')
        return null
      }).then(status => {
        if (status && status.status !== 'done' && status.status !== 'failed') {
          setTaskStatus(status)
          setUploading(true)
          const timer = setInterval(async () => {
            try {
              const statusRes = await fetch(`${API_BASE}/knowledge-graph/status?task_id=${savedTaskId}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (statusRes.ok) {
                const s = await statusRes.json()
                setTaskStatus(s)
                if (s.status === 'done' || s.status === 'failed') {
                  clearInterval(timer)
                  setUploading(false)
                  localStorage.removeItem('kg_active_task_id')
                }
              }
            } catch { /* ignore */ }
          }, 2000)
          setPollTimer(timer)
        } else if (status) {
          setTaskStatus(status)
          localStorage.removeItem('kg_active_task_id')
        }
      }).catch(() => localStorage.removeItem('kg_active_task_id'))
    }
  }, [taskStatus?.status === 'done'])

  const statusLabels: Record<string, string> = {
    pending: '等待处理',
    parsing: '正在解析 PDF...',
    extracting: '正在 LLM 实体抽取...',
    fusing: '正在知识融合...',
    importing: '正在导入数据库...',
    done: '构建完成',
    failed: '构建失败',
  }

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    parsing: '📄',
    extracting: '🤖',
    fusing: '🧬',
    importing: '💾',
    done: '✅',
    failed: '❌',
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('仅支持 PDF 文件')
        return
      }
      setSelectedFile(file)
      setError('')
      setTaskStatus(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError('')

    try {
      const token = localStorage.getItem('access_token')
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`${API_BASE}/knowledge-graph/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || '上传失败')
      }

      const data = await res.json()
      // 保存 task_id 到 localStorage，实现跨页面进度记忆
      localStorage.setItem('kg_active_task_id', data.task_id)

      setTaskStatus({
        task_id: data.task_id,
        status: 'pending',
        progress: 0,
        message: data.message || '已接收文件',
      })

      // Start polling for status
      const timer = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `${API_BASE}/knowledge-graph/status?task_id=${data.task_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (statusRes.ok) {
            const status = await statusRes.json()
            setTaskStatus(status)
            if (status.status === 'done' || status.status === 'failed') {
              clearInterval(timer)
              setUploading(false)
              localStorage.removeItem('kg_active_task_id')
            }
          }
        } catch { /* ignore poll errors */ }
      }, 2000)
      setPollTimer(timer)
    } catch (err: any) {
      setError(err.message || '上传失败，请重试')
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      setSelectedFile(file)
      setError('')
    } else {
      setError('仅支持 PDF 文件')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const isProcessing = taskStatus && !['done', 'failed'].includes(taskStatus.status)

  const openGraphModal = async (kg: KGInfo) => {
    setGraphModal({ open: true, subjectName: kg.name, subjectId: kg.id, nodes: [], edges: [], loading: true, activeTab: 'graph' })
    setHighlightedNodeNames([])
    try {
      const res = await knowledgeGraphApi.getGraphData(kg.id)
      setGraphModal(prev => ({ ...prev, nodes: res.data.nodes, edges: res.data.edges, loading: false }))
    } catch {
      setGraphModal(prev => ({ ...prev, loading: false }))
    }
  }

  const closeGraphModal = () => {
    setGraphModal({ open: false, subjectName: '', subjectId: '', nodes: [], edges: [], loading: false, activeTab: 'graph' })
    setHighlightedNodeNames([])
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      {/* Back button */}
      <button onClick={() => navigate('/')} className="btn btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        <ArrowLeftIcon /> 首页
      </button>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8, color: '#1F2937' }}>
        📚 知识图谱构建
      </h1>
      <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
        上传 PDF 教材，AI 自动提取知识点并构建知识图谱。支持文字版 PDF（扫描版暂不支持）。
      </p>

      {/* Upload area */}
      {!taskStatus || taskStatus.status === 'failed' ? (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${selectedFile ? BRAND_COLOR : '#D1D5DB'}`,
              borderRadius: 16, padding: 48,
              textAlign: 'center', cursor: 'pointer',
              background: selectedFile ? '#F0F9FF' : '#FAFAFA',
              transition: 'all 0.2s', marginBottom: 16,
            }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            {selectedFile ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1F2937' }}>{selectedFile.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              </>
            ) : (
              <>
                <UploadIcon />
                <div style={{ fontSize: 14, color: '#6B7280', marginTop: 12 }}>
                  拖拽 PDF 文件到此处，或点击选择
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                  最大 50MB · 仅支持文字版 PDF
                </div>
              </>
            )}
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: '#FEF2F2',
              border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {!llmAvailable && (
            <div style={{
              padding: '14px 16px', borderRadius: 10, background: '#FFFBEB',
              border: '1px solid #FDE68A', color: '#92400E', fontSize: 13, marginBottom: 16,
              textAlign: 'center', lineHeight: 1.6,
            }}>
              🤖 AI 服务未配置。知识图谱构建需要 AI 能力，请先在
              <span style={{ color: '#1677E8', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => window.open('/settings', '_blank')}> 「设置」</span>
              中配置 DeepSeek 或 Qwen API Key。
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading || !llmAvailable}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: selectedFile && !uploading && llmAvailable ? BRAND_COLOR : '#D1D5DB',
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: selectedFile && !uploading && llmAvailable ? 'pointer' : 'not-allowed',
            }}>
            {uploading ? '⏳ 上传中...' : '🚀 开始构建知识图谱'}
          </button>
        </>
      ) : null}

      {/* Progress display */}
      {taskStatus && (
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB',
          padding: 28, marginTop: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 36 }}>{statusIcons[taskStatus.status] || '🔄'}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1F2937' }}>
                {statusLabels[taskStatus.status] || taskStatus.status}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{taskStatus.message}</div>
            </div>
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${BRAND_COLOR}, #38BDF8)`,
                width: `${Math.round(taskStatus.progress * 100)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          )}
          {isProcessing && (
            <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
              {Math.round(taskStatus.progress * 100)}%
            </div>
          )}

          {/* Result */}
          {taskStatus.status === 'done' && taskStatus.result && (
            <div style={{
              marginTop: 16, padding: 16, borderRadius: 10,
              background: '#F0FDF4', border: '1px solid #BBF7D0',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
                ✅ 知识图谱构建完成
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#166534' }}>
                <span>📊 {taskStatus.result.entities} 个知识点</span>
                <span>🔗 {taskStatus.result.triples} 个关系</span>
                <span>📐 {taskStatus.result.prerequisites} 个前置依赖</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const subjectId = taskStatus.result?.subject_id || ''
                  navigate(`/path${subjectId ? `?subjectId=${subjectId}` : ''}`)
                }}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: BRAND_COLOR, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  }}>
                  🎯 生成学习路径
                </button>
                <button onClick={() => {
                  setSelectedFile(null)
                  setTaskStatus(null)
                  setError('')
                }}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: '1px solid #D1D5DB',
                    background: '#fff', color: '#6B7280', fontSize: 13, cursor: 'pointer',
                  }}>
                  继续上传
                </button>
              </div>
            </div>
          )}

          {/* Failed */}
          {taskStatus.status === 'failed' && (
            <div style={{
              marginTop: 16, padding: 14, borderRadius: 10,
              background: '#FEF2F2', border: '1px solid #FECACA',
            }}>
              <div style={{ fontSize: 13, color: '#991B1B', marginBottom: 8 }}>
                ❌ {taskStatus.message}
              </div>
              <button onClick={() => {
                setTaskStatus(null)
                setError('')
              }}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: '#EF4444', color: '#fff', fontSize: 12, cursor: 'pointer',
                }}>
                重新上传
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ 已构建的知识图谱列表 ═══ */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1F2937', marginBottom: 4 }}>
          📊 已构建的知识图谱
        </h2>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
          上传 PDF 后系统自动提取知识点和关系，构建为知识图谱
        </p>

        {kgListLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', fontSize: 13 }}>加载中...</div>
        ) : kgList.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 32, borderRadius: 12,
            background: '#FAFAFA', border: '1px dashed #D1D5DB',
            color: '#9CA3AF', fontSize: 13,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            暂无知识图谱，上传 PDF 教材开始构建
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {kgList.map(kg => (
              <div key={kg.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderRadius: 12,
                  background: kg.knowledge_points > 0 ? '#F0F9FF' : '#FAFAFA',
                  border: `1px solid ${kg.knowledge_points > 0 ? '#BAE6FD' : '#E5E7EB'}`,
                  cursor: kg.knowledge_points > 0 ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>
                    {kg.knowledge_points > 0 ? '📚' : '📄'}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>
                      {kg.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {kg.knowledge_points > 0 ? (
                        <>{kg.domains} 个领域 · {kg.knowledge_points} 个知识点</>
                      ) : (
                        '暂无知识点'
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {kg.knowledge_points > 0 && (
                    <button onClick={() => navigate(`/path?subjectId=${kg.id}`)}
                      style={{
                        padding: '6px 16px', borderRadius: 8, border: 'none',
                        background: BRAND_COLOR, color: '#fff', fontSize: 12,
                        cursor: 'pointer', fontWeight: 500,
                      }}>
                      🎯 生成学习路径
                    </button>
                  )}
                  <button onClick={() => navigate(`/knowledge-points?subjectId=${kg.id}`)}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
                      background: '#fff', color: '#6B7280', fontSize: 12,
                      cursor: 'pointer',
                    }}>
                    查看知识点 →
                  </button>
                  <button onClick={() => openGraphModal(kg)}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
                      background: kg.knowledge_points > 0 ? '#F0F9FF' : '#fff',
                      color: kg.knowledge_points > 0 ? BRAND_COLOR : '#9CA3AF',
                      fontSize: 12, cursor: kg.knowledge_points > 0 ? 'pointer' : 'not-allowed',
                      fontWeight: 500,
                    }}>
                    🕸️ 可视化图谱
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 知识图谱可视化弹窗 ═══ */}
      {graphModal.open && (
        <div
          onClick={closeGraphModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '90vw', height: '85vh',
              background: '#fff', borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
            {/* 标题栏 + 标签页 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 24px', borderBottom: '1px solid #E5E7EB',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1F2937' }}>
                  🕸️ {graphModal.subjectName}
                </span>
                {/* 标签页切换 */}
                <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', borderRadius: 10, padding: 3 }}>
                  <button
                    onClick={() => setGraphModal(prev => ({ ...prev, activeTab: 'graph' }))}
                    style={{
                      padding: '5px 16px', borderRadius: 8, border: 'none',
                      background: graphModal.activeTab === 'graph' ? '#fff' : 'transparent',
                      color: graphModal.activeTab === 'graph' ? BRAND_COLOR : '#6B7280',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'inherit', boxShadow: graphModal.activeTab === 'graph' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    🕸️ 图谱
                  </button>
                  <button
                    onClick={() => setGraphModal(prev => ({ ...prev, activeTab: 'chat' }))}
                    style={{
                      padding: '5px 16px', borderRadius: 8, border: 'none',
                      background: graphModal.activeTab === 'chat' ? '#fff' : 'transparent',
                      color: graphModal.activeTab === 'chat' ? BRAND_COLOR : '#6B7280',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'inherit', boxShadow: graphModal.activeTab === 'chat' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    💬 AI 问答
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {!graphModal.loading && graphModal.activeTab === 'graph' && (
                  <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                    {graphModal.nodes.length} 个知识点 · {graphModal.edges.length} 条关系
                  </span>
                )}
                <button onClick={closeGraphModal}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: '#F3F4F6', color: '#6B7280', fontSize: 13,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  ✕ 关闭
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {graphModal.activeTab === 'graph' ? (
                <>
                  {graphModal.loading ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: '100%', color: '#9CA3AF', fontSize: 14, gap: 8,
                    }}>
                      <div style={{
                        width: 20, height: 20, border: '2px solid #E5E7EB',
                        borderTopColor: BRAND_COLOR, borderRadius: '50%',
                        animation: 'kg-spin 0.8s linear infinite',
                      }} />
                      加载图谱数据...
                    </div>
                  ) : graphModal.nodes.length === 0 ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: '100%', color: '#9CA3AF', fontSize: 14,
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🕸️</div>
                        暂无图谱数据
                        <div style={{ fontSize: 12, marginTop: 4, color: '#D1D5DB' }}>
                          需要先上传 PDF 构建知识图谱
                        </div>
                      </div>
                    </div>
                  ) : (
                    <KnowledgeGraphViz
                      nodes={graphModal.nodes}
                      edges={graphModal.edges}
                      onNodeClick={(node) => {
                        console.log('Clicked node:', node)
                      }}
                    />
                  )}
                </>
              ) : (
                <KgChatPanel
                  subjectId={graphModal.subjectId}
                  subjectName={graphModal.subjectName}
                  onHighlightNodes={(nodeNames) => {
                    setHighlightedNodeNames(nodeNames)
                  }}
                />
              )}
            </div>
          </div>

          {/* loading spinner keyframes */}
          <style>{`@keyframes kg-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}
