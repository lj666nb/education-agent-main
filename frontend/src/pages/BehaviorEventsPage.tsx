import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileV2Api } from '../api'
import type { TimelineEvent, BehaviorEvent } from '../types/profile'

export default function BehaviorEventsPage() {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [behaviorEvents, setBehaviorEvents] = useState<BehaviorEvent[]>([])
  const [activeTab, setActiveTab] = useState<'timeline' | 'behavior'>('timeline')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showRecordEvent, setShowRecordEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ event_type: '', event_data: '' })
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    setError('')
    try {
      if (activeTab === 'timeline') {
        const response = await profileV2Api.getTimeline(50, 0)
        setTimeline(response.data.events || [])
      } else {
        const response = await profileV2Api.getBehaviorEvents(undefined, 100, 0)
        setBehaviorEvents(response.data.events || [])
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        navigate('/profile/init')
      } else {
        setError(err.response?.data?.detail || '获取数据失败')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecordEvent = async () => {
    try {
      let eventData = {}
      if (newEvent.event_data) {
        eventData = JSON.parse(newEvent.event_data)
      }
      await profileV2Api.recordBehavior({
        event_type: newEvent.event_type,
        event_data: eventData,
      })
      setMessage('行为事件记录成功')
      setShowRecordEvent(false)
      setNewEvent({ event_type: '', event_data: '' })
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.detail || '记录行为事件失败')
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
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

      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>行为事件记录</h1>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {message && (
        <div style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          {message}
          <button onClick={() => setMessage('')} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <button
          onClick={() => setActiveTab('timeline')}
          className={activeTab === 'timeline' ? 'btn btn-primary' : 'btn btn-secondary'}
        >
          时间线
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={activeTab === 'behavior' ? 'btn btn-primary' : 'btn btn-secondary'}
        >
          行为事件
        </button>
        <button
          onClick={() => setShowRecordEvent(!showRecordEvent)}
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
        >
          + 记录事件
        </button>
      </div>

      {showRecordEvent && (
        <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: '#f9fafb' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>记录新事件</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>事件类型</label>
              <input
                type="text"
                className="input"
                placeholder="例如：video_watch, quiz_complete, page_view"
                value={newEvent.event_type}
                onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>事件数据 (JSON)</label>
              <textarea
                className="input"
                rows={3}
                placeholder='{"duration": 300, "score": 85}'
                value={newEvent.event_data}
                onChange={(e) => setNewEvent({ ...newEvent, event_data: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleRecordEvent} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem' }}>
                确认记录
              </button>
              <button onClick={() => setShowRecordEvent(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem' }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {activeTab === 'timeline' ? (
          <>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>时间线</h2>
            {timeline.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>暂无时间线事件</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {timeline.map((event: TimelineEvent) => (
                  <div key={event.event_id} style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        backgroundColor: '#3b82f6',
                        color: 'white'
                      }}>
                        {event.event_type}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <pre style={{ fontSize: '0.75rem', color: '#4b5563', overflow: 'auto', maxHeight: '100px' }}>
                      {JSON.stringify(event.event_data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>行为事件</h2>
            {behaviorEvents.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>暂无行为事件</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {behaviorEvents.map((event: BehaviorEvent, index: number) => (
                  <div key={index} style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '0.375rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        backgroundColor: '#22c55e',
                        color: 'white'
                      }}>
                        {event.event_type}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <pre style={{ fontSize: '0.75rem', color: '#4b5563', overflow: 'auto', maxHeight: '100px' }}>
                      {JSON.stringify(event.event_data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
