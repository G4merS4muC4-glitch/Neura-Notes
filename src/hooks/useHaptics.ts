/** Vibração háptica leve em ações-chave (quando suportada). */
export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* ignora */
    }
  }
}
