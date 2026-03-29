import AppRoutes from '../AppRoutes.jsx'
import OnboardingModal from './OnboardingModal'
import { useAuth } from '../context/useAuth'

function AppShell() {
  const { user, loading } = useAuth()

  return (
    <>
      <AppRoutes />
      {!loading && user?.onboardingComplete === false ? <OnboardingModal /> : null}
    </>
  )
}

export default AppShell
