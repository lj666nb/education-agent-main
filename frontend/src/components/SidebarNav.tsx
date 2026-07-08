import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { profileApi } from '../api'
import { useTheme } from '../store/theme'
import { useState, useEffect } from 'react'

/* ─────────────────────────────────────────────
   Brand Design Tokens
   ───────────────────────────────────────────── */
const BRAND_COLOR = '#0284C7'
const BRAND_COLOR_DARK = '#0369A1'
const BRAND_COLOR_LIGHT = '#F0F9FF'
const SIDEBAR_WIDTH = 232
const SIDEBAR_COLLAPSED = 60
const TEXT_PRIMARY = '#1F2937'
const TEXT_SECONDARY = '#6B7280'
const TEXT_MUTED = '#9CA3AF'
const BORDER_LIGHT = '#E5E7EB'

/* ─────────────────────────────────────────────
   SVG Icons
   ───────────────────────────────────────────── */
function IconHome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconChat({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function IconBank({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function IconProfile({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.45-2.77A2.5 2.5 0 0 1 7 12.5a2.5 2.5 0 0 1-1.37-3.26A2.5 2.5 0 0 1 9.5 2z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.45-2.77A2.5 2.5 0 0 0 17 12.5a2.5 2.5 0 0 0 1.37-3.26A2.5 2.5 0 0 0 14.5 2z" />
    </svg>
  )
}

function IconReview({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
      <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V12a2 2 0 0 1-2 2" />
    </svg>
  )
}

function IconKnowledgePoint({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
      <path d="M9 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5"/>
    </svg>
  )
}

function IconRecommend({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function IconKnowledgeGraph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="17" r="2.5" />
      <line x1="8" y1="7.5" x2="10.5" y2="15.5" />
      <line x1="16" y1="7.5" x2="13.5" y2="15.5" />
    </svg>
  )
}

function IconPath({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconStats({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconSettings({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconLogout({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconCollapse({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconExpand({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconSun({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IconMoon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Navigation Items Config
   ───────────────────────────────────────────── */
interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  end?: boolean
}

const topNavItems: NavItem[] = [
  { label: '首页', path: '/home', icon: <IconHome />, end: true },
  { label: 'AI 对话', path: '/chat/new', icon: <IconChat /> },
  { label: '智能题库', path: '/banks', icon: <IconBank /> },
  { label: '学习画像', path: '/profile/dynamic', icon: <IconProfile /> },
  { label: '复习中心', path: '/review', icon: <IconReview /> },
  { label: '知识图谱', path: '/knowledge-graph', icon: <IconKnowledgeGraph /> },
  { label: '知识点总览', path: '/knowledge-points', icon: <IconKnowledgePoint /> },
  { label: '资源推荐', path: '/recommendations', icon: <IconRecommend /> },
  { label: '学习路径', path: '/path', icon: <IconPath /> },
  { label: '学习分析', path: '/stats', icon: <IconStats /> },
  { label: 'API 设置', path: '/settings/api', icon: <IconSettings /> },
]

/* ═══════════════════════════════════════════════════════════
   SidebarNav Component
   ═══════════════════════════════════════════════════════════ */
export default function SidebarNav({ onMobileToggle }: { onMobileToggle?: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isCollapsed = collapsed

  // 从 API 获取最新头像 URL
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  useEffect(() => {
    profileApi.getProfile().then(res => {
      if (res.data?.profile?.avatar_url) setAvatarUrl(res.data.profile.avatar_url)
    }).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  /** 判断某个导航项是否为当前活跃状态 */
  const isNavActive = (item: NavItem): boolean => {
    const cp = location.pathname
    if (item.end) {
      // end=true 的项（首页）必须精确匹配
      return cp === item.path
    }
    // 普通项：当前路径以导航路径开头即视为活跃
    // 例如 /banks/xxx 匹配 智能题库(/banks)
    return cp === item.path || cp.startsWith(item.path + '/')
  }

  const sidebarW = isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH

  return (
    <>
      {/* Extra style block for hover effects */}
      <style>{`
        .sn-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          margin: 2px 10px;
          border-radius: 10px;
          color: ${TEXT_SECONDARY};
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.18s ease;
          white-space: nowrap;
          overflow: hidden;
          position: relative;
          cursor: pointer;
          font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;
        }
        .sn-nav-link:hover {
          background: ${BRAND_COLOR_LIGHT};
          color: ${BRAND_COLOR};
        }
        .sn-nav-link.active {
          background: ${BRAND_COLOR_LIGHT};
          color: ${BRAND_COLOR};
          font-weight: 600;
        }
        .sn-nav-link.active::before {
          content: '';
          position: absolute;
          left: -10px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          border-radius: 0 3px 3px 0;
          background: ${BRAND_COLOR};
        }
        .sn-nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }
        .sn-nav-link:hover .sn-nav-icon {
          color: ${BRAND_COLOR};
        }
        .sn-nav-link.active .sn-nav-icon {
          color: ${BRAND_COLOR};
        }
        .sn-tooltip {
          position: fixed;
          left: ${SIDEBAR_COLLAPSED + 8}px;
          padding: 6px 12px;
          background: #1F2937;
          color: #fff;
          font-size: 0.8125rem;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease;
          z-index: 9999;
          font-family: 'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;
        }
        .sn-hover-trigger:hover .sn-tooltip {
          opacity: 1;
        }
        .sn-logo-text {
          font-family: 'Space Grotesk','Noto Sans SC',sans-serif;
        }
      `}</style>

      <aside
        style={{
          width: sidebarW,
          height: '100vh',
          background: '#FFFFFF',
          borderRight: `1px solid ${BORDER_LIGHT}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          zIndex: 50,
          flexShrink: 0,
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* ═══ Logo Area ═══ */}
        <div
          style={{
            height: 62,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: isCollapsed ? '0 14px' : '0 18px',
            borderBottom: `1px solid ${BORDER_LIGHT}`,
            flexShrink: 0,
            transition: 'padding 0.28s ease',
          }}
        >
          {/* Brand mark */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: BRAND_COLOR,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            E
          </div>
          {/* Brand name — hidden when collapsed */}
          <span
            className="sn-logo-text"
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: BRAND_COLOR,
              letterSpacing: '-0.01em',
              opacity: isCollapsed ? 0 : 1,
              transition: 'opacity 0.18s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            Education Agent
          </span>
        </div>

        {/* ═══ Navigation Links ═══ */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '10px 0',
          }}
        >
          {topNavItems.map((item) => {
            const active = isNavActive(item)
            return (
              <Link
                key={item.path}
                to={item.path}
                prefetch="intent"
                onClick={() => onMobileToggle?.()}
                className={`sn-nav-link${active ? ' active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '12px 0' : '10px 14px',
                  margin: isCollapsed ? '2px 8px' : '2px 10px',
                  width: isCollapsed ? 'auto' : 'auto',
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="sn-nav-icon">{item.icon}</span>
                {!isCollapsed && (
                  <span style={{ lineHeight: 1 }}>{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* ═══ Bottom: User Info + Logout ═══ */}
        <div
          style={{
            borderTop: `1px solid ${BORDER_LIGHT}`,
            padding: isCollapsed ? '10px 8px' : '12px 14px',
            flexShrink: 0,
            transition: 'padding 0.28s ease',
          }}
        >
          {isCollapsed ? (
            /* Collapsed: avatar only */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {/* Avatar — clickable to profile */}
              <div
                onClick={() => navigate('/profile')}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: avatarUrl ? 'transparent' : BRAND_COLOR,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  flexShrink: 0,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s ease',
                }}
                title={`${user?.username || 'U'} - 个人中心`}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2,132,199,0.3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  user?.username?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              {/* Logout icon button */}
              <button
                onClick={handleLogout}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: TEXT_MUTED,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.18s ease',
                }}
                title="退出登录"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FEF2F2'
                  e.currentTarget.style.color = '#EF4444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = TEXT_MUTED
                }}
              >
                <IconLogout />
              </button>
              {/* Theme toggle (collapsed) */}
              <button
                onClick={toggleTheme}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: TEXT_MUTED,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.18s ease',
                }}
                title={theme === 'dark' ? '浅色模式' : '深色模式'}
              >
                {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
              </button>
            </div>
          ) : (
            /* Expanded: user row + logout button */
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {/* Avatar — clickable to profile */}
                <div
                  onClick={() => navigate('/profile')}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: avatarUrl ? 'transparent' : BRAND_COLOR,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    flexShrink: 0,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.15s ease',
                  }}
                  title={`${user?.username || 'U'} - 个人中心`}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(2,132,199,0.3)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    user?.username?.charAt(0)?.toUpperCase() || 'U'
                  )}
                </div>
                {/* Username — clickable to profile */}
                <div
                  onClick={() => navigate('/profile')}
                  style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
                  title="个人中心"
                >
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: TEXT_PRIMARY,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user?.username || '用户'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: TEXT_MUTED,
                    }}
                  >
                    {user?.role === 'admin' ? '管理员' : '学生'}
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: TEXT_MUTED,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FEF2F2'
                  e.currentTarget.style.color = '#EF4444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = TEXT_MUTED
                }}
              >
                <IconLogout />
                退出登录
              </button>
            </>
          )}
        </div>

        {/* ═══ Dark Mode Toggle ═══ */}
        {!isCollapsed && (
          <div style={{
            borderTop: `1px solid ${BORDER_LIGHT}`,
            padding: '6px 14px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 16px', borderRadius: 8,
                border: `1px solid ${BORDER_LIGHT}`,
                background: '#fff', color: TEXT_MUTED,
                fontSize: '0.75rem', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = BRAND_COLOR
                e.currentTarget.style.color = BRAND_COLOR
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = BORDER_LIGHT
                e.currentTarget.style.color = TEXT_MUTED
              }}
            >
              {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
              {theme === 'dark' ? '浅色模式' : '深色模式'}
            </button>
          </div>
        )}

        {/* ═══ Collapse Toggle Button ═══ */}
        <button
          onClick={() => setCollapsed(!isCollapsed)}
          style={{
            position: 'absolute',
            right: -14,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: `1px solid ${BORDER_LIGHT}`,
            background: '#FFFFFF',
            color: TEXT_MUTED,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            zIndex: 5,
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = BRAND_COLOR
            e.currentTarget.style.borderColor = BRAND_COLOR
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(2,132,199,0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = TEXT_MUTED
            e.currentTarget.style.borderColor = BORDER_LIGHT
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)'
          }}
          title={isCollapsed ? '展开侧栏' : '收起侧栏'}
        >
          {isCollapsed ? <IconExpand /> : <IconCollapse />}
        </button>
      </aside>
    </>
  )
}
