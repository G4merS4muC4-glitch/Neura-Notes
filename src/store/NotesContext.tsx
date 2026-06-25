import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Note, GraphData } from '@/types'
import { getRepository, type Repository } from '@/data/repository'
import { buildGraph, deriveTitle, resolveLinks, normalizeTitle } from '@/lib/markdown'

type NotesContextValue = {
  notes: Note[]
  loading: boolean
  backend: 'local' | 'supabase'
  graph: GraphData
  getNote: (id: string) => Note | undefined
  createNote: (seed?: { title?: string; content?: string }) => Promise<Note>
  updateNote: (id: string, content: string) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  /** Encontra (ou cria) uma nota pelo título — usado pelos wikilinks. */
  ensureByTitle: (title: string) => Promise<Note>
}

const NotesContext = createContext<NotesContextValue | null>(null)

function newId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  return 'n_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [backend, setBackend] = useState<'local' | 'supabase'>('local')
  const repoRef = useRef<Repository | null>(null)
  // Espelho síncrono do estado para evitar stale closures nas operações.
  const notesRef = useRef<Note[]>([])
  notesRef.current = notes

  useEffect(() => {
    let unsub: (() => void) | undefined
    let alive = true
    ;(async () => {
      try {
        const repo = await getRepository()
        if (!alive) return
        repoRef.current = repo
        setBackend(repo.kind)
        const all = await repo.getAll()
        if (!alive) return
        setNotes(all)
        unsub = repo.subscribe?.((next) => setNotes(next))
      } catch (err) {
        // não trava a UI no skeleton se algo falhar na inicialização
        console.error('Falha ao carregar notas:', err)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
      unsub?.()
    }
  }, [])

  const persist = useCallback((next: Note[]) => {
    notesRef.current = next
    setNotes(next)
  }, [])

  const getNote = useCallback((id: string) => notesRef.current.find((n) => n.id === id), [])

  const createNote = useCallback<NotesContextValue['createNote']>(async (seed) => {
    const now = Date.now()
    const content = seed?.content ?? (seed?.title ? `# ${seed.title}\n\n` : '')
    const note: Note = {
      id: newId(),
      title: seed?.title ?? deriveTitle(content),
      content,
      createdAt: now,
      updatedAt: now,
      links: [],
    }
    const next = [note, ...notesRef.current]
    persist(next)
    await repoRef.current?.put(note)
    return note
  }, [persist])

  const updateNote = useCallback<NotesContextValue['updateNote']>(
    async (id, content) => {
      const current = notesRef.current
      const idx = current.findIndex((n) => n.id === id)
      if (idx === -1) return
      const prev = current[idx]
      const title = deriveTitle(content)
      const titleChanged = title !== prev.title
      const updated: Note = {
        ...prev,
        content,
        title,
        links: resolveLinks(content, current, id),
        updatedAt: Date.now(),
      }

      let next = current.slice()
      next[idx] = updated

      // Se o título mudou, outras notas podem passar a (não) resolver para esta.
      const toPersist: Note[] = [updated]
      if (titleChanged) {
        next = next.map((n) => {
          if (n.id === id) return n
          const links = resolveLinks(n.content, next, n.id)
          if (links.join(',') !== n.links.join(',')) {
            const re = { ...n, links }
            toPersist.push(re)
            return re
          }
          return n
        })
      }

      persist(next)
      for (const n of toPersist) await repoRef.current?.put(n)
    },
    [persist],
  )

  const deleteNote = useCallback<NotesContextValue['deleteNote']>(
    async (id) => {
      const next = notesRef.current.filter((n) => n.id !== id)
      persist(next)
      await repoRef.current?.remove(id)
    },
    [persist],
  )

  const ensureByTitle = useCallback<NotesContextValue['ensureByTitle']>(
    async (title) => {
      const t = title.trim()
      const norm = normalizeTitle(t)
      const existing = notesRef.current.find((n) => normalizeTitle(n.title) === norm)
      if (existing) return existing
      return createNote({ title: t })
    },
    [createNote],
  )

  const graph = useMemo(() => buildGraph(notes), [notes])

  const value: NotesContextValue = {
    notes,
    loading,
    backend,
    graph,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    ensureByTitle,
  }

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

export function useNotes(): NotesContextValue {
  const ctx = useContext(NotesContext)
  if (!ctx) throw new Error('useNotes deve ser usado dentro de <NotesProvider>')
  return ctx
}
