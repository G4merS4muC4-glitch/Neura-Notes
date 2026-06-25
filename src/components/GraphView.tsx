import { useEffect, useRef } from 'react'
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type ForceLink,
} from 'd3-force'
import type { GraphData, GraphNode } from '@/types'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type Props = {
  graph: GraphData
  query: string
  /** Mapa tag-normalizada -> cor (hex). Define a cor dos nós. */
  tagColors: Record<string, string>
  /** Atalho real: abrir a nota ao tocar/clicar no nó. */
  onOpen: (id: string) => void
}

const DEFAULT_COLOR = '#5EE6C7'

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** Mistura a cor com branco (t=0 cor pura, t=1 branco). */
function mixWhite(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex)
  const m = (v: number) => Math.round(v + (255 - v) * t)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

type SimNode = GraphNode & {
  x: number
  y: number
  vx: number
  vy: number
  fx?: number | null
  fy?: number | null
  appearAt: number
  phase: number // fase do pulso de respiração
}

type SimLink = { source: SimNode; target: SimNode }

function nodeRadius(degree: number): number {
  return Math.min(20, 4 + Math.sqrt(degree) * 3.6)
}

// Cache de posições em nível de módulo: preserva o layout ao sair e voltar
// para o grafo, evitando re-acomodar tudo do zero a cada navegação.
const positionCache = new Map<string, { x: number; y: number }>()

