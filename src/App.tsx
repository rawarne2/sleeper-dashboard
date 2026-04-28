import { lazy, Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';

const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <>
      <Suspense
        fallback={
          <div className='bg-background-default text-white min-h-screen p-3 flex flex-col justify-center items-center gap-3'>
            <div className='animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-main' />
            <div className='text-gray-300 text-sm sm:text-base'>Loading dashboard…</div>
          </div>
        }
      >
        <Dashboard />
      </Suspense>
      {import.meta.env.PROD && <Analytics />}
    </>
  )
}

export default App
