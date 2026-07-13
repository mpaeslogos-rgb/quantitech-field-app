import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { markLoginEvent } from './lib/authEvents'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { History } from './pages/History'
import { OfflineIndicator } from './components/OfflineIndicator'

type Page = 'home' | 'history'

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [page, setPage] = useState<Page>('home')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN') { markLoginEvent(); setSession(s) }
      else if (event === 'TOKEN_REFRESHED') setSession(s)
      if (event === 'SIGNED_OUT') setSession(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <>
      <OfflineIndicator />
      {page === 'home' && <Home onNavigate={setPage} />}
      {page === 'history' && <History onNavigate={setPage} />}
    </>
  )
}

export default App
