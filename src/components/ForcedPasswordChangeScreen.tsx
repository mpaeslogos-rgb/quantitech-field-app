import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { changePassword } from '../lib/api'
import { supabase } from '../lib/supabase'

export function ForcedPasswordChangeScreen({ onChanged }: { onChanged: () => void }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await changePassword(password)
      // Trocar a senha invalida a sessão/token atual no Supabase — refaz o
      // login com a nova senha na hora para não deixar o app com um token
      // morto logo em seguida.
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user.email
      if (email) {
        await supabase.auth.signInWithPassword({ email, password })
      }
      onChanged()
    } catch (err: any) {
      setError(err.message ?? 'Erro ao trocar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Quantitech" className="h-10 mx-auto" />
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <h1 className="text-lg font-semibold text-gray-800">Troca de senha obrigatória</h1>
          <p className="text-sm text-gray-500">
            Por segurança, defina uma nova senha antes de continuar.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 text-white font-semibold rounded-lg py-3 text-sm disabled:opacity-60 active:bg-brand-800"
          >
            {loading ? 'Salvando...' : 'Definir nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
