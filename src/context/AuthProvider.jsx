import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchMe,
  getStoredToken,
  login as apiLogin,
  mergeLocalSavedRoomsToServer,
  setStoredToken,
  signup as apiSignup,
} from '../lib/socialApi'
import { resetSavedRoomApiThrottle } from '../lib/savedRoomsDirectory'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await fetchMe()
      setUser(me)
    } catch (error) {
      const status = Number(error?.status || 0)
      if (status === 401 || status === 403) {
        setStoredToken(null)
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signup = useCallback(async (payload) => {
    const data = await apiSignup(payload)
    setStoredToken(data.token)
    setUser(data.user)
    void mergeLocalSavedRoomsToServer()
    return data
  }, [])

  const login = useCallback(async (payload) => {
    const data = await apiLogin(payload)
    setStoredToken(data.token)
    setUser(data.user)
    void mergeLocalSavedRoomsToServer()
    return data
  }, [])

  const logout = useCallback(() => {
    setStoredToken(null)
    setUser(null)
    resetSavedRoomApiThrottle()
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      signup,
      login,
      logout,
      refresh,
    }),
    [user, loading, signup, login, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
