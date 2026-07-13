import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { questionBankApi, type BankItem, type QuestionItem, type QuestionType, type DomainItem, type KnowledgePointItem } from '../api/questionBank'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import { ArrowLeftIcon, PlayIcon, PlusIcon, BookmarkIcon, FileTextIcon, BarChartIcon, BookIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon, AlertTriangleIcon, EditIcon, BookOpenIcon, EyeIcon, BotIcon, CheckCircleIcon, CheckIcon, FileIcon, LinkIcon } from '../components/Icons'
import { QTYPE_LABELS, DIFF_LABELS } from '../constants/labels'

type CuratedPaperTemplate = {
  id: string
  title: string
  difficulty: string
  difficultyColor: string
  description: string
  duration: number
  sources: { name: string; url: string }[]
  sections: { name: string; question_type: string; count: number; score_per_question: number; difficulty?: string | null; domain_ids: string[] }[]
}

const CURATED_PAPERS: CuratedPaperTemplate[] = [
  {
    id: 'starter', title: '入门卷 · 线性结构起步', difficulty: '入门', difficultyColor: '#10B981',
    description: '复杂度、数组、链表、栈和队列的核心概念，适合第一次系统自测。', duration: 30,
    sources: [
      { name: 'OpenDSA 开放课程', url: 'https://opendsa.org/OpenDSA/Books/Everything/html/Intro.html' },
      { name: '安徽工业大学考试大纲', url: 'https://jxjy.ahut.edu.cn/www/doc/jsj2.pdf' },
    ],
    sections: [
      { name: '一、单项选择题', question_type: 'single_choice', count: 10, score_per_question: 6, difficulty: 'beginner', domain_ids: [] },
      { name: '二、判断题', question_type: 'true_false', count: 10, score_per_question: 4, difficulty: 'beginner', domain_ids: [] },
    ],
  },
  {
    id: 'basic', title: '基础卷 · 树与查找', difficulty: '基础', difficultyColor: '#1677E8',
    description: '覆盖树、二叉树、基础查找与常用存储结构，强化课程主干知识。', duration: 40,
    sources: [
      { name: 'OpenDSA 开放课程', url: 'https://opendsa.org/OpenDSA/Books/Everything/html/Intro.html' },
      { name: 'ExamRadar 客观题练习', url: 'https://examradar.com/online-test/data-structure-online-tests/' },
    ],
    sections: [
      { name: '一、单项选择题', question_type: 'single_choice', count: 10, score_per_question: 6, difficulty: 'basic', domain_ids: [] },
      { name: '二、判断题', question_type: 'true_false', count: 10, score_per_question: 4, difficulty: 'basic', domain_ids: [] },
    ],
  },
  {
    id: 'intermediate', title: '进阶卷 · 图与排序', difficulty: '进阶', difficultyColor: '#8B5CF6',
    description: '检验图遍历、最短路径、最小生成树和经典排序算法的适用条件。', duration: 45,
    sources: [
      { name: 'OpenDSA 开放课程', url: 'https://opendsa.org/OpenDSA/Books/Everything/html/Intro.html' },
      { name: 'Sanfoundry 数据结构题库', url: 'https://www.sanfoundry.com/1000-data-structure-questions-answers/' },
    ],
    sections: [
      { name: '一、单项选择题', question_type: 'single_choice', count: 10, score_per_question: 6, difficulty: 'intermediate', domain_ids: [] },
      { name: '二、判断题', question_type: 'true_false', count: 8, score_per_question: 5, difficulty: 'intermediate', domain_ids: [] },
    ],
  },
  {
    id: 'advanced', title: '挑战卷 · 算法分析', difficulty: '挑战', difficultyColor: '#EF4444',
    description: '聚焦复杂度边界、散列冲突、平衡树和算法选择，适合冲刺复习。', duration: 50,
    sources: [
      { name: '江西理工大学考试大纲', url: 'https://yz.jxust.edu.cn/__local/9/68/85/F6D49EA7E2F4BB35E5C4ABC2416_1E70508D_4085A.pdf?e=.pdf' },
      { name: 'OpenDSA 开放课程', url: 'https://opendsa.org/OpenDSA/Books/Everything/html/Intro.html' },
    ],
    sections: [
      { name: '一、挑战单项选择题', question_type: 'single_choice', count: 10, score_per_question: 6, difficulty: 'advanced', domain_ids: [] },
      { name: '二、挑战判断题', question_type: 'true_false', count: 4, score_per_question: 5, difficulty: 'advanced', domain_ids: [] },
      { name: '三、进阶判断题', question_type: 'true_false', count: 4, score_per_question: 5, difficulty: 'intermediate', domain_ids: [] },
    ],
  },
  {
    id: 'comprehensive', title: '综合模拟卷 · 全章检验', difficulty: '综合', difficultyColor: '#F59E0B',
    description: '跨越线性表、树、图、查找和排序，按高校客观题结构进行综合模拟。', duration: 60,
    sources: [
      { name: '安徽工业大学考试大纲', url: 'https://jxjy.ahut.edu.cn/www/doc/jsj2.pdf' },
      { name: '清华大学出版社习题指导', url: 'https://www.tup.tsinghua.edu.cn/bookscenter/book_06155002.html' },
    ],
    sections: [
      { name: '一、单项选择题', question_type: 'single_choice', count: 10, score_per_question: 6, difficulty: null, domain_ids: [] },
      { name: '二、判断题', question_type: 'true_false', count: 10, score_per_question: 4, difficulty: null, domain_ids: [] },
    ],
  },
]

