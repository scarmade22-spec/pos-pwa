import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import './styles/index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Products from './pages/Products.jsx'
import POS from './pages/POS.jsx'
import { supabase } from './lib/supabase.js'

// Register SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

function AuthGate({ children }) {
  const [session, setSession] = React.useState(null);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === null) return <div className="p-6">Chargement…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <AuthGate>
            <App />
          </AuthGate>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
