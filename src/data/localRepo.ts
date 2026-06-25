import { openDB, type IDBPDatabase } from 'idb'
import type { Note } from '@/types'
import type { Repository } from './repository'

const DB_NAME = 'neural-notes'
const STORE = 'notes'
const CHANNEL = 'neural-notes-sync'

/**
 * Persistência local com IndexedDB (offline-first).
 * Sincroniza entre abas via BroadcastChannel.
 */
export class LocalRepository implements Repository {
  readonly kind = 'local' as const
  private db: IDBPDatabase | null = null
  private channel: BroadcastChannel | null = null
  private listeners = new Set<(notes: Note[]) => void>()

  async init() {
    this.db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
      },
    })
    if ('BroadcastChannel' in globalThis) {
      this.channel = new BroadcastChannel(CHANNEL)
      this.channel.onmessage = async () => {
        const notes = await this.getAll()
        this.listeners.forEach((cb) => cb(notes))
      }
    }
  }

  private get database(): IDBPDatabase {
    if (!this.db) throw new Error('Repositório não inicializado')
    return this.db
  }

  async getAll(): Promise<Note[]> {
    const all: Note[] = await this.database.getAll(STORE)
    return all.filter((n) => !n.deleted).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async get(id: string): Promise<Note | undefined> {
    return this.database.get(STORE, id)
  }

  async put(note: Note): Promise<void> {
    await this.database.put(STORE, note)
    this.channel?.postMessage({ type: 'put', id: note.id })
  }

  async remove(id: string): Promise<void> {
    const existing = await this.get(id)
    if (existing) {
      await this.database.put(STORE, { ...existing, deleted: true, updatedAt: Date.now() })
    }
    this.channel?.postMessage({ type: 'remove', id })
  }

  subscribe(cb: (notes: Note[]) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}
