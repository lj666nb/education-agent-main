import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  History,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Save,
  Send,
  Terminal,
  XCircle,
} from 'lucide-react'
import CodeEditor from '../CodeEditor'
import VisualizationCanvas from './VisualizationCanvas'
import type {
  AnalyzeStep,
  CodingProblemResponse,
  CodingSolutionResponse,
  ExplainResponse,
  JudgeCaseResult,
  JudgeResponse,
  ProblemExample,
  ProblemHint,
  PublicTestCase,
  SubmissionDetailResponse,
  SubmissionHistoryItem,
} from '../../api/coding'
import { codingApi } from '../../api/coding'
import './CodePlayground.css'

interface Props {
  problem: CodingProblemResponse | null
  onBack?: () => void
}

type LeftTab = 'description' | 'hints' | 'submissions' | 'solution'
type ResultTab = 'results' | 'trace' | 'explain'
type MobilePane = 'problem' | 'code'
type SaveState = 'saved' | 'saving' | 'unsaved'

const DIFFICULTY_LABELS: Record<string, string> = {
  basic: '简单',
  intermediate: '中等',
  advanced: '困难',
}

const VERDICT_LABELS: Record<string, string> = {
  accepted: '通过',
  wrong_answer: '答案错误',
  compile_error: '编译错误',
  runtime_error: '运行错误',
  time_limit: '超出时间限制',
}

const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python 3',
  cpp: 'C++',
  java: 'Java',
}

const LEFT_TABS: Array<{ id: LeftTab; label: string; icon: typeof FileText }> = [
  { id: 'description', label: '题目', icon: FileText },
  { id: 'hints', label: '分级提示', icon: Lightbulb },
  { id: 'submissions', label: '提交记录', icon: History },
  { id: 'solution', label: '参考解法', icon: BookOpen },
]

function draftKey(problemId: string, language: string) {
  return `coding_draft:${problemId}:${language}`
}

function getTemplate(problem: CodingProblemResponse, language: string) {
  const template = problem.content.code_template
  if (typeof template === 'string') return template
  if (!template) return ''
  if (template[language]) return template[language]
  // Default C++ template for stdin/stdout problems
  if (language === 'cpp') {
    return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // TODO: 在此实现算法逻辑\n\n    return 0;\n}\n'
  }
  return template.python || Object.values(template)[0] || ''
}

function getSourceLabel(problem: CodingProblemResponse) {
  const platform = problem.content.source_platform || '原题'
  const number = problem.content.source_problem_id
  return number ? `${platform} · ${number}` : platform
}

function getExamples(problem: CodingProblemResponse): ProblemExample[] {
  if (Array.isArray(problem.content.examples) && problem.content.examples.length > 0) {
    return problem.content.examples
  }
  if (problem.content.sample_input || problem.content.sample_output) {
    return [{
      input: String(problem.content.sample_input || ''),
      output: String(problem.content.sample_output || ''),
    }]
  }
  return []
}

