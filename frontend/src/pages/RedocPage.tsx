import { useNavigate } from 'react-router-dom'
import { RedocStandalone } from 'redoc'

export default function RedocPage() {
  const navigate = useNavigate()

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#374151',
          cursor: 'pointer',
          fontSize: '0.875rem',
          zIndex: 1000,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        ← 首页
      </button>
      <div style={{ flex: 1, paddingTop: '2rem' }}>
        <RedocStandalone specUrl="/api/v1/openapi.json" />
      </div>
    </div>
  )
}