/* ── 常量映射 ── */

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
            return <code style={{ display: 'block', background: 'var(--app-text-heading)', color: 'var(--app-border)', padding: '10px 14px', borderRadius: 8, fontSize: '13px', margin: '8px 0', overflowX: 'auto' }}>{children}</code>
          }
          return <code style={{ background: 'var(--app-bg-page)', padding: '1px 4px', borderRadius: 4, fontSize: '13px' }}>{children}</code>
        },
      }}
    >
      {preprocessMath(content)}
    </ReactMarkdown>
  )
}
export default function BankDetailPage() {
  const { bankId } = useParams<{ bankId: string }>()
  const [searchParams] = useSearchParams()
  const pointParam = searchParams.get('point')
  const tabParam = searchParams.get('tab')
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
  const PAGE_SIZE = 200
  const [totalQuestionsCount, setTotalQuestionsCount] = useState(0)
  const [questionsPage, setQuestionsPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  // 单题重生成
  const [regenQuestionId, setRegenQuestionId] = useState<string | null>(null)
  const [regenFeedback, setRegenFeedback] = useState('')
  const [regenLoading, setRegenLoading] = useState(false)

  // 弹窗
  const [showEditor, setShowEditor] = useState(false)
  const [editQuestion, setEditQuestion] = useState<QuestionItem | null>(null)
  const [detailQuestion, setDetailQuestion] = useState<QuestionItem | null>(null)

  // 试卷
  const [activeTab, setActiveTab] = useState<'questions' | 'papers'>(tabParam === 'papers' ? 'papers' : 'questions')
  const [papers, setPapers] = useState<any[]>([])
  const [papersLoading, setPapersLoading] = useState(false)
  const [showExamCreator, setShowExamCreator] = useState(false)
  const [curatedBusy, setCuratedBusy] = useState('')
  const [curatedMessage, setCuratedMessage] = useState('')

  // 创建章节/知识点
  const [addingDomain, setAddingDomain] = useState(false)
  const [newDomainName, setNewDomainName] = useState('')
  const [addingPointForDomain, setAddingPointForDomain] = useState<string | null>(null)
  const [newPointName, setNewPointName] = useState('')

  // LLM 可用性检查（AI 出题功能）
  const [llmAvailable, setLlmAvailable] = useState(false)

  useEffect(() => { if (bankId) { loadAll(); loadPapers() } }, [bankId])

  // 启动时检查 LLM 是否可用
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/api-settings/available/models', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        })
        if (res.ok) {
          const data = await res.json()
          setLlmAvailable(data.available?.length > 0)
        }
      } catch { /* 忽略 */ }
    })()
  }, [])

  const loadPapers = async () => {
    if (!bankId) return
    setPapersLoading(true)
    try {
      const res = await questionBankApi.listExamPapers(bankId)
      setPapers(res.data.papers)
    } catch { /* ignore */ }
    setPapersLoading(false)
  }

  const downloadPaperFile = (data: BlobPart, title: string, format: 'pdf' | 'word') => {
    const extension = format === 'pdf' ? 'pdf' : 'docx'
    const mime = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const blob = new Blob([data], { type: mime })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${title}.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  }

  const handleCuratedPaper = async (template: CuratedPaperTemplate, action: 'pdf' | 'word' | 'start') => {
    if (!bankId || curatedBusy) return
    setCuratedBusy(`${template.id}-${action}`)
    setCuratedMessage('')
    try {
      let paper = papers.find((item: any) => item.title === template.title)
      if (!paper) {
        setCuratedMessage(`正在从题库编排《${template.title}》…`)
        const suggested = await questionBankApi.suggestQuestions(bankId, {
          sections: template.sections,
          deterministic: true,
          seed_only: true,
        })
        if (!suggested.data.total_questions) throw new Error('当前题库没有可用于组卷的选择题或判断题')
        const sourceText = template.sources.map(source => source.name).join('、')
        const totalScore = suggested.data.sections.reduce(
          (sum: number, section: any) => sum + Number(section.count || 0) * Number(section.score_per_question || 0), 0,
        )
        const created = await questionBankApi.createExamPaper(bankId, {
          title: template.title,
          description: `${template.description} 结构参考：${sourceText}。题目从当前数据结构客观题库抽取。`,
          total_score: totalScore || 100,
          time_limit_minutes: template.duration,
          generate_method: 'curated',
          sections: suggested.data.sections,
        })
        paper = created.data
        await loadPapers()
      }

      if (action === 'start') {
        const started = await questionBankApi.startExamPractice(paper.id)
        navigate(started.data.practice_url)
        return
      }

      setCuratedMessage(`正在导出《${template.title}》…`)
      if (action === 'pdf') {
        const exported = await questionBankApi.exportExamPDF(paper.id)
        downloadPaperFile(exported.data, template.title, 'pdf')
      } else {
        const exported = await questionBankApi.exportExamWord(paper.id)
        downloadPaperFile(exported.data, template.title, 'word')
      }
      setCuratedMessage(`《${template.title}》已下载，并已加入下方“我的试卷”`)
    } catch (err: any) {
      setCuratedMessage(err.response?.data?.detail || err.message || '试卷生成失败，请稍后重试')
    } finally {
      setCuratedBusy('')
    }
  }

  const loadAll = async () => {
    if (!bankId) return
    setLoading(true)
    try {
      const bRes = await questionBankApi.getBank(bankId)
      setBank(bRes.data)

      // 加载学科树
      const sRes = await questionBankApi.getSubject(bRes.data.subject_id)
      const domainsList = sRes.data.domains || []
      setDomains(domainsList)

      // 预加载所有章节的知识点（各章题目数用）
      const allKps: Record<string, KnowledgePointItem[]> = {}
      for (const domain of domainsList) {
        try {
          const pRes = await questionBankApi.listPoints(domain.id)
          allKps[domain.id] = pRes.data
        } catch { /* ignore */ }
      }
      setDomainPoints(allKps)

      // 加载题目（分页，仅已发布的题目）
      const qRes = await questionBankApi.listQuestions(bankId, { page_size: PAGE_SIZE, page: 1, status: 'published' })
      setAllQuestions(qRes.data.questions)
      setTotalQuestionsCount(qRes.data.total)
      setQuestionsPage(1)
    } catch { navigate('/banks') }
    setLoading(false)
  }

  // 计算每章的题目数
  const getDomainQuestionCount = useCallback((domainId: string): number => {
    const points = domainPoints[domainId]
    if (!points) return 0
    return points.reduce((sum, p) => sum + (pointQuestions[p.id]?.length || 0), 0)
  }, [domainPoints, pointQuestions])

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

  const totalQuestions = totalQuestionsCount || allQuestions.length

  // 加载更多题目
  const handleLoadMore = async () => {
    if (!bankId || loadingMore) return
    const nextPage = questionsPage + 1
    setLoadingMore(true)
    try {
      const qRes = await questionBankApi.listQuestions(bankId, { page_size: PAGE_SIZE, page: nextPage, status: 'published' })
      setAllQuestions(prev => [...prev, ...qRes.data.questions])
      setQuestionsPage(nextPage)
    } catch { /* ignore */ }
    setLoadingMore(false)
  }

  const hasMore = totalQuestionsCount > allQuestions.length

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--app-text-muted)' }}>加载中...</div>
  if (!bank) return null

  // 代码题库直接跳转到编程练习界面
  if (bank.tags?.includes('编程题')) {
    navigate('/coding-practice', { replace: true })
    return null
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .curated-paper-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .curated-paper-card { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .curated-paper-card:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(30,58,138,.10); border-color: #BFDBFE !important; }
        @media (max-width: 720px) { .curated-paper-grid { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <span style={{ color: 'var(--app-brand)', cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('/banks')}><ArrowLeftIcon size={14} color="#1E3A8A" /> 返回题库</span>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--app-text-heading)', margin: '8px 0 2px' }}>{bank.name}</h1>
            <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>{totalQuestions} 道题</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate(`/banks/${bankId}/practice${pointParam ? `?point=${pointParam}` : ''}`)}
              style={{
                padding: '10px 22px', background: 'linear-gradient(135deg, #10B981, #34D399)',
                color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px',
                boxShadow: '0 3px 12px rgba(16, 185, 129, 0.28)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.38)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(16, 185, 129, 0.28)'; }}
            >
              <PlayIcon size={15} color="#fff" /> 开始练习
            </button>
            <button onClick={() => { setEditQuestion(null); setShowEditor(true) }}
              style={{
                padding: '10px 22px', background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px',
                boxShadow: '0 3px 12px rgba(59, 130, 246, 0.28)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(59, 130, 246, 0.38)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(59, 130, 246, 0.28)'; }}
            >
              <PlusIcon size={15} color="#fff" /> 新建题目
            </button>
          </div>
        </div>

        {/* ── Navigation Cards ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(`/banks/${bankId}/history`)}
            style={{ padding: '10px 20px', background: '#EFF6FF', color: 'var(--app-brand)', border: 'none', borderRadius: 12, fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileTextIcon size={14} color="#1E3A8A" /> 测试历史
          </button>
          <button onClick={() => navigate(`/banks/${bankId}/stats`)}
            style={{ padding: '10px 20px', background: '#F0FDF4', color: 'var(--app-success)', border: 'none', borderRadius: 12, fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChartIcon size={14} color="#10B981" /> 练习统计
          </button>
        </div>

        {/* ── Tab 切换 ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--app-bg-page)', borderRadius: 12, padding: '4px', maxWidth: 280 }}>
          <button onClick={() => setActiveTab('questions')}
            style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              background: activeTab === 'questions' ? '#fff' : 'transparent', color: activeTab === 'questions' ? 'var(--app-brand)' : 'var(--app-text-secondary)', boxShadow: activeTab === 'questions' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}>
            知识结构
          </button>
          <button onClick={() => setActiveTab('papers')}
            style={{ flex: 1, padding: '8px 16px', borderRadius: 10, border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              background: activeTab === 'papers' ? '#fff' : 'transparent', color: activeTab === 'papers' ? 'var(--app-brand)' : 'var(--app-text-secondary)', boxShadow: activeTab === 'papers' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}>
            试卷 {papers.length > 0 && `(${papers.length})`}
          </button>
        </div>

        {activeTab === 'questions' ? (
        /* ── 知识树（全宽，缩进层级） ── */
        <div className="card-hover" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          {/* 0-缩进：学科名 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--app-text-heading)' }}><BookIcon size={18} color="#1F2937" /> {bank.name}</span>
          </div>

          {domains.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--app-text-placeholder)', marginBottom: '16px', fontSize: '14px' }}>暂无章节，请先创建知识结构</div>
              {addingDomain ? (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <input value={newDomainName} onChange={e => setNewDomainName(e.target.value)}
                    placeholder="输入章节名称" onKeyDown={e => e.key === 'Enter' && handleCreateDomain()}
                    style={{ padding: '8px 14px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: '14px', outline: 'none', width: 200 }} />
                  <button onClick={handleCreateDomain} style={{ padding: '8px 16px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>确定</button>
                  <button onClick={() => { setAddingDomain(false); setNewDomainName('') }} style={{ padding: '8px 12px', background: 'var(--app-bg-page)', color: 'var(--app-text-secondary)', border: 'none', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>取消</button>
                </div>
              ) : (
                <button onClick={() => setAddingDomain(true)} style={{ padding: '8px 20px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', cursor: 'pointer' }}>
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
                    padding: '14px 20px 14px 36px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', borderTop: '1px solid #F9FAFB', borderLeft: '3px solid transparent',
                    background: expandedDomain === domain.id ? 'var(--app-bg-card-alt)' : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderLeftColor = 'var(--app-primary)'; e.currentTarget.style.background = expandedDomain === domain.id ? 'var(--app-bg-card-alt)' : 'var(--app-bg-page)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderLeftColor = 'transparent'; e.currentTarget.style.background = expandedDomain === domain.id ? 'var(--app-bg-card-alt)' : 'transparent' }}
                  >
                    <div onClick={() => {
                      if (expandedDomain === domain.id) { setExpandedDomain(null); setExpandedPoint(null) }
                      else { setExpandedDomain(domain.id); setExpandedPoint(null); loadPoints(domain.id) }
                    }} style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: 'var(--app-brand-bg)', color: 'var(--app-brand)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {domain.name.charAt(0)}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)' }}>{domain.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-brand)', background: 'rgba(30,58,138,0.08)', padding: '2px 8px', borderRadius: 10 }}>
                        {getDomainQuestionCount(domain.id)} 题
                      </span>
                      {/* Progress bar */}
                      <div style={{ flex: '0 0 60px', height: 4, borderRadius: 2, background: '#F3F4F6', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, getDomainQuestionCount(domain.id) * 5)}%`, borderRadius: 2, background: 'linear-gradient(90deg, var(--app-brand), #7DD3FC)' }} />
                      </div>
                      <span style={{ color: 'var(--app-text-placeholder)', fontSize: '11px', flexShrink: 0 }}>{expandedDomain === domain.id ? <ChevronUpIcon size={12} color="#D1D5DB" /> : <ChevronDownIcon size={12} color="#D1D5DB" />}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      {/* Quick practice button */}
                      <span onClick={e => { e.stopPropagation(); navigate(`/banks/${bankId}/practice?domain_ids=${encodeURIComponent(domain.id)}&domain_name=${encodeURIComponent(domain.name)}`) }}
                        style={{ padding: '3px 10px', fontSize: '11px', background: '#ECFDF5', color: 'var(--app-success)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <PlayIcon size={10} color="#10B981" /> 专项刷题
                      </span>
                      <button onClick={e => { e.stopPropagation(); setAddingPointForDomain(addingPointForDomain === domain.id ? null : domain.id); setNewPointName('') }}
                        style={{ padding: '2px 10px', fontSize: '11px', background: expandedDomain === domain.id ? 'rgba(30,58,138,0.1)' : 'transparent', color: 'var(--app-brand)', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                        + 知识点
                      </button>
                      <button onClick={e => handleDeleteDomain(domain.id, e)}
                        style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', color: 'var(--app-text-placeholder)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--app-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--app-text-placeholder)'}>
                        <CloseIcon size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 知识点 + 题目 */}
                  {expandedDomain === domain.id && (
                    <div>
                      {(!domainPoints[domain.id] || domainPoints[domain.id].length === 0) ? (
                        <div style={{ padding: '8px 20px 8px 52px', color: 'var(--app-text-placeholder)', fontSize: '12px' }}>暂无知识点</div>
                      ) : (
                        domainPoints[domain.id].map(point => (
                          <div key={point.id}>
                            {/* 2-缩进：知识点 */}
                            <div style={{
                              padding: '10px 20px 10px 52px', display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', borderTop: '1px solid #F9FAFB', borderLeft: '3px solid transparent',
                              background: expandedPoint === point.id ? 'rgba(30,58,138,0.04)' : 'transparent',
                              transition: 'all 0.15s ease',
                            }}
                              onMouseEnter={e => { if (expandedPoint !== point.id) e.currentTarget.style.borderLeftColor = 'var(--app-primary)' }}
                              onMouseLeave={e => { if (expandedPoint !== point.id) e.currentTarget.style.borderLeftColor = 'transparent' }}
                            >
                              <div onClick={() => setExpandedPoint(expandedPoint === point.id ? null : point.id)}
                                style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', color: '#4B5563' }}>{point.name}</span>
                                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 6, background: ({1:'#ECFDF5',2:'#EFF6FF',3:'#FFFBEB',4:'var(--app-bg-danger)',5:'#F5F3FF'})[point.difficulty]||'var(--app-bg-page)', color: ({1:'var(--app-green-dark)',2:'var(--app-blue)',3:'var(--app-amber-dark)',4:'var(--app-danger-dark)',5:'var(--app-purple)'})[point.difficulty]||'var(--app-text-secondary)', fontWeight: 600 }}>
                                  {['', '入门', '基础', '进阶', '挑战', '竞赛'][point.difficulty] || point.difficulty}
                                </span>
                                {pointQuestions[point.id]?.length > 0 && (
                                  <span style={{ fontSize: '10px', color: 'var(--app-info)' }}>{pointQuestions[point.id].length} 题</span>
                                )}
                                <span style={{ color: 'var(--app-text-placeholder)', fontSize: '10px' }}>{expandedPoint === point.id ? <ChevronUpIcon size={12} color="#D1D5DB" /> : <ChevronDownIcon size={12} color="#D1D5DB" />}</span>
                              </div>
                              <button onClick={e => handleDeletePoint(point.id, e)}
                                style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', color: 'var(--app-text-placeholder)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--app-danger)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--app-text-placeholder)'}>
                                <CloseIcon size={12} />
                              </button>
                            </div>

                            {/* 3-缩进：题目列表 */}
                            {expandedPoint === point.id && (
                              <div>
                                {(!pointQuestions[point.id] || pointQuestions[point.id].length === 0) ? (
                                  <div style={{ padding: '8px 20px 8px 72px', color: 'var(--app-text-placeholder)', fontSize: '12px' }}>暂无题目</div>
                                ) : (
                                  pointQuestions[point.id].map(q => (
                                    <div key={q.id} onClick={() => setDetailQuestion(q)}
                                      style={{ padding: '8px 20px 8px 72px', cursor: 'pointer', borderTop: '1px solid #F9FAFB', transition: 'background 0.1s' }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--app-bg-card-alt)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 6, background: 'rgba(30,58,138,0.1)', color: 'var(--app-brand)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                          {QTYPE_LABELS[q.type] || q.type}
                                        </span>
                                        <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap', background: ({beginner:'#ECFDF5',basic:'#EFF6FF',intermediate:'#FFFBEB',advanced:'var(--app-bg-danger)',competition:'#F5F3FF'})[q.difficulty]||'var(--app-bg-page)', color: ({beginner:'var(--app-green-dark)',basic:'var(--app-blue)',intermediate:'var(--app-amber-dark)',advanced:'var(--app-danger-dark)',competition:'var(--app-purple)'})[q.difficulty]||'var(--app-text-secondary)' }}>
                                          {({beginner:'入门',basic:'基础',intermediate:'进阶',advanced:'挑战',competition:'竞赛'})[q.difficulty]||q.difficulty}
                                        </span>
                                        {q.tags?.slice(0, 2).map(t => (
                                          <span key={t} style={{
                                            fontSize: '10px', padding: '1px 8px', borderRadius: 6, fontWeight: t === '易错' ? 600 : 500, whiteSpace: 'nowrap',
                                            background: t === '易错' ? 'rgba(239,68,68,0.15)' : 'rgba(236,72,153,0.08)',
                                            color: t === '易错' ? 'var(--app-danger)' : '#EC4899',
                                          }}>{t === '易错' ? <><AlertTriangleIcon size={11} color="#EF4444" /> 易错</> : `#${t}`}</span>
                                        ))}
                                      </div>
                                      <div style={{ fontSize: '13px', color: 'var(--app-text-heading)', lineHeight: 1.5, overflow: 'hidden' }}>
                                        <MarkdownRenderer content={q.content?.stem || '无题干'} />
                                      </div>
                                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                        {/* 重生成按钮：旋转 SVG */}
                                        <button onClick={e => {
                                          e.stopPropagation()
                                          if (regenQuestionId === q.id) { setRegenQuestionId(null); setRegenFeedback('') }
                                          else setRegenQuestionId(q.id)
                                        }} title="重新生成此题目"
                                          style={{ padding: '2px 8px', fontSize: '11px', background: regenLoading && regenQuestionId === q.id ? 'var(--app-brand-bg)' : '#FFF7ED', color: 'var(--app-amber-dark)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                            style={{ animation: regenLoading && regenQuestionId === q.id ? 'spin 1s linear infinite' : 'none' }}>
                                            <polyline points="23 4 23 10 17 10" />
                                            <polyline points="1 20 1 14 7 14" />
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                          </svg>
                                          {regenLoading && regenQuestionId === q.id ? '...' : ''}
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); setEditQuestion(q); setShowEditor(true) }}
                                          style={{ padding: '2px 10px', fontSize: '11px', background: 'var(--app-bg-page)', color: 'var(--app-text-body)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>编辑</button>
                                        <button onClick={e => { e.stopPropagation(); handleDelete(q) }}
                                          style={{ padding: '2px 10px', fontSize: '11px', background: 'var(--app-bg-danger)', color: 'var(--app-danger)', border: 'none', borderRadius: 6, cursor: 'pointer' }}><CloseIcon size={12} /></button>
                                      </div>
                                      {/* 反馈输入区 */}
                                      {regenQuestionId === q.id && (
                                        <div style={{ marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                                          <textarea value={regenFeedback} onChange={e => setRegenFeedback(e.target.value)}
                                            placeholder="指出题目问题，例如：数学符号没有用 LaTeX 渲染（x 应为 $x$，a<b 应为 $a<b$），题目太简单/太难，知识点不准确..."
                                            disabled={regenLoading}
                                            style={{ width: '100%', minHeight: 60, padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: regenLoading ? 'var(--app-bg-card-alt)' : '#fff' }} />
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                            <button onClick={() => handleRegenerate(q, regenFeedback)} disabled={regenLoading || !regenFeedback.trim()}
                                              style={{ padding: '6px 14px', fontSize: '12px', background: regenLoading || !regenFeedback.trim() ? 'var(--app-text-placeholder)' : 'var(--app-amber-dark)', color: '#fff', border: 'none', borderRadius: 6, cursor: regenLoading ? 'wait' : 'pointer', fontWeight: 500 }}>
                                              {regenLoading ? '重生成中...' : '确认重生成'}
                                            </button>
                                            <button onClick={() => { setRegenQuestionId(null); setRegenFeedback('') }}
                                              style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--app-bg-page)', color: 'var(--app-text-secondary)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
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
                            style={{ padding: '6px 14px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>确定</button>
                          <button onClick={() => { setAddingPointForDomain(null); setNewPointName('') }}
                            style={{ padding: '6px 10px', background: 'var(--app-bg-page)', color: 'var(--app-text-secondary)', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>取消</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* 加载更多 */}
              {hasMore && (
                <div style={{ padding: '12px 20px', textAlign: 'center', borderTop: '1px solid #F9FAFB' }}>
                  <span style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginRight: '8px' }}>
                    已加载 {allQuestions.length} / {totalQuestionsCount} 道题
                  </span>
                  <button onClick={handleLoadMore} disabled={loadingMore}
                    style={{ padding: '6px 20px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', cursor: loadingMore ? 'wait' : 'pointer', fontWeight: 500 }}>
                    {loadingMore ? '加载中...' : '加载更多'}
                  </button>
                </div>
              )}
              {/* 添加章节（列表底部） */}
              <div style={{ padding: '12px 20px 12px 36px', borderTop: '1px solid #F9FAFB' }}>
                {addingDomain ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input value={newDomainName} onChange={e => setNewDomainName(e.target.value)}
                      placeholder="输入章节名称" onKeyDown={e => e.key === 'Enter' && handleCreateDomain()}
                      style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: '13px', outline: 'none' }} />
                    <button onClick={handleCreateDomain}
                      style={{ padding: '6px 14px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>确定</button>
                    <button onClick={() => { setAddingDomain(false); setNewDomainName('') }}
                      style={{ padding: '6px 10px', background: 'var(--app-bg-page)', color: 'var(--app-text-secondary)', border: 'none', borderRadius: 6, fontSize: '12px', cursor: 'pointer' }}>取消</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingDomain(true)}
                    style={{ padding: '6px 16px', background: 'transparent', color: 'var(--app-brand)', border: '1.5px dashed #D1D5DB', borderRadius: 8, fontSize: '13px', cursor: 'pointer', width: '100%' }}>
                    + 添加章节
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        ) : (
        <>
        <CuratedPaperShelf
          papers={papers}
          busy={curatedBusy}
          message={curatedMessage}
          onAction={handleCuratedPaper}
        />
        {/* ── 试卷列表 ── */}
        <div className="card-hover" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--app-text-heading)' }}><EditIcon size={18} color="#1F2937" /> 我的试卷</span>
            <button onClick={() => setShowExamCreator(true)}
              style={{ padding: '6px 16px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
              + 新建试卷
            </button>
          </div>
          {papersLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--app-text-placeholder)' }}>加载中...</div>
          ) : papers.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--app-bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', opacity: 0.6 }}>
                <EditIcon size={32} color="#9CA3AF" />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--app-text-heading)', marginBottom: 8 }}>暂无试卷</div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                创建试卷来模拟真实考试<br/>支持手动配置、上传文件、AI 智能出题三种方式
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setShowExamCreator(true)}
                  style={{ padding: '10px 24px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                  + 创建试卷
                </button>
                <span style={{ padding: '10px 18px', background: 'var(--app-bg-page)', color: 'var(--app-text-secondary)', borderRadius: 12, fontSize: '13px', fontWeight: 500 }}>
                  推荐：期末模拟卷
                </span>
              </div>
            </div>
          ) : (
            <div>
              {papers.map((p: any) => (
                <div key={p.id} onClick={() => navigate(`/banks/${bankId}/exam-papers/${p.id}`)} style={{
                  padding: '16px 20px', cursor: 'pointer', borderTop: '1px solid #F9FAFB',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--app-bg-card-alt)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <EditIcon size={14} color="var(--app-brand)" /> {p.title}
                      {p.status === 'draft' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#FFFBEB', color: '#D97706', fontWeight: 500 }}>草稿</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '4px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{p.total_questions} 题</span>
                      <span>总分 {p.total_score}</span>
                      {p.time_limit_minutes && <span>{p.time_limit_minutes} 分钟</span>}
                      <span style={{ color: p.generate_method === 'upload' ? 'var(--app-info)' : 'var(--app-text-muted)' }}>
                        {p.generate_method === 'upload' ? '上传' : p.generate_method === 'ai' ? 'AI 出题' : p.generate_method === 'curated' ? '精选试卷' : '手动'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span onClick={e => { e.stopPropagation(); navigate(`/banks/${bankId}/exam-papers/${p.id}`) }}
                      style={{ padding: '6px 14px', fontSize: 12, background: 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                      <PlayIcon size={11} color="#fff" /> 开始测试
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* ── 创建试卷弹窗 ── */}
      {showExamCreator && bank && (
        <CreateExamPaperModal
          bankId={bankId!}
          onClose={() => setShowExamCreator(false)}
          onCreated={() => { setShowExamCreator(false); loadPapers() }}
          llmAvailable={llmAvailable}
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
          llmAvailable={llmAvailable}
        />
      )}

    </div>
  )
}

function CuratedPaperShelf({ papers, busy, message, onAction }: {
  papers: any[]
  busy: string
  message: string
  onAction: (template: CuratedPaperTemplate, action: 'pdf' | 'word' | 'start') => void
}) {
  return (
    <section style={{ marginBottom: 16, background: 'linear-gradient(135deg, #F8FBFF 0%, #F0FDF8 100%)', border: '1px solid #DBEAFE', borderRadius: 16, padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#1E3A8A', background: '#DBEAFE', padding: '4px 8px', borderRadius: 6 }}>CURATED PAPERS</span>
            <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>公开资料整理 · 仅选择与判断</span>
          </div>
          <h2 style={{ margin: '10px 0 4px', fontSize: 19, color: 'var(--app-text-heading)' }}>精选分级试卷</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--app-text-muted)', lineHeight: 1.7 }}>首次下载会自动从当前题库组卷，并永久加入下方“我的试卷”。再次下载将直接复用，不重复创建。</p>
        </div>
        <span style={{ fontSize: 12, color: '#047857', background: '#D1FAE5', padding: '7px 10px', borderRadius: 8, fontWeight: 600 }}>5 套 · PDF / Word · 可在线考试</span>
      </div>

      <div className="curated-paper-grid">
        {CURATED_PAPERS.map((template, index) => {
          const saved = papers.some((paper: any) => paper.title === template.title)
          const questionCount = template.sections.reduce((sum, section) => sum + section.count, 0)
          return (
            <article key={template.id} className="curated-paper-card" style={{ background: '#fff', border: '1px solid #E5EDF7', borderRadius: 13, padding: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', width: 5, left: 0, top: 14, bottom: 14, borderRadius: '0 4px 4px 0', background: template.difficultyColor }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: template.difficultyColor, background: `${template.difficultyColor}12`, padding: '4px 8px', borderRadius: 6 }}>{template.difficulty}</span>
                <span style={{ fontSize: 10, color: 'var(--app-text-placeholder)', fontFamily: 'monospace' }}>DS-PAPER-{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 style={{ margin: '12px 0 7px', fontSize: 15, color: 'var(--app-text-heading)' }}>{template.title}</h3>
              <p style={{ minHeight: 42, margin: 0, color: 'var(--app-text-muted)', fontSize: 12, lineHeight: 1.7 }}>{template.description}</p>
              <div style={{ display: 'flex', gap: 12, margin: '11px 0', fontSize: 11, color: 'var(--app-text-secondary)', flexWrap: 'wrap' }}>
                <span>{questionCount} 题</span><span>{template.duration} 分钟</span><span>满分 100</span>
                {saved && <span style={{ color: '#059669', fontWeight: 700 }}>✓ 已加入</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--app-text-placeholder)', marginBottom: 12 }}>
                来源：{template.sources.map((source, sourceIndex) => (
                  <span key={source.url}>{sourceIndex > 0 && '、'}<a href={source.url} target="_blank" rel="noreferrer" style={{ color: '#1677E8', textDecoration: 'none' }}>{source.name}</a></span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button onClick={() => onAction(template, 'pdf')} disabled={!!busy}
                  style={{ padding: '7px 11px', border: 'none', borderRadius: 8, background: '#1E3A8A', color: '#fff', fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== `${template.id}-pdf` ? .55 : 1 }}>
                  <FileIcon size={11} color="#fff" /> {busy === `${template.id}-pdf` ? '生成中…' : '下载 PDF'}
                </button>
                <button onClick={() => onAction(template, 'word')} disabled={!!busy}
                  style={{ padding: '7px 11px', border: '1px solid #BFDBFE', borderRadius: 8, background: '#EFF6FF', color: '#1D4ED8', fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
                  {busy === `${template.id}-word` ? '生成中…' : '下载 Word'}
                </button>
                <button onClick={() => onAction(template, 'start')} disabled={!!busy}
                  style={{ padding: '7px 11px', border: 'none', borderRadius: 8, background: '#D1FAE5', color: '#047857', fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
                  <PlayIcon size={10} color="#047857" /> {busy === `${template.id}-start` ? '准备中…' : '在线考试'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {message && <div role="status" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 9, background: message.includes('失败') || message.includes('没有') ? '#FEF2F2' : '#ECFDF5', color: message.includes('失败') || message.includes('没有') ? '#B91C1C' : '#047857', fontSize: 12 }}>{message}</div>}
    </section>
  )
}

/* ════════════════════════════════════════════════
   题目详情弹窗（只读，点击题目后展示）
   ════════════════════════════════════════════════ */
function QuestionDetailModal({ question: q, onClose }: { question: QuestionItem; onClose: () => void }) {
  const [showAnswer, setShowAnswer] = useState(false)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 600, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', padding: '3px 12px', borderRadius: 10, background: 'rgba(30,58,138,0.1)', color: 'var(--app-brand)', fontWeight: 500 }}>
              {({ single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题', true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题' })[q.type] || q.type}
            </span>
            <span style={{ fontSize: '12px', padding: '3px 12px', borderRadius: 10, background: ({beginner:'#ECFDF5',basic:'#EFF6FF',intermediate:'#FFFBEB',advanced:'var(--app-bg-danger)',competition:'#F5F3FF'})[q.difficulty]||'var(--app-bg-page)', color: ({beginner:'var(--app-green-dark)',basic:'var(--app-blue)',intermediate:'var(--app-amber-dark)',advanced:'var(--app-danger-dark)',competition:'var(--app-purple)'})[q.difficulty]||'var(--app-text-secondary)', fontWeight: 600 }}>
              {{ beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛' }[q.difficulty] || q.difficulty}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--app-text-muted)' }}><CloseIcon size={18} /></button>
        </div>

        {/* 题干 */}
        <div style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--app-text-heading)', marginBottom: '20px' }}>
          <MarkdownRenderer content={q.content?.stem} />
        </div>

        {/* 选项 */}
        {q.content?.options && q.content.options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {q.content.options.map(opt => (
              <div key={opt.key} style={{
                display: 'flex', alignItems: 'center', padding: '12px 16px',
                background: 'var(--app-bg-card-alt)', borderRadius: 12, border: '1.5px solid transparent',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: q.type === 'multiple_choice' ? 8 : '50%',
                  background: 'var(--app-border)', color: 'var(--app-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 600, marginRight: '12px', flexShrink: 0,
                }}>
                  {opt.key}
                </div>
                <span style={{ fontSize: '15px', color: 'var(--app-text-body)' }}><MarkdownRenderer content={opt.text} /></span>
              </div>
            ))}
          </div>
        )}

        {/* 代码模板 */}
        {q.content?.code_template && (
          <pre style={{ background: 'var(--app-bg-card-alt)', borderRadius: 12, padding: '16px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '20px' }}>
            {q.content.code_template}
          </pre>
        )}

        {/* 答案与解析 - 默认折叠 */}
        {q.answer && (
          <div style={{ marginBottom: '16px' }}>
            <div onClick={() => setShowAnswer(!showAnswer)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
              background: showAnswer ? '#F0FDF4' : 'var(--app-bg-card-alt)',
              border: '1.5px solid', borderColor: showAnswer ? 'var(--app-success)' : 'var(--app-border)',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: showAnswer ? 'var(--app-success)' : 'var(--app-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {showAnswer ? <><BookOpenIcon size={14} /> 答案与解析</> : <><EyeIcon size={14} /> 点击查看答案</>}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>{showAnswer ? <ChevronUpIcon size={12} color="#9CA3AF" /> : <ChevronDownIcon size={12} color="#9CA3AF" />}</span>
            </div>
            {showAnswer && (
              <div style={{ background: '#F0FDF4', borderRadius: '0 0 12px 12px', padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-success)', marginBottom: '8px' }}>
                  答案：<MarkdownRenderer content={(() => { const ca = q.answer.correct_answer; return Array.isArray(ca) ? ca.join(', ') : String(ca || '') })() || '—'} />
                </div>
                {q.answer.explanation && (
                  <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', lineHeight: 1.7 }}><MarkdownRenderer content={q.answer.explanation} /></div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 标签与知识点关联 */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' }}>
          {q.tags?.map(t => (
            <span key={t} style={{
              fontSize: '11px', padding: '2px 10px', borderRadius: 6,
              background: t === '易错' ? 'rgba(239,68,68,0.15)' : 'rgba(236,72,153,0.08)',
              color: t === '易错' ? 'var(--app-danger)' : '#EC4899', fontWeight: t === '易错' ? 600 : 500,
            }}>{t === '易错' ? <><AlertTriangleIcon size={11} color="#EF4444" /> 易错</> : `#${t}`}</span>
          ))}
          {q.knowledge_point_uuids?.length > 0 && (
            <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', color: 'var(--app-info)' }}><LinkIcon size={11} color="#1677E8" /> 关联 {q.knowledge_point_uuids.length} 个知识点</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   题目编辑器弹窗
   ════════════════════════════════════════════════ */
const ALL_Q_TYPES: QuestionType[] = ['single_choice', 'multiple_choice', 'fill_blank', 'true_false', 'programming']

function QuestionEditorModal({ bankId, editQuestion, onClose, onSaved, llmAvailable }: {
  bankId: string; editQuestion: QuestionItem | null; onClose: () => void; onSaved: () => void; llmAvailable: boolean
}) {
  const isEditing = !!editQuestion
  const [tab, setTab] = useState<'manual' | 'ai'>(isEditing ? 'manual' : 'manual')
  const [qType, setQType] = useState<string>(editQuestion?.type || 'single_choice')
  const [stem, setStem] = useState(editQuestion?.content?.stem || '')
  const [options, setOptions] = useState<string>(
    editQuestion?.content?.options?.map((o: any) => `${o.key}. ${o.text}`).join('\n') || ''
  )
  const [correctAnswer, setCorrectAnswer] = useState(
    (() => { const ca = editQuestion?.answer?.correct_answer; return Array.isArray(ca) ? ca.join(',') : String(ca || '') })() || ''
  )
  const [explanation, setExplanation] = useState(editQuestion?.answer?.explanation || '')
  const [difficulty, setDifficulty] = useState<string>(editQuestion?.difficulty || 'basic')
  const [tags, setTags] = useState(editQuestion?.tags?.join(', ') || '')
  const [kpUuids, setKpUuids] = useState(editQuestion?.knowledge_point_uuids?.join(', ') || '')
  const [codeTemplate, setCodeTemplate] = useState(editQuestion?.content?.code_template || '')
  const [saving, setSaving] = useState(false)

  // ── AI generation state ──
  const [aiTypes, setAiTypes] = useState<string[]>(['single_choice'])
  const [aiCount, setAiCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('basic')
  const [aiTopic, setAiTopic] = useState('')
  const [aiGenLoading, setAiGenLoading] = useState(false)
  const [aiGenQuestions, setAiGenQuestions] = useState<any[]>([])
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set())
  const [aiGenError, setAiGenError] = useState('')

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

  // ── AI 生成题目 ──
  const handleAIGenerate = async () => {
    if (aiTypes.length === 0) { setAiGenError('请选择题型'); return }
    setAiGenLoading(true)
    setAiGenError('')
    setAiGenQuestions([])
    setAiSelected(new Set())
    try {
      const typesStr = aiTypes.map(t => QTYPE_LABELS[t] || t).join('、')
      const diffStr = DIFF_LABELS[aiDifficulty] || aiDifficulty
      const topicStr = aiTopic.trim() ? `，主题：${aiTopic.trim()}` : ''
      const msg = `请生成${aiCount}道${diffStr}难度的${typesStr}${topicStr}，要求题目新颖、有区分度`
      const res = await questionBankApi.aiGenerate(bankId, {
        message: msg,
        conversation_history: [],
        collected_params: {},
      })
      if (res.data.is_complete && res.data.generated_questions?.length > 0) {
        setAiGenQuestions(res.data.generated_questions)
        setAiSelected(new Set(res.data.generated_questions.map((_: any, i: number) => i)))
      } else {
        setAiGenError('AI 未能生成题目，请调整参数后重试')
      }
    } catch (err: any) {
      setAiGenError(err.response?.data?.detail || 'AI 生成失败，请重试')
    }
    setAiGenLoading(false)
  }

  const handleAISave = async () => {
    const toSave = aiGenQuestions.filter((_, i) => aiSelected.has(i))
    if (toSave.length === 0) return
    setSaving(true)
    let saved = 0
    for (const q of toSave) {
      try {
        await questionBankApi.createQuestion(bankId, {
          type: q.type, content: q.content || {},
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
      } catch { /* skip */ }
    }
    setSaving(false)
    if (saved > 0) {
      onSaved()
    } else {
      alert('保存失败，请重试')
    }
  }

  const DIFF_COLORS: Record<string, string> = {
    beginner: 'var(--app-green-dark)', basic: 'var(--app-blue)', intermediate: 'var(--app-amber-dark)',
    advanced: 'var(--app-danger-dark)', competition: 'var(--app-purple)',
  }
  const DIFF_BG: Record<string, string> = {
    beginner: '#ECFDF5', basic: '#EFF6FF', intermediate: '#FFFBEB',
    advanced: 'var(--app-bg-danger)', competition: '#F5F3FF',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 640, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--app-text-heading)', margin: 0 }}>{editQuestion ? '编辑题目' : '新建题目'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--app-text-muted)' }}><CloseIcon size={18} /></button>
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--app-bg-page)', borderRadius: 10, padding: '3px' }}>
            <button onClick={() => setTab('manual')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: 'pointer', background: tab === 'manual' ? '#fff' : 'transparent', color: tab === 'manual' ? 'var(--app-brand)' : 'var(--app-text-secondary)', fontWeight: 500 }}>手动创建</button>
            <button onClick={() => setTab('ai')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: llmAvailable ? 'pointer' : 'not-allowed', background: tab === 'ai' ? '#fff' : 'transparent', color: llmAvailable ? (tab === 'ai' ? 'var(--app-info)' : 'var(--app-text-secondary)') : 'var(--app-text-muted)', fontWeight: 500, opacity: llmAvailable ? 1 : 0.5 }}><BotIcon size={14} color={llmAvailable ? '#1677E8' : '#9CA3AF'} /> AI 生成</button>
          </div>
        )}

        {tab === 'manual' || isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 题型 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>题型</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ALL_Q_TYPES.map(t => (
                  <button key={t} onClick={() => { setQType(t); setCorrectAnswer('') }}
                    style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '13px', background: qType === t ? 'var(--app-brand)' : '#fff', color: qType === t ? '#fff' : 'var(--app-text-secondary)', borderColor: qType === t ? 'var(--app-brand)' : 'var(--app-border)' }}>
                    {QTYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            {/* 难度 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>难度</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['beginner', 'basic', 'intermediate', 'advanced', 'competition'].map(d => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    style={{ padding: '6px 18px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '13px', background: difficulty === d ? 'var(--app-brand)' : '#fff', color: difficulty === d ? '#fff' : 'var(--app-text-secondary)', borderColor: difficulty === d ? 'var(--app-brand)' : 'var(--app-border)' }}>
                    {{ beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛' }[d]}
                  </button>
                ))}
              </div>
            </div>
            {/* 题干 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>题干</div>
              <textarea value={stem} onChange={e => setStem(e.target.value)} placeholder="输入题目内容..."
                style={{ width: '100%', minHeight: 80, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            {/* 选项 */}
            {(qType === 'single_choice' || qType === 'multiple_choice') && (
              <div>
                <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>选项（每行一个，格式 A. xxx）</div>
                <textarea value={options} onChange={e => setOptions(e.target.value)} placeholder="A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四"
                  style={{ width: '100%', minHeight: 110, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            )}
            {qType === 'programming' && (
              <div>
                <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>代码模板（可选）</div>
                <textarea value={codeTemplate} onChange={e => setCodeTemplate(e.target.value)} placeholder="def solution():&#10;    pass"
                  style={{ width: '100%', minHeight: 80, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical' }} />
              </div>
            )}
            {/* 答案 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
                答案 {qType === 'single_choice' && <span style={{ fontWeight: 400, color: 'var(--app-text-muted)' }}>（选项字母）</span>}
                {qType === 'multiple_choice' && <span style={{ fontWeight: 400, color: 'var(--app-text-muted)' }}>（字母用逗号分隔）</span>}
                {qType === 'true_false' && <span style={{ fontWeight: 400, color: 'var(--app-text-muted)' }}>（对/错）</span>}
              </div>
              {qType === 'true_false' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['对', '错'].map(v => (
                    <button key={v} onClick={() => setCorrectAnswer(v)}
                      style={{ padding: '8px 24px', borderRadius: 10, border: '1.5px solid', cursor: 'pointer', fontSize: '14px', background: correctAnswer === v ? 'var(--app-brand)' : '#fff', color: correctAnswer === v ? '#fff' : 'var(--app-text-secondary)', borderColor: correctAnswer === v ? 'var(--app-brand)' : 'var(--app-border)' }}>
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
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>解析（可选）</div>
              <textarea value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="解释为什么是这个答案..."
                style={{ width: '100%', minHeight: 60, padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            {/* 标签 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>标签（逗号分隔）</div>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="CPU, 流水线, 数据冒险"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            {/* 知识点 UUID */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
                关联知识点 UUID <span style={{ fontWeight: 400, color: 'var(--app-text-muted)' }}>（Neo4j ID，逗号分隔）</span>
              </div>
              <input value={kpUuids} onChange={e => setKpUuids(e.target.value)} placeholder="kp-uuid-1, kp-uuid-2"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '12px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '保存中...' : editQuestion ? '更新题目' : '创建题目'}
            </button>
          </div>
        ) : !llmAvailable ? (
          /* AI 不可用时显示配置引导 */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 20px', textAlign: 'center' }}>
            <BotIcon size={40} color="#9CA3AF" />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--app-text-heading)' }}>AI 出题功能暂不可用</div>
            <div style={{ fontSize: '13px', color: 'var(--app-text-muted)', lineHeight: 1.7, maxWidth: 360 }}>
              请先在「设置」中配置 DeepSeek 或 Qwen API Key，即可使用 AI 自动生成题目。
            </div>
            <button onClick={() => window.open('/settings', '_blank')}
              style={{ padding: '10px 24px', background: 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              前往配置 API
            </button>
          </div>
        ) : (
          /* AI 生成表单 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 题型多选 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>题型（可多选）</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ALL_Q_TYPES.map(t => {
                  const sel = aiTypes.includes(t)
                  return (
                    <button key={t} onClick={() => setAiTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '13px', background: sel ? 'rgba(99,102,241,0.1)' : '#fff', color: sel ? 'var(--app-info)' : 'var(--app-text-secondary)', borderColor: sel ? '#818CF8' : 'var(--app-border)', fontWeight: sel ? 600 : 400 }}>
                      {QTYPE_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* 数量 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>生成数量</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" min={1} max={20} value={aiCount}
                  onChange={e => setAiCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  style={{ width: 100, padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
                <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>道（1-20）</span>
              </div>
            </div>
            {/* 难度 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>难度</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['beginner', 'basic', 'intermediate', 'advanced', 'competition'].map(d => (
                  <button key={d} onClick={() => setAiDifficulty(d)}
                    style={{ padding: '6px 18px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: '13px', background: aiDifficulty === d ? 'rgba(99,102,241,0.1)' : '#fff', color: aiDifficulty === d ? 'var(--app-info)' : 'var(--app-text-secondary)', borderColor: aiDifficulty === d ? '#818CF8' : 'var(--app-border)', fontWeight: aiDifficulty === d ? 600 : 400 }}>
                    {DIFF_LABELS[d] || d}
                  </button>
                ))}
              </div>
            </div>
            {/* 主题关键词 */}
            <div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>主题/关键词（可选）</div>
              <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="如：Cache映射方式、流水线冲突..."
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>

            {aiGenError && (
              <div style={{ padding: '10px 14px', background: 'var(--app-bg-danger)', borderRadius: 10, color: 'var(--app-danger)', fontSize: '13px' }}>{aiGenError}</div>
            )}

            {/* 生成结果预览 */}
            {aiGenQuestions.length > 0 && (
              <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '12px', maxHeight: 240, overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-success)' }}><CheckCircleIcon size={14} color="#10B981" /> 已生成 {aiGenQuestions.length} 道题（已选 {aiSelected.size} 道）</span>
                  <button onClick={() => {
                    if (aiSelected.size === aiGenQuestions.length) setAiSelected(new Set())
                    else setAiSelected(new Set(aiGenQuestions.map((_, i) => i)))
                  }} style={{ fontSize: '12px', color: 'var(--app-info)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {aiSelected.size === aiGenQuestions.length ? '取消全选' : '全选'}
                  </button>
                </div>
                {aiGenQuestions.map((q, i) => (
                  <div key={i} onClick={() => {
                    setAiSelected(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next })
                  }} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    padding: '8px 10px', background: aiSelected.has(i) ? 'var(--app-bg-card-alt)' : '#fff',
                    borderRadius: 8, marginBottom: '4px', cursor: 'pointer',
                    border: '1.5px solid', borderColor: aiSelected.has(i) ? '#A5B4FC' : 'var(--app-border)',
                    fontSize: '13px', color: 'var(--app-text-body)',
                  }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid', borderColor: aiSelected.has(i) ? 'var(--app-info)' : 'var(--app-text-placeholder)', background: aiSelected.has(i) ? 'var(--app-info)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                      {aiSelected.has(i) ? <CheckIcon size={10} color="#fff" /> : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ padding: '1px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: 'var(--app-info)', fontSize: '11px', fontWeight: 600 }}>{QTYPE_LABELS[q.type] || q.type}</span>
                        <span style={{ padding: '1px 8px', borderRadius: 6, fontSize: '11px', fontWeight: 600, background: DIFF_BG[q.difficulty] || 'var(--app-bg-page)', color: DIFF_COLORS[q.difficulty] || 'var(--app-text-secondary)' }}>{DIFF_LABELS[q.difficulty] || q.difficulty}</span>
                      </div>
                      <div style={{ lineHeight: 1.5 }}><MarkdownRenderer content={q.content?.stem || '无题干'} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            {aiGenQuestions.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleAISave} disabled={saving || aiSelected.size === 0}
                  style={{ flex: 1, padding: '12px', background: aiSelected.size === 0 ? 'var(--app-text-placeholder)' : 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: saving || aiSelected.size === 0 ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '保存中...' : `保存选中 (${aiSelected.size} 道)`}
                </button>
                <button onClick={handleAIGenerate} disabled={aiGenLoading}
                  style={{ padding: '12px 20px', background: 'var(--app-bg-page)', color: 'var(--app-info)', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                  重新生成
                </button>
              </div>
            ) : (
              <button onClick={handleAIGenerate} disabled={aiGenLoading}
                style={{ padding: '12px', background: 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: aiGenLoading ? 'wait' : 'pointer', opacity: aiGenLoading ? 0.6 : 1 }}>
                {aiGenLoading ? 'AI 生成中...' : <><BotIcon size={14} color="#fff" /> AI 生成题目</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   创建试卷弹窗（手动配置 + 预览推荐）
   ════════════════════════════════════════════════ */
const ALL_QTYPES = ['single_choice', 'multiple_choice', 'fill_blank', 'true_false', 'programming']

function CreateExamPaperModal({ bankId, onClose, onCreated, llmAvailable }: {
  bankId: string; onClose: () => void; onCreated: () => void; llmAvailable: boolean
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
    // 清除旧题目，避免新旧题目混在一起
    setAiGeneratedQuestions([])
    setAiSelectedQuestions(new Set())
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
            type: q.type || 'single_choice',
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 660, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--app-text-heading)', margin: 0 }}>新建试卷</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--app-text-muted)' }}><CloseIcon size={18} /></button>
        </div>

        {/* Tab */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--app-bg-page)', borderRadius: 10, padding: '3px' }}>
          <button onClick={() => setTab('manual')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: 'pointer', background: tab === 'manual' ? '#fff' : 'transparent', color: tab === 'manual' ? 'var(--app-brand)' : 'var(--app-text-secondary)', fontWeight: 500 }}>手动配置</button>
          <button onClick={() => setTab('upload')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: 'pointer', background: tab === 'upload' ? '#fff' : 'transparent', color: tab === 'upload' ? 'var(--app-brand)' : 'var(--app-text-secondary)', fontWeight: 500 }}>上传文件</button>
          <button onClick={() => setTab('ai')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: '13px', cursor: llmAvailable ? 'pointer' : 'not-allowed', background: tab === 'ai' ? '#fff' : 'transparent', color: llmAvailable ? (tab === 'ai' ? 'var(--app-info)' : 'var(--app-text-secondary)') : 'var(--app-text-muted)', fontWeight: 500, opacity: llmAvailable ? 1 : 0.5 }}><BotIcon size={14} color={llmAvailable ? '#1677E8' : '#9CA3AF'} /> AI 出题</button>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 10, color: 'var(--app-danger)', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        {tab === 'manual' ? (
          <div>
            {/* 基本信息 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-body)', marginBottom: '6px' }}>试卷名称</div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="如：计算机组成原理期末考试"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-body)', marginBottom: '6px' }}>总分</div>
                <input type="number" value={totalScore} onChange={e => setTotalScore(parseInt(e.target.value) || 100)}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-body)', marginBottom: '6px' }}>时间限制（分钟，选填）</div>
                <input type="number" value={timeLimit ?? ''} onChange={e => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              </div>
            </div>

            {/* 题目章节配置 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>题目配置</div>
              {sections.map((s: any, i: number) => (
                <div key={i} style={{ padding: '14px', border: '1.5px solid #E5E7EB', borderRadius: 12, marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={s.name} onChange={e => updateSection(i, 'name', e.target.value)} placeholder="名称"
                      style={{ width: 120, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none' }} />
                    <select value={s.question_type} onChange={e => updateSection(i, 'question_type', e.target.value)}
                      style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none', background: '#fff' }}>
                      {ALL_QTYPES.map(t => <option key={t} value={t}>{QTYPE_LABELS[t]}</option>)}
                    </select>
                    <input type="number" value={s.count} onChange={e => updateSection(i, 'count', parseInt(e.target.value) || 1)} min={1} placeholder="题数"
                      style={{ width: 60, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none' }} />
                    <span style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>题</span>
                    <span style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>每题</span>
                    <input type="number" value={s.score_per_question} onChange={e => updateSection(i, 'score_per_question', parseInt(e.target.value) || 1)} min={1}
                      style={{ width: 50, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', outline: 'none' }} />
                    <span style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>分</span>
                    {sections.length > 1 && (
                      <button onClick={() => removeSection(i)} style={{ padding: '4px 8px', background: 'var(--app-bg-danger)', color: 'var(--app-danger)', border: 'none', borderRadius: 6, fontSize: '11px', cursor: 'pointer' }}><CloseIcon size={12} /></button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addSection} style={{ padding: '8px', background: 'transparent', color: 'var(--app-brand)', border: '1.5px dashed #D1D5DB', borderRadius: 8, fontSize: '13px', cursor: 'pointer', width: '100%' }}>+ 添加题目配置</button>
            </div>

            {/* 预览与保存 */}
            {suggestResult ? (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-success)', marginBottom: '12px' }}>
                  <CheckCircleIcon size={14} color="#10B981" /> 已推荐 {suggestResult.reduce((sum: number, s: any) => sum + s.count, 0)} 道题
                  {suggestResult.some((s: any) => s.count > (s.available_count ?? 0)) && (
                    <span style={{ fontWeight: 400, color: 'var(--app-warning)', marginLeft: 8 }}>（部分章节题目不足）</span>
                  )}
                </div>
                {suggestResult.map((sec: any, i: number) => (
                  <div key={i} style={{ padding: '10px 14px', background: 'var(--app-bg-card-alt)', borderRadius: 10, marginBottom: '8px', fontSize: '13px', color: 'var(--app-text-body)' }}>
                    <strong>{sec.name}</strong>（{sec.available_count || sec.count} 题可用，已选 {sec.count} 题）
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: '12px', background: 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? '创建中...' : '创建试卷'}
                  </button>
                  <button onClick={() => setSuggestResult(null)}
                    style={{ padding: '12px 20px', background: 'var(--app-bg-page)', color: 'var(--app-text-secondary)', border: 'none', borderRadius: 10, fontSize: '13px', cursor: 'pointer' }}>
                    重新配置
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={handleSuggest} disabled={suggesting || sections.length === 0}
                style={{ width: '100%', padding: '12px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: suggesting ? 'not-allowed' : 'pointer', opacity: suggesting ? 0.6 : 1 }}>
                {suggesting ? '智能匹配中...' : '预览题目'}
              </button>
            )}
          </div>
        ) : tab === 'upload' ? (
          <div>
            {/* Upload tab */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-body)', marginBottom: '6px' }}>试卷名称</div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="试卷名称"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            {!parseResult ? (
              <div>
                <div style={{ border: '2px dashed #D1D5DB', borderRadius: 12, padding: '32px', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => document.getElementById('exam-upload-input')?.click()}>
                  <div style={{ marginBottom: '8px' }}><FileIcon size={32} color="#D1D5DB" /></div>
                  <div style={{ fontSize: '14px', color: 'var(--app-text-secondary)' }}>点击上传 PDF 或 Word 试卷文件</div>
                  <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '4px' }}>支持 .pdf .docx .doc 格式</div>
                </div>
                <input id="exam-upload-input" type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); handleUpload() } }} />
                {uploading && <div style={{ textAlign: 'center', color: 'var(--app-text-muted)', fontSize: '13px', marginTop: '12px' }}>解析文件中...</div>}
              </div>
            ) : (
              <div>
                <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-success)' }}><CheckCircleIcon size={14} color="#10B981" /> 解析完成</div>
                  <div style={{ fontSize: '12px', color: 'var(--app-text-secondary)', marginTop: '4px' }}>文件：{parseResult.filename}</div>
                </div>
                {generatedQuestions.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-success)', marginBottom: '8px' }}><CheckCircleIcon size={14} color="#10B981" /> AI 已生成 {generatedQuestions.length} 道类似题目</div>
                    {generatedQuestions.slice(0, 5).map((q, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'var(--app-bg-card-alt)', borderRadius: 8, marginBottom: '4px', fontSize: '13px', color: 'var(--app-text-body)' }}>
                        {i + 1}. <MarkdownRenderer content={q.content?.stem || '无题干'} />
                      </div>
                    ))}
                    {generatedQuestions.length > 5 && <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', padding: '4px 0' }}>...还有 {generatedQuestions.length - 5} 题</div>}
                    <button onClick={handleSaveFromUpload} disabled={saving}
                      style={{ width: '100%', padding: '12px', background: 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, marginTop: '12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                      {saving ? '创建中...' : '创建试卷'}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleAIGenerate} disabled={genLoading}
                    style={{ width: '100%', padding: '12px', background: 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: genLoading ? 'not-allowed' : 'pointer', opacity: genLoading ? 0.6 : 1 }}>
                    {genLoading ? 'AI 生成中...' : <><BotIcon size={14} color="#fff" /> AI 生成类似题目</>}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : !llmAvailable ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 20px', textAlign: 'center' }}>
            <BotIcon size={40} color="#9CA3AF" />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--app-text-heading)' }}>AI 出题功能暂不可用</div>
            <div style={{ fontSize: '13px', color: 'var(--app-text-muted)', lineHeight: 1.7, maxWidth: 360 }}>
              请先在「设置」中配置 DeepSeek 或 Qwen API Key，即可使用 AI 自动生成试卷题目。
            </div>
            <button onClick={() => window.open('/settings', '_blank')}
              style={{ padding: '10px 24px', background: 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              前往配置 API
            </button>
          </div>
        ) : (
          <div>
            {/* AI 出题 tab */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-body)', marginBottom: '6px' }}>试卷名称</div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="试卷名称"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
            </div>
            {aiMessages.length === 0 && !aiGeneratedQuestions.length ? (
              <div>
                <div style={{ padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, marginBottom: '12px', fontSize: '13px', color: 'var(--app-green-dark)', lineHeight: 1.6 }}>
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
                  style={{ width: '100%', padding: '12px', background: aiSending ? 'var(--app-text-muted)' : 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: aiSending ? 'not-allowed' : 'pointer', opacity: aiSending ? 0.6 : 1 }}>
                  {aiSending ? '连接中...' : <><BotIcon size={14} color="#fff" /> 开始 AI 出题</>}
                </button>
              </div>
            ) : (
              <div>
                {/* AI 对话区域 */}
                <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {aiMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: msg.role === 'user' ? 'var(--app-info)' : 'var(--app-bg-page)', color: msg.role === 'user' ? '#fff' : 'var(--app-text-heading)', fontSize: '13px', lineHeight: 1.6, wordBreak: 'break-word' }}>
                        {msg.role === 'user' ? (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                        ) : (
                          <MarkdownRenderer content={cleanAIMessage(msg.content)} />
                        )}
                      </div>
                    </div>
                  ))}
                  {aiSending && <div style={{ textAlign: 'center', color: 'var(--app-text-muted)', fontSize: '12px' }}>系统加载中...</div>}
                  <div ref={aiMessagesEndRef} />
                </div>

                {/* AI 生成题目预览 */}
                {aiGeneratedQuestions.length > 0 && (
                  <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-success)' }}>
                        <CheckCircleIcon size={14} color="#10B981" /> 已生成 {aiGeneratedQuestions.length} 道题（已选 {aiSelectedQuestions.size} 道）
                      </span>
                      <button onClick={() => {
                        if (aiSelectedQuestions.size === aiGeneratedQuestions.length) setAiSelectedQuestions(new Set())
                        else setAiSelectedQuestions(new Set(aiGeneratedQuestions.map((_, i) => i)))
                      }} style={{ fontSize: '12px', color: 'var(--app-info)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {aiSelectedQuestions.size === aiGeneratedQuestions.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    {aiGeneratedQuestions.map((q, i) => (
                      <div key={i} onClick={() => {
                        setAiSelectedQuestions(prev => {
                          const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
                        })
                      }} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: aiSelectedQuestions.has(i) ? 'var(--app-bg-card-alt)' : 'var(--app-bg-page)', borderRadius: 8, marginBottom: '4px', cursor: 'pointer', border: '1.5px solid', borderColor: aiSelectedQuestions.has(i) ? '#A5B4FC' : 'transparent', fontSize: '13px', color: 'var(--app-text-body)' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid', borderColor: aiSelectedQuestions.has(i) ? 'var(--app-info)' : 'var(--app-text-placeholder)', background: aiSelectedQuestions.has(i) ? 'var(--app-info)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                          {aiSelectedQuestions.has(i) ? <CheckIcon size={10} color="#fff" /> : ''}
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
                                type: q.type || 'single_choice', content: q.content || {},
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
                        style={{ flex: 1, padding: '12px', background: saving || aiSelectedQuestions.size === 0 ? 'var(--app-text-placeholder)' : 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, marginTop: '8px', cursor: saving || aiSelectedQuestions.size === 0 ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                        {saving ? '创建中...' : `创建试卷 (${aiSelectedQuestions.size} 题)`}
                      </button>
                      <button onClick={() => setAiRegenExpanded(!aiRegenExpanded)}
                        style={{ padding: '12px 16px', background: aiRegenExpanded ? 'var(--app-brand-bg)' : 'var(--app-bg-page)', color: 'var(--app-info)', border: '1.5px solid', borderColor: aiRegenExpanded ? '#A5B4FC' : 'transparent', borderRadius: 10, fontSize: '13px', marginTop: '8px', cursor: 'pointer', fontWeight: 500 }}>
                        重新生成 <ChevronDownIcon size={12} color="#1677E8" />
                      </button>
                    </div>

                    {/* ── AI regenerate feedback panel ── */}
                    {aiRegenExpanded && (
                      <div style={{ marginTop: '10px', padding: '14px', background: 'var(--app-bg-card-alt)', borderRadius: 12, border: '1.5px solid #E5E7EB' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>
                          你觉得哪里需要改进？
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {AI_PRESET_FEEDBACK.map(fb => (
                            <button key={fb.label} onClick={() => handleAiRegen(fb.msg)}
                              style={{ padding: '6px 14px', background: '#fff', color: 'var(--app-info)', border: '1.5px solid #C7D2FE', borderRadius: 20, fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-brand-bg)'; e.currentTarget.style.borderColor = '#818CF8' }}
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
                            style={{ padding: '8px 16px', background: aiSending || !aiRegenFeedback.trim() ? 'var(--app-text-placeholder)' : 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '13px', fontWeight: 500, cursor: aiSending || !aiRegenFeedback.trim() ? 'not-allowed' : 'pointer' }}>
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
                      style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', background: aiSending ? 'var(--app-bg-card-alt)' : '#fff' }} />
                    <button onClick={handleAiSend} disabled={aiSending || !aiInput.trim()}
                      style={{ padding: '10px 20px', background: aiSending || !aiInput.trim() ? 'var(--app-text-muted)' : 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '14px', fontWeight: 500, cursor: aiSending || !aiInput.trim() ? 'not-allowed' : 'pointer', opacity: aiSending || !aiInput.trim() ? 0.6 : 1 }}>
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
