import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Italic,
  Heading,
  List,
  CheckSquare,
  Quote,
  Code,
  Link2,
  Braces,
  Strikethrough,
  Brackets,
  MoreHorizontal,
} from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import { cmd, type CommandKey } from '@/editor/commands'
import { useKeyboardOffset } from '@/hooks/useVisualViewport'
import { haptic } from '@/hooks/useHaptics'
import { springPhysical } from '@/lib/motion'
import WeightButton from '@/components/WeightButton'

type Props = {
  view: EditorView | null
  hidden?: boolean
}

function Btn({
  onTap,
  label,
  children,
}: {
  onTap: () => void
  label: string
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        haptic(6)
        onTap()
      }}
      whileTap={{ scale: 0.88 }}
      transition={springPhysical}
      className="grid h-11 w-11 place-items-center rounded-pill text-text-secondary
                 transition-colors hover:text-text-primary hover:bg-bg-hover
                 active:text-accent active:shadow-glow"
    >
      {children}
    </motion.button>
  )
}

export default function FloatingToolbar({ view, hidden }: Props) {
  const keyboard = useKeyboardOffset()
  const [expanded, setExpanded] = useState(false)
  const run = (key: CommandKey) => () => view && cmd[key](view)

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
      initial={false}
      animate={{ y: hidden ? 130 : -keyboard, opacity: hidden ? 0 : 1 }}
      transition={springPhysical}
    >
      <div className="pointer-events-auto w-full max-w-md">
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="row2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-2 flex w-fit items-center gap-1 rounded-pill border border-[var(--border)]
                         glass px-2 py-1.5 shadow-soft"
            >
              {[
                { key: 'quote' as const, label: 'Citação', icon: <Quote size={20} /> },
                { key: 'code' as const, label: 'Código', icon: <Code size={20} /> },
                { key: 'codeblock' as const, label: 'Bloco de código', icon: <Braces size={20} /> },
                { key: 'strike' as const, label: 'Tachado', icon: <Strikethrough size={20} /> },
              ].map((b, i) => (
                <motion.div
                  key={b.key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04, ...springPhysical }}
                >
                  <Btn label={b.label} onTap={run(b.key)}>
                    {b.icon}
                  </Btn>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="flex items-center justify-between gap-0.5 rounded-pill border border-[var(--border)]
                     bg-[var(--bg-elevated)]/80 px-2 py-1.5 shadow-soft backdrop-blur-xl"
        >
          <WeightButton view={view} />
          <Btn label="Itálico (Ctrl+I)" onTap={run('italic')}>
            <Italic size={20} />
          </Btn>
          <Btn label="Título" onTap={run('heading')}>
            <Heading size={20} />
          </Btn>
          <Btn label="Lista" onTap={run('list')}>
            <List size={20} />
          </Btn>
          <Btn label="Checkbox" onTap={run('checkbox')}>
            <CheckSquare size={20} />
          </Btn>
          <Btn label="Link" onTap={run('link')}>
            <Link2 size={20} />
          </Btn>
          <Btn label="Conectar nota [[ ]]" onTap={run('wikilink')}>
            <Brackets size={20} />
          </Btn>
          <motion.button
            type="button"
            aria-label="Mais ações"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              haptic(6)
              setExpanded((v) => !v)
            }}
            whileTap={{ scale: 0.88 }}
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={springPhysical}
            className="grid h-11 w-11 place-items-center rounded-pill text-text-secondary
                       transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <MoreHorizontal size={20} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
