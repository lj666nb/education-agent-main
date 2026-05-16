import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { questionBankApi, type QuestionItem, type DomainItem } from '../api/questionBank'
import QuestionCard, { type PracticeQuestion } from '../components/QuestionCard'
import MarkdownRenderer from '../components/MarkdownRenderer'
import ChatPanel from '../components/ChatPanel'

/* ── constants ── */
const QTYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'single_choice', label: '单选题' },
  { key: 'multiple_choice', label: '多选题' },
  { key: 'fill_blank', label: '填空题' },
  { key: 'true_false', label: '判断题' },
  { key: 'short_answer', label: '简答题' },
  { key: 'programming', label: '编程题' },
  { key: 'essay', label: '论述题' },
]
const TIME_OPTIONS = [
  { value: null, label: '不限时' },
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '60 分钟' },
]
const QTYPE_LABELS: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}
const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛',
}

/* ── helpers ── */
const mapToPractice = (q: QuestionItem): PracticeQuestion => ({
  id: q.id,
  type: q.type,
  content: { stem: q.content?.stem || '', options: q.content?.options, code_template: q.content?.code_template },
  difficulty: q.difficulty,
  tags: q.tags,
  answer: q.answer || { correct_answer: [], explanation: '' },
})

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ── page component ── */
type Phase = 'config' | 'practice' | 'results'

interface AnswerRecord {
  questionId: string
  answerContent: string
  isCorrect: boolean
  timeSpent: number
}

