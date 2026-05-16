import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { questionBankApi, type BankItem, type SubjectItem } from '../api/questionBank'

export default function BankListPage() {
  const navigate = useNavigate()
  const [banks, setBanks] = useState<BankItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [loading, setLoading] = useState(true)

  // 新建题库
  const [showCreate, setShowCreate] = useState(false)
  const [formName, setFormName] = useState('')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // 新建学科
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [subjName, setSubjName] = useState('')
  const [subjDesc, setSubjDesc] = useState('')
  const [subjSaving, setSubjSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [bRes, sRes] = await Promise.all([
        questionBankApi.listBanks({ page_size: 100 }),
        questionBankApi.listSubjects(),
      ])
      setBanks(bRes.data.banks)
      setSubjects(sRes.data.subjects)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!formName.trim() || !formSubjectId) return
    setSaving(true)
    try {
      await questionBankApi.createBank({ name: formName.trim(), subject_id: formSubjectId, description: formDesc.trim() || undefined })
      setShowCreate(false); setFormName(''); setFormSubjectId(''); setFormDesc('')
      await loadData()
    } catch (err: any) { alert(err.response?.data?.detail || '创建失败') }
    setSaving(false)
  }

  const handleDelete = async (bank: BankItem) => {
    if (!confirm(`确定删除题库「${bank.name}」？里面的题目将一并删除。`)) return
    try { await questionBankApi.deleteBank(bank.id); setBanks(prev => prev.filter(b => b.id !== bank.id))
    } catch (err: any) { alert(err.response?.data?.detail || '删除失败') }
  }

  const handleCreateSubject = async () => {
    if (!subjName.trim()) return
    setSubjSaving(true)
    try {
      await questionBankApi.createSubject({ name: subjName.trim(), description: subjDesc.trim() || undefined })
      setShowSubjectModal(false); setSubjName(''); setSubjDesc('')
      await loadData()
    } catch (err: any) { alert(err.response?.data?.detail || '创建失败') }
    setSubjSaving(false)
  }

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || '未知'

  const colors = ['#1E3A8A', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6']

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#1E3A8A', cursor: 'pointer', fontSize: '14px' }} onClick={() => navigate('/')}>← 返回首页</span>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1F2937', margin: 0 }}>题库</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowSubjectModal(true)}
              style={{ padding: '10px 20px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              + 新建学科
            </button>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '10px 24px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              + 新建题库
            </button>
          </div>
        </div>

        {/* 学科列表 */}
        {subjects.length > 0 && (
          <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>学科：</span>
            {subjects.map(s => (
              <span key={s.id} style={{
                padding: '4px 14px', borderRadius: 20, fontSize: '13px', fontWeight: 500,
                background: 'rgba(30,58,138,0.08)', color: '#1E3A8A', border: '1px solid rgba(30,58,138,0.15)',
              }}>
                {s.name}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: '#9CA3AF' }}>加载中...</div>
        ) : banks.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '80px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
            <p style={{ color: '#9CA3AF', marginBottom: 8 }}>还没有题库</p>
            <p style={{ color: '#D1D5DB', fontSize: '13px', marginBottom: '20px' }}>先创建学科，再在学科下创建题库来管理题目</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => setShowSubjectModal(true)} style={{ padding: '10px 24px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>新建学科</button>
              <button onClick={() => setShowCreate(true)} style={{ padding: '10px 24px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '14px', cursor: 'pointer' }}>创建题库</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {banks.map((bank, i) => (
              <div key={bank.id} onClick={() => navigate(`/banks/${bank.id}`)}
                style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', borderLeft: `4px solid ${colors[i % colors.length]}`, cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: '#1F2937', marginBottom: '4px' }}>{bank.name}</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#9CA3AF' }}>
                      <span>{getSubjectName(bank.subject_id)}</span>
                      <span>·</span>
                      <span>{bank.total_questions} 道题</span>
                      {bank.description && <><span>·</span><span>{bank.description}</span></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); navigate(`/banks/${bank.id}`) }}
                      style={{ padding: '8px 18px', fontSize: '13px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 500 }}>
                      管理题目
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(bank) }}
                      style={{ padding: '8px 14px', fontSize: '13px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建题库弹窗 */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={() => setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 420, maxWidth: '90vw', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937', margin: 0 }}>新建题库</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input autoFocus placeholder="题库名称" value={formName} onChange={e => setFormName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              <select value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none', background: '#fff', cursor: 'pointer' }}>
                <option value="">选择学科</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input placeholder="描述（可选）" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              <button onClick={handleCreate} disabled={!formName.trim() || !formSubjectId || saving}
                style={{ padding: '12px', background: '#1E3A8A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: saving || !formName.trim() || !formSubjectId ? 'not-allowed' : 'pointer', opacity: saving || !formName.trim() || !formSubjectId ? 0.6 : 1 }}>
                {saving ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建学科弹窗 */}
      {showSubjectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={() => setShowSubjectModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 420, maxWidth: '90vw', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937', margin: 0 }}>新建学科</h3>
              <button onClick={() => setShowSubjectModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px 14px', background: '#F0FDF4', borderRadius: 10, fontSize: '13px', color: '#059669', lineHeight: 1.6 }}>
                学科是题库的顶层分类，例如「计算机科学」「前端开发」「数据结构」等。
                <br/>创建后即可在该学科下新建题库。
              </div>
              <input autoFocus placeholder="学科名称，如 计算机科学" value={subjName} onChange={e => setSubjName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              <input placeholder="描述（可选）" value={subjDesc} onChange={e => setSubjDesc(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '14px', outline: 'none' }} />
              <button onClick={handleCreateSubject} disabled={!subjName.trim() || subjSaving}
                style={{ padding: '12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: subjSaving || !subjName.trim() ? 'not-allowed' : 'pointer', opacity: subjSaving || !subjName.trim() ? 0.6 : 1 }}>
                {subjSaving ? '创建中...' : '创建学科'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