function getHints(problem: CodingProblemResponse): ProblemHint[] {
  if (!Array.isArray(problem.content.hints)) return []
  return problem.content.hints.map((hint, index) => (
    typeof hint === 'string'
      ? { level: index + 1, title: `提示 ${index + 1}`, content: hint }
      : { level: hint.level || index + 1, title: hint.title || `提示 ${index + 1}`, content: hint.content }
  ))
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatRuntime(seconds: number) {
  if (!Number.isFinite(seconds)) return '—'
  return seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`
}

function apiErrorMessage(error: unknown, fallback: string) {
  const candidate = error as {
    message?: string
    response?: { data?: { detail?: string } | string }
  }
  const data = candidate?.response?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object' && typeof data.detail === 'string') return data.detail
  return candidate?.message || fallback
}

export default function CodePlayground({ problem, onBack }: Props) {
  const [language, setLanguage] = useState('python')
  const [editor, setEditor] = useState({ owner: '', code: '' })
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [leftTab, setLeftTab] = useState<LeftTab>('description')
  const [resultTab, setResultTab] = useState<ResultTab>('results')
  const [mobilePane, setMobilePane] = useState<MobilePane>('problem')
  const [revealedHints, setRevealedHints] = useState(0)
  const [judgeResult, setJudgeResult] = useState<JudgeResponse | null>(null)
  const [judgeError, setJudgeError] = useState('')
  const [busyAction, setBusyAction] = useState<'run' | 'submit' | null>(null)
  const [notice, setNotice] = useState('')
  const [submissions, setSubmissions] = useState<SubmissionHistoryItem[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionsError, setSubmissionsError] = useState('')
  const [attemptCount, setAttemptCount] = useState(0)
  const [solution, setSolution] = useState<CodingSolutionResponse | null>(null)
  const [solutionLoading, setSolutionLoading] = useState(false)
  const [solutionError, setSolutionError] = useState('')
  const [traceIndex, setTraceIndex] = useState(0)
  const [autoPlaying, setAutoPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Listen for browser fullscreen change (e.g. user presses Esc)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [])
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainResult, setExplainResult] = useState<ExplainResponse | null>(null)
  const [explainError, setExplainError] = useState('')
  const [submissionPage, setSubmissionPage] = useState(1)
  const [submissionHasMore, setSubmissionHasMore] = useState(false)
  const autoPlayTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const supportedLanguages = useMemo(() => {
    const configured = problem?.content.supported_languages
    const base = Array.isArray(configured) && configured.length > 0 ? configured : ['python']
    // Always ensure C++ is available
    if (!base.includes('cpp')) {
      return [...base, 'cpp']
    }
    return base
  }, [problem])

  const examples = useMemo(() => problem ? getExamples(problem) : [], [problem])
  const hints = useMemo(() => problem ? getHints(problem) : [], [problem])
  const traceSteps = judgeResult?.trace || []
  const currentTrace = traceSteps[traceIndex] || null
  const currentOwner = problem ? draftKey(problem.id, language) : ''
  const code = editor.code

  const stopAutoPlay = useCallback(() => {
    if (autoPlayTimer.current) clearInterval(autoPlayTimer.current)
    autoPlayTimer.current = null
    setAutoPlaying(false)
  }, [])

  const loadSubmissions = useCallback(async (problemId: string, page = 1) => {
    setSubmissionsLoading(true)
    setSubmissionsError('')
    try {
      const response = await codingApi.getSubmissions(problemId, page, 20)
      const items = response.data || []
      if (page === 1) {
        setSubmissions(items)
      } else {
        setSubmissions(prev => [...prev, ...items])
      }
      setSubmissionPage(page)
      setSubmissionHasMore(items.length === 20)
    } catch (error) {
      setSubmissionsError(apiErrorMessage(error, '提交记录加载失败，请稍后重试'))
    } finally {
      setSubmissionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!problem) return
    const initialLanguage = supportedLanguages.includes('python') ? 'python' : supportedLanguages[0]
    const owner = draftKey(problem.id, initialLanguage)
    const savedDraft = localStorage.getItem(owner)
    const initialCode = savedDraft ?? problem.user_last_code ?? getTemplate(problem, initialLanguage)

    stopAutoPlay()
    setLanguage(initialLanguage)
    setEditor({ owner, code: initialCode })
    setSaveState('saved')
    setLeftTab('description')
    setResultTab('results')
    setMobilePane('problem')
    setRevealedHints(0)
    setJudgeResult(null)
    setJudgeError('')
    setNotice('')
    setAttemptCount(problem.attempt_count || 0)
    setSolution(null)
    setSolutionError('')
    setSubmissionsError('')
    setExplainResult(null)
    setExplainError('')
    setTraceIndex(0)
    void loadSubmissions(problem.id)
  }, [problem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!problem || editor.owner !== currentOwner) return
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      localStorage.setItem(currentOwner, editor.code)
      setSaveState('saved')
    }, 550)
    return () => window.clearTimeout(timer)
  }, [currentOwner, editor, problem])

  useEffect(() => () => stopAutoPlay(), [stopAutoPlay])

  useEffect(() => {
    if (!autoPlaying || traceSteps.length === 0) return
    autoPlayTimer.current = setInterval(() => {
      setTraceIndex(previous => {
        if (previous >= traceSteps.length - 1) {
          stopAutoPlay()
          return previous
        }
        return previous + 1
      })
    }, 900)
    return () => {
      if (autoPlayTimer.current) clearInterval(autoPlayTimer.current)
      autoPlayTimer.current = null
    }
  }, [autoPlaying, stopAutoPlay, traceSteps.length])

  const invalidateRun = useCallback(() => {
    stopAutoPlay()
    setJudgeResult(null)
    setJudgeError('')
    setTraceIndex(0)
    setNotice('代码已修改，请重新运行公开测试')
  }, [stopAutoPlay])

  const handleCodeChange = (value: string) => {
    setEditor(previous => ({ ...previous, code: value }))
    setSaveState('unsaved')
    invalidateRun()
  }

  const saveDraftNow = useCallback(() => {
    if (!problem || editor.owner !== currentOwner) return
    localStorage.setItem(currentOwner, editor.code)
    setSaveState('saved')
    setNotice('草稿已保存在当前浏览器')
  }, [currentOwner, editor, problem])

  const handleLanguageChange = (nextLanguage: string) => {
    if (!problem || nextLanguage === language) return
    if (editor.owner === currentOwner) localStorage.setItem(currentOwner, editor.code)
    const owner = draftKey(problem.id, nextLanguage)
    const nextCode = localStorage.getItem(owner) ?? getTemplate(problem, nextLanguage)
    setLanguage(nextLanguage)
    setEditor({ owner, code: nextCode })
    setSaveState('saved')
    invalidateRun()
  }

  const resetTemplate = () => {
    if (!problem) return
    const template = getTemplate(problem, language)
    setEditor({ owner: currentOwner, code: template })
    setSaveState('unsaved')
    invalidateRun()
    setNotice('已恢复题目提供的 TODO 模板')
  }

  const handleExplain = useCallback(async () => {
    if (!problem || explainLoading) return
    setExplainLoading(true)
    setExplainError('')
    setExplainResult(null)
    setResultTab('explain')
    setMobilePane('code')
    try {
      const response = await codingApi.explainProblem(problem.id, {
        problem_id: problem.id,
        code: editor.code,
        language,
      })
      setExplainResult(response.data)
      setNotice('AI 解答已生成')
    } catch (error) {
      setExplainError(apiErrorMessage(error, 'AI 解答失败，请稍后重试'))
      setNotice('')
    } finally {
      setExplainLoading(false)
    }
  }, [editor.code, explainLoading, language, problem])

  const handleRun = useCallback(async () => {
    if (!problem || busyAction || !code.trim()) return
    setBusyAction('run')
    setJudgeError('')
    setNotice('正在运行公开测试，并记录第一组用例的真实执行轨迹…')
    setResultTab('results')
    setMobilePane('code')
    stopAutoPlay()
    try {
      const response = await codingApi.runProblem(problem.id, { code, language, trace: true })
      setJudgeResult(response.data)
      setTraceIndex(0)
      setNotice(response.data.all_passed
        ? `公开测试全部通过（${response.data.passed_cases}/${response.data.total_cases}）`
        : `公开测试通过 ${response.data.passed_cases}/${response.data.total_cases}，请根据实际与预期输出继续修改`)
    } catch (error) {
      setJudgeResult(null)
      setJudgeError(apiErrorMessage(error, '运行失败，请稍后重试'))
      setNotice('')
    } finally {
      setBusyAction(null)
    }
  }, [busyAction, code, language, problem, stopAutoPlay])

  const handleSubmit = useCallback(async () => {
    if (!problem || busyAction || !code.trim()) return
    setBusyAction('submit')
    setJudgeError('')
    setNotice('正在由服务端运行公开与隐藏测试…')
    setResultTab('results')
    setMobilePane('code')
    stopAutoPlay()
    try {
      const response = await codingApi.submitProblem(problem.id, { code, language, trace: false })
      setJudgeResult(response.data)
      setAttemptCount(previous => previous + 1)
      setNotice(response.data.all_passed
        ? `提交通过，全部 ${response.data.total_cases} 组测试均已通过`
        : `提交未通过：${VERDICT_LABELS[response.data.verdict] || response.data.verdict}（${response.data.passed_cases}/${response.data.total_cases}）`)
      await loadSubmissions(problem.id)
    } catch (error) {
      setJudgeResult(null)
      setJudgeError(apiErrorMessage(error, '提交失败，请稍后重试'))
      setNotice('')
    } finally {
      setBusyAction(null)
    }
  }, [busyAction, code, language, loadSubmissions, problem, stopAutoPlay])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveDraftNow()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (event.shiftKey) void handleSubmit()
        else void handleRun()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [handleRun, handleSubmit, saveDraftNow])

  const loadSolution = useCallback(async () => {
    if (!problem || attemptCount === 0 || solutionLoading || solution) return
    setSolutionLoading(true)
    setSolutionError('')
    try {
      const response = await codingApi.getSolution(problem.id)
      setSolution(response.data)
    } catch (error) {
      setSolutionError(apiErrorMessage(error, '参考解法加载失败，请稍后重试'))
    } finally {
      setSolutionLoading(false)
    }
  }, [attemptCount, problem, solution, solutionLoading])

  useEffect(() => {
    if (leftTab === 'solution' && attemptCount > 0) void loadSolution()
  }, [attemptCount, leftTab, loadSolution])

  if (!problem) {
    return <div className="oj-empty-page">请先从题目目录选择一道代码题</div>
  }

  const sourceUrl = problem.content.source_url
  const suggestedMinutes = problem.answer.suggested_time_seconds
    ? Math.ceil(problem.answer.suggested_time_seconds / 60)
    : null

  const workspace = (
    <main
      className={`oj-workspace${isFullscreen ? ' oj-workspace--fullscreen' : ''}`}
      data-testid="coding-problem-workspace"
      data-mobile-pane={mobilePane}
    >
      <header className="oj-topbar">
        <div className="oj-topbar__identity">
          <button className="oj-icon-button oj-back-button" type="button" onClick={onBack} title="返回题目目录">
            <ArrowLeft size={18} />
          </button>
          <div className="oj-topbar__title-wrap">
            <div className="oj-topbar__title">{problem.title}</div>
            <div className="oj-topbar__meta">
              <span className={`oj-difficulty oj-difficulty--${problem.difficulty}`}>
                {DIFFICULTY_LABELS[problem.difficulty] || problem.difficulty}
              </span>
              <span>{getSourceLabel(problem)}</span>
              {suggestedMinutes && <span>建议 {suggestedMinutes} 分钟</span>}
            </div>
          </div>
        </div>

        <div className="oj-topbar__actions">
          <div className="oj-mobile-switch" role="group" aria-label="移动端面板切换">
            <button type="button" className={mobilePane === 'problem' ? 'is-active' : ''} onClick={() => setMobilePane('problem')}>题目</button>
            <button type="button" className={mobilePane === 'code' ? 'is-active' : ''} onClick={() => setMobilePane('code')}>代码</button>
          </div>
          {sourceUrl && (
            <a className="oj-source-link" href={sourceUrl} target="_blank" rel="noreferrer">
              查看原题 <ExternalLink size={14} />
            </a>
          )}
        </div>
      </header>

      <div className="oj-workspace__body">
        <section className="oj-problem-pane" aria-label="题目区">
          <nav className="oj-left-tabs" aria-label="题目信息">
            {LEFT_TABS.map(tab => {
              const Icon = tab.icon
              const locked = tab.id === 'solution' && attemptCount === 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={leftTab === tab.id ? 'is-active' : ''}
                  onClick={() => setLeftTab(tab.id)}
                  aria-selected={leftTab === tab.id}
                >
                  {locked ? <LockKeyhole size={14} /> : <Icon size={15} />}
                  {tab.label}
                  {tab.id === 'submissions' && submissions.length > 0 && <span className="oj-tab-count">{submissions.length}</span>}
                </button>
              )
            })}
          </nav>

          <div className="oj-left-content">
            {leftTab === 'description' && (
              <ProblemDescription problem={problem} examples={examples} />
            )}

            {leftTab === 'hints' && (
              <HintsPanel hints={hints} revealed={revealedHints} onReveal={() => setRevealedHints(value => Math.min(hints.length, value + 1))} />
            )}

            {leftTab === 'submissions' && (
              <SubmissionsPanel
                submissions={submissions}
                loading={submissionsLoading}
                error={submissionsError}
                hasMore={submissionHasMore}
                onLoadMore={() => void loadSubmissions(problem.id, submissionPage + 1)}
                problemId={problem.id}
              />
            )}

            {leftTab === 'solution' && (
              <SolutionPanel
                attemptCount={attemptCount}
                loading={solutionLoading}
                solution={solution}
                error={solutionError}
                language={language}
                onLoad={() => void loadSolution()}
                onGoCode={() => setMobilePane('code')}
              />
            )}
          </div>
        </section>

        <section className="oj-code-pane" aria-label="代码编辑与判题区">
          <div className="oj-editor-toolbar">
            <div className="oj-editor-toolbar__left">
              <Code2 size={16} />
              <select
                className="oj-language-select"
                value={language}
                onChange={event => handleLanguageChange(event.target.value)}
                aria-label="编程语言"
              >
                {supportedLanguages.map(item => <option key={item} value={item}>{LANGUAGE_LABELS[item] || item}</option>)}
              </select>
              <span className={`oj-save-state oj-save-state--${saveState}`} title="草稿仅保存在当前浏览器">
                {saveState === 'saved' ? <Check size={13} /> : saveState === 'saving' ? <LoaderCircle className="oj-spin" size={13} /> : <Save size={13} />}
                {saveState === 'saved' ? '已自动保存' : saveState === 'saving' ? '保存中' : '未保存'}
              </span>
            </div>

            <div className="oj-editor-toolbar__actions">
              <button className="oj-dark-icon-button" type="button" onClick={resetTemplate} title="恢复 TODO 模板">
                <RotateCcw size={15} />
              </button>
              <button
                className="oj-dark-icon-button"
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? '退出全屏' : '全屏放大'}
                data-testid="coding-fullscreen-toggle"
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                className="oj-action-button oj-action-button--explain"
                type="button"
                onClick={() => void handleExplain()}
                disabled={explainLoading}
                data-testid="coding-explain-ai"
                title="AI 解答"
              >
                {explainLoading ? <LoaderCircle className="oj-spin" size={15} /> : <Bot size={15} />}
                <span>AI解答</span>
              </button>
              <button
                className="oj-action-button oj-action-button--run"
                type="button"
                onClick={() => void handleRun()}
                disabled={Boolean(busyAction) || !code.trim()}
                data-testid="coding-run-tests"
                title="Ctrl + Enter"
              >
                {busyAction === 'run' ? <LoaderCircle className="oj-spin" size={15} /> : <Play size={15} />}
                <span>运行公开测试</span>
              </button>
              <button
                className="oj-action-button oj-action-button--submit"
                type="button"
                onClick={() => void handleSubmit()}
                disabled={Boolean(busyAction) || !code.trim()}
                data-testid="coding-submit-code"
                title="Ctrl + Shift + Enter"
              >
                {busyAction === 'submit' ? <LoaderCircle className="oj-spin" size={15} /> : <Send size={15} />}
                <span>提交隐藏测试</span>
              </button>
            </div>
          </div>

          <div className="oj-editor" data-testid="coding-editor-area">
            <CodeEditor code={code} language={language} onChange={handleCodeChange} height="100%" />
          </div>

          <section className="oj-result-panel" data-testid="coding-test-result">
            <div className="oj-result-tabs">
              <button type="button" className={resultTab === 'results' ? 'is-active' : ''} onClick={() => setResultTab('results')}>
                <Terminal size={15} /> 运行结果
                {judgeResult && <span className={judgeResult.all_passed ? 'is-passed' : 'is-failed'}>{judgeResult.passed_cases}/{judgeResult.total_cases}</span>}
              </button>
              <button type="button" className={resultTab === 'trace' ? 'is-active' : ''} onClick={() => setResultTab('trace')}>
                <ChevronRight size={15} /> 真实执行轨迹
                {traceSteps.length > 0 && <span>{traceSteps.length}</span>}
              </button>
              <button type="button" className={resultTab === 'explain' ? 'is-active' : ''} onClick={() => setResultTab('explain')}>
                <Bot size={15} /> AI解答
              </button>
              <div className="oj-result-tabs__notice" title={notice}>{notice}</div>
            </div>

            <div className="oj-result-content">
              {resultTab === 'results' ? (
                <JudgeResultPanel result={judgeResult} error={judgeError} busy={busyAction} publicCases={problem.public_cases} />
              ) : resultTab === 'trace' ? (
                <TracePanel
                  steps={traceSteps}
                  currentIndex={traceIndex}
                  current={currentTrace}
                  autoPlaying={autoPlaying}
                  onPrevious={() => setTraceIndex(value => Math.max(0, value - 1))}
                  onNext={() => setTraceIndex(value => Math.min(traceSteps.length - 1, value + 1))}
                  onToggleAuto={() => autoPlaying ? stopAutoPlay() : setAutoPlaying(true)}
                />
              ) : (
                <ExplainPanel
                  loading={explainLoading}
                  result={explainResult}
                  error={explainError}
                  onRetry={() => void handleExplain()}
                />
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  )

  return workspace
}

function ProblemDescription({ problem, examples }: { problem: CodingProblemResponse; examples: ProblemExample[] }) {
  const objectives = problem.content.learning_objectives || []
  const steps = problem.content.task_steps || []
  const constraints = problem.content.constraints || []
  const edgeCases = problem.content.edge_cases || []

  return (
    <article className="oj-article">
      <div className="oj-article__heading">
        <div>
          <div className="oj-eyebrow">{getSourceLabel(problem)}</div>
          <h1>{problem.content.stem || problem.title}</h1>
        </div>
        <span className={`oj-difficulty oj-difficulty--${problem.difficulty}`}>
          {DIFFICULTY_LABELS[problem.difficulty] || problem.difficulty}
        </span>
      </div>

      {objectives.length > 0 && (
        <section className="oj-goal-card">
          <div className="oj-section-title"><CheckCircle2 size={17} /> 做完这题，你应该能</div>
          <ul>{objectives.map(item => <li key={item}>{item}</li>)}</ul>
        </section>
      )}

      <section className="oj-section">
        <h2>题目说明</h2>
        <p className="oj-prose">{problem.content.description || '暂无题目说明'}</p>
      </section>

      {steps.length > 0 && (
        <section className="oj-section">
          <h2>建议拆解</h2>
          <ol className="oj-step-list">
            {steps.map((item, index) => (
              <li key={item}><span>{index + 1}</span><p>{item}</p></li>
            ))}
          </ol>
        </section>
      )}

      <section className="oj-format-grid">
        <InfoCard title="输入格式" value={problem.content.input_format || '无'} />
        <InfoCard title="输出格式" value={problem.content.output_format || '无'} />
      </section>

      {examples.length > 0 && (
        <section className="oj-section">
          <h2>公开样例</h2>
          <div className="oj-examples">
            {examples.map((example, index) => (
              <div className="oj-example-card" key={`${example.input}-${index}`}>
                <div className="oj-example-card__title">样例 {index + 1}</div>
                <div className="oj-example-grid">
                  <CodeValue label="输入" value={example.input} />
                  <CodeValue label="输出" value={example.output} />
                </div>
                {example.explanation && <p>{example.explanation}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(constraints.length > 0 || edgeCases.length > 0) && (
        <section className="oj-format-grid">
          {constraints.length > 0 && <ListCard title="数据范围" items={constraints} />}
          {edgeCases.length > 0 && <ListCard title="边界检查" items={edgeCases} />}
        </section>
      )}

      <div className="oj-interface-note">
        <Terminal size={16} />
        <div>
          <strong>本题采用标准输入 / 标准输出</strong>
          <span>请保留模板中的 solve 入口。点击“运行公开测试”查看实际输出，提交时会额外运行隐藏边界测试。</span>
        </div>
      </div>
    </article>
  )
}

function HintsPanel({ hints, revealed, onReveal }: { hints: ProblemHint[]; revealed: number; onReveal: () => void }) {
  if (hints.length === 0) {
    return <EmptyState icon={<Lightbulb size={26} />} title="这道题暂未配置提示" detail="先从输入、输出和边界条件开始拆解。" />
  }
  return (
    <article className="oj-panel-article">
      <div className="oj-panel-heading">
        <div>
          <div className="oj-eyebrow">卡住时再看</div>
          <h2>三级渐进提示</h2>
          <p>每次只解锁一层，尽量保留独立思考空间。</p>
        </div>
        <span>{revealed}/{hints.length}</span>
      </div>
      <div className="oj-hints">
        {hints.map((hint, index) => {
          const unlocked = index < revealed
          return (
            <section className={`oj-hint-card${unlocked ? ' is-unlocked' : ''}`} key={`${hint.level}-${index}`}>
              <div className="oj-hint-card__head">
                <span>第 {hint.level || index + 1} 层</span>
                <strong>{hint.title || `提示 ${index + 1}`}</strong>
                {unlocked ? <CheckCircle2 size={17} /> : <LockKeyhole size={16} />}
              </div>
              {unlocked ? <p>{hint.content}</p> : <p className="oj-hint-card__locked">先尝试完成当前思路，再按需解锁。</p>}
            </section>
          )
        })}
      </div>
      {revealed < hints.length && (
        <button className="oj-outline-button" type="button" onClick={onReveal}>
          <Lightbulb size={16} /> 解锁第 {revealed + 1} 层提示
        </button>
      )}
    </article>
  )
}

function SubmissionsPanel({
  submissions,
  loading,
  error,
  hasMore,
  onLoadMore,
  problemId,
}: {
  submissions: SubmissionHistoryItem[]
  loading: boolean
  error: string
  hasMore: boolean
  onLoadMore: () => void
  problemId: string
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<SubmissionDetailResponse | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleExpand = useCallback(async (item: SubmissionHistoryItem) => {
    if (expandedId === item.id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(item.id)
    setDetail(null)
    if (item.code) {
      // Code already available
      setDetail(item as SubmissionDetailResponse)
      return
    }
    setDetailLoading(true)
    try {
      const response = await codingApi.getSubmissionDetail(problemId, item.id)
      setDetail(response.data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [expandedId, problemId])

  const handleCopy = useCallback(async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // fallback
    }
  }, [])

  return (
    <article className="oj-panel-article">
      <div className="oj-panel-heading">
        <div>
          <div className="oj-eyebrow">服务端判题记录</div>
          <h2>我的提交</h2>
          <p>最新提交排在最前面，点击查看代码。</p>
        </div>
      </div>
      {loading && submissions.length === 0 ? (
        <EmptyState icon={<LoaderCircle className="oj-spin" size={26} />} title="正在加载提交记录" />
      ) : error && submissions.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={26} />} title={error} />
      ) : submissions.length === 0 ? (
        <EmptyState icon={<History size={26} />} title="还没有提交记录" detail="运行公开测试不会计为提交；准备好后再提交隐藏测试。" />
      ) : (
        <>
          <div className="oj-submission-list">
            {submissions.map(item => (
              <div key={item.id}>
                <button
                  type="button"
                  className={`oj-submission-row${expandedId === item.id ? ' is-expanded' : ''}`}
                  onClick={() => handleExpand(item)}
                >
                  <div className={`oj-submission-status ${item.is_correct ? 'is-passed' : 'is-failed'}`}>
                    {item.is_correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    <strong>{VERDICT_LABELS[item.verdict] || item.verdict}</strong>
                  </div>
                  <span>{item.passed_cases}/{item.total_cases} 用例</span>
                  <span>{LANGUAGE_LABELS[item.language] || item.language}</span>
                  <span>{formatRuntime(item.runtime)}</span>
                  <time>{formatDate(item.created_at)}</time>
                </button>
                {expandedId === item.id && (
                  <div className="oj-submission-detail">
                    {detailLoading ? (
                      <div className="oj-submission-detail__loading">
                        <LoaderCircle className="oj-spin" size={16} /> 加载代码中…
                      </div>
                    ) : detail ? (
                      <>
                        <div className="oj-submission-detail__head">
                          <span>{LANGUAGE_LABELS[detail.language] || detail.language} · 提交代码</span>
                          <button
                            type="button"
                            className="oj-copy-button"
                            onClick={(e) => { e.stopPropagation(); handleCopy(detail.code, detail.id) }}
                          >
                            {copiedId === detail.id ? <><Check size={13} /> 已复制</> : <><Clipboard size={13} /> 复制代码</>}
                          </button>
                        </div>
                        <div className="oj-submission-detail__code">
                          <CodeEditor code={detail.code} language={detail.language} readOnly height={Math.min(380, Math.max(180, (detail.code || '').split('\n').length * 22 + 40))} />
                        </div>
                      </>
                    ) : (
                      <div className="oj-submission-detail__loading">无法加载该提交的代码</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="oj-submission-more">
              <button
                className="oj-outline-button"
                type="button"
                onClick={onLoadMore}
                disabled={loading}
              >
                {loading ? <><LoaderCircle className="oj-spin" size={14} /> 加载中</> : '加载更多提交'}
              </button>
            </div>
          )}
        </>
      )}
    </article>
  )
}

function SolutionPanel({
  attemptCount,
  loading,
  solution,
  error,
  language,
  onLoad,
  onGoCode,
}: {
  attemptCount: number
  loading: boolean
  solution: CodingSolutionResponse | null
  error: string
  language: string
  onLoad: () => void
  onGoCode: () => void
}) {
  if (attemptCount === 0) {
    return (
      <div className="oj-solution-lock">
        <div className="oj-solution-lock__icon"><LockKeyhole size={28} /></div>
        <h2>提交一次后解锁参考解法</h2>
        <p>你可以先运行公开测试、查看实际输出和真实执行轨迹。提交后，无论是否通过，都可以回来复盘。</p>
        <button className="oj-primary-button" type="button" onClick={onGoCode}><Code2 size={16} /> 去写代码</button>
      </div>
    )
  }
  if (loading) return <EmptyState icon={<LoaderCircle className="oj-spin" size={26} />} title="正在加载参考解法" />
  if (error) return <EmptyState icon={<AlertTriangle size={26} />} title={error} action="重新加载" onAction={onLoad} />
  if (!solution) return <EmptyState icon={<BookOpen size={26} />} title="参考解法尚未加载" action="加载参考解法" onAction={onLoad} />

  const standard = typeof solution.standard_answer === 'string'
    ? solution.standard_answer
    : solution.standard_answer[language] || solution.standard_answer.python || Object.values(solution.standard_answer)[0] || ''

  return (
    <article className="oj-panel-article oj-solution">
      <div className="oj-panel-heading">
        <div className="oj-eyebrow">完成尝试后复盘</div>
        <h2>参考解法</h2>
      </div>
      {solution.explanation && <p className="oj-prose">{solution.explanation}</p>}
      {solution.complexity && <div className="oj-complexity"><Clock3 size={16} /><span>{solution.complexity}</span></div>}
      <div className="oj-solution-code">
        <div>参考实现 · {LANGUAGE_LABELS[language] || language}</div>
        <CodeEditor code={standard} language={language} readOnly height={420} />
      </div>
    </article>
  )
}

function JudgeResultPanel({
  result,
  error,
  busy,
  publicCases,
}: {
  result: JudgeResponse | null
  error: string
  busy: 'run' | 'submit' | null
  publicCases: PublicTestCase[]
}) {
  if (busy) {
    return (
      <div className="oj-judge-loading">
        <LoaderCircle className="oj-spin" size={24} />
        <div><strong>{busy === 'run' ? '正在运行公开测试' : '正在提交隐藏测试'}</strong><span>代码会在隔离环境中逐组执行，请稍候。</span></div>
      </div>
    )
  }
  if (error) {
    return <div className="oj-error-banner"><AlertTriangle size={18} /><div><strong>判题请求失败</strong><span>{error}</span></div></div>
  }
  if (!result) {
    return (
      <div className="oj-result-placeholder">
        <div className="oj-result-placeholder__copy">
          <Terminal size={22} />
          <div><strong>先运行公开测试</strong><span>系统会逐项显示输入、预期输出、实际输出和运行错误。</span></div>
        </div>
        {publicCases.length > 0 && (
          <div className="oj-public-case-preview">
            {publicCases.map((item, index) => (
              <div key={item.id}><span>公开用例 {index + 1}</span><strong>{item.name}</strong></div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="oj-judge-result">
      <div className={`oj-verdict-banner ${result.all_passed ? 'is-passed' : 'is-failed'}`}>
        {result.all_passed ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
        <div>
          <strong>{VERDICT_LABELS[result.verdict] || result.verdict}</strong>
          <span>通过 {result.passed_cases}/{result.total_cases} 组 · 总耗时 {formatRuntime(result.runtime)}</span>
        </div>
      </div>
      <div className="oj-case-list">
        {result.cases.map(item => <JudgeCaseCard key={`${item.case_no}-${item.name}`} item={item} />)}
      </div>
    </div>
  )
}

function JudgeCaseCard({ item }: { item: JudgeCaseResult }) {
  const hidden = item.visibility === 'hidden'
  return (
    <details className={`oj-case-card ${item.passed ? 'is-passed' : 'is-failed'}`} open={!item.passed && !hidden}>
      <summary>
        <span>{item.passed ? <CheckCircle2 size={17} /> : <XCircle size={17} />}</span>
        <strong>{item.name}</strong>
        <small>{hidden ? '隐藏用例' : '公开用例'}</small>
        <small>{formatRuntime(item.execution_time)}</small>
        <span>{VERDICT_LABELS[item.status] || item.status}</span>
      </summary>
      <div className="oj-case-card__body">
        {hidden ? (
          <div className="oj-hidden-case-note"><LockKeyhole size={16} /> 为保证判题有效性，隐藏用例的输入和输出不会展示。</div>
        ) : (
          <div className="oj-case-values">
            <CodeValue label="输入" value={item.input || '（空）'} />
            <CodeValue label="预期输出" value={item.expected || '（空）'} />
            <CodeValue label="实际输出" value={item.actual || '（空）'} danger={!item.passed} />
          </div>
        )}
        {item.stderr && <CodeValue label="运行错误" value={item.stderr} danger />}
      </div>
    </details>
  )
}

function TracePanel({
  steps,
  currentIndex,
  current,
  autoPlaying,
  onPrevious,
  onNext,
  onToggleAuto,
}: {
  steps: AnalyzeStep[]
  currentIndex: number
  current: AnalyzeStep | null
  autoPlaying: boolean
  onPrevious: () => void
  onNext: () => void
  onToggleAuto: () => void
}) {
  if (steps.length === 0 || !current) {
    return (
      <EmptyState
        icon={<ChevronRight size={26} />}
        title="暂无真实执行轨迹"
        detail="运行公开测试后，这里会展示服务端记录的 Python 行级轨迹；系统不会根据代码文本猜测状态。"
      />
    )
  }
  return (
    <div className="oj-trace">
      <div className="oj-trace__timeline">
        <div className="oj-trace__controls">
          <button type="button" onClick={onPrevious} disabled={currentIndex === 0}>上一步</button>
          <span>{currentIndex + 1} / {steps.length}</span>
          <button type="button" onClick={onNext} disabled={currentIndex >= steps.length - 1}>下一步</button>
          <button className={autoPlaying ? 'is-playing' : ''} type="button" onClick={onToggleAuto}>{autoPlaying ? '暂停' : '自动播放'}</button>
        </div>
        <div className="oj-trace__line"><span>第 {current.line} 行</span><code>{current.line_code || '（当前行无源码文本）'}</code></div>
        <p>{current.explanation}</p>
        <div className="oj-trace__variables">
          <strong>当前变量</strong>
          {Object.keys(current.variables || {}).length === 0
            ? <span>这一行没有可展示的局部变量</span>
            : Object.entries(current.variables).map(([key, value]) => (
              <div key={key}><code>{key}</code><span>=</span><pre>{JSON.stringify(value, null, 2)}</pre></div>
            ))}
        </div>
      </div>
      <div className="oj-trace__visual">
        <div className="oj-trace__visual-title">从真实变量提取的数据结构</div>
        {current.data_structure ? (
          <VisualizationCanvas dataStructure={current.data_structure} width={420} height={190} />
        ) : (
          <div className="oj-trace__no-visual">当前步骤没有可识别的数组、栈、队列或堆变量。</div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return <div className="oj-info-card"><strong>{title}</strong><p>{value}</p></div>
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return <div className="oj-info-card"><strong>{title}</strong><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></div>
}

function CodeValue({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className={`oj-code-value${danger ? ' is-danger' : ''}`}><span>{label}</span><pre>{value}</pre></div>
}

function ExplainPanel({
  loading,
  result,
  error,
  onRetry,
}: {
  loading: boolean
  result: ExplainResponse | null
  error: string
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="oj-judge-loading">
        <LoaderCircle className="oj-spin" size={24} />
        <div><strong>AI 正在分析你的代码</strong><span>这可能需要几秒钟，请耐心等待。</span></div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="oj-error-banner">
        <AlertTriangle size={18} />
        <div>
          <strong>AI 解答失败</strong>
          <span>{error}</span>
          <button className="oj-outline-button oj-outline-button--small" type="button" onClick={onRetry} style={{ marginTop: 8 }}>
            重新尝试
          </button>
        </div>
      </div>
    )
  }
  if (!result) {
    return (
      <div className="oj-result-placeholder">
        <div className="oj-result-placeholder__copy">
          <Bot size={22} />
          <div>
            <strong>点击"AI解答"按钮</strong>
            <span>AI 将分析你的代码并给出针对性的改进方向和下一步引导，不会直接给出答案代码。</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="oj-explain-panel">
      {/* Model info */}
      <div className="oj-explain-lang-switch">
        <span className="oj-explain-model">模型：{result.model}</span>
      </div>

      {/* Code analysis */}
      {result.explanation && (
        <div className="oj-explain-text">
          <div className="oj-explain-section-title">
            <Bot size={16} />
            代码分析
          </div>
          {result.explanation}
        </div>
      )}

      {/* Next-step guidance */}
      {result.guidance && (
        <div className="oj-explain-text oj-explain-guidance">
          <div className="oj-explain-section-title">
            <Lightbulb size={16} />
            下一步引导
          </div>
          {result.guidance}
        </div>
      )}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  detail,
  action,
  onAction,
}: {
  icon: React.ReactNode
  title: string
  detail?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="oj-empty-state">
      <div className="oj-empty-state__icon">{icon}</div>
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
      {action && onAction && <button className="oj-outline-button" type="button" onClick={onAction}>{action}</button>}
    </div>
  )
}
