import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [major, setMajor] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const validateUsername = (value: string) => {
    if (!value) return '用户名不能为空'
    if (value.length < 3) return '用户名至少3个字符'
    if (value.length > 50) return '用户名最多50个字符'
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return '用户名只能包含字母、数字和下划线'
    return null
  }

  const validatePassword = (value: string) => {
    if (!value) return '密码不能为空'
    if (value.length < 6) return '密码至少6个字符'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const usernameError = validateUsername(username)
    if (usernameError) { setError(usernameError); return }

    const passwordError = validatePassword(password)
    if (passwordError) { setError(passwordError); return }

    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return }

    if (!major) { setError('请输入专业'); return }

    setIsLoading(true)

    try {
      await authApi.register({ username, password, email: email || undefined, major })
      setSuccess('注册成功！正在跳转登录页...')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const status = err.response?.status
      console.error('注册错误:', { status, detail, err })
      if (status === 422) {
        setError(detail || '表单填写有误，请检查输入')
      } else if (status === 400) {
        setError(detail || '注册信息有误')
      } else if (status === 500) {
        setError('服务器错误，请稍后重试')
      } else {
        setError(detail || '注册失败，请检查网络连接')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          ← 返回首页
        </Link>
      </div>
      <div className="card">
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>注册</h1>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
              {success}
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>用户名</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3-50位字母、数字或下划线"
              required
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>密码</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6个字符"
              required
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>确认密码</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              required
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>邮箱（选填）</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@university.edu"
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>专业</label>
            <input
              type="text"
              className="input"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="计算机科学与技术"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>
            {isLoading ? '注册中...' : '注册'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
          已有账号？<Link to="/login">立即登录</Link>
        </p>
      </div>
    </div>
  )
}
