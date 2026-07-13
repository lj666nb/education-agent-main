import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
}

export default function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="empty-state-card" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--app-bg-card)', border: '1px solid var(--app-border)', borderRadius: 16, boxShadow: 'var(--shadow-sm)' }}>
      {icon && <div style={{ marginBottom: '16px', opacity: 0.3 }}>{icon}</div>}
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--app-text-body)', marginBottom: '8px' }}>{title}</div>
      {description && <div style={{ fontSize: '14px', color: 'var(--app-text-muted)' }}>{description}</div>}
      {actions && <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>{actions}</div>}
    </div>
  )
}
