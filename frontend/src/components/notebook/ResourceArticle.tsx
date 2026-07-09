import React from 'react'
import type { NotebookTopic } from '../../api/recommendationsCenter'
import ResourceTypeSection from './ResourceTypeSection'
import { RESOURCE_TYPE_CONFIG } from '../../api/recommendationsCenter'
import './notebook.css'

interface ResourceArticleProps {
  topic: NotebookTopic | null
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

export default function ResourceArticle({ topic, onViewDetail, onDelete, deletingId }: ResourceArticleProps) {
  if (!topic) {
    return (
      <div className="nb-article" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="nb-empty">
          <div className="nb-empty-icon">📖</div>
          <div className="nb-empty-title">选择一个知识点</div>
          <div className="nb-empty-desc">从左侧目录中选择一个知识点，查看系统为你整理的学习资源。</div>
        </div>
      </div>
    )
  }

  const totalResources = topic.sections.reduce((sum, s) => sum + s.resources.length, 0)

  // Build type summary for subtitle
  const typeLabels = topic.sections
    .filter(s => s.resources.length > 0)
    .map(s => s.type_label)

  // Build recommended order
  const orderedTypes = topic.sections
    .filter(s => s.resources.length > 0)
    .map(s => s.type_label)
  const suggestedOrder = orderedTypes.length > 0
    ? orderedTypes.join(' → ')
    : '暂无'

  return (
    <div className="nb-article">
      {/* Title */}
      <h1 className="nb-article-title">{topic.title}</h1>

      {/* Subtitle / guide */}
      <p className="nb-article-subtitle">
        系统为「{topic.title}」整理了 {totalResources} 个学习资源。
        {orderedTypes.length > 0 && (
          <>建议按顺序学习：{suggestedOrder}。</>
        )}
      </p>

      <hr className="nb-article-divider" />

      {/* Overview section */}
      <div className="nb-article-section" id="section-overview">
        <h3 className="nb-article-section-title">📊 推荐概览</h3>
        <div className="nb-overview">
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">推荐数量</div>
            <div className="nb-overview-item-value">{totalResources}</div>
          </div>
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">资源类型</div>
            <div className="nb-overview-item-value">{typeLabels.length} 种</div>
          </div>
          {topic.mastery_score != null && (
            <div className="nb-overview-item">
              <div className="nb-overview-item-label">当前掌握度</div>
              <div className="nb-overview-item-value">
                {Math.round(topic.mastery_score)}%
              </div>
            </div>
          )}
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">建议顺序</div>
            <div className="nb-overview-item-value" style={{ fontSize: 12 }}>
              {suggestedOrder}
            </div>
          </div>
        </div>
      </div>

      {/* Resource type sections */}
      {topic.sections.map(section => (
        <ResourceTypeSection
          key={section.type}
          section={section}
          sectionId={`section-${section.type}`}
          onViewDetail={onViewDetail}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </div>
  )
}
