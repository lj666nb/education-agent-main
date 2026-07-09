import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Plus, Star, MessageSquare, PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react'

interface ChatSession {
  id: string
  title: string
  model: string
  updated_at: string
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  currentChatId: string | null
  onSelectChat: (chatId: string | null) => void
  onNewChat: () => void
  sessions: ChatSession[]
  onDeleteChat: (chatId: string) => void
  onSearch: (query: string) => void
  searchQuery: string
  favorites?: Record<string, number>
  onToggleFavorite?: (chatId: string) => void
}

// ── Time grouping helpers ──

function getTimeGroup(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return '本周'
  if (diffDays < 30) return '本月'
  return '更早'
}

function groupSessionsByTime(sessions: ChatSession[]): [string, ChatSession[]][] {
  const groups: Record<string, ChatSession[]> = {}
  for (const s of sessions) {
    const g = getTimeGroup(s.updated_at)
    if (!groups[g]) groups[g] = []
    groups[g].push(s)
  }
  const order = ['今天', '昨天', '本周', '本月', '更早']
  return order.filter(g => groups[g]).map(g => [g, groups[g]])
}

// ── SessionItem helper component ──

function SessionItem({ session, isFav, currentChatId, onSelectChat, onDeleteChat, onToggleFavorite, formatTime, onContextMenu }: {
  session: ChatSession
  isFav: boolean
  currentChatId: string | null
  onSelectChat: (id: string | null) => void
  onDeleteChat: (id: string) => void
  onToggleFavorite?: (id: string) => void
  formatTime: (ts: string) => string
  onContextMenu: (e: React.MouseEvent, id: string) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = currentChatId === session.id
  return (
    <div
      onClick={() => onSelectChat(session.id)}
      onContextMenu={(e) => onContextMenu(e, session.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="sidebar-slide-in"
      style={{
        padding: '10px 12px', marginBottom: '2px', borderRadius: '8px',
        backgroundColor: isActive ? 'oklch(0.55 0.18 200 / 0.06)' : isHovered ? 'var(--gray-50)' : 'transparent',
        cursor: 'pointer', transition: 'background-color 0.15s',
        border: isActive ? '1px solid oklch(0.55 0.18 200 / 0.12)' : '1px solid transparent',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}
    >
      <MessageSquare size={14} style={{ color: isActive ? 'var(--primary)' : 'var(--gray-300)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.8125rem', color: 'var(--gray-700)',
          fontWeight: isActive ? 500 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.4,
        }}>
          {session.title}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: '2px' }}>
          {formatTime(session.updated_at)}
        </div>
      </div>
      {isFav && <Star size={14} style={{ color: '#e67e22', flexShrink: 0 }} fill="#e67e22" />}
      <button
        onClick={(e) => { e.stopPropagation(); onDeleteChat(session.id); }}
        title="删除对话"
        style={{
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s',
          width: '24px', height: '24px',
          border: 'none', background: 'none',
          color: 'var(--gray-400)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-400)'; }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Shared button style ──

const collapseIconBtnStyle: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: '8px',
  border: '2px solid transparent', backgroundColor: 'transparent',
  color: 'var(--gray-400)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background-color 0.15s, color 0.15s, border-color 0.3s',
}

// ── Main Sidebar component ──

export default function Sidebar({
  isOpen,
  onToggle,
  currentChatId,
  onSelectChat,
  onNewChat,
  sessions,
  onDeleteChat,
  onSearch,
  searchQuery,
  favorites = {},
  onToggleFavorite,
}: SidebarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setLocalQuery(value)
    onSearch(value)
  }, [onSearch])

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault()
    setContextMenu({ chatId, x: e.clientX, y: e.clientY })
  }

  const handleContextAction = (action: 'favorite' | 'unfavorite' | 'delete') => {
    if (!contextMenu) return
    const { chatId } = contextMenu
    setContextMenu(null)

    if (action === 'favorite' || action === 'unfavorite') {
      onToggleFavorite?.(chatId)
    } else if (action === 'delete') {
      onDeleteChat(chatId)
    }
  }

  const displayedSessions = sessions

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString('zh-CN')
  }

  const itemProps = {
    currentChatId,
    onSelectChat,
    onDeleteChat,
    onToggleFavorite,
    formatTime,
    onContextMenu: handleContextMenu,
  }

  return (
    <>
      {/* ── Collapsed sidebar — icon-only mode ── */}
      {!isOpen && (
        <div style={{
          width: 'var(--chat-sidebar-collapsed)',
          height: '100%',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #F0F0F0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          gap: '16px',
          flexShrink: 0,
        }}>
          <button onClick={onToggle} title="展开侧边栏" style={collapseIconBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <PanelLeftOpen size={18} />
          </button>
          <button onClick={onNewChat} title="新建对话" style={collapseIconBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Plus size={18} />
          </button>
          {sessions.filter(s => favorites[s.id]).slice(0, 5).map(s => (
            <button key={s.id} onClick={() => onSelectChat(s.id)} title={s.title}
              style={{
                ...collapseIconBtnStyle,
                backgroundColor: currentChatId === s.id ? 'oklch(0.55 0.18 200 / 0.08)' : 'transparent',
                color: currentChatId === s.id ? 'var(--primary)' : 'var(--gray-400)',
              }}
              onMouseEnter={e => {
                if (currentChatId !== s.id) {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                  e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)'
                }
              }}
              onMouseLeave={e => {
                if (currentChatId !== s.id) {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <MessageSquare size={18} />
            </button>
          ))}
        </div>
      )}

      {/* ── Expanded sidebar ── */}
      <div style={{
        width: isOpen ? 'var(--chat-sidebar-width)' : '0',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRight: isOpen ? '1px solid #F0F0F0' : 'none',
        boxShadow: isOpen ? '2px 0 12px rgba(0,0,0,0.04)' : 'none',
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          width: 'var(--chat-sidebar-width)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          overflow: 'hidden',
        }}>
          {/* Top row: collapse + title + new chat */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <button onClick={onToggle} title="收起侧边栏" style={collapseIconBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'oklch(0.55 0.18 200 / 0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <PanelLeftClose size={18} />
            </button>
            <div style={{
              flex: 1,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--gray-700)',
              fontFamily: 'var(--font-heading)',
            }}>
              对话历史
            </div>
            <button onClick={onNewChat} title="新建对话"
              style={{
                width: '32px', height: '32px', borderRadius: '8px',
                border: 'none', backgroundColor: 'var(--primary)',
                color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.15s',
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '8px',
            border: '1px solid var(--gray-200)', backgroundColor: 'var(--gray-50)',
            marginBottom: '16px',
          }}>
            <Search size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="搜索对话..."
              value={localQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none',
                backgroundColor: 'transparent', color: 'var(--gray-700)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-body)',
              }}
            />
          </div>

          {/* Favorites section */}
          {Object.keys(favorites).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '8px', paddingLeft: '4px',
              }}>
                <Star size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                收藏
              </div>
              {sessions.filter(s => favorites[s.id]).map(session => (
                <SessionItem key={session.id} session={session} isFav={true} {...itemProps} />
              ))}
            </div>
          )}

          {/* History grouped by time */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {groupSessionsByTime(displayedSessions.filter(s => !favorites[s.id])).map(([group, items]) => (
              <div key={group} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gray-400)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: '8px', paddingLeft: '4px',
                }}>
                  {group}
                </div>
                {items.map(session => (
                  <SessionItem key={session.id} session={session} isFav={false} {...itemProps} />
                ))}
              </div>
            ))}
            {displayedSessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
                {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'white',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--gray-100)',
            zIndex: 2000,
            minWidth: '120px',
            overflow: 'hidden',
          }}
        >
          {favorites[contextMenu.chatId] ? (
            <button
              onClick={() => handleContextAction('unfavorite')}
              style={{
                width: '100%', padding: '8px 14px',
                border: 'none', background: 'none',
                cursor: 'pointer', fontSize: '0.8125rem',
                color: '#e67e22',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Star size={14} fill="#e67e22" color="#e67e22" /> 取消收藏
            </button>
          ) : (
            <>
              <button
                onClick={() => handleContextAction('favorite')}
                style={{
                  width: '100%', padding: '8px 14px',
                  border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: '0.8125rem',
                  color: 'var(--gray-700)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Star size={14} /> 收藏对话
              </button>
              <button
                onClick={() => handleContextAction('delete')}
                style={{
                  width: '100%', padding: '8px 14px',
                  border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: '0.8125rem',
                  color: 'var(--danger)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  borderTop: '1px solid var(--gray-100)',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 size={14} /> 删除对话
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
