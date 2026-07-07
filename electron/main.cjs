'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = !app.isPackaged
let mainWindow = null

// ─── PATH HELPERS ─────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getEnginguityDir() {
  return ensureDir(path.join(os.homedir(), 'Documents', 'Enginguity'))
}

function getDataDir() {
  return ensureDir(path.join(getEnginguityDir(), 'data'))
}

// ─── WINDOW STATE ─────────────────────────────────────────────────────────────

const windowStateFile = path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState() {
  try {
    if (fs.existsSync(windowStateFile)) {
      return JSON.parse(fs.readFileSync(windowStateFile, 'utf8'))
    }
  } catch {}
  return { width: 1400, height: 900, x: undefined, y: undefined, maximized: false }
}

function saveWindowState(win) {
  try {
    const bounds = win.getBounds()
    fs.writeFileSync(windowStateFile, JSON.stringify({ ...bounds, maximized: win.isMaximized() }))
  } catch {}
}

// ─── WINDOW ───────────────────────────────────────────────────────────────────

function createWindow() {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    width: state.width || 1400,
    height: state.height || 900,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: '#111314',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (state.maximized) mainWindow.maximize()

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('close', () => saveWindowState(mainWindow))

  // ── Navigation hardening ────────────────────────────────────────────
  // The preload bridge (file access, dialogs) must never be exposed to a
  // remote origin. Navigation is confined to the app's own origin; https
  // links open in the system browser, everything else is dropped.
  const isAppUrl = (url) =>
    isDev ? url.startsWith('http://localhost:5173') : url.startsWith('file://')

  const isLoopbackHost = (host) => (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1'
  )

  const shouldOpenExternal = (url) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:') return true
      if (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) return true
    } catch {}
    return false
  }

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    if (shouldOpenExternal(url)) shell.openExternal(url)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternal(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  buildMenu()
}

// ─── NATIVE MENU ──────────────────────────────────────────────────────────────

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('menu-open-settings'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Folder',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => shell.openPath(getDataDir()),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }]),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── IPC HANDLERS ─────────────────────────────────────────────────────────────

ipcMain.handle('get-paths', () => ({
  enginguityDir: getEnginguityDir(),
  dataDir: getDataDir(),
  userData: app.getPath('userData'),
  home: os.homedir(),
}))

ipcMain.handle('save-data', (_e, key, data) => {
  try {
    const safe = String(key).replace(/[^a-zA-Z0-9_\-]/g, '_')
    fs.writeFileSync(path.join(getDataDir(), `${safe}.json`), JSON.stringify(data, null, 2), 'utf8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('load-data', (_e, key) => {
  try {
    const safe = String(key).replace(/[^a-zA-Z0-9_\-]/g, '_')
    const file = path.join(getDataDir(), `${safe}.json`)
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
})

ipcMain.handle('list-data-files', () => {
  try {
    const dir = getDataDir()
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f))
        return { name: f.replace(/\.json$/, ''), filename: f, size: stat.size, modified: stat.mtimeMs }
      })
      .sort((a, b) => b.modified - a.modified)
  } catch {
    return []
  }
})

ipcMain.handle('open-data-folder', () => shell.openPath(getDataDir()))

// Scoped: the renderer may only open paths inside the app's own data
// directories. Validated here in the main process — the preload is not a
// trust boundary a compromised renderer has to respect.
ipcMain.handle('open-path', (_e, p) => {
  const resolved = path.resolve(String(p))
  const allowedRoots = [getEnginguityDir(), app.getPath('userData')]
  const allowed = allowedRoots.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  )
  if (!allowed) return Promise.resolve('Blocked: path is outside the app data directories.')
  return shell.openPath(resolved)
})

ipcMain.handle('delete-data', (_e, key) => {
  try {
    const safe = String(key).replace(/[^a-zA-Z0-9_\-]/g, '_')
    const file = path.join(getDataDir(), `${safe}.json`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('dialog-open', async (_e, opts) => dialog.showOpenDialog(mainWindow, opts))
ipcMain.handle('dialog-save', async (_e, opts) => dialog.showSaveDialog(mainWindow, opts))

ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('get-platform', () => process.platform)

// ─── APP LIFECYCLE ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
