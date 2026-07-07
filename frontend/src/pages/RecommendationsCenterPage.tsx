import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { recommendationsCenterApi, type RecommendationResource } from '../api/recommendationsCenter'
import { resourcesApi } from '../api/resources'
import VideoGenModal from '../components/VideoGenModal'
import {
  BookIcon, StarIcon, AlertCircleIcon,
} from '../components/Icons'

/* ── Icons ── */
function BackIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}

/* ── Resource type filter config ── */
const TYPE_FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: '全部' },
  { key: 'mind_map', label: '思维导图' },
  { key: 'image_text', label: '图文讲解' },
  { key: 'document', label: '文档' },
  { key: 'exercise', label: '题库' },
  { key: 'video_script', label: '视频脚本' },
  { key: 'video', label: '视频' },
  { key: 'code_case', label: '代码案例' },
]

const TYPE_COLORS: Record<string, string> = {
  mind_map: '#1677E8',
  video: '#BE185D',
  video_script: '#7C3AED',
  document: '#3B82F6',
  exercise: '#10B981',
  code_case: '#F59E0B',
  image_text: '#0EA5E9',
  explanation: '#0EA5E9',
  review_question: '#14B8A6',
  memory_card: '#F97316',
  variation_exercise: '#1677E8',
  knowledge_comic: '#EF4444',
  infographic: '#06B6D4',
  summary_report: '#84CC16',
  flash_card: '#0EA5E9',
}

