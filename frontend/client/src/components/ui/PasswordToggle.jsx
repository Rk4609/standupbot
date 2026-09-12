import { IconEye, IconEyeOff } from './icons'

/** Show/hide affordance for password inputs. */
export default function PasswordToggle({ revealed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      // tabIndex -1 so Tab moves from the password field straight to the next
      // control rather than into a decorative toggle
      tabIndex={-1}
      aria-label={revealed ? 'Hide password' : 'Show password'}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content-muted"
    >
      {revealed ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
    </button>
  )
}
