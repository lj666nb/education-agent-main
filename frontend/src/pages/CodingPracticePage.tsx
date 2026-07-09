import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ProblemTree from '../components/coding/ProblemTree'
import CodePlayground from '../components/coding/CodePlayground'
import { codingApi, type DomainNode, type CodingProblemResponse } from '../api/coding'

export default function CodingPracticePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [domains, setDomains] = useState<DomainNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('problem'))
  const [problem, setProblem] = useState<CodingProblemResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    codingApi.getTree().then((res: any) => {
      setDomains(res.data?.domains || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedId) {
      setProblem(null)
      codingApi.getProblem(selectedId).then((res: any) => setProblem(res.data)).catch(() => setProblem(null))
    }
  }, [selectedId])

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 52px)',
      background: 'var(--app-bg-page)',
    }}>
      {/* 左侧目录树 */}
      <div style={{
        width: 260, minWidth: 260,
        borderRight: '1px solid var(--app-border)',
        background: 'var(--app-bg-card)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--app-border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-text-heading)' }}>
              数据结构推演题库
            </span>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--app-text-secondary)', fontSize: 12,
              }}
            >
              返回
            </button>
          </div>
          <input
            type="text"
            placeholder="搜索题目..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              width: '100%', padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--app-border)',
              background: 'var(--app-bg-page)', color: 'var(--app-text)',
              fontSize: 12, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--app-text-secondary)', fontSize: 13 }}>
            加载中...
          </div>
        ) : (
          <ProblemTree
            domains={domains}
            selectedId={selectedId}
            onSelect={setSelectedId}
            searchText={searchText}
          />
        )}
      </div>

      {/* 右侧编辑区 */}
      <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
        <CodePlayground problem={problem} />
      </div>
    </div>
  )
}
