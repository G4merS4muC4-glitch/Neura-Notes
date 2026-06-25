import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Check, Loader2, Link2, CornerDownRight, Trash2 } from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import NoteEditor from '@/components/NoteEditor'
import FloatingToolbar from '@/components/FloatingToolbar'
import { useNotes } from '@/store/NotesContext'
import { backlinksOf } from '@/lib/markdown'
import { haptic } from '@/hooks/useHaptics'

type SaveState = 'idle' | 'saving' | 'saved'

export default function EditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { notes, loading, getNote, updateNote, deleteNote, ensureByTitle } = useNotes()
  const note = getNote(id)

  const [view, setView] = useState<EditorView | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [toolbarHidden, setToolbarHidden] = useState(false)
  const [showConnections, setShowConnections] = useState(false)

  const dirty = useRef<string | null>(null)
  const timer = useRef<number | null>(null)

  // nota inexistente após carregar → volta ao grafo
  useEffect(() => {
    if (!loading && !note) navigate('/', { replace: true })
  }, [loading, note, navigate])

  const flush = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (dirty.current != null) {
      updateNote(id, dirty.current)
      dirty.current = null
      setSave('saved')
    }
  }, [id, updateNote])

  // salva ao desmontar (troca de nota / saída)
  useEffect(() => () => flush(), [flush])

  const handleChange = useCallback(
    (content: string) => {
      dirty.current = content
      setSave('saving')
      if (timer.current != null) clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        updateNote(id, content)
        dirty.current = null
        timer.current = null
        setSave('saved')
      }, 600)
    },
    [id, updateNote],
  )

  const goBack = () => {
    haptic(8)
    flush()
    navigate('/')
  }

  const handleDelete = () => {
    if (!note) return
    if (!window.confirm(`Excluir a nota “${note.title}”? Isso não pode ser desfeito.`)) return
    // cancela qualquer save pendente para a nota não "ressuscitar" no unmount
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    dirty.current = null
    haptic(16)
    deleteNote(note.id)
    navigate('/')
  }

  const openTitle = async (title: string) => {
    flush()
    const target = await ensureByTitle(title)
    navigate(`/note/${target.id}`)
  }

  // esconder toolbar ao rolar pra baixo, reaparecer ao subir
  useEffect(() => {
    if (!view) return
    const scroller = view.scrollDOM
    let lastTop = scroller.scrollTop
    const onScroll = () => {
      const top = scroller.scrollTop
      if (top > lastTop + 8 && top > 40) setToolbarHidden(true)
      else if (top < lastTop - 8) setToolbarHidden(false)
      lastTop = top
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [view])

  const getTitles = useCallback(() => notes.map((n) => n.title), [notes])

  const connections = useMemo(() => {
    if (!note) return { out: [], back: [] }
    const out = note.links.map((lid) => getNote(lid)).filter(Boolean) as typeof notes
    const back = backlinksOf(note.id, notes)
    return { out, back }
  }, [note, notes, getNote])

  // swipe da borda esquerda para voltar
  const swipe = useRef<{ x: number; active: boolean }>({ x: 0, active: false })

  if (loading && !note) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg-base">
        <Loader2 className="animate-spin text-accent" />
      </div>
    )
  }
  if (!note) return null

  const hasConnections = connections.out.length + connections.back.length > 0

  return (
    <div className="absolute inset-0 flex flex-col bg-bg-base">
      {/* faixa de swipe (borda esquerda) */}
      <div
        className="absolute inset-y-0 left-0 z-30 w-4"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          swipe.current = { x: e.clientX, active: true }
        }}
        onPointerMove={(e) => {
          if (swipe.current.active && e.clientX - swipe.current.x > 64) {
            swipe.current.active = false
            goBack()
          }
        }}
        onPointerUp={() => (swipe.current.active = false)}
        onPointerCancel={() => (swipe.current.active = false)}
      />

      {/* Top bar */}
      <div
        className="z-20 flex items-center gap-2 px-3 py-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goBack}
          aria-label="Voltar ao grafo"
          className="grid h-10 w-10 place-items-center rounded-pill text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronLeft size={24} />
        </motion.button>

        <div className="flex-1" />

        <AnimatePresence mode="wait">
          <motion.div
            key={save}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 text-xs text-text-muted"
          >
            {save === 'saving' && (
              <>
                <Loader2 size={13} className="animate-spin" /> salvando…
              </>
            )}
            {save === 'saved' && (
              <>
                <Check size={13} className="text-accent-soft" /> salvo
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleDelete}
          aria-label="Excluir nota"
          className="grid h-10 w-10 place-items-center rounded-pill text-text-secondary hover:bg-bg-hover hover:text-danger"
        >
          <Trash2 size={19} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowConnections((v) => !v)}
          aria-label="Conexões"
          className={`grid h-10 w-10 place-items-center rounded-pill transition-colors ${
            showConnections ? 'bg-bg-hover text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <Link2 size={20} />
        </motion.button>
      </div>

      {/* Editor */}
      <div className="relative flex-1 overflow-hidden px-2">
        <NoteEditor
          key={id}
          initialContent={note.content}
          onChange={handleChange}
          onViewReady={setView}
          getTitles={getTitles}
          onOpenWikilink={openTitle}
          onCreateNote={(t) => ensureByTitle(t)}
          placeholder="Comece a escrever…  use [[ para conectar notas"
        />
      </div>

      {/* Painel de conexões */}
      <AnimatePresence>
        {showConnections && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="glass-surface z-20 border-t border-[var(--border)]"
          >
            <div className="max-h-48 overflow-y-auto p-4">
              {!hasConnections && (
                <p className="text-sm text-text-muted">
                  Nenhuma conexão ainda. Use <span className="text-accent">[[</span> no texto para
                  ligar a outra nota.
                </p>
              )}
              {connections.out.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Liga para
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {connections.out.map((n) => (
                      <Chip key={n.id} label={n.title} onClick={() => openTitle(n.title)} />
                    ))}
                  </div>
                </div>
              )}
              {connections.back.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Mencionada por
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {connections.back.map((n) => (
                      <Chip
                        key={n.id}
                        label={n.title}
                        back
                        onClick={() => openTitle(n.title)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FloatingToolbar view={view} hidden={toolbarHidden || showConnections} />
    </div>
  )
}

function Chip({ label, onClick, back }: { label: string; onClick: () => void; back?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] bg-bg-elevated px-3 py-1.5 text-sm text-text-primary transition-colors hover:border-accent-soft hover:text-accent"
    >
      {back && <CornerDownRight size={14} className="text-text-muted" />}
      <span className="max-w-[12rem] truncate">{label}</span>
    </button>
  )
}
