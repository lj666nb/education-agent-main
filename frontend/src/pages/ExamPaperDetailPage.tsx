import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionBankApi } from '../api/questionBank'

export default function ExamPaperDetailPage() {
  const { bankId, paperId } = useParams<{ bankId: string; paperId: string }>()
  const navigate = useNavigate()
  const [paper, setPaper] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportingPDF, setExportingPDF] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)
  const [starting, setStarting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!paperId) return
    loadPaper()
  }, [paperId])

  const loadPaper = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await questionBankApi.getExamPaper(paperId!)
      setPaper(res.data)
    } catch {
      setError('加载试卷失败')
    }
    setLoading(false)
  }

  const handleExportPDF = async () => {
    setExportingPDF(true)
    try {
      const res = await questionBankApi.exportExamPDF(paperId!)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${paper?.title || '试卷'}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch { alert('导出 PDF 失败') }
    setExportingPDF(false)
  }

  const handleExportWord = async () => {
    setExportingWord(true)
    try {
      const res = await questionBankApi.exportExamWord(paperId!)
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${paper?.title || '试卷'}.docx`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch { alert('导出 Word 失败') }
    setExportingWord(false)
  }

  const handleStartPractice = async () => {
    setStarting(true)
    try {
      const res = await questionBankApi.startExamPractice(paperId!)
      navigate(res.data.practice_url)
    } catch (err: any) { alert(err.response?.data?.detail || '开始练习失败') }
    setStarting(false)
  }

  const handleDelete = async () => {
    if (!confirm('确定删除试卷「' + paper?.title + '」？')) return
    setDeleting(true)
    try {
      await questionBankApi.deleteExamPaper(paperId!)
      navigate(`/banks/${bankId}`)
    } catch { alert('删除失败') }
    setDeleting(false)
  }

  const QTYPE_LABELS: Record<string, string> = {
    single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
    true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>加载中...</div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>{error}</div>
  )

  if (!paper) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ color: '#1E3A8A', cursor: 'pointer', fontSize: '13px' }} onClick={() => navigate(`/banks/${bankId}`)}>← 返回题库</span>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1F2937', margin: '8px 0 4px' }}>{paper.title}</h1>
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#9CA3AF' }}>
            <span>总分：{paper.total_score}</span>
            <span>题数：{paper.total_questions}</span>
            {paper.time_limit_minutes && <span>时限：{paper.time_limit_minutes} 分钟</span>}
            <span>状态：{paper.status === 'draft' ? '草稿' : '已发布'}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={handleStartPractice} disabled={starting || paper.total_questions === 0}
            style={{ padding: '10px 24px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: starting ? 'not-allowed' : 'pointer', opacity: starting ? 0.6 : 1 }}>
            {starting ? '加载中...' : '▶ 开始考试'}
          </button>
          <button onClick={handleExportPDF} disabled={exportingPDF}
            style={{ padding: '10px 20px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: exportingPDF ? 'not-allowed' : 'pointer', opacity: exportingPDF ? 0.6 : 1 }}>
            {exportingPDF ? '生成中...' : '📄 导出 PDF'}
          </button>
          <button onClick={handleExportWord} disabled={exportingWord}
            style={{ padding: '10px 20px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: exportingWord ? 'not-allowed' : 'pointer', opacity: exportingWord ? 0.6 : 1 }}>
            {exportingWord ? '生成中...' : '📝 导出 Word'}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            style={{ padding: '10px 20px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 12, fontSize: '14px', cursor: deleting ? 'not-allowed' : 'pointer' }}>
            删除试卷
          </button>
        </div>

        {/* Sections */}
        {paper.sections?.map((section: any, si: number) => (
          <div key={si} style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                {section.name || `第${si + 1}部分`}
              </h3>
              <span style={{ fontSize: '12px', padding: '3px 12px', borderRadius: 10, background: 'rgba(30,58,138,0.1)', color: '#1E3A8A', fontWeight: 500 }}>
                {QTYPE_LABELS[section.question_type] || section.question_type} · 每题{section.score_per_question}分
              </span>
            </div>

            {(!section.questions || section.questions.length === 0) ? (
              <div style={{ padding: '16px', color: '#D1D5DB', fontSize: '13px', textAlign: 'center' }}>该部分暂未选题</div>
            ) : (
              <div>
                {section.questions.map((q: any, qi: number) => (
                  <div key={q.id} style={{
                    padding: '10px 14px', borderTop: '1px solid #F3F4F6',
                    fontSize: '14px', color: '#374151', lineHeight: 1.6,
                  }}>
                    <span style={{ fontWeight: 600, marginRight: '8px', color: '#1E3A8A' }}>{qi + 1}.</span>
                    {q.content?.stem || '无题干'}
                    {q.content?.options && (
                      <div style={{ marginTop: '4px', paddingLeft: '24px', fontSize: '13px', color: '#6B7280' }}>
                        {q.content.options.map((opt: any) => (
                          <div key={opt.key}>{opt.key}. {opt.text}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )) || (
          <div style={{ textAlign: 'center', padding: '40px', color: '#D1D5DB', fontSize: '14px' }}>试卷暂无题目</div>
        )}
      </div>
    </div>
  )
}
