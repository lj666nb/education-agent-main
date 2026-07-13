import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { apiSettingsApi, type ApiSettingInfo, type ModelInfo } from '../api/auth'
import './ApiSettingsPage.css'

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

const PROVIDER_GLYPHS: Record<string, string> = {
  deepseek: 'DS',
  qwen: 'QW',
  bailian: 'BL',
  text_embedding: 'EMB',
  ocr: 'OCR',
  tts: 'TTS',
  unsplash: 'IMG',
  tavily: 'WEB',
}

function ProviderGlyph({ provider }: { provider: string }) {
  return <span className="api-provider-glyph" aria-hidden="true">{PROVIDER_GLYPHS[provider] || 'API'}</span>
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
    // 清除该 provider 的测试结果
    if (editingProvider) {
      setTestResult(prev => ({ ...prev, [editingProvider]: { testing: false, result: null, message: '' } }))
    }
  }

  // ─── 自动验证 API Key ───
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doValidate = useCallback(async (provider: string, key: string, secret: string | undefined) => {
    try {
      const res = await apiSettingsApi.validateSetting({
        provider,
        api_key: key,
        secret_key: secret || undefined,
      })
      if (res.data.is_valid) {
        setTestResult(prev => ({ ...prev, [provider]: { testing: false, result: 'success', message: res.data.message || '✅ API Key 有效' } }))
      } else {
        setTestResult(prev => ({ ...prev, [provider]: { testing: false, result: 'fail', message: res.data.message || '❌ API Key 无效，请检查' } }))
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || '验证请求失败'
      setTestResult(prev => ({ ...prev, [provider]: { testing: false, result: 'fail', message: detail } }))
    }
  }, [])

  useEffect(() => {
    if (!editingProvider) return

    // 清除之前的 debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    const key = formData.api_key.trim()
    const secret = formData.secret_key?.trim()

    // 不自动验证 masked key 或太短的 key
    if (!key || key.startsWith('****') || key.length < 8) {
      // 用户开始输入新 key 但还不够长 → 清除旧结果
      if (key && !key.startsWith('****')) {
        setTestResult(prev => ({
          ...prev,
          [editingProvider]: { testing: false, result: null, message: '' },
        }))
      }
      return
    }

    // 显示验证中状态
    setTestResult(prev => ({
      ...prev,
      [editingProvider]: { testing: true, result: null, message: '正在验证...' },
    }))

    // 800ms debounce
    debounceRef.current = setTimeout(() => {
      doValidate(editingProvider, key, secret)
    }, 800)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [formData.api_key, formData.secret_key, editingProvider, doValidate])
  // ─── 自动验证结束 ───

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

  const configuredCount = settings.filter(setting => setting.is_configured).length
  const availableCount = SERVICE_ITEMS.filter(service => isServiceAvailable(service.id) === true).length

  if (isLoading) {
    return (
      <div className="api-settings-loading" role="status">
        <Loader2 size={22} className="api-spin" />
        <span>正在读取服务配置…</span>
      </div>
    )
  }

  return (
    <div className="api-settings-page fade-in">
      <div className="api-settings-shell">
        <header className="api-settings-hero">
          <div className="api-hero-grid" aria-hidden="true" />
          <div className="api-hero-topline">
            <button type="button" onClick={() => navigate('/')} className="api-back-button">
              <ArrowLeft size={17} />
              返回首页
            </button>
            <span className="api-console-label"><Activity size={14} /> SERVICE CONSOLE</span>
          </div>

          <div className="api-hero-content">
            <div className="api-hero-copy">
              <span className="api-eyebrow">AI 能力中枢</span>
              <h1>连接你的智能服务</h1>
              <p>集中管理对话、搜索、识别与内容服务。密钥只用于连接你启用的能力。</p>
            </div>
            <div className="api-hero-status" aria-label={`${availableCount} 项服务可用`}>
              <span className="api-status-orbit"><ShieldCheck size={23} /></span>
              <div>
                <strong>{availableCount}<span> / {SERVICE_ITEMS.length}</span></strong>
                <small>项服务在线</small>
              </div>
            </div>
          </div>

          <div className="api-signal-rail" aria-label="服务连接状态">
            <span className="api-signal-line" aria-hidden="true" />
            {SERVICE_ITEMS.map((service, index) => {
              const available = isServiceAvailable(service.id)
              return (
                <div className="api-signal-node" key={service.id}>
                  <span className={`api-signal-dot ${available === true ? 'is-online' : available === false ? 'is-offline' : ''}`} />
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </div>
              )
            })}
          </div>
        </header>

        {message.text && (
          <div className={`api-page-alert ${message.type === 'success' ? 'is-success' : 'is-error'}`} role="alert">
            {message.type === 'success' ? <Check size={17} /> : <X size={17} />}
            <span>{message.text}</span>
          </div>
        )}

        <section className="api-section api-availability-section" aria-labelledby="availability-title">
          <div className="api-section-heading">
            <div>
              <span className="api-section-kicker">LIVE STATUS</span>
              <h2 id="availability-title">服务可用性</h2>
              <p>状态来自当前保存并启用的真实配置。</p>
            </div>
            <div className="api-configured-summary">
              <KeyRound size={16} />
              <span><strong>{configuredCount}</strong> 项已配置</span>
            </div>
          </div>

          <div className="api-service-grid">
            {SERVICE_ITEMS.map(service => {
              const available = isServiceAvailable(service.id)
              return (
                <article className={`api-service-card ${available === true ? 'is-online' : available === false ? 'is-offline' : 'is-unconfigured'}`} key={service.id}>
                  <div className="api-service-card-top">
                    <ProviderGlyph provider={service.id} />
                    <span className="api-service-state">
                      <span className="api-state-dot" />
                      {available === true ? '可用' : available === false ? '不可用' : '未配置'}
                    </span>
                  </div>
                  <h3>{service.name}</h3>
                  <p>{service.models.length > 0 ? service.models.join(' · ') : '外部能力服务'}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="api-section api-config-section" aria-labelledby="config-title">
          <div className="api-section-heading">
            <div>
              <span className="api-section-kicker">CONNECTIONS</span>
              <h2 id="config-title">API 配置</h2>
              <p>选择服务进行配置、验证或更新；未配置时对应能力保持不可用。</p>
            </div>
          </div>

          <div className="api-provider-grid">
            {Object.entries(PROVIDER_INFO).map(([provider, info]) => {
              const setting = settings.find(s => s.provider === provider)
              const isConfigured = setting?.is_configured
              const isEditing = editingProvider === provider
              const currentTest = testResult[provider]

              return (
                <article className={`api-provider-card ${isConfigured ? 'is-configured' : ''} ${isEditing ? 'is-editing' : ''}`} key={provider}>
                  <div className="api-provider-header">
                    <div className="api-provider-identity">
                      <ProviderGlyph provider={provider} />
                      <div>
                        <h3>{info.name}</h3>
                        <p>{info.description}</p>
                      </div>
                    </div>
                    <span className={`api-config-badge ${isConfigured ? 'is-configured' : ''}`}>
                      <span />{isConfigured ? '已配置' : '未配置'}
                    </span>
                  </div>

                  <div className="api-provider-meta">
                    {info.models.length > 0 && <span>模型 · {info.models.join(' / ')}</span>}
                    {isConfigured && setting?.model_version && <span>版本 · {setting.model_version}</span>}
                  </div>

                  {isEditing ? (
                    <div className="api-edit-panel">
                      <div className="api-form-field">
                        <label htmlFor={`api-key-${provider}`}>API Key <em>必填</em></label>
                        <div className="api-secret-input">
                          <input
                            id={`api-key-${provider}`}
                            type={showKeys[provider] ? 'text' : 'password'}
                            className="input"
                            value={formData.api_key}
                            onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                            placeholder={setting?.api_key_masked ? '' : '请输入 API Key'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }))}
                            className="api-icon-button"
                            title={showKeys[provider] ? '隐藏 API Key' : '显示 API Key'}
                            aria-label={showKeys[provider] ? '隐藏 API Key' : '显示 API Key'}
                          >
                            {showKeys[provider] ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                          {currentTest?.testing && <Loader2 size={17} className="api-validation-icon api-spin" aria-label="正在验证" />}
                          {!currentTest?.testing && currentTest?.result === 'success' && <Check size={17} className="api-validation-icon is-success" aria-label="验证成功" />}
                          {!currentTest?.testing && currentTest?.result === 'fail' && <X size={17} className="api-validation-icon is-error" aria-label="验证失败" />}
                        </div>
                        {currentTest?.result && !currentTest.testing && (
                          <div className={`api-validation-message ${currentTest.result === 'success' ? 'is-success' : 'is-error'}`}>
                            {currentTest.message}
                          </div>
                        )}
                      </div>

                      {provider === 'ocr' && (
                        <div className="api-form-field">
                          <label htmlFor={`secret-key-${provider}`}>Secret Key <em>必填</em></label>
                          <div className="api-secret-input">
                            <input
                              id={`secret-key-${provider}`}
                              type={showKeys[provider + '_secret'] ? 'text' : 'password'}
                              className="input"
                              value={formData.secret_key}
                              onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                              placeholder={setting?.secret_key_masked ? '' : '请输入 Secret Key'}
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeys(prev => ({ ...prev, [provider + '_secret']: !prev[provider + '_secret'] }))}
                              className="api-icon-button"
                              title={showKeys[provider + '_secret'] ? '隐藏 Secret Key' : '显示 Secret Key'}
                              aria-label={showKeys[provider + '_secret'] ? '隐藏 Secret Key' : '显示 Secret Key'}
                            >
                              {showKeys[provider + '_secret'] ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      )}

                      {provider === 'text_embedding' && (
                        <div className="api-form-field">
                          <label htmlFor={`model-version-${provider}`}>模型版本 <em>必填</em></label>
                          <select
                            id={`model-version-${provider}`}
                            className="input"
                            value={formData.model_version}
                            onChange={(e) => setFormData({ ...formData, model_version: e.target.value })}
                          >
                            {TEXT_EMBEDDING_VERSIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="api-form-field">
                        <label htmlFor={`base-url-${provider}`}>自定义 Base URL <small>可选</small></label>
                        <input
                          id={`base-url-${provider}`}
                          type="text"
                          className="input"
                          value={formData.base_url}
                          onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                          placeholder="如需使用代理或自定义端点请填写"
                        />
                      </div>

                      <label className="api-enable-switch" htmlFor={`enabled-${provider}`}>
                        <input
                          type="checkbox"
                          id={`enabled-${provider}`}
                          checked={formData.is_enabled}
                          onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        />
                        <span className="api-switch-track"><span /></span>
                        <span><strong>启用此 API</strong><small>保存后允许系统使用此连接</small></span>
                      </label>

                      {currentTest?.testing && (
                        <div className="api-testing-banner"><Loader2 size={15} className="api-spin" /> 正在验证 API Key…</div>
                      )}

                      <div className="api-edit-actions">
                        <button
                          type="button"
                          onClick={() => handleTest(provider)}
                          disabled={currentTest?.testing}
                          className="api-action-button is-secondary"
                          title="手动重新测试 API Key（输入时已自动验证）"
                        >
                          {currentTest?.testing ? <Loader2 size={16} className="api-spin" /> : <FlaskConical size={16} />}
                          {currentTest?.testing ? '测试中…' : '重新测试'}
                        </button>
                        <button type="button" onClick={() => handleSave(provider)} className="api-action-button is-primary">
                          <Save size={16} /> 保存配置
                        </button>
                        <button type="button" onClick={cancelEdit} className="api-action-button is-ghost">
                          <X size={16} /> 取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="api-provider-actions">
                      <button type="button" onClick={() => startEdit(provider)} className="api-action-button is-primary">
                        <Pencil size={15} /> {isConfigured ? '修改配置' : '开始配置'}
                      </button>
                      {isConfigured && (
                        <button type="button" onClick={() => handleDelete(provider)} className="api-action-button is-danger">
                          <Trash2 size={15} /> 删除
                        </button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
