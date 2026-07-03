import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTokenFromUrl, setRoomInUrl,
  loadStoredToken, storeToken, clearStoredToken,
} from '../useCollaboration'

function setUrl(path) {
  window.history.replaceState({}, '', path)
}

describe('collab room token URL handling', () => {
  beforeEach(() => {
    setUrl('/')
    sessionStorage.clear()
  })

  it('reads the token from the #ctk fragment', () => {
    setUrl('/?room=ABCD-EFGH#ctk=secret-123')
    expect(getTokenFromUrl()).toBe('secret-123')
  })

  it('decodes percent-encoded fragment tokens', () => {
    setUrl('/?room=ABCD-EFGH#ctk=a%2Bb%3Dc')
    expect(getTokenFromUrl()).toBe('a+b=c')
  })

  it('still accepts a legacy ?token= query param', () => {
    setUrl('/?room=ABCD-EFGH&token=legacy-secret')
    expect(getTokenFromUrl()).toBe('legacy-secret')
  })

  it('prefers the fragment over a legacy query param', () => {
    setUrl('/?room=ABCD-EFGH&token=old#ctk=new')
    expect(getTokenFromUrl()).toBe('new')
  })

  it('returns null when no token is present', () => {
    setUrl('/?room=ABCD-EFGH')
    expect(getTokenFromUrl()).toBeNull()
  })

  it('setRoomInUrl never puts the token in the query string', () => {
    setUrl('/?room=ABCD-EFGH&token=legacy-secret')
    setRoomInUrl('ABCD-EFGH', 'legacy-secret')
    const url = new URL(window.location.href)
    expect(url.searchParams.get('token')).toBeNull()
    expect(url.searchParams.get('room')).toBe('ABCD-EFGH')
    expect(url.hash).toBe('#ctk=legacy-secret')
    // Round-trips through the reader
    expect(getTokenFromUrl()).toBe('legacy-secret')
  })

  it('setRoomInUrl clears the fragment when there is no token', () => {
    setUrl('/?room=ABCD-EFGH#ctk=stale')
    setRoomInUrl('ABCD-EFGH', null)
    expect(window.location.hash).toBe('')
  })

  it('persists and clears tokens per room in sessionStorage', () => {
    storeToken('ROOM-1', 'tok-1')
    storeToken('ROOM-2', 'tok-2')
    expect(loadStoredToken('ROOM-1')).toBe('tok-1')
    expect(loadStoredToken('ROOM-2')).toBe('tok-2')
    clearStoredToken('ROOM-1')
    expect(loadStoredToken('ROOM-1')).toBeNull()
    expect(loadStoredToken('ROOM-2')).toBe('tok-2')
  })
})
