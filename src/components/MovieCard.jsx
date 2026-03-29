import SeriesEpisodePanel from './SeriesEpisodePanel'
import TitleReviews from './TitleReviews'

function normalizeProgress(movie) {
  if (movie.type === 'series') {
    return {
      currentSeason: 1,
      currentEpisode: 1,
      watchedEpisodes: [],
      completed: false,
      ...movie.progress,
    }
  }
  return {
    completed: false,
    ...movie.progress,
  }
}

function MovieCard({
  movie,
  onUpdateProgress,
  onRemoveMovie,
  animationDelayMs,
  roomId,
  user,
  reviewsByImdb,
  onRoomUpdated,
}) {
  const isSeries = movie.type === 'series'
  const progress = normalizeProgress(movie)

  function patchProgress(updates, options) {
    onUpdateProgress(movie.imdbID, { ...progress, ...updates }, options)
  }

  const providers = movie.watchProviders || []
  const isComplete = Boolean(progress.completed)
  const jwRegion = String(
    import.meta.env.VITE_JUSTWATCH_REGION || 'us'
  ).toLowerCase()
  const justWatchUrl = `https://www.justwatch.com/${jwRegion}/search?q=${encodeURIComponent(movie.title || '')}`

  return (
    <div className="movie-card-perspective h-full min-h-0">
      <article
        className={`movie-card-3d fade-in-card group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-mutedline border-l-4 border-l-sage bg-card shadow-cafe transition-shadow duration-200 hover:shadow-cafe-lg ${
          isComplete ? 'ring-2 ring-honey/50' : ''
        }`}
        style={{ animationDelay: `${animationDelayMs}ms` }}
      >
        <div className="relative aspect-[2/3] bg-card">
          {movie.poster && movie.poster !== 'N/A' ? (
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-mutedline/20 px-2 text-center text-sm text-ink/50">
              No poster
            </div>
          )}
          {isComplete ? (
            <span className="absolute right-2 top-2 rounded-md bg-honey/90 px-2 py-0.5 text-[10px] font-bold text-ink shadow">
              Done
            </span>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col space-y-2 p-3">
          <div>
            <h3 className="line-clamp-2 text-base font-semibold text-ink">
              {movie.title}
            </h3>
            <p className="meta-font mt-0.5 text-[11px] text-ink/70">
              {movie.year} · {movie.genre || 'Unknown genre'}
            </p>
          </div>
          <div className="inline-flex w-fit items-center rounded border border-blush/50 bg-blush/15 px-1.5 py-0.5">
            <span className="meta-font text-[11px] text-ink">
              IMDb {movie.imdbRating || 'N/A'}
            </span>
          </div>

          <div>
            <p className="meta-font mb-1 text-[10px] font-medium uppercase tracking-wide text-ink/50">
              Streaming
            </p>
            {providers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {providers.map((p, i) => (
                  <span
                    key={`${p.name}-${i}`}
                    title={p.name}
                    className="inline-flex items-center gap-1 rounded-md border border-mutedline bg-cream px-1.5 py-0.5 text-[10px] text-ink"
                  >
                    {p.logoPath ? (
                      <img
                        src={p.logoPath}
                        alt=""
                        className="h-4 w-4 rounded object-contain"
                      />
                    ) : null}
                    {p.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-ink/55">
                No streaming list yet — add{' '}
                <span className="font-medium text-ink/70">WATCHMODE_API_KEY</span> to
                the Loft server (free key at watchmode.com).
              </p>
            )}
            <a
              href={justWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="meta-font mt-1 inline-block text-[10px] font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:text-ink"
            >
              Search on JustWatch
            </a>
          </div>

          <button
            type="button"
            onClick={() =>
              patchProgress({ completed: !isComplete }, { flush: true })
            }
            className={`meta-font w-full rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition sm:text-xs ${
              isComplete
                ? 'border-honey/60 bg-honey/15 text-ink hover:bg-honey/25'
                : 'border-mutedline bg-cream text-ink hover:bg-card'
            }`}
          >
            {isComplete ? 'Mark not complete' : 'Mark complete'}
          </button>

          {isSeries ? (
            <div className="min-h-0 flex-1">
              <SeriesEpisodePanel
                movie={movie}
                progress={progress}
                patchProgress={patchProgress}
              />
            </div>
          ) : null}

          {roomId && onRoomUpdated ? (
            <TitleReviews
              roomId={roomId}
              imdbID={movie.imdbID}
              user={user}
              reviewsMap={reviewsByImdb?.[movie.imdbID]}
              onUpdated={onRoomUpdated}
            />
          ) : null}

          {onRemoveMovie ? (
            <button
              type="button"
              onClick={() => onRemoveMovie(movie.imdbID)}
              className="meta-font w-full rounded-lg border border-red-900/25 bg-red-900/5 px-2 py-1.5 text-center text-[11px] font-medium text-red-900/90 transition hover:bg-red-900/10 dark:border-red-200/30 dark:bg-red-500/10 dark:text-red-100 dark:hover:bg-red-500/20 sm:text-xs"
            >
              Remove from room
            </button>
          ) : null}
        </div>
      </article>
    </div>
  )
}

export default MovieCard