export default function RecommendationsCenterPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialType = searchParams.get('type') || ''

  const [resources, setResources] = useState<RecommendationResource[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null)

  /* ── Generate modal state ── */
  const [videoGenModal, setVideoGenModal] = useState(false)
  const [mindmapModal, setMindmapModal] = useState(false)
  const [codeGenModal, setCodeGenModal] = useState(false)
  const [documentGenModal, setDocumentGenModal] = useState(false)
  const [imageTextGenModal, setImageTextGenModal] = useState(false)
  const [genKps, setGenKps] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [generating, setGenerating] = useState(false)

  const loadResources = useCallback(async (type?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, any> = { page: 1, page_size: 500 }
      // video_script 和 video 分开查询
      if (type) params.resource_type = type
      const res = await recommendationsCenterApi.getPersonalized(params)
      setResources(res.data.resources)
      setTotal(res.data.total)
    } catch (err: any) {
      console.error('加载推荐资源失败', err)
      setError(err.response?.data?.detail || '加载推荐资源失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadResources(typeFilter)
  }, [typeFilter, loadResources])

  const handleGenerateMindmap = async () => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return
    setGenerating(true)
    try {
      const res = await resourcesApi.generate({
        knowledge_points: kpList,
        title: genTitle || undefined,
      })
      if (res.data.id) {
        setMindmapModal(false)
        setGenKps('')
        setGenTitle('')
        loadResources(typeFilter)
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败，请检查 API 配置')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateCodeCase = async () => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return
    setGenerating(true)
    try {
      const res = await resourcesApi.generate({
        knowledge_points: kpList,
        title: genTitle || undefined,
        resource_type: 'code_case',
      })
      if (res.data.id) {
        setCodeGenModal(false)
        setGenKps('')
        setGenTitle('')
        loadResources(typeFilter)
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败，请检查 API 配置')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateImageText = async () => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return
    setGenerating(true)
    try {
      const res = await resourcesApi.generate({
        knowledge_points: kpList,
        title: genTitle || undefined,
        resource_type: 'image_text',
      })
      if (res.data.id) {
        setImageTextGenModal(false)
        setGenKps('')
        setGenTitle('')
        loadResources(typeFilter)
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败，请检查 API 配置')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateDocument = async () => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return
    setGenerating(true)
    try {
      const res = await resourcesApi.generate({
        knowledge_points: kpList,
        title: genTitle || undefined,
        resource_type: 'document',
      })
      if (res.data.id) {
        setDocumentGenModal(false)
        setGenKps('')
        setGenTitle('')
        loadResources(typeFilter)
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败，请检查 API 配置')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (resourceId: string) => {
    setDeletingId(resourceId)
    try {
      await recommendationsCenterApi.deleteResource(resourceId)
      setResources(prev => prev.filter(r => r.id !== resourceId))
      setTotal(prev => prev - 1)
    } catch (err: any) {
      console.error('delete failed:', err)
      alert('delete failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteGroup = async (kp: string, items: RecommendationResource[]) => {
    if (!confirm(`确定要删除「${kp}」分类下所有 ${items.length} 个资源吗？`)) return
    setDeletingGroup(kp)
    try {
      for (const r of items) {
        await recommendationsCenterApi.deleteResource(r.id)
      }
      setResources(prev => prev.filter(r => !r.knowledge_points.includes(kp) && (kp !== '未分类' || r.knowledge_points.length > 0)))
      setTotal(prev => Math.max(0, prev - items.length))
    } catch (err: any) {
      console.error('delete group failed:', err)
      alert('删除失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDeletingGroup(null)
    }
  }

  const [expandedKps, setExpandedKps] = useState<Set<string>>(new Set())

  // Compute KP groups
  const kpMap: Record<string, RecommendationResource[]> = {}
  for (const r of resources) {
    const kps = r.knowledge_points.length > 0 ? r.knowledge_points : ['未分类']
    for (const kp of kps) {
      if (!kpMap[kp]) kpMap[kp] = []
      kpMap[kp].push(r)
    }
  }
  const kpEntries = Object.entries(kpMap).sort((a, b) => b[1].length - a[1].length)

  // Build rendered JSX for KP groups using createElement (avoids JSX nesting issues)
  const kpElements: JSX.Element[] = []
  for (const [kp, items] of kpEntries) {
    const open = expandedKps.has(kp)
    const itemEls: JSX.Element[] = []
    for (const r of items) {
      itemEls.push(
        React.createElement('div', { key: r.id,
          onClick: () => navigate(`/resources/${r.id}`),
          style: { padding: '10px 12px', borderRadius: 8, border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.15s' },
          onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC' },
          onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.background = '' },
        },
          React.createElement('span', { style: { fontWeight: 500, flex: 1, fontSize: 13, color: '#1E293B' } },
            r.title,
            React.createElement('span', { style: { marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#EEF2FF', color: '#4F46E5' } }, r.resource_type_label)
          ),
          React.createElement('button', {
            onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleDelete(r.id) },
            disabled: deletingId === r.id,
            style: { padding: '4px 8px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#fff', color: '#EF4444', cursor: 'pointer', fontSize: 11, flexShrink: 0 }
          }, '🗑')
        )
      )
    }
    kpElements.push(
      React.createElement('div', { key: kp, style: { borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', overflow: 'hidden' } },
        React.createElement('div', {
          onClick: () => setExpandedKps(prev => { const n = new Set(prev); if (n.has(kp)) n.delete(kp); else n.add(kp); return n }),
          style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#1E293B', borderBottom: open ? '1px solid #F0F0F0' : 'none' }
        },
          React.createElement('span', { style: { display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: 11, color: '#94A3B8' } }, '▶'),
          React.createElement('span', { style: { flex: 1 } }, kp),
          React.createElement('span', { style: { fontSize: 12, color: '#94A3B8', fontWeight: 400 } }, items.length + '个资源'),
          React.createElement('button', {
            onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleDeleteGroup(kp, items) },
            disabled: deletingGroup === kp,
            title: '删除此分类下所有资源',
            style: {
              padding: '4px 8px', borderRadius: 6, border: '1px solid #FEE2E2',
              background: deletingGroup === kp ? '#FEE2E2' : 'transparent',
              color: '#EF4444', cursor: 'pointer', fontSize: 11,
              transition: 'all 0.15s', flexShrink: 0,
            }
          }, deletingGroup === kp ? '删除中...' : '🗑 删除全部')
        ),
        open ? React.createElement('div', { style: { padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 } }, ...itemEls) : null
      )
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg-card-alt)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px', background: '#fff',
        borderBottom: '1px solid #E5E7EB', flexShrink: 0,
      }}>
        <button onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--app-text-secondary)' }}>
          <BackIcon />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            <StarIcon size={16} /> 个性化资源推送中心
          </h1>
          <p style={{ fontSize: 12, color: 'var(--app-text-muted)', margin: '2px 0 0' }}>
            基于你的学习画像推荐，共 {total} 条推荐
          </p>
        </div>
        <button onClick={() => loadResources(typeFilter)} disabled={loading}
          style={{
            padding: '6px 14px', border: '1px solid #D1D5DB', borderRadius: 8,
            background: '#fff', cursor: 'pointer', fontSize: 12,
            color: 'var(--app-text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          刷新
        </button>
      </div>

      {/* Type filter tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 16px',
        background: '#fff', borderBottom: '1px solid #E5E7EB',
        flexShrink: 0, overflowX: 'auto',
      }}>
        {TYPE_FILTERS.map(f => (
          <button key={f.key} onClick={() => { setTypeFilter(f.key); setSearchParams(f.key ? { type: f.key } : {}) }}
            style={{
              padding: '6px 14px', borderRadius: 16, border: 'none',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              cursor: 'pointer', transition: 'all 0.15s',
              background: typeFilter === f.key ? TYPE_COLORS[f.key] || '#1E3A8A' : '#F1F5F9',
              color: typeFilter === f.key ? '#fff' : '#475569',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Generate action bar (visible for video_script / video / mind_map / code_case / document / image_text) */}
        {(typeFilter === 'video_script' || typeFilter === 'video' || typeFilter === 'mind_map' || typeFilter === 'code_case' || typeFilter === 'document' || typeFilter === 'image_text') && (
          <div style={{
            marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center',
            padding: '10px 14px', borderRadius: 10, background: '#F8FAFC',
            border: '1px dashed #CBD5E1',
          }}>
            <span style={{ fontSize: 13, color: '#64748B', flex: 1 }}>
              {typeFilter === 'video' ? '没有找到合适的视频讲解？可以基于知识点自动生成一个'
                : typeFilter === 'video_script' ? '没有找到合适的视频脚本？可先生成视频讲解，脚本会同步生成'
                : typeFilter === 'code_case' ? '没有找到合适的代码案例？可以基于知识点自动生成一个'
                : typeFilter === 'document' ? '没有找到合适的文档？可以基于知识点自动生成一个'
                : typeFilter === 'image_text' ? '没有找到合适的图文讲解？可以基于知识点自动生成一个'
                : '没有找到合适的思维导图？可以基于知识点自动生成一个'}
            </span>
            <button onClick={() => {
              if (typeFilter === 'video' || typeFilter === 'video_script') setVideoGenModal(true)
              else if (typeFilter === 'code_case') setCodeGenModal(true)
              else if (typeFilter === 'document') setDocumentGenModal(true)
              else if (typeFilter === 'image_text') setImageTextGenModal(true)
              else setMindmapModal(true)
            }}
              style={{
                padding: '6px 16px', borderRadius: 8, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                background: typeFilter === 'video' || typeFilter === 'video_script' ? '#EC4899' : typeFilter === 'code_case' ? '#F59E0B' : typeFilter === 'document' ? '#3B82F6' : typeFilter === 'image_text' ? '#0EA5E9' : '#1677E8',
                color: '#fff', display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {typeFilter === 'video' || typeFilter === 'video_script'
                  ? <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>
                  : typeFilter === 'code_case'
                  ? <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>
                  : typeFilter === 'document'
                  ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>
                  : typeFilter === 'image_text'
                  ? <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>
                  : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                }
              </svg>
              {typeFilter === 'video' ? '生成视频讲解' : typeFilter === 'video_script' ? '生成视频讲解（脚本同步生成）' : typeFilter === 'code_case' ? '生成代码案例' : typeFilter === 'document' ? '生成文档' : typeFilter === 'image_text' ? '生成图文讲解' : '生成思维导图'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--app-text-muted)' }}>
            <div style={{ fontSize: 14 }}>加载推荐资源...</div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            textAlign: 'center', padding: 60, color: 'var(--app-danger)',
          }}>
            <AlertCircleIcon size={32} />
            <p style={{ fontSize: 14, marginTop: 8 }}>{error}</p>
            <button onClick={() => loadResources(typeFilter)}
              style={{
                marginTop: 12, padding: '8px 20px', background: 'var(--app-brand)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}>
              重试
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && resources.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--app-text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}><BookIcon size={48} /></div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--app-text-secondary)', marginBottom: 8 }}>
              暂无推荐资源
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
              完成更多练习和对话，系统将为你推荐学习资源
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => navigate('/banks')}
                style={{ padding: '10px 20px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                前往题库
              </button>
              <button onClick={() => navigate('/path')}
                style={{ padding: '10px 20px', background: '#F1F5F9', color: '#475569', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                学习路径
              </button>
            </div>
          </div>
        )}

        {/* Resource cards by KP - 视频脚本使用简洁列表 */}
        {!loading && !error && typeFilter === 'video_script' && resources.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {resources.map(r => (
              <div
                key={r.id}
                onClick={() => navigate(`/resources/${r.id}`)}
                style={{
                  padding: '10px 14px', borderRadius: 8, background: '#fff',
                  border: '1px solid #E5E7EB', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(124,58,237,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>📝</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{r.title}</span>
                {(r.knowledge_points || []).map(kp => (
                  <span key={kp} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#F0F0FF', color: '#7C3AED', whiteSpace: 'nowrap' }}>
                    {kp}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Resource cards by KP - 其他资源使用分组卡片布局 */}
        {!loading && !error && typeFilter !== 'video_script' && kpElements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kpElements}
          </div>
        )}
      </div>

      {/* Image-Text Generation Modal */}
      {imageTextGenModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>生成图文讲解</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  知识点名称
                </label>
                <textarea
                  value={genKps} onChange={e => setGenKps(e.target.value)}
                  placeholder="输入知识点名称，多个用逗号隔开"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  标题（可选）
                </label>
                <input
                  type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)}
                  placeholder="如：二叉树遍历详解"
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setImageTextGenModal(false)} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
                    background: '#fff', color: '#374151', fontSize: '0.8125rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  取消
                </button>
                <button onClick={handleGenerateImageText} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: generating ? '#9CA3AF' : '#0EA5E9', color: '#fff',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {generating ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Generation Modal */}
      {videoGenModal && (
        <VideoGenModal
          onClose={() => setVideoGenModal(false)}
          onDone={(resourceId) => {
            setVideoGenModal(false)
            loadResources('video')
            navigate(`/resources/${resourceId}`)
          }}
        />
      )}

      {/* Mind Map Generation Modal */}
      {mindmapModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>生成思维导图</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  知识点名称
                </label>
                <textarea
                  value={genKps} onChange={e => setGenKps(e.target.value)}
                  placeholder="输入知识点名称，多个用逗号隔开"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  标题（可选）
                </label>
                <input
                  type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)}
                  placeholder="如：Python 核心知识"
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setMindmapModal(false)} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
                    background: '#fff', color: '#374151', fontSize: '0.8125rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  取消
                </button>
                <button onClick={handleGenerateMindmap} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: generating ? '#9CA3AF' : '#1677E8', color: '#fff',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {generating ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Case Generation Modal */}
      {codeGenModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>生成代码案例</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  知识点名称
                </label>
                <textarea
                  value={genKps} onChange={e => setGenKps(e.target.value)}
                  placeholder="输入知识点名称，多个用逗号隔开"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  标题（可选）
                </label>
                <input
                  type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)}
                  placeholder="如：Python 二叉树实现"
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setCodeGenModal(false)} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
                    background: '#fff', color: '#374151', fontSize: '0.8125rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  取消
                </button>
                <button onClick={handleGenerateCodeCase} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: generating ? '#9CA3AF' : '#F59E0B', color: '#fff',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {generating ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Generation Modal */}
      {documentGenModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>生成文档</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  知识点名称
                </label>
                <textarea
                  value={genKps} onChange={e => setGenKps(e.target.value)}
                  placeholder="输入知识点名称，多个用逗号隔开"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#64748B', marginBottom: 4, display: 'block' }}>
                  标题（可选）
                </label>
                <input
                  type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)}
                  placeholder="如：二叉树遍历详解"
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 8, fontSize: '0.875rem', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setDocumentGenModal(false)} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB',
                    background: '#fff', color: '#374151', fontSize: '0.8125rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  取消
                </button>
                <button onClick={handleGenerateDocument} disabled={generating}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: generating ? '#9CA3AF' : '#3B82F6', color: '#fff',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {generating ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
