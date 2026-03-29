import { Link } from 'react-router-dom'

function CreateRoomView({ onCreate, creating }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-6 flex gap-4 text-sm">
        <Link to="/" className="text-accent underline underline-offset-4">
          Home
        </Link>
        <Link to="/login" className="text-ink/70 hover:text-ink">
          Log in
        </Link>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-mutedline border-l-4 border-l-sage bg-card px-10 py-12 text-center shadow-cafe-lg">
        <h1
          className="mx-auto inline-block rounded-xl border border-mutedline border-l-[6px] border-l-honey bg-cream px-6 py-3 text-5xl font-bold leading-none tracking-tight shadow-cafe"
          aria-label="Loft"
        >
          <span className="bg-gradient-to-br from-accent via-ink to-accent bg-clip-text text-transparent">
            Loft
          </span>
        </h1>
        <p className="mt-4 text-ink/80">
          Start a shared watchlist room and invite your friends.
        </p>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="mt-10 text-base font-medium text-accent underline decoration-accent/50 underline-offset-[6px] transition hover:text-ink hover:decoration-ink/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create a room'}
        </button>
      </div>
    </div>
  )
}

export default CreateRoomView
