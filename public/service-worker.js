const STATIC_CACHE = 'enginguity-static-v3'
const DYNAMIC_CACHE = 'enginguity-dynamic-v3'
const API_CACHE = 'enginguity-api-v3'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/offline.html',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js',
  'https://cdn.jsdelivr.net/npm/lz-string/libs/lz-string.min.js'
]

// Hash request body to cache API requests uniquely
async function hashRequestBody(request) {
  const cloned = request.clone()
  const text = await cloned.text()
  
  // Simple hashing algorithm
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return hash.toString(16)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Pre-caching PWA app shell assets...')
      return cache.addAll(STATIC_ASSETS)
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE) {
            console.log('Deleting obsolete SW cache:', key)
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 1. API Calls Strategy (Network-First)
  if (
    url.hostname.includes('api.anthropic.com') ||
    url.hostname.includes('api.openai.com') ||
    url.hostname.includes('api.cohere.com') ||
    url.hostname.includes('api.google.com')
  ) {
    event.respondWith(
      (async () => {
        const reqHash = await hashRequestBody(event.request)
        const cacheKey = `${event.request.url}#${reqHash}`

        try {
          const networkResponse = await fetch(event.request)
          
          if (networkResponse.ok) {
            const cache = await caches.open(API_CACHE)
            const clonedResponse = networkResponse.clone()
            
            // Add custom header/meta for TTL (1 hour = 3600 seconds)
            const ttlResponse = new Response(clonedResponse.body, {
              status: clonedResponse.status,
              statusText: clonedResponse.statusText,
              headers: new Headers(clonedResponse.headers)
            })
            ttlResponse.headers.append('X-Enginguity-Cache-Time', Date.now().toString())

            await cache.put(cacheKey, ttlResponse)
          }
          return networkResponse
        } catch (err) {
          console.log('Network API call failed. Checking offline cache...')
          const cache = await caches.open(API_CACHE)
          const cachedResponse = await cache.match(cacheKey)

          if (cachedResponse) {
            const cachedTime = cachedResponse.headers.get('X-Enginguity-Cache-Time')
            const age = Date.now() - parseInt(cachedTime || '0')
            
            // Limit API Cache TTL to 1 hour
            if (age < 3600000) {
              const headers = new Headers(cachedResponse.headers)
              headers.append('X-Enginguity-Cached', 'true')
              return new Response(cachedResponse.body, {
                status: 200,
                headers
              })
            }
          }

          // Cache miss/expired offline fallback response
          return new Response(
            JSON.stringify({
              offline: true,
              message: 'AI features require internet. Your data is safe — reconnect to continue.'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
      })()
    )
    return
  }

  // 2. Navigation HTML requests (Network-First -> Cache -> offline.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const cache = caches.open(STATIC_CACHE)
            cache.then(c => c.put(event.request, networkResponse.clone()))
          }
          return networkResponse
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => cached || caches.match('/index.html'))
            .then(cached => cached || caches.match('/offline.html'))
        })
    )
    return
  }

  // 3. Static/CDN Assets (Cache-First)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache if online (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, networkResponse))
          }
        }).catch(() => {}) // Ignore background fetch errors

        return cachedResponse
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          return caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(event.request, networkResponse.clone())
            return networkResponse
          })
        }
        return networkResponse
      })
    })
  )
})

// 4. Background Sync Notebook triggers
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notebook') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_PENDING_ITEMS' })
        })
      })
    )
  }
})
