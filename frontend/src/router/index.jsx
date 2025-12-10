import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from '@/components/layout/Layout'

// Lazy load pages
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const BacktestPage = lazy(() => import('@/pages/BacktestPage'))
const ScannerPage = lazy(() => import('@/pages/ScannerPage'))
const PotentialPage = lazy(() => import('@/pages/PotentialPage'))
const ComparePage = lazy(() => import('@/pages/ComparePage'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-neutral-light/60 text-lg">載入中...</div></div>}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'backtest',
        element: (
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-neutral-light/60 text-lg">載入中...</div></div>}>
            <BacktestPage />
          </Suspense>
        ),
      },
      {
        path: 'scanner',
        element: (
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-neutral-light/60 text-lg">載入中...</div></div>}>
            <ScannerPage />
          </Suspense>
        ),
      },
      {
        path: 'potential',
        element: (
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-neutral-light/60 text-lg">載入中...</div></div>}>
            <PotentialPage />
          </Suspense>
        ),
      },
      {
        path: 'compare',
        element: (
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-neutral-light/60 text-lg">載入中...</div></div>}>
            <ComparePage />
          </Suspense>
        ),
      },
    ],
  },
])

export default router
