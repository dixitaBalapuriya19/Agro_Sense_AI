import { useRef, useEffect } from 'react'

// Each leaf particle stores its position, angle, size, opacity, and lifecycle
class Leaf {
  constructor(x, y, isDark) {
    this.x = x
    this.y = y
    this.angle = Math.random() * Math.PI * 2
    this.rotSpeed = (Math.random() - 0.5) * 0.02
    // Increased base leaf size
    this.maxSize = 15 + Math.random() * 25
    this.size = 0
    this.opacity = 0
    this.life = 0
    this.maxLife = 80 + Math.random() * 120
    this.vx = (Math.random() - 0.5) * 0.4
    this.vy = -0.2 - Math.random() * 0.5 // Float upward
    this.isDark = isDark
  }

  update() {
    this.life++
    const progress = this.life / this.maxLife

    // Grow in, hold, fade out
    if (progress < 0.2) {
      this.size = this.maxSize * (progress / 0.2)
      this.opacity = progress / 0.2
    } else if (progress < 0.6) {
      this.size = this.maxSize
      this.opacity = 1
    } else {
      const fade = (progress - 0.6) / 0.4
      this.size = this.maxSize * (1 - fade * 0.3)
      this.opacity = 1 - fade
    }

    this.x += this.vx
    this.vy *= 0.995
    this.y += this.vy
    this.angle += this.rotSpeed
    this.vx *= 0.99

    return this.life < this.maxLife
  }

  draw(ctx) {
    if (this.opacity <= 0) return

    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle)
    ctx.globalAlpha = this.opacity * (this.isDark ? 0.5 : 0.35)

    const s = this.size

    // Colors based on theme
    const bodyColor = this.isDark
      ? `rgba(80, 180, 60, ${this.opacity * 0.4})`
      : `rgba(34, 120, 50, ${this.opacity * 0.25})`
    const edgeColor = this.isDark
      ? `rgba(140, 220, 80, ${this.opacity * 0.7})`
      : `rgba(60, 150, 70, ${this.opacity * 0.5})`
    const veinColor = this.isDark
      ? `rgba(160, 230, 90, ${this.opacity * 0.5})`
      : `rgba(50, 130, 60, ${this.opacity * 0.35})`

    // Draw leaf body using bezier curves
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.bezierCurveTo(s * 0.8, -s * 0.6, s * 0.9, s * 0.2, 0, s)
    ctx.bezierCurveTo(-s * 0.9, s * 0.2, -s * 0.8, -s * 0.6, 0, -s)
    ctx.fillStyle = bodyColor
    ctx.fill()

    // Leaf edge outline
    ctx.strokeStyle = edgeColor
    ctx.lineWidth = 1
    ctx.stroke()

    // Central vein
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.9)
    ctx.lineTo(0, s * 0.9)
    ctx.strokeStyle = veinColor
    ctx.lineWidth = 0.8
    ctx.stroke()

    // Side veins
    const veins = 4
    for (let i = 1; i <= veins; i++) {
      const t = i / (veins + 1)
      const yPos = -s + t * s * 2
      const width = s * 0.5 * Math.sin(t * Math.PI)
      ctx.beginPath()
      ctx.moveTo(0, yPos)
      ctx.quadraticCurveTo(width * 0.5, yPos - s * 0.08, width, yPos - s * 0.15)
      ctx.strokeStyle = veinColor
      ctx.lineWidth = 0.4
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, yPos)
      ctx.quadraticCurveTo(-width * 0.5, yPos - s * 0.08, -width, yPos - s * 0.15)
      ctx.stroke()
    }

    ctx.restore()
  }
}

export default function PlantShader({ isDark = true }) {
  const canvasRef = useRef(null)
  const leavesRef = useRef([])
  const mouseRef = useRef({ x: 0, y: 0, active: false })
  const lastSpawnRef = useRef({ x: 0, y: 0 })
  const idleFramesRef = useRef(0)
  const frameRef = useRef(0)
  const isDarkRef = useRef(isDark)

  // Keep isDark in sync
  useEffect(() => {
    isDarkRef.current = isDark
  }, [isDark])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true
      }
      idleFramesRef.current = 0 // Reset idle counter on movement
    }

    const handleMouseLeave = () => {
      mouseRef.current.active = false
      idleFramesRef.current = 60 // Immediately treat as idle if mouse leaves
    }

    // Listen on parent element (whole hero section)
    const heroEl = canvas.closest('.hero-landing') || canvas.parentElement
    heroEl.addEventListener('mousemove', handleMouseMove)
    heroEl.addEventListener('mouseleave', handleMouseLeave)

    let animationId

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const displayW = canvas.clientWidth
      const displayH = canvas.clientHeight

      if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
        canvas.width = displayW * dpr
        canvas.height = displayH * dpr
        ctx.scale(dpr, dpr)
      }

      ctx.clearRect(0, 0, displayW, displayH)

      const mouse = mouseRef.current
      const leaves = leavesRef.current
      frameRef.current++
      idleFramesRef.current++

      // Spawn leaves along mouse trail
      if (mouse.active) {
        const dx = mouse.x - lastSpawnRef.current.x
        const dy = mouse.y - lastSpawnRef.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Spawn a leaf every ~25px of mouse movement
        if (dist > 25) {
          leaves.push(new Leaf(mouse.x, mouse.y, isDarkRef.current))
          lastSpawnRef.current = { x: mouse.x, y: mouse.y }
        }
      }

      // Determine ambient spawn rate based on mouse activity
      // If idle for > 30 frames (~0.5s), spawn a leaf roughly every 20-30 frames (frequent but not crazy).
      // If moving, ambient spawns happen very rarely (every 90 frames) so the trail is the main focus.
      const isIdle = idleFramesRef.current > 30
      const ambientRate = isIdle ? 25 : 90

      // Also spawn ambient background leaves periodically
      if (frameRef.current % ambientRate === 0) {
        const rx = Math.random() * displayW
        const ry = Math.random() * displayH
        const leaf = new Leaf(rx, ry, isDarkRef.current)
        // Increased ambient leaf size
        leaf.maxSize = 10 + Math.random() * 20
        leaf.opacity = 0
        leaf.maxLife = 150 + Math.random() * 100
        leaves.push(leaf)
      }

      // Update and draw all leaves, remove dead ones
      for (let i = leaves.length - 1; i >= 0; i--) {
        const alive = leaves[i].update()
        if (!alive) {
          leaves.splice(i, 1)
        } else {
          leaves[i].draw(ctx)
        }
      }

      // Cap particle count to avoid lag
      if (leaves.length > 200) {
        leaves.splice(0, leaves.length - 200)
      }

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
      heroEl.removeEventListener('mousemove', handleMouseMove)
      heroEl.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        backgroundColor: 'transparent'
      }}
    />
  )
}
