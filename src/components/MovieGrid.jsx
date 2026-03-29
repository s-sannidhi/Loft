import MovieCard from './MovieCard'

function MovieGrid({
  movies,
  totalShelfCount,
  onUpdateProgress,
  onRemoveMovie,
  roomId,
  user,
  reviewsByImdb,
  onRoomUpdated,
  shelfFilterQuery,
  onShelfFilterChange,
  showShelfFilter,
}) {
  const shelfTotal = totalShelfCount ?? movies.length

  if (shelfTotal === 0) {
    return (
      <div className="mx-auto w-full max-w-[90rem] px-5 pb-12 lg:px-10">
        <div className="rounded-xl border border-mutedline border-l-4 border-l-sky bg-card px-8 py-10 text-center text-ink/75 shadow-cafe">
          Start by searching for a movie or show above.
        </div>
      </div>
    )
  }

  if (movies.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[90rem] px-5 pb-12 lg:px-10">
        <p className="mb-3 text-sm text-ink/65">No titles match your filter.</p>
        <button
          type="button"
          onClick={() => onShelfFilterChange?.('')}
          className="text-sm font-medium text-accent underline"
        >
          Clear filter
        </button>
      </div>
    )
  }

  return (
    <>
      {showShelfFilter ? (
        <div className="mx-auto w-full max-w-[90rem] px-5 pb-3 lg:px-10">
          <label className="mb-1 block text-sm font-medium text-sage">
            Filter shelf
          </label>
          <input
            value={shelfFilterQuery || ''}
            onChange={(e) => onShelfFilterChange?.(e.target.value)}
            placeholder="Filter by title…"
            className="w-full max-w-md rounded-lg border border-mutedline bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/45"
          />
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[90rem] px-5 pb-2 lg:px-10">
        <h2 className="text-sm font-semibold text-ink">Your shelf</h2>
        <p className="meta-font text-xs text-ink/55">
          Rate titles below — your group&apos;s reviews stay in this room.
        </p>
      </div>
      <section className="mx-auto grid min-w-0 w-full max-w-[90rem] grid-cols-1 gap-4 px-5 pb-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:px-10">
        {movies.map((movie, index) => (
          <MovieCard
            key={movie.imdbID}
            movie={movie}
            onUpdateProgress={onUpdateProgress}
            onRemoveMovie={onRemoveMovie}
            animationDelayMs={index * 70}
            roomId={roomId}
            user={user}
            reviewsByImdb={reviewsByImdb}
            onRoomUpdated={onRoomUpdated}
          />
        ))}
      </section>
    </>
  )
}

export default MovieGrid
