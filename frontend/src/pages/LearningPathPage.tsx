import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pathApi, type PathNodeStatus, type DagData, type KnowledgePointRecordResponse } from '../api/path'
import { questionBankApi } from '../api/questionBank'
import { SparklesIcon } from '../components/Icons'
import MarkdownRenderer from '../components/MarkdownRenderer'

const BRAND = '#1677E8', T1 = '#2C3A52', T2 = '#64748B', T3 = '#94A3B8', BL = '#E5EDF7'

function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}

/* ── SVG Flow ── */
const N_W = 130, N_H = 42, GX = 48, GY = 34, PD = 14
const PathFlowDiagram = memo(function PFD({ nodes, groups, onNodeClick }: {
  nodes: PathNodeStatus[]; groups: { domain: string; nodes: PathNodeStatus[] }[]; onNodeClick: (n: PathNodeStatus) => void
}) {
  const mx = Math.max(1, ...groups.map(g => g.nodes.length))
  const w = 100 + mx * (N_W + GX) + PD * 2, h = groups.length * (N_H + GY) + PD * 2
  const col = (s: number) => s >= 80 ? ['#D1FAE5', '#6EE7B7', '#166534', '#10B981'] : s > 40 ? ['#FEF3C7', '#FCD34D', '#92400E', '#F59E0B'] : s > 0 ? ['#FFF7ED', '#FDBA74', '#9A3412', '#F97316'] : ['#F9FAFB', '#D1D5DB', '#6B7280', '#9CA3AF']
  return <div style={{ overflow: 'auto', maxHeight: 460, background: '#F8FAFC' }}>
    <svg width={w} height={Math.max(180, h)} style={{ minWidth: '100%', fontFamily: 'inherit' }}>
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#1677E8"/></marker>
        <marker id="ag" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#9CA3AF"/></marker>
        <marker id="agr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#10B981"/></marker>
      </defs>
      <rect width={w} height={Math.max(180, h)} fill="#F8FAFC" rx="8"/>
      {groups.map((g, li) => {
        const y = PD + N_H / 2 + li * (N_H + GY)
        return <g key={g.domain}>
          <rect x={6} y={y - 13} width={78} height={26} rx={6} fill="#1677E8" opacity="0.08"/>
          <text x={45} y={y + 3} textAnchor="middle" fontSize="11" fontWeight={700} fill="#1677E8">{g.domain.length > 6 ? g.domain.slice(0, 5) + '…' : g.domain}</text>
          {g.nodes.map((n, ni) => {
            const s = n.mastery_score || 0
            const [bg, bd, tx, ba] = col(s)
            const x = 100 + ni * (N_W + GX), ny = y - N_H / 2
            const act = n.status === 'learning'
            return <g key={n.point_id} style={{ cursor: 'pointer' }} onClick={() => onNodeClick(n)}>
              <rect x={x + 1} y={ny + 1} width={N_W} height={N_H} rx={7} fill="#00000008"/>
              <rect x={x} y={ny} width={N_W} height={N_H} rx={7} fill={bg} stroke={act ? '#1677E8' : bd} strokeWidth={act ? 2 : 1.2}/>
              {act && <rect x={x} y={ny} width={N_W} height={N_H} rx={7} fill="none" stroke="#1677E8" strokeWidth="2" opacity="0.3"><animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite"/></rect>}
              <rect x={x + 5} y={ny + 4} width={42} height={13} rx={3} fill={act ? '#1677E8' : ba} opacity="0.9"/>
              <text x={x + 26} y={ny + 14} textAnchor="middle" fontSize="8" fontWeight={700} fill="#fff">{act ? '进行中' : s >= 80 ? '已掌握' : s > 0 ? '学习中' : '未开始'}</text>
              <text x={x + N_W / 2} y={ny + N_H / 2 + 3} textAnchor="middle" fontSize="11" fontWeight={700} fill={tx}>{(n.point_name || '').length > 8 ? (n.point_name || '').slice(0, 7) + '…' : n.point_name}</text>
              <rect x={x + 5} y={ny + N_H - 9} width={N_W - 10} height={4} rx={2} fill="#E5E7EB"/>
              <rect x={x + 5} y={ny + N_H - 9} width={(N_W - 10) * s / 100} height={4} rx={2} fill={ba}/>
              <title>{n.point_name} — {g.domain} — 掌握度{s}%</title>
            </g>
          })}
          {g.nodes.map((n, ni) => {
            if (ni >= g.nodes.length - 1) return null
            const x = 100 + ni * (N_W + GX) + N_W, ax2 = x + GX - 6
            return <line key={'a' + n.point_id} x1={x + 2} y1={y} x2={ax2} y2={y} stroke={(n.mastery_score || 0) >= 80 ? '#10B981' : '#9CA3AF'} strokeWidth={1.5} markerEnd={(n.mastery_score || 0) >= 80 ? 'url(#agr)' : 'url(#ag)'}/>
          })}
        </g>
      })}
    </svg>
  </div>
})

/* ── Path Select ── */
const PathSelectScreen = memo(function PSS({ paths, loading, onSelect, onCreate }: any) {
  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T3, fontSize: 14 }}>加载中...</div>
  return <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
    <h2 style={{ fontSize: 22, fontWeight: 700, color: T1, margin: '0 0 6px' }}>📚 我的学习路径</h2>
    <p style={{ fontSize: 14, color: T3, marginBottom: 24 }}>选择已有路径继续学习，或创建新的学习路径</p>
    {paths.length === 0 ? (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + BL, padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 14, color: T2, marginBottom: 20 }}>暂无学习路径</div>
        <button onClick={onCreate} style={{ padding: '10px 30px', borderRadius: 10, border: 'none', background: BRAND, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>创建新学习路径</button>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {paths.map((p: any) => <div key={p.state_id} onClick={() => onSelect(p.state_id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: 12, background: '#fff', border: '1px solid ' + BL, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📖</span>
            <div><div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{p.subject_name || '未命名'}学习路径</div><div style={{ fontSize: 12, color: T3 }}>{p.total_nodes} 个知识点 · {p.phase || '未开始'}</div></div>
          </div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 18, fontWeight: 700, color: BRAND }}>{p.progress_pct}%</div>
            <div style={{ height: 4, width: 80, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}><div style={{ height: '100%', width: p.progress_pct + '%', background: BRAND, borderRadius: 2 }}/></div>
          </div>
        </div>)}
      </div>
    )}
    <div style={{ textAlign: 'center' }}><button onClick={onCreate} style={{ padding: '10px 30px', borderRadius: 10, border: '2px dashed #D1D5DB', background: '#fff', color: T2, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>+ 创建新学习路径</button></div>
  </div>
})

/* ── Detail ── */
const DetailScreen = memo(function DS({ pointId, detailData, detailLoading, onBack, onPractice }: {
  pointId: string; detailData: any; detailLoading: boolean; onBack: () => void; onPractice: (id: string) => void
}) {
  const [videoInput, setVideoInput] = useState(detailData?.video_url || '')
  const [videoSaving, setVideoSaving] = useState(false)
  const [reviewExpanded, setReviewExpanded] = useState(false)
  const [reviewGenerating, setReviewGenerating] = useState(false)
  const [reviewContent, setReviewContent] = useState<string | null>(detailData?.review_material || null)
  const [assessMode, setAssessMode] = useState(false)
  const [assessLoading, setAssessLoading] = useState(false)
  const [assessQuestions, setAssessQuestions] = useState<any[]>([])
  const [assessAnswers, setAssessAnswers] = useState<Record<string, string>>({})
  const [assessResult, setAssessResult] = useState<any>(null)
  const [assessError, setAssessError] = useState<string | null>(null)

  useEffect(() => { setVideoInput(detailData?.video_url || ''); setReviewContent(detailData?.review_material || null) }, [detailData])
  const sv = async () => { if (!videoInput.trim()) return; setVideoSaving(true); try { await pathApi.updateVideoUrl(pointId, videoInput.trim()) } catch {}; setVideoSaving(false) }
  const gr = async () => { setReviewGenerating(true); try { const r = await pathApi.generateReviewMaterial(pointId); setReviewContent(r.data.content); setReviewExpanded(true) } catch {}; setReviewGenerating(false) }
  const sa = async () => { setAssessLoading(true); setAssessMode(true); setAssessResult(null); setAssessAnswers({}); setAssessError(null); try { const r = await pathApi.assess(pointId); setAssessQuestions(r.data.questions) } catch (e: any) { setAssessError(e?.response?.data?.detail || '加载失败'); setAssessMode(false) }; setAssessLoading(false) }
  const sm = async () => { const a = Object.entries(assessAnswers).map(([qid, c]) => ({ question_id: qid, user_choice: c })); if (!a.length) return; setAssessLoading(true); try { const r = await pathApi.submitAssess(pointId, a); setAssessResult(r.data) } catch {}; setAssessLoading(false) }
  const all = assessQuestions.length > 0 && assessQuestions.every((q: any) => assessAnswers[q.question_id])

  if (detailLoading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T3 }}>加载中...</div>
  if (!detailData) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T3 }}>暂无数据</div>

  return <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
    <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 16, fontFamily: 'inherit' }}><BackIcon /> 返回总览</button>
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid ' + BL, padding: 24, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div><h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{detailData.point_name}</h2><p style={{ fontSize: 12, color: T3, marginTop: 4 }}>{detailData.domain_name}{detailData.subject_name ? ' · ' + detailData.subject_name : ''}</p></div>
          <span style={{ padding: '4px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: detailData.status === 'mastered' ? '#D1FAE5' : '#F3F4F6', color: detailData.status === 'mastered' ? '#166534' : T2 }}>{detailData.status === 'mastered' ? '已掌握' : '学习中'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span style={{ color: T2 }}>掌握度（{detailData.total_correct || 0}/{detailData.total_practiced > 0 ? detailData.total_practiced : (detailData.total_questions || 0)}题）</span><span style={{ fontWeight: 700, color: detailData.mastery_score >= 80 ? '#10B981' : '#F59E0B' }}>{detailData.mastery_score || 0}%</span></div>
        <div style={{ height: 10, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 5, background: detailData.mastery_score >= 80 ? '#10B981' : 'linear-gradient(90deg,#EF4444,#F59E0B,#1677E8)', width: (detailData.mastery_score || 0) + '%', transition: 'width 0.6s' }}/></div>
      </div>

      {/* Video */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + BL, padding: 16, marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>📺 知识点精讲视频</h3>
        {videoInput.trim() ? <div><div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 6, fontSize: 12, color: '#065F46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{videoInput}</div><div style={{ display: 'flex', gap: 6 }}><button onClick={() => window.open(videoInput, '_blank')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>📺 打开视频</button><button onClick={() => setVideoInput('')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: T2, fontSize: 12, cursor: 'pointer' }}>✏️ 更换</button></div></div> : <div><div style={{ display: 'flex', gap: 6, marginBottom: 6 }}><button onClick={() => window.open('https://search.bilibili.com/all?keyword=' + encodeURIComponent(detailData.point_name + ' ' + (detailData.subject_name || '') + ' 讲解'), '_blank')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#00A1D6', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>🔍 B站</button><button onClick={() => window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(detailData.point_name + ' ' + (detailData.subject_name || '') + ' tutorial'), '_blank')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#FF0000', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>🔍 YouTube</button></div><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 11, color: T3, whiteSpace: 'nowrap' }}>或粘贴:</span><input value={videoInput} onChange={e => setVideoInput(e.target.value)} placeholder="https://..." style={{ flex: 1, padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, outline: 'none' }}/><button onClick={sv} disabled={videoSaving || !videoInput.trim()} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: videoSaving ? '#D1D5DB' : BRAND, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{videoSaving ? '...' : '保存'}</button></div></div>}
      </div>

      {/* Practice */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + BL, padding: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>📝 专项练习</h3><p style={{ fontSize: 12, color: T3, margin: 0 }}>{(detailData.total_practiced || 0) > 0 ? '已练习 ' + detailData.total_practiced + ' 题 · 正确 ' + detailData.total_correct + ' 题' : '暂无练习记录（共 ' + (detailData.total_questions || 0) + ' 题）'}</p></div>
          <button onClick={() => onPractice(pointId)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: BRAND, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ 开始练习 →</button>
        </div>
      </div>

      {/* Assessment */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + BL, padding: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: assessMode ? 8 : 0 }}>
          <div><h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>🔬 掌握度测评</h3>{!assessMode && <p style={{ fontSize: 12, color: T3, margin: '2px 0 0' }}>{assessResult ? '上次: ' + assessResult.correct + '/' + assessResult.total + '（' + assessResult.score + '分）' : '快速测评掌握情况'}</p>}</div>
          {!assessMode && <button onClick={sa} disabled={assessLoading} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{assessResult ? '🔄 重测' : '🔬 开始测评'}</button>}
        </div>
        {assessError && <div style={{ fontSize: 12, color: '#DC2626', padding: '6px 10px', background: '#FEF2F2', borderRadius: 6 }}>⚠️ {assessError}</div>}
        {assessMode && !assessLoading && assessQuestions.length > 0 && !assessResult && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assessQuestions.map((q: any, qi: number) => <div key={q.question_id} style={{ padding: 10, borderRadius: 7, background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{qi + 1}. {q.stem}</div>
            {q.options.map((opt: any, oi: number) => { const label = typeof opt === 'object' && opt.key ? opt.key : String.fromCharCode(65 + oi); const txt = typeof opt === 'object' ? (opt.text || opt.label || String(opt)) : String(opt); const sel = assessAnswers[q.question_id] === label; return <label key={oi} onClick={() => setAssessAnswers(p => ({ ...p, [q.question_id]: label }))} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 11, background: sel ? '#EDE9FE' : '#fff', border: '1px solid ' + (sel ? '#7C3AED' : '#E5E7EB'), marginBottom: 2 }}><input type="radio" name={q.question_id} checked={sel} readOnly style={{ accentColor: '#7C3AED' }}/>{label}. {txt}</label> })}
          </div>)}
          <button onClick={sm} disabled={!all} style={{ padding: '7px', borderRadius: 7, border: 'none', background: all ? '#7C3AED' : '#D1D5DB', color: '#fff', fontSize: 12, fontWeight: 600, cursor: all ? 'pointer' : 'not-allowed' }}>{all ? '✅ 提交测评' : '请回答全部 ' + assessQuestions.length + ' 题'}</button>
        </div>}
        {assessMode && assessResult && <div style={{ textAlign: 'center', padding: 6 }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: assessResult.score >= 80 ? '#F0FDF4' : '#FEF3C7', border: '1px solid #D1D5DB', marginBottom: 6 }}><span style={{ fontSize: 22 }}>{assessResult.score >= 80 ? '🎉' : '💪'}</span><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 700 }}>正确 {assessResult.correct}/{assessResult.total}（{assessResult.score}分）</div><div style={{ fontSize: 11, color: T3 }}>{assessResult.score >= 80 ? '掌握得很好！' : '需要多练习'}</div></div></div><div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}><button onClick={() => { setAssessMode(false); setAssessResult(null); setAssessAnswers({}) }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: T2, fontSize: 11, cursor: 'pointer' }}>关闭</button><button onClick={sa} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>🔄 再做一次</button></div></div>}
      </div>

      {/* Review */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + BL, padding: 16, marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>📖 复习资料</h3>
        {reviewContent ? <div><div onClick={() => setReviewExpanded(!reviewExpanded)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#6366F1', userSelect: 'none', marginBottom: reviewExpanded ? 6 : 0 }}>{reviewExpanded ? '收起 ▲' : '展开 ▼'} AI 生成的复习资料</div>{reviewExpanded && <div style={{ padding: '8px 10px', borderRadius: 7, background: '#F8FAFC', border: '1px solid #E5E7EB', fontSize: 13, lineHeight: 1.8, maxHeight: 360, overflowY: 'auto' }}>{typeof reviewContent === 'string' ? <MarkdownRenderer content={reviewContent}/> : <pre>{JSON.stringify(reviewContent, null, 2)}</pre>}</div>}</div> : <button onClick={gr} disabled={reviewGenerating} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: reviewGenerating ? '#D1D5DB' : '#6366F1', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{reviewGenerating ? '⏳ 生成中...' : '🤖 AI 生成复习资料'}</button>}
      </div>
    </div>
  </div>
})

/* ── Create ── */
const CreatePathScreen = memo(function CPS({ subjects, initialSubjectId, loading, onBack, onCreate }: {
  subjects: any[]; initialSubjectId: string; loading: boolean; onBack: () => void;
  onCreate: (data: { subjectId: string; goalType: string; targetScore: string; deadline: string }) => Promise<void>
}) {
  const [sid, setSid] = useState(initialSubjectId)
  const [gt, setGt] = useState('')
  const [ts, setTs] = useState('')
  const [dl, setDl] = useState('')
  const [err, setErr] = useState('')
  const [cr, setCr] = useState(false)

  const subj = subjects.find((s: any) => s.id === sid)
  const subjDomains = subj?.domains || []
  const subjKpCount = subjDomains.reduce((sum: number, d: any) => sum + (d.knowledge_points?.length || 0), 0)

  const handleCreate = async () => {
    if (!sid) { setErr('请选择学科'); return }
    if (!gt) { setErr('请选择目标类型'); return }
    setErr(''); setCr(true)
    try {
      await onCreate({ subjectId: sid, goalType: gt, targetScore: ts, deadline: dl })
    } catch (e: any) {
      setCr(false)
      setErr(e?.response?.data?.detail || e?.message || '创建失败')
    }
  }

  return <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
    <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, color: BRAND, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 16, fontFamily: 'inherit' }}><BackIcon /> 路径列表</button>
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: T1, margin: '0 0 6px' }}>🗺️ 创建学习路径</h2>
      <p style={{ fontSize: 14, color: T3, marginBottom: 24 }}>选择学科并设定学习目标，系统将自动规划学习顺序</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Subject */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block', marginBottom: 6 }}>选择学科</label>
          <select value={sid} onChange={e => setSid(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, color: T1, background: '#fff', fontFamily: 'inherit' }}>
            <option value="">请选择学科...</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {subj && <div style={{ marginTop: 6, fontSize: 12, color: T3 }}>知识点：{subjKpCount} · 章节：{subjDomains.length}</div>}
        </div>

        {/* Goal Type */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block', marginBottom: 6 }}>目标类型</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: '学期提升', label: '📚 学期提升' },
              { value: '升学备考', label: '🎯 升学备考' },
              { value: '考级考证', label: '📜 考级考证' },
            ].map(g => <button key={g.value} onClick={() => setGt(g.value)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: `2px solid ${gt === g.value ? BRAND : '#E5E7EB'}`,
                background: gt === g.value ? '#F0F9FF' : '#fff',
                color: gt === g.value ? BRAND : T2, fontSize: 13, fontWeight: gt === g.value ? 600 : 400,
                transition: 'all 0.15s',
              }}>{g.label}</button>)}
          </div>
        </div>

        {/* Target Score */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block', marginBottom: 6 }}>目标分数（选填）</label>
          <input value={ts} onChange={e => setTs(e.target.value)} placeholder="例如：90"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, color: T1, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {/* Deadline */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: T1, display: 'block', marginBottom: 6 }}>截止日期（选填）</label>
          <input type="date" value={dl} onChange={e => setDl(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, color: T1, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {err && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13 }}>{err}</div>}

        <button onClick={handleCreate} disabled={!sid || !gt || cr}
          style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: (sid && gt && !cr) ? 'pointer' : 'not-allowed',
            background: (sid && gt && !cr) ? BRAND : '#D1D5DB', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
          }}>
          {cr ? '⏳ 创建中...' : '🚀 创建学习路径'}
        </button>
      </div>
    </div>
  </div>
})

