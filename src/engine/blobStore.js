// IndexedDB blob storage for large binary payloads that don't belong in
// localStorage (full-resolution images, generated SVGs over 50KB, captured
// photos, etc.). Used alongside persistenceEngine — the zustand store keeps
// metadata + thumbnails; this store keeps the full content.

import { openDB } from 'idb'

const DB_NAME = 'enginguity-blobs'
const DB_VERSION = 1
const STORE = 'blobs'

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('category', 'category')
          store.createIndex('createdAt', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

export const blobStore = {
  save: async (id, data) => {
    const db = await getDB()
    await db.put(STORE, {
      id,
      ...data,
      savedAt: Date.now(),
    })
    return id
  },

  get: async (id) => {
    if (!id) return null
    const db = await getDB()
    return db.get(STORE, id)
  },

  getAll: async (category) => {
    const db = await getDB()
    if (category) {
      return db.getAllFromIndex(STORE, 'category', category)
    }
    return db.getAll(STORE)
  },

  delete: async (id) => {
    const db = await getDB()
    return db.delete(STORE, id)
  },

  clear: async (category) => {
    const db = await getDB()
    if (category) {
      const items = await db.getAllFromIndex(STORE, 'category', category)
      await Promise.all(items.map((i) => db.delete(STORE, i.id)))
      return items.length
    }
    await db.clear(STORE)
    return null
  },

  getStorageSize: async () => {
    const db = await getDB()
    const all = await db.getAll(STORE)
    return all.reduce((sum, item) => sum + (item.content?.length || 0), 0)
  },

  getStorageSizeByCategory: async (category) => {
    const db = await getDB()
    const items = await db.getAllFromIndex(STORE, 'category', category)
    return items.reduce((sum, item) => sum + (item.content?.length || 0), 0)
  },
}

export function formatBytes(bytes) {
  if (bytes == null) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}
