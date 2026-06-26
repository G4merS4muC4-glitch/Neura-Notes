import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Mail, Lock, Loader2, ArrowRight } from 'lucide-react'
import { useAuth } from '@/store/AuthContext'
import { haptic } from '@/hooks/useHaptics'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const { signIn, signUp, signInGoogle } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email || password.length < 6) {
      setError('Informe um e-mail válido e uma senha de pelo menos 6 caracteres.')
      return
    }
    setBusy(true)
    haptic(10)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) setError(traduz(error))
      } else {
        const { error, needsConfirm } = await signUp(email, password)
        if (error) setError(traduz(error))
        else if (needsConfirm)
          setInfo('Conta criada! Confirme o e-mail que enviamos para entrar. ✉️')
        // se needsConfirm for false, o login acontece sozinho (gate libera)
      }
    } finally {
      setBusy(false)
    }
  }

  const swap = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-bg-base px-6 py-10">
      {/* brilho de marca */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-6 grid h-20 w-20 place-items-center rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--accent), var(--accent-2))',
          boxShadow: '0 0 50px var(--accent-glow)',
        }}
      >
        <Sparkles size={28} className="text-bg-base" />
      </motion.div>

      <h1 className="mb-1 text-2xl font-semibold text-text-primary">Neural</h1>
      <p className="mb-7 text-sm text-text-secondary">Suas notas, conectadas — em qualquer lugar.</p>

      {/* alternância login / criar conta */}
      <div className="mb-5 flex rounded-pill border border-[var(--border)] bg-bg-surface p-1">
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => swap(m)}
            className="relative rounded-pill px-5 py-2 text-sm font-medium"
          >
            {mode === m && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 rounded-pill bg-bg-hover"
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              />
            )}
            <span className={`relative ${mode === m ? 'text-accent' : 'text-text-secondary'}`}>
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="w-full max-w-sm">
        <label className="mb-3 flex items-center gap-2 rounded-md border border-[var(--border)] bg-bg-surface px-3 py-3 focus-within:border-accent-soft">
          <Mail size={18} className="shrink-0 text-text-muted" />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>

        <label className="mb-4 flex items-center gap-2 rounded-md border border-[var(--border)] bg-bg-surface px-3 py-3 focus-within:border-accent-soft">
          <Lock size={18} className="shrink-0 text-text-muted" />
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha (mín. 6 caracteres)"
            className="w-full bg-transparent text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 text-sm text-danger"
            >
              {error}
            </motion.p>
          )}
          {info && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 text-sm text-accent"
            >
              {info}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={busy}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2 rounded-md py-3 font-semibold text-bg-base disabled:opacity-60"
          style={{ background: 'var(--brand-gradient)' }}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
              <ArrowRight size={18} />
            </>
          )}
        </motion.button>
      </form>

      <div className="my-5 flex w-full max-w-sm items-center gap-3 text-xs text-text-muted">
        <div className="h-px flex-1 bg-[var(--border)]" />
        ou
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <button
        type="button"
        onClick={() => signInGoogle()}
        className="w-full max-w-sm rounded-md border border-[var(--border-strong)] py-3 font-medium text-text-primary hover:bg-bg-hover"
      >
        Continuar com Google
      </button>

      <p className="mt-8 max-w-sm text-center text-xs text-text-muted">
        Cada conta vê apenas as próprias notas. Seus dados ficam protegidos por linha (RLS) no
        Supabase.
      </p>
    </div>
  )
}

function traduz(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Esse e-mail já tem conta. Tente entrar.'
  if (m.includes('password')) return 'Senha inválida (mínimo 6 caracteres).'
  if (m.includes('email')) return 'E-mail inválido.'
  return msg
}
