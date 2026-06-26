import type { Note } from '@/types'
import type { Repository } from './repository'
import { LocalRepository } from './localRepo'
import { getSupabase } from './supabase'

const TABLE = 'notes'
const OWNER_KEY = 'neural-cache-owner'

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
 * O cache é escopado por usuário: ao trocar de conta o cache é zerado, então
 * uma conta nunca vê as notas de outra no mesmo navegador. As notas criadas
 * antes do primeiro login são "adotadas" pela conta que logar.
 * Conflito resolvido por last-write-wins (updatedAt). Esquema: ver README.
 */
export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const
  private cache = new LocalRepository()
  private listeners = new Set<(notes: Note[]) => void>()
  private userId: string | null = null
  private ownerId: string | null = null // de quem é o cache atual

  async init() {
    await this.cache.init()
    const sb = getSupabase()
    this.ownerId = localStorage.getItem(OWNER_KEY)

    const { data } = await sb.auth.getUser()
    await this.applyUser(data.user?.id ?? null)

    sb.auth.onAuthStateChange((_e, session) => {
      void this.applyUser(session?.user?.id ?? null)
    })

    // Realtime: o RLS já filtra por usuário no servidor
    sb.channel('public:notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, async () => {
        if (this.userId) {
          await this.pull()
          this.emit()
        }
      })
      .subscribe()
  }

  /** Reage a login/logout/troca de conta, mantendo o cache isolado. */
  private async applyUser(uid: string | null) {
    if (uid === this.userId) return
    this.userId = uid

    if (!uid) {
      // logout: limpa o cache da conta anterior
      await this.cache.clear()
      this.ownerId = null
      localStorage.removeItem(OWNER_KEY)
      this.emit()
      return
    }

    if (uid !== this.ownerId) {
      if (this.ownerId === null) {
        // primeiro login neste navegador: adota as notas locais pré-login
        const local = await this.cache.getAll()
        this.ownerId = uid
        localStorage.setItem(OWNER_KEY, uid)
        for (const n of local) await this.upsertRemote(n)
      } else {
        // outra conta: zera o cache para não vazar notas entre contas
        await this.cache.clear()
        this.ownerId = uid
        localStorage.setItem(OWNER_KEY, uid)
      }
    }

    await this.pull()
    this.emit()
  }

  /** Puxa do remoto e mescla no cache (last-write-wins). */
  private async pull() {
    if (!this.userId) return
    const sb = getSupabase()
    const { data, error } = await sb.from(TABLE).select('*').eq('user_id', this.userId)
    if (error || !data) return
    for (const row of data as Row[]) {
      const remote = toNote(row)
      const local = await this.cache.get(remote.id)
      if (!local || remote.updatedAt >= local.updatedAt) await this.cache.put(remote)
    }
  }

  private async upsertRemote(note: Note) {
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
      /* offline: fica no cache até a próxima sincronização */
    })
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
    await this.cache.put(note) // local primeiro (offline-first)
    await this.upsertRemote(note)
  }

  async remove(id: string): Promise<void> {
    await this.cache.remove(id)
    const note = await this.cache.get(id)
    if (note) await this.upsertRemote(note)
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
