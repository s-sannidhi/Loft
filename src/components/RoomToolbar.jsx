import { useEffect, useRef, useState } from 'react'

const COPY_CONFIRM_MS = 2200

function RoomToolbar({
  roomId,
  movieCount,
  onCopyInvite,
  onOpenMembers,
  onOpenShare,
  showShareRoom,
  onSyncShelf,
}) {
  const [linkCopied, setLinkCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const copyResetRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    return () => {
      if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  async function handleCopyInviteClick() {
    const ok = await onCopyInvite()
    if (!ok) return
    setLinkCopied(true)
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current)
    copyResetRef.current = window.setTimeout(() => {
      setLinkCopied(false)
      copyResetRef.current = null
    }, COPY_CONFIRM_MS)
  }

  const btnClass =
    'meta-font rounded-lg border border-mutedline bg-cream px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-card md:text-xs'

  const actions = (
    <>
      <button type="button" onClick={onOpenMembers} className={btnClass}>
        Members
      </button>
      {showShareRoom && onOpenShare ? (
        <button type="button" onClick={onOpenShare} className={btnClass}>
          Share
        </button>
      ) : null}
      {onSyncShelf ? (
        <button type="button" onClick={onSyncShelf} className={btnClass}>
          Sync shelf
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleCopyInviteClick}
        className={`${btnClass} border-honey/50`}
      >
        {linkCopied ? 'Copied!' : 'Copy invite'}
      </button>
    </>
  )

  return (
    <div className="border-t border-mutedline/80 pt-3 pb-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="meta-font text-xs text-ink/60">
            Shared room ·{' '}
            <span className="font-medium text-ink">{movieCount}</span> titles
            {roomId ? (
              <>
                {' '}
                ·{' '}
                <span className="text-ink/45" title={roomId}>
                  id {roomId.slice(0, 8)}…
                </span>
              </>
            ) : null}
          </p>
          <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
            {actions}
          </div>
          <div className="relative md:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={btnClass}
              aria-expanded={menuOpen}
            >
              Room menu
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 flex min-w-[11rem] flex-col gap-1 rounded-xl border border-mutedline bg-card p-2 shadow-cafe-lg">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-cream"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenMembers()
                  }}
                >
                  Members
                </button>
                {showShareRoom && onOpenShare ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-cream"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenShare()
                    }}
                  >
                    Share
                  </button>
                ) : null}
                {onSyncShelf ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-cream"
                    onClick={() => {
                      setMenuOpen(false)
                      onSyncShelf()
                    }}
                  >
                    Sync shelf
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-cream"
                  onClick={() => {
                    setMenuOpen(false)
                    void handleCopyInviteClick()
                  }}
                >
                  Copy invite link
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoomToolbar
