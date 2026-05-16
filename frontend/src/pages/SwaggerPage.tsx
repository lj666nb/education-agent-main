import { useNavigate } from 'react-router-dom'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function SwaggerPage() {
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
        <SwaggerUI url="/api/v1/openapi.json" />
      </div>
    </div>
  )
}