export default function GraphView({ graph, query, tagColors, onOpen }: Props) {
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // ---- estado persistente entre renders ----
  const nodesMap = useRef(new Map<string, SimNode>())
  const linksArr = useRef<SimLink[]>([])
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const view = useRef({ zoom: 1, panX: 0, panY: 0 })
  const panVel = useRef({ x: 0, y: 0 })
  const signals = useRef<{ link: SimLink; t: number; speed: number }[]>([])
  const lastSignal = useRef(0)
  const size = useRef({ w: 0, h: 0, dpr: 1 })
  const tStart = useRef(performance.now())
  const hoveredId = useRef<string | null>(null)

  // espelhos de props para uso dentro do loop/handlers persistentes
  const propsRef = useRef({ query, onOpen, reduced, tagColors })
  propsRef.current = { query, onOpen, reduced, tagColors }

  // ---- reconciliar dados do grafo, preservando posições ----
  useEffect(() => {
    const map = nodesMap.current
    const now = performance.now()
    const incoming = new Set(graph.nodes.map((n) => n.id))
    let stagger = 0

    for (const gn of graph.nodes) {
      const existing = map.get(gn.id)
      if (existing) {
        existing.title = gn.title
        existing.degree = gn.degree
        existing.tags = gn.tags
      } else {
        const cached = positionCache.get(gn.id)
        const a = Math.random() * Math.PI * 2
        const r = 30 + Math.random() * 60
        map.set(gn.id, {
          ...gn,
          x: cached?.x ?? Math.cos(a) * r,
          y: cached?.y ?? Math.sin(a) * r,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null,
          appearAt: cached ? now : now + stagger,
          phase: Math.random() * Math.PI * 2,
        })
        if (!cached) stagger += 15
      }
    }
    for (const id of [...map.keys()]) if (!incoming.has(id)) map.delete(id)

    const nodes = [...map.values()]
    linksArr.current = graph.edges
      .map((e) => {
        const s = typeof e.source === 'string' ? e.source : e.source.id
        const t = typeof e.target === 'string' ? e.target : e.target.id
        const source = map.get(s)
        const target = map.get(t)
        return source && target ? { source, target } : null
      })
      .filter((l): l is SimLink => l !== null)

    let sim = simRef.current
    if (!sim) {
      sim = forceSimulation<SimNode, SimLink>(nodes)
        .force('charge', forceManyBody<SimNode>().strength(-160).distanceMax(480))
        .force('center', forceCenter(0, 0).strength(0.04))
        .force('x', forceX(0).strength(0.05))
        .force('y', forceY(0).strength(0.05))
        .force('collide', forceCollide<SimNode>((d) => nodeRadius(d.degree) + 8))
        .force(
          'link',
          forceLink<SimNode, SimLink>(linksArr.current)
            .id((d) => d.id)
            .distance(64)
            .strength(0.12),
        )
      sim.alpha(0.9).restart()
      simRef.current = sim
    } else {
      sim.nodes(nodes)
      ;(sim.force('link') as ForceLink<SimNode, SimLink>).links(linksArr.current)
      sim.alpha(Math.max(sim.alpha(), 0.5)).restart()
    }
  }, [graph])

  // ---- setup canvas, loop de render, interações ----
  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      size.current = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // ---------- helpers de coordenadas ----------
    const toScreenX = (n: SimNode) => size.current.w / 2 + view.current.panX + n.x * view.current.zoom
    const toScreenY = (n: SimNode) => size.current.h / 2 + view.current.panY + n.y * view.current.zoom
    const screenToSim = (sx: number, sy: number) => ({
      x: (sx - size.current.w / 2 - view.current.panX) / view.current.zoom,
      y: (sy - size.current.h / 2 - view.current.panY) / view.current.zoom,
    })
    const hitTest = (sx: number, sy: number): SimNode | null => {
      let best: SimNode | null = null
      let bestD = Infinity
      for (const n of nodesMap.current.values()) {
        const dx = toScreenX(n) - sx
        const dy = toScreenY(n) - sy
        const r = nodeRadius(n.degree) * view.current.zoom + 10
        const d = Math.hypot(dx, dy)
        if (d <= r && d < bestD) {
          best = n
          bestD = d
        }
      }
      return best
    }
    const neighborsOf = (id: string) => {
      const set = new Set<string>([id])
      for (const l of linksArr.current) {
        if (l.source.id === id) set.add(l.target.id)
        else if (l.target.id === id) set.add(l.source.id)
      }
      return set
    }

    // ---------- ponteiros (pan / zoom / drag / tap / hover) ----------
    const pointers = new Map<number, { x: number; y: number }>()
    let dragNode: SimNode | null = null
    let panning = false
    let pinchDist = 0
    let last = { x: 0, y: 0 }
    let downAt = 0
    let downPos = { x: 0, y: 0 }

    const getXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      const p = getXY(e)
      pointers.set(e.pointerId, p)
      downAt = performance.now()
      downPos = p
      last = p
      panVel.current = { x: 0, y: 0 }

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
        dragNode = null
        panning = false
        return
      }
      const hit = hitTest(p.x, p.y)
      if (hit) {
        dragNode = hit
        hoveredId.current = hit.id
        const sp = screenToSim(p.x, p.y)
        hit.fx = sp.x
        hit.fy = sp.y
        simRef.current?.alphaTarget(0.3).restart()
        canvas.style.cursor = 'grabbing'
      } else {
        panning = true
        canvas.style.cursor = 'grabbing'
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = getXY(e)

      // hover (mouse sem botão pressionado)
      if (!pointers.has(e.pointerId) && pointers.size === 0) {
        const hit = hitTest(p.x, p.y)
        hoveredId.current = hit ? hit.id : null
        canvas.style.cursor = hit ? 'pointer' : 'grab'
        return
      }
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, p)

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        if (pinchDist > 0) applyZoom(dist / pinchDist, mid.x, mid.y)
        pinchDist = dist
        return
      }

      if (dragNode) {
        const sp = screenToSim(p.x, p.y)
        dragNode.fx = sp.x
        dragNode.fy = sp.y
      } else if (panning) {
        const dx = p.x - last.x
        const dy = p.y - last.y
        view.current.panX += dx
        view.current.panY += dy
        panVel.current = { x: dx, y: dy }
      }
      last = p
    }

    const onUp = (e: PointerEvent) => {
      const p = getXY(e)
      const dt = performance.now() - downAt
      const dist = Math.hypot(p.x - downPos.x, p.y - downPos.y)
      pointers.delete(e.pointerId)
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }

      // toque rápido sem arrastar = abrir a nota (atalho real)
      if (dt < 350 && dist < 8 && pointers.size === 0) {
        const hit = hitTest(p.x, p.y)
        if (hit) propsRef.current.onOpen(hit.id)
      }

      if (dragNode) {
        // solta o nó de volta na simulação (acomoda com spring)
        dragNode.fx = null
        dragNode.fy = null
        simRef.current?.alphaTarget(0)
        dragNode = null
      }
      if (pointers.size === 0) {
        panning = false
        canvas.style.cursor = 'grab'
      }
      if (pointers.size < 2) pinchDist = 0
    }

    const onLeave = () => {
      hoveredId.current = null
      canvas.style.cursor = 'grab'
    }

    const applyZoom = (factor: number, cx: number, cy: number) => {
      const before = screenToSim(cx, cy)
      view.current.zoom = Math.max(0.18, Math.min(5, view.current.zoom * factor))
      const after = screenToSim(cx, cy)
      view.current.panX += (after.x - before.x) * view.current.zoom
      view.current.panY += (after.y - before.y) * view.current.zoom
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      applyZoom(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top)
    }

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // ---------- loop de render ----------
    let raf = 0
    const render = () => {
      const { w, h, dpr } = size.current
      const { query, reduced } = propsRef.current
      const now = performance.now()
      const t = (now - tStart.current) / 1000
      const zoom = view.current.zoom

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // vinheta radial sutil para profundidade
      const vg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.7)
      vg.addColorStop(0, 'rgba(29,38,44,0.5)')
      vg.addColorStop(1, 'rgba(15,20,23,0)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, w, h)

      // inércia do pan
      if (!panning && (Math.abs(panVel.current.x) > 0.1 || Math.abs(panVel.current.y) > 0.1)) {
        view.current.panX += panVel.current.x
        view.current.panY += panVel.current.y
        panVel.current.x *= 0.92
        panVel.current.y *= 0.92
      }

      const q = query.trim().toLowerCase()
      const hovered = hoveredId.current
      const focus = hovered ? neighborsOf(hovered) : null
      const nodeCount = nodesMap.current.size
      const many = nodeCount > 150
      const tagColors = propsRef.current.tagColors

      // progresso de entrada (0→1) e cor por tag
      const appearOf = (n: SimNode) =>
        reduced ? 1 : Math.max(0, Math.min(1, (now - n.appearAt) / 420))
      const colorOf = (n: SimNode) => {
        for (const tag of n.tags) {
          const c = tagColors[tag]
          if (c) return c
        }
        return DEFAULT_COLOR
      }

      const matches = (n: SimNode) => !q || n.title.toLowerCase().includes(q)
      // destaque por nó: 1 = pleno, <1 = desbotado
      const emphasisOf = (n: SimNode) => {
        let e = 1
        if (q && !matches(n)) e = 0.12
        if (focus && !focus.has(n.id)) e = Math.min(e, 0.18)
        return e
      }

      // ---- arestas ----
      // As arestas entram LOGO DEPOIS dos nós: só começam quando ambas as
      // pontas já estão ~45% visíveis, e terminam junto com elas.
      for (const l of linksArr.current) {
        const ea = Math.min(appearOf(l.source), appearOf(l.target))
        const edgeFade = reduced ? 1 : Math.max(0, Math.min(1, (ea - 0.45) / 0.55))
        if (edgeFade <= 0) continue
        const ax = toScreenX(l.source)
        const ay = toScreenY(l.source)
        const bx = toScreenX(l.target)
        const by = toScreenY(l.target)
        const onFocus = focus && (l.source.id === hovered || l.target.id === hovered)
        const em = Math.min(emphasisOf(l.source), emphasisOf(l.target))
        if (onFocus) {
          const grad = ctx.createLinearGradient(ax, ay, bx, by)
          grad.addColorStop(0, `rgba(94,230,199,${0.85 * edgeFade})`)
          grad.addColorStop(1, `rgba(111,201,232,${0.85 * edgeFade})`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.6
        } else {
          ctx.strokeStyle = `rgba(140,170,178,${0.32 * em * edgeFade})`
          ctx.lineWidth = 1
        }
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }

      // ---- sinais sinápticos ----
      if (!reduced) {
        if (now - lastSignal.current > 2000 && linksArr.current.length && signals.current.length < 5) {
          lastSignal.current = now
          const link = linksArr.current[Math.floor(Math.random() * linksArr.current.length)]
          signals.current.push({ link, t: 0, speed: 0.55 + Math.random() * 0.4 })
        }
        signals.current = signals.current.filter((s) => s.t <= 1)
        for (const s of signals.current) {
          s.t += s.speed / 60
          const ax = toScreenX(s.link.source)
          const ay = toScreenY(s.link.source)
          const bx = toScreenX(s.link.target)
          const by = toScreenY(s.link.target)
          const x = ax + (bx - ax) * s.t
          const y = ay + (by - ay) * s.t
          const fade = Math.sin(s.t * Math.PI)
          ctx.beginPath()
          ctx.arc(x, y, 2.4, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(180,255,235,${0.9 * fade})`
          ctx.shadowBlur = 10
          ctx.shadowColor = '#5EE6C7'
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }

      // ---- nós ----
      for (const n of nodesMap.current.values()) {
        const appear = appearOf(n)
        if (appear <= 0) continue
        const x = toScreenX(n)
        const y = toScreenY(n)
        const breath = reduced ? 1 : 1 + 0.025 * Math.sin(t * 1.3 + n.phase)
        const baseR = nodeRadius(n.degree) * zoom
        const r = Math.max(2, baseR * breath * (0.6 + 0.4 * appear))
        const em = emphasisOf(n)
        const isHover = n.id === hovered
        const isFocus = focus?.has(n.id) ?? false
        const alpha = em * appear
        const base = colorOf(n)

        // glow
        ctx.shadowBlur = (isHover ? 22 : isFocus ? 14 : 8) * (0.6 + 0.25 * Math.sin(t * 1.3 + n.phase)) + 4
        ctx.shadowColor = base
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
        if (isHover || isFocus) {
          // núcleo bem claro + borda na cor da tag
          grad.addColorStop(0, mixWhite(base, 0.85))
          grad.addColorStop(1, base)
        } else {
          // núcleo claro com borda na cor da tag — lê como um grafo de verdade
          grad.addColorStop(0, mixWhite(base, 0.78))
          grad.addColorStop(1, mixWhite(base, 0.12))
        }
        ctx.globalAlpha = alpha
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        if (isHover) {
          ctx.globalAlpha = 0.9
          ctx.lineWidth = 1.5
          ctx.strokeStyle = mixWhite(base, 0.6)
          ctx.beginPath()
          ctx.arc(x, y, r + 5, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // ---- rótulos (sempre visíveis; somem ao afastar muito o zoom) ----
      // calculado em passo separado para não brigar com sombras dos nós
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const n of nodesMap.current.values()) {
        const appear = appearOf(n)
        if (appear <= 0) continue
        const isHover = n.id === hovered
        const isFocus = focus?.has(n.id) ?? false
        const hub = n.degree >= 4

        // opacidade do rótulo em função do zoom (e do tamanho do grafo)
        let labelAlpha: number
        if (isHover || isFocus) labelAlpha = 1
        else {
          const lo = many ? 0.95 : 0.5
          const hi = many ? 1.4 : 0.9
          labelAlpha = Math.max(0, Math.min(1, (zoom - lo) / (hi - lo)))
          if (hub) labelAlpha = Math.max(labelAlpha, 0.7)
        }
        labelAlpha *= emphasisOf(n) * appear
        if (labelAlpha < 0.04) continue

        const r = nodeRadius(n.degree) * zoom
        const x = toScreenX(n)
        const y = toScreenY(n)
        const fontSize = Math.max(10, Math.min(14, 11 * Math.min(zoom, 1.5)))
        ctx.font = `${isHover || hub ? 600 : 500} ${fontSize}px Poppins, system-ui, sans-serif`
        const label = n.title.length > 28 ? n.title.slice(0, 27) + '…' : n.title

        // leve sombra para legibilidade sobre as arestas
        ctx.globalAlpha = labelAlpha
        ctx.shadowBlur = 6
        ctx.shadowColor = 'rgba(15,20,23,0.9)'
        ctx.fillStyle = isHover || isFocus ? '#EAF6F2' : '#AEBEC3'
        ctx.fillText(label, x, y + r + 4)
        ctx.shadowBlur = 0
      }
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ao desmontar: salva posições no cache e para a simulação
  useEffect(() => {
    return () => {
      for (const n of nodesMap.current.values()) {
        positionCache.set(n.id, { x: n.x, y: n.y })
      }
      simRef.current?.stop()
    }
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0 touch-none select-none">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
