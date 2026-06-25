export type Note = {
  id: string // uuid
  title: string
  content: string // markdown
  createdAt: number
  updatedAt: number
  /**
   * Conexões derivadas dos [[wikilinks]] no content, persistidas para o grafo.
   * Guarda ids de notas para as quais aponta.
   */
  links: string[]
  /** Marca de exclusão para sincronização (soft delete). */
  deleted?: boolean
}

export type GraphNode = {
  id: string
  title: string
  degree: number
  /** Tags (#tag) da nota, normalizadas — usadas para colorir o nó. */
  tags: string[]
  /** Posição/velocidade preenchidas pela simulação d3-force. */
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export type GraphEdge = {
  source: string | GraphNode
  target: string | GraphNode
}

export type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
