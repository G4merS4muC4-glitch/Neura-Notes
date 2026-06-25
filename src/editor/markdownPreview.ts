import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'

/** O cursor (ou seleção) toca o intervalo [from, to]? */
function cursorTouches(state: EditorState, from: number, to: number): boolean {
  for (const r of state.selection.ranges) {
    if (r.from <= to && r.to >= from) return true
  }
  return false
}

const hidden = Decoration.replace({})

const lineDeco = (cls: string) => Decoration.line({ class: cls })
const markDeco = (cls: string) => Decoration.mark({ class: cls })

/**
 * Preview "ao vivo" estilo Obsidian: o markdown renderiza enquanto se escreve;
 * ao posicionar o cursor na marcação, a sintaxe reaparece para edição.
 */
function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const { state } = view
  const doc = state.doc

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name

        // Headings — classe de linha + esconde o "#"
        const headingMatch = /^ATXHeading(\d)$/.exec(name)
        if (headingMatch) {
          const level = headingMatch[1]
          const line = doc.lineAt(node.from)
          ranges.push(lineDeco(`cm-h${level}`).range(line.from))
          const mark = node.node.getChild('HeaderMark')
          if (mark && !cursorTouches(state, line.from, line.to)) {
            let end = mark.to
            if (doc.sliceString(end, end + 1) === ' ') end += 1
            ranges.push(hidden.range(mark.from, end))
          }
          return
        }

        if (name === 'StrongEmphasis' || name === 'Emphasis') {
          const cls = name === 'StrongEmphasis' ? 'cm-strong' : 'cm-em'
          ranges.push(markDeco(cls).range(node.from, node.to))
          if (!cursorTouches(state, node.from, node.to)) {
            for (const m of node.node.getChildren('EmphasisMark')) {
              ranges.push(hidden.range(m.from, m.to))
            }
          }
          return
        }

        if (name === 'InlineCode') {
          ranges.push(markDeco('cm-inline-code').range(node.from, node.to))
          if (!cursorTouches(state, node.from, node.to)) {
            for (const m of node.node.getChildren('CodeMark')) {
              ranges.push(hidden.range(m.from, m.to))
            }
          }
          return
        }

        if (name === 'QuoteMark') {
          const line = doc.lineAt(node.from)
          ranges.push(lineDeco('cm-quote').range(line.from))
          if (!cursorTouches(state, line.from, line.to)) {
            let end = node.to
            if (doc.sliceString(end, end + 1) === ' ') end += 1
            ranges.push(hidden.range(node.from, end))
          }
          return
        }

        if (name === 'ListMark') {
          ranges.push(markDeco('cm-list-mark').range(node.from, node.to))
          return
        }

        if (name === 'FencedCode' || name === 'CodeBlock') {
          const first = doc.lineAt(node.from).number
          const last = doc.lineAt(Math.min(node.to, doc.length)).number
          for (let ln = first; ln <= last; ln++) {
            ranges.push(lineDeco('cm-codeblock').range(doc.line(ln).from))
          }
          return
        }
      },
    })
  }

  ranges.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)
  return Decoration.set(ranges, true)
}

export const markdownPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) {
        this.decorations = buildDecorations(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)
