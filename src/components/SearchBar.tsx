import { Search, X } from 'lucide-react'
import { motion } from 'framer-motion'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export default function SearchBar({ value, onChange, placeholder, autoFocus }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex items-center gap-2 rounded-pill border border-[var(--border)]
                 px-4 py-2.5 shadow-soft"
    >
      <Search size={18} className="shrink-0 text-text-muted" />
      <input
        type="search"
        inputMode="search"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar notas…'}
        className="w-full bg-transparent text-[15px] text-text-primary outline-none
                   placeholder:text-text-muted"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onChange('')}
          className="grid h-6 w-6 place-items-center rounded-pill text-text-muted hover:text-text-primary"
        >
          <X size={16} />
        </button>
      )}
    </motion.div>
  )
}
