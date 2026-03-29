import { useEffect } from 'react'
import { useAuth } from '../context/useAuth'

function RoomMembersPanel({ members, open, onClose, onCopyInvite }) {
  const { user } = useAuth()

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const owner = members?.owner
  const shared = members?.shared || []
  const accessNote = members?.accessNote

  function isYou(id) {
    return user?.id && id === user.id
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-members-title"
    >
      <button
        type="button"
        className="animate-modal-backdrop absolute inset-0 bg-scrim-fade-light"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-mutedline border-l-4 border-l-sky bg-card p-5 shadow-cafe-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 id="room-members-title" className="text-lg font-semibold text-ink">
            Who&apos;s in this room
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink/55 hover:text-ink"
          >
            Close
          </button>
        </div>
        {accessNote ? (
          <p className="meta-font mt-2 text-xs text-ink/60">{accessNote}</p>
        ) : null}
        {onCopyInvite ? (
          <button
            type="button"
            onClick={() => void onCopyInvite()}
            className="meta-font mt-3 text-xs font-medium text-accent underline"
          >
            Copy invite link
          </button>
        ) : null}

        <section className="mt-5">
          <h3 className="text-sm font-medium text-ink">Owner</h3>
          {owner?.userId ? (
            <p className="mt-2 rounded-lg border border-mutedline bg-cream px-3 py-2 text-sm text-ink">
              {owner.displayName || owner.username || 'Unknown'}
              <span className="meta-font text-ink/50"> @{owner.username}</span>
              {isYou(owner.userId) ? (
                <span className="meta-font ml-2 text-[10px] text-sage">You</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink/55">No account owner (link-only room).</p>
          )}
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-medium text-ink">Shared</h3>
          {shared.length === 0 ? (
            <p className="mt-2 text-sm text-ink/55">
              {owner
                ? 'Only the owner has been added so far.'
                : 'Sharing by account is unavailable for this room.'}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {shared.map((s) => (
                <li
                  key={s.userId}
                  className="rounded-lg border border-mutedline bg-cream px-3 py-2 text-sm text-ink"
                >
                  {s.displayName || s.username}
                  <span className="meta-font text-ink/50"> @{s.username}</span>
                  {isYou(s.userId) ? (
                    <span className="meta-font ml-2 text-[10px] text-sage">You</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default RoomMembersPanel
