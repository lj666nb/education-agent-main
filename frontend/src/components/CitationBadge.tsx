import { useState, useRef } from 'react'
import CitationHoverCard, { Citation } from './CitationHoverCard'

interface CitationBadgeProps {
  indices: number[]
  citations: Citation[]
}

export default function CitationBadge({ indices, citations }: CitationBadgeProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const badgeRefs = useRef<Map<number, HTMLSpanElement>>(new Map())

  const getCitation = (index: number): Citation | undefined =>
    citations.find(c => c.index === index)

  return (
    <>
      {indices.map(idx => {
        const citation = getCitation(idx)
        return (
          <span
            key={idx}
            ref={el => { if (el) badgeRefs.current.set(idx, el) }}
            onClick={() => {
              if (citation) window.open(citation.url, '_blank', 'noopener')
            }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '16px',
              height: '16px',
              padding: '0 3px',
              borderRadius: '4px',
              backgroundColor: hoveredIdx === idx ? 'var(--primary)' : 'oklch(0.55 0.18 200 / 0.1)',
              color: hoveredIdx === idx ? '#FFFFFF' : 'var(--primary)',
              fontSize: '0.625rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '1px',
              marginRight: '1px',
              verticalAlign: 'super',
              position: 'relative',
              transition: 'all 0.15s',
              userSelect: 'none',
              lineHeight: 1,
            }}
            title={citation ? `${citation.title}\n${citation.url}` : `引用 [${idx}]`}
          >
            {idx}
          </span>
        )
      })}

      {/* Hover card */}
      {hoveredIdx !== null && (() => {
        const citation = getCitation(hoveredIdx)
        const el = badgeRefs.current.get(hoveredIdx)
        if (!citation || !el) return null
        const rect = el.getBoundingClientRect()
        return (
          <CitationHoverCard
            citation={citation}
            anchorRect={rect}
            onClose={() => setHoveredIdx(null)}
          />
        )
      })()}
    </>
  )
}
