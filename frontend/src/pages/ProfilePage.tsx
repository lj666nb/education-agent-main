import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Cloud,
  Compass,
  GraduationCap,
  History,
  ImagePlus,
  Mail,
  PencilLine,
  Save,
  School,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { chatApi, profileApi } from '../api'
import { useAuthStore } from '../store/auth'
import type { UserProfile, UserWithProfile } from '../types'
import './ProfilePage.css'

type Notice = { type: 'success' | 'error'; text: string } | null

const profileFields: Array<keyof Pick<UserProfile, 'full_name' | 'university' | 'major' | 'grade' | 'learning_goal'>> = [
  'full_name',
  'university',
  'major',
  'grade',
  'learning_goal',
]

export default function ProfilePage() {
  const { setUser, logout } = useAuthStore()
  const [profile, setProfile] = useState<UserWithProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<UserProfile>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  const showNotice = (nextNotice: Exclude<Notice, null>) => {
    setNotice(nextNotice)
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500)
  }

  const loadProfile = async () => {
    setLoadError('')
    try {
      const response = await profileApi.getProfile()
      setProfile(response.data)
      setFormData(response.data.profile || {})
    } catch (error) {
      console.error('加载个人资料失败:', error)
      setLoadError('个人资料暂时无法加载，请检查网络后重试。')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    }
  }, [])

  const completedFields = useMemo(
    () => profileFields.filter((field) => String(profile?.profile?.[field] || '').trim()).length,
    [profile],
  )
  const completeness = Math.round((completedFields / profileFields.length) * 100)
  const displayName = profile?.profile?.full_name?.trim() || profile?.username || '学习者'
  const initials = displayName.slice(0, 1).toUpperCase()
  const joinedAt = profile?.created_at
    ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(new Date(profile.created_at))
    : '尚未记录'

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showNotice({ type: 'error', text: '请选择图片文件。' })
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotice({ type: 'error', text: '图片不能超过 5MB。' })
      event.target.value = ''
      return
    }

    setAvatarUploading(true)
    try {
      const response = await chatApi.uploadFile(file)
      const avatarUrl = response.data.url
      await profileApi.updateProfile({ avatar_url: avatarUrl })
      await loadProfile()
      const currentUser = useAuthStore.getState().user
      if (currentUser) {
        setUser({ ...currentUser, profile: { ...currentUser.profile, avatar_url: avatarUrl } } as UserWithProfile)
      }
      showNotice({ type: 'success', text: '头像已更新。' })
    } catch (error: any) {
      showNotice({ type: 'error', text: error.response?.data?.detail || '头像上传失败，请稍后重试。' })
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!String(formData.major || '').trim()) {
      showNotice({ type: 'error', text: '请填写专业方向。' })
      return
    }
    setIsSaving(true)
    try {
      const response = await profileApi.updateProfile(formData)
      setProfile(response.data)
      setFormData(response.data.profile || {})
      setUser(response.data)
      setIsEditing(false)
      showNotice({ type: 'success', text: '个人资料已保存。' })
    } catch (error: any) {
      showNotice({ type: 'error', text: error.response?.data?.detail || '保存失败，请稍后重试。' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setFormData(profile?.profile || {})
    setIsEditing(false)
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('确定要注销账户吗？账户数据将保留 30 天，期间可联系管理员恢复。')) return
    try {
      await profileApi.deleteAccount()
      logout()
      navigate('/')
    } catch (error: any) {
      showNotice({ type: 'error', text: error.response?.data?.detail || '账户注销失败，请稍后重试。' })
    }
  }

  const replayOnboarding = () => {
    let userId = useAuthStore.getState().user?.id
    if (!userId) {
      const token = localStorage.getItem('access_token')
      if (token) {
        try {
          userId = JSON.parse(atob(token.split('.')[1]))?.sub
        } catch {
          userId = undefined
        }
      }
    }
    if (userId) sessionStorage.setItem(`onboarding_force_show_${userId}`, 'true')
    navigate('/home')
  }

  if (isLoading) {
    return (
      <div className="profile-page profile-state" aria-live="polite">
        <div className="profile-loader" />
        <p>正在整理你的学习档案…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="profile-page profile-state">
        <div className="profile-state-icon"><UserRound size={28} /></div>
        <h1>没有加载成功</h1>
        <p>{loadError}</p>
        <div className="profile-state-actions">
          <button className="profile-button profile-button-secondary" onClick={() => navigate('/home')}>
            返回首页
          </button>
          <button className="profile-button profile-button-primary" onClick={() => { setIsLoading(true); loadProfile() }}>
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <button className="profile-back" onClick={() => navigate('/home')}>
          <ArrowLeft size={17} />
          返回首页
        </button>
        <div>
          <span className="profile-eyebrow">LEARNER RECORD</span>
          <h1>个人中心</h1>
          <p>管理你的身份资料与学习偏好。</p>
        </div>
      </header>

      {notice && (
        <div className={`profile-notice profile-notice-${notice.type}`} role="status">
          {notice.type === 'success' ? <Check size={18} /> : <X size={18} />}
          <span>{notice.text}</span>
        </div>
      )}

      <main className="profile-folio">
        <aside className="profile-identity">
          <div className="profile-identity-grid" aria-hidden="true" />
          <div className="profile-passport-label">学习者档案 · {profile?.role === 'admin' ? '管理员' : '学生'}</div>

          <button
            className="profile-avatar"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            aria-label="更换头像"
          >
            {profile?.profile?.avatar_url ? (
              <img src={profile.profile.avatar_url} alt={`${displayName}的头像`} />
            ) : (
              <span>{initials}</span>
            )}
            <span className="profile-avatar-action">
              {avatarUploading ? <span className="profile-mini-loader" /> : <ImagePlus size={17} />}
            </span>
          </button>
          <input ref={fileInputRef} type="file" onChange={handleAvatarUpload} hidden />

          <div className="profile-identity-copy">
            <p className="profile-identity-kicker">你的学习身份</p>
            <h2>{displayName}</h2>
            <p>@{profile?.username}</p>
          </div>

          <div className="profile-completeness">
            <div className="profile-completeness-heading">
              <span>资料完整度</span>
              <strong>{completeness}%</strong>
            </div>
            <div className="profile-progress" aria-label={`资料完整度 ${completeness}%`}>
              <span style={{ width: `${completeness}%` }} />
            </div>
            <p>{completedFields === profileFields.length ? '档案信息已填写完整' : `还有 ${profileFields.length - completedFields} 项可以补充`}</p>
          </div>

          <div className="profile-seal" aria-hidden="true">
            <GraduationCap size={24} />
            <span>KEEP<br />GROWING</span>
          </div>
        </aside>

        <section className="profile-content">
          <section className="profile-section profile-account-section">
            <div className="profile-section-heading">
              <div>
                <span className="profile-section-index">身份信息</span>
                <h2>账号概览</h2>
              </div>
              <span className={`profile-status profile-status-${profile?.status || 'active'}`}>
                <span />{profile?.status === 'active' ? '账号正常' : profile?.status === 'suspended' ? '账号已暂停' : '账号已注销'}
              </span>
            </div>
            <div className="profile-account-grid">
              <InfoItem icon={<UserRound />} label="用户名" value={profile?.username || '未设置'} />
              <InfoItem icon={<Mail />} label="邮箱" value={profile?.email || '未绑定邮箱'} muted={!profile?.email} />
              <InfoItem icon={<BookOpenCheck />} label="账号角色" value={profile?.role === 'admin' ? '管理员' : '学生'} />
              <InfoItem icon={<CalendarDays />} label="加入时间" value={joinedAt} />
            </div>
          </section>

          <section className="profile-section">
            <div className="profile-section-heading">
              <div>
                <span className="profile-section-index">学习名片</span>
                <h2>个人资料</h2>
              </div>
              {!isEditing && (
                <button className="profile-text-action" onClick={() => setIsEditing(true)}>
                  <PencilLine size={16} /> 编辑资料
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="profile-form">
                <FormField label="姓名" icon={<UserRound size={17} />}>
                  <input value={formData.full_name || ''} onChange={(event) => setFormData({ ...formData, full_name: event.target.value })} placeholder="你的姓名" />
                </FormField>
                <FormField label="学校" icon={<School size={17} />}>
                  <input value={formData.university || ''} onChange={(event) => setFormData({ ...formData, university: event.target.value })} placeholder="所在学校" />
                </FormField>
                <FormField label="专业方向" icon={<GraduationCap size={17} />} required>
                  <input value={formData.major || ''} onChange={(event) => setFormData({ ...formData, major: event.target.value })} placeholder="你的专业或方向" />
                </FormField>
                <FormField label="年级" icon={<History size={17} />}>
                  <input value={formData.grade || ''} onChange={(event) => setFormData({ ...formData, grade: event.target.value })} placeholder="例如：大二" />
                </FormField>
                <FormField label="学习目标" icon={<Target size={17} />} wide>
                  <textarea rows={4} value={formData.learning_goal || ''} onChange={(event) => setFormData({ ...formData, learning_goal: event.target.value })} placeholder="写下你现在最想达成的学习目标" />
                </FormField>
                <div className="profile-form-actions">
                  <button className="profile-button profile-button-secondary" onClick={handleCancelEdit} disabled={isSaving}>
                    <X size={17} /> 取消
                  </button>
                  <button className="profile-button profile-button-primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <span className="profile-mini-loader dark" /> : <Save size={17} />}
                    {isSaving ? '正在保存…' : '保存资料'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-details-grid">
                <DetailItem icon={<UserRound />} label="姓名" value={profile?.profile?.full_name} />
                <DetailItem icon={<School />} label="学校" value={profile?.profile?.university} />
                <DetailItem icon={<GraduationCap />} label="专业方向" value={profile?.profile?.major} />
                <DetailItem icon={<History />} label="年级" value={profile?.profile?.grade} />
                <DetailItem icon={<Target />} label="学习目标" value={profile?.profile?.learning_goal} wide />
              </div>
            )}
          </section>

          <section className="profile-section">
            <div className="profile-section-heading">
              <div>
                <span className="profile-section-index">快捷入口</span>
                <h2>继续你的学习旅程</h2>
              </div>
            </div>
            <div className="profile-links">
              <ProfileLink icon={<Compass />} title="学习画像" description="查看知识掌握与学习特点" onClick={() => navigate('/profile/dynamic')} />
              <ProfileLink icon={<History />} title="行为记录" description="回顾画像更新与学习轨迹" onClick={() => navigate('/profile/events')} />
              <ProfileLink icon={<Cloud />} title="个人云盘" description="管理学习资料与附件" onClick={() => navigate('/cloud-drive')} />
              <ProfileLink icon={<Sparkles />} title="功能引导" description="重新了解系统主要功能" onClick={replayOnboarding} />
            </div>
          </section>

          <section className="profile-danger-zone">
            <div>
              <h2>账户管理</h2>
              <p>注销后账户数据会保留 30 天。如需恢复，请在保留期内联系管理员。</p>
            </div>
            <button className="profile-delete" onClick={handleDeleteAccount}>
              <Trash2 size={16} /> 注销账户
            </button>
          </section>
        </section>
      </main>
    </div>
  )
}

function InfoItem({ icon, label, value, muted = false }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="profile-info-item">
      <span className="profile-info-icon">{icon}</span>
      <div><span>{label}</span><strong className={muted ? 'is-muted' : ''}>{value}</strong></div>
    </div>
  )
}

function DetailItem({ icon, label, value, wide = false }: { icon: React.ReactNode; label: string; value?: string; wide?: boolean }) {
  return (
    <div className={`profile-detail-item${wide ? ' profile-detail-wide' : ''}`}>
      <span className="profile-detail-icon">{icon}</span>
      <div><span>{label}</span><p className={!value ? 'is-empty' : ''}>{value || '尚未填写'}</p></div>
    </div>
  )
}

function FormField({ label, icon, required = false, wide = false, children }: { label: string; icon: React.ReactNode; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`profile-field${wide ? ' profile-field-wide' : ''}`}>
      <span>{icon}{label}{required && <em>必填</em>}</span>
      {children}
    </label>
  )
}

function ProfileLink({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button className="profile-link-card" onClick={onClick}>
      <span className="profile-link-icon">{icon}</span>
      <span><strong>{title}</strong><small>{description}</small></span>
      <ChevronRight className="profile-link-arrow" size={18} />
    </button>
  )
}
