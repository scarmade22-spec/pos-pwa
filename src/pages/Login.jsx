import React from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  async function signIn(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function signUp(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={signIn} className="bg-white shadow rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center">Connexion</h1>
        <input required type="email" placeholder="Email" className="w-full border rounded p-2" value={email} onChange={e=>setEmail(e.target.value)} />
        <input required type="password" placeholder="Mot de passe" className="w-full border rounded p-2" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button disabled={loading} className="w-full rounded bg-sky-600 text-white py-2">{loading ? '...' : 'Se connecter'}</button>
        <button type="button" onClick={signUp} className="w-full rounded border py-2">Créer un compte</button>
      </form>
    </div>
  )
}
