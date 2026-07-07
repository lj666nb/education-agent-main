import React from 'react'

interface SkeletonCardProps {
  lines?: number
  height?: number | string
  width?: number | string
  style?: React.CSSProperties
}

/** 骨架屏加载卡片 — 页面加载时占位 */
const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  height = 120,
  width = '100%',
  style,
}) => (
  <div className="skeleton" style={{ height, width, ...style }}>
    <div style={{ padding: '20px' }}>
      <div className="skeleton skeleton-title" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{ width: `${80 - i * 15}%` }}
        />
      ))}
    </div>
  </div>
)

/** 骨架屏文本行 */
export const SkeletonText: React.FC<{
  width?: string | number
  style?: React.CSSProperties
}> = ({ width = '100%', style }) => (
  <div className="skeleton skeleton-text" style={{ width, ...style }} />
)

/** 骨架屏标题 */
export const SkeletonTitle: React.FC<{
  width?: string | number
  style?: React.CSSProperties
}> = ({ width = '50%', style }) => (
  <div className="skeleton skeleton-title" style={{ width, ...style }} />
)

export default SkeletonCard
