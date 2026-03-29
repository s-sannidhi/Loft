import { useEffect, useState } from 'react'

const SAVING_SHOW_DELAY_MS = 220

function StatusPopup({ saving, error, onDismissError }) {
  const [showSaving, setShowSaving] = useState(false)

  useEffect(() => {
    if (!saving) {
      const hideId = window.setTimeout(() => setShowSaving(false), 0)
      return () => window.clearTimeout(hideId)
    }
    const showId = window.setTimeout(() => setShowSaving(true), SAVING_SHOW_DELAY_MS)
    return () => window.clearTimeout(showId)
  }, [saving])

  const open = (showSaving && saving) || Boolean(error)

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      role={error ? 'alertdialog' : 'status'}
      aria-live="polite"
    >
      <div
        className="animate-modal-backdrop absolute inset-0 bg-scrim-fade-light"
        onClick={error ? onDismissError : undefined}
        aria-hidden={error ? undefined : true}
      />
      <div className="animate-modal-dialog relative z-10 w-full max-w-md rounded-2xl border border-mutedline border-l-4 border-l-blush bg-card p-6 shadow-cafe-lg">
        {error ? (
          <>
            <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/85">{error}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onDismissError}
                className="text-sm font-medium text-accent underline decoration-accent underline-offset-4 hover:text-honey"
              >
                OK
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-mutedline border-t-honey"
              aria-hidden
            />
            <p className="meta-font text-sm text-ink/80">Saving your watchlist…</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default StatusPopup
