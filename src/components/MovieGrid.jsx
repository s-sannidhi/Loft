import MovieCard from './MovieCard'

function MovieGrid({ movies, onUpdateProgress }) {
  if (movies.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[90rem] px-5 pb-12 lg:px-10">
        <div className="rounded-xl border border-mutedline border-l-4 border-l-sky bg-card px-8 py-10 text-center text-ink/75 shadow-cafe">
          Start by searching for a movie or show above.
        </div>
      </div>
    )
  }

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-[90rem] grid-cols-1 gap-4 px-5 pb-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:px-10">
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.imdbID}
          movie={movie}
          onUpdateProgress={onUpdateProgress}
          animationDelayMs={index * 70}
        />
      ))}
    </section>
  )
}

export default MovieGrid
