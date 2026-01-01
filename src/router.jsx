// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import FullScreenLoader from './components/FullScreenLoader';
import AppNavbar from './components/AppNavbar';
import ErrorBoundary from './components/ErrorBoundary';
import { DEFAULT_MARKET_ID } from './config/markets';

// Lazy load pages for code splitting
const MarketTable = lazy(() => import('./features/coins/MarketTable'));
const PortfolioPage = lazy(() => import('./features/portfolio/PortfolioPage'));
const CoinList = lazy(() => import('./features/coins/CoinList'));
const AssetDetail = lazy(() => import('./features/asset/AssetDetail'));
const SignalsDashboard = lazy(() => import('./features/signals/SignalsDashboard'));
// const TradingDashboard = lazy(() => import('./App'));
import TradingDashboard from './App';

// Layout wrapper with navigation for sub-pages (not dashboard)
function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AppNavbar />
      <main className="pb-16 md:pb-0">
        <ErrorBoundary>
          <Suspense fallback={<FullScreenLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function DashboardRoute() {
  return (
    <TradingDashboard />
  );
}

// Router configuration - Dashboard is at /trading/:assetId, sub-pages share navigation
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <MarketTable />,
      },
      {
        path: 'portfolio',
        element: <PortfolioPage />,
      },
      {
        path: 'trading/:assetId',
        element: <DashboardRoute />,
      },
      {
        path: 'coins',
        element: <CoinList />,
      },
      {
        path: 'asset/:symbol',
        element: <AssetDetail />,
      },
      {
        path: 'signals',
        element: <SignalsDashboard />,
      },
    ],
  },
  {
    path: '/trading',
    element: <Navigate to={`/trading/${DEFAULT_MARKET_ID}`} replace />,
  },
  {
    path: '/market',
    element: <Navigate to="/" replace />,
  },
]);

// Router provider component
export default function AppRouter() {
  return <RouterProvider router={router} />;
}
