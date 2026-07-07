import { supabase } from './supabase'

// Extraído de Home.tsx (Fase 1, item 3) para ser reaproveitado por
// offlineQueue.ts — o upload da foto agora acontece dentro de syncQueue()
// quando o envio foi feito offline, não mais incondicionalmente antes do
// branch online/offline.
export async function uploadPhoto(file: File | Blob, ext = 'jpg'): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined

  const fileExt = file instanceof File ? (file.name.split('.').pop() ?? ext) : ext
  const path = `receipts/${session.user.id}/${Date.now()}.${fileExt}`

  const { error } = await supabase.storage.from('consumption-receipts').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from('consumption-receipts').getPublicUrl(path)
  return data.publicUrl
}
