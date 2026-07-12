import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface Citation {
  index: number
  title: string
  url: string
  snippet: string
}

interface CitationHoverCardProps {
  citation: Citation
  anchorRect: DOMRect
  onClose: () => void
}

function getHostname(url: string): string {
  try { return new URL(url).hostname }
  catch { return url }
}

export default function CitationHoverCard({ citation, anchorRect, onClose }: CitationHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!cardRef.current) return
    const card = cardRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 12

    let top = anchorRect.bottom + gap
    let left = anchorRect.left

    // Flip vertically if not enough space below
    if (top + card.height > vh - 16) {
      top = anchorRect.top - card.height - gap
    }
    // Keep within horizontal bounds
    if (left + card.width > vw - 16) {
      left = vw - card.width - 16
    }
    if (left < 16) left = 16

    setPos({ top, left })
  }, [anchorRect])

  return createPortal(
    <div
      ref={cardRef}
      className="citation-hover-card"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 5000,
        maxWidth: '340px',
        minWidth: '240px',
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--gray-200, #E5E7EB)',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
        padding: '14px 16px',
        fontFamily: 'var(--font-body)',
        fontSize: '0.8125rem',
        lineHeight: 1.5,
        animation: 'fadeInUp 0.15s ease-out',
      }}
      onMouseLeave={() => {
        // Small delay to prevent flicker
        setTimeout(onClose, 150)
      }}
    >
      {/* Title */}
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontWeight: 600,
          color: '#1F2937',
          textDecoration: 'none',
          display: 'block',
          marginBottom: '4px',
          fontSize: '0.875rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#1F2937' }}
      >
        {citation.title}
      </a>

      {/* Domain */}
      <div style={{
        color: 'var(--gray-400, #9CA3AF)',
        fontSize: '0.6875rem',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        {getHostname(citation.url)}
      </div>

      {/* Snippet */}
      {citation.snippet && (
        <div style={{
          color: 'var(--gray-500, #6B7280)',
          fontSize: '0.75rem',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {citation.snippet}
        </div>
      )}
    </div>,
    document.body
  )
}
