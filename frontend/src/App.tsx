import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/auth'
import { ThemeProvider } from './store/theme'
import Layout from './components/Layout'
import ToastContainer from './components/shared/Toast'
import ErrorBoundary from './components/ErrorBoundary'

// Landing page — eager loaded for instant hero animation
import LandingPage from './pages/LandingPage'

// Eagerly loaded (always needed)
// Layout, ProtectedRoute

// Lazy-loaded page components
const BusinessHome = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ProfileInitPage = lazy(() => import('./pages/ProfileInitPage'))
const DynamicProfilePage = lazy(() => import('./pages/DynamicProfilePage'))
const BehaviorEventsPage = lazy(() => import('./pages/BehaviorEventsPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ChatPlatform = lazy(() => import('./components/ChatPlatform'))
const BankListPage = lazy(() => import('./pages/BankListPage'))
const BankDetailPage = lazy(() => import('./pages/BankDetailPage'))
const PracticePage = lazy(() => import('./pages/PracticePage'))
const ExamPaperDetailPage = lazy(() => import('./pages/ExamPaperDetailPage'))
const ApiSettingsPage = lazy(() => import('./pages/ApiSettingsPage'))
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage'))
const CloudDrivePage = lazy(() => import('./pages/CloudDrivePage'))
const WrongAnswerPage = lazy(() => import('./pages/WrongAnswerPage'))
const TestHistoryPage = lazy(() => import('./pages/TestHistoryPage'))
const TestHistoryDetailPage = lazy(() => import('./pages/TestHistoryDetailPage'))
const DailyStatsPage = lazy(() => import('./pages/DailyStatsPage'))
const DataStructureNotesPage = lazy(() => import('./pages/DataStructureNotesPage'))
const AgentTasksPage = lazy(() => import('./pages/AgentTasksPage'))
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'))
const PathHistoryPage = lazy(() => import('./pages/PathHistoryPage'))
const ReviewCenterPage = lazy(() => import('./pages/ReviewCenterPage'))
const ReviewWrongPage = lazy(() => import('./pages/ReviewWrongPage'))
const KnowledgePointsPage = lazy(() => import('./pages/KnowledgePointsPage'))
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage'))

const PageSkeleton = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--app-bg-page, #F7FAFF)',
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      {/* Animated brand spinner */}
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'linear-gradient(135deg, #1677E8, #38BDF8)',
        animation: 'skeletonPulse 1.2s ease-in-out infinite',
      }} />
      <div style={{
        fontSize: '0.85rem',
        color: 'var(--app-text-muted, #94A3B8)',
        fontWeight: 500,
        fontFamily: "'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif",
      }}>
        加载中...
      </div>
    </div>
  </div>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <ThemeProvider>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastContainer />
      <ErrorBoundary>
      <Routes>
        {/* Landing page (no Layout wrapper — has its own navbar) */}
        <Route path="/" element={<LandingPage />} />

        {/* Login / Register — standalone pages for direct access */}
        <Route path="/login" element={<LazyRoute><LoginPage /></LazyRoute>} />
        <Route path="/register" element={<LazyRoute><RegisterPage /></LazyRoute>} />

        {/* Business pages wrapped in Layout */}
        <Route path="/home" element={<Layout />}>
          <Route index element={<LazyRoute><BusinessHome /></LazyRoute>} />
        </Route>

        {/* Legacy authenticated routes */}
        <Route element={<Layout />}>
          <Route path="chat" element={<ProtectedRoute><LazyRoute><ChatPage /></LazyRoute></ProtectedRoute>} />
          <Route path="chat/new" element={<ProtectedRoute><LazyRoute><ChatPlatform /></LazyRoute></ProtectedRoute>} />
          <Route path="profile/init" element={<ProtectedRoute><LazyRoute><ProfileInitPage /></LazyRoute></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><LazyRoute><ProfilePage /></LazyRoute></ProtectedRoute>} />
          <Route path="profile/dynamic" element={<ProtectedRoute><LazyRoute><DynamicProfilePage /></LazyRoute></ProtectedRoute>} />
          <Route path="profile/events" element={<ProtectedRoute><LazyRoute><BehaviorEventsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks" element={<ProtectedRoute><LazyRoute><BankListPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId" element={<ProtectedRoute><LazyRoute><BankDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/practice" element={<ProtectedRoute><LazyRoute><PracticePage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/exam-papers/:paperId" element={<ProtectedRoute><LazyRoute><ExamPaperDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/history" element={<ProtectedRoute><LazyRoute><TestHistoryPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/history/:sessionId" element={<ProtectedRoute><LazyRoute><TestHistoryDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/stats" element={<ProtectedRoute><LazyRoute><DailyStatsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/wrong-review" element={<ProtectedRoute><LazyRoute><ReviewWrongPage /></LazyRoute></ProtectedRoute>} />
          <Route path="wrong-answers" element={<ProtectedRoute><LazyRoute><WrongAnswerPage /></LazyRoute></ProtectedRoute>} />
          <Route path="stats" element={<ProtectedRoute><LazyRoute><DailyStatsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute><LazyRoute><AdminPage /></LazyRoute></ProtectedRoute>} />
          <Route path="settings/api" element={<ProtectedRoute><LazyRoute><ApiSettingsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="resources" element={<Navigate to="/recommendations" replace />} />
          <Route path="resources/:id" element={<ProtectedRoute><LazyRoute><ResourceDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="review" element={<ProtectedRoute><LazyRoute><ReviewCenterPage /></LazyRoute></ProtectedRoute>} />
          <Route path="knowledge-graph" element={<ProtectedRoute><LazyRoute><KnowledgeGraphPage /></LazyRoute></ProtectedRoute>} />
          <Route path="knowledge-points" element={<ProtectedRoute><LazyRoute><KnowledgePointsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="cloud-drive" element={<ProtectedRoute><LazyRoute><CloudDrivePage /></LazyRoute></ProtectedRoute>} />
          <Route path="recommendations" element={<ProtectedRoute><LazyRoute><DataStructureNotesPage /></LazyRoute></ProtectedRoute>} />
          <Route path="path" element={<ProtectedRoute><LazyRoute><LearningPathPage /></LazyRoute></ProtectedRoute>} />
          <Route path="path/history" element={<ProtectedRoute><LazyRoute><PathHistoryPage /></LazyRoute></ProtectedRoute>} />
          <Route path="agent/tasks" element={<ProtectedRoute><LazyRoute><AgentTasksPage /></LazyRoute></ProtectedRoute>} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
