import { useEffect, useState } from 'react'
import { deleteRoomReview, patchRoomReview } from '../lib/socialApi'

const MAX_LEN = 2000

function StarRow({ value, onChange, disabled }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rating 1 to 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`text-lg leading-none ${
            value >= n ? 'text-honey' : 'text-ink/25'
          } disabled:opacity-50`}
          aria-label={`${n} stars`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function TitleReviews({ roomId, imdbID, user, reviewsMap, onUpdated }) {
  const mine = user?.id && reviewsMap?.[user.id] ? reviewsMap[user.id] : null
  const [rating, setRating] = useState(mine?.rating ?? null)
  const [text, setText] = useState(mine?.text ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [othersOpen, setOthersOpen] = useState(false)

  useEffect(() => {
    setRating(mine?.rating ?? null)
    setText(mine?.text ?? '')
  }, [mine?.rating, mine?.text, user?.id])

  const othersEntries = Object.entries(reviewsMap || {}).filter(
    ([uid]) => uid !== user?.id
  )

  async function handleSave() {
    if (!roomId || !user) return
    setBusy(true)
    setError('')
    try {
      const record = await patchRoomReview(roomId, imdbID, { rating, text })
      onUpdated(record)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    if (!roomId || !user) return
    if (!window.confirm('Remove your review for this title?')) return
    setBusy(true)
    setError('')
    try {
      const record = await deleteRoomReview(roomId, imdbID)
      setRating(null)
      setText('')
      onUpdated(record)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    if (!othersEntries.length) return null
    return (
      <div className="mt-2 border-t border-mutedline/60 pt-2">
        <p className="meta-font text-[10px] font-medium uppercase tracking-wide text-ink/50">
          Reviews
        </p>
        <ul className="mt-2 space-y-2">
          {othersEntries.map(([uid, rev]) => (
            <li
              key={uid}
              className="rounded-lg border border-mutedline/80 bg-cream/50 px-2 py-1.5"
            >
              <p className="meta-font text-[11px] font-medium text-ink">
                {rev.displayName || rev.username || 'Someone'}
                {rev.rating ? (
                  <span className="text-honey"> · {'★'.repeat(rev.rating)}</span>
                ) : null}
              </p>
              {rev.text ? (
                <p className="meta-font mt-0.5 text-[11px] text-ink/75">{rev.text}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="meta-font mt-2 text-xs text-ink/55">Log in to add your review.</p>
      </div>
    )
  }

  const showOthers = othersEntries.length > 0
  const preview = othersOpen ? othersEntries : othersEntries.slice(0, 2)

  return (
    <div className="mt-2 border-t border-mutedline/60 pt-2">
      <p className="meta-font text-[10px] font-medium uppercase tracking-wide text-ink/50">
        Your review
      </p>
      <div className="mt-1.5 space-y-2">
        <StarRow
          value={rating || 0}
          onChange={setRating}
          disabled={busy}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          rows={2}
          placeholder="Short note (optional)"
          className="meta-font w-full resize-y rounded-lg border border-mutedline bg-cream px-2 py-1.5 text-xs text-ink placeholder:text-ink/40"
          disabled={busy}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="meta-font text-[10px] text-ink/45">
            {text.length}/{MAX_LEN}
          </span>
          <div className="flex flex-wrap gap-2">
            {mine ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                className="meta-font text-[11px] text-ink/55 underline disabled:opacity-50"
              >
                Clear my review
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="meta-font rounded-lg bg-accent px-3 py-1 text-[11px] font-medium text-cream disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save review'}
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {showOthers ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOthersOpen((o) => !o)}
            className="meta-font text-[11px] font-medium text-accent underline"
          >
            {othersOpen
              ? 'Hide other reviews'
              : `Other reviews (${othersEntries.length})`}
          </button>
          <ul className="mt-2 space-y-2">
            {preview.map(([uid, rev]) => (
              <li
                key={uid}
                className="rounded-lg border border-mutedline/80 bg-cream/50 px-2 py-1.5"
              >
                <p className="meta-font text-[11px] font-medium text-ink">
                  {rev.displayName || rev.username || 'Someone'}
                  {rev.rating ? (
                    <span className="text-honey"> · {'★'.repeat(rev.rating)}</span>
                  ) : null}
                </p>
                {rev.text ? (
                  <p className="meta-font mt-0.5 text-[11px] text-ink/75">{rev.text}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="meta-font mt-2 text-[11px] text-ink/45">
          No reviews from others yet—be the first.
        </p>
      )}
    </div>
  )
}

export default TitleReviews
