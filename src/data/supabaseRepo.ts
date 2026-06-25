import type { Note } from '@/types'
import type { Repository } from './repository'
import { LocalRepository } from './localRepo'
import { getSupabase } from './supabase'

const TABLE = 'notes'

type Row = {
  id: string
  title: string
  content: string
  created_at: number
  updated_at: number
  links: string[]
  deleted: boolean
  user_id: string
}

function toNote(r: Row): Note {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    links: r.links ?? [],
    deleted: r.deleted,
  }
}

/**
 * Backend de nuvem (Supabase) com cache local offline-first (write-through).
 * Conflito resolvido por last-write-wins (updatedAt).
 *
 * Esquema esperado (ver README):
 *   create table notes (
 *     id uuid primary key, user_id uuid references auth.users,
 *     title text, content text, links jsonb default '[]',
 *     created_at bigint, updated_at bigint, deleted boolean default false
 *   );
 */
export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const
  private cache = new LocalRepository()
  private listeners = new Set<(notes: Note[]) => void>()
  private userId: string | null = null

  async init() {
    await this.cache.init()
    const sb = getSupabase()
    const { data } = await sb.auth.getUser()
    this.userId = data.user?.id ?? null

    sb.auth.onAuthStateChange(async (_e, session) => {
      this.userId = session?.user?.id ?? null
      if (this.userId) await this.pull()
    })

    if (this.userId) {
      await this.pull()
      sb.channel('public:notes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TABLE },
          async () => {
            await this.pull()
            this.emit()
          },
        )
        .subscribe()
    }
  }

  /** Puxa do remoto e mescla no cache local por last-write-wins. */
  private async pull() {
    if (!this.userId) return
    const sb = getSupabase()
    const { data, error } = await sb.from(TABLE).select('*').eq('user_id', this.userId)
    if (error || !data) return
    for (const row of data as Row[]) {
      const remote = toNote(row)
      const local = await this.cache.get(remote.id)
      if (!local || remote.updatedAt >= local.updatedAt) {
        await this.cache.put(remote)
      }
    }
  }

  private emit() {
    this.getAll().then((notes) => this.listeners.forEach((cb) => cb(notes)))
  }

  async getAll(): Promise<Note[]> {
    return this.cache.getAll()
  }

  async get(id: string): Promise<Note | undefined> {
    return this.cache.get(id)
  }

  async put(note: Note): Promise<void> {
    await this.cache.put(note) // write local primeiro (offline-first)
    if (!this.userId) return
    const sb = getSupabase()
    const row: Partial<Row> = {
      id: note.id,
      user_id: this.userId,
      title: note.title,
      content: note.content,
      links: note.links,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
      deleted: Boolean(note.deleted),
    }
    await sb.from(TABLE).upsert(row).then(undefined, () => {
      /* offline: ficará no cache até a próxima sincronização */
    })
  }

  async remove(id: string): Promise<void> {
    await this.cache.remove(id)
    const note = await this.cache.get(id)
    if (note) await this.put({ ...note, deleted: true, updatedAt: Date.now() })
  }

  subscribe(cb: (notes: Note[]) => void): () => void {
    this.listeners.add(cb)
    const unsubCache = this.cache.subscribe?.(cb)
    return () => {
      this.listeners.delete(cb)
      unsubCache?.()
    }
  }
}
