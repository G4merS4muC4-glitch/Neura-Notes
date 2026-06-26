import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { normalizeTag } from '@/lib/markdown'
import { useAuth } from '@/store/AuthContext'
import { getSupabase } from '@/data/supabase'

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
  colorForTag: (tag: string) => string | undefined
  setTagColor: (tag: string, hex: string | null) => void
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
  const { configured, user } = useAuth()
  const initial = loadAll()
  const [tagColors, setTagColors] = useState<TagColors>(initial.tagColors)
  const [graph3d, setGraph3d] = useState<boolean>(initial.graph3d)
  const tagColorsRef = useRef(tagColors)
  tagColorsRef.current = tagColors

  // cache local (offline + preferências de view ficam sempre por aqui)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ tagColors, graph3d }))
    } catch {
      /* armazenamento indisponível */
    }
  }, [tagColors, graph3d])

  // sincroniza as cores das tags por conta (Supabase)
  useEffect(() => {
    if (!configured || !user) return
    const sb = getSupabase()
    let alive = true

    sb.from('prefs')
      .select('tag_colors')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error) return
        if (data?.tag_colors) {
          setTagColors(data.tag_colors as TagColors) // remoto manda
        } else {
          // primeira vez nesta conta: adota as cores locais atuais
          void sb
            .from('prefs')
            .upsert({ user_id: user.id, tag_colors: tagColorsRef.current, updated_at: Date.now() })
        }
      })

    // ao vivo entre dispositivos
    const channel = sb
      .channel(`prefs:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prefs', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const tc = (payload.new as { tag_colors?: TagColors } | null)?.tag_colors
          if (tc) setTagColors(tc)
        },
      )
      .subscribe()

    return () => {
      alive = false
      sb.removeChannel(channel)
    }
  }, [configured, user])

  const colorForTag = useCallback((tag: string) => tagColors[normalizeTag(tag)], [tagColors])

  const setTagColor = useCallback(
    (tag: string, hex: string | null) => {
      const key = normalizeTag(tag)
      setTagColors((prev) => {
        const next = { ...prev }
        if (hex) next[key] = hex
        else delete next[key]
        if (configured && user) {
          void getSupabase()
            .from('prefs')
            .upsert({ user_id: user.id, tag_colors: next, updated_at: Date.now() })
        }
        return next
      })
    },
    [configured, user],
  )

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
