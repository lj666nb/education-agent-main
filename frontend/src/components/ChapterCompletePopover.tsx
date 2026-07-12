import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  domainId: string
  domainName: string
  wrongCount: number
  allCorrect: boolean
  bankId: string
  onClose: () => void
}

export default function ChapterCompletePopover({ domainId, domainName, wrongCount, allCorrect, bankId, onClose }: Props) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <>
      <div onClick={() => { setDismissed(true); onClose() }} style={{
        position: 'fixed', inset: 0, zIndex: 999, background: 'transparent',
      }} />
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
        width: 340, borderRadius: 14, background: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid #E5E7EB', overflow: 'hidden',
        animation: 'slideUp 0.3s ease',
      }}>
        <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F2937' }}>
            {allCorrect ? '🎉 章节完成' : '📖 章节练习完成'}
          </span>
          <button onClick={() => { setDismissed(true); onClose() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ padding: '14px 18px 18px' }}>
          <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 12, lineHeight: 1.6 }}>
            章节「{domainName}」的全部题目已完成
          </div>

          {allCorrect ? (
            <>
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16A34A', marginBottom: 4 }}>
                  全部正确！
                </div>
                <div style={{ fontSize: '0.78rem', color: '#15803D' }}>
                  该章节知识点已自动标记为已掌握 ✅
                </div>
              </div>
            </>
          ) : (
            <div onClick={() => { setDismissed(true); onClose(); navigate(`/review`) }}
              style={{
                padding: '14px 16px', borderRadius: 10,
                background: '#FEF2F2', border: '1px solid #FECACA',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#DC2626', marginBottom: 6 }}>
                📌 错题回顾
              </div>
              <div style={{ fontSize: '0.78rem', color: '#991B1B', marginBottom: 8 }}>
                有 <strong>{wrongCount}</strong> 道错题需要回顾
              </div>
              <div style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 500 }}>
                去回顾 →
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
