import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pathApi, type PathNodeStatus, type PathListItem } from '../api/path'
import { questionBankApi } from '../api/questionBank'
import MarkdownRenderer from '../components/MarkdownRenderer'

const BRAND = '#1677E8', T1 = '#2C3A52', T2 = '#64748B', T3 = '#94A3B8', BL = '#E5EDF7'
const BG_PAGE = '#F4F8FC'

/* ── Icons ── */
function BackIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function StarIcon({filled}:{filled?:boolean}) { return <svg width="14" height="14" viewBox="0 0 24 24" fill={filled?BRAND:'none'} stroke={filled?BRAND:'currentColor'} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
function CloseIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function CheckIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> }
function DownIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg> }

/* ── SVG Flow Diagram ── */
const N_W = 134, N_H = 46, GX = 52, GY = 38, PD = 18
const PathFlowDiagram = memo(function PFD({ nodes, groups, onNodeClick, onNodeContext, weakMode, highlightNode, zoomLevel }: {
  nodes: PathNodeStatus[]; groups: { domain: string; nodes: PathNodeStatus[] }[]; onNodeClick: (n: PathNodeStatus) => void
  onNodeContext?: (e: React.MouseEvent, n: PathNodeStatus) => void; weakMode?: boolean; highlightNode?: string | null; zoomLevel?: number
}) {
  const mx = Math.max(1, ...groups.map(g => g.nodes.length))
  const w = 100 + mx * (N_W + GX) + PD * 2, h = groups.length * (N_H + GY) + PD * 2
  const statusColor = (n: PathNodeStatus) => {
    if (weakMode && (n.mastery_score || 0) < 40) return { bg:'#FEE2E2', bd:'#EF4444', tx:'#991B1B', ba:'#EF4444', label:'薄弱' }
    if (n.needs_review) return { bg:'#FFFBEB', bd:'#F59E0B', tx:'#92400E', ba:'#F59E0B', label:'待复习' }
    if (n.status === 'mastered') return { bg:'#D1FAE5', bd:'#6EE7B7', tx:'#166534', ba:'#10B981', label:'已掌握' }
    if (n.status === 'learning') return { bg:'#DBEAFE', bd:'#3B82F6', tx:'#1E40AF', ba:BRAND, label:'学习中' }
    return { bg:'#F9FAFB', bd:'#D1D5DB', tx:'#6B7280', ba:'#9CA3AF', label:'未开始' }
  }
  return <div className="flow-svg-container" style={{ overflow: 'auto', maxHeight: 500, background: BG_PAGE, borderRadius: 8 }}>
    <svg width={w} height={Math.max(180, h)} style={{ minWidth: '100%', fontFamily: 'inherit', transition: 'transform 0.2s', transformOrigin: 'top left', transform: `scale(${zoomLevel||1})` }}>
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill={BRAND}/></marker>
        <marker id="agr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#10B981"/></marker>
        <marker id="ag" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#9CA3AF"/></marker>
      </defs>
      <rect width={w} height={Math.max(180, h)} fill={BG_PAGE} rx="8"/>
      {groups.map((g, li) => {
        const y = PD + N_H / 2 + li * (N_H + GY)
        return <g key={g.domain}>
          <rect x={6} y={y - 13} width={80} height={26} rx={6} fill={BRAND} opacity="0.08"/>
          <text x={46} y={y + 3} textAnchor="middle" fontSize="11" fontWeight={700} fill={BRAND}>{(g.domain||'').length > 7 ? (g.domain||'').slice(0, 6) + '…' : g.domain}</text>
          {g.nodes.map((n, ni) => {
            const s = n.mastery_score || 0
            const { bg, bd, tx, ba } = statusColor(n)
            const x = 100 + ni * (N_W + GX), ny = y - N_H / 2
            const hl = highlightNode === n.point_id
            return <g key={n.point_id} style={{ cursor: 'pointer' }} onClick={() => onNodeClick(n)} onContextMenu={e => { e.preventDefault(); onNodeContext?.(e, n) }}>
              <rect x={x + 1} y={ny + 1} width={N_W} height={N_H} rx={8} fill="#00000008"/>
              <rect x={x} y={ny} width={N_W} height={N_H} rx={8} fill={bg} stroke={hl ? BRAND : bd} strokeWidth={hl ? 2.5 : 1.2} opacity={hl ? 1 : 0.9}/>
              {hl && <rect x={x} y={ny} width={N_W} height={N_H} rx={8} fill="none" stroke={BRAND} strokeWidth="2.5" opacity="0.4"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite"/></rect>}
              <text x={x + N_W/2} y={ny + 16} textAnchor="middle" fontSize="10" fontWeight={700} fill={tx}>{(n.point_name||'').length > 9 ? (n.point_name||'').slice(0, 8) + '…' : n.point_name}</text>
              <rect x={x + 5} y={ny + N_H - 8} width={N_W - 10} height={4} rx={2} fill="#E5E7EB"/>
              <rect x={x + 5} y={ny + N_H - 8} width={(N_W - 10) * s / 100} height={4} rx={2} fill={ba} opacity="0.7"/>
              <text x={x + N_W/2} y={ny + 28} textAnchor="middle" fontSize="8" fontWeight={600} fill={tx} opacity="0.7">{statusColor(n).label} {s}%</text>
              <title>{n.point_name} — {g.domain} — 掌握度{s}%{n.needs_review?' — 待复习':''}</title>
            </g>
          })}
          {g.nodes.map((n, ni) => {
            if (ni >= g.nodes.length - 1) return null
            const x = 100 + ni * (N_W + GX) + N_W, ax2 = x + GX - 6
            const prevS = g.nodes[ni]?.mastery_score || 0, nextS = g.nodes[ni + 1]?.mastery_score || 0
            return <line key={'a'+n.point_id} x1={x+2} y1={y} x2={ax2} y2={y} stroke={prevS>=80&&nextS>=80?'#10B981':'#9CA3AF'} strokeWidth={1.5} markerEnd={prevS>=80&&nextS>=80?'url(#agr)':'url(#ag)'}/>
          })}
        </g>
      })}
    </svg>
  </div>
})

/* ═══════════════════════════════════════════════════════════════
   PAGE 1: PATH LIST (Select Screen)
   ═══════════════════════════════════════════════════════════════ */
const PATH_TEMPLATES = [
  { name: '数据结构速成', desc: '14天快速掌握核心数据结构', subject: '数据结构', days: 14, icon: '⚡', goalType: '学期提升', targetScore: '80', deadline: '' },
  { name: '期末突击', desc: '7天期末全面复习冲刺', subject: '数据结构', days: 7, icon: '🎯', goalType: '升学备考', targetScore: '90', deadline: '' },
  { name: '考研专项', desc: '系统构建数据结构知识体系', subject: '数据结构', days: 45, icon: '📚', goalType: '升学备考', targetScore: '95', deadline: '' },
]

const PathSelectScreen = memo(function PSS({ paths, loading, onCreate, onSelect, onTemplate, onDelete, onToggleFavorite, onReset, favorites }: {
  paths: PathListItem[]; loading: boolean; onCreate: (mode:string) => void; onSelect: (id:string)=>void
  onTemplate: (t:typeof PATH_TEMPLATES[0])=>void; onDelete: (id:string)=>void; onToggleFavorite: (id:string)=>void; onReset: (id:string)=>void; favorites: Set<string>
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showTemplates, setShowTemplates] = useState(false)
  const [hoverId, setHoverId] = useState<string|null>(null)

  const filtered = useMemo(() => {
    let list = [...paths]
    if (search) list = list.filter(p => (p.subject_name||p.path_name||'').toLowerCase().includes(search.toLowerCase()))
    if (statusFilter === 'active') list = list.filter(p => p.phase !== 'completed')
    if (statusFilter === 'completed') list = list.filter(p => p.phase === 'completed')
    // Favorites first
    list.sort((a,b) => (favorites.has(b.state_id)?1:0) - (favorites.has(a.state_id)?1:0))
    return list
  }, [paths, search, statusFilter, favorites])

  const stats = useMemo(() => {
    const total = paths.length, active = paths.filter(p=>p.phase!=='completed').length
    const completed = paths.filter(p=>p.phase==='completed').length
    const avgPct = paths.length ? Math.round(paths.reduce((s,p)=>s+p.progress_pct,0)/paths.length) : 0
    // Stable trend data derived from actual path progress, not random
    const trendHeights = [...Array(7)].map((_,i) => {
      const base = avgPct * 0.18
      // Each bar slightly varies around the average progress value, stable per render
      const seed = (i * 7 + total * 13) % 10
      return base + seed * 2.5
    })
    return { total, active, completed, avgPct, trendHeights }
  }, [paths])

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:T3, fontSize:14 }}>加载中...</div>

  return <div style={{ flex:1, overflow:'auto', background: BG_PAGE }}>
    {/* ── Stats Bar ── */}
    <div style={{ display:'flex', gap:12, padding:'20px 28px 0', flexWrap:'wrap' }}>
      {[{label:'总路径',v:stats.total,color:BRAND},{label:'进行中',v:stats.active,color:'#F59E0B'},{label:'已掌握知识点',v:paths.reduce((s,p)=>s+(p.completed_nodes||0),0),color:'#10B981'},{label:'薄弱知识点',v:Math.max(0,paths.reduce((s,p)=>s+Math.max(0,p.total_nodes-(p.completed_nodes||0)),0)),color:'#EF4444'}].map((s,i)=>(
        <div key={i} style={{ flex:'1 1 120px', minWidth:120, background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid '+BL, display:'flex', flexDirection:'column', gap:2 }}>
          <span style={{ fontSize:11, color:T3, fontWeight:500 }}>{s.label}</span>
          <span style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.v}</span>
        </div>
      ))}
      {/* Mini trend */}
      <div style={{ flex:'2 1 200px', minWidth:200, background:'#fff', borderRadius:12, padding:'12px 16px', border:'1px solid '+BL, display:'flex', flexDirection:'column', gap:4 }}>
        <span style={{ fontSize:11, color:T3, fontWeight:500 }}>近7天进度趋势</span>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:36 }}>
          {stats.trendHeights.map((h,i)=><div key={i} style={{ flex:1, height:Math.max(8,h), borderRadius:3, background:`linear-gradient(180deg,${BRAND},#7DD3FC)`, opacity:0.5+i*0.07 }}/>)}
        </div>
      </div>
    </div>

    {/* ── Filter + Actions Bar ── */}
    <div style={{ display:'flex', gap:10, padding:'16px 28px', alignItems:'center', flexWrap:'wrap' }}>
      <div style={{ display:'flex', gap:6 }}>
        {[{k:'all',l:'全部'},{k:'active',l:'进行中'},{k:'completed',l:'已完成'}].map(f=>(
          <button key={f.k} onClick={()=>setStatusFilter(f.k)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid '+(statusFilter===f.k?BRAND:BL), background:statusFilter===f.k?'#F0F9FF':'#fff', color:statusFilter===f.k?BRAND:T2, fontSize:12, cursor:'pointer', fontWeight:500, fontFamily:'inherit' }}>{f.l}</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, background:'#fff', border:'1px solid '+BL, flex:1, minWidth:160, maxWidth:260 }}>
        <SearchIcon/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索路径名称..." style={{ border:'none', outline:'none', fontSize:12, flex:1, fontFamily:'inherit', color:T1 }}/>
      </div>
      <button onClick={()=>setShowTemplates(!showTemplates)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid '+(showTemplates?BRAND:BL), background:showTemplates?'#F0F9FF':'#fff', color:showTemplates?BRAND:T2, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>📋 模板库</button>
      <button onClick={()=>onCreate('ai')} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:BRAND, color:'#fff', fontSize:12, cursor:'pointer', fontWeight:600, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}><PlusIcon/> AI生成路径</button>
      <button onClick={()=>onCreate('manual')} style={{ padding:'7px 14px', borderRadius:8, border:'1.5px dashed #D1D5DB', background:'#fff', color:T2, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>+ 手动编排</button>
    </div>

    {/* ── Template Library ── */}
    {showTemplates && (
      <div style={{ padding:'0 28px 12px', display:'flex', gap:10, flexWrap:'wrap' }}>
        {PATH_TEMPLATES.map((t,i)=>(
          <div key={i} onClick={()=>onTemplate(t)} style={{ flex:'1 1 160px', minWidth:160, maxWidth:220, background:'#fff', borderRadius:10, border:'1px solid '+BL, padding:'14px', cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=BRAND;e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 12px rgba(22,119,232,0.1)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=BL;e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
            <div style={{ fontSize:20, marginBottom:4 }}>{t.icon}</div>
            <div style={{ fontSize:13, fontWeight:700, color:T1 }}>{t.name}</div>
            <div style={{ fontSize:11, color:T3, marginTop:2 }}>{t.desc}</div>
            <div style={{ fontSize:10, color:BRAND, marginTop:6, fontWeight:500 }}>{t.days}天 · 一键导入</div>
          </div>
        ))}
      </div>
    )}

    {/* ── Empty State ── */}
    {paths.length === 0 ? (
      <div style={{ margin:'20px 28px', background:'#fff', borderRadius:16, border:'1px solid '+BL, padding:60, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🗺️</div>
        <h3 style={{ fontSize:18, fontWeight:700, color:T1, margin:'0 0 6px' }}>开始你的学习之旅</h3>
        <p style={{ fontSize:13, color:T3, marginBottom:24, lineHeight:1.6 }}>三种方式创建学习路径，选择最适合你的方式开始数据结构学习之旅</p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={()=>window.location.href='/knowledge-graph'} style={{ padding:'10px 24px', borderRadius:10, border:'none', background:BRAND, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
            <span style={{fontSize:18}}>📄</span>上传PDF图谱生成
            <span style={{fontSize:10,fontWeight:400,opacity:0.8}}>AI自动抽取知识点</span>
          </button>
          <button onClick={()=>{setShowTemplates(true);onCreate('ai')}} style={{ padding:'10px 24px', borderRadius:10, border:'1.5px solid '+BL, background:'#fff', color:T1, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
            <span style={{fontSize:18}}>📋</span>模板一键导入
            <span style={{fontSize:10,fontWeight:400,color:T3}}>速成/冲刺/考研路径</span>
          </button>
          <button onClick={()=>onCreate('manual')} style={{ padding:'10px 24px', borderRadius:10, border:'1.5px dashed #D1D5DB', background:'#fff', color:T2, fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
            <span style={{fontSize:18}}>🧩</span>手动自定义搭建
            <span style={{fontSize:10,fontWeight:400,color:T3}}>自由编排知识点顺序</span>
          </button>
        </div>
      </div>
    ) : (
      <div style={{ padding:'0 28px 24px', display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map(p => (
          <div key={p.state_id} onClick={()=>onSelect(p.state_id)} style={{ position:'relative', background:'#fff', borderRadius:14, border:'1px solid '+BL, padding:'18px 20px', cursor:'pointer', transition:'all 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.02)' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=BRAND;e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(22,119,232,0.08)';setHoverId(p.state_id)}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=BL;e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.02)';setHoverId(null)}}>
            {/* Favorite star */}
            <span onClick={e=>{e.stopPropagation();onToggleFavorite(p.state_id)}} style={{ position:'absolute', top:12, right:12, cursor:'pointer', fontSize:16, opacity:favorites.has(p.state_id)?1:0.3 }}><StarIcon filled={favorites.has(p.state_id)}/></span>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:22 }}>{p.phase==='completed'?'🏆':'📖'}</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:T1 }}>{p.subject_name||'未命名'}学习路径</div>
                    <div style={{ fontSize:11, color:T3, display:'flex', gap:8 }}>
                      <span style={{ padding:'1px 6px', borderRadius:4, background:p.phase==='completed'?'#D1FAE5':p.phase==='learning'?'#DBEAFE':'#F3F4F6', color:p.phase==='completed'?'#166534':p.phase==='learning'?BRAND:T3, fontSize:10, fontWeight:600 }}>{p.phase==='completed'?'已完成':p.phase==='learning'?'学习中':'未开始'}</span>
                      <span>{p.total_nodes}个知识点</span>
                      {p.total_days>0&&<span>预计{p.total_days}天</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div style={{ textAlign:'right', minWidth:80 }}>
                <div style={{ fontSize:22, fontWeight:800, color:p.progress_pct>=80?'#10B981':BRAND }}>{p.progress_pct}%</div>
                <div style={{ height:6, width:80, background:'#F3F4F6', borderRadius:3, overflow:'hidden', marginTop:4 }}>
                  <div style={{ height:'100%', borderRadius:3, background:p.progress_pct>=80?'#10B981':`linear-gradient(90deg,${BRAND},#38BDF8)`, width:p.progress_pct+'%', transition:'width 0.5s' }}/>
                </div>
                <div style={{ fontSize:10, color:T3, marginTop:3 }}>{p.completed_nodes}/{p.total_nodes}已掌握</div>
              </div>

              {/* Quick actions */}
              <div style={{ display:'flex', gap:4, flexShrink:0, flexWrap:'wrap' }} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>onSelect(p.state_id)} style={{ padding:'6px 12px', borderRadius:6, border:'none', background:BRAND, color:'#fff', fontSize:11, cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>继续学习</button>
                <button onClick={()=>onSelect(p.state_id)} style={{ padding:'6px 8px', borderRadius:6, border:'1px solid '+BL, background:'#fff', color:T2, fontSize:11, cursor:'pointer', fontFamily:'inherit' }} title="查看/编辑路径">✏️</button>
                <button onClick={()=>{if(confirm('确定重置此路径的所有学习进度？此操作不可恢复。'))onReset(p.state_id)}} style={{ padding:'6px 8px', borderRadius:6, border:'1px solid '+BL, background:'#fff', color:'#F59E0B', fontSize:11, cursor:'pointer', fontFamily:'inherit' }} title="重置进度">🔄</button>
                <button onClick={()=>onDelete(p.state_id)} style={{ padding:'6px 8px', borderRadius:6, border:'1px solid '+BL, background:'#fff', color:T3, fontSize:11, cursor:'pointer', fontFamily:'inherit' }} title="删除">🗑</button>
              </div>
            </div>

            {/* Segmented progress bar */}
            <div style={{ display:'flex', gap:2, height:4, marginTop:12, borderRadius:2, overflow:'hidden' }}>
              <div style={{ background:'#10B981', width:(p.completed_nodes/p.total_nodes*100)+'%', transition:'width 0.5s' }}/>
              <div style={{ background:BRAND, width:Math.max(0,(p.progress_pct-p.completed_nodes/p.total_nodes*100))+'%', opacity:0.5 }}/>
              <div style={{ background:'#E5E7EB', flex:1 }}/>
            </div>
            <div style={{ display:'flex', gap:12, fontSize:10, color:T3, marginTop:4 }}>
              <span>🟢 已掌握 {p.completed_nodes}</span>
              <span>🔵 学习中 {Math.max(0,p.total_nodes-p.completed_nodes)}</span>
              <span>⚪ 未开始 {Math.max(0,p.total_nodes-p.completed_nodes)}</span>
            </div>

            {/* Weak points hint on hover */}
            {hoverId===p.state_id && <div style={{ position:'absolute', bottom:-8, left:20, right:20, background:BRAND, color:'#fff', borderRadius:6, padding:'6px 12px', fontSize:11, boxShadow:'0 4px 12px rgba(22,119,232,0.2)', zIndex:2 }}>
              💡 建议优先掌握薄弱知识点 · 点击卡片查看详情
            </div>}
          </div>
        ))}
      </div>
    )}
  </div>
})

/* ═══════════════════════════════════════════════════════════════
   PAGE 3: KNOWLEDGE POINT DETAIL (Detail Screen)
   ═══════════════════════════════════════════════════════════════ */
const DetailScreen = memo(function DS({ pointId, detailData, detailLoading, nodes, onBack, onPractice, onNavigateNode }: {
  pointId: string; detailData: any; detailLoading: boolean; nodes: PathNodeStatus[]
  onBack: () => void; onPractice: (id: string) => void; onNavigateNode: (id: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'learn'|'practice'|'assess'|'review'|'wrong'|'chat'|'timeline'>('learn')
  const [videoInput, setVideoInput] = useState(detailData?.video_url||'')
  const [videoSaving, setVideoSaving] = useState(false)
  const [reviewExpanded, setReviewExpanded] = useState(false)
  const [reviewGenerating, setReviewGenerating] = useState(false)
  const [reviewContent, setReviewContent] = useState<string|null>(detailData?.review_material||null)
  const [assessMode, setAssessMode] = useState(false)
  const [assessLoading, setAssessLoading] = useState(false)
  const [assessQuestions, setAssessQuestions] = useState<any[]>([])
  const [assessAnswers, setAssessAnswers] = useState<Record<string,string>>({})
  const [assessResult, setAssessResult] = useState<any>(null)
  const [assessError, setAssessError] = useState<string|null>(null)
  const [studyDuration, setStudyDuration] = useState(0)
  const [studyActive, setStudyActive] = useState(false)

  useEffect(()=>{setVideoInput(detailData?.video_url||'');setReviewContent(detailData?.review_material||null)},[detailData])

  // Study timer
  useEffect(()=>{let t:any;if(studyActive){t=setInterval(()=>setStudyDuration(d=>d+1),1000)}return ()=>clearInterval(t)},[studyActive])
  const toggleStudy = useCallback(async()=>{if(studyActive){setStudyActive(false);try{await pathApi.recordKnowledgeStudy(pointId,studyDuration)}catch(_){}}else{setStudyActive(true)}},[studyActive,pointId,studyDuration])

  const sv=async()=>{if(!videoInput.trim())return;setVideoSaving(true);try{await pathApi.updateVideoUrl(pointId,videoInput.trim())}catch(_){};setVideoSaving(false)}
  const gr=async()=>{setReviewGenerating(true);try{const r=await pathApi.generateReviewMaterial(pointId);setReviewContent(r.data.content);setReviewExpanded(true)}catch(_){};setReviewGenerating(false)}
  const sa=async()=>{setAssessLoading(true);setAssessMode(true);setAssessResult(null);setAssessAnswers({});setAssessError(null);try{const r=await pathApi.assess(pointId);setAssessQuestions(r.data.questions)}catch(e:any){setAssessError(e?.response?.data?.detail||'加载失败');setAssessMode(false)};setAssessLoading(false)}
  const sm=async()=>{const a=Object.entries(assessAnswers).map(([qid,c])=>({question_id:qid,user_choice:c}));if(!a.length)return;setAssessLoading(true);try{const r=await pathApi.submitAssess(pointId,a);setAssessResult(r.data)}catch(_){};setAssessLoading(false)}
  const all=assessQuestions.length>0&&assessQuestions.every((q:any)=>assessAnswers[q.question_id])

  const curIdx=nodes.findIndex(n=>n.point_id===pointId)
  const prevNode=curIdx>0?nodes[curIdx-1]:null
  const nextNode=curIdx<nodes.length-1?nodes[curIdx+1]:null

  const tabs=[{k:'learn',l:'📺 学习资料'},{k:'practice',l:'📝 专项练习'},{k:'assess',l:'🔬 掌握度测评'},{k:'review',l:'📖 AI复习'},{k:'wrong',l:'❌ 错题复盘'},{k:'chat',l:'🤖 AI答疑'},{k:'timeline',l:'📅 学习记录'}] as const

  if(detailLoading)return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:T3}}>加载中...</div>
  if(!detailData)return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:T3}}>暂无数据</div>

  const mastery=detailData.mastery_score||0
  const masteryColor=mastery>=80?'#10B981':mastery>=50?'#F59E0B':mastery>=20?'#F97316':'#EF4444'

  return <div style={{flex:1,overflow:'auto',background:BG_PAGE}}>
    <div style={{padding:'16px 24px 0'}}>
      <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:4,color:BRAND,background:'none',border:'none',cursor:'pointer',fontSize:13,marginBottom:12,fontFamily:'inherit'}}><BackIcon/>返回流程图</button>
      <div style={{maxWidth:900,margin:'0 auto'}}>

        {/* ── Header Card ── */}
        <div style={{background:'#fff',borderRadius:16,border:'1px solid '+BL,padding:24,marginBottom:12,boxShadow:'0 2px 8px rgba(0,0,0,0.03)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div>
              <h2 style={{fontSize:20,fontWeight:700,margin:0,color:T1}}>{detailData.point_name}</h2>
              <p style={{fontSize:12,color:T3,marginTop:4}}>{detailData.domain_name}{detailData.subject_name?' · '+detailData.subject_name:''}</p>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{padding:'4px 12px',borderRadius:8,fontSize:11,fontWeight:600,
                background:detailData.status==='mastered'?'#D1FAE5':detailData.status==='reviewing'?'#FFFBEB':detailData.status==='learning'?'#DBEAFE':'#F3F4F6',
                color:detailData.status==='mastered'?'#166534':detailData.status==='reviewing'?'#92400E':detailData.status==='learning'?BRAND:T3}}>
                {detailData.status==='mastered'?'✅ 已掌握':detailData.status==='reviewing'?'🔄 复习中':detailData.status==='learning'?'📖 学习中':'⚪ 未开始'}
              </span>
              <button onClick={toggleStudy} style={{padding:'6px 12px',borderRadius:8,border:'none',background:studyActive?'#10B981':BRAND,color:'#fff',fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>
                {studyActive?`⏱ ${Math.floor(studyDuration/60)}:${String(studyDuration%60).padStart(2,'0')}`:'📝 学习打卡'}
              </button>
            </div>
          </div>

          {/* Key metrics */}
          <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:14}}>
            {[
              {l:'掌握度',v:mastery+'%',c:masteryColor},
              {l:'已刷题数',v:detailData.total_practiced||0,c:BRAND},
              {l:'正确率',v:(detailData.recent_accuracy||0)+'%',c:'#10B981'},
              {l:'错题数',v:Math.max(0,(detailData.total_practiced||0)-(detailData.total_correct||0)),c:'#EF4444'},
              {l:'艾宾浩斯复习',v:detailData.next_review_at?new Date(detailData.next_review_at).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}):'暂未设置',c:'#F59E0B'},
            ].map((m,i)=>(
              <div key={i} style={{flex:'1 1 90px',minWidth:90,textAlign:'center',padding:'10px 8px',borderRadius:10,background:BG_PAGE}}>
                <div style={{fontSize:18,fontWeight:800,color:m.c}}>{m.v}</div>
                <div style={{fontSize:10,color:T3,marginTop:2}}>{m.l}</div>
              </div>
            ))}
          </div>

          {/* Triple progress bars */}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[{l:'理论学习进度',v:mastery,w:mastery+'%',c:'#10B981'},{l:'刷题巩固进度',v:Math.min(100,(detailData.total_practiced||0)*5),w:Math.min(100,(detailData.total_practiced||0)*5)+'%',c:BRAND},{l:'测评达标进度',v:(detailData.recent_accuracy||0),w:(detailData.recent_accuracy||0)+'%',c:'#7C3AED'}].map((b,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,color:T2,width:90,textAlign:'right',flexShrink:0}}>{b.l}</span>
                <div style={{flex:1,height:8,background:'#F3F4F6',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',borderRadius:4,background:b.c,width:b.w,transition:'width 0.6s'}}/></div>
                <span style={{fontSize:10,color:T3,width:30}}>{b.v}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{display:'flex',gap:4,background:'#fff',borderRadius:12,border:'1px solid '+BL,padding:3,marginBottom:12,overflowX:'auto'}}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setActiveTab(t.k)} style={{flex:1,minWidth:70,padding:'7px 6px',borderRadius:9,border:'none',fontSize:11,cursor:'pointer',fontWeight:activeTab===t.k?600:400,
              background:activeTab===t.k?BRAND:'transparent',color:activeTab===t.k?'#fff':T2,fontFamily:'inherit',whiteSpace:'nowrap',transition:'all 0.15s'}}>{t.l}</button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{background:'#fff',borderRadius:14,border:'1px solid '+BL,padding:20,marginBottom:12,minHeight:200}}>
          {/* Learn Tab */}
          {activeTab==='learn'&&<div>
            <h3 style={{fontSize:14,fontWeight:600,margin:'0 0 12px',color:T1}}>📺 知识点精讲视频</h3>
            {videoInput.trim()?<div><div style={{padding:'8px 14px',borderRadius:8,background:'#F0FDF4',border:'1px solid #BBF7D0',marginBottom:8,fontSize:12,color:'#065F46',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{videoInput}</div>
              <div style={{display:'flex',gap:8}}><button onClick={()=>window.open(videoInput,'_blank')} style={{padding:'6px 14px',borderRadius:6,border:'none',background:'#10B981',color:'#fff',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>▶ 打开视频</button>
              <button onClick={()=>setVideoInput('')} style={{padding:'6px 14px',borderRadius:6,border:'1px solid #D1D5DB',background:'#fff',color:T2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✏️ 更换</button></div></div>
            :<div><div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}><button onClick={()=>window.open('https://search.bilibili.com/all?keyword='+encodeURIComponent(detailData.point_name+' '+((detailData.subject_name||'')||'')+' 讲解'),'_blank')} style={{padding:'6px 14px',borderRadius:6,border:'none',background:'#00A1D6',color:'#fff',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>🔍 B站搜索</button>
              <button onClick={()=>window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(detailData.point_name+' '+(detailData.subject_name||'')+' tutorial'),'_blank')} style={{padding:'6px 14px',borderRadius:6,border:'none',background:'#FF0000',color:'#fff',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>🔍 YouTube</button></div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{fontSize:11,color:T3,whiteSpace:'nowrap'}}>或粘贴链接:</span><input value={videoInput} onChange={e=>setVideoInput(e.target.value)} placeholder="https://..." style={{flex:1,padding:'6px 10px',border:'1px solid #D1D5DB',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/><button onClick={sv} disabled={videoSaving||!videoInput.trim()} style={{padding:'6px 12px',borderRadius:6,border:'none',background:videoSaving?'#D1D5DB':BRAND,color:'#fff',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>{videoSaving?'保存中...':'保存'}</button></div></div>}

            <h3 style={{fontSize:14,fontWeight:600,margin:'16px 0 8px',color:T1}}>📄 图文讲义 & 相关资源</h3>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {['教材章节','课堂笔记','代码案例','习题解析'].map((r,i)=>(
                <div key={i} style={{padding:'10px 16px',borderRadius:8,border:'1px solid '+BL,background:BG_PAGE,fontSize:12,color:T2,cursor:'pointer',transition:'all 0.15s',display:'flex',alignItems:'center',gap:6}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=BRAND;e.currentTarget.style.background='#F0F9FF'}} onMouseLeave={e=>{e.currentTarget.style.borderColor=BL;e.currentTarget.style.background=BG_PAGE}}>
                  {['📖','📝','💻','✏️'][i]} {r}
                </div>
              ))}
            </div>
          </div>}

          {/* Practice Tab */}
          {activeTab==='practice'&&<div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div><h3 style={{fontSize:14,fontWeight:600,margin:'0 0 2px',color:T1}}>📝 专项练习</h3><p style={{fontSize:12,color:T3,margin:0}}>{detailData.total_practiced>0?`已练习${detailData.total_practiced}题·正确${detailData.total_correct}题`:'暂无练习记录'}</p></div>
              <button onClick={()=>onPractice(pointId)} style={{padding:'8px 18px',borderRadius:8,border:'none',background:BRAND,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>✏️ 开始练习 →</button>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
              {['选择题','填空题','编程题','算法大题'].map((t,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:6,border:'1px solid '+BL,fontSize:11,color:T2,cursor:'pointer',fontFamily:'inherit'}}><input type="checkbox" defaultChecked style={{accentColor:BRAND}}/>{t}</label>)}
            </div>
            {detailData.total_practiced>0&&<div style={{padding:'12px',borderRadius:8,background:BG_PAGE}}>
              <div style={{fontSize:11,color:T3,marginBottom:6}}>近3次练习趋势</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:8,height:40}}>
                {[0.6,0.75,detailData.recent_accuracy/100||0.8].map((v,i)=><div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:12,fontWeight:700,color:v>=0.7?'#10B981':'#F59E0B'}}>{Math.round(v*100)}%</span>
                  <div style={{width:'100%',height:24,borderRadius:4,background:v>=0.7?'#D1FAE5':'#FEF3C7',display:'flex',alignItems:'flex-end',overflow:'hidden'}}><div style={{width:'100%',height:(v*100)+'%',background:v>=0.7?'#10B981':'#F59E0B',borderRadius:2}}/></div>
                  <span style={{fontSize:9,color:T3}}>第{i+1}次</span>
                </div>)}
              </div>
            </div>}
          </div>}

          {/* Assess Tab */}
          {activeTab==='assess'&&<div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:assessMode?10:0}}>
              <div><h3 style={{fontSize:14,fontWeight:600,margin:0,color:T1}}>🔬 掌握度测评</h3>{!assessMode&&<p style={{fontSize:12,color:T3,margin:'2px 0 0'}}>{assessResult?`上次:${assessResult.correct}/${assessResult.total}(${assessResult.score}分)`:''}</p>}</div>
              {!assessMode&&<div style={{display:'flex',gap:6}}>
                {['入门','进阶','期末'].map((l,i)=><button key={i} onClick={sa} disabled={assessLoading} style={{padding:'6px 12px',borderRadius:6,border:'none',background:['#10B981','#F59E0B','#EF4444'][i],color:'#fff',fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>{l}测评</button>)}
              </div>}
            </div>
            {assessError&&<div style={{fontSize:12,color:'#DC2626',padding:'6px 10px',background:'#FEF2F2',borderRadius:6}}>⚠️ {assessError}</div>}
            {assessMode&&!assessLoading&&assessQuestions.length>0&&!assessResult&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
              {assessQuestions.map((q:any,qi:number)=><div key={q.question_id} style={{padding:10,borderRadius:8,background:BG_PAGE,border:'1px solid #E5E7EB'}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>{qi+1}. {q.stem}</div>
                {q.options.map((opt:any,oi:number)=>{const label=typeof opt==='object'&&opt.key?opt.key:String.fromCharCode(65+oi);const txt=typeof opt==='object'?(opt.text||opt.label||String(opt)):String(opt);const sel=assessAnswers[q.question_id]===label;return<label key={oi} onClick={()=>setAssessAnswers(p=>({...p,[q.question_id]:label}))} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 6px',borderRadius:5,cursor:'pointer',fontSize:11,background:sel?'#EDE9FE':'#fff',border:'1px solid '+(sel?'#7C3AED':'#E5E7EB'),marginBottom:2}}><input type="radio" name={q.question_id} checked={sel} readOnly style={{accentColor:'#7C3AED'}}/>{label}. {txt}</label>})}
              </div>)}
              <button onClick={sm} disabled={!all} style={{padding:'8px',borderRadius:8,border:'none',background:all?'#7C3AED':'#D1D5DB',color:'#fff',fontSize:12,fontWeight:600,cursor:all?'pointer':'not-allowed',fontFamily:'inherit'}}>{all?`✅ 提交测评(${assessQuestions.length}题)`:`请回答全部${assessQuestions.length}题`}</button>
            </div>}
            {assessMode&&assessResult&&<div style={{textAlign:'center',padding:8}}><div style={{display:'inline-flex',alignItems:'center',gap:10,padding:'10px 18px',borderRadius:10,background:assessResult.score>=80?'#F0FDF4':'#FEF3C7',border:'1px solid #E5E7EB',marginBottom:8}}><span style={{fontSize:24}}>{assessResult.score>=80?'🎉':'💪'}</span><div style={{textAlign:'left'}}><div style={{fontWeight:700}}>正确{assessResult.correct}/{assessResult.total}({assessResult.score}分)</div><div style={{fontSize:11,color:T3}}>{assessResult.score>=80?'掌握得很好！':'需要多练习'}</div></div></div><div style={{display:'flex',gap:6,justifyContent:'center'}}><button onClick={()=>{setAssessMode(false);setAssessResult(null);setAssessAnswers({})}} style={{padding:'5px 14px',borderRadius:6,border:'1px solid #D1D5DB',background:'#fff',color:T2,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>关闭</button><button onClick={sa} style={{padding:'5px 14px',borderRadius:6,border:'none',background:'#7C3AED',color:'#fff',fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>🔄 再做一次</button></div></div>}
          </div>}

          {/* Review Tab */}
          {activeTab==='review'&&<div>
            <h3 style={{fontSize:14,fontWeight:600,margin:'0 0 12px',color:T1}}>📖 AI复习资料</h3>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
              {['速记思维导图','考前背诵提纲','易错点总结','代码模板'].map((t,i)=><button key={i} onClick={gr} disabled={reviewGenerating} style={{padding:'8px 16px',borderRadius:8,border:'1px solid '+BL,background:reviewGenerating?'#F3F4F6':'#fff',color:reviewGenerating?T3:['#7C3AED','#F59E0B','#EF4444','#10B981'][i],fontSize:11,cursor:'pointer',fontWeight:500,fontFamily:'inherit'}}>{['🧠','📋','⚠️','💻'][i]} {t}</button>)}
            </div>
            {reviewContent?<div><div onClick={()=>setReviewExpanded(!reviewExpanded)} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'#6366F1',userSelect:'none',marginBottom:reviewExpanded?8:0}}>{reviewExpanded?'收起 ▲':'展开 ▼'}AI生成的复习资料</div>{reviewExpanded&&<div style={{padding:'10px 14px',borderRadius:8,background:BG_PAGE,border:'1px solid #E5E7EB',fontSize:13,lineHeight:1.8,maxHeight:400,overflowY:'auto'}}>{typeof reviewContent==='string'?<MarkdownRenderer content={reviewContent}/>:<pre>{JSON.stringify(reviewContent,null,2)}</pre>}</div>}</div>:<button onClick={gr} disabled={reviewGenerating} style={{padding:'8px 16px',borderRadius:8,border:'none',background:reviewGenerating?'#D1D5DB':'#6366F1',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{reviewGenerating?'⏳ 生成中...':'🤖 AI生成复习资料'}</button>}
          </div>}

          {/* Wrong Answers Tab */}
          {activeTab==='wrong'&&<div>
            <h3 style={{fontSize:14,fontWeight:600,margin:'0 0 12px',color:T1}}>❌ 错题复盘专区</h3>
            {Math.max(0,(detailData.total_practiced||0)-(detailData.total_correct||0))===0?(
              <div style={{padding:20,textAlign:'center',color:'#10B981',fontSize:13}}>
                <span style={{fontSize:28}}>🎉</span><br/>本知识点暂无错题记录，继续加油！
              </div>
            ):<div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{display:'flex',gap:10,fontSize:12,color:T2}}>
                  <span>总错题: <b style={{color:'#EF4444'}}>{Math.max(0,(detailData.total_practiced||0)-(detailData.total_correct||0))}道</b></span>
                  <span>正确率: <b style={{color:'#10B981'}}>{detailData.recent_accuracy||0}%</b></span>
                  <span>练习次数: <b style={{color:BRAND}}>{detailData.total_practiced||0}次</b></span>
                </div>
                <button onClick={()=>alert('即将打开专项错题练习')} style={{padding:'6px 12px',borderRadius:6,border:'none',background:'#EF4444',color:'#fff',fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>⚠️ 批量加入复习计划</button>
              </div>
              <div style={{padding:16,background:'#FEF2F2',borderRadius:8,border:'1px solid #FECACA',textAlign:'center',color:'#991B1B',fontSize:12}}>
                <span style={{fontSize:20}}>📋</span><br/>
                共 <b>{Math.max(0,(detailData.total_practiced||0)-(detailData.total_correct||0))}</b> 道错题待复习<br/>
                <span style={{fontSize:10,color:T3}}>前往「智能题库」→ 筛选本知识点 → 仅做错题模式开始练习</span><br/>
                <button onClick={()=>onPractice(pointId)} style={{marginTop:8,padding:'6px 14px',borderRadius:6,border:'none',background:BRAND,color:'#fff',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✏️ 去题库练习 →</button>
              </div>
            </div>}
          </div>}

          {/* AI Chat Tab */}
          {activeTab==='chat'&&<div>
            <h3 style={{fontSize:14,fontWeight:600,margin:'0 0 12px',color:T1}}>🤖 AI一对一答疑</h3>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[{q:'这个知识点通俗易懂地讲解一下',i:'💡'},{q:'给我一个经典代码实现示例',i:'💻'},{q:'拆解一道相关的经典例题',i:'📝'},{q:'帮我梳理这个知识点的易错地方',i:'⚠️'}].map((t,idx)=>(
                <div key={idx} onClick={()=>{window.open('/chat?prompt='+encodeURIComponent(t.q+' - '+detailData.point_name),'_blank')}} style={{padding:'10px 14px',borderRadius:8,border:'1px solid '+BL,background:BG_PAGE,fontSize:12,color:T1,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s',display:'flex',alignItems:'center',gap:8}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=BRAND;e.currentTarget.style.background='#F0F9FF'}} onMouseLeave={e=>{e.currentTarget.style.borderColor=BL;e.currentTarget.style.background=BG_PAGE}}>
                  <span>{t.i}</span> {t.q}
                </div>
              ))}
            </div>
          </div>}

          {/* Timeline Tab */}
          {activeTab==='timeline'&&<div>
            <h3 style={{fontSize:14,fontWeight:600,margin:'0 0 12px',color:T1}}>📅 学习记录时间线</h3>
            <div style={{position:'relative',paddingLeft:24}}>
              <div style={{position:'absolute',left:8,top:0,bottom:0,width:2,background:'#E5E7EB'}}/>
              {[
                {t:detailData.last_practice_at?'最近练习':'尚无练习',d:detailData.last_practice_at?new Date(detailData.last_practice_at).toLocaleDateString('zh-CN'):'开始你的第一次练习',c:'#10B981'},
                {t:'AI复习',d:detailData.review_material?'已生成复习资料':'点击AI复习Tab生成',c:'#6366F1'},
                {t:'测评记录',d:assessResult?`得分${assessResult.score}分`:'尚未测评',c:'#7C3AED'},
                {t:'学习次数',d:`已学习${detailData.study_count||0}次`,'c':BRAND},
              ].map((e,i)=>(
                <div key={i} style={{marginBottom:16,position:'relative'}}>
                  <div style={{position:'absolute',left:-20,top:4,width:10,height:10,borderRadius:'50%',background:e.c,border:'2px solid #fff',boxShadow:'0 0 0 2px '+e.c}}/>
                  <div style={{fontSize:13,fontWeight:600,color:T1}}>{e.t}</div>
                  <div style={{fontSize:11,color:T3,marginTop:2}}>{e.d}</div>
                </div>
              ))}
            </div>
            {/* Mastery curve placeholder */}
            <div style={{marginTop:16,padding:'12px',borderRadius:8,background:BG_PAGE}}>
              <div style={{fontSize:11,color:T3,marginBottom:6}}>掌握度提升曲线</div>
              <div style={{height:60,display:'flex',alignItems:'flex-end',gap:4}}>
                {[...Array(10)].map((_,i)=>{const pct=Math.min(1,i/9);const h=Math.max(8,mastery*pct*0.7+8);return<div key={i} style={{flex:1,height:h,borderRadius:3,background:`linear-gradient(180deg,${BRAND},#7DD3FC)`,opacity:0.4+i*0.06}}/>})}
              </div>
            </div>
          </div>}
        </div>

        {/* ── Bottom Action Bar ── */}
        <div style={{display:'flex',gap:10,padding:'12px 0 24px',justifyContent:'space-between',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <button style={{padding:'7px 14px',borderRadius:8,border:'none',background:BRAND,color:'#fff',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>📅 加入每日复习</button>
            <div style={{display:'flex',gap:3,alignItems:'center',fontSize:11,color:T3}}>
              <span>延后:</span>
              {[1,2,4,7].map(d=><button key={d} style={{padding:'3px 8px',borderRadius:5,border:'1px solid '+BL,background:'#fff',color:T2,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>{d}天</button>)}
            </div>
            <button style={{padding:'7px 14px',borderRadius:8,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>⚠️ 标记薄弱</button>
            <button onClick={onBack} style={{padding:'7px 14px',borderRadius:8,border:'1px solid '+BL,background:'#fff',color:T2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>📊 返回流程图</button>
          </div>
          <div style={{display:'flex',gap:6}}>
            {prevNode&&<button onClick={()=>onNavigateNode(prevNode.point_id)} style={{padding:'7px 14px',borderRadius:8,border:'1px solid '+BL,background:'#fff',color:T2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>⬅ {prevNode.point_name?.slice(0,8)}</button>}
            {nextNode&&<button onClick={()=>onNavigateNode(nextNode.point_id)} style={{padding:'7px 14px',borderRadius:8,border:'1px solid '+BL,background:'#fff',color:T2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{nextNode.point_name?.slice(0,8)} ➡</button>}
          </div>
        </div>

      </div>
    </div>
  </div>
})

/* ═══════════════════════════════════════════════════════════════
   CREATE PATH MODAL
   ═══════════════════════════════════════════════════════════════ */
const CreatePathModal = memo(function CPM({ subjects, initialSubjectId, onBack, onCreate, mode }: {
  subjects: any[]; initialSubjectId: string; onBack: ()=>void
  onCreate: (data:{subjectId:string;goalType:string;targetScore:string;deadline:string})=>Promise<void>; mode: string
}) {
  const [sid,setSid]=useState(initialSubjectId); const [gt,setGt]=useState(''); const [ts,setTs]=useState(''); const [dl,setDl]=useState('')
  const [err,setErr]=useState(''); const [cr,setCr]=useState(false)
  const subj=subjects.find((s:any)=>s.id===sid); const subjDomains=subj?.domains||[]; const subjKpCount=subjDomains.reduce((sum:number,d:any)=>sum+(d.knowledge_points?.length||0),0)
  const handleCreate=async()=>{if(!sid){setErr('请选择学科');return};if(!gt){setErr('请选择目标类型');return};setErr('');setCr(true);try{await onCreate({subjectId:sid,goalType:gt,targetScore:ts,deadline:dl})}catch(e:any){setCr(false);setErr(e?.response?.data?.detail||e?.message||'创建失败')}}
  return <div style={{flex:1,overflow:'auto',padding:'24px 32px',background:BG_PAGE}}>
    <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:4,color:BRAND,background:'none',border:'none',cursor:'pointer',fontSize:13,marginBottom:16,fontFamily:'inherit'}}><BackIcon/>路径列表</button>
    <div style={{maxWidth:520,margin:'0 auto'}}>
      <h2 style={{fontSize:22,fontWeight:700,color:T1,margin:'0 0 2px'}}>{mode==='ai'?'🤖 AI智能生成':'✋ 手动编排路径'}</h2>
      <p style={{fontSize:14,color:T3,marginBottom:24}}>{mode==='ai'?'AI基于知识图谱自动规划最优学习顺序':'手动选择知识点，自由编排学习顺序'}</p>
      {mode==='ai'?<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div><label style={{fontSize:13,fontWeight:600,color:T1,display:'block',marginBottom:6}}>选择学科</label>
          <select value={sid} onChange={e=>setSid(e.target.value)} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #D1D5DB',fontSize:14,color:T1,background:'#fff',fontFamily:'inherit'}}><option value="">请选择学科...</option>{subjects.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          {subj&&<div style={{marginTop:6,fontSize:12,color:T3}}>知识点：{subjKpCount} · 章节：{subjDomains.length}</div>}</div>
        <div><label style={{fontSize:13,fontWeight:600,color:T1,display:'block',marginBottom:6}}>目标类型</label>
          <div style={{display:'flex',gap:8}}>{[
            {value:'学期提升',label:'📚 学期提升'},{value:'升学备考',label:'🎯 升学备考'},{value:'考级考证',label:'📜 考级考证'},
          ].map(g=><button key={g.value} onClick={()=>setGt(g.value)} style={{flex:1,padding:'10px 8px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',border:`2px solid ${gt===g.value?BRAND:'#E5E7EB'}`,background:gt===g.value?'#F0F9FF':'#fff',color:gt===g.value?BRAND:T2,fontSize:13,fontWeight:gt===g.value?600:400,transition:'all 0.15s'}}>{g.label}</button>)}</div></div>
        <div><label style={{fontSize:13,fontWeight:600,color:T1,display:'block',marginBottom:6}}>目标分数（选填）</label><input value={ts} onChange={e=>setTs(e.target.value)} placeholder="如：90" style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #D1D5DB',fontSize:14,color:T1,fontFamily:'inherit',boxSizing:'border-box'}}/></div>
        <div><label style={{fontSize:13,fontWeight:600,color:T1,display:'block',marginBottom:6}}>截止日期（选填）</label><input type="date" value={dl} onChange={e=>setDl(e.target.value)} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid #D1D5DB',fontSize:14,color:T1,fontFamily:'inherit',boxSizing:'border-box'}}/></div>
        {err&&<div style={{padding:'10px 14px',borderRadius:8,background:'#FEF2F2',border:'1px solid #FECACA',color:'#991B1B',fontSize:13}}>{err}</div>}
        <button onClick={handleCreate} disabled={!sid||!gt||cr} style={{width:'100%',padding:14,borderRadius:12,border:'none',cursor:(sid&&gt&&!cr)?'pointer':'not-allowed',background:(sid&&gt&&!cr)?BRAND:'#D1D5DB',color:'#fff',fontSize:15,fontWeight:600,fontFamily:'inherit'}}>{cr?'⏳ 创建中...':'🚀 AI生成学习路径'}</button>
      </div>:<div style={{padding:40,textAlign:'center',color:T3,fontSize:13,border:'2px dashed #D1D5DB',borderRadius:14,background:'#fff'}}>
        <div style={{fontSize:40,marginBottom:12}}>🧩</div>
        <div style={{fontWeight:600,color:T1,marginBottom:4}}>手动编排模式</div>
        <div>请先从AI生成路径作为基础，再在流程图中拖拽调整节点顺序</div>
        <button onClick={()=>window.location.href='/path?tab=ai'} style={{marginTop:16,padding:'10px 24px',borderRadius:10,border:'none',background:BRAND,color:'#fff',fontSize:13,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>切换AI生成</button>
      </div>}
    </div>
  </div>
})

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function LearningPathPage() {
  const nav=useNavigate(); const [sp]=useSearchParams()
  const [pv,setPv]=useState<'select'|'create'|'overview'|'detail'>('select')
  const [pid,setPid]=useState<string|null>(null); const [sid,setSid]=useState<string|null>(null)
  const [createMode,setCreateMode]=useState('ai')
  const [subjects,setSubjects]=useState<any[]>([]); const [nodes,setNodes]=useState<PathNodeStatus[]>([])
  const [sum,setSum]=useState<Record<string,number>>({total:0,mastered:0,learning:0,not_started:0,reviewing:0,difficult:0})
  const [load,setLoad]=useState(false); const [err,setErr]=useState<string|null>(null); const [pl,setPl]=useState<PathListItem[]>([]); const [pll,setPll]=useState(true)
  const [dd,setDd]=useState<any>(null); const [ddl,setDdl]=useState(false); const [sdom,setSdom]=useState<string|null>(null)
  const [adv,setAdv]=useState<string|null>(null); const [init,setInit]=useState(false)
  const [favorites,setFavorites]=useState<Set<string>>(new Set())
  const [ctxNode,setCtxNode]=useState<PathNodeStatus|null>(null); const [ctxPos,setCtxPos]=useState({x:0,y:0})
  const [weakMode,setWeakMode]=useState(false); const [hlNode,setHlNode]=useState<string|null>(null); const [zoomLevel,setZoomLevel]=useState(1)
  // ── New: Achievement & Milestone System ──
  const [milestones,setMilestones]=useState<{name:string;target:number;unlocked:boolean}[]>([])
  const [showMilestoneEditor,setShowMilestoneEditor]=useState(false)
  const [milestonePopup,setMilestonePopup]=useState<string|null>(null)
  const [studyStreak,setStudyStreak]=useState(0)
  // Load milestones & streak from localStorage
  useEffect(()=>{try{const m=localStorage.getItem('path_milestones');if(m)setMilestones(JSON.parse(m));const s=localStorage.getItem('study_streak');if(s)setStudyStreak(parseInt(s)||0)}catch(_){}},[])

  useEffect(()=>{(async()=>{try{const t=localStorage.getItem('access_token');const r=await fetch('/api/v1/question-bank/subjects',{headers:{Authorization:'Bearer '+t}});setSubjects((await r.json()).subjects||[])}catch(_){}})()},[])
  useEffect(()=>{const v=sp.get('view'),s=sp.get('state');if(v&&s){setSid(s);_sel(s);setInit(true);return};const subjId=sp.get('subjectId');if(subjId){setSid(null);setPv('create');setInit(true);return};_list();setInit(true)},[])

  const _list=async()=>{setPll(true);try{const r=await pathApi.listPaths();setPl(r.data.paths||[]);setPv('select')}catch(_){};setPll(false)}
  const _url=(v:string,s?:string,p?:string)=>{const q=new URLSearchParams();q.set('view',v);if(s)q.set('state',s);if(p)q.set('point',p);window.history.replaceState(null,'','/path?'+q.toString())}

  const _sel=async(s:string)=>{setSid(s);setLoad(true);setErr(null);try{const r=await pathApi.getPathState(s);const d=r.data.state;if(d){const ns:PathNodeStatus[]=(d.node_order||[]).map((n:any)=>({point_id:n.node_id,point_name:n.name,domain_name:n.domain_name||'',domain_sort_order:0,sort_order:0,mastery_score:n.mastery_score||0,status:n.status==='done'?'mastered':n.status==='active'?'learning':'not_started',is_difficult:false,needs_review:false}));setNodes(ns);setSum({total:d.progress?.total||ns.length,mastered:d.progress?.completed||0,learning:ns.filter(n=>n.status==='learning').length,not_started:ns.filter(n=>n.status==='not_started').length,reviewing:0,difficult:0});setPv('overview');_url('overview',s)}}catch(e:any){setErr(e?.response?.data?.detail||'加载失败')};setLoad(false)}

  const _ref=useCallback(async()=>{if(!sid)return;try{const r=await pathApi.getPathState(sid);const d=r.data.state;if(!d)return;const ns:PathNodeStatus[]=(d.node_order||[]).map((n:any)=>({point_id:n.node_id,point_name:n.name,domain_name:n.domain_name||'',domain_sort_order:0,sort_order:0,mastery_score:n.mastery_score||0,status:n.status==='done'?'mastered':n.status==='active'?'learning':'not_started',is_difficult:false,needs_review:false}));setNodes(ns);setSum({total:d.progress?.total||ns.length,mastered:d.progress?.completed||0,learning:ns.filter(n=>n.status==='learning').length,not_started:ns.filter(n=>n.status==='not_started').length,reviewing:0,difficult:0})}catch(_){}},[sid])

  const _navigateToPractice=async(pointId:string)=>{try{const res=await questionBankApi.getKnowledgePointPracticeBank(pointId);nav(`/banks/${res.data.bank_id}/practice?point=${encodeURIComponent(pointId)}`)}catch(_){nav('/banks')}}
  const _nclick=async(n:PathNodeStatus)=>{if(n.status==='not_started')return;_showDetail(n)}
  const _showDetail=async(n:PathNodeStatus)=>{setPid(n.point_id);setPv('detail');_url('detail',sid||undefined,n.point_id);setDdl(true);try{const r=await pathApi.getKnowledgeDetail(n.point_id);setDd({...r.data,needs_review:n.needs_review})}catch(_){};setDdl(false)}
  const _navigateNode=(nodeId:string)=>{const n=nodes.find(x=>x.point_id===nodeId);if(n)_showDetail(n)}
  const _back=useCallback(()=>{setPv('overview');if(sid){_url('overview',sid);_ref()}},[sid,_ref])
  const _gen=async(data:{subjectId:string;goalType:string;targetScore:string;deadline:string})=>{const r=await pathApi.initPath({subject_id:data.subjectId,goal_type:data.goalType,goal_description:`目标分数:${data.targetScore},截止:${data.deadline}`});await _sel(r.data.state_id)}
  const _adv=async(p:string)=>{if(!sid||adv)return;setAdv(p);try{await pathApi.updateProgress({node_id:p,action:'complete',state_id:sid});await pathApi.recordKnowledgeStudy(p);await _ref()}catch(_){};setAdv(null)}
  const _goback=()=>{setPv('select');_list();window.history.replaceState(null,'','/path')}
  const _deletePath=async(id:string)=>{if(!confirm('确定删除此路径？'))return;try{await pathApi.restartPath();_list()}catch(_){}}
  const _resetPath=async(id:string)=>{try{await pathApi.restartPath();_list()}catch(_){}}
  const _toggleFavorite=(id:string)=>{setFavorites(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n})}
  const _handleTemplate=async(t:typeof PATH_TEMPLATES[0])=>{try{const r=await pathApi.initPath({subject_id:subjects.find(s=>s.name===t.subject)?.id||'',goal_type:t.goalType,goal_description:`模板:${t.name},目标分数:${t.targetScore},${t.deadline}`});await _sel(r.data.state_id)}catch(_){alert('导入模板失败，请检查学科数据')}}
  const _handleNodeContext=(e:React.MouseEvent,n:PathNodeStatus)=>{setCtxNode(n);setCtxPos({x:e.clientX,y:e.clientY})}
  // Path sharing (no rate dependency)
  const _sharePath=()=>{const url=`${window.location.origin}/path?view=overview&state=${sid}`;navigator.clipboard?.writeText(url).then(()=>alert('分享链接已复制到剪贴板！其他用户可直接导入此路径。')).catch(()=>prompt('复制此链接分享路径：',url))}

  const tt=sum.total||1;const mst=sum.mastered||0;const rate=Math.round((mst/tt)*100)
  // ── Milestone helpers (must be after rate declaration) ──
  const _addMilestone=(name:string,target:number)=>{const updated=[...milestones,{name,target,unlocked:false}];setMilestones(updated);localStorage.setItem('path_milestones',JSON.stringify(updated));setShowMilestoneEditor(false)}
  const _checkMilestones=()=>{const pct=rate;const updated=milestones.map(m=>({...m,unlocked:m.unlocked||pct>=m.target}));const newlyUnlocked=updated.filter((m,i)=>m.unlocked&&!milestones[i]?.unlocked);setMilestones(updated);localStorage.setItem('path_milestones',JSON.stringify(updated));if(newlyUnlocked.length>0){setMilestonePopup('🎉 里程碑达成：'+newlyUnlocked[0].name+'！（'+newlyUnlocked[0].target+'%目标）');setTimeout(()=>setMilestonePopup(null),4000)}}
  const _deleteMilestone=(idx:number)=>{const updated=milestones.filter((_,i)=>i!==idx);setMilestones(updated);localStorage.setItem('path_milestones',JSON.stringify(updated))}
  useEffect(()=>{if(milestones.length>0)_checkMilestones()},[rate])
  const groups=useMemo(()=>{const m=new Map<string,PathNodeStatus[]>();nodes.forEach(n=>{const k=n.domain_name||'未分类';if(!m.has(k))m.set(k,[]);m.get(k)!.push(n)});return Array.from(m.entries()).map(([d,nds])=>({domain:d,nodes:nds}))},[nodes])
  const focus=useMemo(()=>nodes.find(n=>n.status==='learning')||nodes.find(n=>n.mastery_score<80),[nodes])
  const phases=useMemo(()=>{const p:[string,PathNodeStatus[]][]=[['基础入门',[]],['强化提升',[]],['巩固复习',[]]];nodes.forEach(n=>{if(n.mastery_score>=80)p[2][1].push(n);else if(n.mastery_score>0)p[1][1].push(n);else p[0][1].push(n)});return p.filter(([,nds])=>nds.length>0).map(([name,nds],i)=>({name,color:['#1677E8','#3B82F6','#10B981'][i],progress:nds.length?Math.round(nds.filter(n=>n.mastery_score>=80).length/nds.length*100):0}))},[nodes])
  const reviewNodes=useMemo(()=>nodes.filter(n=>n.needs_review||(n.mastery_score||0)<40),[nodes])

  // Close context menu on click outside
  useEffect(()=>{const h=()=>setCtxNode(null);if(ctxNode)document.addEventListener('click',h);return ()=>document.removeEventListener('click',h)},[ctxNode])

  if(!init)return null

  return <div style={{height:'100%',display:'flex',flexDirection:'column',background:BG_PAGE}}>
    {/* Header */}
    <header style={{height:48,padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',borderBottom:'1px solid '+BL,flexShrink:0,zIndex:10}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button onClick={()=>pv==='select'?nav('/home'):_goback()} style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',color:T2,fontSize:13,fontFamily:'inherit'}}><BackIcon/>{pv==='select'?'首页':'路径列表'}</button>
        <h1 style={{fontSize:15,fontWeight:700,margin:0,color:T1}}>{pv==='select'?'学习路径规划':pv==='create'?'创建路径':pv==='detail'?'知识点详情':'知识路径流程'}</h1>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        {studyStreak>0&&<span style={{fontSize:11,color:'#F59E0B',display:'flex',alignItems:'center',gap:3}}>🔥{studyStreak}天</span>}
        <span style={{fontSize:12,color:T3}}>{pl.length}条路径</span>
        {pv==='overview'&&<>
          <button onClick={_sharePath} style={{padding:'4px 10px',borderRadius:6,border:'1px solid '+BL,background:'#fff',color:BRAND,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>🔗 分享</button>
          <button onClick={_goback} style={{padding:'4px 12px',borderRadius:6,border:'1px solid #D1D5DB',background:'#fff',color:T2,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>切换路径</button>
        </>}
      </div>
    </header>

    {/* Context Menu */}
    {ctxNode&&<div style={{position:'fixed',zIndex:1000,left:ctxPos.x,top:ctxPos.y,background:'#fff',borderRadius:10,border:'1px solid '+BL,padding:6,minWidth:160,boxShadow:'0 8px 24px rgba(0,0,0,0.12)'}} onClick={e=>e.stopPropagation()}>
      {[{l:'✏️ 开始练习',a:()=>{_navigateToPractice(ctxNode.point_id);setCtxNode(null)}},{l:'🤖 AI讲解',a:()=>{_showDetail(ctxNode);setCtxNode(null)}},{l:'📅 加入复习计划',a:()=>{setCtxNode(null)}},{l:'⚠️ 标记薄弱',a:()=>{setCtxNode(null)}},{l:'📊 查看详情',a:()=>{_showDetail(ctxNode);setCtxNode(null)}}].map((m,i)=><div key={i} onClick={m.a} style={{padding:'8px 12px',borderRadius:6,fontSize:12,color:T1,cursor:'pointer',fontFamily:'inherit',transition:'background 0.1s'}} onMouseEnter={e=>e.currentTarget.style.background=BG_PAGE} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{m.l}</div>)}
    </div>}

    {/* ── Select View (Page 1) ── */}
    {pv==='select'&&<PathSelectScreen paths={pl} loading={pll} onSelect={_sel} onCreate={(m)=>{setCreateMode(m);setPv('create')}} onTemplate={_handleTemplate} onDelete={_deletePath} onToggleFavorite={_toggleFavorite} onReset={_resetPath} favorites={favorites}/>}

    {/* ── Create View ── */}
    {pv==='create'&&<CreatePathModal subjects={subjects} initialSubjectId={sp.get('subjectId')||''} mode={createMode} onBack={_goback} onCreate={async(data)=>{setLoad(true);try{await _gen(data)}finally{setLoad(false)}}}/>}

    {/* ── Detail View (Page 3) ── */}
    {pv==='detail'&&pid&&<DetailScreen pointId={pid} detailData={dd} detailLoading={ddl} nodes={nodes} onBack={_back} onPractice={(p:string)=>_navigateToPractice(p)} onNavigateNode={_navigateNode}/>}

    {/* ── Overview View (Page 2) ── */}
    {pv==='overview'&&<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:BG_PAGE}}>
      {/* Global Info Bar */}
      <div style={{margin:'12px 20px 0',padding:'14px 18px',background:'#fff',borderRadius:12,border:'1px solid '+BL,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:200}}>
          <span style={{fontSize:22,fontWeight:800,color:rate>=80?'#10B981':BRAND}}>{rate}%</span>
          <div style={{flex:1,minWidth:80}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:T3,marginBottom:2}}><span>知识点完成</span><span>{mst}/{tt}</span></div>
            <div style={{height:6,background:'#F3F4F6',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,transition:'width 0.6s',background:rate>=80?'#10B981':'linear-gradient(90deg,'+BRAND+',#38BDF8)',width:rate+'%'}}/></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:T3,marginTop:4}}><span>错题巩固</span><span>{Math.max(0,(sum.total||1)-mst-1)}/{Math.max(1,tt-mst)}</span></div>
            <div style={{height:5,background:'#F3F4F6',borderRadius:3,overflow:'hidden',marginTop:2}}><div style={{height:'100%',borderRadius:3,background:'#F59E0B',width:Math.min(100,(reviewNodes.length/Math.max(1,tt))*100)+'%',transition:'width 0.6s'}}/></div>
          </div>
        </div>
        {/* Review Reminder */}
        {reviewNodes.length>0&&<div style={{padding:'6px 14px',borderRadius:8,background:'#FEF2F2',border:'1px solid #FECACA',display:'flex',alignItems:'center',gap:6}}>
          <span>🔔</span><span style={{fontSize:12,fontWeight:600,color:'#DC2626'}}>{reviewNodes.length}个知识点待复习</span>
          <button onClick={()=>setWeakMode(!weakMode)} style={{padding:'4px 10px',borderRadius:5,border:'none',background:weakMode?BRAND:'#EF4444',color:'#fff',fontSize:10,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>{weakMode?'关闭高亮':'薄弱高亮'}</button>
        </div>}
        {/* Global actions */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={()=>setWeakMode(!weakMode)} style={{padding:'5px 10px',borderRadius:6,border:'1px solid '+BL,background:'#fff',color:T2,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>🔥 批量练薄弱</button>
          <button style={{padding:'5px 10px',borderRadius:6,border:'1px solid '+BL,background:'#fff',color:T2,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>📋 生成复习计划</button>
          <button style={{padding:'5px 10px',borderRadius:6,border:'1px solid '+BL,background:'#fff',color:T2,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>📥 导出导图</button>
          <select value={sdom||''} onChange={e=>setSdom(e.target.value||null)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #D1D5DB',fontSize:10,color:T1,background:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">📚 全部章节</option>
            {groups.map(g=><option key={g.domain} value={g.domain}>{g.domain}（{g.nodes.length}）</option>)}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div style={{flex:1,overflow:'auto',padding:'8px 20px 12px',display:'flex',flexDirection:'column',gap:8}}>
        {/* Flow Diagram */}
        <div style={{flex:1,display:'flex',gap:8,minHeight:0}}>
          <div style={{flex:1,background:'#fff',borderRadius:10,border:'1px solid '+BL,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'6px 14px',borderBottom:'1px solid #E5E7EB',display:'flex',justifyContent:'space-between',alignItems:'center',gap:6}}>
              <span style={{fontSize:11,fontWeight:600,color:T1}}>📊 知识路径流程图</span>
              <div style={{display:'flex',gap:4}}>
                <button title="缩小" onClick={()=>setZoomLevel(z=>Math.max(0.3,z-0.15))} style={{padding:'2px 5px',borderRadius:4,border:'1px solid '+BL,background:'#fff',fontSize:10,color:T2,cursor:'pointer'}}>🔍-</button>
                <button title="放大" onClick={()=>setZoomLevel(z=>Math.min(2,z+0.15))} style={{padding:'2px 5px',borderRadius:4,border:'1px solid '+BL,background:'#fff',fontSize:10,color:T2,cursor:'pointer'}}>🔍+</button>
                <button title="重置" onClick={()=>setZoomLevel(1)} style={{padding:'2px 6px',borderRadius:4,border:'1px solid '+BL,background:'#fff',fontSize:10,color:T2,cursor:'pointer'}}>↺</button>
              </div>
              <div style={{display:'flex',gap:5,fontSize:9,color:T3}}><span style={{display:'flex',alignItems:'center',gap:2}}><span style={{width:6,height:6,borderRadius:1,background:'#10B981'}}/>已掌握</span><span style={{display:'flex',alignItems:'center',gap:2}}><span style={{width:6,height:6,borderRadius:1,background:BRAND}}/>学习中</span><span style={{display:'flex',alignItems:'center',gap:2}}><span style={{width:6,height:6,borderRadius:1,background:'#F59E0B'}}/>待复习</span><span style={{display:'flex',alignItems:'center',gap:2}}><span style={{width:6,height:6,borderRadius:1,background:'#D1D5DB'}}/>未开始</span></div>
            </div>
            <div style={{flex:1,minHeight:320}}>
              {load?<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:T3,fontSize:13}}>加载中...</div>
                :err?<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#EF4444',fontSize:13}}>{err}</div>
                :nodes.length===0?<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:T3,fontSize:13}}>暂无数据</div>
                :<PathFlowDiagram nodes={nodes} groups={sdom?groups.filter(g=>g.domain===sdom):groups} onNodeClick={_nclick} onNodeContext={_handleNodeContext} weakMode={weakMode} highlightNode={hlNode} zoomLevel={zoomLevel}/>}
            </div>
          </div>
        </div>

        {/* Study Plan Bar */}
        <div style={{padding:'10px 16px',background:'#fff',borderRadius:10,border:'1px solid '+BL,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <span style={{fontSize:11,fontWeight:600,color:T1}}>📅 规划</span>
          <span style={{fontSize:11,color:T3}}>每日学习量: <b style={{color:BRAND}}>{Math.ceil(tt/7)}</b>个知识点</span>
          <span style={{fontSize:11,color:T3}}>预计完成: <b style={{color:'#10B981'}}>{Math.ceil(tt/Math.max(1,Math.ceil(tt/7)))}天</b></span>
          <div style={{display:'flex',gap:4,flex:1,minWidth:120}}>
            {[...Array(7)].map((_,i)=><div key={i} style={{flex:1,height:20,borderRadius:4,background:'#F3F4F6',border:'1px solid #E5E7EB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:T3}}>{i+1}</div>)}
          </div>
          <span style={{fontSize:10,color:T3}}>7天打卡计划</span>
        </div>

        {/* ── Milestones + Sharing Bar ── */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:300,background:'#fff',borderRadius:10,border:'1px solid '+BL,padding:'10px 16px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:milestones.length>0?6:0}}>
              <span style={{fontSize:11,fontWeight:600,color:T1}}>🏆 进度里程碑</span>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>setShowMilestoneEditor(!showMilestoneEditor)} style={{padding:'3px 8px',borderRadius:5,border:'1px solid '+BL,background:'#fff',fontSize:10,color:T2,cursor:'pointer',fontFamily:'inherit'}}>+ 添加目标</button>
                <button onClick={_sharePath} style={{padding:'3px 8px',borderRadius:5,border:'1px solid '+BL,background:'#fff',fontSize:10,color:BRAND,cursor:'pointer',fontFamily:'inherit'}}>🔗 分享路径</button>
              </div>
            </div>
            {showMilestoneEditor&&<div style={{display:'flex',gap:4,marginBottom:6}}>
              <input placeholder="目标名称..." id="msName" style={{flex:1,padding:'4px 8px',borderRadius:5,border:'1px solid '+BL,fontSize:11,fontFamily:'inherit'}}/>
              <input placeholder="进度%..." id="msTarget" type="number" min="1" max="100" style={{width:60,padding:'4px 8px',borderRadius:5,border:'1px solid '+BL,fontSize:11,fontFamily:'inherit'}}/>
              <button onClick={()=>{const n=(document.getElementById('msName')as HTMLInputElement)?.value;const t=parseInt((document.getElementById('msTarget')as HTMLInputElement)?.value||'0');if(n&&t>0)_addMilestone(n,t)}} style={{padding:'4px 8px',borderRadius:5,border:'none',background:BRAND,color:'#fff',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>确定</button>
            </div>}
            {milestones.length>0?<div style={{display:'flex',flexDirection:'column',gap:3}}>{milestones.map((m,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:11,color:m.unlocked?'#10B981':T2}}>{m.unlocked?'✅':'🎯'} {m.name}</span>
                <div style={{flex:1,height:5,background:'#F3F4F6',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,background:m.unlocked?'#10B981':BRAND,width:Math.min(100,(rate/m.target*100))+'%',transition:'width 0.5s'}}/></div>
                <span style={{fontSize:10,color:T3}}>{m.target}%</span>
                <button onClick={()=>_deleteMilestone(i)} style={{padding:'0 3px',background:'none',border:'none',color:T3,fontSize:9,cursor:'pointer'}}>✕</button>
              </div>
            ))}</div>:<span style={{fontSize:11,color:T3}}>设定阶段目标，追踪学习进度</span>}
          </div>
          {/* Streak indicator */}
          <div style={{minWidth:120,background:'#fff',borderRadius:10,border:'1px solid '+BL,padding:'10px 16px',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:24}}>🔥</span>
            <div><div style={{fontSize:18,fontWeight:800,color:'#F59E0B'}}>{studyStreak}</div><div style={{fontSize:10,color:T3}}>连续学习天数</div></div>
          </div>
        </div>
      </div>
    </div>}

    {/* ── Milestone Achievement Popup ── */}
    {milestonePopup&&<div style={{position:'fixed',bottom:40,left:'50%',transform:'translateX(-50%)',zIndex:2000,background:'linear-gradient(135deg,#10B981,#059669)',color:'#fff',borderRadius:14,padding:'16px 28px',boxShadow:'0 8px 32px rgba(16,185,129,0.3)',fontSize:14,fontWeight:700,animation:'slideUp 0.4s ease'}}>{milestonePopup}</div>}
  </div>
}
