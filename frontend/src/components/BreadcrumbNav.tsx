import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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

const BreadcrumbNav: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme } = useTheme()

  const segments = location.pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const crumbs: { label: string; path: string }[] = [
    { label: '首页', path: '/home' },
  ]

  let accum = ''
  for (const seg of segments) {
    accum += `/${seg}`
    const label = ROUTE_LABELS[accum]
    if (label && accum !== '/home') {
      crumbs.push({ label, path: accum })
    }
  }

  if (crumbs.length <= 1) return null

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 24px',
      fontSize: 13,
      fontFamily: 'var(--font-body)',
      color: '#94A3B8',
      background: 'transparent',
      flexWrap: 'wrap',
    }}>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb.path}>
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
          {i === crumbs.length - 1 ? (
            <span style={{ color: theme === 'dark' ? '#CBD5E1' : '#2C3A52', fontWeight: 500 }}>
              {crumb.label}
            </span>
          ) : (
            <span
              onClick={() => navigate(crumb.path)}
              style={{
                cursor: 'pointer',
                color: '#94A3B8',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#1677E8'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#94A3B8'}
            >
              {crumb.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

export default BreadcrumbNav