export default function PracticePage() {
  const { bankId } = useParams<{ bankId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // ── common state ──
  const [phase, setPhase] = useState<Phase>('config')
  const [loading, setLoading] = useState(true)
  const [bankName, setBankName] = useState('')
  const [domains, setDomains] = useState<DomainItem[]>([])
  const [error, setError] = useState('')

  // ── config state ──
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([])
  const [onlyUnanswered, setOnlyUnanswered] = useState(false)
  const [onlyWrong, setOnlyWrong] = useState(false)
  const [answerMode, setAnswerMode] = useState<'during' | 'after'>('during')
  const [domainCounts, setDomainCounts] = useState<{ domain_id: string; domain_name: string; total: number; unanswered: number; wrong: number }[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)  // 结果页回看模式，显示答案

  // ── practice state ──
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [practiceStartTime, setPracticeStartTime] = useState<number>(0)
  const [showChat, setShowChat] = useState(false)
  const [chatQId, setChatQId] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── results state ──
  const [submittingAll, setSubmittingAll] = useState(false)

  // ── load bank info for config or restore exam session ──
  useEffect(() => {
    if (!bankId) { navigate('/banks'); return }
    const sessionIdParam = searchParams.get('session_id')
    if (sessionIdParam) {
      loadSessionQuestions(sessionIdParam)
      return
    }
    loadBankData()
  }, [bankId])

  const loadBankData = async () => {
    setLoading(true)
    setError('')
    try {
      const bRes = await questionBankApi.getBank(bankId!)
      setBankName(bRes.data.name)
      // 加载学科下的章节（domains）
      const subRes = await questionBankApi.getSubject(bRes.data.subject_id)
      setDomains(subRes.data.domains || [])
    } catch {
      navigate('/banks')
      return
    }
    setLoading(false)
  }

  // ── restore exam session from session_id ──
  const loadSessionQuestions = async (sid: string) => {
    setLoading(true)
    try {
      const sessionRes = await questionBankApi.getPracticeSession(sid)
      const session = sessionRes.data
      if (!session.question_order?.length) {
        setError('该试卷没有题目'); setLoading(false); return
      }
      const timeLimit = session.stats?.time_limit_minutes || null
      const answerMode = session.answer_mode || 'after'

      const qRes = await questionBankApi.listQuestions(session.bank_id, { page_size: 100 })
      const qMap = new Map(qRes.data.questions.map((q: QuestionItem) => [q.id, q]))
      const ordered: QuestionItem[] = []
      for (const qid of session.question_order) {
        const q = qMap.get(qid)
        if (q) ordered.push(q)
      }
      if (ordered.length === 0) {
        setError('该试卷未找到题目'); setLoading(false); return
      }
      setQuestions(ordered.map(mapToPractice))
      setSessionId(sid)
      setAnswerMode(answerMode)
      setTimeLimit(timeLimit)
      setPhase('practice')
    } catch { setError('加载练习会话失败') }
    setLoading(false)
  }

  // ── load domain counts when filters change or config loads ──
  useEffect(() => {
    if (phase !== 'config' || !bankId) return
    if (loading) return  // 等待初始加载完成
    const timer = setTimeout(() => {
      loadDomainCounts()
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedDomainIds, selectedTypes, onlyUnanswered, onlyWrong, bankId, phase, loading])

  const loadDomainCounts = async () => {
    if (!bankId) return
    try {
      const res = await questionBankApi.getDomainCounts(bankId, {
        question_types: selectedTypes,
        domain_ids: selectedDomainIds,
        only_unanswered: onlyUnanswered,
        only_wrong: onlyWrong,
      })
      setDomainCounts(res.data)
    } catch { /* ignore */ }
  }

  // 计算总的可用题数（只统计已选章节，未选则全统计）
  const totalAvailable = selectedDomainIds.length > 0
    ? domainCounts.filter(d => selectedDomainIds.includes(d.domain_id)).reduce((sum, d) => sum + d.total, 0)
    : domainCounts.reduce((sum, d) => sum + d.total, 0)

  // ── timer effect ──
  useEffect(() => {
    if (phase !== 'practice' || timeLeft === null) return
    if (timeLeft <= 0) {
      handleEndPractice()
      return
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, timeLeft])

  // ── start practice ──
  const handleStartPractice = async () => {
    setLoading(true)
    setError('')
    try {
      // 如果请求数量超过可用数量，自动调整为可用数量
      let actualCount = questionCount
      if (actualCount && totalAvailable > 0 && actualCount > totalAvailable) {
        actualCount = totalAvailable
      }

      const res = await questionBankApi.startPractice(bankId!, {
        time_limit_minutes: timeLimit,
        question_count: actualCount,
        question_types: selectedTypes,
        domain_ids: selectedDomainIds,
        only_unanswered: onlyUnanswered,
        only_wrong: onlyWrong,
        answer_mode: answerMode,
      })
      const qs = res.data.map(mapToPractice)
      if (qs.length === 0) {
        setError('没有符合条件的题目，请调整筛选条件')
        setLoading(false)
        return
      }
      setQuestions(qs)
      setCurrentIndex(0)
      setAnswers([])
      setPracticeStartTime(Date.now())
      setTimeLeft(timeLimit ? timeLimit * 60 : null)
      setReviewMode(false)

      // 创建练习会话
      try {
        const sessionRes = await questionBankApi.createPracticeSession(bankId!, {
          mode: 'random',
          answer_mode: answerMode,
          question_order: qs.map(q => q.id),
        })
        setSessionId(sessionRes.data.id)
      } catch { /* session 创建失败不影响做题 */ }

      setPhase('practice')
    } catch {
      setError('获取练习题目失败，请重试')
    }
    setLoading(false)
  }

  // ── handle answer from QuestionCard ──
  const handleAnswer = (answer: string, isCorrect: boolean) => {
    const currentQ = questions[currentIndex]
    if (!currentQ) return
    const timeSpent = Math.round((Date.now() - practiceStartTime) / 1000)
    // 记录答案
    const record: AnswerRecord = {
      questionId: currentQ.id,
      answerContent: answer,
      isCorrect,
      timeSpent,
    }
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === currentQ.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = record
        return updated
      }
      return [...prev, record]
    })
    // 提交到后端
    questionBankApi.submitAnswer(currentQ.id, {
      answer_content: { user_answer: answer },
      is_correct: isCorrect,
      time_spent_seconds: timeSpent,
    }).catch(() => {})
  }

  // ── end practice ──
  const handleEndPractice = async () => {
    if (submittingAll) return
    setSubmittingAll(true)
    // 停止计时器
    if (timerRef.current) clearInterval(timerRef.current)
    // 如果有未记录的答案，批量提交
    const unsubmitted = answers.filter(a => a.questionId)
    if (unsubmitted.length > 0) {
      try {
        await questionBankApi.submitAnswers(bankId!, {
          answers: unsubmitted.map(a => ({
            question_id: a.questionId,
            answer_content: { user_answer: a.answerContent },
            is_correct: a.isCorrect,
            time_spent_seconds: a.timeSpent,
          })),
        })
      } catch { /* ignore */ }
    }

    // 结束练习会话
    if (sessionId) {
      try {
        const correctCount = answers.filter(a => a.isCorrect).length
        await questionBankApi.updatePracticeSession(sessionId, {
          status: 'completed',
          current_index: currentIndex,
          stats: {
            total: questions.length,
            completed: answers.length,
            correct: correctCount,
            incorrect: answers.length - correctCount,
          },
          finished_at: new Date().toISOString(),
        })
      } catch { /* ignore */ }
    }

    setSubmittingAll(false)
    setPhase('results')
  }

  // ── navigation ──
  const goNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(i => i + 1)
  }
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  // ── restart ──
  const handleRestart = (presetWrong = false) => {
    if (presetWrong) {
      setOnlyWrong(true)
      setOnlyUnanswered(false)
    } else {
      setOnlyWrong(false)
      setOnlyUnanswered(false)
    }
    setQuestions([])
    setAnswers([])
    setTimeLeft(null)
    setReviewMode(false)
    setPhase('config')
  }

  // ── toggle domain selection ──
  const toggleDomain = (id: string) => {
    setSelectedDomainIds(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  // ── toggle type selection ──
  const toggleType = (key: string) => {
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    )
  }

  // ── get answered status ──
  const getAnswerForQuestion = (qid: string) => answers.find(a => a.questionId === qid)

  const answeredCount = answers.length
  const totalQs = questions.length
  const correctCount = answers.filter(a => a.isCorrect).length
  const wrongCount = answeredCount - correctCount

  const currentQ = questions[currentIndex]
  const totalTimeSpent = answers.length > 0
    ? Math.max(...answers.map(a => a.timeSpent))
    : 0

  // ═══════════════════════ RENDER ═══════════════════════

  if (loading && phase === 'config') {
    return (
      <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
        加载中...
      </div>
    )
  }

  /* ────────────── CONFIG PHASE ────────────── */
  if (phase === 'config') {
    return (
      <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '24px 16px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ color: '#1E3A8A', cursor: 'pointer', fontSize: '13px' }} onClick={() => navigate(`/banks/${bankId}`)}>← 返回题库</span>
            <span style={{ padding: '4px 16px', background: '#EEF2FF', borderRadius: 14, fontSize: '12px', color: '#1E3A8A', fontWeight: 500 }}>{bankName}</span>
          </div>

          {/* config card */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1F2937', margin: '0 0 24px' }}>自测设置</h2>

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 12, color: '#EF4444', fontSize: '14px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            {/* 时间限制 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>时间限制</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {TIME_OPTIONS.map(opt => (
                  <button key={opt.label} onClick={() => setTimeLimit(opt.value)}
                    style={{
                      padding: '8px 18px', border: '2px solid', borderRadius: 20, fontSize: '13px', cursor: 'pointer',
                      background: timeLimit === opt.value ? 'rgba(30,58,138,0.1)' : '#F9FAFB',
                      borderColor: timeLimit === opt.value ? '#1E3A8A' : '#E5E7EB',
                      color: timeLimit === opt.value ? '#1E3A8A' : '#6B7280',
                      fontWeight: timeLimit === opt.value ? 600 : 400,
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 题目数量 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>题目数量</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="number" min={1}
                  value={questionCount ?? ''}
                  onChange={e => setQuestionCount(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="全部题目"
                  style={{ width: 120, padding: '10px 14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '14px', outline: 'none' }} />
                <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
                  道（共 {totalAvailable} 题{onlyUnanswered ? '未做' : onlyWrong ? '错题' : ''}可用，留空=全部）
                </span>
                {questionCount && totalAvailable > 0 && questionCount > totalAvailable && (
                  <div style={{ fontSize: '12px', color: '#F59E0B', marginTop: '6px' }}>
                    可用题目不足，将自动调整为 {totalAvailable} 题
                  </div>
                )}
              </div>
            </div>

            {/* 题型 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>题目种类</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {QTYPE_OPTIONS.map(opt => {
                  const sel = selectedTypes.includes(opt.key)
                  return (
                    <button key={opt.key} onClick={() => toggleType(opt.key)}
                      style={{
                        padding: '8px 16px', border: '2px solid', borderRadius: 20, fontSize: '13px', cursor: 'pointer',
                        background: sel ? 'rgba(30,58,138,0.1)' : '#F9FAFB',
                        borderColor: sel ? '#1E3A8A' : '#E5E7EB',
                        color: sel ? '#1E3A8A' : '#6B7280',
                        fontWeight: sel ? 600 : 400,
                      }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 章节 */}
            {domains.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                  章节
                  {totalAvailable > 0 && (
                    <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: '8px', fontSize: '13px' }}>
                      （共 {totalAvailable} 题可用）
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {domains.map(d => {
                    const sel = selectedDomainIds.includes(d.id)
                    const countInfo = domainCounts.find(c => c.domain_id === d.id)
                    const count = countInfo?.total ?? 0
                    return (
                      <button key={d.id} onClick={() => toggleDomain(d.id)}
                        style={{
                          padding: '8px 16px', border: '2px solid', borderRadius: 20, fontSize: '13px', cursor: 'pointer',
                          background: sel ? 'rgba(16,185,129,0.1)' : '#F9FAFB',
                          borderColor: sel ? '#10B981' : '#E5E7EB',
                          color: sel ? '#10B981' : '#6B7280',
                          fontWeight: sel ? 600 : 400,
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                        {d.name}
                        {count > 0 && (
                          <span style={{
                            fontSize: '11px', padding: '0 8px', borderRadius: 8,
                            background: sel ? 'rgba(16,185,129,0.15)' : '#E5E7EB',
                            color: sel ? '#10B981' : '#9CA3AF',
                            fontWeight: 600,
                          }}>
                            {count}
                          </span>
                        )}
                        {count === 0 && (
                          <span style={{ fontSize: '11px', color: '#D1D5DB' }}>0</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 只做未做的 / 只做错题 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>答题范围</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <input type="checkbox" checked={onlyUnanswered}
                    onChange={e => { setOnlyUnanswered(e.target.checked); if (e.target.checked) setOnlyWrong(false) }} />
                  只做未做过的
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <input type="checkbox" checked={onlyWrong}
                    onChange={e => { setOnlyWrong(e.target.checked); if (e.target.checked) setOnlyUnanswered(false) }} />
                  只做错题
                </label>
              </div>
            </div>

            {/* 答案显示模式 */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>测试模式</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label onClick={() => setAnswerMode('during')} style={{
                  flex: 1, padding: '14px 16px', border: '2px solid', borderRadius: 12, cursor: 'pointer',
                  background: answerMode === 'during' ? 'rgba(30,58,138,0.06)' : '#F9FAFB',
                  borderColor: answerMode === 'during' ? '#1E3A8A' : '#E5E7EB',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                    borderColor: answerMode === 'during' ? '#1E3A8A' : '#D1D5DB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {answerMode === 'during' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1E3A8A' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>边测边看答案</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>每道题提交后立即显示答案和解析</div>
                  </div>
                </label>
                <label onClick={() => setAnswerMode('after')} style={{
                  flex: 1, padding: '14px 16px', border: '2px solid', borderRadius: 12, cursor: 'pointer',
                  background: answerMode === 'after' ? 'rgba(30,58,138,0.06)' : '#F9FAFB',
                  borderColor: answerMode === 'after' ? '#1E3A8A' : '#E5E7EB',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                    borderColor: answerMode === 'after' ? '#1E3A8A' : '#D1D5DB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {answerMode === 'after' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1E3A8A' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>测后看答案</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>全部提交后统一查看答案和解析</div>
                  </div>
                </label>
              </div>
            </div>

            {/* start button */}
            <button onClick={handleStartPractice} disabled={loading}
              style={{
                width: '100%', padding: '14px', background: '#10B981', color: '#fff', border: 'none',
                borderRadius: 12, fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}>
              {loading ? '加载中...' : '开始练习'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ────────────── PRACTICE PHASE ────────────── */
  if (phase === 'practice') {
    return (
      <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '12px 16px 100px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 12px' }}>
            <span style={{ color: '#1E3A8A', cursor: 'pointer', fontSize: '13px' }} onClick={handleEndPractice}>← 交卷</span>
            <span style={{ padding: '4px 16px', background: '#EEF2FF', borderRadius: 14, fontSize: '12px', color: '#1E3A8A', fontWeight: 500 }}>{bankName}</span>
          </div>

          {/* timer + progress */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            {/* progress bar */}
            <div style={{ flex: 1, marginRight: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                <span>进度: {answeredCount}/{totalQs}</span>
                <span>{Math.round((answeredCount / totalQs) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(answeredCount / totalQs) * 100}%`, background: '#10B981', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
            {/* timer */}
            {timeLeft !== null && (
              <div style={{
                padding: '6px 16px', borderRadius: 20,
                background: timeLeft <= 60 ? 'rgba(239,68,68,0.1)' : 'rgba(30,58,138,0.1)',
                color: timeLeft <= 60 ? '#EF4444' : '#1E3A8A',
                fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap',
              }}>
                {formatTime(timeLeft)}
              </div>
            )}
          </div>

          {/* question nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginBottom: '8px' }}>
            <span onClick={goPrev}
              style={{
                color: currentIndex > 0 ? '#1E3A8A' : '#D1D5DB',
                cursor: currentIndex > 0 ? 'pointer' : 'default',
                fontSize: '13px', padding: '8px 12px',
              }}>
              ← 上一题
            </span>
            {/* question dots */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
              {questions.map((q, i) => {
                const ans = getAnswerForQuestion(q.id)
                let dotColor = '#E5E7EB' // unanswered
                if (ans) dotColor = ans.isCorrect ? '#10B981' : '#EF4444'
                return (
                  <div key={q.id} onClick={() => setCurrentIndex(i)}
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: i === currentIndex ? '#1E3A8A' : dotColor,
                      cursor: 'pointer', transition: 'all 0.15s',
                      border: i === currentIndex ? '2px solid #1E3A8A' : 'none',
                    }} />
                )
              })}
            </div>
            <span onClick={goNext}
              style={{
                color: currentIndex < totalQs - 1 ? '#1E3A8A' : '#D1D5DB',
                cursor: currentIndex < totalQs - 1 ? 'pointer' : 'default',
                fontSize: '13px', padding: '8px 12px',
              }}>
              下一题 →
            </span>
          </div>

          {/* question card */}
          {currentQ && (
            <QuestionCard
              key={currentQ.id}
              question={currentQ}
              onSubmit={handleAnswer}
              onAskAI={() => { setChatQId(currentQ.id); setShowChat(true) }}
              hideAnswer={answerMode === 'after' && !reviewMode}
            />
          )}

          {/* bottom info bar */}
          <div style={{ display: 'flex', gap: '24px', padding: '14px 18px', background: '#fff', borderRadius: 12, marginTop: '4px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>题型：</span>
              <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{QTYPE_LABELS[currentQ?.type] || '未知'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>难度：</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>
                {DIFF_LABELS[currentQ?.difficulty] || currentQ?.difficulty}
              </span>
            </div>
          </div>
        </div>

        <ChatPanel visible={showChat} questionId={chatQId} recommendedLevel="L2" onClose={() => setShowChat(false)} />
      </div>
    )
  }

  /* ────────────── RESULTS PHASE ────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ color: '#1E3A8A', cursor: 'pointer', fontSize: '13px' }} onClick={() => navigate(`/banks/${bankId}`)}>← 返回题库</span>
          <span style={{ padding: '4px 16px', background: '#EEF2FF', borderRadius: 14, fontSize: '12px', color: '#1E3A8A', fontWeight: 500 }}>{bankName}</span>
        </div>

        {/* summary card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>
            {correctCount === totalQs && totalQs > 0 ? '🎉' : wrongCount === 0 && totalQs > 0 ? '👍' : '💪'}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1F2937', margin: '0 0 16px' }}>练习完成！</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#10B981' }}>{correctCount}</div>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>正确</div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#EF4444' }}>{wrongCount}</div>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>错误</div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1E3A8A' }}>
                {totalQs > 0 ? Math.round((correctCount / totalQs) * 100) : 0}%
              </div>
              <div style={{ fontSize: '13px', color: '#9CA3AF' }}>正确率</div>
            </div>
          </div>
          {timeLimit && (
            <div style={{ fontSize: '13px', color: '#6B7280' }}>
              用时: {formatTime(totalTimeSpent)} / {formatTime(timeLimit * 60)}
            </div>
          )}

          {/* action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
            <button onClick={() => handleRestart(false)}
              style={{ padding: '10px 24px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
              重新练习
            </button>
            {wrongCount > 0 && (
              <button onClick={() => handleRestart(true)}
                style={{ padding: '10px 24px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                练习错题
              </button>
            )}
            <button onClick={() => navigate(`/banks/${bankId}`)}
              style={{ padding: '10px 24px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
              返回题库
            </button>
          </div>
        </div>

        {/* question review list */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: '0 0 16px' }}>答题详情</h3>
          {questions.map((q, i) => {
            const ans = getAnswerForQuestion(q.id)
            return (
              <div key={q.id} onClick={() => { setCurrentIndex(i); setReviewMode(true); setPhase('practice') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  background: i % 2 === 0 ? '#F9FAFB' : '#fff',
                  marginBottom: '4px',
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 600,
                  background: !ans ? '#E5E7EB' : ans.isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: !ans ? '#9CA3AF' : ans.isCorrect ? '#10B981' : '#EF4444',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: '14px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <MarkdownRenderer content={q.content.stem || '无题干'} />
                </div>
                <div style={{
                  fontSize: '11px', padding: '2px 10px', borderRadius: 10,
                  background: !ans ? '#F3F4F6' : ans.isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: !ans ? '#9CA3AF' : ans.isCorrect ? '#10B981' : '#EF4444',
                  fontWeight: 500,
                }}>
                  {!ans ? '未答' : ans.isCorrect ? '正确' : '错误'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
