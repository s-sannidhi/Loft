import { useState } from 'react'
import { formatEpisodeLabel } from '../lib/episodeUtils'
import SeriesEpisodeModal from './SeriesEpisodeModal'

function SeriesEpisodePanel({ movie, progress, patchProgress }) {
  const [modalOpen, setModalOpen] = useState(false)
  const episodeLabel = formatEpisodeLabel(
    progress.currentSeason,
    progress.currentEpisode
  )
  const watchedCount = (progress.watchedEpisodes || []).length

  return (
    <>
      <div className="min-w-0 rounded-lg border border-mutedline border-l-2 border-l-accent/60 bg-cream p-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div>
            <p className="text-xs font-medium text-ink">Progress</p>
            <p className="meta-font mt-0.5 text-[10px] text-ink/60">
              Now {episodeLabel} · {watchedCount} watched
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="shrink-0 text-xs font-medium text-accent underline decoration-accent/50 underline-offset-4 transition hover:text-honey hover:decoration-honey/60"
          >
            Episodes…
          </button>
        </div>
      </div>

      <SeriesEpisodeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        movie={movie}
        progress={progress}
        patchProgress={patchProgress}
      />
    </>
  )
}

export default SeriesEpisodePanel
