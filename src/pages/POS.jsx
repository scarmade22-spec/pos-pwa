import React from 'react';
import { supabase, saveCart, loadCart, queueSale, getPendingSales, clearPendingSale } from '../lib/supabase.js';

export default function POS({ products }) {
  const [cart, setCart] = React.useState([]);

  React.useEffect(() => {
    async function initCart() {
      const saved = await loadCart();
      setCart(saved);
    }
    initCart();
  }, []);

  function addToCart(product) {
    const newCart = [...cart, product];
    setCart(newCart);
    saveCart(newCart);
  }

  async function checkout() {
    try {
      const { error } = await supabase.from('sales').insert([{ items: cart }]);
      if (error) throw error;
      alert('Vente enregistrée !');
    } catch {
      await queueSale({ id: Date.now(), items: cart });
      alert('Pas de connexion, vente sauvegardée offline');
    }
    setCart([]);
    saveCart([]);
  }

  React.useEffect(() => {
    async function syncPending() {
      const pending = await getPendingSales();
      for (const sale of pending) {
        const { error } = await supabase.from('sales').insert([sale]);
        if (!error) await clearPendingSale(sale.id);
      }
    }

    window.addEventListener('online', syncPending);
    return () => window.removeEventListener('online', syncPending);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Caisse</h1>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-white p-4 rounded-2xl shadow space-y-4">
          <h2 className="font-semibold">Panier ({cart.length} articles)</h2>
          <ul className="space-y-2">
            {cart.map((item, i) => (
              <li key={i} className="flex justify-between">
                {item.name} - {(item.price_cents/100).toFixed(2)} $
              </li>
            ))}
          </ul>
          <button className="px-4 py-2 bg-sky-600 text-white rounded" onClick={checkout}>Encaisser</button>
        </div>
        <div className="flex-1 bg-white p-4 rounded-2xl shadow space-y-4">
          <h2 className="font-semibold">Produits disponibles</h2>
          <ul className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <li key={p.id} className="border rounded p-2 flex flex-col items-center">
                {p.image_url && <img src={p.image_url} className="w-16 h-16 object-cover mb-2"/>}
                <div>{p.name}</div>
                <div>{(p.price_cents/100).toFixed(2)} $</div>
                <button className="mt-2 px-2 py-1 bg-sky-500 text-white rounded" onClick={()=>addToCart(p)}>Ajouter</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
