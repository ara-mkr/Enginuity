/**
 * API-key storage. Keys live in sessionStorage — NOT localStorage — so
 * plaintext secrets don't persist on disk and aren't exposed to anything
 * that can enumerate localStorage (e.g. embedded content, extensions,
 * or a copied browser profile). The cost: keys must be re-entered per
 * browser session.
 *
 * Any legacy localStorage copy from earlier builds is migrated into the
 * session and deleted on first read.
 */

export function readStoredKey(storageKey: string): string | null {
  try {
    const session = sessionStorage.getItem(storageKey)
    if (session) return session
    const legacy = localStorage.getItem(storageKey)
    if (legacy) {
      sessionStorage.setItem(storageKey, legacy)
      localStorage.removeItem(storageKey)
      return legacy
    }
    return null
  } catch {
    return null
  }
}

export function writeStoredKey(storageKey: string, key: string): void {
  try {
    sessionStorage.setItem(storageKey, key)
    localStorage.removeItem(storageKey)
  } catch {
    // Storage unavailable (private mode/quota) — the key stays in memory only.
  }
}

export function clearStoredKey(storageKey: string): void {
  try {
    sessionStorage.removeItem(storageKey)
    localStorage.removeItem(storageKey)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
