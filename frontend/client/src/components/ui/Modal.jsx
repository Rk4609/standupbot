import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { IconClose } from './icons'
import { DURATION, EASE } from '../../lib/motion'

/**
 * A panel over the page, for something you finish and dismiss.
 *
 * Escape closes it, so does clicking the dark; focus moves into it on open
 * and back to whatever opened it on close, because a dialog that leaves the
 * keyboard behind on the page underneath is worse than no dialog. On a phone
 * it rises from the bottom edge and can fill the screen — a centred box with
 * a form in it is unusable at 400px.
 *
 * Rendered into document.body. Opened from inside a card, it was positioned
 * against the card's animation transform instead of the screen: squeezed
 * into the card, cut off below the fold, with page scrolling already locked
 * — which looked like the whole page had frozen.
 */
export default function Modal({ title, subtitle, onClose, children, labelledBy }) {
  const panel = useRef(null)
  const opener = useRef(null)

  /**
   * The close handler is read through a ref, and the effect runs once.
   *
   * Callers pass an inline arrow, so its identity changes on every render —
   * and every keystroke in a form whose state lives in the parent is a
   * render. With `onClose` in the dependency list this effect tore down and
   * set up again on each character, re-focusing the first control and
   * dropping everything typed after the first letter.
   */
  const closer = useRef(onClose)

  // Assigned in an effect rather than during render, so the ref is only
  // written where React allows it
  useEffect(() => {
    closer.current = onClose
  }, [onClose])

  useEffect(() => {
    opener.current = document.activeElement

    // The first control, not the panel itself: somebody opening "edit" wants
    // to type, not to tab past a heading first
    // A field before any button: the close button comes first in the markup
    const first =
      panel.current?.querySelector('input:not([type="hidden"]), select, textarea') ||
      panel.current?.querySelector('button')
    first?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') closer.current()
    }
    window.addEventListener('keydown', onKey)

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener.current?.focus?.()
    }
  }, [])

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.fast }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4"
        onMouseDown={e => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={labelledBy ? undefined : title}
          aria-labelledby={labelledBy}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: DURATION.base, ease: EASE }}
          className="scroll-slim max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card border border-line bg-surface shadow-xl sm:rounded-card"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-heading font-semibold text-content">{title}</h2>
              {subtitle && (
                <p className="mt-0.5 text-xs text-content-subtle">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>

          <div className="px-5 py-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
