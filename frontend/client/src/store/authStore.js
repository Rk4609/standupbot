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
}