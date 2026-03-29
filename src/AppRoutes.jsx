import { Route, Routes } from 'react-router-dom'
import WatchRoomApp from './WatchRoomApp'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import FriendsPage from './pages/FriendsPage'
import ProfilePage from './pages/ProfilePage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/friends" element={<FriendsPage />} />
      <Route path="/u/:username" element={<ProfilePage />} />
      <Route path="/watch" element={<WatchRoomApp />} />
    </Routes>
  )
}

export default AppRoutes
