import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { questionBankApi, type WrongAnswerItem, type QuestionItem, type DomainItem, type SubjectItem, type BankItem } from '../api/questionBank'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { PageHeader, EmptyState, Pagination, LoadingState, ErrorState } from '../components/shared'
import { QTYPE_LABELS } from '../constants/labels'

type DiagnosisResult = {
  error_type: string
  error_type_label: string
  root_cause: string
  suggestions: string[]
  recommended_action: string
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  '概念混淆': '#F59E0B',
  '计算失误': '#EF4444',
  '审题不清': '#8B5CF6',
  '知识盲区': '#DC2626',
  '逻辑错误': '#F97316',
  '粗心大意': '#6B7280',
  'unknown': '#9CA3AF',
}

function SparklesIcon() { return (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>
    <path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5z"/>
  </svg>
)}

/** 格式化正确答案：将字母匹配到选项文字，如 "C. 顺序存储结构" */
function formatCorrectAnswer(question: QuestionItem): string {
  const options = question.content?.options || []
  const raw = question.answer?.correct_answer
  const correctAnswers: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? [raw] : [])
  if (correctAnswers.length === 0) {
    return question.answer?.explanation ? '见解析' : '暂无答案'
  }
  return correctAnswers.map((letter: string) => {
    const option = options.find((o: any) => o.key === letter)
    return option ? `**${letter}**. ${option.text}` : letter
  }).join('；')
}

