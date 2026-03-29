import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

function FlowDiagram() {
  return (
    <svg
      viewBox="0 0 520 200"
      className="h-auto w-full max-w-xl text-ink"
      aria-hidden
    >
      <defs>
        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" className="fill-accent" />
        </marker>
      </defs>
      <rect
        x="10"
        y="30"
        width="100"
        height="44"
        rx="10"
        className="fill-card stroke-mutedline"
        strokeWidth="1.5"
      />
      <text x="60" y="57" textAnchor="middle" className="fill-ink text-[11px] font-medium">
        Create room
      </text>
      <rect
        x="150"
        y="30"
        width="100"
        height="44"
        rx="10"
        className="fill-card stroke-mutedline"
        strokeWidth="1.5"
      />
      <text x="200" y="57" textAnchor="middle" className="fill-ink text-[11px] font-medium">
        Invite link
      </text>
      <rect
        x="290"
        y="30"
        width="100"
        height="44"
        rx="10"
        className="fill-card stroke-mutedline"
        strokeWidth="1.5"
      />
      <text x="340" y="57" textAnchor="middle" className="fill-ink text-[11px] font-medium">
        Add titles
      </text>
      <rect
        x="410"
        y="30"
        width="100"
        height="44"
        rx="10"
        className="fill-cream stroke-honey"
        strokeWidth="2"
      />
      <text x="460" y="57" textAnchor="middle" className="fill-ink text-[11px] font-medium">
        Watch together
      </text>
      <line
        x1="110"
        y1="52"
        x2="148"
        y2="52"
        className="stroke-mutedline"
        strokeWidth="2"
        markerEnd="url(#arrow)"
      />
      <line
        x1="250"
        y1="52"
        x2="288"
        y2="52"
        className="stroke-mutedline"
        strokeWidth="2"
        markerEnd="url(#arrow)"
      />
      <line
        x1="390"
        y1="52"
        x2="408"
        y2="52"
        className="stroke-mutedline"
        strokeWidth="2"
        markerEnd="url(#arrow)"
      />
      <text x="260" y="120" textAnchor="middle" className="fill-ink/70 text-[12px]">
        Shared room syncs for everyone with the link
      </text>
      <rect
        x="80"
        y="135"
        width="140"
        height="40"
        rx="8"
        className="fill-parchment stroke-sage"
        strokeWidth="1.5"
      />
      <text x="150" y="159" textAnchor="middle" className="fill-ink text-[10px]">
        JSONBin document
      </text>
      <rect
        x="300"
        y="135"
        width="140"
        height="40"
        rx="8"
        className="fill-parchment stroke-sky"
        strokeWidth="1.5"
      />
      <text x="370" y="159" textAnchor="middle" className="fill-ink text-[10px]">
        Poll + save debounce
      </text>
    </svg>
  )
}

function ArchitectureDiagram() {
  return (
    <svg
      viewBox="0 0 480 160"
      className="h-auto w-full max-w-lg text-ink"
      aria-hidden
    >
      <rect
        x="20"
        y="40"
        width="120"
        height="50"
        rx="10"
        className="fill-cream stroke-accent"
        strokeWidth="2"
      />
      <text x="80" y="72" textAnchor="middle" className="fill-ink text-[11px] font-medium">
        React app
      </text>
      <rect
        x="180"
        y="40"
        width="120"
        height="50"
        rx="10"
        className="fill-card stroke-mutedline"
        strokeWidth="1.5"
      />
      <text x="240" y="72" textAnchor="middle" className="fill-ink text-[11px] font-medium">
        Loft API
      </text>
      <rect
        x="340"
        y="40"
        width="120"
        height="50"
        rx="10"
        className="fill-card stroke-mutedline"
        strokeWidth="1.5"
      />
      <text x="400" y="72" textAnchor="middle" className="fill-ink text-[11px] font-medium">
        JSONBin
      </text>
      <line
        x1="140"
        y1="65"
        x2="178"
        y2="65"
        className="stroke-mutedline"
        strokeWidth="2"
      />
      <line
        x1="300"
        y1="65"
        x2="338"
        y2="65"
        className="stroke-mutedline"
        strokeWidth="2"
      />
      <text x="240" y="120" textAnchor="middle" className="fill-ink/65 text-[11px]">
        Auth + friends stay on the API; rooms can proxy to shared storage
      </text>
    </svg>
  )
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-mutedline bg-parchment">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-10">
          <Link
            to="/"
            className="rounded-xl border border-mutedline border-l-[6px] border-l-honey bg-cream px-4 py-2 text-2xl font-bold shadow-cafe md:text-3xl"
          >
            <span className="bg-gradient-to-br from-accent via-ink to-accent bg-clip-text text-transparent">
              Loft
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <Link
              to="/watch"
              className="text-sm font-medium text-accent underline decoration-accent/50 underline-offset-4 hover:text-ink"
            >
              Open watchlist
            </Link>
            <Link
              to="/login"
              className="text-sm font-medium text-ink/80 hover:text-ink"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg border border-mutedline bg-cream px-3 py-1.5 text-sm font-medium text-ink hover:bg-card"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-10">
        <p className="text-sm font-medium uppercase tracking-wide text-honey">
          Shared watchlists, café calm
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink md:text-5xl">
          Watch together without the chaos.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink/80">
          Loft is a warm, collaborative shelf for movies and series—room links for
          your crew, progress you can trust, and profiles for what you have finished.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/watch"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-cream shadow-cafe hover:brightness-110"
          >
            Start a room
          </Link>
          <Link
            to="/signup"
            className="rounded-xl border border-mutedline bg-cream px-6 py-3 text-sm font-semibold text-ink hover:bg-card"
          >
            Create an account
          </Link>
        </div>

        <section className="mt-20 space-y-4">
          <h2 className="text-2xl font-semibold text-ink">How it works</h2>
          <p className="text-ink/75">
            Spin up a room, share one link, and everyone sees the same list—updates
            sync on a gentle timer so you are never fighting the UI.
          </p>
          <div className="rounded-2xl border border-mutedline bg-card p-6 shadow-cafe">
            <FlowDiagram />
          </div>
        </section>

        <section className="mt-16 space-y-4">
          <h2 className="text-2xl font-semibold text-ink">Architecture snapshot</h2>
          <p className="text-ink/75">
            The browser talks to a small Loft API for accounts and social graph; room
            documents can be stored in JSONBin behind the server so keys stay off the
            client.
          </p>
          <div className="rounded-2xl border border-mutedline bg-card p-6 shadow-cafe">
            <ArchitectureDiagram />
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
