import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CreateRoomView from './components/CreateRoomView'
import MovieGrid from './components/MovieGrid'
import MovieSearch from './components/MovieSearch'
import RoomMembersPanel from './components/RoomMembersPanel'
import RoomRecommendationsRow from './components/RoomRecommendationsRow'
import RoomSharePanel from './components/RoomSharePanel'
import ShelfSyncToast from './components/ShelfSyncToast'
import StatusPopup from './components/StatusPopup'
import TopBar from './components/TopBar'
import { createRoom, getMovieDetails, getRoom, updateRoom } from './lib/api'
import { mergeProfileShelfItems } from './lib/mergeProfileShelf'
import { fetchMyWatched, putWatched } from './lib/socialApi'
import { touchSavedRoom } from './lib/savedRoomsDirectory'
import { useAuth } from './context/useAuth'

const POLLING_MS = 5000

function normalizeClientRoom(r) {
  if (!r || typeof r !== 'object') {
    return {
      roomName: 'Loft',
      movies: [],
      members: null,
      reviewsByImdb: {},
      ownerUserId: null,
      sharedUserIds: [],
    }
  }
  return {
    roomName: r.roomName ?? 'Loft',
    movies: Array.isArray(r.movies) ? r.movies : [],
    members: r.members !== undefined ? r.members : null,
    reviewsByImdb:
      r.reviewsByImdb !== undefined && r.reviewsByImdb !== null
        ? r.reviewsByImdb
        : {},
    ownerUserId: r.ownerUserId ?? null,
    sharedUserIds: Array.isArray(r.sharedUserIds) ? r.sharedUserIds : [],
  }
}

