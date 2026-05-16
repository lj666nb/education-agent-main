type Level = 'L1' | 'L2' | 'L3'

const LAYER_CONFIG: Record<Level, { label: string }> = {
  L1: { label: '简要思路' },
  L2: { label: '分步详解' },
  L3: { label: '拓展延伸' },
}

export default function LayerSwitcher({
  currentLevel, recommendedLevel, onSelect,
}: {
  currentLevel: Level
  recommendedLevel: Level
  onSelect: (level: Level) => void
}) {
  const layers: Level[] = ['L1', 'L2', 'L3']

  return (
    <div style={{
      display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: '4px', gap: '4px',
    }}>
      {layers.map(level => {
        const active = currentLevel === level
        const recommended = level === recommendedLevel
        return (
          <div key={level} onClick={() => onSelect(level)}
            style={{
              flex: 1, padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              background: active ? '#1E3A8A' : 'transparent',
              transition: 'all 0.2s',
              position: 'relative',
            }}>
            <span style={{ fontSize: '13px', color: active ? '#fff' : '#6B7280', fontWeight: 500 }}>
              {LAYER_CONFIG[level].label}
            </span>
            {recommended && (
              <span style={{ fontSize: '9px', background: '#F59E0B', color: '#fff', padding: '1px 8px', borderRadius: 8 }}>
                推荐
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
