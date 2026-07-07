import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#F9FAFB', padding: 24,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>💥</div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F2937', margin: '0 0 8px' }}>
              页面出错了
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.6 }}>
              组件渲染时发生了意外错误，请尝试刷新页面。
              <br />
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                {this.state.error?.message || '未知错误'}
              </span>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={this.handleReset}
                style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#1677E8', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                重试
              </button>
              <button onClick={() => window.location.href = '/home'}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
