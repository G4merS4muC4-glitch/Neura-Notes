import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bold } from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import { applyWeight } from '@/editor/commands'
import { haptic } from '@/hooks/useHaptics'
import { springPhysical } from '@/lib/motion'

type Props = { view: EditorView | null }

// de cima para baixo no balão (Negrito fica embaixo, perto do botão)
const OPTIONS = [
  { label: 'Médio', weight: 500 },
  { label: 'Semibold', weight: 600 },
  { label: 'Negrito', weight: 700 },
]
const DEFAULT_INDEX = OPTIONS.length - 1 // Negrito
const LONG_PRESS = 260

export default function WeightButton({ view }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(DEFAULT_INDEX)
  const timer = useRef<number | null>(null)
  const opened = useRef(false)
  const optionEls = useRef<(HTMLDivElement | null)[]>([])

  const apply = (weight: number) => {
    if (view) applyWeight(view, weight)
  }

  const clearTimer = () => {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    opened.current = false
    setActive(DEFAULT_INDEX)
    timer.current = window.setTimeout(() => {
      opened.current = true
      setOpen(true)
      haptic(12)
    }, LONG_PRESS)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!opened.current) return
    // seleciona a opção cujo centro vertical está mais próximo do dedo
    let best = active
    let bestD = Infinity
    optionEls.current.forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const d = Math.abs((r.top + r.bottom) / 2 - e.clientY)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best !== active) {
      setActive(best)
      haptic(5)
    }
  }

  const onPointerUp = () => {
    clearTimer()
    if (opened.current) {
      apply(OPTIONS[active].weight)
      haptic(10)
      setOpen(false)
      opened.current = false
    } else {
      apply(700) // toque rápido = negrito
      haptic(6)
    }
  }

  const onPointerCancel = () => {
    clearTimer()
    setOpen(false)
    opened.current = false
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute bottom-full left-1/2 mb-3 flex w-40 -translate-x-1/2 flex-col gap-1 rounded-lg border border-[var(--border-strong)] p-1.5 shadow-soft"
          >
            {OPTIONS.map((o, i) => (
              <div
                key={o.weight}
                ref={(el) => (optionEls.current[i] = el)}
                className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors ${
                  active === i ? 'bg-accent/15 text-accent' : 'text-text-secondary'
                }`}
              >
                <span style={{ fontWeight: o.weight }}>{o.label}</span>
                <span className="text-[11px] opacity-60">{o.weight}</span>
              </div>
            ))}
            <div className="px-3 pb-1 pt-0.5 text-center text-[10px] text-text-muted">
              arraste e solte
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label="Negrito (segure para escolher o peso)"
        title="Negrito · segure para escolher o peso"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        whileTap={{ scale: 0.88 }}
        transition={springPhysical}
        className={`grid h-11 w-11 touch-none place-items-center rounded-pill transition-colors ${
          open
            ? 'bg-bg-hover text-accent shadow-glow'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary active:text-accent'
        }`}
      >
        <Bold size={20} />
      </motion.button>
    </div>
  )
}
