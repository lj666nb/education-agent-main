import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  recommendationsCenterApi,
  type NotebookResponse,
  type NotebookCategory,
  type NotebookTopic,
} from '../api/recommendationsCenter'
import { resourcesApi } from '../api/resources'
import VideoGenModal from '../components/VideoGenModal'
import {
  NotebookLayout,
  TopCategoryNav,
  ToolbarActions,
  KnowledgeSidebar,
  ResourceArticle,
  ArticleToc,
} from '../components/notebook'
import '../components/notebook/notebook.css'

export default function ResourceNotebookPage() {
  const navigate = useNavigate()

  // ── Data state ──
  const [data, setData] = useState<NotebookResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Selection state ──
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<NotebookTopic | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // ── Delete state ──
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Mobile sidebar ──
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // ── Generate modals ──
  const [videoGenModal, setVideoGenModal] = useState(false)
  const [mindmapModal, setMindmapModal] = useState(false)
  const [codeGenModal, setCodeGenModal] = useState(false)
  const [documentGenModal, setDocumentGenModal] = useState(false)
  const [imageTextGenModal, setImageTextGenModal] = useState(false)
  const [genKps, setGenKps] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [generating, setGenerating] = useState(false)

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await recommendationsCenterApi.getNotebook()
      setData(res.data)

      // Auto-select first category and first topic
      const cats = res.data.categories
      if (cats.length > 0) {
        const firstCat = cats[0]
        setSelectedCategoryId(firstCat.id)
        setExpandedGroups(prev => {
          const next = new Set(prev)
          next.add(firstCat.id)
          return next
        })
        if (firstCat.topics.length > 0) {
          setSelectedTopic(firstCat.topics[0])
        }
      }
    } catch (err: any) {
      console.error('加载推荐笔记失败', err)
      setError(err.response?.data?.detail || '加载推荐资源失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Handlers ──
  const handleSelectCategory = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.add(categoryId)
      return next
    })
    // Select first topic in this category
    if (data) {
      const cat = data.categories.find(c => c.id === categoryId)
      if (cat && cat.topics.length > 0) {
        setSelectedTopic(cat.topics[0])
      }
    }
    setMobileSidebarOpen(false)
  }, [data])

  const handleSelectTopic = useCallback((_categoryId: string, topic: NotebookTopic) => {
    setSelectedTopic(topic)
    setMobileSidebarOpen(false)
  }, [])

  const handleToggleGroup = useCallback((categoryId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  const handleViewDetail = useCallback((id: string) => {
    navigate(`/resources/${id}`)
  }, [navigate])

  const handleDelete = useCallback(async (resourceId: string) => {
    setDeletingId(resourceId)
    try {
      await recommendationsCenterApi.deleteResource(resourceId)
      // Reload data after delete
      await loadData()
    } catch (err: any) {
      console.error('删除失败', err)
      alert('删除失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDeletingId(null)
    }
  }, [loadData])

  // ── Generate handlers (reuse existing modal patterns) ──
  const executeGenerate = useCallback(async (resourceType?: string) => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return
    setGenerating(true)
    try {
      const res = await resourcesApi.generate({
        knowledge_points: kpList,
        title: genTitle || undefined,
        resource_type: resourceType as any,
      })
      if (res.data.id) {
        // Close all modals
        setMindmapModal(false)
        setCodeGenModal(false)
        setImageTextGenModal(false)
        setDocumentGenModal(false)
        setGenKps('')
        setGenTitle('')
        await loadData()
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败，请检查 API 配置')
    } finally {
      setGenerating(false)
    }
  }, [genKps, genTitle, loadData, navigate])

  // ── Gen modal component ──
  const renderGenModal = (title: string, color: string, onConfirm: () => void, onClose: () => void) => (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        backgroundColor: '#1e1f26', borderRadius: 12, padding: 24,
        width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
        color: '#e8e6df',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: '#9ca0aa', marginBottom: 4, display: 'block' }}>
              知识点名称
            </label>
            <textarea
              value={genKps} onChange={e => setGenKps(e.target.value)}
              placeholder="输入知识点名称，多个用逗号隔开"
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 14, outline: 'none',
                resize: 'vertical', fontFamily: 'inherit',
                background: '#2a2b32', color: '#e8e6df',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#9ca0aa', marginBottom: 4, display: 'block' }}>
              标题（可选）
            </label>
            <input
              type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)}
              placeholder="如：二叉树遍历详解"
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 14, outline: 'none',
                background: '#2a2b32', color: '#e8e6df',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} disabled={generating}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#9ca0aa', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              取消
            </button>
            <button onClick={onConfirm} disabled={generating}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: generating ? '#555' : color, color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {generating ? '生成中...' : '开始生成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Render ──
  const categories = data?.categories || []

  return (
    <div className="nb-page">
      {/* Top Navigation */}
      <TopCategoryNav
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      >
        <ToolbarActions
          onRefresh={loadData}
          loading={loading}
          onGenerateVideo={() => setVideoGenModal(true)}
          onGenerateMindmap={() => setMindmapModal(true)}
          onGenerateCodeCase={() => setCodeGenModal(true)}
          onGenerateDocument={() => setDocumentGenModal(true)}
          onGenerateImageText={() => setImageTextGenModal(true)}
        />
      </TopCategoryNav>

      {/* Three-column layout */}
      {loading && (
        <div className="nb-loading">加载推荐资源...</div>
      )}

      {!loading && error && (
        <div className="nb-error">
          <p className="nb-error-msg">{error}</p>
          <button className="nb-error-btn" onClick={loadData}>重试</button>
        </div>
      )}

      {!loading && !error && data && data.categories.length === 0 && (
        <div className="nb-empty" style={{ flex: 1 }}>
          <div className="nb-empty-icon">📖</div>
          <div className="nb-empty-title">暂无推荐资源</div>
          <div className="nb-empty-desc">
            当前还没有生成推荐资源。你可以刷新学习画像，或通过 AI 对话、练习答题来积累学习数据。
          </div>
          <button className="nb-empty-btn" onClick={loadData}>刷新推荐</button>
        </div>
      )}

      {!loading && !error && data && data.categories.length > 0 && (
        <NotebookLayout
          sidebar={
            <KnowledgeSidebar
              categories={categories}
              selectedTopicId={selectedTopic?.id || null}
              expandedGroups={expandedGroups}
              onSelectTopic={handleSelectTopic}
              onToggleGroup={handleToggleGroup}
              isOpen={mobileSidebarOpen}
              onClose={() => setMobileSidebarOpen(false)}
            />
          }
          article={
            <ResourceArticle
              topic={selectedTopic}
              onViewDetail={handleViewDetail}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          }
          toc={
            <ArticleToc topic={selectedTopic} />
          }
        />
      )}

      {/* Generation Modals */}
      {videoGenModal && (
        <VideoGenModal
          onClose={() => setVideoGenModal(false)}
          onDone={(resourceId: string) => {
            setVideoGenModal(false)
            loadData()
            navigate(`/resources/${resourceId}`)
          }}
        />
      )}

      {mindmapModal && renderGenModal('生成思维导图', '#1677E8', () => executeGenerate('mind_map'), () => setMindmapModal(false))}
      {codeGenModal && renderGenModal('生成代码案例', '#F59E0B', () => executeGenerate('code_case'), () => setCodeGenModal(false))}
      {imageTextGenModal && renderGenModal('生成图文讲解', '#0EA5E9', () => executeGenerate('image_text'), () => setImageTextGenModal(false))}
      {documentGenModal && renderGenModal('生成文档', '#3B82F6', () => executeGenerate('document'), () => setDocumentGenModal(false))}
    </div>
  )
}
