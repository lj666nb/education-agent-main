import React from 'react'
import type { NotebookSection } from '../../api/recommendationsCenter'
import ResourceCard from './ResourceCard'
import './notebook.css'

interface ResourceTypeSectionProps {
  section: NotebookSection
  sectionId: string
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

export default function ResourceTypeSection({
  section,
  sectionId,
  onViewDetail,
  onDelete,
  deletingId,
}: ResourceTypeSectionProps) {
  if (section.resources.length === 0) return null

  return (
    <div className="nb-article-section" id={sectionId}>
      <h3 className="nb-article-section-title">
        {section.type_label}
        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--nb-text-muted)' }}>
          ({section.resources.length})
        </span>
      </h3>
      {section.resources.map(r => (
        <ResourceCard
          key={r.id}
          resource={r}
          onViewDetail={onViewDetail}
          onDelete={onDelete}
          deleting={deletingId === r.id}
        />
      ))}
    </div>
  )
}
