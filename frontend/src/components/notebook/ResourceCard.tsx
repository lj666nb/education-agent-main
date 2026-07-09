import React from 'react'
import type { NotebookResource } from '../../api/recommendationsCenter'
import { RESOURCE_TYPE_CONFIG } from '../../api/recommendationsCenter'
import './notebook.css'

interface ResourceCardProps {
  resource: NotebookResource
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deleting: boolean
}

export default function ResourceCard({ resource, onViewDetail, onDelete, deleting }: ResourceCardProps) {
  const typeCfg = RESOURCE_TYPE_CONFIG[resource.resource_type]
  const badgeColor = typeCfg?.color || '#8b8cff'
  const badgeBg = typeCfg?.bg || 'rgba(139,140,255,0.12)'
  const typeLabel = resource.resource_type_label || resource.resource_type

  // Difficulty stars
  const stars = resource.difficulty_level
    ? '⭐'.repeat(resource.difficulty_level) + '☆'.repeat(5 - resource.difficulty_level)
    : null

  return (
    <div className="nb-resource-card">
      <div className="nb-resource-card-header">
        <span
          className="nb-resource-card-title"
          onClick={() => onViewDetail(resource.id)}
          title={resource.title}
        >
          {resource.title}
        </span>
        <span
          className="nb-resource-card-badge"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {typeLabel}
        </span>
      </div>

      {(resource.tags.length > 0 || stars) && (
        <div className="nb-resource-card-meta">
          {stars && <span>{stars}</span>}
          {resource.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', fontSize: 11 }}>
              {tag}
            </span>
          ))}
          {resource.source_label && (
            <span>来源: {resource.source_label}</span>
          )}
        </div>
      )}

      <div className="nb-resource-card-actions">
        <button className="nb-resource-card-action-btn" onClick={() => onViewDetail(resource.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          查看详情
        </button>
        <button
          className="nb-resource-card-action-btn nb-resource-card-action-btn--danger"
          onClick={() => onDelete(resource.id)}
          disabled={deleting}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          {deleting ? '删除中...' : '移除'}
        </button>
      </div>
    </div>
  )
}
