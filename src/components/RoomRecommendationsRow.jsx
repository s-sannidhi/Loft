import { useCallback, useEffect, useState } from 'react'
import { fetchRoomRecommendations } from '../lib/api'

function RoomRecommendationsRow({ roomId, existingImdbIds, onAddTitle, disabled }) {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError('')
    setMessage('')
    setSource('')
    try {
      const data = await fetchRoomRecommendations(roomId)
      setItems(Array.isArray(data?.items) ? data.items : [])
      if (data?.message) setMessage(data.message)
      if (data?.source) setSource(String(data.source))
    } catch (e) {
      setError(e.message || 'Could not load suggestions')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    void load()
  }, [load])

  const existing = new Set(existingImdbIds || [])

  return (
    <section className="mx-auto w-full max-w-[90rem] px-5 pb-6 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-ink">Suggested for this room</h2>
          {source === 'omdb' ? (
            <p className="meta-font mt-0.5 text-[10px] text-ink/45">
              OMDB search picks (no TMDB). Add TMDB on the server for similar-title suggestions.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || disabled}
          className="meta-font text-xs font-medium text-accent underline disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error ? (
        <p className="meta-font mt-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {message && !items.length ? (
        <p className="meta-font mt-2 text-sm text-ink/60">{message}</p>
      ) : null}
      {items.length > 0 ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {items.map((item) => {
            const has = existing.has(item.imdbID)
            return (
              <div
                key={item.imdbID}
                className="w-36 shrink-0 rounded-xl border border-mutedline bg-card p-2 shadow-cafe"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-lg bg-mutedline/20">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-ink/45">
                      No poster
                    </div>
                  )}
                </div>
                <p className="meta-font mt-1 line-clamp-2 text-[11px] font-medium text-ink">
                  {item.title}
                </p>
                {item.sourceLabel ? (
                  <p className="meta-font line-clamp-2 text-[9px] text-ink/50">
                    {item.sourceLabel}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={has || disabled}
                  onClick={() => onAddTitle(item.imdbID)}
                  className="meta-font mt-2 w-full rounded-lg bg-accent py-1 text-[10px] font-medium text-cream disabled:opacity-50"
                >
                  {has ? 'In room' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

export default RoomRecommendationsRow
