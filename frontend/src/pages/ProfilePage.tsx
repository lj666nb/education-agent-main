import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileApi, chatApi } from '../api'
import { useAuthStore } from '../store/auth'
import type { UserWithProfile, UserProfile } from '../types'

export default function ProfilePage() {
  const { setUser, logout } = useAuthStore()
  const [profile, setProfile] = useState<UserWithProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<UserProfile>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('请选择图片文件')
      setTimeout(() => setMessage(''), 3000)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('图片不能超过 5MB')
      setTimeout(() => setMessage(''), 3000)
      return
    }
    setAvatarUploading(true)
    try {
      const response = await chatApi.uploadFile(file)
      const avatarUrl = response.data.url
      await profileApi.updateProfile({ avatar_url: avatarUrl })
      await loadProfile()
      const updatedUser = { ...useAuthStore.getState().user, profile: { ...useAuthStore.getState().user?.profile, avatar_url: avatarUrl } }
      useAuthStore.getState().setUser(updatedUser as any)
      setMessage('头像更新成功')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '头像上传失败')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

  if (isLoading) return <div style={{ padding: '40px 32px', color: 'var(--gray-400)' }}>加载中...</div>

  return (
    <div style={{ padding: 'var(--space-4) var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          返回
        </button>
      </div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)', margin: '0 0 var(--space-6)' }}>个人中心</h1>

      {message && (
        <div style={{
          backgroundColor: message.includes('成功') ? '#f0fdf4' : 'var(--app-bg-danger)',
          color: message.includes('成功') ? '#16a34a' : 'var(--app-danger-dark)',
          padding: '0.75rem',
          borderRadius: '0.375rem',
          marginBottom: '1rem'
        }}>
          {message}
        </div>
      )}

      {/* Avatar Section */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: profile?.profile?.avatar_url
              ? 'transparent'
              : '#1677E8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '1.5rem', fontWeight: 600,
            cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
            border: '3px solid #EDE9E3',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#1677E8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2,132,199,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDE9E3'; e.currentTarget.style.boxShadow = 'none' }}
          title="点击更换头像"
        >
          {profile?.profile?.avatar_url ? (
            <img src={profile.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            profile?.username?.charAt(0)?.toUpperCase() || 'U'
          )}
          {avatarUploading && (
            <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'white' }}>
              上传中...
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '1.125rem', color: '#1F2937' }}>{profile?.username}</div>
          <div style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginTop: '4px' }}>点击头像更换图片（支持 JPG/PNG，最大 5MB）</div>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>基本信息</h2>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>用户名</label>
              <div style={{ fontWeight: '500' }}>{profile?.username}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>邮箱</label>
              <div style={{ fontWeight: '500' }}>{profile?.email || '-'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>角色</label>
              <div style={{ fontWeight: '500' }}>{profile?.role === 'admin' ? '管理员' : '学生'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>注册时间</label>
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
                <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>姓名</label>
                <div>{profile?.profile?.full_name || '-'}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>学校</label>
                <div>{profile?.profile?.university || '-'}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>专业</label>
                <div>{profile?.profile?.major || '-'}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>年级</label>
                <div>{profile?.profile?.grade || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--app-text-secondary)' }}>学习目标</label>
                <div>{profile?.profile?.learning_goal || '-'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--space-2)' }}>
                <button onClick={() => setIsEditing(true)} className="btn btn-primary">编辑</button>
                <button onClick={() => navigate('/cloud-drive')} className="btn btn-primary" style={{ backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  云盘
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--app-danger-dark)' }}>危险区域</h2>
        <button onClick={handleDeleteAccount} className="btn btn-danger">注销账户</button>
      </div>
    </div>
  )
}
