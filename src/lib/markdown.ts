import type { Note, GraphData, GraphEdge } from '@/types'

const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g

/**
 * Normaliza um título para casar wikilinks de forma tolerante:
 * ignora acentos, maiúsculas/minúsculas e espaços extras.
 * Assim `[[Josue]]` conecta com a nota "Josué", e `[[ café ]]` com "Café".
 */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos (acentos)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// #tag — começa com letra/número (após espaço/início), aceita - e _.
// Não casa com headings ("# Título" tem espaço após o #).
const TAG_RE = /(?<![\w#])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu

export function normalizeTag(t: string): string {
  return t.replace(/^#/, '').trim().toLowerCase()
}

/** Extrai as #tags do conteúdo (forma exibida, sem repetir — case-insensitive). */
export function parseTags(content: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(content))) {
    const tag = m[1]
    const key = tag.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(tag)
    }
  }
  return out
}

/** Extrai os títulos referenciados por [[wikilinks]] no conteúdo. */
export function parseWikilinks(content: string): string[] {
  const titles: string[] = []
  let m: RegExpExecArray | null
  WIKILINK_RE.lastIndex = 0
  while ((m = WIKILINK_RE.exec(content))) {
    const raw = m[1].trim()
    // Suporta alias: [[Título|texto exibido]] — usamos só o alvo.
    const target = raw.split('|')[0].trim()
    if (target) titles.push(target)
  }
  return titles
}

/** Deriva o título da nota: primeira linha não vazia, sem o "# " de heading. */
export function deriveTitle(content: string): string {
  const firstLine = content.split('\n').find((l) => l.trim().length > 0) ?? ''
  const stripped = firstLine.replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '').trim()
  return stripped || 'Nota sem título'
}

/** Trecho de pré-visualização: pula o título e pega as primeiras linhas. */
export function derivePreview(content: string, maxLen = 140): string {
  const lines = content.split('\n')
  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0)
  const rest = lines
    .slice(firstNonEmpty + 1)
    .join(' ')
    .replace(/[#>*_`\-]/g, '')
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!rest) return ''
  return rest.length > maxLen ? rest.slice(0, maxLen).trimEnd() + '…' : rest
}

/** Resolve os links de uma nota (títulos -> ids) contra o conjunto atual. */
export function resolveLinks(content: string, notes: Note[], selfId?: string): string[] {
  const byTitle = new Map<string, string>()
  for (const n of notes) {
    if (n.deleted) continue
    byTitle.set(normalizeTitle(n.title), n.id)
  }
  const ids = new Set<string>()
  for (const title of parseWikilinks(content)) {
    const id = byTitle.get(normalizeTitle(title))
    if (id && id !== selfId) ids.add(id)
  }
  return [...ids]
}

/**
 * Constrói o grafo a partir das notas. Re-resolve os wikilinks do conteúdo
 * para que links pendentes passem a conectar assim que a nota-alvo existir.
 */
export function buildGraph(notes: Note[]): GraphData {
  const live = notes.filter((n) => !n.deleted)
  const byTitle = new Map<string, string>()
  for (const n of live) byTitle.set(normalizeTitle(n.title), n.id)

  const ids = new Set(live.map((n) => n.id))
  const degree = new Map<string, number>()
  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = []

  for (const n of live) {
    const targets = new Set<string>()
    for (const title of parseWikilinks(n.content)) {
      const tid = byTitle.get(normalizeTitle(title))
      if (tid && tid !== n.id && ids.has(tid)) targets.add(tid)
    }
    for (const tid of targets) {
      const key = n.id < tid ? `${n.id}|${tid}` : `${tid}|${n.id}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push({ source: n.id, target: tid })
      degree.set(n.id, (degree.get(n.id) ?? 0) + 1)
      degree.set(tid, (degree.get(tid) ?? 0) + 1)
    }
  }

  const nodes = live.map((n) => ({
    id: n.id,
    title: n.title,
    degree: degree.get(n.id) ?? 0,
    tags: parseTags(n.content).map(normalizeTag),
  }))

  return { nodes, edges }
}

/** Quem aponta para a nota `id` (backlinks). */
export function backlinksOf(id: string, notes: Note[]): Note[] {
  return notes.filter((n) => !n.deleted && n.id !== id && n.links.includes(id))
}
