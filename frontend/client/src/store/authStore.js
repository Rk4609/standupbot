// Zustand nahi — simple localStorage helper
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('standupbot_user')) || null
  } catch {
    return null
  }
}

export const saveUser = (userData) => {
  localStorage.setItem('standupbot_user', JSON.stringify(userData))
}

export const removeUser = () => {
  localStorage.removeItem('standupbot_user')

  // PWA — cached API responses clear karo, warna next user ko
  // purane user ka data offline/stale serve ho sakta hai
  if (typeof caches !== 'undefined') {
    caches.delete('standupbot-api-cache').catch(() => {})
  }
}