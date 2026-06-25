import type { Transition, Variants } from 'framer-motion'

export const easeExpoOut: [number, number, number, number] = [0.22, 1, 0.36, 1]
export const easeNeutral: [number, number, number, number] = [0.4, 0, 0.2, 1]

export const springPhysical: Transition = { type: 'spring', stiffness: 260, damping: 26 }

/** Transição de página: cross-fade + leve escala + deslize. */
export const pageVariants: Variants = {
  initial: { opacity: 0, scale: 0.98, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.42, ease: easeExpoOut },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -8,
    transition: { duration: 0.28, ease: easeNeutral },
  },
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: easeExpoOut } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.2, ease: easeNeutral } },
}
