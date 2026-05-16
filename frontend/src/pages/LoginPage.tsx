import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi, profileApi } from '../api'
import { useAuthStore } from '../store/auth'

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      const response = await authApi.login({ username, password })
      const { access_token, refresh_token } = response.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)

      const profileRes = await profileApi.getProfile()
      setUser(profileRes.data)
      setSuccess('登录成功！正在跳转...')
      setTimeout(() => navigate('/profile'), 1000)
    } catch (err: any) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 401) {
        setError(detail || '用户名或密码错误')
      } else if (status === 423) {
        setError(detail || '账号已被锁定，请稍后再试')
      } else if (status === 0 || status === undefined) {
        setError(`网络错误：后端服务未启动或请求被拦截 (${err.code || 'Network Error'})`)
      } else if (status === 500) {
        setError('服务器内部错误，请稍后再试')
      } else if (status === 503) {
        setError('服务暂时不可用，请稍后再试')
      } else {
        setError(detail || `登录失败 (错误码: ${status})`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', paddingTop: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link to="/" className="btn btn-secondary" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
        }}>
          <ArrowLeftIcon />
          返回首页
        </Link>
      </div>
      <div className="card fade-in">
        <h1 style={{
          fontSize: '1.5rem',
          marginBottom: 'var(--space-6)',
          textAlign: 'center',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.02em',
        }}>
          登录
        </h1>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>{success}</div>}

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: '1rem',
              opacity: isLoading ? 0.7 : 1,
            }}
            disabled={isLoading}
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
        <p style={{
          marginTop: 'var(--space-4)',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--gray-500)',
        }}>
          还没有账号？<Link to="/register">立即注册</Link>
        </p>
      </div>
    </div>
  )
}
