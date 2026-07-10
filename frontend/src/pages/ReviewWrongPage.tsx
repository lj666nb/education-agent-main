import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionBankApi, type WrongReviewItem } from '../api/questionBank'
import QuestionCard, { type PracticeQuestion } from '../components/QuestionCard'
import { PageHeader, EmptyState, LoadingState, ErrorState } from '../components/shared'

/* ── 将 WrongReviewItem 转为 PracticeQuestion ── */
function toPracticeQuestion(item: WrongReviewItem, userAnswer: string): PracticeQuestion {
  // options: DB 存为 [{key:"A", text:"..."}]，PracticeQuestion 需要相同格式
  let options: { key: string; text: string }[] | undefined
  if (Array.isArray(item.options)) {
    options = item.options as { key: string; text: string }[]
  } else if (item.options && typeof item.options === 'object') {
    // 兼容 dict 格式 {A: "..."}
    options = Object.entries(item.options).map(([key, text]) => ({
      key,
      text: String(text),
    }))
  }

  return {
    id: item.question_id,
    type: item.type as PracticeQuestion['type'],
    content: {
      stem: item.stem,
      options,
    },
    answer: {
      correct_answer: item.correct_answer || [],
      explanation: item.explanation || '',
    },
    difficulty: 'basic',
    tags: item.knowledge_points || [],
  }
}

/* ── 组件 ── */
export default function ReviewWrongPage() {
  const navigate = useNavigate()
  const { bankId } = useParams<{ bankId: string }>()

  const [records, setRecords] = useState<WrongReviewItem[]>([])
  const [bankName, setBankName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!bankId) {
      setError('缺少题库 ID')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await questionBankApi.getWrongReview(bankId!)
        if (!cancelled) {
          setRecords(res.data.wrong_records || [])
          setBankName(res.data.bank_name || '')
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.response?.data?.detail || err?.message || '加载错题回顾失败，请稍后重试'
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [bankId])

  /* ── render ── */
  if (loading) {
    return (
      <>
        <PageHeader backTo="/banks" title="错题回顾" backLabel="返回题库" onBackClick={() => navigate('/banks')} />
        <LoadingState />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader backTo="/banks" title="错题回顾" backLabel="返回题库" onBackClick={() => navigate('/banks')} />
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 20px' }}>
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        </div>
      </>
    )
  }

  if (records.length === 0) {
    return (
      <>
        <PageHeader backTo={`/banks/${bankId}`} title="错题回顾" backLabel="返回题库" onBackClick={() => navigate(`/banks/${bankId}`)} />
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 20px' }}>
          <EmptyState title="暂无错题" description="继续保持！" />
        </div>
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)' }}>
      <PageHeader
        backTo={`/banks/${bankId}`}
        title="错题回顾"
        backLabel={bankName || '返回题库'}
        onBackClick={() => navigate(`/banks/${bankId}`)}
      />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 20px 120px' }}>
        {/* 汇总条 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', marginBottom: 16, borderRadius: 8,
          background: '#FEF2F2', fontSize: 13, color: '#DC2626', fontWeight: 500,
        }}>
          <span>共 {records.length} 道错题</span>
          {bankName && <span>{bankName}</span>}
        </div>

        {/* 用 QuestionCard 渲染每道错题 */}
        {records.map((item, idx) => (
          <div key={item.question_id || idx} style={{ marginBottom: 16 }}>
            <QuestionCard
              question={toPracticeQuestion(item, item.user_answer)}
              onSubmit={() => {}}   // readonly 模式下不提交
              readonly={true}
              hideAnswer={false}
              savedAnswer={{
                answerContent: item.user_answer || '',
                isCorrect: false,
              }}
            />
          </div>
        ))}
      </div>

      {/* 底部操作栏 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #E5E7EB',
        padding: '14px 24px', display: 'flex', justifyContent: 'center', zIndex: 40,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
      }}>
        <button
          onClick={() => navigate(`/banks/${bankId}/practice?onlyWrong=true`)}
          style={{
            padding: '12px 36px', borderRadius: 8, border: 'none',
            background: '#DC2626', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          重新练习错题
        </button>
      </div>
    </div>
  )
}
