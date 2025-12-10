import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Layout from '@/components/layout/Layout'

// Lazy load pages
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const BacktestPage = lazy(() => import('@/pages/BacktestPage'))
const ScannerPage = lazy(() => import('@/pages/ScannerPage'))
const PotentialPage = lazy(() => import('@/pages/PotentialPage'))
const ComparePage = lazy(() => import('@/pages/ComparePage'))

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-pulse text-neutral-light/60 text-lg">載入中...</div>
  </div>
)

// Error component for 404 and other errors
const NotFound = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-dark text-neutral-light">
    <h1 className="text-4xl font-bold mb-4">404</h1>
    <p className="text-lg mb-6">找不到頁面</p>
    <a href={import.meta.env.BASE_URL} className="px-4 py-2 bg-primary-main text-white rounded hover:bg-primary-dark transition">
      返回首頁
    </a>
  </div>
)

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <NotFound />,
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
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
], {
  basename: import.meta.env.BASE_URL,
})

export default router
