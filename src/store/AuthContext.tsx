import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isSupabaseConfigured } from '@/data/env'
import { getSupabase } from '@/data/supabase'

type AuthUser = { id: string; email?: string }

type AuthValue = {
  /** Há backend de nuvem configurado? Se não, o app roda local sem login. */
  configured: boolean
  loading: boolean
  user: AuthUser | null
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>
  signInGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [loading, setLoading] = useState(configured)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }
    const sb = getSupabase()
    const map = (u: { id: string; email?: string } | null | undefined) =>
      u ? { id: u.id, email: u.email } : null

    sb.auth.getSession().then(({ data }) => {
      setUser(map(data.session?.user))
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(map(session?.user))
    })
    return () => sub.subscription.unsubscribe()
  }, [configured])

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    return { error: error?.message }
  }

  const signUp: AuthValue['signUp'] = async (email, password) => {
    const { data, error } = await getSupabase().auth.signUp({ email, password })
    if (error) return { error: error.message }
    // Se "Confirm email" estiver ligado no Supabase, não há sessão ainda.
    return { needsConfirm: !data.session }
  }

  const signInGoogle: AuthValue['signInGoogle'] = async () => {
    await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut: AuthValue['signOut'] = async () => {
    await getSupabase().auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ configured, loading, user, signIn, signUp, signInGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
