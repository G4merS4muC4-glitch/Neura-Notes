import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { triggerWikilinkComplete } from './wikilink'

/** Envolve a seleção (ou o cursor) com marcadores antes/depois. */
function wrap(view: EditorView, before: string, after = before) {
  const changes = view.state.changeByRange((range) => {
    const text = view.state.sliceDoc(range.from, range.to)
    const insert = before + text + after
    return {
      changes: { from: range.from, to: range.to, insert },
      range: range.empty
        ? EditorSelection.cursor(range.from + before.length)
        : EditorSelection.range(range.from + before.length, range.from + before.length + text.length),
    }
  })
  view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' })
  view.focus()
}

/** Alterna um prefixo no início de cada linha da seleção. */
function lineToggle(view: EditorView, prefix: string) {
  const { state } = view
  const changes: { from: number; insert?: string; to?: number }[] = []
  const seen = new Set<number>()
  for (const range of state.selection.ranges) {
    let lineNo = state.doc.lineAt(range.from).number
    const lastNo = state.doc.lineAt(range.to).number
    for (; lineNo <= lastNo; lineNo++) {
      if (seen.has(lineNo)) continue
      seen.add(lineNo)
      const line = state.doc.line(lineNo)
      if (line.text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
      } else {
        changes.push({ from: line.from, insert: prefix })
      }
    }
  }
  view.dispatch(state.update({ changes, userEvent: 'input' }))
  view.focus()
}

/**
 * Aplica um peso de fonte à seleção.
 * 700+ usa o **negrito** padrão do Markdown; pesos menores usam um
 * <span style="font-weight:…"> que o editor renderiza (e esconde a marcação).
 */
export function applyWeight(v: EditorView, weight: number) {
  if (weight >= 700) wrap(v, '**')
  else wrap(v, `<span style="font-weight:${weight}">`, '</span>')
}

export const cmd = {
  bold: (v: EditorView) => wrap(v, '**'),
  italic: (v: EditorView) => wrap(v, '*'),
  strike: (v: EditorView) => wrap(v, '~~'),
  code: (v: EditorView) => wrap(v, '`'),
  heading: (v: EditorView) => lineToggle(v, '# '),
  list: (v: EditorView) => lineToggle(v, '- '),
  checkbox: (v: EditorView) => lineToggle(v, '- [ ] '),
  quote: (v: EditorView) => lineToggle(v, '> '),
  codeblock: (v: EditorView) => {
    const r = v.state.selection.main
    const text = v.state.sliceDoc(r.from, r.to)
    const insert = '```\n' + text + '\n```'
    v.dispatch({
      changes: { from: r.from, to: r.to, insert },
      selection: { anchor: r.from + 4 + text.length },
      userEvent: 'input',
    })
    v.focus()
  },
  link: (v: EditorView) => {
    const r = v.state.selection.main
    const text = v.state.sliceDoc(r.from, r.to) || 'texto'
    const insert = `[${text}](url)`
    v.dispatch({
      changes: { from: r.from, to: r.to, insert },
      // posiciona o cursor no "url"
      selection: { anchor: r.from + text.length + 3, head: r.from + text.length + 6 },
      userEvent: 'input',
    })
    v.focus()
  },
  wikilink: (v: EditorView) => {
    // Insere só "[[" (sem fechar). O fechamento "]]" vem do autocomplete
    // ao escolher a nota — ou você digita à mão. Evita "[[nome]]]]".
    const r = v.state.selection.main
    v.dispatch({
      changes: { from: r.from, to: r.to, insert: '[[' },
      selection: { anchor: r.from + 2 },
      userEvent: 'input',
    })
    v.focus()
    triggerWikilinkComplete(v)
  },
}

export type CommandKey = keyof typeof cmd
