import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { ConsumptionLogPayload } from './api'
import { postConsumptionLog } from './api'

interface QueuedEntry {
  id?: number
  payload: ConsumptionLogPayload
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

export async function enqueue(payload: ConsumptionLogPayload): Promise<void> {
  const database = await getDb()
  await database.add('queue', { payload, queuedAt: new Date().toISOString() })
}

export async function getQueueCount(): Promise<number> {
  const database = await getDb()
  return database.count('queue')
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const database = await getDb()
  const all = await database.getAll('queue')
  let synced = 0
  let failed = 0

  for (const entry of all) {
    try {
      await postConsumptionLog(entry.payload)
      await database.delete('queue', entry.id!)
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
