import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import { HANDLE_RULES_TEXT, validateStrictUsername } from '../lib/usernameValidate'

function AuthPage({ mode }) {
  const navigate = useNavigate()
  const { login, signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    let signupUsername
    if (mode === 'signup') {
      const vu = validateStrictUsername(username)
      if (!vu.ok) {
        setError(vu.error)
        return
      }
      signupUsername = vu.username
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signup({ email, password, username: signupUsername })
      } else {
        await login({ email, password })
      }
      navigate('/watch', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <SiteHeader />
      <div className="mx-auto w-full max-w-md px-5 py-10">
        <div className="rounded-2xl border border-mutedline border-l-4 border-l-sage bg-card p-8 shadow-cafe-lg">
          <h1 className="text-2xl font-semibold text-ink">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-ink/70">
            {mode === 'signup'
              ? 'Use a unique username your friends can search for.'
              : 'Log in to sync your shelf and friends.'}
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === 'signup' ? (
              <label className="block">
                <span className="text-sm font-medium text-ink">Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
                  autoComplete="username"
                  required
                />
                <p className="meta-font mt-1 text-xs text-ink/55">{HANDLE_RULES_TEXT}</p>
              </label>
            ) : null}
            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-mutedline bg-cream px-3 py-2 text-ink"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
            </label>
            {error ? (
              <p className="text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-cream hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Log in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-ink/70">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-accent underline">
                  Log in
                </Link>
              </>
            ) : (
              <>
                Need an account?{' '}
                <Link to="/signup" className="font-medium text-accent underline">
                  Sign up
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
