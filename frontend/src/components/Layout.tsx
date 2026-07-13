import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import StarryBackground, { useStarryTheme } from './StarryBackground'
import SidebarNav from './SidebarNav'
import PageTransition from './PageTransition'
import OnboardingCarousel from './OnboardingCarousel'

export default function Layout() {
  const theme = useStarryTheme()
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <StarryBackground theme={theme} />
      <OnboardingCarousel />

      {/* 移动端遮罩 */}
      {isMobile && mobileSidebar && (
        <div className="sidebar-overlay" onClick={() => setMobileSidebar(false)} />
      )}

      {/* 侧栏：移动端以抽屉形式显示 */}
      <div style={{
        display: isMobile ? (mobileSidebar ? 'block' : 'none') : 'block',
        position: isMobile ? 'fixed' : 'static',
        zIndex: isMobile ? 1000 : 'auto',
      }}>
        <SidebarNav onMobileToggle={isMobile ? () => setMobileSidebar(false) : undefined} />
      </div>

      {/* 移动端汉堡菜单按钮 */}
      {isMobile && !mobileSidebar && (
        <button onClick={() => setMobileSidebar(true)}
          style={{
            position: 'fixed', top: 10, left: 10, zIndex: 100,
            width: 36, height: 36, borderRadius: 8,
            border: '1px solid var(--app-border)', background: 'var(--app-bg-card)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--app-text-body)" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      )}

      <main style={{
        flex: 1,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  )
}
