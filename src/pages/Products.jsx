import React from 'react'
import { supabase } from '../lib/supabase'

export default function Products() {
  const [items, setItems] = React.useState([])
  const [form, setForm] = React.useState({ name: '', price_cents: 0, stock: 0, image_url: '' })
  const [loading, setLoading] = React.useState(true)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (!error) setItems(data || [])
    setLoading(false)
  }

  React.useEffect(() => {
    load()
    const channel = supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        load()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function saveProduct(e) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    // tenant_id is filled by RLS using profile; but we include upsert with no tenant
    const { error } = await supabase.from('products').insert([{ ...form }])
    if (!error) {
      setForm({ name: '', price_cents: 0, stock: 0, image_url: '' })
      load()
    }
  }

  async function removeProduct(id) {
    await supabase.from('products').delete().eq('id', id)
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-3">Nouveau produit</h2>
        <form onSubmit={saveProduct} className="space-y-3">
          <input className="w-full border rounded p-2" placeholder="Nom" value={form.name} onChange={e=>setForm(s=>({...s, name:e.target.value}))} />
          <input className="w-full border rounded p-2" type="number" placeholder="Prix (centimes)" value={form.price_cents} onChange={e=>setForm(s=>({...s, price_cents:Number(e.target.value)}))} />
          <input className="w-full border rounded p-2" type="number" placeholder="Stock" value={form.stock} onChange={e=>setForm(s=>({...s, stock:Number(e.target.value)}))} />
          <input className="w-full border rounded p-2" placeholder="Image URL (facultatif)" value={form.image_url} onChange={e=>setForm(s=>({...s, image_url:e.target.value}))} />
          <button className="rounded bg-sky-600 text-white px-3 py-2">Enregistrer</button>
        </form>
      </div>
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-3">Produits</h2>
        {loading ? 'Chargement…' : (
          <ul className="grid sm:grid-cols-2 md:grid-cols-2 gap-3">
            {items.map(p => (
              <li key={p.id} className="border rounded-xl p-3 flex gap-3">
                {p.image_url ? <img src={p.image_url} className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-slate-200" />}
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-slate-600">{(p.price_cents/100).toFixed(2)} $ • Stock: {p.stock}</div>
                </div>
                <button onClick={()=>removeProduct(p.id)} className="text-sm text-red-600">Supprimer</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
