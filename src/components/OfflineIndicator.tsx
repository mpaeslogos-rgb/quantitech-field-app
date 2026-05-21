import { useEffect, useState } from 'react'
import { getQueueCount } from '../lib/offlineQueue'

export function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine)
  const [queued, setQueued] = useState(0)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    getQueueCount().then(setQueued)
    const interval = setInterval(() => getQueueCount().then(setQueued), 5000)
    return () => clearInterval(interval)
  }, [])

  if (online && queued === 0) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 text-center text-sm py-1 px-3 ${
      online ? 'bg-yellow-500 text-yellow-900' : 'bg-red-600 text-white'
    }`}>
      {online
        ? `Sincronizando ${queued} registro(s) pendente(s)...`
        : `Offline — ${queued} registro(s) na fila`}
    </div>
  )
}
