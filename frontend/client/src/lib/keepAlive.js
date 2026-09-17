/**
 * Which kept page a path belongs to, or null for one that must open fresh.
 *
 * Every Workspace tab is one entry — Workspace keeps its own tabs. A new
 * standup is never kept: it is a form, and coming back to it should not show
 * what was typed and already submitted.
 */
export const keepKeyFor = (pathname) => {
  if (pathname.startsWith('/workspace')) return '/workspace'
  if (pathname.startsWith('/standup/new')) return null
  return pathname
}
