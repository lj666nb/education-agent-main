import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { resourcesApi } from '../api/resources'
import type { ResourceDetail } from '../api/resources'
import MindmapRenderer from '../components/MindmapRenderer'
import ExercisePlayer from '../components/ExercisePlayer'
import MarkdownRenderer from '../components/MarkdownRenderer'
import CodeEditor from '../components/CodeEditor'
import VideoPlayer from '../components/VideoPlayer'
import { VideoIcon, BookIcon } from '../components/Icons'
import { autoCompleteCode, LANGUAGE_NAMES } from '../utils/codeRunner'
import CodeAgentPanel from '../components/CodeAgentPanel'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/* ── Icons ── */
function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [resource, setResource] = useState<ResourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<'svg' | 'png' | 'pdf' | null>(null)
  const [videoData, setVideoData] = useState<any>(null)

  /* ── Code case state ── */
  const [codeLanguage, setCodeLanguage] = useState('python')
  const [codeOutput, setCodeOutput] = useState<Array<{type: 'stdout'|'stderr'|'system', text: string, exitCode?: number}>>([])
  const [codeRunning, setCodeRunning] = useState(false)

  /* ── Plugin state ── */
  const PLUGIN_STORAGE_KEY = 'code_agent_plugin_installed'
  const [pluginInstalled, setPluginInstalled] = useState(() => {
    return localStorage.getItem(PLUGIN_STORAGE_KEY) === 'true'
  })
  const [showPluginPrompt, setShowPluginPrompt] = useState(false)

  /* ── Derived: error output from last run ── */
  const lastErrorOutput = useRef('')
  const [hasCodeError, setHasCodeError] = useState(false)

  const svgContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)  // for Markdown export capture

  /** Detect programming language from code content */
  const detectCodeLanguage = (content: string): string => {
    const cppPatterns = [/^#include/, /std::/, /using namespace/, /cout\s*<</, /vector\s*</, /->\s*$/, /template\s*</]
    const javaPatterns = [/^import java\./, /public\s+(class|interface)\s/, /extends\s+\w+/, /implements\s+\w+/, /@Override/]
    for (const p of cppPatterns) if (p.test(content)) return 'cpp'
    for (const p of javaPatterns) if (p.test(content)) return 'java'
    return 'python'
  }

  const loadResource = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await resourcesApi.get(id)
      setResource(res.data)
      setEditContent(res.data.content)
      if (res.data.resource_type === 'code_case') {
        setCodeLanguage(detectCodeLanguage(res.data.content))
        setCodeOutput([])
        // Show plugin install prompt on first visit
        if (!pluginInstalled) {
          setShowPluginPrompt(true)
        }
      }

      // 如果是视频类型，加载视频播放数据
      if (res.data.resource_type === 'video') {
        try {
          // 30 秒超时，防止请求卡死页面
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)
          const playRes = await resourcesApi.videoPlay(id, { signal: controller.signal })
          clearTimeout(timeoutId)
          setVideoData(playRes.data.html)
        } catch {
          console.warn('视频数据加载失败')
        }
      }
    } catch (e) {
      console.error('加载资源失败', e)
    } finally {
      setLoading(false)
    }
  }, [id, pluginInstalled])

  useEffect(() => { loadResource() }, [loadResource])

  const handleSave = async () => {
    if (!resource || !id) return
    setSaving(true)
    try {
      const res = await resourcesApi.update(id, { content: editContent })
      setResource(res.data)
      setEditContent(res.data.content)
      setEditing(false)
    } catch (e: any) {
      alert(e.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  /** AI 应用修改后自动保存到数据库 */
  const handleApplyAndSave = useCallback(async (newCode: string) => {
    setEditContent(newCode)
    if (!resource || !id) return
    try {
      await resourcesApi.update(id, { content: newCode })
      setResource(prev => prev ? { ...prev, content: newCode } : prev)
    } catch (e: any) {
      console.warn('自动保存 AI 修改失败，编辑器内容已更新但未持久化:', e.response?.data?.detail || e.message)
    }
  }, [id, resource])

  const handleExportSVG = () => {
    const container = svgContainerRef.current
    if (!container) return
    const svg = container.querySelector('svg')
    if (!svg) return

    setExporting('svg')
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement
      const rect = svg.getBoundingClientRect()
      clone.setAttribute('width', String(Math.round(rect.width)))
      clone.setAttribute('height', String(Math.round(rect.height)))
      if (!clone.getAttribute('viewBox') && rect.width && rect.height) {
        clone.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
      }

      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(clone)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resource?.title || '思维导图'}.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('SVG 导出失败', e)
    } finally {
      setExporting(null)
    }
  }

  const handleExportPNG = async () => {
    setExporting('png')
    try {
      // 优先使用 svgContainerRef（思维导图），其次 contentRef（文档/图文）
      const svgContainer = svgContainerRef.current
      const markdownContainer = contentRef.current
      const svg = svgContainer?.querySelector('svg')

      if (svg) {
        // SVG-based export (mind_map)
        const rect = svg.getBoundingClientRect()
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)

        const clone = svg.cloneNode(true) as SVGSVGElement
        clone.setAttribute('width', String(width))
        clone.setAttribute('height', String(height))
        if (!clone.getAttribute('viewBox') && width && height) {
          clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
        }

        const serializer = new XMLSerializer()
        let svgStr = serializer.serializeToString(clone)
        svgStr = `<?xml version="1.0" encoding="UTF-8"?>${svgStr}`

        const canvas = document.createElement('canvas')
        canvas.width = width * 2
        canvas.height = height * 2
        const ctx = canvas.getContext('2d')
        if (!ctx) { setExporting(null); return }

        ctx.scale(2, 2)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        const img = new Image()
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)

        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height)
          URL.revokeObjectURL(url)
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) { setExporting(null); return }
            const pngUrl = URL.createObjectURL(pngBlob)
            const a = document.createElement('a')
            a.href = pngUrl
            a.download = `${resource?.title || '导出'}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(pngUrl)
            setExporting(null)
          }, 'image/png')
        }
        img.onerror = () => { console.error('PNG 导出失败'); setExporting(null) }
        img.src = url
      } else if (markdownContainer) {
        // Markdown-based export (document/image_text) using html2canvas
        const canvas = await html2canvas(markdownContainer, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        })
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) { setExporting(null); return }
          const pngUrl = URL.createObjectURL(pngBlob)
          const a = document.createElement('a')
          a.href = pngUrl
          a.download = `${resource?.title || '导出'}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(pngUrl)
          setExporting(null)
        }, 'image/png')
      } else {
        setExporting(null)
      }
    } catch (e) {
      console.error('PNG 导出失败', e)
      setExporting(null)
    }
  }

  const handleExportPDF = async () => {
    setExporting('pdf')
    try {
      const svgContainer = svgContainerRef.current
      const markdownContainer = contentRef.current
      const svg = svgContainer?.querySelector('svg')

      let imgData: string
      let width: number
      let height: number

      if (svg) {
        // SVG-based export
        const rect = svg.getBoundingClientRect()
        width = Math.round(rect.width)
        height = Math.round(rect.height)

        const clone = svg.cloneNode(true) as SVGSVGElement
        clone.setAttribute('width', String(width))
        clone.setAttribute('height', String(height))
        if (!clone.getAttribute('viewBox') && width && height) {
          clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
        }

        const serializer = new XMLSerializer()
        let svgStr = serializer.serializeToString(clone)
        svgStr = `<?xml version="1.0" encoding="UTF-8"?>${svgStr}`

        const canvas = document.createElement('canvas')
        canvas.width = width * 2
        canvas.height = height * 2
        const ctx = canvas.getContext('2d')
        if (!ctx) { setExporting(null); return }

        ctx.scale(2, 2)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        imgData = await new Promise((resolve, reject) => {
          const img = new Image()
          const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height)
            URL.revokeObjectURL(url)
            resolve(canvas.toDataURL('image/png'))
          }
          img.onerror = () => reject(new Error('SVG load failed'))
          img.src = url
        })
      } else if (markdownContainer) {
        // Markdown-based export
        const canvas = await html2canvas(markdownContainer, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        })
        width = Math.round(canvas.width / 2)
        height = Math.round(canvas.height / 2)
        imgData = canvas.toDataURL('image/png')
      } else {
        setExporting(null)
        return
      }

      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, width, height)
      pdf.save(`${resource?.title || '导出'}.pdf`)
      setExporting(null)
    } catch (e) {
      console.error('PDF 导出失败', e)
      setExporting(null)
    }
  }

  /* ── Run code for code_case resources ── */
  const handleRunCode = useCallback(async () => {
    if (!resource || codeRunning) return
    setCodeRunning(true)
    setHasCodeError(false)
    setCodeOutput([{ type: 'system', text: `运行 ${LANGUAGE_NAMES[codeLanguage] || codeLanguage} 代码...` }])
    const fullCode = autoCompleteCode(editContent, codeLanguage)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/v1/code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: codeLanguage, code: fullCode }),
      })
      if (!response.ok) {
        const err = await response.text().catch(() => '')
        throw new Error(err ? (JSON.parse(err).detail || err) : `服务器错误 (${response.status})`)
      }
      const result = await response.json()
      const newOutput: typeof codeOutput = []
      let errorText = ''
      if (result.stdout) newOutput.push({ type: 'stdout', text: result.stdout })
      if (result.stderr) {
        newOutput.push({ type: 'stderr', text: result.stderr })
        errorText += result.stderr
      }
      const failed = result.exit_code !== 0
      newOutput.push({
        type: 'system', text: failed ? `✗ 退出代码: ${result.exit_code} (${result.execution_time}s)` : `✓ 运行完成 (${result.execution_time}s)`,
        exitCode: result.exit_code,
      })
      if (!errorText && failed) {
        errorText = `退出代码: ${result.exit_code}`
      }
      setCodeOutput(prev => [...prev.slice(0, -1), ...newOutput])
      if (failed || result.stderr) {
        lastErrorOutput.current = errorText
        setHasCodeError(true)
      }
    } catch (err: any) {
      const errMsg = `运行失败: ${err.message}`
      setCodeOutput(prev => [...prev.slice(0, -1), { type: 'stderr', text: errMsg }])
      lastErrorOutput.current = errMsg
      setHasCodeError(true)
    } finally {
      setCodeRunning(false)
    }
  }, [resource, codeLanguage, editContent, codeRunning])

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <button onClick={() => navigate(-1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <BackIcon /> 返回
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>加载中...</div>
      </div>
    )
  }

  if (!resource) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ color: 'var(--gray-400)', marginBottom: 'var(--space-4)' }}>资源不存在</p>
        <button onClick={() => navigate(-1)} className="btn btn-primary" style={{ border: 'none', cursor: 'pointer' }}>返回</button>
      </div>
    )
  }

  const sourceLabels: Record<string, string> = {
    chat_gap: 'AI对话自动生成',
    wrong_answer: '答题推荐',
    manual: '手动生成',
  }

  return (
    <div style={{ padding: 'var(--space-4) var(--space-8)' }}>
      {/* Navigation */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <BackIcon /> 返回
        </button>
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)', margin: 0 }}>
            {resource.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.8125rem', color: 'var(--gray-400)' }}>
            <span>{sourceLabels[resource.source || ''] || resource.source || '未知来源'}</span>
            <span>·</span>
            <span>{resource.created_at ? new Date(resource.created_at).toLocaleDateString('zh-CN') : ''}</span>
            <span>·</span>
            {(resource.knowledge_points || []).map(kp => (
              <span key={kp} style={{
                fontSize: '0.6875rem', padding: '1px 6px', borderRadius: 10,
                backgroundColor: 'oklch(0.55 0.18 200 / 0.1)', color: 'var(--primary)',
              }}>
                {kp}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {resource.resource_type === 'code_case' ? (
            <>
              {/* Language selector */}
              <select
                value={codeLanguage}
                onChange={e => setCodeLanguage(e.target.value)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: '1px solid #D1D5DB',
                  fontSize: '0.8125rem', background: '#fff', color: '#374151',
                  cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
              {/* Run button */}
              <button
                onClick={handleRunCode}
                disabled={codeRunning}
                style={{
                  padding: '6px 20px', borderRadius: 8, border: 'none',
                  fontSize: '0.8125rem', fontWeight: 600,
                  background: codeRunning ? '#9CA3AF' : '#10B981',
                  color: '#fff', cursor: codeRunning ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {codeRunning ? '运行中...' : '运行'}
              </button>
              {/* Clear output */}
              {codeOutput.length > 0 && (
                <button onClick={() => setCodeOutput([])}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #D1D5DB',
                    fontSize: '0.8125rem', background: '#fff', color: '#6B7280', cursor: 'pointer' }}>
                  清空输出
                </button>
              )}
            </>
          ) : resource.resource_type === 'video_script' ? (
            <span style={{ fontSize: '0.8125rem', padding: '4px 10px', borderRadius: 12, background: '#f0f0ff', color: '#7c3aed' }}>
              📝 视频脚本
            </span>
          ) : resource.resource_type === 'video' ? (
            <span style={{ fontSize: '0.8125rem', padding: '4px 10px', borderRadius: 12, background: '#fef3c7', color: '#d97706' }}>
              <VideoIcon size={12} /> 视频讲解
            </span>
          ) : resource.resource_type === 'image_text' || resource.resource_type === 'document' ? (
            !editing ? (
              <>
                <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <EditIcon /> 编辑
                </button>
                <button className="btn btn-secondary" onClick={handleExportPNG} disabled={exporting === 'png'}>
                  {exporting === 'png' ? '导出中...' : '导出 PNG'}
                </button>
                <button className="btn btn-secondary" onClick={handleExportPDF} disabled={exporting === 'pdf'}>
                  {exporting === 'pdf' ? '导出中...' : '导出 PDF'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setEditing(false); setEditContent(resource.content) }} disabled={saving}>
                  取消
                </button>
              </>
            )
          ) : resource.resource_type === 'exercise' ? null : !editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <EditIcon /> 编辑
              </button>
              <button className="btn btn-secondary" onClick={handleExportSVG} disabled={exporting === 'svg'}>
                {exporting === 'svg' ? '导出中...' : '导出 SVG'}
              </button>
              <button className="btn btn-primary" onClick={handleExportPNG} disabled={exporting === 'png'}>
                {exporting === 'png' ? '导出中...' : '导出 PNG'}
              </button>
              <button className="btn btn-secondary" onClick={handleExportPDF} disabled={exporting === 'pdf'}>
                {exporting === 'pdf' ? '导出中...' : '导出 PDF'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setEditContent(resource.content) }} disabled={saving}>
                取消
              </button>
            </>
          )}
        </div>
      </div>

      {/* Code Case Content */}
      {resource.resource_type === 'code_case' ? (
        <>
          {/* ── Plugin install prompt ── */}
          {showPluginPrompt && (
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: '16px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)',
              border: '1px solid #BAE6FD',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0369A1', marginBottom: 4 }}>
                  🧩 AI 代码助手插件
                </div>
                <div style={{ fontSize: '0.78rem', color: '#0C4A6E', lineHeight: 1.6 }}>
                  安装后可在右侧使用 AI 智能修改代码、自动修复错误、添加注释和优化代码结构。
                  <br />
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    需要已配置阿里云 API（Qwen 模型）
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => {
                    localStorage.setItem(PLUGIN_STORAGE_KEY, 'true')
                    setPluginInstalled(true)
                    setShowPluginPrompt(false)
                  }}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#1677E8', color: '#fff',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  立即安装
                </button>
                <button
                  onClick={() => setShowPluginPrompt(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #BAE6FD',
                    background: 'rgba(255,255,255,0.6)', color: '#0369A1',
                    fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  稍后再说
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 260px)', minHeight: 400 }}>
          {/* Left: Editor + Output */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            {/* Code Editor */}
            <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid #333' }}>
              <CodeEditor
                code={editContent}
                language={codeLanguage === 'cpp' ? 'cpp' : codeLanguage}
                onChange={setEditContent}
              />
            </div>
            {/* Output Panel */}
            <div style={{
              height: '35%', minHeight: 100, maxHeight: '50%',
              borderRadius: 8, border: '1px solid #E5E7EB',
              background: '#1a1a1a', overflowY: 'auto',
              padding: '12px 16px',
              fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
              fontSize: '0.8125rem', lineHeight: 1.6,
            }}>
              {codeOutput.length === 0 ? (
                <div style={{ color: '#555' }}>
                  <span style={{ color: '#2ea043' }}>$</span>{' '}
                  <span style={{ color: '#888' }}>点击"运行"按钮执行代码</span>
                </div>
              ) : (
                codeOutput.map((item, idx) => (
                  <div key={idx} style={{
                    marginBottom: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    color: item.type === 'stdout' ? '#d4d4d4'
                         : item.type === 'stderr' ? '#f48771'
                         : item.exitCode === 0 ? '#2ea043' : '#f48771',
                  }}>
                    {item.text}
                  </div>
                ))
              )}
              {codeRunning && (
                <div style={{ color: '#888', marginTop: 4 }}>
                  <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>●</span> 执行中...
                </div>
              )}
            </div>
          </div>
          {/* Right: AI Code Agent Panel */}
          <CodeAgentPanel
            code={editContent}
            language={codeLanguage}
            onApplyCode={handleApplyAndSave}
            errorOutput={lastErrorOutput.current}
            hasError={hasCodeError}
          />
        </div>
        </>
      ) : resource.resource_type === 'video_script' ? (
        <div style={{
          border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
          overflow: 'auto', padding: 24, background: '#fff',
          minHeight: 200, lineHeight: 1.8, fontSize: '0.9375rem',
        }}>
          <div style={{
            position: 'sticky', top: 0, background: '#fff',
            padding: '0 0 8px', borderBottom: '1px solid #E5E7EB',
            marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            zIndex: 1,
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
              📝 视频脚本
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(resource.content)
                const btn = document.activeElement
                if (btn) {
                  const orig = btn.textContent
                  btn.textContent = '已复制'
                  setTimeout(() => { btn.textContent = orig }, 2000)
                }
              }}
              style={{
                padding: '4px 14px', borderRadius: 6, border: '1px solid #D1D5DB',
                background: '#fff', color: '#374151', fontSize: '0.8125rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制脚本
            </button>
          </div>
          <MarkdownRenderer content={resource.content} />
        </div>
      ) : resource.resource_type === 'video' ? (
        <div>
          {/* 视频播放器 */}
          {videoData ? (
            <VideoPlayer data={videoData} />
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
              <p>视频数据加载中...</p>
            </div>
          )}
        </div>
      ) : resource.resource_type === 'image_text' ? (
        editing ? (
          <div style={{ display: 'flex', gap: 'var(--space-4)', height: 'calc(100vh - 260px)', minHeight: 400 }}>
            <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>编辑 Markdown 内容</div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  flex: 1, width: '100%', padding: 12, border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontFamily: 'monospace',
                  outline: 'none', resize: 'none', lineHeight: 1.6,
                }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>预览</div>
              <div ref={contentRef} style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'auto', padding: 16, background: '#fff' }}>
                <MarkdownRenderer content={editContent} />
              </div>
            </div>
          </div>
        ) : (
          <div ref={contentRef} style={{
            border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
            overflow: 'auto', padding: 24, background: '#fff',
            minHeight: 400, lineHeight: 1.8, fontSize: '0.9375rem',
          }}>
            <MarkdownRenderer content={resource.content} />
          </div>
        )
      ) : resource.resource_type === 'document' ? (
        editing ? (
          <div style={{ display: 'flex', gap: 'var(--space-4)', height: 'calc(100vh - 260px)', minHeight: 400 }}>
            <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>编辑 Markdown 内容</div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  flex: 1, width: '100%', padding: 12, border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontFamily: 'monospace',
                  outline: 'none', resize: 'none', lineHeight: 1.6,
                }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>预览</div>
              <div ref={contentRef} style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'auto', padding: 16, background: '#fff' }}>
                <MarkdownRenderer content={editContent} />
              </div>
            </div>
          </div>
        ) : (
          <div ref={contentRef} style={{
            border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
            overflow: 'auto', padding: 24, background: '#fff',
            minHeight: 400, lineHeight: 1.8, fontSize: '0.9375rem',
          }}>
            <MarkdownRenderer content={resource.content} />
          </div>
        )) : resource.resource_type === 'exercise' ? (
          <ExercisePlayer content={resource.content} />
        ) : editing ? (
        <div style={{ display: 'flex', gap: 'var(--space-4)', height: 'calc(100vh - 260px)', minHeight: 400 }}>
          <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>编辑 Markdown 内容</div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{
                flex: 1, width: '100%', padding: 12, border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontFamily: 'monospace',
                outline: 'none', resize: 'none', lineHeight: 1.6,
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>预览</div>
            <div ref={svgContainerRef} style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <MindmapRenderer content={editContent} height="100%" />
            </div>
          </div>
        </div>
      ) : (
        <div ref={svgContainerRef} style={{
          border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', height: 'calc(100vh - 260px)', minHeight: 400,
          background: '#fff',
        }}>
          <MindmapRenderer content={resource.content} height="100%" />
        </div>
      )}
    </div>
  )
}
