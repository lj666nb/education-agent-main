import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useTheme } from '../store/theme'

const ROUTE_LABELS: Record<string, string> = {
  '/home': '首页',
  '/chat': 'AI 对话',
  '/chat/new': '新建对话',
  '/banks': '智能题库',
  '/profile': '学习画像',
  '/profile/dynamic': '动态画像',
  '/profile/init': '初始化画像',
  '/profile/events': '行为事件',
  '/review': '复习中心',
  '/knowledge-graph': '知识图谱',
  '/knowledge-points': '知识点总览',
  '/recommendations': '资源推荐',
  '/path': '学习路径',
  '/path/history': '路径历史',
  '/stats': '学习分析',
  '/settings': '设置',
  '/settings/api': 'API 设置',
  '/admin': '管理',
  '/cloud-drive': '云盘',
  '/wrong-answers': '错题本',
  '/resources': '资源',
  '/agent': '智能体',
  '/agent/tasks': '智能体任务',
}

const GlobalHeader: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isAuthenticated } = useAuthStore()
  const { theme } = useTheme()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const avatarColor = '#1677E8'
  const initial = user?.username?.[0]?.toUpperCase() || 'U'

  const isDark = theme === 'dark'
  const textMuted = isDark ? '#94A3B8' : '#64748B'
  const textPrimary = isDark ? '#F1F5F9' : '#2C3A52'
  const borderColor = isDark ? '#334155' : '#E5EDF7'

  /* ── Breadcrumb logic ── */
  const segments = location.pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [{ label: '首页', path: '/home' }]
  if (segments.length > 0) {
    let accum = ''
    for (const seg of segments) {
      accum += `/${seg}`
      const label = ROUTE_LABELS[accum]
      if (label && accum !== '/home') {
        crumbs.push({ label, path: accum })
      }
    }
  }

  return (
    <header style={{
      height: 56,
      background: isDark
        ? 'rgba(15,23,42,0.92)'
        : 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${borderColor}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexShrink: 0,
      gap: 0,
    }}>
      {/* ── Left: Logo + Brand ── */}
      <div
        onClick={() => navigate('/home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          flexShrink: 0,
          marginRight: 32,
        }}
      >
        <div style={{
          width: 34, height: 34,
          borderRadius: 9,
          background: 'linear-gradient(135deg, #1677E8, #4096FF)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: 17,
          fontFamily: 'var(--font-heading)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(22,119,232,0.35)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
          }}
        >E</div>
        <span style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'var(--font-heading)',
          color: textPrimary,
          letterSpacing: '-0.01em',
          transition: 'color 0.15s',
        }}
          onMouseEnter={e => (e.target as HTMLElement).style.color = '#1677E8'}
          onMouseLeave={e => (e.target as HTMLElement).style.color = textPrimary}
        >Education Agent</span>
      </div>

      {/* ── Center: Breadcrumb ── */}
      {crumbs.length > 1 && (
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          overflow: 'hidden',
        }}>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#475569' : '#CBD5E1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              )}
              {i === crumbs.length - 1 ? (
                <span style={{
                  color: textPrimary,
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-body)',
                }}>
                  {crumb.label}
                </span>
              ) : (
                <span
                  onClick={() => navigate(crumb.path)}
                  style={{
                    cursor: 'pointer',
                    color: textMuted,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-body)',
                    transition: 'color 0.15s',
                    fontWeight: 500,
                  }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = '#1677E8'}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = textMuted}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* ── Right: Service + Notify + User ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, marginLeft: crumbs.length > 1 ? 24 : 'auto' }}>

        {/* Customer Service */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 13,
            fontWeight: 500,
            color: textMuted,
            cursor: 'pointer',
            transition: 'color 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1677E8'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = textMuted}
          title="客服电话"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span>客服电话</span>
        </div>

        {/* Notification */}
        <div
          style={{
            position: 'relative',
            cursor: 'pointer',
            color: textMuted,
            transition: 'color 0.15s, transform 0.2s ease',
            padding: 4,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#1677E8'
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = textMuted
            ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
          }}
          title="消息通知"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 8, height: 8,
            background: '#EF4444', borderRadius: '50%',
            border: `2px solid ${isDark ? '#1E293B' : '#FFFFFF'}`,
          }}/>
        </div>

        {/* User Avatar */}
        {isAuthenticated && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                width: 36, height: 36,
                borderRadius: '50%',
                background: avatarColor,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: showUserMenu ? '0 0 0 3px rgba(22,119,232,0.25)' : 'none',
              }}
              onMouseEnter={e => {
                if (!showUserMenu) (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(22,119,232,0.2)'
              }}
              onMouseLeave={e => {
                if (!showUserMenu) (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                if (!showUserMenu) (e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              {initial}
            </div>
            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: 44, right: 0,
                width: 200,
                background: isDark ? '#1E293B' : '#FFFFFF',
                borderRadius: 12,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                border: `1px solid ${borderColor}`,
                padding: 8,
                zIndex: 1000,
                animation: 'fadeIn 0.15s ease-out',
              }}>
                <div style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${borderColor}`,
                  marginBottom: 4,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
                    {user?.username || '用户'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                    学员
                  </div>
                </div>
                <button
                  onClick={() => { navigate('/profile/dynamic'); setShowUserMenu(false); }}
                  style={menuItemStyle(isDark)}
                >
                  学习画像
                </button>
                <button
                  onClick={handleLogout}
                  style={menuItemStyle(isDark, true)}
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function menuItemStyle(isDark: boolean, danger?: boolean) {
  return {
    display: 'block', width: '100%',
    padding: '8px 12px',
    fontSize: 13, fontWeight: 500,
    color: danger ? '#EF4444' : (isDark ? '#CBD5E1' : '#475569'),
    background: 'none', border: 'none', borderRadius: 8,
    cursor: 'pointer', textAlign: 'left' as const,
    transition: 'background 0.15s, color 0.15s',
    fontFamily: 'var(--font-body)',
  }
}

export default GlobalHeader
