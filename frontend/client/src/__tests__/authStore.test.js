import { describe, expect, it } from 'vitest'
import { getUser, saveUser, removeUser } from '../store/authStore'

const session = { _id: '1', name: 'Asha', token: 'jwt-token' }

/**
 * "Remember me" is wired to real storage behaviour, so these assertions are
 * what stop it quietly becoming a decorative checkbox.
 */
describe('authStore', () => {
  it('persists across restarts when remember is on', () => {
    saveUser(session, { remember: true })

    expect(JSON.parse(localStorage.getItem('standupbot_user'))).toMatchObject(session)
    expect(sessionStorage.getItem('standupbot_user')).toBeNull()
  })

  it('keeps the session to the tab when remember is off', () => {
    saveUser(session, { remember: false })

    expect(JSON.parse(sessionStorage.getItem('standupbot_user'))).toMatchObject(session)
    expect(localStorage.getItem('standupbot_user')).toBeNull()
  })

  it('defaults to remembering', () => {
    saveUser(session)
    expect(localStorage.getItem('standupbot_user')).toBeTruthy()
  })

  it('moves the session when the choice changes, leaving no copy behind', () => {
    saveUser(session, { remember: true })
    saveUser(session, { remember: false })

    expect(localStorage.getItem('standupbot_user')).toBeNull()
    expect(sessionStorage.getItem('standupbot_user')).toBeTruthy()
  })

  it('reads a session from either store', () => {
    sessionStorage.setItem('standupbot_user', JSON.stringify(session))
    expect(getUser()).toMatchObject(session)

    sessionStorage.clear()
    localStorage.setItem('standupbot_user', JSON.stringify(session))
    expect(getUser()).toMatchObject(session)
  })

  it('returns null rather than throwing on a corrupt entry', () => {
    localStorage.setItem('standupbot_user', 'not-json{')
    expect(getUser()).toBeNull()
  })

  it('clears both stores on sign out', () => {
    localStorage.setItem('standupbot_user', JSON.stringify(session))
    sessionStorage.setItem('standupbot_user', JSON.stringify(session))

    removeUser()

    expect(getUser()).toBeNull()
    expect(localStorage.getItem('standupbot_user')).toBeNull()
    expect(sessionStorage.getItem('standupbot_user')).toBeNull()
  })
})
