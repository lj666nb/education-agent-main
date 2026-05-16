import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileApi } from '../api'
import { useAuthStore } from '../store/auth'
import type { UserWithProfile, UserProfile } from '../types'

export default function ProfilePage() {
  const { setUser, logout } = useAuthStore()
  const [profile, setProfile] = useState<UserWithProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<UserProfile>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await profileApi.getProfile()
      setProfile(response.data)
      setFormData(response.data.profile || {})
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const response = await profileApi.updateProfile(formData)
      setProfile(response.data)
      setUser(response.data)
      setIsEditing(false)
      setMessage('更新成功')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '更新失败')
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('确定要注销账户吗？您的数据将保留30天。')) return
    try {
      await profileApi.deleteAccount()
      logout()
      navigate('/')
    } catch (err) {
      console.error('Failed to delete account:', err)
    }
  }

  if (isLoading) return <div>加载中...</div>

  return (
    <div>
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
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>个人中心</h1>

      {message && (
        <div style={{
          backgroundColor: message.includes('成功') ? '#f0fdf4' : '#fef2f2',
          color: message.includes('成功') ? '#16a34a' : '#dc2626',
          padding: '0.75rem',
          borderRadius: '0.375rem',
          marginBottom: '1rem'
        }}>
          {message}
        </div>
      )}

      <div className="card">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>基本信息</h2>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>用户名</label>
              <div style={{ fontWeight: '500' }}>{profile?.username}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>邮箱</label>
              <div style={{ fontWeight: '500' }}>{profile?.email || '-'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>角色</label>
              <div style={{ fontWeight: '500' }}>{profile?.role === 'admin' ? '管理员' : '学生'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>注册时间</label>
              <div style={{ fontWeight: '500' }}>{new Date(profile?.created_at || '').toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>个人信息</h2>
          {isEditing ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>姓名</label>
                <input
                  type="text"
                  className="input"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>学校</label>
                <input
                  type="text"
                  className="input"
                  value={formData.university || ''}
                  onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>专业</label>
                <input
                  type="text"
                  className="input"
                  value={formData.major || ''}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>年级</label>
                <input
                  type="text"
                  className="input"
                  value={formData.grade || ''}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>学习目标</label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.learning_goal || ''}
                  onChange={(e) => setFormData({ ...formData, learning_goal: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleSave} className="btn btn-primary">保存</button>
                <button onClick={() => setIsEditing(false)} className="btn btn-secondary">取消</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>姓名</label>
                <div>{profile?.profile?.full_name || '-'}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>学校</label>
                <div>{profile?.profile?.university || '-'}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>专业</label>
                <div>{profile?.profile?.major || '-'}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>年级</label>
                <div>{profile?.profile?.grade || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>学习目标</label>
                <div>{profile?.profile?.learning_goal || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button onClick={() => setIsEditing(true)} className="btn btn-primary">编辑</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: '#dc2626' }}>危险区域</h2>
        <button onClick={handleDeleteAccount} className="btn btn-danger">注销账户</button>
      </div>
    </div>
  )
}
