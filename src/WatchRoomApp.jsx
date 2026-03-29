import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CreateRoomView from './components/CreateRoomView'
import MovieGrid from './components/MovieGrid'
import MovieSearch from './components/MovieSearch'
import StatusPopup from './components/StatusPopup'
import TopBar from './components/TopBar'
import { createRoom, getMovieDetails, getRoom, updateRoom } from './lib/api'
import { putWatched } from './lib/socialApi'
import { useAuth } from './context/useAuth'

const POLLING_MS = 5000

function WatchRoomApp() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const roomId = searchParams.get('room')
  const { user } = useAuth()

  const [creatingRoom, setCreatingRoom] = useState(false)
  const [loadingRoom, setLoadingRoom] = useState(Boolean(roomId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [roomData, setRoomData] = useState({
    roomName: 'Loft',
    movies: [],
  })
  const roomDataRef = useRef(roomData)
  const progressPersistTimers = useRef({})

  useEffect(() => {
    roomDataRef.current = roomData
  }, [roomData])

  useLayoutEffect(() => {
    if (!roomId) {
      setLoadingRoom(false)
      return
    }
    setLoadingRoom(true)
  }, [roomId])

  const syncRoom = useCallback(async () => {
    if (!roomId) {
      return
    }
    const remote = await getRoom(roomId)
    setRoomData((current) => {
      const remoteStr = JSON.stringify(remote)
      const currentStr = JSON.stringify(current)
      return remoteStr === currentStr ? current : remote
    })
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      return
    }
    let cancelled = false

    async function load() {
      try {
        setLoadingRoom(true)
        setError('')
        const remote = await getRoom(roomId)
        if (!cancelled) {
          setRoomData(remote)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message)
        }
      } finally {
        if (!cancelled) {
          setLoadingRoom(false)
        }
      }
    }

    load()
    const interval = window.setInterval(() => {
      syncRoom().catch(() => {})
    }, POLLING_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [roomId, syncRoom])

  async function persistRoomToServer(data) {
    if (!roomId) {
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateRoom(roomId, data)
    } catch (saveError) {
      setError(saveError.message)
      await syncRoom()
    } finally {
      setSaving(false)
    }
  }

  async function saveRoom(nextData) {
    setRoomData(nextData)
    roomDataRef.current = nextData
    await persistRoomToServer(nextData)
  }

  async function handleCreateRoom() {
    try {
      setCreatingRoom(true)
      const newRoomId = await createRoom()
      navigate({ pathname: '/watch', search: `?room=${newRoomId}` }, { replace: true })
    } catch (createError) {
      setError(createError.message)
      setCreatingRoom(false)
    }
  }

  async function handleSelectMovie(imdbID) {
    if (!roomId) {
      return
    }
    try {
      setSaving(true)
      const details = await getMovieDetails(imdbID)
      const exists = roomDataRef.current.movies.some(
        (movie) => movie.imdbID === details.imdbID
      )
      if (exists) {
        return
      }
      const nextData = {
        ...roomDataRef.current,
        movies: [...roomDataRef.current.movies, details],
      }
      await saveRoom(nextData)
    } catch (addError) {
      setError(addError.message)
    } finally {
      setSaving(false)
    }
  }

  function handleSaveRoomName(name) {
    saveRoom({
      ...roomDataRef.current,
      roomName: name,
    })
  }

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      return true
    } catch {
      return false
    }
  }

  function handleUpdateProgress(imdbID, progress, options = {}) {
    const { flush = false } = options
    const nextMovies = roomDataRef.current.movies.map((movie) =>
      movie.imdbID === imdbID ? { ...movie, progress } : movie
    )
    const nextData = {
      ...roomDataRef.current,
      movies: nextMovies,
    }
    setRoomData(nextData)
    roomDataRef.current = nextData

    if (flush) {
      window.clearTimeout(progressPersistTimers.current[imdbID])
      void persistRoomToServer(nextData)
      return
    }

    window.clearTimeout(progressPersistTimers.current[imdbID])
    progressPersistTimers.current[imdbID] = window.setTimeout(() => {
      void persistRoomToServer(roomDataRef.current)
    }, 450)
  }

  async function handleSyncShelf() {
    if (!user) return
    try {
      setSaving(true)
      setError('')
      const items = roomDataRef.current.movies.map((m) => ({
        imdbID: m.imdbID,
        title: m.title,
        type: m.type,
        poster: m.poster,
        completed: Boolean(m.progress?.completed),
      }))
      await putWatched(items)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const timersById = progressPersistTimers.current
    return () => {
      Object.values(timersById).forEach((id) => window.clearTimeout(id))
    }
  }, [])

  if (!roomId) {
    return <CreateRoomView onCreate={handleCreateRoom} creating={creatingRoom} />
  }

  if (loadingRoom) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink/80">
        Loading room…
      </div>
    )
  }

  return (
    <main className="relative min-h-screen">
      <TopBar
        roomName={roomData.roomName}
        movieCount={roomData.movies.length}
        roomId={roomId}
        onSaveRoomName={handleSaveRoomName}
        onCopyInvite={handleCopyInvite}
        onSyncShelf={user ? handleSyncShelf : undefined}
      />
      <MovieSearch onSelectMovie={handleSelectMovie} />
      <MovieGrid movies={roomData.movies} onUpdateProgress={handleUpdateProgress} />
      <StatusPopup
        saving={saving}
        error={error}
        onDismissError={() => setError('')}
      />
    </main>
  )
}

export default WatchRoomApp