/* ── Main ── */
export default function LearningPathPage() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [pv, setPv] = useState<'select'|'create'|'overview'|'detail'>('select')
  const [pid, setPid] = useState<string|null>(null)
  const [sid, setSid] = useState<string|null>(null)
  const [gf, setGf] = useState({ goalType:'', targetScore:'', deadline:'', subjectId:'' })
  const [subjects, setSubjects] = useState<any[]>([])
  const [nodes, setNodes] = useState<PathNodeStatus[]>([])
  const [sum, setSum] = useState<Record<string,number>>({})
  const [load, setLoad] = useState(false)
  const [err, setErr] = useState<string|null>(null)
  const [pl, setPl] = useState<any[]>([])
  const [pll, setPll] = useState(true)
  const [dd, setDd] = useState<any>(null)
  const [ddl, setDdl] = useState(false)
  const [sdom, setSdom] = useState<string|null>(null)
  const [adv, setAdv] = useState<string|null>(null)
  const [init, setInit] = useState(false)

  useEffect(() => { (async () => { try { const t = localStorage.getItem('access_token'); const r = await fetch('/api/v1/question-bank/subjects', { headers: { Authorization: 'Bearer ' + t } }); setSubjects((await r.json()).subjects || []) } catch {} })() }, [])
  useEffect(() => {
    const v = sp.get('view'), s = sp.get('state')
    if (v && s) { setSid(s); _sel(s); setInit(true); return }
    // Check for subjectId from KG page navigation
    const subjId = sp.get('subjectId')
    if (subjId) {
      setSid(null)
      setGf(prev => ({ ...prev, subjectId: subjId }))
      setPv('create')
      setInit(true)
      return
    }
    _list(); setInit(true)
  }, [])

  const _list = async () => { setPll(true); try { const r = await pathApi.listPaths(); setPl(r.data.paths || []); setPv('select') } catch {}; setPll(false) }
  const _url = (v: string, s?: string, p?: string) => { const q = new URLSearchParams(); q.set('view',v); if(s) q.set('state',s); if(p) q.set('point',p); window.history.replaceState(null,'','/path?'+q.toString()) }

  const _sel = async (s: string) => {
    setSid(s); setLoad(true); setErr(null)
    try {
      const r = await pathApi.getPathState(s); const d = r.data.state
      if (d) {
        const ns: PathNodeStatus[] = (d.node_order||[]).map((n: any) => ({ point_id: n.node_id, point_name: n.name, domain_name: n.domain_name||'', domain_sort_order:0, sort_order:0, mastery_score: n.mastery_score||0, status: n.status==='done'?'mastered':n.status==='active'?'learning':'not_started', is_difficult:false, needs_review:false }))
        setNodes(ns); setSum({ total: d.progress?.total||ns.length, mastered: d.progress?.completed||0, learning: ns.filter(n=>n.status==='learning').length, not_started: ns.filter(n=>n.status==='not_started').length, reviewing:0, difficult:0 })
        setPv('overview'); _url('overview',s)
      }
    } catch (e: any) { setErr(e?.response?.data?.detail||'加载失败') }; setLoad(false)
  }

  const _ref = useCallback(async () => { if (sid) { try { const r = await pathApi.getPathState(sid); const d = r.data.state; if (d) { const ns: PathNodeStatus[] = (d.node_order||[]).map((n: any) => ({ point_id: n.node_id, point_name: n.name, domain_name: n.domain_name||'', domain_sort_order:0, sort_order:0, mastery_score: n.mastery_score||0, status: n.status==='done'?'mastered':n.status==='active'?'learning':'not_started', is_difficult:false, needs_review:false })); setNodes(ns); setSum({ total: d.progress?.total||ns.length, mastered: d.progress?.completed||0, learning: ns.filter(n=>n.status==='learning').length, not_started: ns.filter(n=>n.status==='not_started').length, reviewing:0, difficult:0 }) } } catch {} } }, [sid])

  const _navigateToPractice = async (pointId: string) => {
    try {
      const res = await questionBankApi.getKnowledgePointPracticeBank(pointId)
      nav(`/banks/${res.data.bank_id}/practice?point=${encodeURIComponent(pointId)}`)
    } catch {
      nav('/banks')
    }
  }

  // 点击节点 → 未开始节点无操作，其他节点跳转到知识点详情界面
  const _nclick = async (n: PathNodeStatus) => {
    if (n.status === 'not_started') return
    _showDetail(n)
  }

  // AI讲解按钮 → 显示知识点详情
  const _showDetail = async (n: PathNodeStatus) => {
    setPid(n.point_id); setPv('detail'); _url('detail',sid||undefined,n.point_id); setDdl(true)
    try { const r = await pathApi.getKnowledgeDetail(n.point_id); setDd(r.data) } catch {}; setDdl(false)
  }
  const _back = useCallback(() => { setPv('overview'); if (sid) { _url('overview',sid); _ref() } }, [sid,_ref])
  const _gen = async () => { if (!gf.goalType||!gf.subjectId) return; try { const r = await pathApi.initPath({ subject_id: gf.subjectId, goal_type: gf.goalType, goal_description: '目标分数:'+gf.targetScore+',截止:'+gf.deadline }); await _sel(r.data.state_id) } catch (e: any) { alert(e?.response?.data?.detail||'创建失败') } }
  const _adv = async (p: string) => { if (!sid||adv) return; setAdv(p); try { await pathApi.updateProgress({ node_id: p, action: 'complete', state_id: sid }); await pathApi.recordKnowledgeStudy(p); await _ref() } catch {}; setAdv(null) }
  const _goback = () => { setPv('select'); _list(); window.history.replaceState(null,'','/path') }

  const tt = sum.total||1; const mst = sum.mastered||0; const rate = Math.round((mst/tt)*100)
  const groups = useMemo(() => { const m = new Map<string,PathNodeStatus[]>(); nodes.forEach(n => { const k = n.domain_name||'未分类'; if(!m.has(k)) m.set(k,[]); m.get(k)!.push(n) }); return Array.from(m.entries()).map(([d,nds]) => ({ domain:d, nodes:nds })) }, [nodes])
  const focus = useMemo(() => nodes.find(n => n.status==='learning')||nodes.find(n => n.mastery_score<80), [nodes])
  const phases = useMemo(() => {
    const p: [string,PathNodeStatus[]][] = [['基础入门',[]],['强化提升',[]],['巩固复习',[]]]
    nodes.forEach(n => { if(n.mastery_score>=80) p[2][1].push(n); else if(n.mastery_score>0) p[1][1].push(n); else p[0][1].push(n) })
    return p.filter(([,nds]) => nds.length>0).map(([name,nds],i) => ({ name, color: ['#1677E8','#3B82F6','#10B981'][i], progress: nds.length?Math.round(nds.filter(n=>n.mastery_score>=80).length/nds.length*100):0 }))
  }, [nodes])

  if (!init) return null

  return <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
    <header style={{ height:44, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', borderBottom:'1px solid '+BL, flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={() => pv==='select' ? nav('/home') : _goback()} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:T2, fontSize:13, fontFamily:'inherit' }}><BackIcon /> {pv==='select'?'首页':'路径列表'}</button>
        <h1 style={{ fontSize:15, fontWeight:700, margin:0, color:T1 }}>学习路径规划</h1>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <span style={{ fontSize:12, color:T3 }}>{pl.length} 条路径</span>
        {pv==='overview' && <button onClick={_goback} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #D1D5DB', background:'#fff', color:T2, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>切换路径</button>}
      </div>
    </header>

    {pv==='select' && <PathSelectScreen paths={pl} loading={pll} onSelect={_sel} onCreate={() => setPv('create')} />}
    {pv==='create' && <CreatePathScreen
      subjects={subjects}
      initialSubjectId={sp.get('subjectId') || ''}
      loading={load}
      onBack={_goback}
      onCreate={async (data) => {
        setLoad(true)
        try {
          const r = await pathApi.initPath({
            subject_id: data.subjectId,
            goal_type: data.goalType,
            goal_description: `目标分数:${data.targetScore},截止:${data.deadline}`
          })
          await _sel(r.data.state_id)
        } catch (e: any) {
          throw e
        } finally {
          setLoad(false)
        }
      }}
    />}

    {pv==='detail' && pid && <DetailScreen pointId={pid} detailData={dd} detailLoading={ddl} onBack={_back} onPractice={(p:string) => _navigateToPractice(p)} />}

    {pv==='overview' && <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ margin:'10px 20px 0', padding:'8px 16px', background:'#fff', borderRadius:10, border:'1px solid '+BL, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <span style={{ fontSize:18, fontWeight:800, color:rate>=80?'#10B981':BRAND }}>{rate}%</span>
        <div style={{ flex:1, minWidth:80, height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}><div style={{ height:'100%', borderRadius:3, transition:'width 0.6s', background:rate>=80?'#10B981':'linear-gradient(90deg,'+BRAND+',#38BDF8)', width:rate+'%' }}/></div>
        <div style={{ display:'flex', gap:8, fontSize:11, color:T3 }}><span><span style={{ color:'#10B981', fontWeight:600 }}>✓ {mst}</span> 已掌握</span><span><span style={{ color:'#3B82F6', fontWeight:600 }}>● {sum.learning||0}</span> 学习中</span><span>共 {tt} 点</span></div>
        <select value={sdom||''} onChange={e => setSdom(e.target.value||null)} style={{ padding:'2px 6px', borderRadius:5, border:'1px solid #D1D5DB', fontSize:11, color:T1, background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
          <option value="">📚 全部章节</option>
          {groups.map(g => <option key={g.domain} value={g.domain}>{g.domain}（{g.nodes.length}）</option>)}
        </select>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'6px 20px 10px', display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>{phases.map((p,i) => <button key={i} style={{ padding:'2px 8px', borderRadius:10, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:10, fontWeight:500, color:p.color, fontFamily:'inherit' }}>{p.name} {p.progress}%</button>)}</div>
        {focus && <div style={{ padding:'7px 12px', background:'linear-gradient(135deg,#F0F9FF,#E0F2FE)', borderRadius:8, border:'1px solid #BAE6FD', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:14 }}>🎯</span>
          <div style={{ flex:1, minWidth:0 }}><span style={{ fontSize:12, fontWeight:700 }}>{focus.point_name}</span><span style={{ fontSize:10, color:T3, marginLeft:6 }}>{focus.domain_name} · 掌握度 {focus.mastery_score}%</span></div>
          <button onClick={() => _adv(focus.point_id)} disabled={adv===focus.point_id} style={{ padding:'4px 10px', borderRadius:5, border:'none', background:'#10B981', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>✅ 已学会</button>
          <button onClick={() => _showDetail(focus)} style={{ padding:'4px 10px', borderRadius:5, border:'1px solid #F59E0B', background:'#FFFBEB', color:'#92400E', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>✏️ 练习</button>
          <button onClick={() => _showDetail(focus)} style={{ padding:'4px 10px', borderRadius:5, border:'1px solid #BAE6FD', background:'#F0F9FF', color:BRAND, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>🤖 AI讲解</button>
        </div>}

        <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
          <div style={{ flex:1, background:'#fff', borderRadius:10, border:'1px solid '+BL, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'5px 14px', borderBottom:'1px solid #E5E7EB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, fontWeight:600, color:T1 }}>📊 知识路径</span>
              <div style={{ display:'flex', gap:5, fontSize:9, color:T3 }}><span style={{ display:'flex', alignItems:'center', gap:2 }}><span style={{ width:6, height:6, borderRadius:1, background:'#10B981' }}/>已掌握</span><span style={{ display:'flex', alignItems:'center', gap:2 }}><span style={{ width:6, height:6, borderRadius:1, background:'#3B82F6' }}/>进行中</span><span style={{ display:'flex', alignItems:'center', gap:2 }}><span style={{ width:6, height:6, borderRadius:1, background:'#F59E0B' }}/>学习中</span><span style={{ display:'flex', alignItems:'center', gap:2 }}><span style={{ width:6, height:6, borderRadius:1, background:'#D1D5DB' }}/>未开始</span></div>
            </div>
            <div style={{ flex:1, minHeight:260 }}>
              {load ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T3, fontSize:13 }}>加载中...</div>
                : err ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#EF4444', fontSize:13 }}>{err}</div>
                : nodes.length===0 ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T3, fontSize:13 }}>暂无数据</div>
                : <PathFlowDiagram nodes={nodes} groups={sdom?groups.filter(g=>g.domain===sdom):groups} onNodeClick={_nclick} />}
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>
}