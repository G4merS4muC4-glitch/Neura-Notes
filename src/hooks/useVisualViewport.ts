import { useEffect, useState } from 'react'

/**
 * Acompanha o teclado virtual via visualViewport API.
 * Retorna a altura (px) ocupada pelo teclado na base da tela,
 * para que a toolbar flutuante suba e fique colada acima dele.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      // Quanto da janela está "coberto" embaixo (teclado).
      const covered = window.innerHeight - vv.height - vv.offsetTop
      setOffset(Math.max(0, Math.round(covered)))
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return offset
}
