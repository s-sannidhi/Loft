import { useEffect } from 'react'
import AppRoutes from '../AppRoutes.jsx'
import OnboardingModal from './OnboardingModal'
import { useAuth } from '../context/useAuth'

/** Fire-and-forget health check so Render-style cold starts begin while the UI paints. */
function useApiWakePing() {
  useEffect(() => {
    const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
    if (!base) return
    void fetch(`${base}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors',
    }).catch(() => {})
  }, [])
}

function AppShell() {
  const { user, loading } = useAuth()
  useApiWakePing()

  return (
    <>
      <AppRoutes />
      {!loading && user?.onboardingComplete === false ? <OnboardingModal /> : null}
    </>
  )
}

export default AppShell
