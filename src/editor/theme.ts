import { EditorView } from '@codemirror/view'

/** Tema mínimo — o grosso do estilo vive no index.css (.cm-*). */
export const neuralTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text-primary)',
      backgroundColor: 'transparent',
      height: '100%',
    },
    // Sobrepõe o monospace padrão do CodeMirror — corpo da nota em Poppins.
    '.cm-scroller': { fontFamily: 'var(--font-editor)' },
    '.cm-content': { fontFamily: 'var(--font-editor)' },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-placeholder': { color: 'var(--text-muted)', fontStyle: 'italic' },
    '.cm-line': { padding: '2px 0' },
    '&.cm-focused .cm-matchingBracket': { backgroundColor: 'rgba(94,230,199,0.18)' },
  },
  { dark: true },
)
