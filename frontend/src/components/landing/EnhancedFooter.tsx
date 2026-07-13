interface EnhancedFooterProps {
  onLoginClick: () => void
}

export default function EnhancedFooter({ onLoginClick }: EnhancedFooterProps) {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer style={{
      position: 'relative',
      zIndex: 1,
      background: 'linear-gradient(135deg, #4f46e5 0%, #6366F1 35%, #8B5CF6 65%, #A78BFA 100%)',
    }}>
      <div style={{
        background: 'rgba(15, 20, 38, 0.92)',
        borderTop: '1px solid rgba(99,102,241,0.08)',
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '60px 32px 36px',
        }}>
          {/* Three-column layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr 1fr',
            gap: '48px',
            marginBottom: '36px',
          }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
                  Education Agent
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.8, maxWidth: '280px' }}>
                基于大语言模型的多智能体教育系统，通过动态学习画像、个性化资源生成与自适应练习路径，实现真正意义上的因材施教。
              </p>
            </div>

            {/* 产品 */}
            <div>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '20px', letterSpacing: '0.05em' }}>产品</h4>
              {[
                { label: '核心功能', id: 'features' },
                { label: '产品介绍', id: 'showcase' },
                { label: 'AI全流程演示', id: 'builder' },
                { label: '多模型切换', id: 'models' },
                { label: 'AI学习工具', id: 'tools' },
              ].map(({ label, id }) => (
                <button key={label} onClick={() => scrollToSection(id)} style={{
                  display: 'block', background: 'none', border: 'none',
                  color: '#94A3B8', fontSize: '0.8125rem', padding: '7px 0',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* 支持 */}
            <div>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '20px', letterSpacing: '0.05em' }}>支持</h4>
              {['帮助中心', 'API文档', '常见问题', '系统状态', '版本发布'].map((item) => (
                <div key={item} style={{ color: '#94A3B8', fontSize: '0.8125rem', padding: '7px 0' }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(99,102,241,0.06)', marginBottom: '20px' }} />

          {/* Copyright */}
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#475569' }}>
            © {new Date().getFullYear()} Education Agent. All rights reserved.
            <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
            <span>京ICP备2024000000号</span>
            <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
            <span>京公网安备 11010802000000号</span>
            <div style={{ marginTop: '6px', fontSize: '0.6875rem', color: '#475569' }}>
              基于大模型的个性化学习多智能体系统 v2.0
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
