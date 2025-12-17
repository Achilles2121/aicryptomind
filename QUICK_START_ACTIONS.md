# 🎯 VISION AI MIND - QUICK START ACTIONS

> Sofortige Aktionen für maximalen Impact

---

## 🔴 AKTION 1: App.jsx Aufteilung (KRITISCH)

Das größte Problem: **App.jsx hat 5165 Zeilen** und Cognitive Complexity von 472.

### Schritt-für-Schritt Anleitung:

```bash
# 1. Neue Ordnerstruktur erstellen
mkdir -p src/features/dashboard/components
mkdir -p src/features/coins
mkdir -p src/features/asset
mkdir -p src/features/signals
```

### Was extrahiert werden muss:

| Zeilen | Komponente | Neuer Pfad |
|--------|------------|------------|
| 700-830 | MiniCandles, StatusBadge | `src/shared/ui/` |
| 838-1800 | App Logic (state, effects) | `src/features/dashboard/useDashboard.ts` |
| 1800-2500 | Market Data Loading | `src/hooks/useMarketData.ts` ✅ (existiert) |
| 2500-3500 | Chart Rendering | `src/features/charts/` |
| 3500-4500 | Signal Display | `src/features/signals/SignalPanel.jsx` |
| 4500-5165 | UI Rendering | `src/features/dashboard/DashboardLayout.jsx` |

---

## 🟠 AKTION 2: React Router einrichten

```jsx
// src/router.jsx - NEU ERSTELLEN
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import FullScreenLoader from './components/FullScreenLoader';

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const CoinList = lazy(() => import('./features/coins/CoinList'));
const AssetDetail = lazy(() => import('./features/asset/AssetDetail'));

export const router = createBrowserRouter([
  { 
    path: '/', 
    element: (
      <Suspense fallback={<FullScreenLoader />}>
        <Dashboard />
      </Suspense>
    ) 
  },
  { 
    path: '/coins', 
    element: (
      <Suspense fallback={<FullScreenLoader />}>
        <CoinList />
      </Suspense>
    ) 
  },
  { 
    path: '/asset/:symbol', 
    element: (
      <Suspense fallback={<FullScreenLoader />}>
        <AssetDetail />
      </Suspense>
    ) 
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
```

**Package installieren:**
```bash
npm install react-router-dom
```

---

## 🟡 AKTION 3: Coin Listing API

```typescript
// api/coins.ts - NEU ERSTELLEN
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d?: { price: number[] };
}

let cache: { data: Coin[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return res.status(200).json({ 
        success: true, 
        data: cache.data,
        cached: true 
      });
    }

    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const coins: Coin[] = await response.json();
    
    // Update cache
    cache = { data: coins, timestamp: Date.now() };

    return res.status(200).json({ 
      success: true, 
      data: coins,
      cached: false
    });
  } catch (error) {
    console.error('Coins API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch coins' 
    });
  }
}
```

---

## 🟢 AKTION 4: CoinList Komponente

```jsx
// src/features/coins/CoinList.jsx - NEU ERSTELLEN
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';

function Sparkline({ data, positive }) {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((v, i) => 
    `${(i / data.length) * 100},${100 - ((v - min) / range) * 100}`
  ).join(' ');
  
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-8" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#10b981' : '#ef4444'}
        strokeWidth="2"
      />
    </svg>
  );
}

export default function CoinList() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('market_cap');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetch('/api/coins')
      .then(res => res.json())
      .then(data => {
        if (data.success) setCoins(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = coins
    .filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  if (loading) return <div className="animate-pulse p-8">Loading coins...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Top 100 Cryptocurrencies</h1>
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search coins..."
          className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg border border-gray-700"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="p-3">#</th>
              <th className="p-3">Coin</th>
              <th className="p-3 cursor-pointer" onClick={() => toggleSort('current_price')}>
                Price {sortBy === 'current_price' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 cursor-pointer" onClick={() => toggleSort('price_change_percentage_24h')}>
                24h % {sortBy === 'price_change_percentage_24h' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 cursor-pointer" onClick={() => toggleSort('market_cap')}>
                Market Cap {sortBy === 'market_cap' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3">7d Chart</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((coin, idx) => (
              <tr key={coin.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="p-3 text-gray-400">{idx + 1}</td>
                <td className="p-3">
                  <Link to={`/asset/${coin.symbol.toUpperCase()}`} className="flex items-center gap-2 hover:text-blue-400">
                    <img src={coin.image} alt={coin.name} className="w-6 h-6 rounded-full" />
                    <span className="font-medium">{coin.name}</span>
                    <span className="text-gray-400 text-sm">{coin.symbol.toUpperCase()}</span>
                  </Link>
                </td>
                <td className="p-3">${coin.current_price?.toLocaleString()}</td>
                <td className={`p-3 ${coin.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  <span className="flex items-center gap-1">
                    {coin.price_change_percentage_24h >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    {Math.abs(coin.price_change_percentage_24h || 0).toFixed(2)}%
                  </span>
                </td>
                <td className="p-3">${(coin.market_cap / 1e9).toFixed(2)}B</td>
                <td className="p-3">
                  <Sparkline 
                    data={coin.sparkline_in_7d?.price} 
                    positive={coin.price_change_percentage_24h >= 0} 
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 📊 CHECKLISTE FÜR HEUTE

- [ ] React Router installieren: `npm install react-router-dom`
- [ ] `src/router.jsx` erstellen
- [ ] `api/coins.ts` erstellen
- [ ] `src/features/coins/CoinList.jsx` erstellen
- [ ] Navigation-Links in Header hinzufügen
- [ ] Test: `/coins` Route aufrufen

---

## 🎯 NÄCHSTE SESSION

Nachdem die Coin-Liste funktioniert:

1. **Asset Detail Seite** (`/asset/:symbol`)
2. **Ultra Signal Checklisten-UI**
3. **Fear & Greed Gauge Komponente**
4. **App.jsx systematisch aufteilen**

---

**Frage an den Entwickler:**  
Womit soll ich beginnen?
1. React Router + Coin Listing Seite
2. App.jsx Refactoring  
3. ESLint Errors beheben
4. Fear & Greed Gauge UI
