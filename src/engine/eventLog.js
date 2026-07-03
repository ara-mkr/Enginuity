import { v4 as uuid } from 'uuid'

const STORAGE_KEY = 'enginguity_event_log'
const MAX_EVENTS = 2000
// Hard byte cap on the serialized log so it can never crowd out the rest
// of localStorage (~1MB of a typical 5MB quota).
const MAX_BYTES = 1_000_000

/**
 * Appends an event to the persisted log. Logging is a side effect and must
 * never break the operation being logged: every failure path is swallowed
 * (with a console.error) rather than thrown.
 *
 * Do NOT put full AI prompt/response bodies (or any secret) in `data` —
 * the log lives in plaintext localStorage. Log lengths/hashes instead;
 * see summarizeAIExchange.
 */
export function logEvent(type, data) {
  const event = {
    id: uuid(),
    type,
    timestamp: Date.now(),
    data,
    module: (data && data.module) || 'global',
  }

  try {
    let log
    try {
      log = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (!Array.isArray(log)) log = []
    } catch {
      log = [] // corrupted log — start fresh rather than fail forever
    }

    log.push(event)
    if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS)

    let serialized = JSON.stringify(log)
    while (serialized.length > MAX_BYTES && log.length > 1) {
      log.splice(0, Math.max(1, Math.ceil(log.length / 10))) // drop oldest 10%
      serialized = JSON.stringify(log)
    }

    try {
      localStorage.setItem(STORAGE_KEY, serialized)
    } catch (quotaErr) {
      // Quota pressure from other keys: halve the log and retry once.
      log.splice(0, Math.ceil(log.length / 2))
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
      } catch {
        console.error('eventLog: could not persist event log:', quotaErr)
      }
    }
  } catch (e) {
    console.error('eventLog: failed to log event:', e)
  }

  // Dispatch a global event so the UI can listen and refresh automatically
  try {
    window.dispatchEvent(new CustomEvent('enginguity:event_logged', { detail: event }))
  } catch (e) {
    console.error('eventLog: failed to dispatch event:', e)
  }
}

/**
 * Privacy-safe summary of an AI exchange for logging: lengths and a short
 * FNV-1a content hash (enough to correlate duplicate responses while
 * debugging) instead of the plaintext bodies.
 */
export function summarizeAIExchange(promptText, responseText) {
  return {
    promptLength: (promptText || '').length,
    responseLength: (responseText || '').length,
    responseHash: fnv1aHex(responseText || ''),
  }
}

function fnv1aHex(str) {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
