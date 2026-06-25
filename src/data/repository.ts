import type { Note } from '@/types'

/**
 * Interface única de persistência. Hoje temos a implementação local
 * (IndexedDB). Para ligar o sync em nuvem basta implementar a mesma
 * interface com Supabase — nada acima desta camada precisa mudar.
 */
export interface Repository {
  init(): Promise<void>
  /** Todas as notas vivas (não deletadas). */
  getAll(): Promise<Note[]>
  get(id: string): Promise<Note | undefined>
  /** Upsert (last-write-wins por updatedAt). */
  put(note: Note): Promise<void>
  /** Soft delete. */
  remove(id: string): Promise<void>
  /**
   * Assina mudanças vindas de outras fontes (ex.: realtime/outras abas).
   * Retorna função para cancelar. Opcional nas implementações locais.
   */
  subscribe?(cb: (notes: Note[]) => void): () => void
  /** Identifica o backend ativo (para a tela de Ajustes). */
  readonly kind: 'local' | 'supabase'
}

import { LocalRepository } from './localRepo'
import { isSupabaseConfigured } from './env'

// Promise única e compartilhada: todos os chamadores aguardam o MESMO init.
// Evita corrida (ex.: StrictMode em dev) em que um chamador receberia a
// instância antes do IndexedDB terminar de abrir.
let instancePromise: Promise<Repository> | null = null

/**
 * Factory: usa Supabase quando configurado (.env), senão cai no local.
 * O import do supabaseRepo é dinâmico para não inflar o bundle local.
 */
export function getRepository(): Promise<Repository> {
  if (!instancePromise) {
    instancePromise = (async () => {
      let repo: Repository
      if (isSupabaseConfigured()) {
        const { SupabaseRepository } = await import('./supabaseRepo')
        repo = new SupabaseRepository()
      } else {
        repo = new LocalRepository()
      }
      await repo.init()
      return repo
    })().catch((err) => {
      // permite nova tentativa numa próxima chamada
      instancePromise = null
      throw err
    })
  }
  return instancePromise
}
