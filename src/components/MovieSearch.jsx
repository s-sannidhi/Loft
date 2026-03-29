import { useEffect, useState } from 'react'
import { searchMovies } from '../lib/api'

function MovieSearch({ onSelectMovie }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true)
        const nextResults = await searchMovies(query)
        setResults(nextResults)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [query])

  return (
    <section className="mx-auto w-full max-w-[90rem] px-5 pb-8 pt-8 lg:px-10">
      <label className="mb-2 block text-sm font-medium text-sage">
        Search movies or shows
      </label>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a title…"
        className="w-full rounded-lg border border-mutedline bg-cream px-4 py-3 text-ink shadow-inner placeholder:text-ink/45 focus:border-honey focus:outline-none focus:ring-2 focus:ring-honey/40"
      />
      {query.trim() ? (
        <div className="mt-3 rounded-lg border border-mutedline border-l-4 border-l-honey bg-card shadow-cafe">
          {searching ? (
            <p className="px-3 py-3 text-sm text-ink/65">Searching…</p>
          ) : null}
          {!searching && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink/65">No results found.</p>
          ) : null}
          {results.map((result) => (
            <button
              key={result.imdbID}
              type="button"
              onClick={() => {
                onSelectMovie(result.imdbID)
                setQuery('')
                setResults([])
              }}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition hover:bg-cream"
            >
              <span className="font-medium text-ink">{result.title}</span>
              <span className="meta-font shrink-0 text-xs text-ink/55">
                {result.year} · {result.type}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default MovieSearch
