import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiSettingsApi, type ApiSettingInfo, type ModelInfo } from '../api/auth'

const TEXT_EMBEDDING_VERSIONS = [
  { value: 'v1', label: 'text-embedding-v1' },
  { value: 'v2', label: 'text-embedding-v2' },
  { value: 'v3', label: 'text-embedding-v3' },
]

const PROVIDER_INFO: Record<string, {
  name: string
  models: string[]
  description: string
  is_service?: boolean
}> = {
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    description: 'DeepSeek 模型 API',
  },
  qwen: {
    name: '通义千问 (Qwen)',
    models: ['qwen3.5-plus', 'qwen3.6-plus'],
    description: '阿里云通义千问模型 API（DashScope），配置后自动共享给文本嵌入和语音合成',
  },
  bailian: {
    name: '阿里云百炼',
    models: ['qwen3.5-plus', 'qwen3.6-plus'],
    description: '阿里云百炼平台 API（DashScope 兼容），支持 MCP 联网搜索',
  },
  text_embedding: {
    name: '文本嵌入 (Text Embedding)',
    models: TEXT_EMBEDDING_VERSIONS.map(v => v.label),
    description: '阿里云文本嵌入模型 API（DashScope），与通义千问共享 API Key',
  },
  ocr: {
    name: 'OCR',
    models: [],
    description: '文字识别 API',
    is_service: true,
  },
  tts: {
    name: '语音合成 (TTS)',
    models: ['qwen-tts (Cherry 音色)'],
    description: '阿里云 TTS 语音合成（DashScope），可用通义千问 API Key 共享',
  },
  unsplash: {
    name: 'Unsplash 图片搜索',
    models: [],
    description: 'Unsplash 高清图片搜索 API（Access Key）',
    is_service: true,
  },
  tavily: {
    name: 'Tavily 联网搜索',
    models: [],
    description: 'Tavily Search API — 专为 AI 设计的实时联网搜索，返回已清洗的网页内容',
    is_service: true,
  },
}

