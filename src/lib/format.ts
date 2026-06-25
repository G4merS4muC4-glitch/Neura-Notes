const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

/** Data amigável: "agora", "há 5 min", "ontem", "12 de jun". */
export function formatDate(ts: number): string {
  const diff = Date.now() - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour

  if (diff < min) return 'agora'
  if (diff < hour) return rtf.format(-Math.round(diff / min), 'minute')
  if (diff < day) return rtf.format(-Math.round(diff / hour), 'hour')
  if (diff < 2 * day) return 'ontem'
  if (diff < 7 * day) return rtf.format(-Math.round(diff / day), 'day')
  return dateFmt.format(ts)
}
