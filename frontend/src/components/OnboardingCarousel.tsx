import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, GitBranch, BookOpen, Zap, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import './OnboardingCarousel.css'

/* ── Extract userId from store or JWT fallback ── */
function useUserId(): string | null {
  const storeUserId = useAuthStore((s) => s.user?.id)
  return useMemo(() => {
    if (storeUserId) return storeUserId
    // Fallback: parse JWT directly (handles page reload where user not in store)
    const token = localStorage.getItem('access_token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload?.sub || null
    } catch {
      return null
    }
  }, [storeUserId])
}

/* ── Slide definitions ── */
interface SlideData {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  features: string[]
  accentColor: string
}

const SLIDES: SlideData[] = [
  {
    icon: <MessageCircle />,
    iconBg: '#3B82F6',
    title: 'AI 对话',
    description: '与 AI 进行一对一智能对话，解决学习中的各种问题',
    features: [
      '提问任何学科的知识点疑问',
      'AI 实时解答，支持多轮深入讨论',
      '支持代码辅导、公式讲解等多种模式',
    ],
    accentColor: '#3B82F6',
  },
  {
    icon: <GitBranch />,
    iconBg: '#8B5CF6',
    title: '学习路径',
    description: 'AI 根据你的学习情况，动态规划最优学习路线',
    features: [
      '系统自动分析知识薄弱点',
      '生成个性化 7 天学习计划',
      '自适应调整学习节奏和难度',
    ],
    accentColor: '#8B5CF6',
  },
  {
    icon: <BookOpen />,
    iconBg: '#14B8A6',
    title: '智能题库',
    description: '海量题目 + 智能组卷，精准训练薄弱环节',
    features: [
      '按知识点 / 难度分层练习',
      '自动收录错题，定期推送复习',
      '模拟考试模式，实时评估掌握度',
    ],
    accentColor: '#14B8A6',
  },
  {
    icon: <Zap />,
    iconBg: '#F97316',
    title: '开启学习之旅',
    description: '更多功能助你高效学习，全面提升能力',
    features: [
      '知识图谱 — 可视化学习进度',
      '复习中心 — 智能遗忘曲线提醒',
      '学习画像 — 360° 能力评估',
      '云盘 / 笔记 — 资料集中管理',
    ],
    accentColor: '#F97316',
  },
]

/* ── localStorage helpers ── */
function getSeenKey(userId: string) {
  return `onboarding_seen_${userId}`
}
function getForceShowKey(userId: string) {
  return `onboarding_force_show_${userId}`
}

export default function OnboardingCarousel() {
  const location = useLocation()
  const userId = useUserId()

  const [visible, setVisible] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const slidesRef = useRef<HTMLDivElement>(null)
  const hasDismissed = useRef(false)

  /* ── Decide whether to show on mount ── */
  useEffect(() => {
    if (!userId) return

    // Only show on /home
    if (location.pathname !== '/home') return

    const forceKey = getForceShowKey(userId)
    const forceShow = sessionStorage.getItem(forceKey)

    if (forceShow === 'true') {
      // Re-trigger from ProfilePage — show regardless of seen status
      sessionStorage.removeItem(forceKey)
      hasDismissed.current = false
      setVisible(true)
      setCurrentSlide(0)
      return
    }

    const seenKey = getSeenKey(userId)
    const alreadySeen = localStorage.getItem(seenKey)

    if (alreadySeen === 'true') {
      return // Already seen, don't show
    }

    // First time — show carousel
    hasDismissed.current = false
    setVisible(true)
  }, [userId, location.pathname])

  /* ── Dismiss carousel ── */
  const handleDismiss = useCallback(() => {
    if (hasDismissed.current) return
    hasDismissed.current = true

    if (userId) {
      localStorage.setItem(getSeenKey(userId), 'true')
    }
    setVisible(false)
  }, [userId])

  /* ── Slide navigation ── */
  const goToSlide = useCallback(
    (index: number) => {
      const el = slidesRef.current
      if (!el) return
      const clamped = Math.max(0, Math.min(index, SLIDES.length - 1))
      const slideWidth = el.scrollWidth / SLIDES.length
      el.scrollTo({ left: clamped * slideWidth, behavior: 'smooth' })
    },
    []
  )

  const handlePrev = () => goToSlide(currentSlide - 1)
  const handleNext = () => goToSlide(currentSlide + 1)

  /* ── Track current slide via scroll ── */
  const handleScroll = useCallback(() => {
    const el = slidesRef.current
    if (!el) return
    const slideWidth = el.scrollWidth / SLIDES.length
    const index = Math.round(el.scrollLeft / slideWidth)
    setCurrentSlide(Math.max(0, Math.min(index, SLIDES.length - 1)))
  }, [])

  /* ── Keyboard navigation ── */
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'Escape') handleDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, currentSlide])

  const isLast = currentSlide === SLIDES.length - 1

  return (
    <div
      className={`onboarding-overlay${visible ? ' visible' : ''}`}
    >
      {/* Top-right button: skip (slides 0-2) or done (slide 3) */}
      {isLast ? (
        <button className="onboarding-top-btn onboarding-done-btn" onClick={handleDismiss}>
          开始使用
        </button>
      ) : (
        <button className="onboarding-top-btn" onClick={handleDismiss}>
          跳过
        </button>
      )}

      {/* Slides */}
      <div
        className="onboarding-slides"
        ref={slidesRef}
        onScroll={handleScroll}
      >
        {SLIDES.map((slide, i) => (
          <div className="onboarding-slide" key={i}>
            <div
              className="onboarding-icon-wrapper"
              style={{ background: slide.iconBg }}
            >
              {slide.icon}
            </div>
            <h2 className="onboarding-title">{slide.title}</h2>
            <p className="onboarding-desc">{slide.description}</p>

            <ul className="onboarding-features">
              {slide.features.map((feat, j) => (
                <li className="onboarding-feature-item" key={j}>
                  <span
                    className="onboarding-check"
                    style={{ background: slide.accentColor }}
                  >
                    <Check />
                  </span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer: dots + arrows */}
      <div className="onboarding-footer">
        <button
          className="onboarding-arrow-btn"
          onClick={handlePrev}
          disabled={currentSlide === 0}
        >
          <ChevronLeft />
        </button>

        <div className="onboarding-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`onboarding-dot${i === currentSlide ? ' active' : ''}`}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>

        <button
          className="onboarding-arrow-btn"
          onClick={handleNext}
          disabled={isLast}
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
