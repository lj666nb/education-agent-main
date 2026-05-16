import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface HealthStatus {
  status: string
  timestamp: string
  services: {
    database: string
    mongodb: string
    neo4j: string
    redis: string
  }
}

export default function HealthPage() {
  const navigate = useNavigate()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/v1/health')
      .then(res => res.json())
      .then(data => {
        setHealth(data)
        setLoading(false)
      })
      .catch(() => {
        setError('无法获取健康状态')
        setLoading(false)
      })
  }, [])

  const getStatusColor = (status: string) => {
    if (status === 'healthy' || status === 'connected') return '#22c55e'
    if (status === 'degraded') return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#374151',
          cursor: 'pointer',
          fontSize: '0.875rem',
          zIndex: 1000,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        ← 首页
      </button>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '2rem', marginTop: '3rem' }}>系统健康检查</h1>

      {loading && <div>加载中...</div>}

      {error && (
        <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem' }}>
          {error}
        </div>
      )}

      {health && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: health.status === 'healthy' ? '#22c55e' : '#ef4444',
                }}
              />
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                {health.status === 'healthy' ? '系统正常' : '系统异常'}
              </span>
              <span style={{ color: '#6b7280', marginLeft: 'auto' }}>
                {new Date(health.timestamp).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>

          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', marginTop: '2rem' }}>服务状态</h2>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {Object.entries(health.services || {}).map(([name, status]) => (
              <div key={name} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '500' }}>
                  {name === 'database' ? '数据库 (PostgreSQL)' :
                   name === 'mongodb' ? 'MongoDB' :
                   name === 'neo4j' ? 'Neo4j (知识图谱)' :
                   name === 'redis' ? 'Redis' : name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(status),
                    }}
                  />
                  <span style={{ color: getStatusColor(status) }}>
                    {status === 'connected' ? '已连接' :
                     status === 'healthy' ? '正常' :
                     status === 'disconnected' ? '未连接' : status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}