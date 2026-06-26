import { type EditorState, type Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  startCompletion,
} from '@codemirror/autocomplete'

const WIKILINK = /\[\[([^\]\n]+?)\]\]/g

function cursorTouches(state: EditorState, from: number, to: number): boolean {
  for (const r of state.selection.ranges) if (r.from <= to && r.to >= from) return true
  return false
}

const hidden = Decoration.replace({})

function build(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const { state } = view
  for (const { from, to } of view.visibleRanges) {
    const text = state.doc.sliceString(from, to)
    let m: RegExpExecArray | null
    WIKILINK.lastIndex = 0
    while ((m = WIKILINK.exec(text))) {
      const start = from + m.index
      const end = start + m[0].length
      const title = m[1].split('|')[0].trim()
      const display = m[1].includes('|') ? m[1].split('|')[1].trim() : m[1].trim()
      ranges.push(
        Decoration.mark({
          class: 'cm-wikilink',
          attributes: { 'data-wikilink': title },
        }).range(start, end),
      )
      if (!cursorTouches(state, start, end)) {
        // esconde os colchetes e (se houver) o alias, deixando só o texto
        ranges.push(hidden.range(start, start + 2))
        ranges.push(hidden.range(end - 2, end))
        if (m[1].includes('|')) {
          const pipe = start + 2 + m[1].indexOf('|')
          ranges.push(hidden.range(pipe, end - 2 - display.length))
        }
      }
    }
  }
  ranges.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)
  return Decoration.set(ranges, true)
}

export const wikilinkDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)

/** Abre a nota ao clicar num [[wikilink]] renderizado. */
export function wikilinkClicks(onOpen: (title: string) => void) {
  return EditorView.domEventHandlers({
    mousedown(e) {
      const el = (e.target as HTMLElement)?.closest('.cm-wikilink') as HTMLElement | null
      const title = el?.getAttribute('data-wikilink')
      if (title) {
        e.preventDefault()
        onOpen(title)
        return true
      }
      return false
    },
  })
}

/** Autocomplete de [[wikilinks]]: notas existentes + "criar nova nota". */
export function wikilinkCompletion(opts: {
  getTitles: () => string[]
  onCreate: (title: string) => void
}) {
  function source(ctx: CompletionContext): CompletionResult | null {
    const before = ctx.matchBefore(/\[\[([^\]\n]*)$/)
    if (!before) return null
    const typed = before.text.slice(2) // remove "[["
    // Insere "Título]]" e, se já houver "]]" logo após o cursor
    // (ex.: inserido pelo botão da toolbar), absorve-o para não duplicar.
    const insertLink = (title: string) => (view: EditorView, _c: Completion, from: number, to: number) => {
      let end = to
      if (view.state.sliceDoc(to, to + 2) === ']]') end = to + 2
      view.dispatch({
        changes: { from, to: end, insert: title + ']]' },
        selection: { anchor: from + title.length + 2 },
        userEvent: 'input',
      })
    }
    // getTitles() já vem ordenado por uso (mais recente primeiro). O boost
    // decrescente faz a lista do autocomplete seguir essa ordem (último usado
    // no topo) em vez da ordem alfabética padrão do CodeMirror.
    const titles = opts.getTitles()
    const n = titles.length
    const options: Completion[] = titles.map((title, i) => ({
      label: title,
      type: 'class',
      boost: Math.max(-50, n - i), // recente = boost maior = aparece antes
      apply: insertLink(title),
    }))
    const exact = titles.some((t) => t.trim().toLowerCase() === typed.trim().toLowerCase())
    if (typed.trim() && !exact) {
      const title = typed.trim()
      options.push({
        label: `＋ Criar nota: “${title}”`,
        type: 'keyword',
        boost: -99, // "criar nova" fica por último
        apply: (view, _c, from, to) => {
          insertLink(title)(view, _c, from, to)
          opts.onCreate(title)
        },
      })
    }
    return {
      from: before.from + 2,
      options,
      filter: true,
    }
  }
  return autocompletion({
    override: [source],
    activateOnTyping: true,
    icons: false,
    closeOnBlur: true,
  })
}

/** Dispara o autocomplete (usado pelo botão [[ ]] da toolbar). */
export function triggerWikilinkComplete(view: EditorView) {
  startCompletion(view)
}
