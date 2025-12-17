// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import FullScreenLoader from './components/FullScreenLoader';
import Navigation from './components/Navigation';

// Lazy load pages for code splitting
const CoinList = lazy(() => import('./features/coins/CoinList'));
const AssetDetail = lazy(() => import('./features/asset/AssetDetail'));
const SignalsDashboard = lazy(() => import('./features/signals/SignalsDashboard'));

// Layout wrapper with navigation for sub-pages (not dashboard)
function SubPageLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <main>
        <Suspense fallback={<FullScreenLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

// Router configuration - Dashboard is at root without navigation overlay
// Sub-pages have their own navigation
export const router = createBrowserRouter([
  {
    path: '/coins',
    element: <SubPageLayout />,
    children: [
      {
        index: true,
        element: <CoinList />,
      },
    ],
  },
  {
    path: '/asset/:symbol',
    element: <SubPageLayout />,
    children: [
      {
        index: true,
        element: <AssetDetail />,
      },
    ],
  },
  {
    path: '/signals',
    element: <SubPageLayout />,
    children: [
      {
        index: true,
        element: <SignalsDashboard />,
      },
    ],
  },
]);

// Router provider component
export default function AppRouter() {
  return <RouterProvider router={router} />;
}
