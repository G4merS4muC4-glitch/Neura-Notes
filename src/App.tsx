import { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { NotesProvider } from '@/store/NotesContext'
import { PrefsProvider } from '@/store/PrefsContext'
import { AuthProvider, useAuth } from '@/store/AuthContext'
import GraphPage from '@/pages/GraphPage'
import AuthPage from '@/pages/AuthPage'
import { pageVariants } from '@/lib/motion'

// Rotas pesadas carregadas sob demanda (CodeMirror, Supabase ficam fora
// do bundle inicial — a home/grafo abre instantânea).
const EditorPage = lazy(() => import('@/pages/EditorPage'))
const ListPage = lazy(() => import('@/pages/ListPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function PageFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-bg-base">
      <div
        className="h-10 w-10 animate-pulse rounded-full"
        style={{ background: 'var(--accent)', boxShadow: '0 0 30px var(--accent-glow)' }}
      />
    </div>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute inset-0"
    >
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </motion.div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="sync" initial={false}>
      <Routes location={location} key={location.pathname.split('/')[1] || 'home'}>
        <Route path="/" element={<Page><GraphPage /></Page>} />
        <Route path="/note/:id" element={<Page><EditorPage /></Page>} />
        <Route path="/list" element={<Page><ListPage /></Page>} />
        <Route path="/settings" element={<Page><SettingsPage /></Page>} />
        <Route path="*" element={<Page><GraphPage /></Page>} />
      </Routes>
    </AnimatePresence>
  )
}

/** Bloqueia o app até logar (quando há Supabase configurado). */
function Gate() {
  const { configured, loading, user } = useAuth()

  if (configured && loading) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-bg-base">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="h-10 w-10 rounded-full"
          style={{ background: 'var(--accent)', boxShadow: '0 0 30px var(--accent-glow)' }}
        />
      </div>
    )
  }

  if (configured && !user) return <AuthPage />

  return (
    <NotesProvider>
      <AnimatedRoutes />
    </NotesProvider>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <PrefsProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </PrefsProvider>
    </MotionConfig>
  )
}