export default function WrongAnswerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const bankParam = searchParams.get('bank')

  const [items, setItems] = useState<WrongAnswerItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [banks, setBanks] = useState<BankItem[]>([])
  const [selectedBankId, setSelectedBankId] = useState(bankParam || '')
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null)
  const [diagnoses, setDiagnoses] = useState<Record<string, DiagnosisResult>>({})
  const [domains, setDomains] = useState<DomainItem[]>([])
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([])
  // 学科分类
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)

  // 获取某学科下的题库列表
  const getBanksForSubject = (subjectId: string): BankItem[] =>
    banks.filter(b => b.subject_id === subjectId)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = { page, page_size: pageSize }
      if (selectedSubjectId) params.subject_id = selectedSubjectId
      else if (selectedBankId) params.bank_id = selectedBankId
      const res = await questionBankApi.listWrongAnswers(params)
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      setError('加载错题本失败')
    }
    setLoading(false)
  }

  const loadSubjectDetail = async (subjectId: string) => {
    try {
      const res = await questionBankApi.getSubject(subjectId)
      setDomains(res.data.domains || [])
    } catch { setDomains([]) }
  }

  // 首次加载：题库 + 学科 + 数据
  useEffect(() => {
    Promise.all([
      questionBankApi.listBanks({ page_size: 100 }),
      questionBankApi.listSubjects(),
    ]).then(([banksRes, subsRes]) => {
      const bankList = banksRes.data.banks
      const subList = subsRes.data.subjects || []
      setBanks(bankList)
      setSubjects(subList)

      // 如果 URL 有 ?bank= 参数，自动选中该银行所属学科
      if (bankParam) {
        const bank = bankList.find((b: BankItem) => b.id === bankParam)
        if (bank) {
          setSelectedBankId(bank.id)
          const subject = subList.find((s: SubjectItem) => s.id === bank.subject_id)
          if (subject) {
            setSelectedSubjectId(subject.id)
            loadSubjectDetail(subject.id)
          }
        }
      }
      setDataLoaded(true)
    }).catch(() => setDataLoaded(true))

    loadData()
  }, [])

  // 学科或题库变化时重新加载
  useEffect(() => {
    if (!dataLoaded) return
    loadData()
    if (selectedSubjectId) {
      loadSubjectDetail(selectedSubjectId)
      const subBanks = getBanksForSubject(selectedSubjectId)
      if (subBanks.length > 0 && !selectedBankId) {
        setSelectedBankId(subBanks[0].id)
      }
    } else if (!selectedBankId) {
      setDomains([])
    }
  }, [selectedSubjectId, selectedBankId, page, dataLoaded])

  const handleRemove = async (recordId: string) => {
    try {
      await questionBankApi.removeWrongAnswer(recordId)
      setItems(prev => prev.filter(i => i.id !== recordId))
      setTotal(prev => prev - 1)
    } catch {
      alert('移出错题本失败')
    }
  }

  const handleDiagnose = async (recordId: string) => {
    setDiagnosingId(recordId)
    try {
      const res = await questionBankApi.diagnoseWrongAnswer(recordId)
      setDiagnoses(prev => ({ ...prev, [recordId]: res.data }))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'AI 诊断失败，请确保已配置 API Key')
    } finally {
      setDiagnosingId(null)
    }
  }

  const handlePracticeThis = async (item: WrongAnswerItem) => {
    try {
      const sessionRes = await questionBankApi.createPracticeSession(item.bank_id, {
        mode: 'wrong_answer',
        question_order: [item.question_id],
        answer_mode: 'during',
      })
      navigate(`/banks/${item.bank_id}/practice?session_id=${sessionRes.data.id}`)
    } catch {
      alert('创建练习失败')
    }
  }

  const handleGeneratePractice = async () => {
    // 自动确定要使用的题库
    let bankToUse = selectedBankId
    if (!bankToUse && items.length > 0) {
      const bankCounts: Record<string, number> = {}
      items.forEach(item => {
        bankCounts[item.bank_id] = (bankCounts[item.bank_id] || 0) + 1
      })
      bankToUse = Object.entries(bankCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    }
    if (!bankToUse) { alert('暂无错题'); return }
    try {
      const res = await questionBankApi.generatePracticeFromWrongAnswers({
        bank_id: bankToUse,
        domain_ids: selectedDomainIds.length > 0 ? selectedDomainIds : undefined,
      })
      if (res.data.length === 0) { alert('该题库暂无错题'); return }
      const sessionRes = await questionBankApi.createPracticeSession(bankToUse, {
        mode: 'wrong_answer',
        answer_mode: 'during',
        question_order: res.data.map((q: QuestionItem) => q.id),
      })
      navigate(`/banks/${bankToUse}/practice?session_id=${sessionRes.data.id}`)
    } catch {
      alert('生成错题练习失败')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader
          backTo="/banks"
          title="错题本"
          subtitle={total > 0 ? <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>共 {total} 题</span> : undefined}
        />

        {/* 学科分类 */}
        {subjects.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '8px' }}>
              学科分类 {selectedSubjectId && <span style={{ fontWeight: 400, color: 'var(--app-text-muted)' }}>· 已选学科</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => { setSelectedSubjectId(''); setSelectedBankId(''); setPage(1) }}
                style={{
                  padding: '6px 16px', border: '2px solid', borderRadius: 20, fontSize: '13px', cursor: 'pointer',
                  background: !selectedSubjectId ? 'rgba(30,58,138,0.1)' : 'var(--app-bg-card-alt)',
                  borderColor: !selectedSubjectId ? 'var(--app-brand)' : 'var(--app-border)',
                  color: !selectedSubjectId ? 'var(--app-brand)' : 'var(--app-text-secondary)',
                  fontWeight: !selectedSubjectId ? 600 : 400,
                }}>
                全部学科
              </button>
              {subjects.map(sub => {
                const sel = selectedSubjectId === sub.id
                const bankCount = getBanksForSubject(sub.id).length
                return (
                  <button key={sub.id} onClick={() => {
                    setSelectedSubjectId(sel ? '' : sub.id)
                    setSelectedBankId('')
                    setPage(1)
                    setSelectedDomainIds([])
                  }}
                    style={{
                      padding: '6px 16px', border: '2px solid', borderRadius: 20, fontSize: '13px', cursor: 'pointer',
                      background: sel ? 'rgba(30,58,138,0.1)' : 'var(--app-bg-card-alt)',
                      borderColor: sel ? 'var(--app-brand)' : 'var(--app-border)',
                      color: sel ? 'var(--app-brand)' : 'var(--app-text-secondary)',
                      fontWeight: sel ? 600 : 400,
                    }}>
                    {sub.name}
                    {bankCount > 0 && <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({bankCount})</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selectedBankId} onChange={e => { setSelectedBankId(e.target.value); setPage(1) }}
              style={{ padding: '8px 14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '13px', outline: 'none', background: '#fff', minWidth: 160 }}>
              <option value="">全部题库</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          {items.length > 0 && (
            <button onClick={handleGeneratePractice}
              style={{ padding: '8px 20px', background: 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              生成错题练习
            </button>
          )}
        </div>

        {/* 章节筛选（当前学科下） */}
        {domains.length > 0 && items.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '8px' }}>
              章节筛选 {selectedDomainIds.length > 0 && <span style={{ fontWeight: 400, color: 'var(--app-text-muted)' }}>（已选 {selectedDomainIds.length} 个）</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {domains.map(d => {
                const sel = selectedDomainIds.includes(d.id)
                return (
                  <button key={d.id} onClick={() => setSelectedDomainIds(prev =>
                    prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                  )}
                    style={{
                      padding: '6px 14px', border: '2px solid', borderRadius: 20, fontSize: '12px', cursor: 'pointer',
                      background: sel ? 'rgba(30,58,138,0.1)' : 'var(--app-bg-card-alt)',
                      borderColor: sel ? 'var(--app-brand)' : 'var(--app-border)',
                      color: sel ? 'var(--app-brand)' : 'var(--app-text-secondary)',
                      fontWeight: sel ? 600 : 400,
                    }}>
                    {d.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无错题" description="继续努力，保持好状态！" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => {
              const isExpanded = expandedId === item.id
              return (
                <div key={item.id} className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: 'var(--app-text-body)', lineHeight: 1.6, marginBottom: '6px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 8, background: 'var(--app-brand-bg)', color: 'var(--app-brand)', fontSize: '11px', fontWeight: 600, marginRight: '8px' }}>
                          {QTYPE_LABELS[item.question.type] || item.question.type}
                        </span>
                        <MarkdownRenderer content={item.question.content?.stem || '无题干'} />
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--app-text-muted)' }}>
                        <span>错题 <strong style={{ color: 'var(--app-danger)' }}>{item.wrong_count}</strong> 次</span>
                        <span>最近错误: {new Date(item.last_wrong_at + 'Z').toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: '12px', color: 'var(--app-brand)' }}>
                      {isExpanded ? '收起答案' : '查看答案'}
                    </button>
                    <button onClick={() => handleRemove(item.id)}
                      style={{ padding: '6px 14px', border: '1px solid #FEE2E2', borderRadius: 10, background: '#FFF', cursor: 'pointer', fontSize: '12px', color: 'var(--app-danger)' }}>
                      移出错题本
                    </button>
                    <button onClick={() => handlePracticeThis(item)}
                      style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: '12px', color: 'var(--app-text-body)' }}>
                      练习此题
                    </button>
                    <button
                      onClick={() => handleDiagnose(item.id)}
                      disabled={diagnosingId === item.id}
                      style={{
                        padding: '6px 14px', borderRadius: 10, border: 'none',
                        background: diagnoses[item.id] ? 'rgba(16,185,129,0.1)' : 'var(--app-brand)',
                        color: diagnoses[item.id] ? 'var(--app-success)' : '#fff',
                        cursor: diagnosingId === item.id ? 'default' : 'pointer',
                        fontSize: '12px', fontWeight: 500,
                        opacity: diagnosingId === item.id ? 0.7 : 1,
                      }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <SparklesIcon />
                        {diagnosingId === item.id ? '分析中...' : diagnoses[item.id] ? 'AI 已分析' : 'AI 诊断'}
                      </span>
                    </button>
                  </div>

                  {/* AI 诊断结果 */}
                  {diagnoses[item.id] && (
                    <div style={{
                      marginTop: '12px', padding: '16px 18px', borderRadius: 14,
                      background: '#FAFAFA', border: '1px solid #E5E7EB',
                    }}>
                      <div style={{
                        fontSize: '12px', fontWeight: 700, color: '#1F2937',
                        marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <SparklesIcon /> AI 智能诊断
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>错误类型：</span>
                        <span style={{
                          fontSize: '12px', fontWeight: 600, padding: '3px 12px', borderRadius: 12,
                          background: (ERROR_TYPE_COLORS[diagnoses[item.id].error_type_label] || '#9CA3AF') + '18',
                          color: ERROR_TYPE_COLORS[diagnoses[item.id].error_type_label] || '#9CA3AF',
                        }}>
                          {diagnoses[item.id].error_type_label}
                        </span>
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>📋 根因分析</div>
                        <div style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6 }}>
                          {diagnoses[item.id].root_cause}
                        </div>
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>💡 补救建议</div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#4B5563', lineHeight: 1.8 }}>
                          {diagnoses[item.id].suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>

                      <div style={{
                        padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.15)',
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1677E8', marginBottom: '2px' }}>🎯 推荐下一步</div>
                        <div style={{ fontSize: '13px', color: '#0369A1' }}>
                          {diagnoses[item.id].recommended_action}
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div style={{ marginTop: '12px', padding: '14px', background: 'var(--app-bg-card-alt)', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-success)', marginBottom: '4px' }}>正确答案</div>
                        <div style={{ fontSize: '13px', color: 'var(--app-text-body)', lineHeight: 1.6 }}>
                          <MarkdownRenderer content={formatCorrectAnswer(item.question)} />
                        </div>
                      </div>
                      {item.question.answer?.explanation && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-brand)', marginBottom: '4px' }}>解析</div>
                          <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', lineHeight: 1.7 }}>
                            <MarkdownRenderer content={item.question.answer.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}
