import { StateEffect } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'

/** Efeito de "tick" para limpar marcas expiradas mesmo sem digitação. */
const tick = StateEffect.define<null>()

const LIFETIME = 170 // ms — sincronizado com a animação CSS .cm-typed-char

type Mark = { from: number; to: number; born: number }

/**
 * Micro-animação ao digitar: cada caractere recém-inserido recebe a classe
 * .cm-typed-char (fade-in + leve settle via CSS) por ~170ms. Aplicada por
 * decoration/overlay — nunca re-renderiza o texto inteiro. Degrada sob
 * prefers-reduced-motion (a animação some via CSS).
 */
export const typingAnimation = ViewPlugin.fromClass(
  class {
    marks: Mark[] = []
    decorations: DecorationSet = Decoration.none
    timer: number | null = null

    constructor(_view: EditorView) {}

    update(u: ViewUpdate) {
      const now = performance.now()

      // reposiciona marcas existentes conforme o doc muda
      if (u.docChanged) {
        this.marks = this.marks.map((m) => ({
          ...m,
          from: u.changes.mapPos(m.from, 1),
          to: u.changes.mapPos(m.to, 1),
        }))

        // registra novas inserções vindas de digitação
        const isInput = u.transactions.some(
          (t) => t.isUserEvent('input.type') || t.isUserEvent('input'),
        )
        if (isInput) {
          u.changes.iterChanges((_fa, _ta, fb, tb, inserted) => {
            const len = inserted.length
            if (len > 0 && len <= 8) this.marks.push({ from: fb, to: tb, born: now })
          })
        }
      }

      // descarta expiradas
      this.marks = this.marks.filter((m) => now - m.born < LIFETIME && m.from < m.to)

      this.decorations = this.marks.length
        ? Decoration.set(
            this.marks.map((m) =>
              Decoration.mark({ class: 'cm-typed-char' }).range(m.from, m.to),
            ),
            true,
          )
        : Decoration.none

      // agenda limpeza para quando a digitação parar
      if (this.marks.length && this.timer == null) {
        this.timer = window.setTimeout(() => {
          this.timer = null
          u.view.dispatch({ effects: tick.of(null) })
        }, LIFETIME + 20)
      }
    }

    destroy() {
      if (this.timer != null) clearTimeout(this.timer)
    }
  },
  { decorations: (v) => v.decorations },
)
