import { motion } from 'framer-motion'
import { Link2 } from 'lucide-react'
import type { Note } from '@/types'
import { derivePreview, parseTags } from '@/lib/markdown'
import { formatDate } from '@/lib/format'
import { usePrefs } from '@/store/PrefsContext'

type Props = {
  notes: Note[]
  degreeOf: (id: string) => number
  onOpen: (id: string) => void
}

export default function NoteList({ notes, degreeOf, onOpen }: Props) {
  const { colorForTag } = usePrefs()
  const dotFor = (note: Note) => {
    for (const tag of parseTags(note.content)) {
      const c = colorForTag(tag)
      if (c) return c
    }
    return null
  }
  return (
    <div className="flex flex-col gap-3">
      {notes.map((note, i) => {
        const preview = derivePreview(note.content)
        const degree = degreeOf(note.id)
        const dot = dotFor(note)
        return (
          <motion.button
            key={note.id}
            type="button"
            onClick={() => onOpen(note.id)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.985 }}
            className="group w-full rounded-md border border-[var(--border)] bg-bg-surface p-4 text-left
                       transition-colors hover:border-[var(--border-strong)] hover:bg-bg-hover"
          >
            <h3 className="mb-1 flex items-center gap-2 truncate font-semibold text-text-primary">
              {dot && (
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
                />
              )}
              <span className="truncate">{note.title}</span>
            </h3>
            {preview && (
              <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                {preview}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>{formatDate(note.updatedAt)}</span>
              {degree > 0 && (
                <span className="inline-flex items-center gap-1 text-accent-soft">
                  <Link2 size={13} />
                  {degree} {degree === 1 ? 'conexão' : 'conexões'}
                </span>
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
