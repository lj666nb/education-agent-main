import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { questionBankApi, type BankItem, type SubjectItem } from '../api/questionBank'
import { BookIcon, CloseIcon, ArrowLeftIcon, EditIcon, CheckCircleIcon, BarChartIcon, ClockIcon, SearchIcon } from '../components/Icons'
import { EmptyState, LoadingState } from '../components/shared'
import { useTheme } from '../store/theme'

function useTokens() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    isDark,
    bgPage: isDark ? '#0F172A' : '#F7FAFF',
    bgCard: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#E2E8F0' : '#1E293B',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    textMuted: isDark ? '#64748B' : '#94A3B8',
    border: isDark ? '#334155' : '#E5EDF7',
    brand: '#1677E8',
    brandLight: isDark ? 'rgba(22,119,232,0.15)' : '#EFF6FF',
    shadowSm: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
    shadowMd: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.06)',
    dangerBg: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
    dangerText: isDark ? '#FCA5A5' : '#DC2626',
  }
}

export default function BankListPage() {
  const navigate = useNavigate()
  const t = useTokens()
  const [banks, setBanks] = useState<BankItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  const filteredBanks = search.trim()
    ? banks.filter(b => b.name.includes(search.trim()) || getSubjectName(b.subject_id).includes(search.trim()))
    : banks

  const totalQuestions = banks.reduce((sum, b) => sum + (b.total_questions || 0), 0)
  const avgMastery: number | null = null
  const colors = ['#3B82F6', '#14B8A6', '#8B5CF6', '#F97316', '#EC4899', '#06B6D4']

  return (
    <div style={{ minHeight: '100vh', background: t.bgPage, fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif" }}>
      <style>{`
        @keyframes bkFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .bk-card { opacity: 0; animation: bkFadeUp 0.45s ease forwards; }
        .bk-card:nth-child(1) { animation-delay: 0.05s; } .bk-card:nth-child(2) { animation-delay: 0.1s; }
        .bk-card:nth-child(3) { animation-delay: 0.15s; } .bk-card:nth-child(4) { animation-delay: 0.2s; }
        .bk-card:nth-child(5) { animation-delay: 0.25s; } .bk-card:nth-child(6) { animation-delay: 0.3s; }
        .bk-hover { transition: all 0.22s cubic-bezier(0.4,0,0.2,1); }
        .bk-hover:hover { transform: translateY(-2px); }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span onClick={() => navigate('/')} style={{ color: t.brand, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeftIcon size={14} /> 返回首页
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, margin: 0 }}>题库</h1>
            <span style={{ fontSize: 12, color: t.textMuted, background: t.isDark ? 'rgba(148,163,184,0.1)' : '#F1F5F9', padding: '2px 10px', borderRadius: 10 }}>
              {banks.length} 个题库
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowSubjectModal(true)}
              style={{ padding: '9px 18px', background: t.isDark ? '#334155' : '#F1F5F9', color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + 新建学科
            </button>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '9px 22px', background: t.brand, color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              + 新建题库
            </button>
          </div>
        </div>

        {/* ── Stat Cards Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '题库总数', value: banks.length, unit: '个', color: '#3B82F6', bg: t.isDark ? '#1E3A5F' : '#EFF6FF', icon: <BookIcon size={16} color="#3B82F6" /> },
            { label: '题目总量', value: totalQuestions, unit: '题', color: '#14B8A6', bg: t.isDark ? '#134E4A' : '#F0FDFA', icon: <EditIcon size={16} color="#14B8A6" /> },
            { label: '学科数量', value: subjects.length, unit: '个', color: '#8B5CF6', bg: t.isDark ? '#2D1B69' : '#F5F3FF', icon: <BarChartIcon size={16} color="#8B5CF6" /> },
            { label: '掌握度均值', value: avgMastery ?? '--', unit: '', color: '#F97316', bg: t.isDark ? '#4A2C0A' : '#FFF7ED', icon: <CheckCircleIcon size={16} color="#F97316" /> },
          ].map((card, i) => (
            <div key={i} className="bk-card bk-hover" style={{
              background: t.bgCard, borderRadius: 14, border: `1px solid ${t.border}`, boxShadow: t.shadowSm,
              padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = t.shadowMd }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = t.shadowSm }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color, lineHeight: 1.2 }}>{card.value}<span style={{ fontSize: '0.7rem', fontWeight: 500, marginLeft: 2 }}>{card.unit}</span></div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted }}>{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + Subject Filter ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted }}>
              <SearchIcon size={14} />
            </div>
            <input placeholder="搜索题库名称或学科..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 14px 9px 34px', border: `1.5px solid ${t.border}`, borderRadius: 12, fontSize: 13, outline: 'none', background: t.bgCard, color: t.textPrimary }} />
          </div>
          {subjects.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>学科：</span>
              {subjects.map(s => (
                <span key={s.id} style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: t.brandLight, color: t.brand, border: `1px solid ${t.isDark ? 'rgba(22,119,232,0.25)' : 'rgba(30,58,138,0.15)'}` }}>
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Bank Cards ── */}
        {loading ? (
          <LoadingState />
        ) : filteredBanks.length === 0 ? (
          <EmptyState
            icon={<BookIcon size={48} />}
            title={search ? '未找到匹配的题库' : '还没有题库'}
            description={search ? '尝试其他关键词搜索' : '先创建学科，再在学科下创建题库来管理题目'}
            actions={<>
              <button onClick={() => setShowSubjectModal(true)} style={{ padding: '10px 24px', background: t.isDark ? '#334155' : '#F1F5F9', color: t.textSecondary, border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>新建学科</button>
              <button onClick={() => setShowCreate(true)} style={{ padding: '10px 24px', background: t.brand, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>创建题库</button>
            </>}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredBanks.map((bank, i) => {
              const colorIdx = i % colors.length
              const cardColor = colors[colorIdx]
              return (
                <div key={bank.id} onClick={() => {
                  if (bank.tags?.includes('编程题')) { navigate('/coding-practice') }
                  else { navigate(`/banks/${bank.id}`) }
                }}
                  className="bk-card bk-hover"
                  style={{
                    background: t.bgCard, borderRadius: 16, boxShadow: t.shadowSm,
                    borderLeft: `4px solid ${cardColor}`, border: '1px solid transparent',
                    borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: cardColor,
                    cursor: 'pointer', overflow: 'hidden',
                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = t.shadowMd; e.currentTarget.style.borderColor = cardColor }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = t.shadowSm; e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <div style={{ padding: '22px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Left: icon + info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                      {/* Subject icon */}
                      <div style={{
                        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                        background: t.isDark ? `${cardColor}22` : `${cardColor}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, color: cardColor,
                      }}>
                        {getSubjectName(bank.subject_id).charAt(0)}
                      </div>
                      {/* Info */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 16, color: t.textPrimary, marginBottom: 3 }}>
                          {bank.name}
                          <span style={{ fontSize: 11, fontWeight: 500, color: t.brand, marginLeft: 8, padding: '2px 8px', borderRadius: 10, background: t.brandLight }}>
                            {getSubjectName(bank.subject_id)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: t.textMuted, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <EditIcon size={12} /> {bank.total_questions} 道题
                          </span>
                          {bank.description && <span>· {bank.description}</span>}
                          <span style={{ color: t.textMuted, fontWeight: 500 }}>掌握度 --</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Recent Practice Section ── */}
        {banks.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: t.textPrimary, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockIcon size={15} color={t.brand} /> 最近练习题库
            </h3>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {banks.slice(0, Math.min(4, banks.length)).map((bank, i) => (
                <div key={bank.id} onClick={() => {
                  if (bank.tags?.includes('编程题')) { navigate('/coding-practice') }
                  else { navigate(`/banks/${bank.id}`) }
                }}
                  style={{
                    minWidth: 200, flex: 1, padding: '16px 18px', borderRadius: 14,
                    background: t.bgCard, border: `1px solid ${t.border}`,
                    boxShadow: t.shadowSm, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = t.shadowMd }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = t.shadowSm }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, marginBottom: 4 }}>{bank.name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{bank.total_questions} 题</div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: t.textSecondary }}>继续刷题 →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── 新建题库弹窗 ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: t.bgCard, borderRadius: 16, width: 420, maxWidth: '90vw', padding: '28px', boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: t.textPrimary, margin: 0 }}>新建题库</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: t.textMuted }}><CloseIcon size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input autoFocus placeholder="题库名称" value={formName} onChange={e => setFormName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${t.border}`, borderRadius: 10, fontSize: '14px', outline: 'none', background: t.isDark ? '#0F172A' : '#fff', color: t.textPrimary }} />
              <select value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${t.border}`, borderRadius: 10, fontSize: '14px', outline: 'none', background: t.isDark ? '#0F172A' : '#fff', color: t.textPrimary, cursor: 'pointer' }}>
                <option value="">选择学科</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input placeholder="描述（可选）" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${t.border}`, borderRadius: 10, fontSize: '14px', outline: 'none', background: t.isDark ? '#0F172A' : '#fff', color: t.textPrimary }} />
              <button onClick={handleCreate} disabled={!formName.trim() || !formSubjectId || saving}
                style={{ padding: '12px', background: t.brand, color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: saving || !formName.trim() || !formSubjectId ? 'not-allowed' : 'pointer', opacity: saving || !formName.trim() || !formSubjectId ? 0.6 : 1 }}>
                {saving ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 新建学科弹窗 ── */}
      {showSubjectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: t.bgCard, borderRadius: 16, width: 420, maxWidth: '90vw', padding: '28px', boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: t.textPrimary, margin: 0 }}>新建学科</h3>
              <button onClick={() => setShowSubjectModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: t.textMuted }}><CloseIcon size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, fontSize: '13px', lineHeight: 1.6, background: t.isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF4', color: t.isDark ? '#6EE7B7' : '#065F46' }}>
                学科是题库的顶层分类，例如「计算机科学」「前端开发」「数据结构」等。
                <br />创建后即可在该学科下新建题库。
              </div>
              <input autoFocus placeholder="学科名称，如 计算机科学" value={subjName} onChange={e => setSubjName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${t.border}`, borderRadius: 10, fontSize: '14px', outline: 'none', background: t.isDark ? '#0F172A' : '#fff', color: t.textPrimary }} />
              <input placeholder="描述（可选）" value={subjDesc} onChange={e => setSubjDesc(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${t.border}`, borderRadius: 10, fontSize: '14px', outline: 'none', background: t.isDark ? '#0F172A' : '#fff', color: t.textPrimary }} />
              <button onClick={handleCreateSubject} disabled={!subjName.trim() || subjSaving}
                style={{ padding: '12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 12, fontSize: '15px', fontWeight: 500, cursor: subjSaving || !subjName.trim() ? 'not-allowed' : 'pointer', opacity: subjSaving || !subjName.trim() ? 0.6 : 1 }}>
                {subjSaving ? '创建中...' : '创建学科'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
