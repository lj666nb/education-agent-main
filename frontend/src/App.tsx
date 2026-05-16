import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import ProfileInitPage from './pages/ProfileInitPage'
import DynamicProfilePage from './pages/DynamicProfilePage'
import BehaviorEventsPage from './pages/BehaviorEventsPage'
import ChatPage from './pages/ChatPage'
import ChatPlatform from './components/ChatPlatform'
import BankListPage from './pages/BankListPage'
import BankDetailPage from './pages/BankDetailPage'
import PracticePage from './pages/PracticePage'
import ExamPaperDetailPage from './pages/ExamPaperDetailPage'
import SwaggerPage from './pages/SwaggerPage'
import RedocPage from './pages/RedocPage'
import HealthPage from './pages/HealthPage'
import ApiSettingsPage from './pages/ApiSettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route
            path="chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="chat/new"
            element={
              <ProtectedRoute>
                <ChatPlatform />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/init"
            element={
              <ProtectedRoute>
                <ProfileInitPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/dynamic"
            element={
              <ProtectedRoute>
                <DynamicProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/events"
            element={
              <ProtectedRoute>
                <BehaviorEventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="banks"
            element={
              <ProtectedRoute>
                <BankListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="banks/:bankId"
            element={
              <ProtectedRoute>
                <BankDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="banks/:bankId/practice"
            element={
              <ProtectedRoute>
                <PracticePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="banks/:bankId/exam-papers/:paperId"
            element={
              <ProtectedRoute>
                <ExamPaperDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="swagger" element={<SwaggerPage />} />
          <Route path="redoc" element={<RedocPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="projects" element={<Navigate to="/chat/new" replace />} />
          <Route path="api-settings" element={<Navigate to="/settings/api" replace />} />
          <Route
            path="settings/api"
            element={
              <ProtectedRoute>
                <ApiSettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
