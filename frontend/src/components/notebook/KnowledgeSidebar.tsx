import React from 'react'
import type { NotebookCategory, NotebookTopic } from '../../api/recommendationsCenter'
import './notebook.css'

interface KnowledgeSidebarProps {
  categories: NotebookCategory[]
  selectedTopicId: string | null
  expandedGroups: Set<string>
  onSelectTopic: (categoryId: string, topic: NotebookTopic) => void
  onToggleGroup: (categoryId: string) => void
  isOpen?: boolean
  onClose?: () => void
}

export default function KnowledgeSidebar({
  categories,
  selectedTopicId,
  expandedGroups,
  onSelectTopic,
  onToggleGroup,
  isOpen,
  onClose,
}: KnowledgeSidebarProps) {
  const inner = (
    <>
      <div className="nb-sidebar-header">个性化资源笔记</div>
      {categories.map(cat => {
        const isExpanded = expandedGroups.has(cat.id)
        return (
          <div key={cat.id} className="nb-sidebar-group">
            <div
              className="nb-sidebar-group-header"
              onClick={() => onToggleGroup(cat.id)}
            >
              <span className={`nb-sidebar-group-chevron${isExpanded ? ' nb-sidebar-group-chevron--open' : ''}`}>
                ▶
              </span>
              {cat.title}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--nb-text-muted)' }}>
                {cat.topics.length}
              </span>
            </div>
            {isExpanded && cat.topics.map(topic => (
              <button
                key={topic.id}
                className={`nb-sidebar-topic${selectedTopicId === topic.id ? ' nb-sidebar-topic--active' : ''}`}
                onClick={() => onSelectTopic(cat.id, topic)}
              >
                {topic.title}
                <span className="nb-sidebar-topic-count">
                  {topic.resource_count}个资源
                </span>
              </button>
            ))}
          </div>
        )
      })}
    </>
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="nb-sidebar-overlay" onClick={onClose} />}
      <aside className={`nb-sidebar${isOpen ? ' nb-sidebar--open' : ''}`}>
        {inner}
      </aside>
    </>
  )
}
