import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Role = 'user' | 'child'
type Session = { role: Role; name: string }

type AuthCtx = {
  session: Session | null
  login: (email: string, password: string, role: Role) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('voice-diary.session')
    if (raw) setSession(JSON.parse(raw))
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    session,
    login: async (email, password, role) => {
      // TODO: 換成呼叫你們後端的 /login
      // const res = await fetch('/api/login', { method:'POST', body: JSON.stringify({email,password}) })
      // const data = await res.json()
      // setSession({ role: data.role, name: data.name })

      // 先假登入：只要有填就過
      const s = { role, name: email.split('@')[0] || '使用者' }
      setSession(s)
      localStorage.setItem('voice-diary.session', JSON.stringify(s))
    },
    logout: () => {
      setSession(null)
      localStorage.removeItem('voice-diary.session')
    },
  }), [session])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
