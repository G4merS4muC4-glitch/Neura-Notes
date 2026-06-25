import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import type { GraphData } from '@/types'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type Props = {
  graph: GraphData
  query: string
  tagColors: Record<string, string>
  onOpen: (id: string) => void
}

const DEFAULT_COLOR = '#5EE6C7'
const LINK_TARGET = 0.3

type Node3D = {
  id: string
  title: string
  degree: number
  tags: string[]
  color: string
}

type NodeObjs = {
  group: THREE.Group
  sphere: THREE.Mesh
  halo: THREE.Mesh
  label: SpriteText
  order: number
}

// coreografia de entrada (ms)
const POP_BASE = 200 // espera a câmera começar a se aproximar
const POP_DUR = 600 // duração do pop de cada nó
const POP_STAGGER = 28 // atraso entre nós
const POP_STAGGER_CAP = 1400 // teto do escalonamento (grafos grandes)
const LINK_FADE_DUR = 700

function radiusOf(degree: number) {
  return 3 + Math.sqrt(degree) * 1.8
}
// pop suave com leve overshoot
function easeOutBack(x: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

export default function GraphView3D({ graph, query, tagColors, onOpen }: Props) {
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [linkOpacity, setLinkOpacity] = useState(reduced ? LINK_TARGET : 0)
  const objs = useRef(new Map<string, NodeObjs>())
  const orderRef = useRef(0)

  const data = useMemo(() => {
    const nodes: Node3D[] = graph.nodes.map((n) => {
      let color = DEFAULT_COLOR
      for (const tag of n.tags) {
        if (tagColors[tag]) {
          color = tagColors[tag]
          break
        }
      }
      return { id: n.id, title: n.title, degree: n.degree, tags: n.tags, color }
    })
    const links = graph.edges.map((e) => ({
      source: typeof e.source === 'string' ? e.source : e.source.id,
      target: typeof e.target === 'string' ? e.target : e.target.id,
    }))
    objs.current.clear()
    orderRef.current = 0
    return { nodes, links }
  }, [graph, tagColors])

  // tamanho responsivo
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // entrada da câmera: voa de longe (de um ângulo) suavemente para dentro
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || size.w === 0) return
    fg.d3Force('charge')?.strength(-130)

    // amortecimento (inércia): câmera desliza e para suave, não "no soco"
    const controls = fg.controls() as {
      enableDamping?: boolean
      dampingFactor?: number
      rotateSpeed?: number
      zoomSpeed?: number
      panSpeed?: number
    }
    if (controls) {
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.rotateSpeed = 0.55
      controls.zoomSpeed = 0.9
      controls.panSpeed = 0.6
    }

    if (reduced) {
      const t = setTimeout(() => fgRef.current?.zoomToFit(300, 90), 200)
      return () => clearTimeout(t)
    }
    fg.cameraPosition({ x: 700, y: 360, z: 1300 }, { x: 0, y: 0, z: 0 }, 0)
    const t = setTimeout(() => fgRef.current?.zoomToFit(1300, 90), 150)
    return () => clearTimeout(t)
  }, [data, size.w, reduced])

  // pop-in escalonado dos nós (relógio único ancorado no início da entrada)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const start = performance.now()
    const tick = () => {
      const now = performance.now()
      let allDone = objs.current.size > 0
      for (const [, o] of objs.current) {
        const offset = POP_BASE + Math.min(o.order * POP_STAGGER, POP_STAGGER_CAP)
        const p = Math.max(0, Math.min(1, (now - start - offset) / POP_DUR))
        o.group.scale.setScalar(Math.max(0.001, easeOutBack(p)))
        if (p < 1) allDone = false
      }
      if (!allDone && now - start < 9000) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [data, reduced])

  // linhas entram DEPOIS que a última bolinha brotou (fade-in da opacidade)
  useEffect(() => {
    if (reduced) {
      setLinkOpacity(LINK_TARGET)
      return
    }
    setLinkOpacity(0)
    const lastNodeDone =
      POP_BASE + Math.min((data.nodes.length - 1) * POP_STAGGER, POP_STAGGER_CAP) + POP_DUR
    const delay = lastNodeDone + 120
    let raf = 0
    const start = performance.now()
    const tick = () => {
      const e = performance.now() - start - delay
      if (e >= LINK_FADE_DUR) {
        setLinkOpacity(LINK_TARGET)
        return
      }
      if (e > 0) setLinkOpacity(LINK_TARGET * (e / LINK_FADE_DUR))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [data, reduced])

  // busca: realça quem combina, esmaece o resto
  useEffect(() => {
    const q = query.trim().toLowerCase()
    for (const [, o] of objs.current) {
      const match = !q || o.label.text.toLowerCase().includes(q)
      ;(o.sphere.material as THREE.MeshBasicMaterial).opacity = match ? 1 : 0.12
      ;(o.halo.material as THREE.MeshBasicMaterial).opacity = match ? 0.18 : 0.02
      o.label.visible = match
    }
  }, [query, data])

  // acessores estáveis (identidade fixa) — senão a lib recria os nós a cada
  // re-render e quebraria o pop-in / mataria a performance.
  const makeNodeObject = useCallback(
    (node: Node3D) => {
      const r = radiusOf(node.degree)
      const group = new THREE.Group()
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(r, 18, 18),
        new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: 1 }),
      )
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.9, 16, 16),
        new THREE.MeshBasicMaterial({
          color: node.color,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
      )
      const label = new SpriteText(node.title)
      label.color = '#D6E2E6'
      label.textHeight = 3.4
      label.fontFace = 'Poppins, sans-serif'
      label.position.set(0, r + 5, 0)
      label.material.depthWrite = false

      group.add(halo)
      group.add(sphere)
      group.add(label)
      if (!reduced) group.scale.setScalar(0.001)

      objs.current.set(node.id, {
        group,
        sphere,
        halo,
        label,
        order: orderRef.current++,
      })
      return group
    },
    [reduced],
  )

  const nodeLabel = useCallback((n: Node3D) => n.title, [])
  const linkColor = useCallback(() => '#6FC9E8', [])
  const handleNodeClick = useCallback(
    (n: { id?: string | number }) => {
      if (n?.id != null) onOpen(String(n.id))
    },
    [onOpen],
  )

  return (
    <motion.div
      ref={wrapRef}
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.15 : 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {size.w > 0 && (
        <ForceGraph3D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="#0F1417"
          showNavInfo={false}
          controlType="orbit"
          warmupTicks={20}
          cooldownTicks={120}
          nodeLabel={nodeLabel as never}
          nodeThreeObject={makeNodeObject as never}
          linkColor={linkColor}
          linkOpacity={linkOpacity}
          linkWidth={0.6}
          enableNodeDrag
          onNodeClick={handleNodeClick as never}
        />
      )}
    </motion.div>
  )
}
