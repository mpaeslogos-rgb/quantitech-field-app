import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchVehicles, fetchProfile, postConsumptionLog } from '../lib/api'
import type { Vehicle, UserProfile } from '../lib/api'
import { enqueue, syncQueue } from '../lib/offlineQueue'

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

  useEffect(() => {
    fetchProfile()
      .then(p => {
        setProfile(p)
        if (p.vehicleId) setVehicleId(p.vehicleId)
      })
      .catch(() => {})
    fetchVehicles().then(setVehicles).catch(() => {})
  }, [])

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

  async function uploadPhoto(file: File): Promise<string | undefined> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return undefined

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `receipts/${session.user.id}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('consumption-receipts').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error

    const { data } = supabase.storage.from('consumption-receipts').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicleId) return

    setSubmitting(true)
    try {
      let photoUrl: string | undefined
      if (photoFile) {
        setUploading(true)
        try { photoUrl = await uploadPhoto(photoFile) } catch { /* store without photo */ }
        setUploading(false)
      }

      const today = new Date().toISOString().split('T')[0]
      const payload = {
        vehicleId,
        date: today,
        source: 'MANUAL' as const,
        litersFueled: parseFloat(liters),
        totalCost: cost ? parseFloat(cost) : undefined,
        odometer: odometer ? parseFloat(odometer) : undefined,
        hourmeter: hourmeter ? parseFloat(hourmeter) : undefined,
        fuelType,
        fuelStation: fuelStation || undefined,
        photoUrl,
        notes: notes || undefined,
      }

      if (navigator.onLine) {
        await postConsumptionLog(payload)
        showToast('success', 'Abastecimento registrado!')
      } else {
        await enqueue(payload)
        showToast('success', 'Salvo offline — será enviado quando conectar.')
      }

      // reset form
      setLiters(''); setCost(''); setOdometer(''); setHourmeter('')
      setFuelStation(''); setNotes(''); setPhotoFile(null); setPhotoPreview(null)
    } catch (err: any) {
      showToast('error', err.message ?? 'Erro ao registrar abastecimento')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedVehicle = vehicles.find(v => v.id === vehicleId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-700 text-white px-4 py-4 flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">Quantitech Field</div>
          <div className="text-blue-200 text-xs">Registro de Abastecimento</div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('history')}
            className="text-blue-200 text-sm underline"
          >
            Histórico
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-blue-200 text-sm underline"
          >
            Sair
          </button>
        </div>
      </header>

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
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Odometer + Hourmeter */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hodômetro (km)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nome do posto"
            />
          </div>
        </div>

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Foto do comprovante</label>
          <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-3 cursor-pointer bg-white hover:bg-gray-50">
            <span className="text-sm text-gray-500">{photoFile ? photoFile.name : 'Tirar foto ou escolher arquivo'}</span>
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Opcional"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !vehicleId}
          className="w-full bg-blue-700 text-white font-semibold rounded-xl py-4 text-base disabled:opacity-60 active:bg-blue-800"
        >
          {uploading ? 'Enviando foto...' : submitting ? 'Registrando...' : 'Registrar Abastecimento'}
        </button>
      </form>
    </div>
  )
}
