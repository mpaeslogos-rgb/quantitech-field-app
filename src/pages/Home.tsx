import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchVehicles, fetchProfile, postConsumptionLog } from '../lib/api'
import type { Vehicle, UserProfile } from '../lib/api'
import { enqueue, syncQueue } from '../lib/offlineQueue'
import { uploadPhoto } from '../lib/photoUpload'

// Geolocalização é sempre opcional — permissão negada ou timeout nunca
// bloqueia o envio do abastecimento (Fase 1, item 3).
function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    )
  })
}

const FUEL_TYPES = ['DIESEL', 'GASOLINA', 'ETANOL', 'BIODIESEL', 'GNV']

type Page = 'home' | 'history'

interface HomeProps {
  onNavigate: (page: Page) => void
}

export function Home({ onNavigate }: HomeProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleId, setVehicleId] = useState('')
  const [liters, setLiters] = useState('')
  const [cost, setCost] = useState('')
  const [odometer, setOdometer] = useState('')
  const [hourmeter, setHourmeter] = useState('')
  const [fuelType, setFuelType] = useState('DIESEL')
  const [fuelStation, setFuelStation] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [apiError, setApiError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    function loadData() {
      setApiError('')
      fetchProfile()
        .then(p => {
          setProfile(p)
          if (p.vehicleId) setVehicleId(p.vehicleId)
        })
        .catch(() => setApiError('Não foi possível conectar ao servidor. Verifique sua conexão.'))
      fetchVehicles().then(setVehicles).catch(() => {})
    }

    loadData()
    // Refresh when app resumes so driver sees changes made in ERP without logout
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadData() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [retryKey])

  // auto-sync on reconnect
  useEffect(() => {
    const handleOnline = () => syncQueue().catch(() => {})
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicleId) return

    if (!odometer && !hourmeter) {
      showToast('error', 'Informe o hodômetro (km) ou horímetro (h).')
      return
    }

    if (!photoFile) {
      showToast('error', 'Foto do comprovante é obrigatória.')
      return
    }

    setSubmitting(true)
    try {
      const location = await getLocation()

      const today = new Date().toISOString().split('T')[0]
      const basePayload = {
        vehicleId,
        date: today,
        source: 'MANUAL' as const,
        litersFueled: parseFloat(liters),
        totalCost: cost ? parseFloat(cost) : undefined,
        odometer: odometer ? parseFloat(odometer) : undefined,
        hourmeter: hourmeter ? parseFloat(hourmeter) : undefined,
        fuelType,
        fuelStation: fuelStation || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        notes: notes || undefined,
      }

      if (navigator.onLine) {
        // Caminho online: faz upload da foto agora e envia tudo junto —
        // se o upload falhar (ex.: sinal caiu no meio do processo), a foto
        // some silenciosamente e o registro é enviado sem ela.
        setUploading(true)
        let photoUrl: string | undefined
        try { photoUrl = await uploadPhoto(photoFile) } catch { /* segue sem foto, ver nota abaixo */ }
        setUploading(false)
        await postConsumptionLog({ ...basePayload, photoUrl })
        showToast('success', 'Abastecimento registrado!')
      } else {
        // Caminho offline: nunca tenta upload agora (sempre falharia sem
        // rede) — guarda a foto original como Blob e faz o upload só
        // dentro de syncQueue(), quando a conexão voltar.
        await enqueue(basePayload, photoFile)
        showToast('success', 'Salvo offline — será enviado quando conectar.')
      }

      // reset form
      setLiters(''); setCost(''); setOdometer(''); setHourmeter('')
      setFuelStation(''); setNotes(''); setPhotoFile(null); setPhotoPreview(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar abastecimento'
      // Erros de validação (hodômetro/horímetro inválido) ficam no banner persistente
      if (msg.includes('inválido') || msg.includes('inválida')) {
        setApiError(msg)
      } else {
        showToast('error', msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedVehicle = vehicles.find(v => v.id === vehicleId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <img src="/logo.svg" alt="Quantitech" className="h-7 brightness-0 invert" />
          {profile?.fullName && (
            <span className="text-brand-200 text-xs mt-0.5 truncate max-w-[160px]">
              {profile.fullName}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('history')}
            className="text-brand-100 text-sm underline"
          >
            Histórico
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-brand-100 text-sm underline"
          >
            Sair
          </button>
        </div>
      </header>

      {/* API error banner */}
      {apiError && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-lg text-sm bg-red-100 text-red-800 flex items-start justify-between gap-3">
          <span className="leading-snug">{apiError}</span>
          <div className="shrink-0 flex gap-3">
            {!apiError.includes('inválid') && (
              <button onClick={() => setRetryKey(k => k + 1)} className="text-red-700 underline text-xs font-medium">
                Tentar novamente
              </button>
            )}
            <button onClick={() => setApiError('')} className="text-red-700 underline text-xs font-medium">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`mx-4 mt-3 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg mx-auto pb-8">
        {/* Vehicle select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Veículo *</label>
          {profile?.vehicleId ? (
            <div className="flex items-center gap-2 border border-green-300 bg-green-50 rounded-lg px-3 py-3">
              <span className="text-green-700 font-semibold text-sm">
                {profile.vehicle?.plate}{profile.vehicle?.model ? ` — ${profile.vehicle.model}` : ''}
              </span>
              {profile.vehicle?.sector && (
                <span className="text-xs text-green-500">({profile.vehicle.sector})</span>
              )}
              <span className="ml-auto text-xs text-green-400 uppercase tracking-wide">Atribuído</span>
            </div>
          ) : (
            <select
              required
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Selecione um veículo</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate}{v.model ? ` — ${v.model}` : ''}{v.sector ? ` (${v.sector})` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedVehicle && !profile?.vehicleId && (
            <p className="text-xs text-gray-400 mt-1">Tipo: {selectedVehicle.type}</p>
          )}
        </div>

        {/* Liters + Cost */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Litros *</label>
            <input
              type="number"
              required
              min="0.1"
              step="0.01"
              value={liters}
              onChange={e => setLiters(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={e => setCost(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Odometer + Hourmeter */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hodômetro (km) <span className="text-gray-400 font-normal text-xs">*um obrigatório</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              className={`w-full border rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${!odometer && !hourmeter ? 'border-amber-400' : 'border-gray-300'}`}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horímetro (h)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={hourmeter}
              onChange={e => setHourmeter(e.target.value)}
              className={`w-full border rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${!odometer && !hourmeter ? 'border-amber-400' : 'border-gray-300'}`}
              placeholder="0,0"
            />
          </div>
        </div>

        {/* Fuel type + Station */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Combustível</label>
            <select
              value={fuelType}
              onChange={e => setFuelType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posto</label>
            <input
              type="text"
              maxLength={200}
              value={fuelStation}
              onChange={e => setFuelStation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Nome do posto"
            />
          </div>
        </div>

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Foto do comprovante *</label>
          <label className={`flex items-center gap-2 border rounded-lg px-3 py-3 cursor-pointer bg-white hover:bg-gray-50 ${photoFile ? 'border-dashed border-gray-300' : 'border-amber-400 border-dashed'}`}>
            <span className="text-sm text-gray-500">{photoFile ? photoFile.name : 'Tirar foto ou escolher arquivo (obrigatório)'}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </label>
          {photoPreview && (
            <img src={photoPreview} alt="Comprovante" className="mt-2 rounded-lg max-h-40 object-contain border" />
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            placeholder="Opcional"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !vehicleId || !photoFile}
          className="w-full bg-brand-700 text-white font-semibold rounded-xl py-4 text-base disabled:opacity-60 active:bg-brand-800"
        >
          {uploading ? 'Enviando foto...' : submitting ? 'Registrando...' : !photoFile ? 'Anexe a foto do comprovante' : 'Registrar Abastecimento'}
        </button>
      </form>
    </div>
  )
}
