import { lazy, Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { ErrorBoundary } from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <>
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className='bg-surface-base text-white min-h-screen p-3 flex flex-col justify-center items-center gap-3'>
              <div className='animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-main' />
              <div className='text-gray-300 text-sm sm:text-base'>Loading dashboard…</div>
            </div>
          }
        >
          <Dashboard />
        </Suspense>
      </ErrorBoundary>
      {import.meta.env.PROD && <Analytics />}
    </>
  )
}

export default App
