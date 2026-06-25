import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { normalizeTag } from '@/lib/markdown'

/** Paleta candy para colorir tipos (tags). */
export const TAG_PALETTE: { name: string; hex: string }[] = [
  { name: 'Teal', hex: '#5EE6C7' },
  { name: 'Ciano', hex: '#6FC9E8' },
  { name: 'Azul', hex: '#7AA2F7' },
  { name: 'Roxo', hex: '#B79BFF' },
  { name: 'Rosa', hex: '#F2849E' },
  { name: 'Âmbar', hex: '#F2C879' },
  { name: 'Verde', hex: '#8CE99A' },
  { name: 'Coral', hex: '#FF9E80' },
]

type TagColors = Record<string, string> // chave = tag normalizada

type PrefsValue = {
  tagColors: TagColors
  /** Cor de uma tag (aceita "#tag" ou "tag"). */
  colorForTag: (tag: string) => string | undefined
  setTagColor: (tag: string, hex: string | null) => void
  /** Grafo em 3D (true) ou 2D (false). */
  graph3d: boolean
  setGraph3d: (v: boolean) => void
}

const KEY = 'neural-prefs-v1'
const PrefsContext = createContext<PrefsValue | null>(null)

function loadAll(): { tagColors: TagColors; graph3d: boolean } {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { tagColors: {}, graph3d: false }
    const parsed = JSON.parse(raw)
    return { tagColors: parsed?.tagColors ?? {}, graph3d: Boolean(parsed?.graph3d) }
  } catch {
    return { tagColors: {}, graph3d: false }
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const initial = loadAll()
  const [tagColors, setTagColors] = useState<TagColors>(initial.tagColors)
  const [graph3d, setGraph3d] = useState<boolean>(initial.graph3d)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ tagColors, graph3d }))
    } catch {
      /* armazenamento indisponível — segue sem persistir */
    }
  }, [tagColors, graph3d])

  const colorForTag = useCallback(
    (tag: string) => tagColors[normalizeTag(tag)],
    [tagColors],
  )

  const setTagColor = useCallback((tag: string, hex: string | null) => {
    const key = normalizeTag(tag)
    setTagColors((prev) => {
      const next = { ...prev }
      if (hex) next[key] = hex
      else delete next[key]
      return next
    })
  }, [])

  return (
    <PrefsContext.Provider value={{ tagColors, colorForTag, setTagColor, graph3d, setGraph3d }}>
      {children}
    </PrefsContext.Provider>
  )
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs deve ser usado dentro de <PrefsProvider>')
  return ctx
}
