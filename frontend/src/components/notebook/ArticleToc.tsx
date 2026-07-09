import React, { useEffect, useState, useCallback } from 'react'
import type { NotebookTopic } from '../../api/recommendationsCenter'
import './notebook.css'

interface ArticleTocProps {
  topic: NotebookTopic | null
}

export default function ArticleToc({ topic }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // IntersectionObserver: track which section is in view
  useEffect(() => {
    if (!topic) return

    const sectionIds = [
      'section-overview',
      ...topic.sections.map(s => `section-${s.type}`),
    ]

    const observers: IntersectionObserver[] = []

    // Use a map to track which sections are intersecting
    const visibleSections = new Map<string, boolean>()

    const handleIntersect = (id: string) => (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        visibleSections.set(id, entry.isIntersecting)
      })
      // Find the first visible section (topmost)
      for (const sid of sectionIds) {
        if (visibleSections.get(sid)) {
          setActiveId(sid)
          return
        }
      }
    }

    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) {
        const observer = new IntersectionObserver(handleIntersect(id), {
          rootMargin: '-80px 0px -60% 0px',
          threshold: 0,
        })
        observer.observe(el)
        observers.push(observer)
      }
    })

    return () => observers.forEach(o => o.disconnect())
  }, [topic])

  const handleClick = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  if (!topic) return null

  const sections = topic.sections.filter(s => s.resources.length > 0)

  return (
    <aside className="nb-toc">
      <div className="nb-toc-title">本页目录</div>
      <button
        className={`nb-toc-item${activeId === 'section-overview' ? ' nb-toc-item--active' : ''}`}
        onClick={() => handleClick('section-overview')}
      >
        推荐概览
      </button>
      {sections.map(s => (
        <button
          key={s.type}
          className={`nb-toc-item${activeId === `section-${s.type}` ? ' nb-toc-item--active' : ''}`}
          onClick={() => handleClick(`section-${s.type}`)}
        >
          {s.type_label}
          <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.6 }}>
            ({s.resources.length})
          </span>
        </button>
      ))}
    </aside>
  )
}
