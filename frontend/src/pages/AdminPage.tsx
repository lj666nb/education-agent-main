import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileApi } from '../api'
import type { UserWithProfile } from '../types'

export default function AdminPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [stats, setStats] = useState({ total: 0, admins: 0, students: 0, active: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await profileApi.getUsers()
      const userList = response.data
      setUsers(userList)
      setStats({
        total: userList.length,
        admins: userList.filter(u => u.role === 'admin').length,
        students: userList.filter(u => u.role === 'student').length,
        active: userList.filter(u => u.status === 'active').length,
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || '获取用户列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除该用户吗？')) return
    try {
      await profileApi.deleteUser(userId)
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
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
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>管理后台</h1>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{stats.total}</div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>总用户数</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>{stats.admins}</div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>管理员</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{stats.students}</div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>学生</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{stats.active}</div>
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>活跃用户</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>用户列表</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>用户名</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>邮箱</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>角色</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>专业</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>注册时间</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem' }}>{user.username}</td>
                  <td style={{ padding: '0.75rem' }}>{user.email || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      backgroundColor: user.role === 'admin' ? '#8b5cf6' : '#3b82f6',
                      color: 'white'
                    }}>
                      {user.role === 'admin' ? '管理员' : '学生'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      backgroundColor: user.status === 'active' ? '#22c55e' : '#ef4444',
                      color: 'white'
                    }}>
                      {user.status === 'active' ? '活跃' : user.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{user.profile?.major || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="btn btn-danger"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
