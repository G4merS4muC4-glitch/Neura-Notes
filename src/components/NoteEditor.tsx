import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  drawSelection,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { completionKeymap } from '@codemirror/autocomplete'
import { neuralTheme } from '@/editor/theme'
import { markdownPreview } from '@/editor/markdownPreview'
import { typingAnimation } from '@/editor/typingAnim'
import { tagDecorations } from '@/editor/tags'
import { weightDecorations } from '@/editor/weight'
import {
  wikilinkDecorations,
  wikilinkClicks,
  wikilinkCompletion,
} from '@/editor/wikilink'
import { cmd } from '@/editor/commands'

type Props = {
  initialContent: string
  placeholder?: string
  onChange: (content: string) => void
  onViewReady?: (view: EditorView | null) => void
  getTitles: () => string[]
  onOpenWikilink: (title: string) => void
  onCreateNote: (title: string) => void
}

export default function NoteEditor({
  initialContent,
  placeholder,
  onChange,
  onViewReady,
  getTitles,
  onOpenWikilink,
  onCreateNote,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // refs para os callbacks mais recentes (o editor é criado uma única vez)
  const cb = useRef({ onChange, getTitles, onOpenWikilink, onCreateNote })
  cb.current = { onChange, getTitles, onOpenWikilink, onCreateNote }

  useEffect(() => {
    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        markdown(),
        EditorView.lineWrapping,
        drawSelection(),
        history(),
        neuralTheme,
        markdownPreview,
        wikilinkDecorations,
        tagDecorations,
        weightDecorations,
        typingAnimation,
        wikilinkClicks((title) => cb.current.onOpenWikilink(title)),
        wikilinkCompletion({
          getTitles: () => cb.current.getTitles(),
          onCreate: (title) => cb.current.onCreateNote(title),
        }),
        cmPlaceholder(placeholder ?? 'Comece a escrever…'),
        keymap.of([
          { key: 'Mod-b', run: (v) => (cmd.bold(v), true) },
          { key: 'Mod-i', run: (v) => (cmd.italic(v), true) },
          { key: 'Mod-e', run: (v) => (cmd.code(v), true) },
          { key: 'Mod-k', run: (v) => (cmd.link(v), true) },
          ...completionKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) cb.current.onChange(u.state.doc.toString())
        }),
      ],
    })

    const view = new EditorView({ state, parent: hostRef.current! })
    viewRef.current = view
    onViewReady?.(view)

    return () => {
      onViewReady?.(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="h-full w-full overflow-hidden" />
}
