import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import Settings from '@/components/Settings'

export default function SettingsPage() {
  const navigate = useNavigate()
  return (
    <div className="absolute inset-0 flex flex-col bg-bg-base">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-pill text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronLeft size={24} />
        </motion.button>
        <h1 className="text-lg font-semibold text-text-primary">Ajustes</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Settings />
      </div>
    </div>
  )
}
