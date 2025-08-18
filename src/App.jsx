import React from 'react'
import { NavLink, Routes, Route, useNavigate } from 'react-router-dom'
import Products from './pages/Products.jsx'
import POS from './pages/POS.jsx'
import { supabase } from './lib/supabase.js'

export default function App() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  React.useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email || '')
    })()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-sky-600 text-white p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">PWA POS</h1>
        <div className="text-sm">{email}</div>
      </header>
      <nav className="bg-white border-b">
        <ul className="flex gap-2 p-2">
          <li><NavLink to="/" end className={({isActive}) => (isActive ? 'px-3 py-2 rounded bg-sky-100 text-sky-700' : 'px-3 py-2 rounded hover:bg-slate-100')}>Caisse</NavLink></li>
          <li><NavLink to="/products" className={({isActive}) => (isActive ? 'px-3 py-2 rounded bg-sky-100 text-sky-700' : 'px-3 py-2 rounded hover:bg-slate-100')}>Produits</NavLink></li>
          <li className="ml-auto"><button onClick={signOut} className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300">Déconnexion</button></li>
        </ul>
      </nav>
      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<POS />} />
          <Route path="/products" element={<Products />} />
        </Routes>
      </main>
    </div>
  )
}
