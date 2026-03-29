import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatEpisodeLabel } from '../lib/episodeUtils'
import { getSeasonEpisodes } from '../lib/api'

function SeriesEpisodeModal({ open, onClose, movie, progress, patchProgress }) {
  const totalSeasons = Math.max(1, Number(movie.totalSeasons) || 1)
  const [season, setSeason] = useState(1)
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [localWatched, setLocalWatched] = useState(() => new Set())
  const [draftCurrent, setDraftCurrent] = useState({ season: 1, episode: 1 })
  const progressRef = useRef(progress)
  const currentEpisodeRef = useRef(null)
  progressRef.current = progress

  useLayoutEffect(() => {
    if (!open) return
    const p = progressRef.current
    setLocalWatched(new Set(p.watchedEpisodes || []))
    setSeason(p.currentSeason)
    setDraftCurrent({ season: p.currentSeason, episode: p.currentEpisode })
    setBulkError('')
    setBulkBusy(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const list = await getSeasonEpisodes(movie.imdbID, season)
        if (!cancelled) setEpisodes(list)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message)
          setEpisodes([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [movie.imdbID, season, open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    currentEpisodeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [open, season, draftCurrent.episode, episodes.length])

  function labelsThisSeason() {
    return episodes.map((ep) => formatEpisodeLabel(season, ep.episode))
  }

  function toggleLabel(label) {
    setLocalWatched((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function selectAllInSeason() {
    setLocalWatched((prev) => {
      const next = new Set(prev)
      labelsThisSeason().forEach((l) => next.add(l))
      return next
    })
  }

  function clearSeason() {
    setLocalWatched((prev) => {
      const next = new Set(prev)
      labelsThisSeason().forEach((l) => next.delete(l))
      return next
    })
  }

  async function markAllBeforeCurrent() {
    if (draftCurrent.season === 1 && draftCurrent.episode <= 1) return
    setBulkBusy(true)
    setBulkError('')
    try {
      const toAdd = []
      for (let s = 1; s < draftCurrent.season; s++) {
        const list = await getSeasonEpisodes(movie.imdbID, s)
        for (const ep of list) {
          toAdd.push(formatEpisodeLabel(s, ep.episode))
        }
      }
      if (draftCurrent.episode > 1) {
        const list =
          season === draftCurrent.season
            ? episodes
            : await getSeasonEpisodes(movie.imdbID, draftCurrent.season)
        for (const ep of list) {
          if (ep.episode < draftCurrent.episode) {
            toAdd.push(formatEpisodeLabel(draftCurrent.season, ep.episode))
          }
        }
      }
      setLocalWatched((prev) => {
        const next = new Set(prev)
        toAdd.forEach((l) => next.add(l))
        return next
      })
    } catch (err) {
      setBulkError(err?.message || 'Could not load episodes')
    } finally {
      setBulkBusy(false)
    }
  }

  const canMarkBeforeCurrent =
    (draftCurrent.season > 1 || draftCurrent.episode > 1) && !bulkBusy

  function goNextEpisode() {
    const idx = episodes.findIndex((e) => e.episode === draftCurrent.episode)
    if (idx >= 0 && idx < episodes.length - 1) {
      setDraftCurrent({ season, episode: episodes[idx + 1].episode })
      return
    }
    if (idx === episodes.length - 1 && episodes.length > 0 && season < totalSeasons) {
      setSeason(season + 1)
      setDraftCurrent({ season: season + 1, episode: 1 })
      return
    }
    setDraftCurrent((d) => ({ ...d, episode: d.episode + 1 }))
  }

  function handleSave() {
    patchProgress(
      {
        watchedEpisodes: Array.from(localWatched).sort(),
        currentSeason: draftCurrent.season,
        currentEpisode: draftCurrent.episode,
      },
      { flush: true }
    )
    onClose()
  }

  if (!open) return null

  const inSeasonSelected = episodes.filter((ep) =>
    localWatched.has(formatEpisodeLabel(season, ep.episode))
  ).length

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="episode-dialog-title"
    >
      <button
        type="button"
        className="animate-modal-backdrop absolute inset-0 cursor-pointer bg-scrim-fade"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="animate-modal-dialog relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-mutedline bg-card shadow-cafe-lg">
        <div className="shrink-0 border-b border-mutedline bg-card px-4 py-2.5">
          <h2 id="episode-dialog-title" className="text-lg font-semibold text-ink sm:text-xl">
            {movie.title} — Episodes
          </h2>
          <p className="meta-font mt-0.5 line-clamp-1 text-[11px] text-ink/60 sm:text-xs">
            Choose your current episode and mark watched episodes.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-parchment px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="meta-font rounded-md border border-sage/40 bg-cream px-2 py-0.5 text-xs text-ink">
              Now: {formatEpisodeLabel(draftCurrent.season, draftCurrent.episode)}
            </span>
            <label className="meta-font flex items-center gap-2 text-[11px] text-ink/75">
              Season
              <select
                value={season}
                onChange={(e) => setSeason(Math.max(1, Number(e.target.value) || 1))}
                className="rounded-md border border-mutedline bg-cream px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
              >
                {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={selectAllInSeason}
                disabled={episodes.length === 0}
                className="meta-font rounded-md border border-mutedline bg-cream px-2 py-1 text-[11px] text-ink hover:bg-card disabled:opacity-40 sm:text-xs"
              >
                Select all in season
              </button>
              <button
                type="button"
                onClick={clearSeason}
                disabled={episodes.length === 0}
                className="meta-font rounded-md border border-mutedline bg-cream px-2 py-1 text-[11px] text-ink hover:bg-card disabled:opacity-40 sm:text-xs"
              >
                Clear season
              </button>
              <button
                type="button"
                onClick={() => void markAllBeforeCurrent()}
                disabled={!canMarkBeforeCurrent}
                title={
                  draftCurrent.season === 1 && draftCurrent.episode <= 1
                    ? 'You are on the first episode of season 1.'
                    : 'Mark every episode in earlier seasons as watched, and every episode before your current one in the current season.'
                }
                className="meta-font rounded-md border border-mutedline bg-cream px-2 py-1 text-[11px] text-ink hover:bg-card disabled:opacity-40 sm:text-xs"
              >
                {bulkBusy ? 'Loading…' : 'Watched all before current'}
              </button>
            </div>
            <span className="meta-font shrink-0 text-[10px] text-ink/55 sm:text-[11px]">
              {inSeasonSelected}/{episodes.length} selected
            </span>
          </div>
          {bulkError ? (
            <p className="meta-font mb-2 text-[11px] text-red-800 sm:text-xs">{bulkError}</p>
          ) : null}

          {loading ? (
            <p className="meta-font py-6 text-center text-sm text-ink/65">Loading episodes…</p>
          ) : loadError ? (
            <p className="meta-font py-3 text-sm text-red-800">{loadError}</p>
          ) : episodes.length === 0 ? (
            <p className="meta-font py-4 text-center text-sm text-ink/65">
              No episodes listed for this season in OMDB.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-lg border border-mutedline bg-cream p-2 shadow-inner">
              {episodes.map((ep) => {
                const label = formatEpisodeLabel(season, ep.episode)
                const isHere =
                  draftCurrent.season === season && draftCurrent.episode === ep.episode
                const watched = localWatched.has(label)
                return (
                  <li
                    key={`${season}-${ep.episode}`}
                    ref={isHere ? currentEpisodeRef : null}
                  >
                    <div
                      className={`flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 ${
                        isHere
                          ? 'bg-parchment ring-1 ring-accent ring-offset-1 ring-offset-cream'
                          : 'bg-cream'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={watched}
                        onChange={() => toggleLabel(label)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-mutedline text-accent focus:ring-2 focus:ring-accent"
                        aria-label={`Watched ${label}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraftCurrent({ season, episode: ep.episode })
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                          <span className="meta-font text-[11px] text-sage">{label}</span>
                          {ep.released && ep.released !== 'N/A' ? (
                            <span className="meta-font text-[10px] text-ink/45">
                              {ep.released}
                            </span>
                          ) : null}
                        </div>
                        <span className="line-clamp-1 text-sm font-medium leading-snug text-ink">
                          {ep.title || `Episode ${ep.episode}`}
                        </span>
                        {isHere ? (
                          <span className="meta-font mt-0.5 block text-[9px] text-honey sm:text-[10px]">
                            Current position
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={goNextEpisode}
            className="meta-font mt-2 shrink-0 rounded-lg border border-mutedline bg-cream px-3 py-1.5 text-xs text-ink hover:bg-card sm:text-sm"
          >
            Next episode (where I am) →
          </button>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-mutedline bg-parchment px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-mutedline bg-cream py-2 text-sm font-medium text-ink hover:bg-card"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-cream hover:bg-honey hover:text-ink"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default SeriesEpisodeModal
