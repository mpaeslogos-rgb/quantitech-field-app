import { useEffect, useState } from 'react'
import { fetchVehicles, fetchLogs } from '../lib/api'
import type { Vehicle, ConsumptionLog } from '../lib/api'

type Page = 'home' | 'history'

interface HistoryProps {
  onNavigate: (page: Page) => void
}

function fmt(n: number | null | undefined, unit: string) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}`
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function History({ onNavigate }: HistoryProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleId, setVehicleId] = useState('')
  const [logs, setLogs] = useState<ConsumptionLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchVehicles().then(vs => {
      setVehicles(vs)
      if (vs.length > 0) setVehicleId(vs[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!vehicleId) return
    setLoading(true)
    setError('')
    fetchLogs(vehicleId, 60)
      .then(setLogs)
      .catch(() => setError('Sem conexão — verifique a internet'))
      .finally(() => setLoading(false))
  }, [vehicleId])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => onNavigate('home')} className="text-blue-200 text-xl leading-none">←</button>
        <div>
          <div className="font-bold text-lg">Histórico</div>
          <div className="text-blue-200 text-xs">Últimos 60 dias</div>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.plate}{v.model ? ` — ${v.model}` : ''}
            </option>
          ))}
        </select>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {loading && <p className="text-gray-400 text-sm text-center py-8">Carregando...</p>}

        {!loading && logs.length === 0 && !error && (
          <p className="text-gray-400 text-sm text-center py-8">Nenhum registro encontrado.</p>
        )}

        {logs.map(log => (
          <div key={log.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-800">{fmtDate(log.date)}</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {log.source === 'MANUAL' ? 'Manual' : 'Dispositivo'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
              <div><span className="text-gray-400">Litros:</span> {fmt(log.litersFueled, 'L')}</div>
              <div><span className="text-gray-400">Valor:</span> {fmtCurrency(log.totalCost)}</div>
              <div><span className="text-gray-400">Hodômetro:</span> {fmt(log.odometer, 'km')}</div>
              <div><span className="text-gray-400">Horímetro:</span> {fmt(log.hourmeter, 'h')}</div>
              {log.fuelStation && (
                <div className="col-span-2"><span className="text-gray-400">Posto:</span> {log.fuelStation}</div>
              )}
            </div>

            {log.photoUrl && (
              <a href={log.photoUrl} target="_blank" rel="noreferrer"
                className="text-blue-600 text-xs underline">
                Ver comprovante
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
