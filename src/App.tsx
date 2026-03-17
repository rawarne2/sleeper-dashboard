import './App.css'
import Dashboard from './Dashboard'
import { Analytics } from '@vercel/analytics/react'

function App() {

  return (
    <>
      <Dashboard />
      <Analytics />
    </>
  )
}

export default App
