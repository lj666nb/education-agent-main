import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { profileV2Api } from '../api'
import { useState, useEffect } from 'react'

function ProfileIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )
}

function PathIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

const featureCards = [
  {
    title: '智能画像',
    desc: '通过对话自动构建8维学习画像，精准把握学习特点',
    icon: <ProfileIcon />,
  },
  {
    title: '个性化资源',
    desc: 'AI生成定制化学习资料，因材施教提升学习效率',
    icon: <BookIcon />,
  },
  {
    title: '智能路径',
    desc: '科学规划学习路径，动态调整学习计划',
    icon: <PathIcon />,
  },
  {
    title: '多模态答疑',
    desc: '即时答疑解惑，多种形式解答助力理解',
    icon: <ChatIcon />,
  },
]

export default function HomePage() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [hasProfile, setHasProfile] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      checkProfile()
    } else {
      setIsChecking(false)
    }
  }, [isAuthenticated])

  const checkProfile = async () => {
    try {
      await profileV2Api.getProfile()
      setHasProfile(true)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setHasProfile(false)
      } else {
        setHasProfile(true)
      }
    } finally {
      setIsChecking(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="fade-in">
      {/* Navigation */}
      <nav style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--gray-100)',
        padding: 'var(--space-3) var(--space-8)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: 'calc(-1 * var(--space-8)) calc(-1 * var(--space-8)) var(--space-8) calc(-1 * var(--space-8))',
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
          <Link to="/" style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--primary)',
            letterSpacing: '-0.02em',
          }}>
            Education Agent
          </Link>
          {isAuthenticated && (
            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '0.875rem' }}>
              {[{ to: '/chat/new', label: 'AI 对话' },
                { to: '/banks', label: '题库' },
                { to: '/profile', label: '个人中心' },
                { to: '/profile/dynamic', label: '动态画像' },
                { to: '/settings/api', label: 'API 设置' },
                ...(user?.role === 'admin' ? [{ to: '/admin', label: '管理后台' }] : []),
              ].map(item => (
                <Link key={item.to} to={item.to} style={{ color: 'var(--gray-600)' }}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              <span style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>{user?.username}</span>
              <button onClick={handleLogout} className="btn btn-secondary">
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-primary">登录</Link>
              <Link to="/register" className="btn btn-secondary">注册</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="card" style={{
        textAlign: 'center',
        padding: 'var(--space-12) var(--space-6)',
        border: 'none',
        background: `linear-gradient(135deg, oklch(0.55 0.25 250), oklch(0.45 0.20 270))`,
        color: 'white',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          marginBottom: 'var(--space-3)',
          fontWeight: 700,
          letterSpacing: '-0.03em',
        }}>
          Education Agent
        </h1>
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          opacity: 0.9,
          marginBottom: 'var(--space-8)',
          maxWidth: 480,
          margin: '0 auto var(--space-8)',
        }}>
          基于大模型的个性化资源生成与学习多智能体系统
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isAuthenticated ? (
            <>
              <Link to="/chat/new" className="btn" style={{
                padding: 'var(--space-3) var(--space-6)',
                backgroundColor: 'white',
                color: 'var(--primary)',
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
              }}>
                AI 对话
              </Link>
              {!isChecking && !hasProfile && (
                <Link to="/profile/init" className="btn" style={{
                  padding: 'var(--space-3) var(--space-6)',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  borderRadius: 'var(--radius-lg)',
                  backdropFilter: 'blur(4px)',
                }}>
                  初始化画像
                </Link>
              )}
              <Link to="/profile/dynamic" className="btn" style={{
                padding: 'var(--space-3) var(--space-6)',
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'white',
                borderRadius: 'var(--radius-lg)',
                backdropFilter: 'blur(4px)',
              }}>
                查看画像
              </Link>
            </>
          ) : (
            <>
              <Link to="/register" className="btn" style={{
                padding: 'var(--space-3) var(--space-6)',
                backgroundColor: 'white',
                color: 'var(--primary)',
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
              }}>
                立即开始
              </Link>
              <Link to="/login" className="btn" style={{
                padding: 'var(--space-3) var(--space-6)',
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'white',
                borderRadius: 'var(--radius-lg)',
                backdropFilter: 'blur(4px)',
              }}>
                登录账号
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <section style={{ marginTop: 'var(--space-10)' }}>
        <h2 style={{
          fontSize: '1.5rem',
          marginBottom: 'var(--space-6)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.02em',
        }}>
          核心功能
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {featureCards.map((feature, i) => (
            <div
              key={feature.title}
              className="card slide-in"
              style={{
                animationDelay: `${i * 80}ms`,
                animationFillMode: 'both',
              }}
            >
              <div style={{
                color: 'var(--primary)',
                marginBottom: 'var(--space-3)',
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                marginBottom: 'var(--space-2)',
                fontFamily: 'var(--font-heading)',
              }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <section style={{ marginTop: 'var(--space-10)' }}>
        <h2 style={{
          fontSize: '1.5rem',
          marginBottom: 'var(--space-4)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.02em',
        }}>
          相关链接
        </h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {[
            { to: '/swagger', label: 'API 文档' },
            { to: '/redoc', label: 'ReDoc' },
            { to: '/health', label: '健康检查' },
          ].map(link => (
            <Link key={link.to} to={link.to} className="btn btn-secondary">
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
