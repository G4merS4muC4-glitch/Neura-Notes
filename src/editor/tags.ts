import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { type Range } from '@codemirror/state'

const TAG_RE = /(?<![\w#])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu

/** Destaca #tags no editor com a classe .cm-tag (cor de destaque). */
function build(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    let m: RegExpExecArray | null
    TAG_RE.lastIndex = 0
    while ((m = TAG_RE.exec(text))) {
      const start = from + m.index
      ranges.push(Decoration.mark({ class: 'cm-tag' }).range(start, start + m[0].length))
    }
  }
  return Decoration.set(ranges, true)
}

export const tagDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)
