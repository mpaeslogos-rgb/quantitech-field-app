import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { ConsumptionLogPayload } from './api'
import { postConsumptionLog } from './api'
import { uploadPhoto } from './photoUpload'

interface QueuedEntry {
  id?: number
  payload: ConsumptionLogPayload
  // Foto original, guardada como Blob quando o envio acontece offline —
  // o upload para o Supabase Storage só é feito dentro de syncQueue(),
  // quando a conexão volta (Fase 1, item 3: antes disso, uploadPhoto()
  // era chamado incondicionalmente antes do branch online/offline e
  // falhava silenciosamente offline, perdendo a foto original).
  photoBlob?: Blob
  queuedAt: string
}

interface QueueDB extends DBSchema {
  queue: { key: number; value: QueuedEntry }
}

let db: IDBPDatabase<QueueDB> | null = null

async function getDb() {
  if (!db) {
    db = await openDB<QueueDB>('qt-offline-queue', 1, {
      upgrade(database) {
        database.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      },
    })
  }
  return db
}

export async function enqueue(payload: ConsumptionLogPayload, photoBlob?: Blob): Promise<void> {
  const database = await getDb()
  await database.add('queue', { payload, photoBlob, queuedAt: new Date().toISOString() })
}

export async function getQueueCount(): Promise<number> {
  const database = await getDb()
  return database.count('queue')
}

export async function clearQueue(): Promise<void> {
  const database = await getDb()
  await database.clear('queue')
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const database = await getDb()
  const all = await database.getAll('queue')
  let synced = 0
  let failed = 0

  for (const entry of all) {
    // Entrada corrompida (sem vehicleId) nunca vai conseguir sincronizar —
    // remove da fila, mas conta como falha em vez de sumir sem rastro, para
    // o usuário/telemetria saberem que um lançamento se perdeu.
    if (!entry.payload.vehicleId) {
      console.error('[offlineQueue] entrada sem vehicleId descartada', entry)
      await database.delete('queue', entry.id!)
      failed++
      continue
    }
    try {
      let payload = entry.payload
      if (entry.photoBlob && !payload.photoUrl) {
        // Se o upload falhar aqui (ainda sem sinal, erro do Storage), a
        // exceção cai no catch abaixo e o item permanece na fila para a
        // próxima tentativa — nunca envia sem a foto original silenciosamente.
        const photoUrl = await uploadPhoto(entry.photoBlob)
        payload = { ...payload, photoUrl }
      }
      await postConsumptionLog(payload)
      await database.delete('queue', entry.id!)
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
