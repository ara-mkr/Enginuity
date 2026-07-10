import { useState, useRef, useCallback, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { useEnginguityStore } from '../../../engine/persistenceEngine'
import { blobStore } from '../../../engine/blobStore'
import type { CanvasItem, CanvasGroup, CanvasTransform, LogEntry, PlaceItemInput } from '../types'
import type { JarvisIntent } from '../JarvisModule'

// Legacy raw-localStorage keys from before the canvas lived in the global
// zustand store. Read once for migration, then removed.
const LEGACY_ITEMS = 'enginguity_jarvis_canvas'
const LEGACY_TRANSFORM = 'enginguity_jarvis_transform'
const LEGACY_GROUPS = 'enginguity_jarvis_groups'

const PHOTO_BLOB_PREFIX = 'jarvis-photo-'
const isHeavyItem = (it: Pick<CanvasItem, 'type'>) => it.type === 'photo' || it.type === 'image'

interface CanvasSnapshot {
  items: CanvasItem[]
  groups: CanvasGroup[]
  transform: CanvasTransform
}

function loadInitialCanvas(): CanvasSnapshot {
  const stored = useEnginguityStore.getState().jarvisCanvas ?? {}
  let items: CanvasItem[] = stored.items ?? []
  let groups: CanvasGroup[] = stored.groups ?? []
  let transform: CanvasTransform = stored.transform ?? { x: 0, y: 0, scale: 1 }

  try {
    const legacyItems = localStorage.getItem(LEGACY_ITEMS)
    if (items.length === 0 && legacyItems) {
      items = JSON.parse(legacyItems) || []
      groups = JSON.parse(localStorage.getItem(LEGACY_GROUPS) || '[]') || []
      transform = JSON.parse(localStorage.getItem(LEGACY_TRANSFORM) || 'null') || transform
    }
    localStorage.removeItem(LEGACY_ITEMS)
    localStorage.removeItem(LEGACY_TRANSFORM)
    localStorage.removeItem(LEGACY_GROUPS)
  } catch {
    // Unreadable legacy state — the store copy (possibly empty) wins.
  }
  return { items, groups, transform }
}

interface UseJarvisCanvasParams {
  speak: (text: string, intent?: JarvisIntent) => void
  addLog: (role: LogEntry['role'], text: string) => void
}

/**
 * Owns the infinite canvas: placed items, groups, pan/zoom transform, and
 * the mutations that touch them (place, update, move, resize, undo, clear).
 * Also owns the "burst of placements → auto-group" session tracking, which
 * is a canvas-grouping concern distinct from useJarvisSession's cost/command
 * bookkeeping despite the similar name.
 */
export function useJarvisCanvas({ speak, addLog }: UseJarvisCanvasParams) {
  const [initial] = useState<CanvasSnapshot>(loadInitialCanvas)
  const [items, setItems] = useState<CanvasItem[]>(initial.items)
  const [groups, setGroups] = useState<CanvasGroup[]>(initial.groups)
  const [transform, setTransform] = useState<CanvasTransform>(initial.transform)
  const [placementCount, setPlacementCount] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped persistence store selector
  const setJarvisCanvasState = useEnginguityStore((s: any) => s.setJarvisCanvasState)

  const itemsRef = useRef(items)
  const transformRef = useRef(transform)
  const placementCountRef = useRef(0)
  useEffect(() => {
    itemsRef.current = items
    transformRef.current = transform
  }, [items, transform])

  // Auto-grouping: a burst of items placed within 60s of a voice command gets grouped
  const sessionRef = useRef<{
    id: string
    itemIds: string[]
    command: string
    startTime: number
  } | null>(null)
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persist through the global store (its partialize strips heavy image
  // payloads — those live in blobStore, referenced by content.blobId).
  useEffect(() => {
    setJarvisCanvasState({ items, groups, transform })
  }, [items, groups, transform, setJarvisCanvasState])

  // Rehydrate photo/image payloads from blobStore after a reload.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pending = itemsRef.current.filter(
        (it) => isHeavyItem(it) && it.content?.blobId && !it.content?.dataURL
      )
      if (pending.length === 0) return
      const blobs = await Promise.all(
        pending.map((it) => blobStore.get(it.content.blobId).catch(() => null))
      )
      if (cancelled) return
      const byId = new Map(pending.map((it, i) => [it.id, blobs[i]]))
      setItems((prev) =>
        prev.map((it) => {
          const blob = byId.get(it.id)
          if (!blob) return it
          return {
            ...it,
            content: { ...it.content, dataURL: blob.dataURL ?? null, base64: blob.base64 ?? null },
          }
        })
      )
    })()
    return () => { cancelled = true }
  }, [])

  const getPlacementPos = useCallback(() => {
    const t = transformRef.current
    const canvasHeight = window.innerHeight - 32 - 172
    const cx = (window.innerWidth / 2 - t.x) / t.scale
    const cy = (canvasHeight / 2 - t.y) / t.scale
    const offset = (placementCountRef.current % 10) * 28
    placementCountRef.current++
    setPlacementCount(placementCountRef.current)
    return { x: cx - 200 + offset, y: cy - 100 + offset }
  }, [])

  const placeItem = useCallback(
    (
      partial: PlaceItemInput
    ): CanvasItem => {
      const pos = getPlacementPos()
      const item: CanvasItem = {
        ...partial,
        id: uuid(),
        x: partial.x ?? pos.x,
        y: partial.y ?? pos.y,
        width: partial.width || 0,
        height: partial.height || 0,
        createdAt: Date.now(),
        fromCommand: partial.fromCommand || '',
      }

      // Image payloads go to IndexedDB; the canvas item carries a reference.
      // The in-memory copy keeps dataURL/base64 for immediate rendering —
      // the store's partialize strips them from what hits localStorage.
      if (isHeavyItem(item) && item.content?.dataURL) {
        const blobId = `${PHOTO_BLOB_PREFIX}${item.id}`
        item.content = { ...item.content, blobId }
        blobStore
          .save(blobId, {
            category: 'jarvis-photo',
            dataURL: item.content.dataURL,
            base64: item.content.base64 ?? null,
          })
          .catch((e: unknown) => console.error('Failed to save Jarvis photo blob:', e))
      }

      setItems((prev) => [...prev, item])

      if (partial.autoRemoveAfter) {
        setTimeout(() => {
          setItems((prev) => prev.filter((it) => it.id !== item.id))
        }, partial.autoRemoveAfter)
      }

      // Session tracking for auto-grouping
      if (sessionRef.current) {
        sessionRef.current.itemIds.push(item.id)
        // Reset the 60s window
        if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current)
        sessionTimerRef.current = setTimeout(() => {
          const sess = sessionRef.current
          if (sess && sess.itemIds.length >= 3) {
            setGroups((prev) => [
              ...prev,
              {
                id: uuid(),
                itemIds: [...sess.itemIds],
                title: sess.command.slice(0, 40),
                createdAt: Date.now(),
              },
            ])
          }
          sessionRef.current = null
        }, 60_000)
      }

      return item
    },
    [getPlacementPos]
  )

  const updateCanvasItem = useCallback((id: string, updates: Partial<CanvasItem>) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, ...updates, content: { ...it.content, ...(updates.content || {}) } }
          : it
      )
    )
  }, [])

  const startSession = useCallback((command: string) => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current)
    sessionRef.current = {
      id: uuid(),
      itemIds: [],
      command,
      startTime: Date.now(),
    }
  }, [])

  const flashCanvasItem = useCallback((itemId: string) => {
    setItems(prev => prev.map(it => {
      if (it.id === itemId) return { ...it, flash: true }
      return it
    }))
    setTimeout(() => {
      setItems(prev => prev.map(it => {
        if (it.id === itemId) return { ...it, flash: false }
        return it
      }))
    }, 1000)
  }, [])

  const centerOnItem = useCallback((itemId: string) => {
    const target = itemsRef.current.find(it => it.id === itemId)
    if (target) {
      const canvasHeight = window.innerHeight - 32 - 172
      const cx = window.innerWidth / 2
      const cy = canvasHeight / 2
      setTransform({
        x: cx - target.x * transformRef.current.scale,
        y: cy - target.y * transformRef.current.scale,
        scale: transformRef.current.scale
      })
      speak("Centering on item.")
    }
  }, [speak])

  const handleItemMove = useCallback((id: string, x: number, y: number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, x, y } : it)))
  }, [])

  const handleItemResize = useCallback((id: string, w: number, h: number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, width: w, height: h } : it)))
  }, [])

  const handleUndo = useCallback(() => {
    setItems((prev) => {
      const removed = prev[prev.length - 1]
      if (removed && isHeavyItem(removed) && removed.content?.blobId) {
        blobStore.delete(removed.content.blobId).catch(() => {})
      }
      return prev.slice(0, -1)
    })
    addLog('system', '— Undo')
  }, [addLog])

  const clearCanvas = useCallback(() => {
    setItems([])
    setGroups([])
    blobStore.clear('jarvis-photo').catch(() => {})
    addLog('system', '— Canvas cleared')
    speak('Cleared. Canvas is empty.')
  }, [addLog, speak])

  return {
    items,
    setItems,
    itemsRef,
    groups,
    setGroups,
    transform,
    setTransform,
    transformRef,
    placementCount,
    getPlacementPos,
    placeItem,
    updateCanvasItem,
    startSession,
    flashCanvasItem,
    centerOnItem,
    handleItemMove,
    handleItemResize,
    handleUndo,
    clearCanvas,
  }
}
