import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileV2Api } from '../api'
import { useAuthStore } from '../store/auth'
import { ArrowLeftIcon, StarIcon, BarChartIcon, MusicIcon, BookOpenIcon, CodeIcon } from '../components/Icons'

const STYLE_MAP: Record<string, string> = {
  visual: 'visual',
  auditory: 'auditory',
  reading: 'reading_writing',
  kinesthetic: 'kinesthetic',
}

export default function ProfileInitPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    major: '',
    grade: '',
    learningGoal: '',
    selfAssessment: '',
    preferredStyle: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const navigate = useNavigate()
  const { setProfileCompleted } = useAuthStore()

  const handleNext = () => {
    if (step < 5) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError('')
    try {
      const cognitiveStyle = STYLE_MAP[formData.preferredStyle] || 'mixed'
      await profileV2Api.createProfile({
        cognitive_style: cognitiveStyle,
        cognitive_style_confidence: 0.6,
        active_hours: { morning: 0.25, afternoon: 0.25, evening: 0.25, night: 0.25 },
        learning_rhythm_scalar: 0.5,
        learning_rhythm_trend: 0.0,
        metacognitive_calibration: 0.0,
        attention_feature: 0.5,
        knowledge_points: [],
      })
      setProfileCompleted(true)
      navigate('/home', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || '画像初始化失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  if (result?.success) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
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
            color: 'var(--app-text-body)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            zIndex: 1000,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <ArrowLeftIcon size={13} /> 首页
        </button>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ marginBottom: '1rem' }}><StarIcon size={48} color="#F59E0B" /></div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>画像初始化完成！</h1>
          <p style={{ color: 'var(--app-text-secondary)', marginBottom: '2rem' }}>我们已根据您的信息生成了个性化学习画像</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => navigate('/profile/dynamic')} className="btn btn-primary">
              查看动态画像
            </button>
            <button onClick={() => navigate('/profile')} className="btn btn-secondary">
              查看个人中心
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
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
          color: 'var(--app-text-body)',
          cursor: 'pointer',
          fontSize: '0.875rem',
          zIndex: 1000,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        ← 首页
      </button>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--app-text-secondary)' }}>步骤 {step} / 5</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--app-text-secondary)' }}>{Math.round(step / 5 * 100)}%</span>
        </div>
        <div style={{ height: '4px', backgroundColor: 'var(--app-border)', borderRadius: '2px' }}>
          <div style={{ height: '100%', backgroundColor: 'var(--app-info)', width: `${(step / 5) * 100}%`, borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      </div>

      <div className="card">
        {step === 1 && (
          <>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>您的专业背景</h1>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: '1.5rem' }}>请告诉我们您的专业和年级</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>专业</label>
              <input
                type="text"
                className="input"
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                placeholder="例如：计算机科学与技术"
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>年级</label>
              <select
                className="input"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              >
                <option value="">请选择</option>
                <option value="大一">大一</option>
                <option value="大二">大二</option>
                <option value="大三">大三</option>
                <option value="大四">大四</option>
                <option value="研一">研一</option>
                <option value="研二">研二</option>
                <option value="研三">研三</option>
              </select>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>学习目标</h1>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: '1.5rem' }}>您希望通过这个系统达成什么目标？</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>学习目标描述</label>
              <textarea
                className="input"
                rows={4}
                value={formData.learningGoal}
                onChange={(e) => setFormData({ ...formData, learningGoal: e.target.value })}
                placeholder="例如：系统学习机器学习知识，准备考研/就业..."
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>自我评估</h1>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: '1.5rem' }}>请评估您在相关领域的基础水平</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>自我评估</label>
              <textarea
                className="input"
                rows={4}
                value={formData.selfAssessment}
                onChange={(e) => setFormData({ ...formData, selfAssessment: e.target.value })}
                placeholder="例如：有一定的Python基础，了解机器学习基本概念..."
              />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>学习风格</h1>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: '1.5rem' }}>您更喜欢哪种学习方式？</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                { value: 'visual', label: <><BarChartIcon size={16} /> 视觉型</>, desc: '喜欢图表、流程图、思维导图' },
                { value: 'auditory', label: <><MusicIcon size={16} /> 听觉型</>, desc: '喜欢听讲解、视频教程' },
                { value: 'reading', label: <><BookOpenIcon size={16} /> 阅读型</>, desc: '喜欢看文档、书籍' },
                { value: 'kinesthetic', label: <><CodeIcon size={16} /> 实践型</>, desc: '喜欢动手操作、敲代码' },
              ].map(option => (
                <div
                  key={option.value}
                  onClick={() => setFormData({ ...formData, preferredStyle: option.value })}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${formData.preferredStyle === option.value ? 'var(--app-info)' : 'var(--app-border)'}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    backgroundColor: formData.preferredStyle === option.value ? '#eff6ff' : 'white'
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{option.label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--app-text-secondary)' }}>{option.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>确认信息</h1>
            <p style={{ color: 'var(--app-text-secondary)', marginBottom: '1.5rem' }}>请确认您的信息，我们将基于此构建学习画像</p>

            {error && (
              <div style={{ backgroundColor: 'var(--app-bg-danger)', color: 'var(--app-danger-dark)', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: 'var(--app-text-secondary)' }}>专业</span>
                <span style={{ fontWeight: '500' }}>{formData.major || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: 'var(--app-text-secondary)' }}>年级</span>
                <span style={{ fontWeight: '500' }}>{formData.grade || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: 'var(--app-text-secondary)' }}>学习目标</span>
                <span style={{ fontWeight: '500', maxWidth: '300px', wordBreak: 'break-word', textAlign: 'right' }}>{formData.learningGoal || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ color: 'var(--app-text-secondary)' }}>学习风格</span>
                <span style={{ fontWeight: '500' }}>{formData.preferredStyle}</span>
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
          <button onClick={handleBack} className="btn btn-secondary" disabled={step === 1}>
            上一步
          </button>
          {step < 5 ? (
            <button onClick={handleNext} className="btn btn-primary">
              下一步
            </button>
          ) : (
            <button onClick={handleSubmit} className="btn btn-primary" disabled={isLoading}>
              {isLoading ? '提交中...' : '完成初始化'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
