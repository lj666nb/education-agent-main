import { useState, useEffect, useCallback } from 'react'

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
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

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
}: SidebarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  const handleSearchChange = useCallback((value: string) => {
    setLocalQuery(value)
    onSearch(value)
  }, [onSearch])

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

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '56px',
          left: 0,
          width: isOpen ? '220px' : '0',
          height: 'calc(100vh - 56px)',
          backgroundColor: 'white',
          borderRight: isOpen ? '1px solid var(--gray-100)' : 'none',
          transition: 'width var(--transition-slow)',
          overflow: 'hidden',
          zIndex: 100,
          boxShadow: isOpen ? 'var(--shadow-md)' : 'none',
        }}
      >
        <div
          style={{
            width: '220px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--space-4)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--gray-200)',
              backgroundColor: 'white',
              transition: 'border-color var(--transition-fast)',
            }}>
              <SearchIcon />
              <input
                type="text"
                placeholder="搜索对话..."
                value={localQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--gray-700)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-body)',
                }}
              />
            </div>
            <button
              onClick={onNewChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'white',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast), transform var(--transition-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-dark)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              title="新建对话"
            >
              <PlusIcon />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sessions.length === 0 ? (
              <div className="empty-state" style={{ paddingTop: 'var(--space-8)' }}>
                <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
                  {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
                </p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => onSelectChat(session.id)}
                  className="slide-in"
                  style={{
                    padding: 'var(--space-3)',
                    marginBottom: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: currentChatId === session.id ? 'oklch(0.55 0.25 250 / 0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)',
                    border: currentChatId === session.id ? '1px solid oklch(0.55 0.25 250 / 0.15)' : '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (currentChatId !== session.id) {
                      e.currentTarget.style.backgroundColor = 'var(--gray-50)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentChatId !== session.id) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: 'var(--gray-700)',
                      fontWeight: currentChatId === session.id ? 500 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '160px',
                      lineHeight: 1.4,
                    }}>
                      {session.title}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(session.id)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--gray-400)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        opacity: 0,
                        transition: 'opacity var(--transition-fast), color var(--transition-fast)',
                        flexShrink: 0,
                      }}
                      className="delete-btn"
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
                      title="删除对话"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                  <div style={{
                    fontSize: '0.6875rem',
                    color: 'var(--gray-400)',
                    marginTop: 'var(--space-1)',
                  }}>
                    {formatTime(session.updated_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        div:hover > .delete-btn { opacity: 1; }
      `}</style>

      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          top: '70px',
          left: isOpen ? '220px' : '10px',
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--gray-200)',
          backgroundColor: 'white',
          color: 'var(--gray-500)',
          cursor: 'pointer',
          transition: 'left var(--transition-slow), box-shadow var(--transition-fast), transform var(--transition-fast)',
          zIndex: 101,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          e.currentTarget.style.color = 'var(--gray-700)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
          e.currentTarget.style.color = 'var(--gray-500)'
        }}
        title={isOpen ? '收起侧边栏' : '展开侧边栏'}
      >
        {isOpen ? '◀' : '▶'}
      </button>
    </>
  )
}
