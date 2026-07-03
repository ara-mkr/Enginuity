const DB_NAME = 'enginguity_offline_db'
const DB_VERSION = 1

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = request.result
      
      // Create Object Stores
      const stores = [
        'project',
        'notebook',
        'parameters',
        'files',
        'bom',
        'challenges',
        'pending_sync'
      ]

      stores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      })
    }
  })
}

export async function dbGet(storeName, key) {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function dbSet(storeName, key, value) {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(value, key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function dbDelete(storeName, key) {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function dbGetAll(storeName) {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function dbGetAllKeys(storeName) {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAllKeys()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Migration utility to copy localStorage entries to IndexedDB on first load
export async function migrateFromLocalStorage() {
  if (localStorage.getItem('enginguity_db_migrated')) return

  try {
    // 1. Migrate Notebook entries
    const notebookStr = localStorage.getItem('enginguity_notebook')
    if (notebookStr) {
      const entries = JSON.parse(notebookStr)
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (entry && entry.id) {
            await dbSet('notebook', entry.id, entry)
          }
        }
      }
    }

    // 2. Migrate BOM entries
    const bomStr = localStorage.getItem('enginguity_boms')
    if (bomStr) {
      const bomData = JSON.parse(bomStr)
      await dbSet('bom', 'current', bomData)
    }

    // 3. Migrate Current Project
    const projectStr = localStorage.getItem('enginguity_project')
    if (projectStr) {
      const projectData = JSON.parse(projectStr)
      await dbSet('project', 'current', projectData)
    }

    localStorage.setItem('enginguity_db_migrated', 'true')
    console.info('IndexedDB initial migration completed.')
  } catch (err) {
    console.error('Failed IndexedDB storage migration:', err)
  }
}
