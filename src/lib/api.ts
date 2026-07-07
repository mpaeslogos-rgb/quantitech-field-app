import { getAccessToken } from './supabase'

const BASE = import.meta.env.VITE_API_URL as string

async function authHeaders() {
  const token = await getAccessToken()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export interface Vehicle {
  id: string
  plate: string
  type: string
  model?: string
  sector?: string
}

export interface ConsumptionLogPayload {
  vehicleId: string
  date: string
  source: 'MANUAL'
  litersFueled: number
  totalCost?: number
  odometer?: number
  hourmeter?: number
  fuelType?: string
  fuelStation?: string
  photoUrl?: string
  latitude?: number
  longitude?: number
  notes?: string
}

export interface ConsumptionLog extends ConsumptionLogPayload {
  id: string
  createdAt: string
}

export interface UserProfile {
  id: string
  fullName: string
  role: string
  vehicleId: string | null
  vehicle: { id: string; plate: string; model: string | null; type: string; sector: string | null } | null
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch(`${BASE}/auth/me`, { headers: await authHeaders() })
  if (!res.ok) throw new Error('Erro ao carregar perfil')
  return res.json()
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const res = await fetch(`${BASE}/vehicles`, { headers: await authHeaders() })
  if (!res.ok) throw new Error('Erro ao carregar veículos')
  return res.json()
}

export async function postConsumptionLog(payload: ConsumptionLogPayload): Promise<ConsumptionLog> {
  const res = await fetch(`${BASE}/consumption-logs`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[PWA] POST /consumption-logs falhou', res.status, JSON.stringify(err), 'payload:', JSON.stringify(payload))
    const fields = err.errors ? ' — campos: ' + Object.keys(err.errors).join(', ') : ''
    throw new Error((err.message ?? 'Erro ao registrar abastecimento') + fields)
  }
  return res.json()
}

export async function fetchLogs(vehicleId: string, days = 30): Promise<ConsumptionLog[]> {
  const res = await fetch(`${BASE}/consumption-logs/vehicle/${vehicleId}?days=${days}`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error('Erro ao carregar histórico')
  return res.json()
}
