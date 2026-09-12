import { getUser } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

/**
 * POST to an SSE endpoint and stream `data: {"text": "..."}` frames back.
 *
 * Axios cannot expose a streaming body, so these endpoints use fetch directly —
 * this keeps the parsing in one place instead of duplicated per page.
 */
export async function streamAi(path, body, { signal, onText, onError } = {}) {
  const user = getUser()

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user?.token}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    let message = 'Request failed'
    try {
      message = (await res.json()).message || message
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Keep the trailing partial line in the buffer for the next chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue

      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        if (parsed.text) onText?.(parsed.text)
        if (parsed.error) onError?.(parsed.error)
      } catch {
        // partial frame — the next chunk completes it
      }
    }
  }
}
