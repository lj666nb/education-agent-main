import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div>
      <main style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}
