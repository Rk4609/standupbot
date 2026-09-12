/**
 * Turn an axios failure into something a reader can act on.
 *
 * Falling straight through to a generic "Could not load X" hides the useful
 * part: a 404 usually means the server is running an older build, a 401 means
 * the session lapsed, and a missing response means the request never landed.
 */
export const apiErrorMessage = (err, fallback = 'Something went wrong') => {
  // The API's own message is always the most specific thing available
  const serverMessage = err?.response?.data?.message
  if (serverMessage) return serverMessage

  const status = err?.response?.status

  if (status === 404) {
    return 'This endpoint is not on the server yet — it is probably still deploying. Try again in a minute.'
  }
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have access to this.'
  if (status >= 500) return `The server errored (${status}). Try again shortly.`
  if (status) return `Request failed (${status}).`

  // Request was made but no response came back
  if (err?.request) {
    return navigator.onLine
      ? 'Could not reach the server. It may be starting up.'
      : 'You are offline.'
  }

  return err?.message || fallback
}
