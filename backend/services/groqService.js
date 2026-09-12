const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Groq retires models fairly often — `llama-3.3-70b-versatile` was removed and
// silently broke every AI call. Keep it overridable without a code change, and
// check https://api.groq.com/openai/v1/models when requests start 404-ing.
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'

const callGroq = async ({ system, prompt, maxTokens, temperature, stream }) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature,
      stream,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    })
  })

  if (!response.ok) {
    let message = `Groq API error (${response.status})`
    try {
      const err = await response.json()
      message = err.error?.message || message
    } catch {
      // non-JSON error body
    }
    throw new Error(message)
  }

  return response
}

/**
 * Stream a completion to an SSE response.
 *
 * Frames are re-emitted as `data: {"text": "..."}` so the client does not need
 * to know the provider's wire format. Resolves with the full text once the
 * stream ends, which lets callers persist the result.
 */
const streamChat = async ({
  system,
  prompt,
  res,
  maxTokens = 1500,
  temperature = 0.7
}) => {
  const response = await callGroq({ system, prompt, maxTokens, temperature, stream: true })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  // Tell reverse proxies (Render/nginx) not to buffer, or nothing streams
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Keep the trailing partial line for the next chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue

      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const text = parsed.choices?.[0]?.delta?.content || ''
        if (text) {
          full += text
          res.write(`data: ${JSON.stringify({ text })}\n\n`)
        }
      } catch {
        // partial frame — completed by the next chunk
      }
    }
  }

  res.write('data: [DONE]\n\n')
  return full
}

/** Non-streaming completion — used by the cron jobs, which have no response. */
const completeChat = async ({ system, prompt, maxTokens = 1500, temperature = 0.7 }) => {
  const response = await callGroq({ system, prompt, maxTokens, temperature, stream: false })
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

module.exports = { streamChat, completeChat, DEFAULT_MODEL }