const SERVICE_ITEMS = [
  { id: 'deepseek', name: 'DeepSeek AI 对话', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
  { id: 'qwen', name: '通义千问 AI 对话', models: ['qwen3.5-plus', 'qwen3.6-plus'] },
  { id: 'bailian', name: '阿里云百炼 AI 对话', models: ['qwen3.5-plus', 'qwen3.6-plus'] },
  { id: 'text_embedding', name: '文本嵌入 (Text Embedding)', models: TEXT_EMBEDDING_VERSIONS.map(v => v.label) },
  { id: 'ocr', name: 'OCR 文字识别', models: [] },
  { id: 'tavily', name: 'Tavily 联网搜索', models: [] },
  { id: 'tts', name: '语音合成 (TTS)', models: ['qwen-tts'] },
  { id: 'unsplash', name: 'Unsplash 图片搜索', models: [] },
]

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export default function ApiSettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<ApiSettingInfo[]>([])
  const [, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [testResult, setTestResult] = useState<Record<string, { testing: boolean; result: 'success' | 'fail' | null; message: string }>>({})
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    api_key: '',
    secret_key: '',
    base_url: '',
    model_version: 'v2',
    is_enabled: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [settingsRes, modelsRes] = await Promise.all([
        apiSettingsApi.getSettings(),
        apiSettingsApi.getModels(),
      ])
      setSettings(settingsRes.data.settings)
      setModels(modelsRes.data.models)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      console.error('API设置加载失败:', err.response?.status, detail || err.message, err)
      setMessage({
        text: detail || '加载失败，请检查后端服务是否正常',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (provider: string) => {
    if (!formData.api_key.trim()) {
      setMessage({ text: 'API Key 不能为空', type: 'error' })
      return
    }
    if (provider === 'ocr' && !formData.secret_key.trim()) {
      setMessage({ text: 'OCR 需要填写 Secret Key', type: 'error' })
      return
    }
    try {
      await apiSettingsApi.saveSetting({
        provider,
        api_key: formData.api_key,
        secret_key: formData.secret_key || undefined,
        base_url: formData.base_url || undefined,
        model_version: provider === 'text_embedding' ? (formData.model_version || undefined) : undefined,
        is_enabled: formData.is_enabled,
      })
      setMessage({ text: '保存成功', type: 'success' })
      setEditingProvider(null)
      setFormData({ api_key: '', secret_key: '', base_url: '', model_version: 'v2', is_enabled: true })
      loadData()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      console.error(`保存API配置(${provider})失败:`, err.response?.status, detail || err.message, err)
      setMessage({
        text: detail || '保存失败',
        type: 'error',
      })
    }
  }

  const handleTest = async (provider: string) => {
    if (!formData.api_key.trim()) {
      setMessage({ text: '请先输入 API Key', type: 'error' })
      return
    }
    setTestResult(prev => ({ ...prev, [provider]: { testing: true, result: null, message: '正在验证...' } }))
    try {
      const res = await apiSettingsApi.validateSetting({
        provider,
        api_key: formData.api_key,
        secret_key: formData.secret_key || undefined,
      })
      if (res.data.is_valid) {
        setTestResult(prev => ({ ...prev, [provider]: { testing: false, result: 'success', message: res.data.message || 'API Key 有效' } }))
      } else {
        setTestResult(prev => ({ ...prev, [provider]: { testing: false, result: 'fail', message: res.data.message || 'API Key 无效，请检查' } }))
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || '验证请求失败'
      setTestResult(prev => ({ ...prev, [provider]: { testing: false, result: 'fail', message: detail } }))
    }
  }

  const handleDelete = async (provider: string) => {
    if (!confirm(`确定要删除 ${PROVIDER_INFO[provider]?.name || provider} 的 API 配置吗？`)) {
      return
    }
    try {
      await apiSettingsApi.deleteSetting(provider)
      setMessage({ text: '删除成功', type: 'success' })
      loadData()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      console.error(`删除API配置(${provider})失败:`, err.response?.status, detail || err.message, err)
      setMessage({
        text: detail || '删除失败',
        type: 'error',
      })
    }
  }

  const startEdit = (provider: string) => {
    const setting = settings.find(s => s.provider === provider)
    setEditingProvider(provider)
    // Pre-fill masked key so user sees the existing value
    setFormData({
      api_key: setting?.api_key_masked || '',
      secret_key: setting?.secret_key_masked || '',
      base_url: '',
      model_version: setting?.model_version || 'v2',
      is_enabled: setting?.is_enabled ?? true,
    })
  }

  const cancelEdit = () => {
    setEditingProvider(null)
    setFormData({ api_key: '', secret_key: '', base_url: '', model_version: 'v2', is_enabled: true })
  }

  const isServiceAvailable = (serviceId: string): boolean | null => {
    const setting = settings.find(s => s.provider === serviceId)
    if (!setting) return null
    if (setting.is_configured && setting.is_enabled) return true
    // text_embedding 和 tts 共享 qwen 的 DashScope API Key
    if ((serviceId === 'text_embedding' || serviceId === 'tts') && !setting.is_configured) {
      const qwenSetting = settings.find(s => s.provider === 'qwen')
      if (qwenSetting?.is_configured && qwenSetting?.is_enabled) return true
    }
    return false
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        color: 'var(--gray-400)',
        fontFamily: 'var(--font-body)',
      }}>
        加载中...
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ padding: 'var(--space-8)', maxWidth: '800px', margin: '0 auto' }}>
      <button
        onClick={() => navigate('/')}
        className="btn btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <ArrowLeftIcon />
        首页
      </button>

      <h1 style={{
        fontSize: '1.5rem',
        marginBottom: 'var(--space-6)',
        fontFamily: 'var(--font-heading)',
        letterSpacing: '-0.02em',
      }}>
        API 设置
      </h1>

      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 'var(--space-6)' }}>
          {message.text}
        </div>
      )}

      {/* Service availability */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{
          fontSize: '1.125rem',
          marginBottom: 'var(--space-2)',
          fontFamily: 'var(--font-heading)',
        }}>
          服务可用性
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: 'var(--space-4)' }}>
          当前已配置各项服务的可用状态
        </p>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {SERVICE_ITEMS.map(service => {
            const available = isServiceAvailable(service.id)
            const statusColor = available === true ? 'var(--success)' : available === false ? 'var(--danger)' : 'var(--gray-300)'
            const bgColor = available === true ? 'var(--success-bg)' : available === false ? 'var(--danger-bg)' : 'var(--gray-50)'
            return (
              <div
                key={service.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-4)',
                  backgroundColor: bgColor,
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid oklch(from ${statusColor} l c h / 0.2)`,
                  transition: 'box-shadow var(--transition-fast)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{service.name}</div>
                  {service.models.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 'var(--space-1)' }}>
                      {service.models.join(', ')}
                    </div>
                  )}
                </div>
                <span className={`badge ${
                  available === true ? 'badge-success' : available === false ? 'badge-danger' : 'badge-neutral'
                }`}>
                  {available === true ? '可用' : available === false ? '不可用' : '未配置'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* API Configuration */}
      <div className="card">
        <h2 style={{
          fontSize: '1.125rem',
          marginBottom: 'var(--space-2)',
          fontFamily: 'var(--font-heading)',
        }}>
          API 配置
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: 'var(--space-6)' }}>
          配置各服务的 API Key。如果不配置，将无法使用对应的服务。
        </p>

        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {Object.entries(PROVIDER_INFO).map(([provider, info]) => {
            const setting = settings.find(s => s.provider === provider)
            const isConfigured = setting?.is_configured
            const isEditing = editingProvider === provider

            return (
              <div
                key={provider}
                style={{
                  padding: 'var(--space-4)',
                  border: '1px solid var(--gray-100)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: isConfigured ? 'var(--gray-50)' : 'white',
                  transition: 'box-shadow var(--transition-fast), border-color var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontWeight: 600, margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.9375rem' }}>
                      {info.name}
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', margin: 'var(--space-1) 0 0 0' }}>
                      {info.description}
                    </p>
                    {info.models.length > 0 && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: 'var(--space-1) 0 0 0' }}>
                        模型: {info.models.join(', ')}
                      </p>
                    )}
                    {isConfigured && setting?.model_version && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: 'var(--space-1) 0 0 0' }}>
                        版本: {setting.model_version}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className={`badge ${isConfigured ? 'badge-success' : 'badge-neutral'}`}>
                      {isConfigured ? '已配置' : '未配置'}
                    </span>
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                    <div>
                      <label htmlFor={`api-key-${provider}`}>API Key *</label>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
                        <input
                          id={`api-key-${provider}`}
                          type={showKeys[provider] ? 'text' : 'password'}
                          className="input"
                          style={{ flex: 1 }}
                          value={formData.api_key}
                          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                          placeholder={setting?.api_key_masked ? '' : '请输入 API Key'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }))}
                          style={{
                            padding: '0 12px',
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--gray-50)',
                            cursor: 'pointer',
                            fontSize: '18px',
                            lineHeight: 1,
                          }}
                          title={showKeys[provider] ? '隐藏 API Key' : '显示 API Key'}
                        >
                          {showKeys[provider] ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </div>
                    {provider === 'ocr' && (
                      <div>
                        <label htmlFor={`secret-key-${provider}`}>Secret Key *</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
                          <input
                            id={`secret-key-${provider}`}
                            type={showKeys[provider + '_secret'] ? 'text' : 'password'}
                            className="input"
                            style={{ flex: 1 }}
                            value={formData.secret_key}
                            onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                            placeholder={setting?.secret_key_masked ? '' : '请输入 Secret Key'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys(prev => ({ ...prev, [provider + '_secret']: !prev[provider + '_secret'] }))}
                            style={{
                              padding: '0 12px',
                              border: '1px solid var(--gray-200)',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--gray-50)',
                              cursor: 'pointer',
                              fontSize: '18px',
                              lineHeight: 1,
                            }}
                            title={showKeys[provider + '_secret'] ? '隐藏 Secret Key' : '显示 Secret Key'}
                          >
                            {showKeys[provider + '_secret'] ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </div>
                    )}
                    {provider === 'text_embedding' && (
                      <div>
                        <label htmlFor={`model-version-${provider}`}>模型版本 *</label>
                        <select
                          id={`model-version-${provider}`}
                          className="input"
                          value={formData.model_version}
                          onChange={(e) => setFormData({ ...formData, model_version: e.target.value })}
                        >
                          {TEXT_EMBEDDING_VERSIONS.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label htmlFor={`base-url-${provider}`}>自定义 Base URL（可选）</label>
                      <input
                        id={`base-url-${provider}`}
                        type="text"
                        className="input"
                        value={formData.base_url}
                        onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                        placeholder="如需使用代理或自定义端点请填写"
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <input
                        type="checkbox"
                        id={`enabled-${provider}`}
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <label htmlFor={`enabled-${provider}`} style={{ marginBottom: 0, cursor: 'pointer' }}>
                        启用此 API
                      </label>
                    </div>
                    {/* 测试结果 */}
                    {testResult[provider]?.result && (
                      <div style={{
                        padding: '8px 12px', borderRadius: 'var(--radius-md)',
                        background: testResult[provider].result === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: testResult[provider].result === 'success' ? 'var(--success)' : 'var(--danger)',
                        fontSize: '0.8125rem', fontWeight: 500,
                      }}>
                        {testResult[provider].result === 'success' ? '✅ ' : '❌ '}
                        {testResult[provider].message}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        onClick={() => handleTest(provider)}
                        disabled={testResult[provider]?.testing}
                        className="btn btn-secondary"
                        style={{
                          background: testResult[provider]?.testing ? 'var(--gray-200)' : undefined,
                          cursor: testResult[provider]?.testing ? 'wait' : 'pointer',
                        }}
                      >
                        {testResult[provider]?.testing ? '测试中...' : '🧪 测试'}
                      </button>
                      <button
                        onClick={() => handleSave(provider)}
                        className="btn btn-primary"
                      >
                        <CheckIcon />
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="btn btn-secondary"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                    <button
                      onClick={() => startEdit(provider)}
                      className="btn btn-primary"
                    >
                      {isConfigured ? '修改' : '配置'}
                    </button>
                    {isConfigured && (
                      <button
                        onClick={() => handleDelete(provider)}
                        className="btn btn-danger"
                      >
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
