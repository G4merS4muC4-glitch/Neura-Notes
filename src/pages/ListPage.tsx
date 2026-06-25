import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Network, Settings as SettingsIcon, FileText } from 'lucide-react'
import SearchBar from '@/components/SearchBar'
import NoteList from '@/components/NoteList'
import { ListSkeleton } from '@/components/Skeleton'
import { useNotes } from '@/store/NotesContext'
import { haptic } from '@/hooks/useHaptics'
import { springPhysical } from '@/lib/motion'

type Sort = 'recent' | 'az' | 'connected'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recentes' },
  { key: 'az', label: 'A–Z' },
  { key: 'connected', label: 'Mais conectadas' },
]

export default function ListPage() {
  const navigate = useNavigate()
  const { notes, graph, loading, createNote } = useNotes()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')

  const degree = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of graph.nodes) m.set(n.id, n.degree)
    return m
  }, [graph])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = notes.filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
    )
    const sorted = list.slice()
    if (sort === 'recent') sorted.sort((a, b) => b.updatedAt - a.updatedAt)
    if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    if (sort === 'connected')
      sorted.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    return sorted
  }, [notes, query, sort, degree])

  const handleNew = async () => {
    haptic(12)
    const note = await createNote()
    navigate(`/note/${note.id}`)
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-bg-base">
      <div
        className="flex items-center gap-2 px-3 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/')}
          aria-label="Ver grafo"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-pill border border-[var(--border)] bg-bg-elevated text-text-secondary hover:text-text-primary"
        >
          <Network size={20} />
        </motion.button>
        <div className="flex-1">
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/settings')}
          aria-label="Ajustes"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-pill border border-[var(--border)] bg-bg-elevated text-text-secondary hover:text-text-primary"
        >
          <SettingsIcon size={20} />
        </motion.button>
      </div>

      {/* Ordenação */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`whitespace-nowrap rounded-pill border px-3 py-1.5 text-sm transition-colors ${
              sort === s.key
                ? 'border-accent-soft bg-accent/10 text-accent'
                : 'border-[var(--border)] text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {loading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center text-text-muted">
            <FileText size={40} className="mb-3 opacity-50" />
            <p>{query ? 'Nada encontrado por aqui.' : 'Nenhuma nota ainda.'}</p>
          </div>
        ) : (
          <NoteList notes={filtered} degreeOf={(idn) => degree.get(idn) ?? 0} onOpen={(idn) => navigate(`/note/${idn}`)} />
        )}
      </div>

      <motion.button
        type="button"
        onClick={handleNew}
        aria-label="Nova nota"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={springPhysical}
        whileTap={{ scale: 0.9 }}
        className="absolute bottom-6 right-6 grid h-16 w-16 place-items-center rounded-full text-bg-base shadow-glow"
        style={{ background: 'var(--brand-gradient)', marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <Plus size={28} strokeWidth={2.5} />
      </motion.button>
    </div>
  )
}
