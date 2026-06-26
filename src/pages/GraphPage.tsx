import { Suspense, lazy, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, List, Settings as SettingsIcon, Sparkles, Orbit } from 'lucide-react'
import GraphView from '@/components/GraphView'
import SearchBar from '@/components/SearchBar'
import { useNotes } from '@/store/NotesContext'
import { usePrefs } from '@/store/PrefsContext'
import { haptic } from '@/hooks/useHaptics'
import { springPhysical } from '@/lib/motion'

// Motor 3D (Three.js) carregado sob demanda — não pesa a abertura do app.
const GraphView3D = lazy(() => import('@/components/GraphView3D'))

export default function GraphPage() {
  const navigate = useNavigate()
  const { graph, notes, loading, createNote } = useNotes()
  const { tagColors, graph3d, setGraph3d } = usePrefs()
  const [query, setQuery] = useState('')
  const [showHint, setShowHint] = useState(true)

  const empty = !loading && notes.length === 0

  // a dica de uso some sozinha depois de alguns segundos
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000)
    return () => clearTimeout(t)
  }, [graph3d])

  const handleNew = async () => {
    haptic(12)
    const note = await createNote()
    navigate(`/note/${note.id}`)
  }

  const openNote = (id: string) => {
    haptic(10)
    navigate(`/note/${id}`)
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-bg-base">
      {!empty &&
        (graph3d ? (
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center">
                <div
                  className="h-10 w-10 animate-pulse rounded-full"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 30px var(--accent-glow)' }}
                />
              </div>
            }
          >
            <GraphView3D graph={graph} query={query} tagColors={tagColors} onOpen={openNote} />
          </Suspense>
        ) : (
          <GraphView graph={graph} query={query} tagColors={tagColors} onOpen={openNote} />
        ))}

      {/* Barra superior: lista / busca / ajustes */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/list')}
          aria-label="Ver lista"
          className="glass pointer-events-auto grid h-11 w-11 place-items-center rounded-pill border border-[var(--border)] text-text-secondary shadow-soft hover:text-text-primary"
        >
          <List size={20} />
        </motion.button>
        <div className="pointer-events-auto flex-1">
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar no grafo…" />
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            haptic(8)
            setGraph3d(!graph3d)
          }}
          aria-label={graph3d ? 'Ver em 2D' : 'Ver em 3D'}
          title={graph3d ? 'Ver em 2D' : 'Ver em 3D'}
          className={`glass pointer-events-auto flex h-11 items-center gap-1.5 rounded-pill border border-[var(--border)] px-3 shadow-soft transition-colors ${
            graph3d ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Orbit size={20} />
          <span className="text-sm font-semibold">{graph3d ? '3D' : '2D'}</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/settings')}
          aria-label="Ajustes"
          className="glass pointer-events-auto grid h-11 w-11 place-items-center rounded-pill border border-[var(--border)] text-text-secondary shadow-soft hover:text-text-primary"
        >
          <SettingsIcon size={20} />
        </motion.button>
      </div>

      {/* Estado vazio acolhedor */}
      <AnimatePresence>
        {empty && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-6 grid h-24 w-24 place-items-center rounded-full"
              style={{
                background: 'radial-gradient(circle, var(--accent), var(--accent-2))',
                boxShadow: '0 0 60px var(--accent-glow)',
              }}
            >
              <Sparkles size={32} className="text-bg-base" />
            </motion.div>
            <h1 className="mb-2 text-2xl font-semibold text-text-primary">Seu cérebro, em rede</h1>
            <p className="max-w-xs text-text-secondary">
              Crie sua primeira nota e veja as conexões nascerem. Toque no{' '}
              <span className="text-accent">+</span> aqui embaixo.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading discreto */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="h-10 w-10 rounded-full"
            style={{ background: 'var(--accent)', boxShadow: '0 0 30px var(--accent-glow)' }}
          />
        </div>
      )}

      {/* Dica de uso, discreta — acima do FAB e some sozinha */}
      <AnimatePresence>
        {!empty && !loading && notes.length > 0 && showHint && (
          <motion.div
            key={graph3d ? '3d' : '2d'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)' }}
          >
            <span
              className="max-w-[80%] truncate rounded-pill px-3 py-1 text-center text-xs text-text-muted backdrop-blur-md"
              style={{ background: 'rgba(29,38,44,0.7)' }}
            >
              {graph3d
                ? 'Arraste para girar · scroll para zoom · clique num nó para abrir'
                : 'Toque num nó para abrir · segure e arraste para mover'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB criar nota */}
      <motion.button
        type="button"
        onClick={handleNew}
        aria-label="Nova nota"
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={springPhysical}
        whileTap={{ scale: 0.9 }}
        className="absolute bottom-6 right-6 z-30 grid h-16 w-16 place-items-center rounded-full text-bg-base shadow-glow"
        style={{
          background: 'var(--brand-gradient)',
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>
    </div>
  )
}
