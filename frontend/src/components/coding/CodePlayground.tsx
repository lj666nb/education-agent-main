import { useState, useEffect, useCallback } from 'react'
import CodeEditor from '../CodeEditor'
import VisualizationCanvas from './VisualizationCanvas'
import StepController from './StepController'
import type { AnalyzeStep, CodingProblemResponse } from '../../api/coding'
import { codingApi } from '../../api/coding'

interface Props {
  problem: CodingProblemResponse | null
}

const LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
]

const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛',
}

export default function CodePlayground({ problem }: Props) {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('python')
  const [analyzing, setAnalyzing] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [steps, setSteps] = useState<AnalyzeStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setInterval> | null>(null)
  const [completed, setCompleted] = useState(false)

  // 切换题目时重置
  useEffect(() => {
    if (problem) {
      const template = problem.content?.code_template?.[language] || problem.content?.code_template?.python || ''
      setCode(template || problem.user_last_code || '# 在此编写代码\n')
      setSteps([])
      setCurrentStep(0)
      setStatusMsg('')
      setCompleted(false)
    }
  }, [problem?.id])

  // 切换语言时更新模板
  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    if (problem && steps.length === 0) {
      const template = problem.content?.code_template?.[lang] || ''
      if (template && code === (problem.content?.code_template?.[language] || '')) {
        setCode(template)
      }
    }
  }

  const handleAnalyze = useCallback(() => {
    if (!problem || !code.trim()) return
    setAnalyzing(true)
    setSteps([])
    setCurrentStep(0)
    setCompleted(false)
    setStatusMsg('正在分析代码结构...')

    codingApi.analyzeCode(
      { problem_id: problem.id, code, language },
      {
        onStatus: (msg) => setStatusMsg(msg),
        onStep: (step) => {
          setSteps(prev => {
            const updated = [...prev, step]
            setCurrentStep(updated.length)
            return updated
          })
        },
        onComplete: (_result, summary) => {
          setStatusMsg(summary || '分析完成')
          setAnalyzing(false)
          setCompleted(true)
        },
        onError: (msg) => {
          setStatusMsg('分析失败: ' + msg)
          setAnalyzing(false)
        },
      },
    )
  }, [problem, code, language])

  const currentData = steps.length > 0 && currentStep > 0
    ? steps[currentStep - 1]
    : null

  const handlePrev = () => setCurrentStep(p => Math.max(1, p - 1))
  const handleNext = () => setCurrentStep(p => Math.min(steps.length, p + 1))

  const handleAutoPlay = () => {
    if (isAutoPlaying) {
      if (autoTimer) clearInterval(autoTimer)
      setIsAutoPlaying(false)
      return
    }
    setIsAutoPlaying(true)
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length) {
          clearInterval(timer)
          setIsAutoPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1000)
    setAutoTimer(timer)
  }

  if (!problem) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--app-text-secondary)', fontSize: 14,
      }}>
        请从左侧目录选择一道编程题
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* 题目描述 */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{problem.content?.stem || problem.title}</span>
          <span style={{
            fontSize: 11, padding: '1px 6px', borderRadius: 4,
            background: 'var(--app-bg-active)', color: 'var(--app-text-secondary)',
          }}>
            {DIFF_LABELS[problem.difficulty] || problem.difficulty}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--app-text-secondary)', lineHeight: 1.6, maxHeight: 90, overflow: 'auto' }}>
          {problem.content?.description?.slice(0, 500)}
        </div>
        {(problem.content?.sample_input || problem.content?.sample_output) && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--app-text-secondary)' }}>
            {problem.content.sample_input && (
              <span>输入样例: <code style={{ background: 'var(--app-bg-page)', padding: '1px 4px', borderRadius: 3 }}>{problem.content.sample_input}</code></span>
            )}
            {problem.content.sample_output && (
              <span style={{ marginLeft: 16 }}>输出样例: <code style={{ background: 'var(--app-bg-page)', padding: '1px 4px', borderRadius: 3 }}>{problem.content.sample_output}</code></span>
            )}
          </div>
        )}
      </div>

      {/* 语言选择 + 运行按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <select value={language} onChange={e => handleLanguageChange(e.target.value)}
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid var(--app-border)',
            background: 'var(--app-bg-card)', color: 'var(--app-text)', fontSize: 13,
          }}>
          {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <button onClick={handleAnalyze} disabled={analyzing || !code.trim()}
          style={{
            padding: '5px 16px', borderRadius: 6, border: 'none',
            background: analyzing ? 'var(--app-border)' : 'var(--app-primary)',
            color: '#fff', cursor: analyzing ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 500,
          }}>
          {analyzing ? '分析中...' : '运行分析'}
        </button>
        {completed && (
          <button onClick={() => {
            codingApi.submitResult({
              problem_id: problem.id, code, language, is_correct: true,
            })
            setStatusMsg('已提交')
          }}
          style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid var(--app-success)',
            background: 'transparent', color: 'var(--app-success)',
            cursor: 'pointer', fontSize: 13,
          }}>
            标记完成
          </button>
        )}
        {statusMsg && (
          <span style={{
            fontSize: 12, color: statusMsg.includes('失败') ? 'var(--app-danger)' : 'var(--app-text-secondary)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {statusMsg}
          </span>
        )}
      </div>

      {/* 编辑器 + 可视化 */}
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, borderRadius: 8, overflow: 'hidden' }}>
          <CodeEditor code={code} language={language} onChange={setCode} height="100%" />
        </div>
        <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto' }}>
          {currentData && Object.keys(currentData.variables || {}).length > 0 && (
            <div style={{
              background: 'var(--app-bg-card)', borderRadius: 6, padding: 8,
              fontSize: 12, maxHeight: 80, overflow: 'auto',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: 'var(--app-text-secondary)' }}>变量状态</div>
              {Object.entries(currentData.variables || {}).map(([k, v]) => (
                <div key={k} style={{ fontFamily: 'monospace' }}>
                  <span style={{ color: 'var(--app-primary)' }}>{k}</span> = {JSON.stringify(v)}
                </div>
              ))}
            </div>
          )}
          <VisualizationCanvas
            dataStructure={currentData?.data_structure || null}
            width={400}
            height={220}
          />
          {currentData && (
            <div style={{
              fontSize: 12, color: 'var(--app-text-secondary)', padding: '4px 8px',
              lineHeight: 1.5, background: 'var(--app-bg-card)', borderRadius: 6,
            }}>
              <span style={{ fontWeight: 500, color: 'var(--app-text)' }}>步骤 {currentData.step}: </span>
              {currentData.explanation}
            </div>
          )}
        </div>
      </div>

      {/* 步骤控制 */}
      <StepController
        currentStep={currentStep}
        totalSteps={steps.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onAutoPlay={handleAutoPlay}
        isAutoPlaying={isAutoPlaying}
        disabled={analyzing}
      />
    </div>
  )
}