function WatchRoomApp() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const roomId = searchParams.get('room')
  const { user } = useAuth()

  const [shareOpen, setShareOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [shelfSyncNote, setShelfSyncNote] = useState('')
  const [shelfSyncFailed, setShelfSyncFailed] = useState('')
  const lastShelfPayload = useRef('')
  const shelfDebounceRef = useRef(null)

  const [creatingRoom, setCreatingRoom] = useState(false)
  const [loadingRoom, setLoadingRoom] = useState(Boolean(roomId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [roomData, setRoomData] = useState(() =>
    normalizeClientRoom({
      roomName: 'Loft',
      movies: [],
    })
  )
  const roomDataRef = useRef(roomData)
  const progressPersistTimers = useRef({})

  const [shelfFilter, setShelfFilter] = useState('')

  useEffect(() => {
    roomDataRef.current = roomData
  }, [roomData])

  const applyServerRecord = useCallback((record) => {
    const merged = normalizeClientRoom({ ...roomDataRef.current, ...record })
    roomDataRef.current = merged
    setRoomData(merged)
  }, [])

  useLayoutEffect(() => {
    if (!roomId) {
      setLoadingRoom(false)
      return
    }
    setLoadingRoom(true)
  }, [roomId])

  useEffect(() => {
    lastShelfPayload.current = ''
    setShelfSyncNote('')
    setShelfSyncFailed('')
  }, [roomId])

  const syncRoom = useCallback(async () => {
    if (!roomId) {
      return
    }
    const raw = await getRoom(roomId)
    const remote = normalizeClientRoom(raw)
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
        const raw = await getRoom(roomId)
        if (!cancelled) {
          setRoomData(normalizeClientRoom(raw))
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

  async function persistRoomToServer(payload) {
    if (!roomId) {
      return
    }
    setSaving(true)
    setError('')
    try {
      const record = await updateRoom(roomId, {
        roomName: payload.roomName,
        movies: payload.movies,
      })
      const merged = normalizeClientRoom({
        ...roomDataRef.current,
        ...record,
      })
      roomDataRef.current = merged
      setRoomData(merged)
    } catch (saveError) {
      setError(saveError.message)
      await syncRoom()
    } finally {
      setSaving(false)
    }
  }

  async function saveRoom(nextData) {
    const merged = { ...roomDataRef.current, ...nextData }
    roomDataRef.current = merged
    setRoomData(merged)
    await persistRoomToServer({
      roomName: merged.roomName,
      movies: merged.movies,
    })
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

  function handleRemoveMovie(imdbID) {
    if (!roomId) {
      return
    }
    const title =
      roomDataRef.current.movies.find((m) => m.imdbID === imdbID)?.title ||
      'this title'
    if (!window.confirm(`Remove “${title}” from this watch room?`)) {
      return
    }
    window.clearTimeout(progressPersistTimers.current[imdbID])
    delete progressPersistTimers.current[imdbID]
    const nextData = {
      ...roomDataRef.current,
      movies: roomDataRef.current.movies.filter((m) => m.imdbID !== imdbID),
    }
    void saveRoom(nextData)
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
      void persistRoomToServer({
        roomName: roomDataRef.current.roomName,
        movies: nextMovies,
      })
      return
    }

    window.clearTimeout(progressPersistTimers.current[imdbID])
    progressPersistTimers.current[imdbID] = window.setTimeout(() => {
      void persistRoomToServer({
        roomName: roomDataRef.current.roomName,
        movies: roomDataRef.current.movies,
      })
    }, 450)
  }

  function buildShelfItems() {
    return roomDataRef.current.movies.map((m) => ({
      imdbID: m.imdbID,
      title: m.title,
      type: m.type,
      poster: m.poster,
      completed: Boolean(m.progress?.completed),
    }))
  }

  /** Always union server profile shelf + this room so switching lofts never drops other titles. */
  const putMergedProfileShelf = useCallback(async () => {
    const roomItems = buildShelfItems()
    let existing = []
    try {
      const w = await fetchMyWatched()
      existing = Array.isArray(w?.items) ? w.items : []
    } catch {
      /* If GET fails, PUT still merges on the server from room-only payload. */
    }
    const merged = mergeProfileShelfItems(existing, roomItems)
    return putWatched(merged)
  }, [])

  async function handleSyncShelf() {
    if (!user) return
    try {
      setSaving(true)
      setError('')
      setShelfSyncFailed('')
      const items = buildShelfItems()
      const data = await putMergedProfileShelf()
      lastShelfPayload.current = JSON.stringify(items)
      setShelfSyncNote(
        `Profile shelf updated · ${data?.count ?? items.length} titles total (manual)`
      )
      window.setTimeout(() => {
        setShelfSyncNote((n) => (n.includes('(manual)') ? '' : n))
      }, 4500)
    } catch (e) {
      setShelfSyncFailed(`Shelf sync failed: ${e.message}`)
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!user?.id || !roomId || loadingRoom || error) {
      if (shelfDebounceRef.current) {
        window.clearTimeout(shelfDebounceRef.current)
        shelfDebounceRef.current = null
      }
      return
    }
    const items = buildShelfItems()
    const payload = JSON.stringify(items)
    if (shelfDebounceRef.current) window.clearTimeout(shelfDebounceRef.current)
    shelfDebounceRef.current = window.setTimeout(async () => {
      if (payload === lastShelfPayload.current) return
      try {
        const data = await putMergedProfileShelf()
        lastShelfPayload.current = payload
        setShelfSyncFailed('')
        setShelfSyncNote(
          `Profile shelf updated · ${data?.count ?? items.length} titles total`
        )
        window.setTimeout(() => {
          setShelfSyncNote((n) =>
            n.startsWith('Profile shelf updated ·') && !n.includes('(manual)')
              ? ''
              : n
          )
        }, 4000)
      } catch (e) {
        setShelfSyncFailed(`Shelf sync failed: ${e.message}`)
      }
    }, 900)
    return () => {
      if (shelfDebounceRef.current) {
        window.clearTimeout(shelfDebounceRef.current)
        shelfDebounceRef.current = null
      }
    }
  }, [user, roomId, loadingRoom, error, roomData, putMergedProfileShelf])

  useEffect(() => {
    const timersById = progressPersistTimers.current
    return () => {
      Object.values(timersById).forEach((id) => window.clearTimeout(id))
    }
  }, [])

  useEffect(() => {
    if (!roomId || loadingRoom || error) {
      return
    }
    touchSavedRoom(roomId, roomData.roomName, Boolean(user))
  }, [roomId, loadingRoom, error, roomData.roomName, user])

  const filteredMovies = useMemo(() => {
    const q = shelfFilter.trim().toLowerCase()
    if (!q) return roomData.movies
    return roomData.movies.filter((m) =>
      (m.title || '').toLowerCase().includes(q)
    )
  }, [roomData.movies, shelfFilter])

  const existingImdbIds = useMemo(
    () => roomData.movies.map((m) => m.imdbID),
    [roomData.movies]
  )

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

  const isRoomOwner =
    Boolean(user?.id && roomData.ownerUserId && user.id === roomData.ownerUserId)

  return (
    <main className="relative min-h-screen">
      <TopBar
        roomName={roomData.roomName}
        movieCount={roomData.movies.length}
        roomId={roomId}
        onSaveRoomName={handleSaveRoomName}
        onCopyInvite={handleCopyInvite}
        onSyncShelf={user ? handleSyncShelf : undefined}
        showShareRoom={isRoomOwner}
        onOpenShare={isRoomOwner ? () => setShareOpen(true) : undefined}
        onOpenMembers={() => setMembersOpen(true)}
      />
      <ShelfSyncToast
        note={shelfSyncFailed ? '' : shelfSyncNote}
        failed={shelfSyncFailed}
      />
      <MovieSearch onSelectMovie={handleSelectMovie} />
      <RoomRecommendationsRow
        roomId={roomId}
        existingImdbIds={existingImdbIds}
        onAddTitle={handleSelectMovie}
        disabled={saving}
      />
      <MovieGrid
        movies={filteredMovies}
        totalShelfCount={roomData.movies.length}
        onUpdateProgress={handleUpdateProgress}
        onRemoveMovie={handleRemoveMovie}
        roomId={roomId}
        user={user}
        reviewsByImdb={roomData.reviewsByImdb}
        onRoomUpdated={applyServerRecord}
        shelfFilterQuery={shelfFilter}
        onShelfFilterChange={setShelfFilter}
        showShelfFilter={roomData.movies.length > 6}
      />
      <RoomMembersPanel
        members={roomData.members}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        onCopyInvite={handleCopyInvite}
      />
      {isRoomOwner && roomId ? (
        <RoomSharePanel
          roomId={roomId}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onUpdated={() => syncRoom().catch(() => {})}
        />
      ) : null}
      <StatusPopup
        saving={saving}
        error={error}
        onDismissError={() => setError('')}
      />
    </main>
  )
}

export default WatchRoomApp
