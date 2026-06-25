import { type EditorState, type Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'

// <span style="font-weight:600">texto</span>  (peso 100–900)
const WEIGHT_RE = /<span style="font-weight:(\d{3})">([^<]*)<\/span>/g

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
    WEIGHT_RE.lastIndex = 0
    while ((m = WEIGHT_RE.exec(text))) {
      const start = from + m.index
      const end = start + m[0].length
      const weight = m[1]
      const openLen = m[0].indexOf('>') + 1 // até o fim da tag de abertura
      const innerFrom = start + openLen
      const innerTo = end - '</span>'.length

      ranges.push(
        Decoration.mark({ attributes: { style: `font-weight:${weight}` } }).range(
          innerFrom,
          innerTo,
        ),
      )
      // esconde as tags quando o cursor não está editando esse trecho
      if (!cursorTouches(state, start, end) && innerTo > innerFrom) {
        ranges.push(hidden.range(start, innerFrom))
        ranges.push(hidden.range(innerTo, end))
      }
    }
  }
  ranges.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)
  return Decoration.set(ranges, true)
}

/** Renderiza <span style="font-weight:…"> como texto no peso escolhido. */
export const weightDecorations = ViewPlugin.fromClass(
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
