import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, profileApi, profileV2Api } from '../../api'
import { useAuthStore } from '../../store/auth'

interface AuthModalProps {
  initialMode: 'login' | 'register'
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const navigate = useNavigate()
  const { setUser, setProfileCompleted } = useAuthStore()

  // Login form state
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register form state
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regMajor, setRegMajor] = useState('')
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const response = await authApi.login({ username: loginUsername, password: loginPassword })
      const { access_token, refresh_token } = response.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)

      const profileRes = await profileApi.getProfile()
      setUser(profileRes.data)

      // 检查学习画像 (v2) 是否存在
      let redirectTo = sessionStorage.getItem('loginRedirect') || '/home'
      sessionStorage.removeItem('loginRedirect')

      try {
        await profileV2Api.getProfile()
        setProfileCompleted(true)
      } catch (err: any) {
        if (err.response?.status === 404) {
          setProfileCompleted(false)
          redirectTo = '/profile/init'
        }
        // 其他错误维持原 redirectTo
      }

      onClose()
      navigate(redirectTo)
    } catch (err: any) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 401) setLoginError(detail || '用户名或密码错误')
      else if (status === 423) setLoginError('账号已被锁定，请稍后再试')
      else if (status === 0 || status === undefined) setLoginError('网络错误，请检查后端服务')
      else if (status === 500) setLoginError('服务器内部错误')
      else setLoginError(detail || '登录失败')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')

    if (regUsername.length < 3) { setRegError('用户名至少3个字符'); return }
    if (regPassword.length < 6) { setRegError('密码至少6个字符'); return }
    if (regPassword !== regConfirm) { setRegError('两次输入的密码不一致'); return }

    setRegLoading(true)

    try {
      await authApi.register({
        username: regUsername,
        password: regPassword,
        email: regEmail || undefined,
        major: regMajor,
      })
      // Switch to login mode after successful registration
      setMode('login')
      setLoginUsername(regUsername)
      setLoginPassword('')
      setRegError('')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const status = err.response?.status
      if (status === 422) setRegError(detail || '表单填写有误')
      else if (status === 400) setRegError(detail || '注册信息有误')
      else if (status === 500) setRegError('服务器错误，请稍后重试')
      else setRegError(detail || '注册失败')
    } finally {
      setRegLoading(false)
    }
  }

  const switchToLogin = () => {
    setMode('login')
    setLoginError('')
    setRegError('')
  }

  const switchToRegister = () => {
    setMode('register')
    setLoginError('')
    setRegError('')
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="modal-close-btn" onClick={onClose}>
          <CloseIcon />
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff',
            marginBottom: '12px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
            </svg>
          </div>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#1F2937',
            fontFamily: 'var(--font-heading)',
            margin: 0,
          }}>
            Education Agent
          </h2>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #F3F4F6',
          marginBottom: '24px',
        }}>
          <button
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={switchToLogin}
          >
            登录
          </button>
          <button
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={switchToRegister}
          >
            注册
          </button>
        </div>

        {/* ────── Login Form ────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            {loginError && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>{loginError}</div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="modal-login-user" style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}>
                用户名
              </label>
              <input
                id="modal-login-user"
                type="text"
                className={`input${loginError ? ' input-error' : ''}`}
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="请输入用户名"
                required
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="modal-login-pass" style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '6px',
              }}>
                密码
              </label>
              <input
                id="modal-login-pass"
                type="password"
                className={`input${loginError ? ' input-error' : ''}`}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '12px',
                opacity: loginLoading ? 0.7 : 1,
              }}
              disabled={loginLoading}
            >
              {loginLoading ? '登录中...' : '登 录'}
            </button>
          </form>
        )}

        {/* ────── Register Form ────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            {regError && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>{regError}</div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                用户名
              </label>
              <input
                type="text"
                className={`input${regError ? ' input-error' : ''}`}
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="3-50位字母、数字或下划线"
                required
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                密码
              </label>
              <input
                type="password"
                className={`input${regError ? ' input-error' : ''}`}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="至少6个字符"
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                确认密码
              </label>
              <input
                type="password"
                className={`input${regError ? ' input-error' : ''}`}
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                placeholder="再次输入密码"
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                邮箱 <span style={{ color: '#9CA3AF', fontWeight: 400 }}>（选填）</span>
              </label>
              <input
                type="email"
                className="input"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="example@university.edu"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                专业
              </label>
              <input
                type="text"
                className="input"
                value={regMajor}
                onChange={(e) => setRegMajor(e.target.value)}
                placeholder="计算机科学与技术"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '12px',
                opacity: regLoading ? 0.7 : 1,
              }}
              disabled={regLoading}
            >
              {regLoading ? '注册中...' : '注 册'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
