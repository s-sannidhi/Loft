/**
 * Fixed bottom toast so shelf sync feedback never affects the header layout.
 */
function ShelfSyncToast({ note, failed }) {
  const text = failed || note
  if (!text) return null

  const isError = Boolean(failed)

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 right-4 z-50 flex justify-center px-0 sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto max-w-lg rounded-2xl border px-4 py-3 shadow-cafe-lg ${
          isError
            ? 'border-red-200 bg-card text-red-800 dark:border-red-900/50 dark:text-red-200'
            : 'border-mutedline border-l-4 border-l-sage bg-card text-ink'
        }`}
      >
        <p className="meta-font text-center text-xs sm:text-left" title={text}>
          {text}
        </p>
      </div>
    </div>
  )
}

export default ShelfSyncToast
