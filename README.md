# PWA POS (React + Vite + Supabase)

POS léger utilisable sur ordinateur et mobile. Installable en PWA, synchro temps réel via Supabase Realtime, mode offline (panier + ventes en file d’attente), encaissement atomique via RPC.

## Démarrage

1. **Créer un projet Supabase** (gratuit).
2. Ouvrir le **SQL Editor** et exécuter le fichier `supabase.sql` (voir à la racine).
3. Copier `.env.example` en `.env` et renseigner :
    ```env
    VITE_SUPABASE_URL=...
    VITE_SUPABASE_ANON_KEY=...
    ```
4. Installer et lancer :
    ```bash
    npm install
    npm run dev
    ```
5. Ouvrir l’URL locale, créer un compte (onglet Connexion), puis créer des produits.

## PWA

- `public/manifest.json` + `public/sw.js` assurent l’installation et un cache app‑shell simple.
- Sur mobile, utilisez « Ajouter à l’écran d’accueil ».

## Mode Offline

- Le panier et les ventes non envoyées sont stockés en IndexedDB.
- À la reconnexion, les ventes en file d’attente sont automatiquement renvoyées via la RPC `create_sale_with_items`.

## Realtime

- Les listes Produits et le stock se mettent à jour via `postgres_changes` (Supabase Realtime).

## Bonus

- **Scanner** : tentative avec `BarcodeDetector` si disponible.
- **Rapport** : Total des ventes du jour affiché sur la page Caisse.

## Personnalisation

- Ajoutez un champ `barcode` à la table `products` si souhaité (prévu côté UI).

