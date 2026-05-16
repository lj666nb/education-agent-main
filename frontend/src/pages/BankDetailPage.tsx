import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionBankApi, type BankItem, type QuestionItem, type QuestionType, type DomainItem, type KnowledgePointItem } from '../api/questionBank'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

/* ── 常量映射 ── */
const QTYPE_LABELS: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}

// 清除 AI 回复中的 [[GENERATE]] 标记和 JSON 数据
function cleanAIMessage(content: string): string {
  if (!content) return content
  const idx = content.indexOf('[[GENERATE]]')
  if (idx !== -1) return content.substring(0, idx).trim()
  const lastBracket = content.lastIndexOf('[')
  if (lastBracket > 0) {
    const candidate = content.substring(lastBracket)
    try {
      JSON.parse(candidate)
      return content.substring(0, lastBracket).trim()
    } catch { /* not valid JSON */ }
  }
  return content
}

// 转换 LaTeX 定界符：\( → $, \[ → $$
function preprocessMath(text: string): string {
  if (!text) return text
  return text.replace(/\\\(/g, '$').replace(/\\\)/g, '$').replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
}

// Markdown 渲染组件（支持 LaTeX 公式、GFM 表格等）
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span style={{ display: 'block', marginBottom: '4px', lineHeight: 1.7 }}>{children}</span>,
        ul: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</div>,
        ol: ({ children }) => <div style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</div>,
        li: ({ children }) => <div style={{ marginBottom: '2px', lineHeight: 1.7 }}>• {children}</div>,
        code: ({ children, className }) => {
          if (className) {
            return <code style={{ display: 'block', background: '#1F2937', color: '#E5E7EB', padding: '10px 14px', borderRadius: 8, fontSize: '13px', margin: '8px 0', overflowX: 'auto' }}>{children}</code>
          }
          return <code style={{ background: '#F3F4F6', padding: '1px 4px', borderRadius: 4, fontSize: '13px' }}>{children}</code>
        },
      }}
    >
      {preprocessMath(content)}
    </ReactMarkdown>
  )
}
export default function BankDetailPage() {
  const { bankId } = useParams<{ bankId: string }>()
  const navigate = useNavigate()
  const [bank, setBank] = useState<BankItem | null>(null)
  const [loading, setLoading] = useState(true)

  // 树结构数据
  const [domains, setDomains] = useState<DomainItem[]>([])
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [domainPoints, setDomainPoints] = useState<Record<string, KnowledgePointItem[]>>({})
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null)

  // 题目按知识点分组 { kp_uuid: QuestionItem[] }
  const [pointQuestions, setPointQuestions] = useState<Record<string, QuestionItem[]>>({})
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>([])

  // 单题重生成
  const [regenQuestionId, setRegenQuestionId] = useState<string | null>(null)
  const [regenFeedback, setRegenFeedback] = useState('')
  const [regenLoading, setRegenLoading] = useState(false)

  // 弹窗
  const [showEditor, setShowEditor] = useState(false)
  const [editQuestion, setEditQuestion] = useState<QuestionItem | null>(null)
  const [detailQuestion, setDetailQuestion] = useState<QuestionItem | null>(null)
  const [showAIGen, setShowAIGen] = useState(false)

  // 试卷
  const [activeTab, setActiveTab] = useState<'questions' | 'papers'>('questions')
  const [papers, setPapers] = useState<any[]>([])
  const [papersLoading, setPapersLoading] = useState(false)
  const [showExamCreator, setShowExamCreator] = useState(false)

  // 创建章节/知识点
  const [addingDomain, setAddingDomain] = useState(false)
  const [newDomainName, setNewDomainName] = useState('')
  const [addingPointForDomain, setAddingPointForDomain] = useState<string | null>(null)
  const [newPointName, setNewPointName] = useState('')

  useEffect(() => { if (bankId) { loadAll(); loadPapers() } }, [bankId])

  const loadPapers = async () => {
    if (!bankId) return
    setPapersLoading(true)
    try {
      const res = await questionBankApi.listExamPapers(bankId)
      setPapers(res.data.papers)
    } catch { /* ignore */ }
    setPapersLoading(false)
  }

  const loadAll = async () => {
    if (!bankId) return
    setLoading(true)
    try {
      const bRes = await questionBankApi.getBank(bankId)
      setBank(bRes.data)

      // 加载学科树
      const sRes = await questionBankApi.getSubject(bRes.data.subject_id)
      setDomains(sRes.data.domains || [])

      // 加载所有题目
      const qRes = await questionBankApi.listQuestions(bankId, { page_size: 100 })
      setAllQuestions(qRes.data.questions)
    } catch { navigate('/banks') }
    setLoading(false)
  }

  const loadPoints = async (domainId: string) => {
    if (domainPoints[domainId]) return
    try {
      const res = await questionBankApi.listPoints(domainId)
      setDomainPoints(p => ({ ...p, [domainId]: res.data }))
      // 预加载这些知识点下的题目
      for (const pt of res.data) {
        loadQuestionsForPoint(pt.id)
      }
    } catch { /* ignore */ }
  }

  const loadQuestionsForPoint = (kpId: string) => {
    if (pointQuestions[kpId]) return
    // 从已加载的全部题目中筛选
    const qs = allQuestions.filter(q =>
      q.knowledge_point_uuids?.includes(kpId)
    )
    setPointQuestions(p => ({ ...p, [kpId]: qs }))
  }

  // 当 allQuestions 变化时，重新组织每个知识点的题目
  useEffect(() => {
    const grouped: Record<string, QuestionItem[]> = {}
    for (const q of allQuestions) {
      for (const uuid of (q.knowledge_point_uuids || [])) {
        if (!grouped[uuid]) grouped[uuid] = []
        grouped[uuid].push(q)
      }
    }
    setPointQuestions(grouped)
  }, [allQuestions])

  const handleDelete = async (q: QuestionItem) => {
    if (!confirm('确定删除这道题？')) return
    try {
      await questionBankApi.deleteQuestion(q.id)
      setAllQuestions(prev => prev.filter(x => x.id !== q.id))
    } catch { /* ignore */ }
  }

  const handleRegenerate = async (q: QuestionItem, feedback: string) => {
    if (!feedback.trim()) return
    setRegenLoading(true)
    try {
      const res = await questionBankApi.regenerateQuestion(q.id, feedback.trim())
      const newQ = res.data
      if (!newQ || !newQ.id || !newQ.content) {
        // 后端返回了无效数据，不更新界面（保持原题）
        alert('重生成失败，返回的数据无效')
        setRegenQuestionId(null)
        setRegenFeedback('')
      } else {
        // 替换 allQuestions 中的题目
        setAllQuestions(prev => prev.map(x => x.id === q.id ? newQ : x))
        setRegenQuestionId(null)
        setRegenFeedback('')
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || '重生成失败，请重试')
    }
    setRegenLoading(false)
  }

  const handleCreateDomain = async () => {
    if (!newDomainName.trim() || !bank) return
    try {
      await questionBankApi.createDomain(bank.subject_id, { name: newDomainName.trim() })
      setNewDomainName('')
      setAddingDomain(false)
      // 重新加载学科树
      const sRes = await questionBankApi.getSubject(bank.subject_id)
      setDomains(sRes.data.domains || [])
    } catch { alert('创建章节失败') }
  }

  const handleCreatePoint = async (domainId: string) => {
    if (!newPointName.trim()) return
    try {
      await questionBankApi.createPoint(domainId, { name: newPointName.trim(), difficulty: 1 })
      setNewPointName('')
      setAddingPointForDomain(null)
      // 重新加载该章节的知识点
      const res = await questionBankApi.listPoints(domainId)
      setDomainPoints(p => ({ ...p, [domainId]: res.data }))
    } catch { alert('创建知识点失败') }
  }

  const handleDeleteDomain = async (domainId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除该章节及其所有知识点？')) return
    try {
      await questionBankApi.deleteDomain(domainId)
      if (bank) {
        const sRes = await questionBankApi.getSubject(bank.subject_id)
        setDomains(sRes.data.domains || [])
      }
      setExpandedDomain(null)
    } catch { alert('删除章节失败') }
  }

  const handleDeletePoint = async (pointId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除该知识点？')) return
    try {
      await questionBankApi.deletePoint(pointId)
      setDomainPoints(p => {
        const updated = { ...p }
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].filter(pt => pt.id !== pointId)
        }
        return updated
      })
      setExpandedPoint(null)
    } catch { alert('删除知识点失败') }
  }

  const totalQuestions = allQuestions.length

  if (loading) return <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>加载中...</div>
  if (!bank) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '24px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <span style={{ color: '#1E3A8A', cursor: 'pointer', fontSize: '13px' }} onClick={() => navigate('/banks')}>← 返回题库</span>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1F2937', margin: '8px 0 2px' }}>{bank.name}</h1>
            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{totalQuestions} 道题</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate(`/banks/${bankId}/practice`)}
              style={{ padding: '10px 24px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              ▶ 练习
            </button>
            <button onClick={() => { setEditQuestion(null); setShowEditor(true) }}
              style={{ padding: '10px 24px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              + 新建题目
            </button>
            <button onClick={() => setShowAIGen(true)}
              style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              🤖 AI 生成
            </button>
          </div>
        </div>

        {/* ── Tab 切换 ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#F3F4F6', borderRadius: 12, padding: '4px', maxWidth: 280 }}>
          <button onClick={() => setActiveTab('questions')}
            style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              background: activeTab === 'questions' ? '#fff' : 'transparent', color: activeTab === 'questions' ? '#1E3A8A' : '#6B7280', boxShadow: activeTab === 'questions' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}>
            知识结构
          </button>
          <button onClick={() => setActiveTab('papers')}
            style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              background: activeTab === 'papers' ? '#fff' : 'transparent', color: activeTab === 'papers' ? '#1E3A8A' : '#6B7280', boxShadow: activeTab === 'papers' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}>
            试卷 {papers.length > 0 && `(${papers.length})`}
          </button>
        </div>

        {activeTab === 'questions' ? (
        /* ── 知识树（全宽，缩进层级） ── */
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          {/* 0-缩进：学科名 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937' }}>📚 {bank.name}</span>
          </div>

          {domains.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ color: '#D1D5DB', marginBottom: '16px', fontSize: '14px' }}>暂无章节，请先创建知识结构</div>
              {addingDomain ? (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <input value={newDomainName} onChange={e => setNewDomainName(e.target.value)}
                    placeholder="输入章节名称" onKeyDown={e => e.key === 'Enter' && handleCreateDomain()}
                    style={{ padding: '8px 14px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: '14px', outline: 'none', width: 200 }} />
                  <button onClick={handleCreateDomain} style={{ padding: '8px 16px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>确定</button>
                  <button onClick={() => { setAddingDomain(false); setNewDomainName('') }} style={{ padding: '8px 12px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>取消</button>
                </div>
              ) : (
                <button onClick={() => setAddingDomain(true)} style={{ padding: '8px 20px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>
                  + 创建章节
                </button>
              )}
            </div>
          ) : (
            <div>
              {domains.map(domain => (
                <div key={domain.id}>
                  {/* 1-缩进：领域/章节 */}
                  <div style={{
                    padding: '12px 20px 12px 36px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', borderTop: '1px solid #F9FAFB', background: expandedDomain === domain.id ? '#F9FAFB' : 'transparent',
                  }}>
                    <div onClick={() => {
                      if (expandedDomain === domain.id) { setExpandedDomain(null); setExpandedPoint(null) }
                      else { setExpandedDomain(domain.id); setExpandedPoint(null); loadPoints(domain.id) }
                    }} style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{domain.name}</span>
                      <span style={{ color: '#D1D5DB', fontSize: '11px' }}>{expandedDomain === domain.id ? '▲' : '▼'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button onClick={e => { e.stopPropagation(); setAddingPointForDomain(addingPointForDomain === domain.id ? null : domain.id); setNewPointName('') }}
                        style={{ padding: '2px 10px', fontSize: '11px', background: expandedDomain === domain.id ? 'rgba(30,58,138,0.1)' : 'transparent', color: '#1E3A8A', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                        + 知识点
                      </button>
                      <button onClick={e => handleDeleteDomain(domain.id, e)}
                        style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', color: '#D1D5DB', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}>
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* 知识点 + 题目 */}
                  {expandedDomain === domain.id && (
                    <div>
                      {(!domainPoints[domain.id] || domainPoints[domain.id].length === 0) ? (
                        <div style={{ padding: '8px 20px 8px 52px', color: '#D1D5DB', fontSize: '12px' }}>暂无知识点</div>
                      ) : (
                        domainPoints[domain.id].map(point => (
                          <div key={point.id}>
                            {/* 2-缩进：知识点 */}
                            <div style={{
                              padding: '10px 20px 10px 52px', display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', borderTop: '1px solid #F9FAFB',
                              background: expandedPoint === point.id ? 'rgba(30,58,138,0.04)' : 'transparent',
                            }}>
                              <div onClick={() => setExpandedPoint(expandedPoint === point.id ? null : point.id)}
                                style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', color: '#4B5563' }}>{point.name}</span>
                                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 6, background: ({1:'#ECFDF5',2:'#EFF6FF',3:'#FFFBEB',4:'#FEF2F2',5:'#F5F3FF'})[point.difficulty]||'#F3F4F6', color: ({1:'#059669',2:'#2563EB',3:'#D97706',4:'#DC2626',5:'#7C3AED'})[point.difficulty]||'#6B7280', fontWeight: 600 }}>
                                  {['', '入门', '基础', '进阶', '挑战', '竞赛'][point.difficulty] || point.difficulty}
                                </span>
                                {pointQuestions[point.id]?.length > 0 && (
                                  <span style={{ fontSize: '10px', color: '#6366F1' }}>{pointQuestions[point.id].length} 题</span>
                                )}
                                <span style={{ color: '#D1D5DB', fontSize: '10px' }}>{expandedPoint === point.id ? '▲' : '▼'}</span>
                              </div>
                              <button onClick={e => handleDeletePoint(point.id, e)}
                                style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', color: '#D1D5DB', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                                onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}>
                                ✕
                              </button>
                            </div>

                            {/* 3-缩进：题目列表 */}
                            {expandedPoint === point.id && (
                              <div>
                                {(!pointQuestions[point.id] || pointQuestions[point.id].length === 0) ? (
                                  <div style={{ padding: '8px 20px 8px 72px', color: '#D1D5DB', fontSize: '12px' }}>暂无题目</div>
                                ) : (
                                  pointQuestions[point.id].map(q => (
                                    <div key={q.id} onClick={() => setDetailQuestion(q)}
                                      style={{ padding: '8px 20px 8px 72px', cursor: 'pointer', borderTop: '1px solid #F9FAFB', transition: 'background 0.1s' }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 6, background: 'rgba(30,58,138,0.1)', color: '#1E3A8A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                          {QTYPE_LABELS[q.type] || q.type}
                                        </span>
                                        <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap', background: ({beginner:'#ECFDF5',basic:'#EFF6FF',intermediate:'#FFFBEB',advanced:'#FEF2F2',competition:'#F5F3FF'})[q.difficulty]||'#F3F4F6', color: ({beginner:'#059669',basic:'#2563EB',intermediate:'#D97706',advanced:'#DC2626',competition:'#7C3AED'})[q.difficulty]||'#6B7280' }}>
                                          {({beginner:'入门',basic:'基础',intermediate:'进阶',advanced:'挑战',competition:'竞赛'})[q.difficulty]||q.difficulty}
                                        </span>
                                        {q.tags?.slice(0, 2).map(t => (
                                          <span key={t} style={{ fontSize: '10px', padding: '1px 8px', borderRadius: 6, background: 'rgba(236,72,153,0.08)', color: '#EC4899', fontWeight: 500 }}>#{t}</span>
                                        ))}
                                      </div>
                                      <div style={{ fontSize: '13px', color: '#1F2937', lineHeight: 1.5, overflow: 'hidden' }}>
                                        <MarkdownRenderer content={q.content?.stem || '无题干'} />
                                      </div>
                                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                        {/* 重生成按钮：旋转 SVG */}
                                        <button onClick={e => {
                                          e.stopPropagation()
                                          if (regenQuestionId === q.id) { setRegenQuestionId(null); setRegenFeedback('') }
                                          else setRegenQuestionId(q.id)
                                        }} title="重新生成此题目"
                                          style={{ padding: '2px 8px', fontSize: '11px', background: regenLoading && regenQuestionId === q.id ? '#EEF2FF' : '#FFF7ED', color: '#D97706', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                            style={{ animation: regenLoading && regenQuestionId === q.id ? 'spin 1s linear infinite' : 'none' }}>
                                            <polyline points="23 4 23 10 17 10" />
                                            <polyline points="1 20 1 14 7 14" />
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                          </svg>
                                          {regenLoading && regenQuestionId === q.id ? '...' : ''}
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); setEditQuestion(q); setShowEditor(true) }}
                                          style={{ padding: '2px 10px', fontSize: '11px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer' }}>编辑</button>
                                        <button onClick={e => { e.stopPropagation(); handleDelete(q) }}
                                          style={{ padding: '2px 10px', fontSize: '11px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                                      </div>
                                      {/* 反馈输入区 */}
                                      {regenQuestionId === q.id && (
                                        <div style={{ marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                                          <textarea value={regenFeedback} onChange={e => setRegenFeedback(e.target.value)}
                                            placeholder="指出题目问题，例如：数学符号没有用 LaTeX 渲染（x 应为 $x$，a<b 应为 $a<b$），题目太简单/太难，知识点不准确..."
                                            disabled={regenLoading}
                                            style={{ width: '100%', minHeight: 60, padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: regenLoading ? '#F9FAFB' : '#fff' }} />
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                            <button onClick={() => handleRegenerate(q, regenFeedback)} disabled={regenLoading || !regenFeedback.trim()}
                                              style={{ padding: '6px 14px', fontSize: '12px', background: regenLoading || !regenFeedback.trim() ? '#D1D5DB' : '#D97706', color: '#fff', border: 'none', borderRadius: 6, cursor: regenLoading ? 'wait' : 'pointer', fontWeight: 500 }}>
                                              {regenLoading ? '重生成中...' : '确认重生成'}
                                            </button>
                                            <button onClick={() => { setRegenQuestionId(null); setRegenFeedback('') }}
                                              style={{ padding: '6px 14px', fontSize: '12px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                              取消
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      {/* 知识点创建输入 */}
                      {addingPointForDomain === domain.id && (
                        <div style={{ padding: '8px 20px 8px 52px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input value={newPointName} onChange={e => setNewPointName(e.target.value)}
                            placeholder="输入知识点名称" onKeyDown={e => e.key === 'Enter' && handleCreatePoint(domain.id)}
                            style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: '13px', outline: 'none' }} />
                          <button onClick={() => handleCreatePoint(domain.id)}
                            style={{ padding: '6px 14px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>确定</button>
                          <button onClick={() => { setAddingPointForDomain(null); setNewPointName('') }}
                            style={{ padding: '6px 10px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>取消</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* 添加章节（列表底部） */}
              <div style={{ padding: '12px 20px 12px 36px', borderTop: '1px solid #F9FAFB' }}>
                {addingDomain ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input value={newDomainName} onChange={e => setNewDomainName(e.target.value)}
                      placeholder="输入章节名称" onKeyDown={e => e.key === 'Enter' && handleCreateDomain()}
                      style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: '13px', outline: 'none' }} />
                    <button onClick={handleCreateDomain}
                      style={{ padding: '6px 14px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>确定</button>
                    <button onClick={() => { setAddingDomain(false); setNewDomainName('') }}
                      style={{ padding: '6px 10px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>取消</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingDomain(true)}
                    style={{ padding: '6px 16px', background: 'transparent', color: '#1E3A8A', border: '1.5px dashed #D1D5DB', borderRadius: 8, fontSize: '13px', cursor: 'pointer', width: '100%' }}>
                    + 添加章节
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        ) : (
        /* ── 试卷列表 ── */
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937' }}>📝 试卷</span>
            <button onClick={() => setShowExamCreator(true)}
              style={{ padding: '6px 16px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
              + 新建试卷
            </button>
          </div>
          {papersLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#D1D5DB' }}>加载中...</div>
          ) : papers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#D1D5DB' }}>
              <div style={{ fontSize: '14px', marginBottom: '16px' }}>暂无试卷</div>
              <button onClick={() => setShowExamCreator(true)}
                style={{ padding: '8px 20px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>
                + 创建试卷
              </button>
            </div>
          ) : (
            <div>
              {papers.map((p: any) => (
                <div key={p.id} onClick={() => navigate(`/banks/${bankId}/exam-papers/${p.id}`)} style={{
                  padding: '14px 20px', cursor: 'pointer', borderTop: '1px solid #F9FAFB',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>{p.title}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                      {p.total_questions} 题 · 总分 {p.total_score}
                      {p.time_limit_minutes && ` · ${p.time_limit_minutes} 分钟`}
                      · {p.status === 'draft' ? '草稿' : '已发布'}
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#D1D5DB' }}>{p.generate_method === 'upload' ? '上传' : '手动'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── 创建试卷弹窗 ── */}
      {showExamCreator && bank && (
        <CreateExamPaperModal
          bankId={bankId!}
          onClose={() => setShowExamCreator(false)}
          onCreated={() => { setShowExamCreator(false); loadPapers() }}
        />
      )}

      {/* ── 题目详情弹窗 ── */}
      {detailQuestion && (
        <QuestionDetailModal question={detailQuestion} onClose={() => setDetailQuestion(null)} />
      )}

      {/* ── 题目编辑器弹窗 ── */}
      {showEditor && (
        <QuestionEditorModal
          bankId={bankId!} editQuestion={editQuestion}
          onClose={() => { setShowEditor(false); setEditQuestion(null) }}
          onSaved={() => { setShowEditor(false); setEditQuestion(null); loadAll() }}
        />
      )}

      {/* ── AI 生成题目弹窗 ── */}
      {showAIGen && (
        <AIGenerationModal
          bankId={bankId!}
          bankName={bank?.name || ''}
          onClose={() => setShowAIGen(false)}
          onSaved={() => { setShowAIGen(false); loadAll() }}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   题目详情弹窗（只读，点击题目后展示）
   ════════════════════════════════════════════════ */
function QuestionDetailModal({ question: q, onClose }: { question: QuestionItem; onClose: () => void }) {
  const [showAnswer, setShowAnswer] = useState(false)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: 600, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', padding: '3px 12px', borderRadius: 10, background: 'rgba(30,58,138,0.1)', color: '#1E3A8A', fontWeight: 500 }}>
              {({ single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题', true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题' })[q.type] || q.type}
            </span>
            <span style={{ fontSize: '12px', padding: '3px 12px', borderRadius: 10, background: ({beginner:'#ECFDF5',basic:'#EFF6FF',intermediate:'#FFFBEB',advanced:'#FEF2F2',competition:'#F5F3FF'})[q.difficulty]||'#F3F4F6', color: ({beginner:'#059669',basic:'#2563EB',intermediate:'#D97706',advanced:'#DC2626',competition:'#7C3AED'})[q.difficulty]||'#6B7280', fontWeight: 600 }}>
              {{ beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛' }[q.difficulty] || q.difficulty}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>

        {/* 题干 */}
        <div style={{ fontSize: '16px', lineHeight: 1.8, color: '#1F2937', marginBottom: '20px' }}>
          <MarkdownRenderer content={q.content?.stem} />
        </div>

        {/* 选项 */}
        {q.content?.options && q.content.options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {q.content.options.map(opt => (
              <div key={opt.key} style={{
                display: 'flex', alignItems: 'center', padding: '12px 16px',
                background: '#F9FAFB', borderRadius: 12, border: '1.5px solid transparent',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: q.type === 'multiple_choice' ? 8 : '50%',
                  background: '#E5E7EB', color: '#6B7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 600, marginRight: '12px', flexShrink: 0,
                }}>
                  {opt.key}
                </div>
                <span style={{ fontSize: '15px', color: '#374151' }}><MarkdownRenderer content={opt.text} /></span>
              </div>
            ))}
          </div>
        )}

        {/* 代码模板 */}
        {q.content?.code_template && (
          <pre style={{ background: '#F9FAFB', borderRadius: 12, padding: '16px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '20px' }}>
            {q.content.code_template}
          </pre>
        )}

        {/* 答案与解析 - 默认折叠 */}
        {q.answer && (
          <div style={{ marginBottom: '16px' }}>
            <div onClick={() => setShowAnswer(!showAnswer)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
              background: showAnswer ? '#F0FDF4' : '#F9FAFB',
              border: '1.5px solid', borderColor: showAnswer ? '#10B981' : '#E5E7EB',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: showAnswer ? '#10B981' : '#6B7280' }}>
                {showAnswer ? '📖 答案与解析' : '👀 点击查看答案'}
              </span>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{showAnswer ? '▲' : '▼'}</span>
            </div>
            {showAnswer && (
              <div style={{ background: '#F0FDF4', borderRadius: '0 0 12px 12px', padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#10B981', marginBottom: '8px' }}>
                  答案：<MarkdownRenderer content={q.answer.correct_answer?.join(', ') || '—'} />
                </div>
                {q.answer.explanation && (
                  <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.7 }}><MarkdownRenderer content={q.answer.explanation} /></div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 标签与知识点关联 */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' }}>
          {q.tags?.map(t => (
            <span key={t} style={{ fontSize: '11px', padding: '2px 10px', borderRadius: 6, background: 'rgba(236,72,153,0.08)', color: '#EC4899', fontWeight: 500 }}>#{t}</span>
          ))}
          {q.knowledge_point_uuids?.length > 0 && (
            <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>📎 关联 {q.knowledge_point_uuids.length} 个知识点</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   题目编辑器弹窗
   ════════════════════════════════════════════════ */
const ALL_Q_TYPES: QuestionType[] = ['single_choice', 'multiple_choice', 'fill_blank', 'true_false', 'short_answer', 'programming', 'essay']

function QuestionEditorModal({ bankId, editQuestion, onClose, onSaved }: {
  bankId: string; editQuestion: QuestionItem | null; onClose: () => void; onSaved: () => void
}) {
  const [qType, setQType] = useState<string>(editQuestion?.type || 'single_choice')
  const [stem, setStem] = useState(editQuestion?.content?.stem || '')
  const [options, setOptions] = useState<string>(
    editQuestion?.content?.options?.map((o: any) => `${o.key}. ${o.text}`).join('\n') || ''
  )
  const [correctAnswer, setCorrectAnswer] = useState(editQuestion?.answer?.correct_answer?.join(',') || '')
  const [explanation, setExplanation] = useState(editQuestion?.answer?.explanation || '')
  const [difficulty, setDifficulty] = useState<string>(editQuestion?.difficulty || 'basic')
  const [tags, setTags] = useState(editQuestion?.tags?.join(', ') || '')
  const [kpUuids, setKpUuids] = useState(editQuestion?.knowledge_point_uuids?.join(', ') || '')
  const [codeTemplate, setCodeTemplate] = useState(editQuestion?.content?.code_template || '')
  const [saving, setSaving] = useState(false)

  const buildContent = () => {
    const base: any = { stem }
    if (qType === 'single_choice' || qType === 'multiple_choice') {
      base.options = options.split('\n').filter(Boolean).map((line, i) => {
        const m = line.match(/^([A-Za-z])[.．、]\s*(.*)/)
        return { key: m?.[1] || String.fromCharCode(65 + i), text: m?.[2] || line }
      })
    }
    if (qType === 'programming') base.code_template = codeTemplate
    return base
  }

  const handleSave = async () => {
    if (!stem.trim()) { alert('请输入题干'); return }
    if ((qType === 'single_choice' || qType === 'multiple_choice') && !options.trim()) { alert('请输入选项'); return }
    setSaving(true)
    try {
      const data = {
        type: qType, content: buildContent(),
        answer: { correct_answer: correctAnswer.split(',').map(s => s.trim()).filter(Boolean), explanation },
        difficulty, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        knowledge_point_uuids: kpUuids.split(',').map(s => s.trim()).filter(Boolean),
      }
      if (editQuestion) await questionBankApi.updateQuestion(editQuestion.id, data)
      else await questionBankApi.createQuestion(bankId, data)
      onSaved()
    } catch (err: any) { alert(err.response?.data?.detail || '保存失败') }
    setSaving(false)
  }

  const QTYPE_LABELS: Record<string, string> = {
    single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
    true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: 620, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937', margin: 0 }}>{editQuestion ? '编辑题目' : '新建题目'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 题型 */}
          <div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>题型</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {ALL_Q_TYPES.map(t => (
                <button key={t} onClick={() => { setQType(t); setCorrectAnswer('') }}
                  style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '13px', background: qType === t ? '#1E3A8A' : '#fff', color: qType === t ? '#fff' : '#6B7280', borderColor: qType === t ? '#1E3A8A' : '#E5E7EB' }}>
                  {QTYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          {/* 难度 */}
          <div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>难度</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['beginner', 'basic', 'intermediate', 'advanced', 'competition'].map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  style={{ padding: '6px 18px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '13px', background: difficulty === d ? '#1E3A8A' : '#fff', color: difficulty === d ? '#fff' : '#6B7280', borderColor: difficulty === d ? '#1E3A8A' : '#E5E7EB' }}>
                  {{ beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛' }[d]}
                </button>
              ))}
            </div>
          </div>
          {/* 题干 */}
          <div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>题干</div>
            <textarea value={stem} onChange={e => setStem(e.target.value)} placeholder="输入题目内容..."
              style={{ width: '100%', minHeight: 80, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          {/* 选项 */}
          {(qType === 'single_choice' || qType === 'multiple_choice') && (
            <div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>选项（每行一个，格式 A. xxx）</div>
              <textarea value={options} onChange={e => setOptions(e.target.value)} placeholder="A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四"
                style={{ width: '100%', minHeight: 110, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          )}
          {qType === 'programming' && (
            <div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>代码模板（可选）</div>
              <textarea value={codeTemplate} onChange={e => setCodeTemplate(e.target.value)} placeholder="def solution():&#10;    pass"
                style={{ width: '100%', minHeight: 80, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical' }} />
            </div>
          )}
          {/* 答案 */}
          <div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>
              答案 {qType === 'single_choice' && <span style={{ fontWeight: 400, color: '#9CA3AF' }}>（选项字母）</span>}
              {qType === 'multiple_choice' && <span style={{ fontWeight: 400, color: '#9CA3AF' }}>（字母用逗号分隔）</span>}
              {qType === 'true_false' && <span style={{ fontWeight: 400, color: '#9CA3AF' }}>（对/错）</span>}
            </div>
            {qType === 'true_false' ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                {['对', '错'].map(v => (
                  <button key={v} onClick={() => setCorrectAnswer(v)}
                    style={{ padding: '8px 24px', borderRadius: 10, border: '1.5px solid', cursor: 'pointer', fontSize: '14px', background: correctAnswer === v ? '#1E3A8A' : '#fff', color: correctAnswer === v ? '#fff' : '#6B7280', borderColor: correctAnswer === v ? '#1E3A8A' : '#E5E7EB' }}>
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <input value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} placeholder="输入答案"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            )}
          </div>
          {/* 解析 */}
          <div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>解析（可选）</div>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="解释为什么是这个答案..."
              style={{ width: '100%', minHeight: 60, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          {/* 标签 */}
          <div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>标签（逗号分隔）</div>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="CPU, 流水线, 数据冒险"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
          </div>
          {/* 知识点 UUID */}
          <div>
            <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: 500 }}>
              关联知识点 UUID <span style={{ fontWeight: 400, color: '#9CA3AF' }}>（Neo4j ID，逗号分隔）</span>
            </div>
            <input value={kpUuids} onChange={e => setKpUuids(e.target.value)} placeholder="kp-uuid-1, kp-uuid-2"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '12px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中...' : editQuestion ? '更新题目' : '创建题目'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   AI 生成题目弹窗（交互式出题助手）
   ════════════════════════════════════════════════ */
const QTYPE_NAMES: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}
const DIFF_NAMES: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛',
}

/* ════════════════════════════════════════════════
   创建试卷弹窗（手动配置 + 预览推荐）
   ════════════════════════════════════════════════ */
const ALL_QTYPES = ['single_choice', 'multiple_choice', 'fill_blank', 'true_false', 'short_answer', 'programming', 'essay']
const QTYPE_LABELS_MAP: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}

function CreateExamPaperModal({ bankId, onClose, onCreated }: {
  bankId: string; onClose: () => void; onCreated: () => void
}) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [totalScore, setTotalScore] = useState(100)
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  const [sections, setSections] = useState<any[]>([
    { name: '一、选择题', question_type: 'single_choice', count: 10, score_per_question: 3, domain_ids: [], question_ids: [] },
  ])
  const [suggesting, setSuggesting] = useState(false)
  const [suggestResult, setSuggestResult] = useState<any[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'manual' | 'upload' | 'ai'>('manual')

  // ── upload state ──
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [parseResult, setParseResult] = useState<any>(null)
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([])
  const [genLoading, setGenLoading] = useState(false)

  // ── AI chat state ──
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiSending, setAiSending] = useState(false)
  const [aiCollectedParams, setAiCollectedParams] = useState<Record<string, any>>({})
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<any[]>([])
  const [aiSelectedQuestions, setAiSelectedQuestions] = useState<Set<number>>(new Set())
  const [aiRegenExpanded, setAiRegenExpanded] = useState(false)
  const [aiRegenFeedback, setAiRegenFeedback] = useState('')
  const aiMessagesEndRef = useRef<HTMLDivElement>(null)

  const AI_PRESET_FEEDBACK = [
    { label: '太简单了，加大难度', msg: '这些题目太简单了，请出更有深度和难度的题目，增加区分度' },
    { label: '换一批新题', msg: '请换一批完全不同的新题目，不要和之前的题目重复' },
    { label: '增加证明题', msg: '请增加需要推理和证明的题目，减少概念题' },
    { label: '加深理论深度', msg: '题目深度不够，请考察更深入的理论理解，不要停留在表面' },
    { label: '增加计算量', msg: '请增加需要计算和推导的题目，减少纯概念题' },
  ]

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  const handleAiSend = async () => {
    if (!aiInput.trim() || aiSending) return
    const msg = aiInput.trim()
    setAiInput('')
    setError('')
    setAiMessages(prev => [...prev, { role: 'user', content: msg }])
    setAiSending(true)
    try {
      const history = aiMessages.map(m => ({ role: m.role, content: m.content }))
      const res = await questionBankApi.aiGenerateExamQuestions(bankId, {
        message: msg,
        conversation_history: history,
        collected_params: aiCollectedParams,
      })
      const displayReply = cleanAIMessage(res.data.reply)
      setAiMessages(prev => [...prev, { role: 'assistant', content: displayReply }])
      if (res.data.collected_params) setAiCollectedParams(res.data.collected_params)
      if (res.data.is_complete && res.data.generated_questions?.length > 0) {
        setAiGeneratedQuestions(res.data.generated_questions)
        setAiSelectedQuestions(new Set(res.data.generated_questions.map((_: any, i: number) => i)))
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || '请求失败，请重试'
      setAiMessages(prev => [...prev, { role: 'assistant', content: `出错了：${errMsg}` }])
      setError(errMsg)
    }
    setAiSending(false)
  }

  const handleAiRegen = async (feedback: string) => {
    const feedbackMsg = `请对刚才生成的题目进行点评，分析具体的问题和不足，然后根据以下反馈重新出更好的题目：${feedback}\n\n要求：\n1. 先简要分析之前题目存在的问题（为什么不够好）\n2. 然后重新生成改进后的题目\n3. 新题目必须和之前完全不同，根据反馈意见调整难度`
    setAiMessages(prev => [...prev, { role: 'user', content: feedbackMsg }])
    setAiSending(true)
    setAiRegenExpanded(false)
    setAiRegenFeedback('')
    setError('')
    try {
      const history = aiMessages.map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: feedbackMsg })
      const res = await questionBankApi.aiGenerateExamQuestions(bankId, {
        message: feedbackMsg,
        conversation_history: history.slice(0, -1),
        collected_params: aiCollectedParams,
      })
      const displayReply = cleanAIMessage(res.data.reply)
      setAiMessages(prev => [...prev, { role: 'assistant', content: displayReply }])
      if (res.data.collected_params) setAiCollectedParams(res.data.collected_params)
      if (res.data.is_complete && res.data.generated_questions?.length > 0) {
        setAiGeneratedQuestions(res.data.generated_questions)
        setAiSelectedQuestions(new Set(res.data.generated_questions.map((_: any, i: number) => i)))
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || '请求失败，请重试'
      setAiMessages(prev => [...prev, { role: 'assistant', content: `出错了：${errMsg}` }])
      setError(errMsg)
    }
    setAiSending(false)
  }

  const updateSection = (i: number, field: string, value: any) => {
    setSections((prev: any[]) => prev.map((s: any, idx: number) => idx === i ? { ...s, [field]: value } : s))
  }

  const addSection = () => setSections((prev: any[]) => [...prev, { name: `第${prev.length + 1}部分`, question_type: 'single_choice', count: 5, score_per_question: 5, domain_ids: [], question_ids: [] }])
  const removeSection = (i: number) => setSections((prev: any[]) => prev.filter((_: any, idx: number) => idx !== i))

  const handleSuggest = async () => {
    setSuggesting(true)
    setError('')
    setSuggestResult(null)
    try {
      const res = await questionBankApi.suggestQuestions(bankId, {
        sections: sections.map((s: any) => ({
          name: s.name, question_type: s.question_type, count: s.count,
          score_per_question: s.score_per_question, domain_ids: s.domain_ids,
        })),
      })
      setSuggestResult(res.data.sections)
    } catch { setError('推荐题目失败，请检查题库是否有足够题目') }
    setSuggesting(false)
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('请输入试卷名称'); return }
    if (!suggestResult) { setError('请先点击「预览题目」生成题目'); return }
    const totalQ = suggestResult.reduce((s: number, sec: any) => s + (sec.count || 0), 0)
    if (totalQ === 0) { setError('题库中没有符合条件的题目，请调整配置'); return }
    setSaving(true)
    setError('')
    try {
      const res = await questionBankApi.createExamPaper(bankId, {
        title: title.trim(), total_score: totalScore,
        time_limit_minutes: timeLimit, sections: suggestResult,
      })
      // 创建成功后跳转到试卷详情页
      onCreated()
      setTimeout(() => navigate(`/banks/${bankId}/exam-papers/${res.data.id}`), 100)
    } catch (err: any) { setError(err.response?.data?.detail || '创建失败') }
    setSaving(false)
  }

  // ── upload flow ──
  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setError('')
    try {
      const res = await questionBankApi.parseUpload(bankId, uploadFile)
      setParseResult(res.data)
      if (res.data.suggested_title) setTitle(res.data.suggested_title)
    } catch (err: any) { setError(err.response?.data?.detail || '解析失败') }
    setUploading(false)
  }

  const handleAIGenerate = async () => {
    if (!parseResult) return
    setGenLoading(true)
    setError('')
    try {
      const textContent = parseResult.parsed_sections?.map((s: any) => `${s.name}: ${s.original_text}`).join('\n') || parseResult.full_text
      const res = await questionBankApi.aiGenerateExamQuestions(bankId, {
        message: `根据以下试卷内容生成类似的题目：\n\n${textContent}`,
        conversation_history: [],
        collected_params: {},
      })
      if (res.data.is_complete && res.data.generated_questions?.length > 0) {
        setGeneratedQuestions(res.data.generated_questions)
      } else {
        setAiMessages([{ role: 'assistant', content: res.data.reply }])
        setTab('ai')
      }
    } catch (err: any) { setError(err.response?.data?.detail || 'AI 生成失败') }
    setGenLoading(false)
  }

  const handleSaveFromUpload = async () => {
    if (!title.trim() || generatedQuestions.length === 0) return
    setSaving(true)
    setError('')
    try {
      // 1. 先把 AI 生成的每题保存到题库
      const questionIds: string[] = []
      for (const q of generatedQuestions) {
        try {
          const res = await questionBankApi.createQuestion(bankId, {
            type: q.type || 'short_answer',
            content: q.content || {},
            answer: q.answer || { correct_answer: [], explanation: '' },
            difficulty: q.difficulty || 'basic',
            knowledge_point_uuids: q.knowledge_point_uuids || [],
            tags: q.tags || [],
            status: 'published',
            ai_generated: true,
            source: 'exam_upload',
          })
          questionIds.push(res.data.id)
        } catch { /* skip failed */ }
      }
      if (questionIds.length === 0) {
        setError('题目保存失败，请重试'); setSaving(false); return
      }
      // 2. 创建试卷
      const res = await questionBankApi.createExamPaper(bankId, {
        title: title.trim(), total_score: totalScore,
        time_limit_minutes: timeLimit, generate_method: 'upload',
        sections: [{ name: 'AI 生成题目', question_type: 'mixed', count: questionIds.length, score_per_question: Math.floor(totalScore / questionIds.length), question_ids: questionIds }],
      })
      onCreated()
      setTimeout(() => navigate(`/banks/${bankId}/exam-papers/${res.data.id}`), 100)
    } catch (err: any) { setError(err.response?.data?.detail || '创建失败') }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: 660, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937', margin: 0 }}>新建试卷</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>

        {/* Tab */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F3F4F6', borderRadius: 10, padding: '3px' }}>
          <button onClick={() => setTab('manual')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: 'pointer', background: tab === 'manual' ? '#fff' : 'transparent', color: tab === 'manual' ? '#1E3A8A' : '#6B7280', fontWeight: 500 }}>手动配置</button>
          <button onClick={() => setTab('upload')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: 'pointer', background: tab === 'upload' ? '#fff' : 'transparent', color: tab === 'upload' ? '#1E3A8A' : '#6B7280', fontWeight: 500 }}>上传文件</button>
          <button onClick={() => setTab('ai')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: 'pointer', background: tab === 'ai' ? '#fff' : 'transparent', color: tab === 'ai' ? '#6366F1' : '#6B7280', fontWeight: 500 }}>🤖 AI 出题</button>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: '#EF4444', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        {tab === 'manual' ? (
          <div>
            {/* 基本信息 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>试卷名称</div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="如：计算机组成原理期末考试"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>总分</div>
                <input type="number" value={totalScore} onChange={e => setTotalScore(parseInt(e.target.value) || 100)}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>时间限制（分钟，选填）</div>
                <input type="number" value={timeLimit ?? ''} onChange={e => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              </div>
            </div>

            {/* 题目章节配置 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>题目配置</div>
              {sections.map((s: any, i: number) => (
                <div key={i} style={{ padding: '14px', border: '1.5px solid #E5E7EB', borderRadius: 12, marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={s.name} onChange={e => updateSection(i, 'name', e.target.value)} placeholder="名称"
                      style={{ width: 120, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none' }} />
                    <select value={s.question_type} onChange={e => updateSection(i, 'question_type', e.target.value)}
                      style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none', background: '#fff' }}>
                      {ALL_QTYPES.map(t => <option key={t} value={t}>{QTYPE_LABELS_MAP[t]}</option>)}
                    </select>
                    <input type="number" value={s.count} onChange={e => updateSection(i, 'count', parseInt(e.target.value) || 1)} min={1} placeholder="题数"
                      style={{ width: 60, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none' }} />
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>题</span>
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>每题</span>
                    <input type="number" value={s.score_per_question} onChange={e => updateSection(i, 'score_per_question', parseInt(e.target.value) || 1)} min={1}
                      style={{ width: 50, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none' }} />
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>分</span>
                    {sections.length > 1 && (
                      <button onClick={() => removeSection(i)} style={{ padding: '4px 8px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 6, fontSize: '11px', cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addSection} style={{ padding: '8px', background: 'transparent', color: '#1E3A8A', border: '1.5px dashed #D1D5DB', borderRadius: 8, fontSize: '13px', cursor: 'pointer', width: '100%' }}>+ 添加题目配置</button>
            </div>

            {/* 预览与保存 */}
            {suggestResult ? (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#10B981', marginBottom: '12px' }}>
                  ✅ 已推荐 {suggestResult.reduce((sum: number, s: any) => sum + s.count, 0)} 道题
                  {suggestResult.some((s: any) => s.count > (s.available_count ?? 0)) && (
                    <span style={{ fontWeight: 400, color: '#F59E0B', marginLeft: 8 }}>（部分章节题目不足）</span>
                  )}
                </div>
                {suggestResult.map((sec: any, i: number) => (
                  <div key={i} style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, marginBottom: '8px', fontSize: '13px', color: '#374151' }}>
                    <strong>{sec.name}</strong>（{sec.available_count || sec.count} 题可用，已选 {sec.count} 题）
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: '12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? '创建中...' : '创建试卷'}
                  </button>
                  <button onClick={() => setSuggestResult(null)}
                    style={{ padding: '12px 20px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: '13px', cursor: 'pointer' }}>
                    重新配置
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={handleSuggest} disabled={suggesting || sections.length === 0}
                style={{ width: '100%', padding: '12px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: suggesting ? 'not-allowed' : 'pointer', opacity: suggesting ? 0.6 : 1 }}>
                {suggesting ? '智能匹配中...' : '预览题目'}
              </button>
            )}
          </div>
        ) : tab === 'upload' ? (
          <div>
            {/* Upload tab */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>试卷名称</div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="试卷名称"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            {!parseResult ? (
              <div>
                <div style={{ border: '2px dashed #D1D5DB', borderRadius: 12, padding: '32px', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => document.getElementById('exam-upload-input')?.click()}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                  <div style={{ fontSize: '14px', color: '#6B7280' }}>点击上传 PDF 或 Word 试卷文件</div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>支持 .pdf .docx .doc 格式</div>
                </div>
                <input id="exam-upload-input" type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); handleUpload() } }} />
                {uploading && <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', marginTop: '12px' }}>解析文件中...</div>}
              </div>
            ) : (
              <div>
                <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>✅ 解析完成</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>文件：{parseResult.filename}</div>
                </div>
                {generatedQuestions.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#10B981', marginBottom: '8px' }}>✅ AI 已生成 {generatedQuestions.length} 道类似题目</div>
                    {generatedQuestions.slice(0, 5).map((q, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                        {i + 1}. <MarkdownRenderer content={q.content?.stem || '无题干'} />
                      </div>
                    ))}
                    {generatedQuestions.length > 5 && <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '4px 0' }}>...还有 {generatedQuestions.length - 5} 题</div>}
                    <button onClick={handleSaveFromUpload} disabled={saving}
                      style={{ width: '100%', padding: '12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, marginTop: '12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                      {saving ? '创建中...' : '创建试卷'}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleAIGenerate} disabled={genLoading}
                    style={{ width: '100%', padding: '12px', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: genLoading ? 'not-allowed' : 'pointer', opacity: genLoading ? 0.6 : 1 }}>
                    {genLoading ? 'AI 生成中...' : '🤖 AI 生成类似题目'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* AI 出题 tab */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>试卷名称</div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="试卷名称"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            {aiMessages.length === 0 && !aiGeneratedQuestions.length ? (
              <div>
                <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, marginBottom: '12px', fontSize: '13px', color: '#059669', lineHeight: 1.6 }}>
                  与 AI 出题助手对话，描述你想要的试卷题目。AI 会自动生成与题库不重复的全新题目。
                  <br/>例如："生成 10 道关于 Cache 映射方式的单选题"
                </div>
                <button onClick={async () => {
                  setAiSending(true); setError('')
                  try {
                    const res = await questionBankApi.aiGenerateExamQuestions(bankId, {
                      message: '你好，我想为试卷出题',
                      conversation_history: [], collected_params: {},
                    })
                    setAiMessages([{ role: 'assistant', content: res.data.reply }])
                    if (res.data.collected_params) setAiCollectedParams(res.data.collected_params)
                  } catch (err: any) { setError(err.response?.data?.detail || 'AI 服务暂时不可用') }
                  setAiSending(false)
                }} disabled={aiSending}
                  style={{ width: '100%', padding: '12px', background: aiSending ? '#9CA3AF' : '#6366F1', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: aiSending ? 'not-allowed' : 'pointer', opacity: aiSending ? 0.6 : 1 }}>
                  {aiSending ? '连接中...' : '🤖 开始 AI 出题'}
                </button>
              </div>
            ) : (
              <div>
                {/* AI 对话区域 */}
                <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {aiMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: msg.role === 'user' ? '#6366F1' : '#F3F4F6', color: msg.role === 'user' ? '#fff' : '#1F2937', fontSize: '13px', lineHeight: 1.6, wordBreak: 'break-word' }}>
                        {msg.role === 'user' ? (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                        ) : (
                          <MarkdownRenderer content={cleanAIMessage(msg.content)} />
                        )}
                      </div>
                    </div>
                  ))}
                  {aiSending && <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>系统加载中...</div>}
                  <div ref={aiMessagesEndRef} />
                </div>

                {/* AI 生成题目预览 */}
                {aiGeneratedQuestions.length > 0 && (
                  <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>
                        ✅ 已生成 {aiGeneratedQuestions.length} 道题（已选 {aiSelectedQuestions.size} 道）
                      </span>
                      <button onClick={() => {
                        if (aiSelectedQuestions.size === aiGeneratedQuestions.length) setAiSelectedQuestions(new Set())
                        else setAiSelectedQuestions(new Set(aiGeneratedQuestions.map((_, i) => i)))
                      }} style={{ fontSize: '12px', color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {aiSelectedQuestions.size === aiGeneratedQuestions.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    {aiGeneratedQuestions.map((q, i) => (
                      <div key={i} onClick={() => {
                        setAiSelectedQuestions(prev => {
                          const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
                        })
                      }} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: aiSelectedQuestions.has(i) ? '#F9FAFB' : '#F3F4F6', borderRadius: 8, marginBottom: '4px', cursor: 'pointer', border: '1.5px solid', borderColor: aiSelectedQuestions.has(i) ? '#A5B4FC' : 'transparent', fontSize: '13px', color: '#374151' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid', borderColor: aiSelectedQuestions.has(i) ? '#6366F1' : '#D1D5DB', background: aiSelectedQuestions.has(i) ? '#6366F1' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                          {aiSelectedQuestions.has(i) ? '✓' : ''}
                        </div>
                        <div>{i + 1}. {q.content?.stem || '无题干'}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={async () => {
                        const toSave = aiGeneratedQuestions.filter((_, i) => aiSelectedQuestions.has(i))
                        if (toSave.length === 0) return
                        setSaving(true); setError('')
                        try {
                          const qids: string[] = []
                          for (const q of toSave) {
                            try {
                              const res = await questionBankApi.createQuestion(bankId, {
                                type: q.type || 'short_answer', content: q.content || {},
                                answer: q.answer || { correct_answer: [], explanation: '' },
                                difficulty: q.difficulty || 'basic',
                                knowledge_point_uuids: q.knowledge_point_uuids || [],
                                tags: q.tags || [], status: 'published', ai_generated: true, source: 'exam_ai',
                              })
                              qids.push(res.data.id)
                            } catch { /* skip */ }
                          }
                          if (qids.length === 0) { setError('题目保存失败'); setSaving(false); return }
                          const res = await questionBankApi.createExamPaper(bankId, {
                            title: title.trim() || 'AI 出题试卷', total_score: totalScore,
                            time_limit_minutes: timeLimit, generate_method: 'ai',
                            sections: [{ name: 'AI 生成题目', question_type: 'mixed', count: qids.length, score_per_question: Math.floor(totalScore / qids.length), question_ids: qids }],
                          })
                          onCreated()
                          setTimeout(() => navigate(`/banks/${bankId}/exam-papers/${res.data.id}`), 100)
                        } catch (err: any) { setError(err.response?.data?.detail || '创建失败') }
                        setSaving(false)
                      }} disabled={saving || aiSelectedQuestions.size === 0}
                        style={{ flex: 1, padding: '12px', background: saving || aiSelectedQuestions.size === 0 ? '#D1D5DB' : '#10B981', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, marginTop: '8px', cursor: saving || aiSelectedQuestions.size === 0 ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                        {saving ? '创建中...' : `创建试卷 (${aiSelectedQuestions.size} 题)`}
                      </button>
                      <button onClick={() => setAiRegenExpanded(!aiRegenExpanded)}
                        style={{ padding: '12px 16px', background: aiRegenExpanded ? '#EEF2FF' : '#F3F4F6', color: '#6366F1', border: '1.5px solid', borderColor: aiRegenExpanded ? '#A5B4FC' : 'transparent', borderRadius: 10, fontSize: '13px', marginTop: '8px', cursor: 'pointer', fontWeight: 500 }}>
                        重新生成 ▾
                      </button>
                    </div>

                    {/* ── AI regenerate feedback panel ── */}
                    {aiRegenExpanded && (
                      <div style={{ marginTop: '10px', padding: '14px', background: '#F9FAFB', borderRadius: 12, border: '1.5px solid #E5E7EB' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                          你觉得哪里需要改进？
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {AI_PRESET_FEEDBACK.map(fb => (
                            <button key={fb.label} onClick={() => handleAiRegen(fb.msg)}
                              style={{ padding: '6px 14px', background: '#fff', color: '#6366F1', border: '1.5px solid #C7D2FE', borderRadius: 20, fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#818CF8' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#C7D2FE' }}>
                              {fb.label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input value={aiRegenFeedback} onChange={e => setAiRegenFeedback(e.target.value)}
                            placeholder="输入自定义反馈..." onKeyDown={e => { if (e.key === 'Enter' && aiRegenFeedback.trim() && !aiSending) { handleAiRegen(aiRegenFeedback.trim()) } }}
                            style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: '13px', outline: 'none' }} />
                          <button onClick={() => aiRegenFeedback.trim() && handleAiRegen(aiRegenFeedback.trim())} disabled={aiSending || !aiRegenFeedback.trim()}
                            style={{ padding: '8px 16px', background: aiSending || !aiRegenFeedback.trim() ? '#D1D5DB' : '#6366F1', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: aiSending || !aiRegenFeedback.trim() ? 'not-allowed' : 'pointer' }}>
                            {aiSending ? '生成中...' : '确认'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 输入框 */}
                {aiGeneratedQuestions.length === 0 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && aiInput.trim() && !aiSending) {
                        e.preventDefault(); handleAiSend()
                      }
                    }} placeholder="描述您想要的题目..." disabled={aiSending}
                      style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', background: aiSending ? '#F9FAFB' : '#fff' }} />
                    <button onClick={handleAiSend} disabled={aiSending || !aiInput.trim()}
                      style={{ padding: '10px 20px', background: aiSending || !aiInput.trim() ? '#9CA3AF' : '#6366F1', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: aiSending || !aiInput.trim() ? 'not-allowed' : 'pointer', opacity: aiSending || !aiInput.trim() ? 0.6 : 1 }}>
                      发送
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AIGenerationModal({ bankId, bankName, onClose, onSaved }: {
  bankId: string; bankName: string; onClose: () => void; onSaved: () => void
}) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [collectedParams, setCollectedParams] = useState<Record<string, any>>({})
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [regenerateExpanded, setRegenerateExpanded] = useState(false)
  const [regenerateFeedback, setRegenerateFeedback] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 新题目生成时默认全选
  useEffect(() => {
    if (generatedQuestions.length > 0) {
      setSelectedQuestions(new Set(generatedQuestions.map((_, i) => i)))
    }
  }, [generatedQuestions])

  const toggleQuestion = (index: number) => {
    setSelectedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // 初始化 — 优先恢复已有对话，否则发送问候
  useEffect(() => {
    const initAI = async () => {
      setLoading(true)
      try {
        // 先尝试恢复已有的 AI 对话
        const ctxRes = await questionBankApi.getAIContext(bankId)
        if (ctxRes.data.has_context && ctxRes.data.history.length > 0) {
          setMessages(ctxRes.data.history)
          setCollectedParams(ctxRes.data.collected_params || {})
          setLoading(false)
          return
        }

        // 无已有对话，发送初始问候
        const res = await questionBankApi.aiGenerate(bankId, {
          message: '你好',
          conversation_history: [],
          collected_params: {},
        })
        setMessages([{ role: 'assistant', content: res.data.reply }])
        if (res.data.collected_params) setCollectedParams(res.data.collected_params)
      } catch (err: any) {
        setError(err.response?.data?.detail || '出题服务暂时不可用')
      }
      setLoading(false)
    }
    initAI()
  }, [bankId])

  // 自动滚动到底部
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setError('')

    // 构建历史（不含刚输入的消息）
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    // 只添加用户消息，不显示中间流式内容
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      let streamingError = ''
      await questionBankApi.aiGenerateStream(bankId, {
        message: userMsg,
        conversation_history: history,
        collected_params: collectedParams,
      }, {
        onChunk: () => {
          // 不更新消息，等待完成后一次性显示
        },
        onComplete: (result) => {
          if (result.collected_params) setCollectedParams(result.collected_params)
          const displayContent = cleanAIMessage(result.reply || '')
          const finalContent = displayContent || (
            result.is_complete && result.generated_questions?.length > 0
              ? `✅ 已生成 ${result.generated_questions.length} 道题目，可在下方预览和保存。`
              : ''
          )
          setMessages(prev => [...prev, { role: 'assistant', content: finalContent }])
          if (result.is_complete && result.generated_questions?.length > 0) {
            setGeneratedQuestions(result.generated_questions)
          }
        },
        onError: (errMsg) => {
          streamingError = errMsg
          setError(errMsg)
        },
      })

      if (streamingError) {
        setMessages(prev => [...prev, { role: 'assistant', content: `出错了：${streamingError}` }])
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || '请求失败，请重试'
      setError(errMsg)
      setMessages(prev => [...prev, { role: 'assistant', content: `出错了：${errMsg}` }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleSaveSelected = async () => {
    const toSave = generatedQuestions.filter((_, i) => selectedQuestions.has(i))
    if (toSave.length === 0) return
    setSaving(true)
    let saved = 0
    let failed = 0
    for (const q of toSave) {
      try {
        await questionBankApi.createQuestion(bankId, {
          type: q.type,
          content: q.content || {},
          answer: q.answer || { correct_answer: [], explanation: '' },
          difficulty: q.difficulty || 'basic',
          priority: q.priority || 0,
          knowledge_point_uuids: q.knowledge_point_uuids || [],
          tags: q.tags || [],
          status: 'published',
          source: 'ai_generated',
          ai_generated: true,
        })
        saved++
      } catch {
        failed++
      }
    }
    setSaving(false)
    if (failed === 0) {
      onSaved()
    } else {
      alert(`保存完成：${saved} 题成功，${failed} 题失败`)
      if (saved > 0) onSaved()
    }
  }

  const handleRegenerate = async (feedback: string) => {
    const feedbackMsg = `请对刚才生成的题目进行点评，分析具体的问题和不足，然后根据以下反馈重新出更好的题目：${feedback}\n\n要求：\n1. 先简要分析之前题目存在的问题（为什么不够好）\n2. 然后重新生成改进后的题目\n3. 新题目必须和之前完全不同，根据反馈意见调整难度`

    setMessages(prev => [...prev, { role: 'user', content: feedbackMsg }])
    setLoading(true)
    setRegenerateExpanded(false)
    setRegenerateFeedback('')
    setError('')

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      let streamError = ''
      await questionBankApi.aiGenerateStream(bankId, {
        message: feedbackMsg,
        conversation_history: history,
        collected_params: collectedParams,
      }, {
        onChunk: () => { /* 不显示中间流式内容 */ },
        onComplete: (result) => {
          if (result.collected_params) setCollectedParams(result.collected_params)
          const displayContent = cleanAIMessage(result.reply || '')
          const finalContent = displayContent || (
            result.is_complete && result.generated_questions?.length > 0
              ? `✅ 已生成 ${result.generated_questions.length} 道题目，可在下方预览和保存。`
              : ''
          )
          setMessages(prev => [...prev, { role: 'assistant', content: finalContent }])
          if (result.is_complete && result.generated_questions?.length > 0) {
            setGeneratedQuestions(result.generated_questions)
          }
        },
        onError: (errMsg) => {
          streamError = errMsg
          setError(errMsg)
        },
      })
      if (streamError) {
        setMessages(prev => [...prev, { role: 'assistant', content: `出错了：${streamError}` }])
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || '请求失败，请重试'
      setError(errMsg)
      setMessages(prev => [...prev, { role: 'assistant', content: `出错了：${errMsg}` }])
    }
    setLoading(false)
  }

  const PRESET_FEEDBACK = [
    { label: '太简单了，加大难度', msg: '这些题目太简单了，请出更有深度和难度的题目，增加区分度' },
    { label: '换一批新题', msg: '请换一批完全不同的新题目，不要和之前的题目重复' },
    { label: '增加证明题', msg: '请增加需要推理和证明的题目，减少概念题' },
    { label: '加深理论深度', msg: '题目深度不够，请考察更深入的理论理解，不要停留在表面' },
    { label: '增加计算量', msg: '请增加需要计算和推导的题目，减少纯概念题' },
  ]

  const isComplete = generatedQuestions.length > 0

  // 难度标签颜色
  const DIFF_COLORS: Record<string, string> = {
    beginner: '#059669', basic: '#2563EB', intermediate: '#D97706',
    advanced: '#DC2626', competition: '#7C3AED',
  }
  const DIFF_BG: Record<string, string> = {
    beginner: '#ECFDF5', basic: '#EFF6FF', intermediate: '#FFFBEB',
    advanced: '#FEF2F2', competition: '#F5F3FF',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: 640, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1F2937', margin: 0 }}>🤖 AI 出题助手</h3>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>题库：{bankName}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', minHeight: 300, maxHeight: 400, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 && loading && (
            <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0', fontSize: '14px' }}>
              正在连接出题助手...
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? '#6366F1' : '#F3F4F6',
                color: msg.role === 'user' ? '#fff' : '#1F2937',
                fontSize: '14px',
                lineHeight: 1.7,
                wordBreak: 'break-word',
              }}>
                {msg.role === 'user' ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                ) : (
                  <MarkdownRenderer content={cleanAIMessage(msg.content)} />
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 16px', borderRadius: '16px 16px 16px 4px', background: '#F3F4F6', color: '#9CA3AF', fontSize: '13px' }}>
                系统加载中...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Generated Questions Preview */}
        {isComplete && (
          <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 20px', maxHeight: 300, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>
                ✅ 已生成 {generatedQuestions.length} 道题
                {selectedQuestions.size < generatedQuestions.length && (
                  <span style={{ color: '#6B7280', fontWeight: 400, marginLeft: 6 }}>
                    （已选 {selectedQuestions.size} 道）
                  </span>
                )}
              </span>
              <button onClick={() => {
                if (selectedQuestions.size === generatedQuestions.length) setSelectedQuestions(new Set())
                else setSelectedQuestions(new Set(generatedQuestions.map((_, i) => i)))
              }} style={{ fontSize: '12px', color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {selectedQuestions.size === generatedQuestions.length ? '取消全选' : '全选'}
              </button>
            </div>
            {generatedQuestions.map((q, i) => {
              const stem = q.content?.stem || ''
              return (
                <div key={i} onClick={() => toggleQuestion(i)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', background: selectedQuestions.has(i) ? '#F9FAFB' : '#F3F4F6',
                  borderRadius: 10, marginBottom: '6px', cursor: 'pointer',
                  border: '1.5px solid', borderColor: selectedQuestions.has(i) ? '#A5B4FC' : 'transparent',
                  transition: 'all 0.1s',
                }}>
                  {/* Checkbox */}
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                    border: '2px solid', borderColor: selectedQuestions.has(i) ? '#6366F1' : '#D1D5DB',
                    background: selectedQuestions.has(i) ? '#6366F1' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '11px', fontWeight: 700,
                  }}>
                    {selectedQuestions.has(i) ? '✓' : ''}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      {/* 题型标签 */}
                      <span style={{ padding: '1px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#6366F1', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {QTYPE_NAMES[q.type] || q.type}
                      </span>
                      {/* 难度标签 - 彩色 */}
                      <span style={{ padding: '1px 8px', borderRadius: 6, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: DIFF_BG[q.difficulty] || '#F3F4F6', color: DIFF_COLORS[q.difficulty] || '#6B7280' }}>
                        {DIFF_NAMES[q.difficulty] || q.difficulty}
                      </span>
                      {/* 知识点标签 */}
                      {(q.tags || []).slice(0, 2).map((t: string) => (
                        <span key={t} style={{ padding: '1px 8px', borderRadius: 6, background: 'rgba(236,72,153,0.1)', color: '#EC4899', fontSize: '10px', fontWeight: 500 }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                    <div style={{
                      fontSize: '13px', color: '#374151', lineHeight: 1.6,
                      overflow: 'hidden',
                    }}>
                      <MarkdownRenderer content={stem || '无题干'} />
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button onClick={handleSaveSelected} disabled={saving || selectedQuestions.size === 0}
                style={{ flex: 1, padding: '10px', background: selectedQuestions.size === 0 ? '#D1D5DB' : '#10B981', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: saving || selectedQuestions.size === 0 ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, minWidth: 120 }}>
                {saving ? '保存中...' : `保存选中 (${selectedQuestions.size}/${generatedQuestions.length})`}
              </button>
              <button onClick={() => setRegenerateExpanded(!regenerateExpanded)}
                style={{ padding: '10px 18px', background: regenerateExpanded ? '#EEF2FF' : '#F3F4F6', color: '#6366F1', border: '1.5px solid', borderColor: regenerateExpanded ? '#A5B4FC' : 'transparent', borderRadius: 10, fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                重新生成 ▾
              </button>
              <button onClick={async () => {
                  setGeneratedQuestions([]); setSelectedQuestions(new Set()); setMessages([]); setCollectedParams({}); setError(''); setRegenerateExpanded(false)
                  try { await questionBankApi.clearAIContext(bankId) } catch {}
                  setLoading(true)
                  const res = await questionBankApi.aiGenerate(bankId, {
                    message: '你好', conversation_history: [], collected_params: {},
                  })
                  setMessages([{ role: 'assistant', content: res.data.reply }])
                  setLoading(false)
                }}
                style={{ padding: '10px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: '13px', cursor: 'pointer' }}>
                重新开始
              </button>
            </div>

            {/* ── Regenerate feedback panel ── */}
            {regenerateExpanded && (
              <div style={{ marginTop: '10px', padding: '14px', background: '#F9FAFB', borderRadius: 12, border: '1.5px solid #E5E7EB' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                  你觉得哪里需要改进？
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {PRESET_FEEDBACK.map(fb => (
                    <button key={fb.label} onClick={() => handleRegenerate(fb.msg)}
                      style={{ padding: '6px 14px', background: '#fff', color: '#6366F1', border: '1.5px solid #C7D2FE', borderRadius: 20, fontSize: '12px', cursor: 'pointer', fontWeight: 500, transition: 'all 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.borderColor = '#818CF8' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#C7D2FE' }}>
                      {fb.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={regenerateFeedback} onChange={e => setRegenerateFeedback(e.target.value)}
                    placeholder="输入自定义反馈..." onKeyDown={e => { if (e.key === 'Enter' && regenerateFeedback.trim() && !loading) { handleRegenerate(regenerateFeedback.trim()) } }}
                    style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: '13px', outline: 'none' }} />
                  <button onClick={() => regenerateFeedback.trim() && handleRegenerate(regenerateFeedback.trim())} disabled={loading || !regenerateFeedback.trim()}
                    style={{ padding: '8px 16px', background: loading || !regenerateFeedback.trim() ? '#D1D5DB' : '#6366F1', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: loading || !regenerateFeedback.trim() ? 'not-allowed' : 'pointer' }}>
                    {loading ? '生成中...' : '确认'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        {!isComplete && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px' }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={loading ? '请等待回复...' : '描述您想要的题目...'}
              disabled={loading}
              style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', background: loading ? '#F9FAFB' : '#fff' }} />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              style={{ padding: '10px 20px', background: loading ? '#9CA3AF' : '#6366F1', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.6 : 1 }}>
              发送
            </button>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 24px', background: '#FEF2F2', color: '#EF4444', fontSize: '12px', borderTop: '1px solid #FEE2E2' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
