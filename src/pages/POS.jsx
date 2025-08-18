import React from 'react'
import { supabase } from '../lib/supabase'
import { saveCart, loadCart, queueSale, getPendingSales, clearPendingSale } from '../lib/db'

export default function POS() {
  const [products, setProducts] = React.useState([])
  const [cart, setCart] = React.useState([])
  const [search, setSearch] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [todayTotal, setTodayTotal] = React.useState(0)

  function filtered() {
    const s = search.trim().toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(s))
  }

  React.useEffect(() => {
    loadCart().then(setCart)
    refreshProducts()
    const channel = supabase.channel('sales-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => refreshProducts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sale_items' }, payload => refreshProducts())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  React.useEffect(() => { saveCart(cart) }, [cart])

  async function refreshProducts() {
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (!error) setProducts(data || [])
    // quick daily total report
    const start = new Date(); start.setHours(0,0,0,0)
    const { data: sales, error: e2 } = await supabase
      .from('sales')
      .select('total_cents, created_at')
      .gte('created_at', start.toISOString())
    if (!e2 && sales) setTodayTotal(sales.reduce((s,x)=>s+(x.total_cents||0),0))
  }

  function addToCart(p) {
    setCart(c => {
      const i = c.findIndex(x => x.id === p.id)
      if (i>=0) {
        const copy = [...c]; copy[i] = { ...copy[i], qty: copy[i].qty + 1 }
        return copy
      }
      return [...c, { id: p.id, name: p.name, price_cents: p.price_cents, qty: 1 }]
    })
  }

  function removeFromCart(id) {
    setCart(c => c.filter(x => x.id !== id))
  }

  function inc(id, d) {
    setCart(c => c.map(x => x.id===id ? { ...x, qty: Math.max(1, x.qty + d) } : x))
  }

  async function processPending() {
    const pendings = await getPendingSales()
    for (const s of pendings) {
      try {
        const { error } = await supabase.rpc('create_sale_with_items', { items: s.items })
        if (!error) await clearPendingSale(s.id)
      } catch {}
    }
  }

  async function checkout() {
    if (cart.length === 0) return
    setBusy(true)
    const items = cart.map(c => ({ product_id: c.id, qty: c.qty }))
    const queued = { id: crypto.randomUUID(), items }
    try {
      const { error } = await supabase.rpc('create_sale_with_items', { items })
      if (error) throw error
    } catch (e) {
      // offline: queue it
      await queueSale(queued)
    } finally {
      setBusy(false)
      setCart([])
      await processPending()
    }
  }

  React.useEffect(() => {
    function onlineHandler() { processPending() }
    window.addEventListener('online', onlineHandler)
    return () => window.removeEventListener('online', onlineHandler)
  }, [])

  // Optional barcode via BarcodeDetector if supported
  async function scanBarcode() {
    if (!('BarcodeDetector' in window)) {
      alert('BarcodeDetector non supporté par ce navigateur.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const track = stream.getVideoTracks()[0]
      const imgCapture = new ImageCapture(track)
      const detector = new BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] })
      let foundName = ''
      for (let i=0;i<10;i++) {
        const bitmap = await imgCapture.grabFrame()
        const codes = await detector.detect(bitmap)
        if (codes.length) {
          const code = codes[0].rawValue
          const p = products.find(p => (p.barcode || '') === code)
          if (p) { addToCart(p); foundName = p.name; break }
        }
      }
      track.stop()
      if (!foundName) alert('Aucun produit trouvé pour ce code.')
    } catch (e) {
      alert('Impossible d’utiliser la caméra.')
    }
  }

  const total = cart.reduce((s,x)=>s + x.qty * x.price_cents, 0)

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex gap-2 items-center mb-3">
          <input className="flex-1 border rounded p-2" placeholder="Rechercher un produit..." value={search} onChange={e=>setSearch(e.target.value)} />
          <button onClick={scanBarcode} className="px-3 py-2 rounded border">Scanner</button>
        </div>
        <ul className="grid sm:grid-cols-2 gap-3">
          {filtered().map(p => (
            <li key={p.id} className="border rounded-xl p-3 flex gap-3 items-center">
              {p.image_url ? <img src={p.image_url} className="w-14 h-14 rounded object-cover" /> : <div className="w-14 h-14 rounded bg-slate-200" />}
              <div className="flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-slate-600">{(p.price_cents/100).toFixed(2)} $ • Stock: {p.stock}</div>
              </div>
              <button onClick={()=>addToCart(p)} className="px-3 py-2 rounded bg-sky-600 text-white">+</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-2xl shadow p-4 flex flex-col">
        <h2 className="font-semibold mb-3">Panier</h2>
        <ul className="flex-1 space-y-2 overflow-auto">
          {cart.map(item => (
            <li key={item.id} className="flex items-center gap-2">
              <div className="flex-1">{item.name}</div>
              <div className="flex items-center gap-1">
                <button className="px-2 border rounded" onClick={()=>inc(item.id,-1)}>-</button>
                <span className="w-8 text-center">{item.qty}</span>
                <button className="px-2 border rounded" onClick={()=>inc(item.id,1)}>+</button>
              </div>
              <div className="w-24 text-right">{((item.price_cents*item.qty)/100).toFixed(2)} $</div>
              <button className="text-red-600 ml-2" onClick={()=>removeFromCart(item.id)}>x</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t pt-3 flex items-center justify-between">
          <div className="text-slate-700">Total</div>
          <div className="text-lg font-semibold">{(total/100).toFixed(2)} $</div>
        </div>
        <button disabled={busy || cart.length===0} onClick={checkout} className="mt-3 rounded bg-emerald-600 text-white py-2">
          {busy ? 'Encaissement…' : 'Encaisser'}
        </button>
        <div className="mt-4 text-sm text-slate-600">Chiffre d’affaires du jour: {(todayTotal/100).toFixed(2)} $</div>
      </div>
    </div>
  )
}
