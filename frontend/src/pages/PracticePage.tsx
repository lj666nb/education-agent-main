import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { questionBankApi, type QuestionItem, type DomainItem } from '../api/questionBank'
import QuestionCard, { type PracticeQuestion } from '../components/QuestionCard'
import MarkdownRenderer from '../components/MarkdownRenderer'
import PracticeRecommendPopover from '../components/PracticeRecommendPopover'
import ChapterCompletePopover from '../components/ChapterCompletePopover'
import { ArrowLeftIcon, ArrowRightIcon, StarIcon, CheckIcon, ZapIcon } from '../components/Icons'
import { formatSeconds } from '../utils/time'
import { QTYPE_LABELS, DIFF_LABELS, getDifficultyLabel } from '../constants/labels'

/* ── constants ── */
const QTYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'single_choice', label: '单选题' },
  { key: 'multiple_choice', label: '多选题' },
  { key: 'fill_blank', label: '填空题' },
  { key: 'true_false', label: '判断题' },
  { key: 'programming', label: '编程题' },
]
const TIME_OPTIONS = [
  { value: null, label: '不限时' },
  { value: 5, label: '5 分钟' },
  { value: 10, label: '10 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '60 分钟' },
]

/* ── helpers ── */
const SUBJECTIVE_TYPES = ['short_answer', 'essay']
const mapToPractice = (q: QuestionItem): PracticeQuestion => ({
  id: q.id,
  type: q.type,
  content: { stem: q.content?.stem || '', options: q.content?.options, code_template: q.content?.code_template },
  difficulty: q.difficulty,
  tags: q.tags,
  answer: q.answer || { correct_answer: [], explanation: '' },
})

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

  // Determine the return destination based on the point query parameter
  const pointParam = searchParams.get('point')
  const stateIdParam = searchParams.get('state')
  const goBack = () => {
    if (pointParam) {
      const backUrl = `/path/knowledge/${encodeURIComponent(pointParam)}${stateIdParam ? `?state=${encodeURIComponent(stateIdParam)}` : ''}`
      navigate(backUrl)
    } else if (sessionMode === 'wrong_answer') {
      navigate('/review')
    } else {
      navigate(`/banks/${bankId}`)
    }
  }

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
  const [onlyErrorProne, setOnlyErrorProne] = useState(false)
  const [answerMode, setAnswerMode] = useState<'during' | 'after'>('during')
  const [domainCounts, setDomainCounts] = useState<{ domain_id: string; domain_name: string; total: number; unanswered: number; wrong: number }[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionMode, setSessionMode] = useState<string>('')
  const [reviewMode, setReviewMode] = useState(false)  // 结果页回看模式，显示答案

  // ── practice state ──
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [practiceStartTime, setPracticeStartTime] = useState<number>(0)
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionCardRef = useRef<any>(null)
  const practiceStateRef = useRef<any>(null)
  const autoStartedRef = useRef(false)

  // ── results state ──
  const [submittingAll, setSubmittingAll] = useState(false)
  const [showRecommend, setShowRecommend] = useState(false)
  const [wrongKps, setWrongKps] = useState<string[]>([])

  // ── 知识点专项练习选择弹窗 ──
  const [batchChoice, setBatchChoice] = useState(false)

  // ── 章节完成弹窗 ──
  const [domainComplete, setDomainComplete] = useState<{
    domainId: string; domainName: string; wrongCount: number; allDone: boolean
  } | null>(null)

  // ── self-grade state ──
  const [showSelfGrade, setShowSelfGrade] = useState(false)
  const [currentGradeIndex, setCurrentGradeIndex] = useState(0)
  const [selfGrades, setSelfGrades] = useState<Record<string, number>>({})
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<{
    answer_id: string
    question_id: string
    question: PracticeQuestion
    userAnswer: string
    correctAnswer: string
  }[]>([])
  const [gradingSubmitted, setGradingSubmitted] = useState(false)

  // ── review-mode self-grade state ──
  const [reviewSelfGrades, setReviewSelfGrades] = useState<Record<string, { grade: number; submitted: boolean }>>({})
  const [reviewGradeLoading, setReviewGradeLoading] = useState(false)

  // Keep practiceStateRef current for save-on-unmount
  useEffect(() => {
    if (phase === 'practice') {
      practiceStateRef.current = { questions, currentIndex, answers, timeLeft, practiceStartTime, sessionId, answerMode, reviewMode, bankId, bankName }
    } else {
      practiceStateRef.current = null
    }
  })

  // Save practice state only on page refresh (beforeunload), not on SPA unmount
  useEffect(() => {
    const save = () => {
      if (practiceStateRef.current) {
        sessionStorage.setItem('practice_state', JSON.stringify(practiceStateRef.current))
      }
    }
    window.addEventListener('beforeunload', save)
    return () => {
      window.removeEventListener('beforeunload', save)
    }
  }, [])

  // ── load bank info, restore exam session, or restore saved practice state ──
  useEffect(() => {
    if (!bankId) { navigate('/banks'); return }

    const sessionIdParam = searchParams.get('session_id')
    const pointParam = searchParams.get('point')

    // 仅页面刷新（F5）时从 sessionStorage 恢复进度
    // SPA 导航到练习页始终显示配置界面
    let isReload = false
    try {
      const navEntries = performance.getEntriesByType('navigation')
      if (navEntries.length > 0) {
        isReload = (navEntries[0] as any).type === 'reload'
      }
    } catch {}

    if (!sessionIdParam && !pointParam && isReload) {
      const savedState = sessionStorage.getItem('practice_state')
      if (savedState) {
        try {
          const state = JSON.parse(savedState)
          if (state.bankId === bankId && state.questions?.length > 0) {
            setQuestions(state.questions)
            setCurrentIndex(state.currentIndex || 0)
            setAnswers(state.answers || [])
            setTimeLeft(state.timeLeft)
            setPracticeStartTime(state.practiceStartTime > 0 ? state.practiceStartTime : Date.now())
            setSessionId(state.sessionId)
            setAnswerMode(state.answerMode || 'during')
            setReviewMode(state.reviewMode || false)
            setBankName(state.bankName || '')
            setPhase('practice')
            setLoading(false)
            sessionStorage.removeItem('practice_state')
            return
          }
        } catch {}
      }
    }
    // 非页面刷新时，清除旧状态
    sessionStorage.removeItem('practice_state')

    if (sessionIdParam) {
      const reviewParam = searchParams.get('review')
      loadSessionQuestions(sessionIdParam, reviewParam === '1')
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

  // ── point 参数：加载知识点名称和题目总数用于展示和进度跟踪 ──
  const [pointName, setPointName] = useState('')
  const [totalPointQuestions, setTotalPointQuestions] = useState(0)
  const [practicedPointQuestions, setPracticedPointQuestions] = useState(0)
  useEffect(() => {
    if (!bankId) return
    const pt = searchParams.get('point')
    if (pt) {
      const token = localStorage.getItem('access_token')
      fetch(`/api/v1/path/knowledge/${pt}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(d => {
        if (d.point_name) setPointName(d.point_name)
        if (d.total_questions) setTotalPointQuestions(d.total_questions)
        if (d.total_practiced !== undefined) setPracticedPointQuestions(d.total_practiced)
      }).catch(() => {})
    }
  }, [bankId])

  // ── auto-start practice when `point` param is present (来自学习路径等外部跳转) ──
  useEffect(() => {
    if (!bankId || phase !== 'config' || loading || autoStartedRef.current) return
    const pt = searchParams.get('point')
    if (!pt) return
    // 等 loading 结束后自动开始练习（每次5题）
    autoStartedRef.current = true
    handleStartPractice({ questionCount: 5, onlyUnanswered: true })
  }, [phase, loading, bankId])

  // ── auto-start practice when `domain_ids` param is present (来自专项刷题) ──
  useEffect(() => {
    if (!bankId || phase !== 'config' || loading || autoStartedRef.current) return
    const domainIds = searchParams.get('domain_ids')
    if (!domainIds) return
    autoStartedRef.current = true
    handleStartPractice()
  }, [phase, loading, bankId])

  // ── restore exam session from session_id ──
  const loadSessionQuestions = async (sid: string, isReview = false) => {
    setLoading(true)
    try {
      const sessionRes = await questionBankApi.getPracticeSession(sid)
      const session = sessionRes.data
      setSessionMode(session.mode || '')
      if (!session.question_order?.length) {
        setError('该试卷没有题目'); setLoading(false); return
      }

      // 按会话保存的 UUID 精确读取，避免题库分页导致试卷题目缺失或变化。
      const qRes = await questionBankApi.getPracticeSessionQuestions(sid)
      const ordered: QuestionItem[] = qRes.data
      if (ordered.length === 0) {
        setError('该试卷未找到题目'); setLoading(false); return
      }

      // 加载已保存的答案
      let savedAnswers: AnswerRecord[] = []
      try {
        const ansRes = await questionBankApi.getSessionAnswers(sid)
        savedAnswers = ansRes.data.items
          .filter(item => item.question)
          .map(item => ({
            questionId: item.question_id,
            answerContent: item.answer_content?.user_answer || '',
            isCorrect: item.is_correct,
            timeSpent: item.time_spent_seconds || 0,
          }))
      } catch {}

      setQuestions(ordered.map(mapToPractice))
      setAnswers(savedAnswers)
      setSessionId(sid)
      setReviewSelfGrades({})
      if (isReview) {
        // 回看模式：显示答案，不可交卷
        setAnswerMode('during')
        setReviewMode(true)
        setTimeLimit(null)
        setPracticeStartTime(0)
      } else {
        // 继续练习模式：从已保存进度继续作答（如错题练习）
        setAnswerMode(session.answer_mode || 'during')
        setReviewMode(false)
        setTimeLimit(null)
        setPracticeStartTime(Date.now())
      }
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
      const pointParam = searchParams.get('point')
      const res = await questionBankApi.getDomainCounts(bankId, {
        question_types: selectedTypes,
        domain_ids: selectedDomainIds,
        knowledge_point_uuids: pointParam ? [pointParam] : [],
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
  const handleStartPractice = async (overrideConfig?: {
    questionCount?: number | null
    onlyUnanswered?: boolean
    onlyWrong?: boolean
    forceUnanswered?: boolean
  }) => {
    setLoading(true)
    setError('')
    try {
      const pointParam = searchParams.get('point')
      const knowledgePointUuids = pointParam ? [pointParam] : []
      // 从知识点进入的专项练习：每次默认5题
      const defaultCount = pointParam ? 5 : null
      const useQuestionCount = overrideConfig?.questionCount ?? questionCount ?? defaultCount
      const useOnlyUnanswered = overrideConfig?.onlyUnanswered ?? onlyUnanswered
      const useOnlyWrong = overrideConfig?.onlyWrong ?? onlyWrong
      // 如果请求数量超过可用数量，自动调整为可用数量
      let actualCount = useQuestionCount
      if (actualCount && totalAvailable > 0 && actualCount > totalAvailable) {
        actualCount = totalAvailable
      }

      const domainIdsParam = searchParams.get('domain_ids')
      const domainIdsToUse = domainIdsParam ? domainIdsParam.split(',').filter(Boolean) : selectedDomainIds
      // 专项刷题不过滤题型，保证与章节目录显示的题目数量一致
      const typesToUse = domainIdsParam ? [] : selectedTypes
      const res = await questionBankApi.startPractice(bankId!, {
        time_limit_minutes: timeLimit,
        question_count: actualCount,
        question_types: typesToUse,
        domain_ids: domainIdsToUse,
        knowledge_point_uuids: knowledgePointUuids,
        only_unanswered: useOnlyUnanswered,
        only_wrong: useOnlyWrong,
        only_error_prone: onlyErrorProne,
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
  const handleAnswer = (answer: string, isCorrect: boolean, skipBackend = false) => {
    const currentQ = questions[currentIndex]
    if (!currentQ) return
    // 主观题跳过客户端严格对比，统一标记为错误，由用户自评
    if (SUBJECTIVE_TYPES.includes(currentQ.type)) isCorrect = false
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
    // 记录答案
    const record: AnswerRecord = {
      questionId: currentQ.id,
      answerContent: answer,
      isCorrect,
      timeSpent,
    }
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === currentQ.id)
      let updated
      if (existing >= 0) {
        updated = [...prev]
        updated[existing] = record
      } else {
        updated = [...prev, record]
      }
      // 实时保存到 sessionStorage，刷新页面后恢复
      try {
        const state = practiceStateRef.current
        if (state) {
          state.answers = updated
          sessionStorage.setItem('practice_state', JSON.stringify(state))
        }
      } catch {}
      return updated
    })
    // 仅在非跳过模式下提交到后端（during 模式提交，after 模式仅在交卷时提交）
    // 回看模式下不提交到后端（避免修改旧记录）
    if (!skipBackend && !reviewMode) {
      questionBankApi.submitAnswer(currentQ.id, {
        answer_content: { user_answer: answer },
        is_correct: isCorrect,
        time_spent_seconds: timeSpent,
        session_id: sessionId,
      }).catch(() => {})
    }
    // 回看模式下重做主观题时清除之前的自评记录
    if (reviewMode && SUBJECTIVE_TYPES.includes(currentQ.type)) {
      setReviewSelfGrades(prev => {
        if (prev[currentQ.id]) {
          const updated = { ...prev }
          delete updated[currentQ.id]
          return updated
        }
        return prev
      })
    }
  }

  // ── end practice ──
  const handleEndPractice = async () => {
    if (submittingAll) return
    setSubmittingAll(true)
    // 停止计时器
    if (timerRef.current) clearInterval(timerRef.current)

    // 获取当前题的答案（无论哪种模式，确保最后一题被正确统计）
    let currentAnswer: AnswerRecord | null = null
    if (currentQ) {
      const sel = questionCardRef.current?.getCurrentAnswer?.()
      if (sel) {
        // 内联判断正确性（复用 QuestionCard 的 checkAnswer 逻辑）
        let ca = currentQ.answer?.correct_answer
        if (!Array.isArray(ca)) ca = ca ? [String(ca)] : []
        let isCorrect = false
        if (ca.length > 0) {
          if (currentQ.type === 'multiple_choice') {
            const ua = sel.split(',').map((s: string) => s.trim().toUpperCase()).sort()
            const caSorted = ca.map((s: string) => s.trim().toUpperCase()).sort()
            isCorrect = ua.length === caSorted.length && ua.every((v: string, i: number) => v === caSorted[i])
          } else {
            isCorrect = ca.some(c => c.trim().toUpperCase() === sel.trim().toUpperCase())
          }
        }
        // 主观题跳过客户端对比，标记为错误由用户自评
        if (SUBJECTIVE_TYPES.includes(currentQ.type)) isCorrect = false

        const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
        currentAnswer = { questionId: currentQ.id, answerContent: sel, isCorrect, timeSpent }

        // 更新本地 answers（setAnswers 是异步的，下面用 currentAnswer 手动合并）
        setAnswers(prev => {
          const existing = prev.findIndex(a => a.questionId === currentQ.id)
          const record: AnswerRecord = { questionId: currentQ.id, answerContent: sel, isCorrect, timeSpent }
          if (existing >= 0) {
            const updated = [...prev]; updated[existing] = record; return updated
          }
          return [...prev, record]
        })

        // 非回看模式下提交到后端
        if (!reviewMode) {
          questionBankApi.submitAnswer(currentQ.id, {
            answer_content: { user_answer: sel },
            is_correct: isCorrect,
            time_spent_seconds: timeSpent,
            session_id: sessionId,
          }).catch(() => {})
        }
      }
    }

    // 合并已记录的答案 + 当前题答案（用于统计，不受 setAnswers 异步影响）
    const allAnswersRaw = currentAnswer
      ? (answers.some(a => a.questionId === currentAnswer.questionId) ? answers : [...answers, currentAnswer])
      : answers

    // 重新校验所有答案的 isCorrect（修复 after 模式硬编码 false 的问题）
    const allAnswers = allAnswersRaw.map(a => {
      const q = questions.find(q => q.id === a.questionId)
      if (!q || !a.answerContent || SUBJECTIVE_TYPES.includes(q.type)) return a
      let ca = q.answer?.correct_answer
      if (!Array.isArray(ca)) ca = ca ? [String(ca)] : []
      if (!ca.length) return a
      if (q.type === 'multiple_choice') {
        const ua = a.answerContent.split(',').map(s => s.trim().toUpperCase()).sort()
        const caSorted = ca.map(s => s.trim().toUpperCase()).sort()
        return { ...a, isCorrect: ua.length === caSorted.length && ua.every((v, i) => v === caSorted[i]) }
      }
      return { ...a, isCorrect: ca.some(c => c.trim().toUpperCase() === a.answerContent.trim().toUpperCase()) }
    })

    // 如果有未记录的答案，批量提交
    if (allAnswers.length > 0) {
      try {
        await questionBankApi.submitAnswers(bankId!, {
          answers: allAnswers.map(a => ({
            question_id: a.questionId,
            answer_content: { user_answer: a.answerContent },
            is_correct: a.isCorrect,
            time_spent_seconds: a.timeSpent,
            session_id: sessionId,
          })),
        })
      } catch { /* ignore */ }
    }

    // 结束练习会话
    if (sessionId) {
      try {
        const objectiveCount = allAnswers.filter(a => {
          const q = questions.find(q => q.id === a.questionId)
          return q && !SUBJECTIVE_TYPES.includes(q.type)
        }).length
        const correctCount = allAnswers.filter(a => a.isCorrect).length
        // 主观题不计入正确/错误统计（需用户自评），避免污染 DailyPracticeRecord
        const incorrectCount = Math.max(0, objectiveCount - correctCount)
        await questionBankApi.updatePracticeSession(sessionId, {
          status: 'completed',
          current_index: currentIndex,
          stats: {
            total: questions.length,
            completed: allAnswers.length,
            correct: correctCount,
            incorrect: incorrectCount,
          },
          finished_at: new Date().toISOString(),
        })
      } catch { /* ignore */ }
    }

    // 收集错题知识点
    const collectedKps: string[] = []
    for (const a of allAnswers) {
      if (!a.isCorrect) {
        const idx = questions.findIndex(q => q.id === a.questionId)
        if (idx >= 0) {
          const tags = questions[idx].tags || []
          for (const tag of tags) {
            if (!collectedKps.includes(tag)) collectedKps.push(tag)
          }
        }
      }
    }
    setWrongKps(collectedKps)

    setSubmittingAll(false)
    setPhase('results')

    // 检测是否完成了一个完整章节
    if (selectedDomainIds.length === 1) {
      try {
        const compRes = await questionBankApi.getDomainCompletion(selectedDomainIds[0])
        if (compRes.data.all_done) {
          setDomainComplete({
            domainId: selectedDomainIds[0],
            domainName: compRes.data.domain_name,
            wrongCount: allAnswers.filter(a => !a.isCorrect).length,
            allDone: compRes.data.wrong_count === 0,
          })
          // 全部正确时自动标记为已掌握
          if (compRes.data.wrong_count === 0) {
            questionBankApi.markDomainMastered(selectedDomainIds[0]).catch(() => {})
          }
        }
      } catch { /* 静默 */ }
    }
  }

  // ── prepare subjective answers for self-grading when entering results ──
  useEffect(() => {
    if (phase !== 'results') return
    // 清除保存的练习状态，确保返回时不会恢复旧界面
    sessionStorage.removeItem('practice_state')
    const subjective: typeof subjectiveAnswers = []
    for (const ans of answers) {
      const q = questions.find(q => q.id === ans.questionId)
      if (q && SUBJECTIVE_TYPES.includes(q.type)) {
        subjective.push({
          answer_id: '', // will be populated from session answers
          question_id: q.id,
          question: q,
          userAnswer: ans.answerContent || '(未作答)',
          correctAnswer: (() => { const ca = q.answer?.correct_answer; return (Array.isArray(ca) ? ca.join(', ') : String(ca || '')) || '(无标准答案)' })(),
        })
      }
    }
    setSubjectiveAnswers(subjective)
    if (subjective.length > 0) {
      setShowSelfGrade(false)
      setCurrentGradeIndex(0)
      setSelfGrades({})
      setGradingSubmitted(false)
    }
  }, [phase])

  // ── submit self-grades ──
  const handleSubmitSelfGrades = async () => {
    if (!sessionId || gradingSubmitted) return
    setGradingSubmitted(true)
    try {
      const res = await questionBankApi.getSessionAnswers(sessionId)
      const answerIdMap = new Map<string, string>()
      for (const item of res.data.items) {
        answerIdMap.set(item.question_id, item.answer_id)
      }
      const grades: { answer_id: string; self_grade: number }[] = []
      for (const sa of subjectiveAnswers) {
        const g = selfGrades[sa.question_id]
        if (g !== undefined && g >= 0 && g <= 1) {
          const aid = answerIdMap.get(sa.question_id)
          if (aid) grades.push({ answer_id: aid, self_grade: g })
        }
      }
      if (grades.length > 0) {
        await questionBankApi.submitBatchSelfGrade(sessionId, grades)
      }
    } catch {
      // 批量提交失败时单个重试
      for (const sa of subjectiveAnswers) {
        const g = selfGrades[sa.question_id]
        if (g !== undefined && g >= 0 && g <= 1) {
          try {
            const res = await questionBankApi.getSessionAnswers(sessionId!)
            const item = res.data.items.find(i => i.question_id === sa.question_id)
            if (item) {
              await questionBankApi.submitSelfGrade(item.answer_id, g)
            }
          } catch {}
        }
      }
    }
  }

  // ── review-mode self-grade submit ──
  const handleReviewSelfGradeSubmit = async (questionId: string) => {
    if (!sessionId) return
    const data = reviewSelfGrades[questionId]
    const grade = data?.grade ?? 0.5
    setReviewGradeLoading(true)
    try {
      const res = await questionBankApi.getSessionAnswers(sessionId)
      const item = res.data.items.find(i => i.question_id === questionId)
      if (item) {
        await questionBankApi.submitSelfGrade(item.answer_id, grade)
        setReviewSelfGrades(prev => ({
          ...prev,
          [questionId]: { grade, submitted: true },
        }))
      }
    } catch { /* ignore */ }
    setReviewGradeLoading(false)
  }

  // ── save current answer before navigating away (preserves selections when switching questions) ──
  const saveCurrentAnswerState = () => {
    if (!currentQ) return
    // Don't save if answer was already submitted in 'during' mode
    const alreadySaved = answers.find(a => a.questionId === currentQ.id)
    if (alreadySaved && answerMode === 'during') return
    const sel = questionCardRef.current?.getCurrentAnswer?.()
    if (sel && sel.trim()) {
      setAnswers(prev => {
        const existing = prev.findIndex(a => a.questionId === currentQ.id)
        const record: AnswerRecord = { questionId: currentQ.id, answerContent: sel, isCorrect: false, timeSpent: Math.round((Date.now() - questionStartTime) / 1000) }
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = record
          return updated
        }
        return [...prev, record]
      })
    }
  }

  // ── navigation ──
  const goNext = () => {
    if (currentQ) {
      if (answerMode === 'during') {
        // 边测边看：自动提交答案并显示结果
        questionCardRef.current?.submitSilent?.(true)
      } else {
        // 测后看答案：保存当前选择，不提交后端
        saveCurrentAnswerState()
      }
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
      setQuestionStartTime(Date.now())
    }
  }
  const goPrev = () => {
    // 保存当前答案（durating 和 after 模式都需要保存未提交的答案）
    saveCurrentAnswerState()
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setQuestionStartTime(Date.now())
    }
  }

  // ── exam mode submit (last question) ──
  const isLastQuestion = currentIndex === questions.length - 1
  const isExamMode = answerMode === 'after'

  // ── restart ──
  const handleRestart = (presetWrong = false) => {
    sessionStorage.removeItem('practice_state')
    if (presetWrong) {
      setOnlyWrong(true)
      setOnlyUnanswered(false)
      setOnlyErrorProne(false)
    } else {
      setOnlyWrong(false)
      setOnlyUnanswered(false)
      setOnlyErrorProne(false)
    }
    setQuestions([])
    setAnswers([])
    setTimeLeft(null)
    setReviewMode(false)
    autoStartedRef.current = false
    setPhase('config')
  }

  // ── batch practice choice handlers (知识点专项练习 3选1) ──
  const refreshPointData = () => {
    const pt = searchParams.get('point')
    if (!pt) return
    const token = localStorage.getItem('access_token')
    fetch(`/api/v1/path/knowledge/${pt}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(d => {
      if (d.total_questions) setTotalPointQuestions(d.total_questions)
      if (d.total_practiced !== undefined) setPracticedPointQuestions(d.total_practiced)
    }).catch(() => {})
  }

  const handleBatchContinueNew = () => {
    setBatchChoice(false)
    setShowRecommend(false)
    setOnlyUnanswered(true)
    setOnlyWrong(false)
    setOnlyErrorProne(false)
    setQuestions([])
    setAnswers([])
    setTimeLeft(null)
    setReviewMode(false)
    autoStartedRef.current = false
    refreshPointData()
    setPhase('config')
  }

  const handleBatchReviewWrong = () => {
    setBatchChoice(false)
    setShowRecommend(false)
    setOnlyWrong(true)
    setOnlyUnanswered(false)
    setOnlyErrorProne(false)
    setQuestions([])
    setAnswers([])
    setTimeLeft(null)
    setReviewMode(false)
    autoStartedRef.current = false
    refreshPointData()
    setPhase('config')
  }

  const handleBatchLearnNew = () => {
    setBatchChoice(false)
    goBack()
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
  const objectiveAnswers = answers.filter(a => {
    const q = questions.find(q => q.id === a.questionId)
    return q && !SUBJECTIVE_TYPES.includes(q.type)
  })
  const subjectiveAnswerCount = answers.filter(a => {
    const q = questions.find(q => q.id === a.questionId)
    return q && SUBJECTIVE_TYPES.includes(q.type)
  }).length
  const correctCount = objectiveAnswers.filter(a => a.isCorrect).length
  const wrongCount = answeredCount - correctCount - (subjectiveAnswerCount > 0 ? subjectiveAnswerCount : 0)

  const currentQ = questions[currentIndex]

  // ═══════════════════════ RENDER ═══════════════════════

  if (loading && phase === 'config') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--app-text-muted)' }}>
        加载中...
      </div>
    )
  }

  /* ────────────── CONFIG PHASE ────────────── */
  if (phase === 'config') {
    // Show loading while auto-starting from external params
    if (searchParams.get('point') || searchParams.get('domain_ids')) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, color: 'var(--app-text-secondary)', fontWeight: 500 }}>正在加载专项练习...</div>
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ color: 'var(--app-brand)', cursor: 'pointer', fontSize: '13px' }} onClick={goBack}><ArrowLeftIcon size={14} /> {pointParam ? '返回知识点' : '返回题库'}</span>
            <span style={{ padding: '4px 16px', background: 'var(--app-brand-bg)', borderRadius: 14, fontSize: '12px', color: 'var(--app-brand)', fontWeight: 500 }}>{bankName}</span>
          </div>

          {/* config card */}
          <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--app-text-heading)', margin: '0 0 24px' }}>自测设置</h2>

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 12, color: 'var(--app-danger)', fontSize: '14px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            {/* 时间限制 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>时间限制</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {TIME_OPTIONS.map(opt => (
                  <button key={opt.label} onClick={() => setTimeLimit(opt.value)}
                    style={{
                      padding: '8px 18px', border: '2px solid', borderRadius: 20, fontSize: '13px', cursor: 'pointer',
                      background: timeLimit === opt.value ? 'rgba(30,58,138,0.1)' : 'var(--app-bg-card-alt)',
                      borderColor: timeLimit === opt.value ? 'var(--app-brand)' : 'var(--app-border)',
                      color: timeLimit === opt.value ? 'var(--app-brand)' : 'var(--app-text-secondary)',
                      fontWeight: timeLimit === opt.value ? 600 : 400,
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 题目数量 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>题目数量</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="number" min={1}
                  value={questionCount ?? ''}
                  onChange={e => setQuestionCount(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="全部题目"
                  style={{ width: 120, padding: '10px 14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '14px', outline: 'none' }} />
                <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>
                  道（共 {totalAvailable} 题{onlyUnanswered ? '未做' : onlyWrong ? '错题' : ''}可用，留空=全部）
                </span>
                {questionCount && totalAvailable > 0 && questionCount > totalAvailable && (
                  <div style={{ fontSize: '12px', color: 'var(--app-warning)', marginTop: '6px' }}>
                    可用题目不足，将自动调整为 {totalAvailable} 题
                  </div>
                )}
              </div>
            </div>

            {/* 题型 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>题目种类</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {QTYPE_OPTIONS.map(opt => {
                  const sel = selectedTypes.includes(opt.key)
                  return (
                    <button key={opt.key} onClick={() => toggleType(opt.key)}
                      style={{
                        padding: '8px 16px', border: '2px solid', borderRadius: 20, fontSize: '13px', cursor: 'pointer',
                        background: sel ? 'rgba(30,58,138,0.1)' : 'var(--app-bg-card-alt)',
                        borderColor: sel ? 'var(--app-brand)' : 'var(--app-border)',
                        color: sel ? 'var(--app-brand)' : 'var(--app-text-secondary)',
                        fontWeight: sel ? 600 : 400,
                      }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 知识点筛选提示 */}
            {searchParams.get('point') && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>知识点筛选</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '8px 16px', borderRadius: 20, fontSize: '13px', fontWeight: 600,
                    background: 'rgba(99,102,241,0.1)', color: 'var(--app-indigo)',
                    border: '2px solid #A5B4FC', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    📌 {pointName || '已选知识点'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: 6 }}>
                  已按知识点筛选题目，你可以继续调整其他筛选条件
                </div>
              </div>
            )}

            {/* 章节 */}
            {domains.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>
                  章节
                  {totalAvailable > 0 && (
                    <span style={{ fontWeight: 400, color: 'var(--app-text-muted)', marginLeft: '8px', fontSize: '13px' }}>
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
                          background: sel ? 'rgba(16,185,129,0.1)' : 'var(--app-bg-card-alt)',
                          borderColor: sel ? 'var(--app-success)' : 'var(--app-border)',
                          color: sel ? 'var(--app-success)' : 'var(--app-text-secondary)',
                          fontWeight: sel ? 600 : 400,
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                        {d.name}
                        {count > 0 && (
                          <span style={{
                            fontSize: '11px', padding: '0 8px', borderRadius: 8,
                            background: sel ? 'rgba(16,185,129,0.15)' : 'var(--app-border)',
                            color: sel ? 'var(--app-success)' : 'var(--app-text-muted)',
                            fontWeight: 600,
                          }}>
                            {count}
                          </span>
                        )}
                        {count === 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--app-text-placeholder)' }}>0</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 只做未做的 / 只做错题 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>答题范围</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--app-text-body)' }}>
                  <input type="checkbox" checked={onlyUnanswered}
                    onChange={e => { setOnlyUnanswered(e.target.checked); if (e.target.checked) setOnlyWrong(false) }} />
                  只做未做过的
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--app-text-body)' }}>
                  <input type="checkbox" checked={onlyWrong}
                    onChange={e => { setOnlyWrong(e.target.checked); if (e.target.checked) { setOnlyUnanswered(false); setOnlyErrorProne(false) } }} />
                  只做错题
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--app-text-body)' }}>
                  <input type="checkbox" checked={onlyErrorProne}
                    onChange={e => { setOnlyErrorProne(e.target.checked); if (e.target.checked) { setOnlyUnanswered(false); setOnlyWrong(false) } }} />
                  仅易错题
                </label>
              </div>
            </div>

            {/* 答案显示模式 */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>测试模式</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label onClick={() => setAnswerMode('during')} style={{
                  flex: 1, padding: '14px 16px', border: '2px solid', borderRadius: 12, cursor: 'pointer',
                  background: answerMode === 'during' ? 'rgba(30,58,138,0.06)' : 'var(--app-bg-card-alt)',
                  borderColor: answerMode === 'during' ? 'var(--app-brand)' : 'var(--app-border)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                    borderColor: answerMode === 'during' ? 'var(--app-brand)' : 'var(--app-text-placeholder)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {answerMode === 'during' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--app-brand)' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-heading)' }}>边测边看答案</div>
                    <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>每道题提交后立即显示答案和解析</div>
                  </div>
                </label>
                <label onClick={() => setAnswerMode('after')} style={{
                  flex: 1, padding: '14px 16px', border: '2px solid', borderRadius: 12, cursor: 'pointer',
                  background: answerMode === 'after' ? 'rgba(30,58,138,0.06)' : 'var(--app-bg-card-alt)',
                  borderColor: answerMode === 'after' ? 'var(--app-brand)' : 'var(--app-border)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                    borderColor: answerMode === 'after' ? 'var(--app-brand)' : 'var(--app-text-placeholder)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {answerMode === 'after' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--app-brand)' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-heading)' }}>测后看答案</div>
                    <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>全部提交后统一查看答案和解析</div>
                  </div>
                </label>
              </div>
            </div>

            {/* start button */}
            <button onClick={() => void handleStartPractice()} disabled={loading}
              style={{
                width: '100%', padding: '14px', background: 'var(--app-success)', color: '#fff', border: 'none',
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
      <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '12px 16px 100px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 12px' }}>
            {reviewMode ? (
              <span style={{ color: 'var(--app-brand)', cursor: 'pointer', fontSize: '13px' }} onClick={goBack}><ArrowLeftIcon size={14} /> 返回</span>
            ) : answerMode === 'after' ? (
              <span style={{ color: 'var(--app-brand)', cursor: 'pointer', fontSize: '13px' }} onClick={goBack}><ArrowLeftIcon size={14} /> 返回</span>
            ) : (
              <span style={{ color: 'var(--app-brand)', cursor: 'pointer', fontSize: '13px' }} onClick={handleEndPractice}><ArrowLeftIcon size={14} /> 交卷</span>
            )}
            <span style={{ padding: '4px 16px', background: 'var(--app-brand-bg)', borderRadius: 14, fontSize: '12px', color: 'var(--app-brand)', fontWeight: 500 }}>{bankName}</span>
          </div>

          {/* timer */}
          {timeLeft !== null && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <div style={{
                padding: '6px 16px', borderRadius: 20,
                background: timeLeft <= 60 ? 'rgba(239,68,68,0.1)' : 'rgba(30,58,138,0.1)',
                color: timeLeft <= 60 ? 'var(--app-danger)' : 'var(--app-brand)',
                fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap',
              }}>
                {formatSeconds(timeLeft)}
              </div>
            </div>
          )}

          {/* question nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginBottom: '8px' }}>
            <span onClick={goPrev}
              style={{
                color: currentIndex > 0 ? 'var(--app-brand)' : 'var(--app-text-placeholder)',
                cursor: currentIndex > 0 ? 'pointer' : 'default',
                fontSize: '13px', padding: '8px 12px', whiteSpace: 'nowrap',
              }}>
              <ArrowLeftIcon size={14} /> 上一题
            </span>
            {/* question number grid */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', gap: '6px', alignItems: 'center',
                overflowX: 'auto', padding: '4px 0',
              }}>
                {questions.map((q, i) => {
                  const ans = getAnswerForQuestion(q.id)
                  const isAns = !!ans
                  const isCurrent = i === currentIndex
                  return (
                    <div key={q.id} onClick={() => { saveCurrentAnswerState(); setCurrentIndex(i); setQuestionStartTime(Date.now()) }}
                      style={{
                        minWidth: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: isCurrent ? 700 : 500,
                        background: isCurrent ? 'var(--app-brand)' : isAns ? 'var(--app-info)' : 'var(--app-border)',
                        color: (isCurrent || isAns) ? '#fff' : 'var(--app-text-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {i + 1}
                    </div>
                  )
                })}
              </div>
            </div>
            <span onClick={goNext}
              style={{
                color: currentIndex < totalQs - 1 ? 'var(--app-brand)' : 'var(--app-text-placeholder)',
                cursor: currentIndex < totalQs - 1 ? 'pointer' : 'default',
                fontSize: '13px', padding: '8px 12px', whiteSpace: 'nowrap',
              }}>
              下一题 <ArrowRightIcon size={14} />
            </span>
          </div>

          {/* legend */}
          {questions.length > 6 && (
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginBottom: '4px', padding: '0 4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--app-text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--app-brand)', display: 'inline-block' }} /> 当前
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--app-text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--app-info)', display: 'inline-block' }} /> 已答
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--app-text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--app-border)', display: 'inline-block' }} /> 未答
              </span>
            </div>
          )}

          {/* question card */}
          {currentQ && (
            <QuestionCard
              key={currentQ.id}
              ref={questionCardRef}
              question={currentQ}
              onSubmit={handleAnswer}
              hideAnswer={answerMode === 'after' && !reviewMode}
              savedAnswer={getAnswerForQuestion(currentQ.id) ? {
                answerContent: getAnswerForQuestion(currentQ.id)!.answerContent,
                isCorrect: getAnswerForQuestion(currentQ.id)!.isCorrect,
              } : null}
              examMode={answerMode === 'after'}
            />
          )}

          {/* review-mode self-grade panel */}
          {reviewMode && currentQ && SUBJECTIVE_TYPES.includes(currentQ.type) && getAnswerForQuestion(currentQ.id) && (
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--app-text-heading)' }}>主观题自评</span>
                <span style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>对照标准答案给自己评分</span>
              </div>
              {(() => {
                const gd = reviewSelfGrades[currentQ.id]
                const gradeVal = gd?.grade ?? 0.5
                const submitted = gd?.submitted ?? false
                const curAns = getAnswerForQuestion(currentQ.id)
                return (
                  <>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '4px' }}>你的答案</div>
                      <div style={{ padding: '10px', background: 'rgba(239,68,68,0.06)', borderRadius: 10, fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {curAns?.answerContent || '(未作答)'}
                      </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '4px' }}>标准答案</div>
                      <div style={{ padding: '10px', background: 'rgba(16,185,129,0.06)', borderRadius: 10, fontSize: '13px', lineHeight: 1.6 }}>
                        <MarkdownRenderer content={(() => { const ca = currentQ.answer?.correct_answer; return (Array.isArray(ca) ? ca.join(', ') : String(ca || '')) || '(无标准答案)' })()} />
                      </div>
                    </div>
                    {submitted ? (
                      <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(16,185,129,0.06)', borderRadius: 10 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-success)' }}>
                          已提交自评: {gradeVal.toFixed(1)}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '8px' }}>
                            自评分数: <span style={{ color: 'var(--app-brand)', fontSize: '16px', fontWeight: 700 }}>{gradeVal.toFixed(1)}</span>
                          </div>
                          <input type="range" min={0} max={10} step={1}
                            value={Math.round(gradeVal * 10)}
                            onChange={e => setReviewSelfGrades(prev => ({ ...prev, [currentQ.id]: { grade: parseInt(e.target.value) / 10, submitted: false } }))}
                            style={{ width: '100%', accentColor: 'var(--app-brand)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--app-text-muted)', marginTop: '2px' }}>
                            <span>0 - 完全错误</span>
                            <span>0.5 - 部分正确</span>
                            <span>1 - 完全正确</span>
                          </div>
                        </div>
                        <button onClick={() => handleReviewSelfGradeSubmit(currentQ.id)}
                          disabled={reviewGradeLoading}
                          style={{ width: '100%', padding: '10px 24px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: reviewGradeLoading ? 0.6 : 1 }}>
                          {reviewGradeLoading ? '提交中...' : '提交自评'}
                        </button>
                      </>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* bottom info bar */}
          <div style={{ display: 'flex', gap: '24px', padding: '14px 18px', background: '#fff', borderRadius: 12, marginTop: '4px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>题型：</span>
              <span style={{ fontSize: '13px', color: 'var(--app-text-body)', fontWeight: 500 }}>{QTYPE_LABELS[currentQ?.type] || '未知'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>难度：</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--app-text-secondary)' }}>
                {getDifficultyLabel(currentQ?.difficulty)}
              </span>
            </div>
          </div>

          {/* 测后看答案模式：最后一道题显示交卷按钮 */}
          {isExamMode && !reviewMode && isLastQuestion && (
            <button onClick={handleEndPractice} disabled={submittingAll}
              style={{
                width: '100%', padding: '14px', marginTop: '12px',
                background: 'var(--app-danger)', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: '16px', fontWeight: 600,
                cursor: submittingAll ? 'not-allowed' : 'pointer',
                opacity: submittingAll ? 0.6 : 1,
              }}>
              {submittingAll ? '提交中...' : '📝 交卷'}
            </button>
          )}
        </div>

      </div>
    )
  }

  /* ────────────── RESULTS PHASE ────────────── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ color: 'var(--app-brand)', cursor: 'pointer', fontSize: '13px' }} onClick={goBack}><ArrowLeftIcon size={14} /> {pointParam ? '返回知识点' : sessionMode === 'wrong_answer' ? '返回复习中心' : '返回题库'}</span>
          <span style={{ padding: '4px 16px', background: 'var(--app-brand-bg)', borderRadius: 14, fontSize: '12px', color: 'var(--app-brand)', fontWeight: 500 }}>{bankName}</span>
        </div>

        {/* summary card */}
        <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>
            {correctCount === totalQs && totalQs > 0 ? <StarIcon size={36} color="#F59E0B" /> : wrongCount === 0 && totalQs > 0 ? <CheckIcon size={36} color="#10B981" /> : <ZapIcon size={36} color="#1E3A8A" />}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--app-text-heading)', margin: '0 0 16px' }}>练习完成！</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--app-success)' }}>{correctCount}</div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>正确</div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--app-danger)' }}>{wrongCount}</div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>错误</div>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--app-brand)' }}>
                {totalQs > 0 ? Math.round((correctCount / totalQs) * 100) : 0}%
              </div>
              <div style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>正确率</div>
            </div>
          </div>

          {subjectiveAnswerCount > 0 && (
            <div style={{ marginTop: '12px', padding: '10px 16px', background: 'rgba(245,158,11,0.1)', borderRadius: 12, fontSize: '13px', color: 'var(--app-amber-dark)' }}>
              有 {subjectiveAnswerCount} 道主观题需要自评，请使用下方「主观题自评」功能评分
            </div>
          )}

          {/* action buttons — 知识点专项练习显示3选1，普通练习显示原有按钮 */}
          {pointParam ? (
            <div style={{ marginTop: '20px' }}>
              {/* Progress bar */}
              {totalPointQuestions > 0 && (
                <div style={{ marginBottom: '18px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: 'var(--app-text-secondary)' }}>
                    <span>📊 专项练习进度</span>
                    <span>{practicedPointQuestions + totalQs} / {totalPointQuestions} 题</span>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: `linear-gradient(90deg, var(--app-brand), #38BDF8)`,
                      width: `${Math.min(100, Math.round((practicedPointQuestions + totalQs) / totalPointQuestions * 100))}%`,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                </div>
              )}

              {/* 3-choice panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* (1) 继续新题 */}
                <button
                  onClick={handleBatchContinueNew}
                  disabled={totalPointQuestions > 0 && practicedPointQuestions >= totalPointQuestions}
                  style={{
                    padding: '12px 20px', borderRadius: 12, border: 'none',
                    background: totalPointQuestions > 0 && practicedPointQuestions >= totalPointQuestions
                      ? '#F3F4F6' : 'var(--app-brand)',
                    color: totalPointQuestions > 0 && practicedPointQuestions >= totalPointQuestions
                      ? '#9CA3AF' : '#fff',
                    fontSize: '14px', fontWeight: 600, cursor: totalPointQuestions > 0 && practicedPointQuestions >= totalPointQuestions
                      ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <span style={{ fontSize: '18px' }}>📝</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        继续做该知识点的新题目
                        {totalPointQuestions > 0 && practicedPointQuestions >= totalPointQuestions && '（题目已全部完成）'}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 400 }}>再练 5 道未做过的题</div>
                    </div>
                  </button>

                {/* (2) 复习错题 */}
                <button
                  onClick={handleBatchReviewWrong}
                  disabled={wrongCount === 0}
                  style={{
                    padding: '12px 20px', borderRadius: 12, border: 'none',
                    background: wrongCount > 0 ? '#FEF2F2' : '#F3F4F6',
                    color: wrongCount > 0 ? 'var(--app-danger)' : '#9CA3AF',
                    fontSize: '14px', fontWeight: 600, cursor: wrongCount > 0 ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <span style={{ fontSize: '18px' }}>🔄</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        复习错题{!wrongCount && '（本轮无错题）'}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 400 }}>
                        {wrongCount > 0 ? `练习该知识点所有错题` : '本轮全部正确，无需复习'}
                      </div>
                    </div>
                  </button>

                {/* (3) 学习新知识点 */}
                <button
                  onClick={handleBatchLearnNew}
                  style={{
                    padding: '12px 20px', borderRadius: 12, border: '1.5px solid #E5E7EB',
                    background: '#fff',
                    color: 'var(--app-text-secondary)',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <span style={{ fontSize: '18px' }}>📚</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>学习新的知识点</div>
                      <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 400 }}>返回学习路径流程图</div>
                    </div>
                  </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => handleRestart(false)}
                style={{ padding: '10px 24px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                重新练习
              </button>
              {wrongCount > 0 && (
                <button onClick={() => handleRestart(true)}
                  style={{ padding: '10px 24px', background: 'var(--app-danger)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                  练习错题
                </button>
              )}
              {sessionMode === 'wrong_answer' ? (
                <button onClick={() => navigate('/review')}
                  style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📋 返回复习中心
                </button>
              ) : (
                <button onClick={goBack}
                  style={{ padding: '10px 24px', background: 'var(--app-bg-page)', color: 'var(--app-text-body)', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                  {pointParam ? '返回知识点' : '返回题库'}
                </button>
              )}
            </div>
          )}
          {sessionId && !pointParam && (
            <div style={{ marginTop: '12px' }}>
              <button onClick={() => navigate(`/banks/${bankId}/history/${sessionId}`)}
                style={{ padding: '8px 20px', background: '#EFF6FF', color: 'var(--app-brand)', border: 'none', borderRadius: 12, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                查看完整详情 ↗
              </button>
            </div>
          )}
        </div>

        {/* ── self-grade panel ── */}
        {subjectiveAnswers.length > 0 && !gradingSubmitted && (
          <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '16px' }}>
            {!showSelfGrade ? (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--app-text-heading)', margin: '0 0 8px' }}>主观题自评</h3>
                <p style={{ fontSize: '14px', color: 'var(--app-text-secondary)', margin: '0 0 16px' }}>
                  以下 {subjectiveAnswers.length} 道主观题需要你对照标准答案进行自我评分
                </p>
                <button onClick={() => setShowSelfGrade(true)}
                  style={{ padding: '12px 32px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                  开始自评
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--app-text-heading)', margin: 0 }}>
                    自评 ({currentGradeIndex + 1}/{subjectiveAnswers.length})
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>滑动评分（0=完全错误, 1=完全正确）</div>
                </div>
                {(() => {
                  const item = subjectiveAnswers[currentGradeIndex]
                  if (!item) return null
                  return (
                    <div>
                      {/* question stem */}
                      <div style={{ fontSize: '14px', color: 'var(--app-text-body)', lineHeight: 1.7, marginBottom: '16px', padding: '12px', background: 'var(--app-bg-card-alt)', borderRadius: 12 }}>
                        <MarkdownRenderer content={item.question.content.stem} />
                      </div>
                      {/* user answer */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '6px' }}>你的答案</div>
                        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.06)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', fontSize: '14px', color: 'var(--app-text-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {item.userAnswer}
                        </div>
                      </div>
                      {/* correct answer */}
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '6px' }}>标准答案</div>
                        <div style={{ padding: '12px', background: 'rgba(16,185,129,0.06)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', fontSize: '14px', color: 'var(--app-text-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          <MarkdownRenderer content={item.correctAnswer} />
                        </div>
                      </div>
                      {/* slider */}
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '10px' }}>
                          自评分数: <span style={{ color: 'var(--app-brand)', fontSize: '18px', fontWeight: 700 }}>{(selfGrades[item.question_id] ?? 0.5).toFixed(1)}</span>
                        </div>
                        <input type="range" min="0" max="10" step="1"
                          value={Math.round((selfGrades[item.question_id] ?? 0.5) * 10)}
                          onChange={e => setSelfGrades(prev => ({ ...prev, [item.question_id]: parseInt(e.target.value) / 10 }))}
                          style={{ width: '100%', accentColor: 'var(--app-brand)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '4px' }}>
                          <span>0 - 完全错误</span>
                          <span>0.5 - 部分正确</span>
                          <span>1 - 完全正确</span>
                        </div>
                      </div>
                      {/* navigation */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {currentGradeIndex < subjectiveAnswers.length - 1 ? (
                          <button onClick={() => setCurrentGradeIndex(i => i + 1)}
                            style={{ flex: 1, padding: '12px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                            下一题 <ArrowRightIcon size={14} />
                          </button>
                        ) : (
                          <button onClick={handleSubmitSelfGrades}
                            style={{ flex: 1, padding: '12px', background: 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                            提交自评
                          </button>
                        )}
                        <button onClick={() => setShowSelfGrade(false)}
                          style={{ padding: '12px 20px', background: 'var(--app-bg-page)', color: 'var(--app-text-body)', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>
                          取消
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* question review list */}
        <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--app-text-heading)', margin: '0 0 16px' }}>答题详情</h3>
          {questions.map((q, i) => {
            const ans = getAnswerForQuestion(q.id)
            return (
              <div key={q.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  background: i % 2 === 0 ? 'var(--app-bg-card-alt)' : '#fff',
                  marginBottom: '4px',
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 600,
                  background: !ans ? 'var(--app-border)' : ans.isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: !ans ? 'var(--app-text-muted)' : ans.isCorrect ? 'var(--app-success)' : 'var(--app-danger)',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: '14px', color: 'var(--app-text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <MarkdownRenderer content={q.content.stem || '无题干'} />
                </div>
                <div style={{
                  fontSize: '11px', padding: '2px 10px', borderRadius: 10,
                  background: !ans ? 'var(--app-bg-page)' : ans.isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: !ans ? 'var(--app-text-muted)' : ans.isCorrect ? 'var(--app-success)' : 'var(--app-danger)',
                  fontWeight: 500,
                }}>
                  {!ans ? '未答' : ans.isCorrect ? '正确' : '错误'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 章节完成弹窗（优先） */}
      {domainComplete && (
        <ChapterCompletePopover
          domainId={domainComplete.domainId}
          domainName={domainComplete.domainName}
          wrongCount={domainComplete.wrongCount}
          allCorrect={domainComplete.allDone}
          bankId={bankId || ''}
          onClose={() => setDomainComplete(null)}
        />
      )}
      {/* 普通练习推荐弹窗（仅当不是章节完成时） */}
      {!domainComplete && showRecommend && wrongCount > 0 && (
        <PracticeRecommendPopover
          bankId={bankId || ''}
          wrongCount={wrongCount}
          knowledgePoints={wrongKps}
          sessionId={sessionId || ''}
          onClose={() => setShowRecommend(false)}
        />
      )}
    </div>
  )
}

