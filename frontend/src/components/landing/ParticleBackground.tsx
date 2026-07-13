import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  el: HTMLDivElement
  baseX: number
  baseY: number
  speed: number
  size: number
  rotation: number
  rotSpeed: number
  shape: 'square' | 'circle' | 'triangle'
  opacity: number
}

export default function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)

  const createParticles = useCallback(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const { width, height } = container.getBoundingClientRect()
    const count = 18

    particlesRef.current.forEach(p => p.el.remove())
    particlesRef.current = []

    const shapes: Particle['shape'][] = ['square', 'circle', 'triangle']
    const colors = [
      'rgba(167,139,250,0.15)', 'rgba(129,140,248,0.12)',
      'rgba(196,181,253,0.10)', 'rgba(99,102,241,0.08)',
      'rgba(165,180,252,0.13)', 'rgba(139,92,246,0.09)',
    ]

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div')
      const size = 20 + Math.random() * 55
      const shape = shapes[Math.floor(Math.random() * shapes.length)]
      const color = colors[Math.floor(Math.random() * colors.length)]

      el.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        pointer-events: none;
        z-index: 0;
      `

      if (shape === 'circle') {
        el.style.borderRadius = '50%'
        el.style.background = color
        el.style.border = '1px solid rgba(255,255,255,0.06)'
      } else if (shape === 'square') {
        el.style.borderRadius = `${4 + Math.random() * 12}px`
        el.style.background = color
        el.style.border = '1px solid rgba(255,255,255,0.06)'
      } else {
        // Triangle via clip-path
        el.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'
        el.style.background = color
      }

      const particle: Particle = {
        el,
        baseX: Math.random() * width,
        baseY: Math.random() * height,
        speed: 0.3 + Math.random() * 0.7,
        size,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        shape,
        opacity: 0.3 + Math.random() * 0.5,
      }

      el.style.left = `${particle.baseX}px`
      el.style.top = `${particle.baseY}px`
      el.style.opacity = `${particle.opacity}`

      container.appendChild(el)
      particlesRef.current.push(particle)
    }
  }, [])

  useEffect(() => {
    createParticles()
    let running = true

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleResize = () => {
      createParticles()
    }

    // Pause RAF when hero is not visible
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting
        if (running && !rafRef.current) {
          rafRef.current = requestAnimationFrame(animate)
        }
      },
      { threshold: 0 }
    )
    if (containerRef.current) {
      visibilityObserver.observe(containerRef.current)
    }

    const animate = () => {
      if (!running) {
        rafRef.current = 0
        return
      }
      const { x: mx, y: my } = mouseRef.current
      const vw = window.innerWidth / 2
      const vh = window.innerHeight / 2
      const offsetX = (mx - vw) / vw
      const offsetY = (my - vh) / vh

      particlesRef.current.forEach(p => {
        const shiftX = offsetX * 25 * p.speed
        const shiftY = offsetY * 25 * p.speed
        p.rotation += p.rotSpeed

        const floatY = Math.sin(Date.now() * 0.001 * p.speed + p.baseX) * 15
        const floatX = Math.cos(Date.now() * 0.0012 * p.speed + p.baseY) * 10

        p.el.style.transform = `
          translate3d(
            ${shiftX + floatX}px,
            ${shiftY + floatY}px,
            0
          )
          rotate(${p.rotation}deg)
        `
      })

      rafRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', handleMouse, { passive: true })
    window.addEventListener('resize', handleResize)
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', handleMouse)
      window.removeEventListener('resize', handleResize)
      visibilityObserver.disconnect()
      cancelAnimationFrame(rafRef.current)
      particlesRef.current.forEach(p => p.el.remove())
      particlesRef.current = []
    }
  }, [createParticles])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}
