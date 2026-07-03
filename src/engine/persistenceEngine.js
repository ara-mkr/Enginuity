// Global persistence layer for ENGINGUITY.
// Module state lives here so it survives navigation, tab switches, and refreshes.
// Large binaries (full SVGs, photos, full-res images) live in blobStore (IndexedDB);
// this store keeps only metadata + thumbnails so localStorage doesn't blow up.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { hybridStorage } from '../utils/electronBridge'

const emptyChatSlot = () => ({ messages: [], lastUpdated: null })

const initialModuleChats = {
  'parameter-playground': emptyChatSlot(),
  'cad-viewer': emptyChatSlot(),
  'circuit-sim': emptyChatSlot(),
  'datasheet': emptyChatSlot(),
  'bom': emptyChatSlot(),
  'debug-console': emptyChatSlot(),
  'formula-lab': emptyChatSlot(),
  'project-ideas': emptyChatSlot(),
  'notebook': emptyChatSlot(),
  'pcb-reviewer': emptyChatSlot(),
  'compliance': emptyChatSlot(),
  'supply-chain': emptyChatSlot(),
  'copilot': emptyChatSlot(),
  'asset-generator': emptyChatSlot(),
  'asset-generator-brainstorm': emptyChatSlot(),
}

export const useEnginguityStore = create(
  persist(
    (set, get) => ({
      // ─── ASSET GENERATOR ───────────────────────
      assetGen: {
        generatedAssets: [],
        activeTab: 'banner',
        lastPrompt: '',
        history: [],
      },

      addAssetGenResult: (asset) => set((state) => {
        const newAsset = {
          id: asset.id || crypto.randomUUID(),
          ...asset,
          generatedAt: asset.generatedAt || Date.now(),
        }
        return {
          assetGen: {
            ...state.assetGen,
            generatedAssets: [newAsset, ...state.assetGen.generatedAssets].slice(0, 200),
            history: [newAsset, ...state.assetGen.history].slice(0, 50),
          },
        }
      }),

      setAssetGenTab: (tab) => set((state) => ({
        assetGen: { ...state.assetGen, activeTab: tab },
      })),

      setAssetGenPrompt: (prompt) => set((state) => ({
        assetGen: { ...state.assetGen, lastPrompt: prompt },
      })),

      clearAssetGenSession: () => set((state) => ({
        assetGen: { ...state.assetGen, generatedAssets: [] },
      })),

      // ─── MODULE CHAT HISTORIES ─────────────────
      moduleChats: { ...initialModuleChats },

      addChatMessage: (moduleId, message) => set((state) => {
        const current = state.moduleChats[moduleId] || emptyChatSlot()
        return {
          moduleChats: {
            ...state.moduleChats,
            [moduleId]: {
              messages: [
                ...current.messages,
                {
                  id: message.id || crypto.randomUUID(),
                  ...message,
                  timestamp: message.timestamp || Date.now(),
                },
              ],
              lastUpdated: Date.now(),
            },
          },
        }
      }),

      replaceChatHistory: (moduleId, messages) => set((state) => ({
        moduleChats: {
          ...state.moduleChats,
          [moduleId]: {
            messages,
            lastUpdated: Date.now(),
          },
        },
      })),

      clearModuleChat: (moduleId) => set((state) => ({
        moduleChats: {
          ...state.moduleChats,
          [moduleId]: emptyChatSlot(),
        },
      })),

      getChatHistory: (moduleId) => get().moduleChats[moduleId]?.messages || [],

      // ─── FILE HISTORY ──────────────────────────
      fileHistory: [],

      addToFileHistory: (file) => set((state) => {
        const entry = {
          id: file.id || crypto.randomUUID(),
          name: file.name,
          ext: file.ext,
          category: file.category,
          sizeBytes: file.sizeBytes,
          aiContext: file.aiContext || null,
          thumbnail: file.thumbnail || null,
          dataURL: file.dataURL || null,
          svgContent: file.svgContent || null,
          blobId: file.blobId || null,
          sourceModule: file.sourceModule,
          prompt: file.prompt || null,
          style: file.style || null,
          loadedAt: Date.now(),
        }
        const filtered = state.fileHistory.filter(
          (f) => !(f.name === entry.name && f.sourceModule === entry.sourceModule),
        )
        return {
          fileHistory: [entry, ...filtered].slice(0, 100),
        }
      }),

      removeFromFileHistory: (id) => set((state) => ({
        fileHistory: state.fileHistory.filter((f) => f.id !== id),
      })),

      clearFileHistory: () => set({ fileHistory: [] }),

      // Re-open hand-off: when a file-history row is clicked we navigate to its
      // source module and stash the payload here. The module reads + clears it.
      pendingFileLoad: null,
      setPendingFileLoad: (payload) => set({ pendingFileLoad: payload }),
      consumePendingFileLoad: () => {
        const current = get().pendingFileLoad
        if (current) set({ pendingFileLoad: null })
        return current
      },

      // ─── PARAMETER PLAYGROUND ──────────────────
      playground: {
        parameters: {},
        equations: [],
        description: '',
        shareId: null,
        lastGenerated: null,
      },

      setPlaygroundState: (next) => set({ playground: next }),

      updatePlaygroundParam: (name, value) => set((state) => ({
        playground: {
          ...state.playground,
          parameters: {
            ...state.playground.parameters,
            [name]: { ...(state.playground.parameters[name] || {}), value },
          },
        },
      })),

      // ─── JARVIS CANVAS ─────────────────────────
      jarvisCanvas: {
        items: [],
        groups: [],
        transform: { x: 0, y: 0, scale: 1 },
        conversationLog: [],
      },

      // Bulk sync used by useJarvisCanvas — the hook owns interaction state
      // and mirrors it here so persistence/search/briefing all read one place.
      setJarvisCanvasState: (next) => set((state) => ({
        jarvisCanvas: { ...state.jarvisCanvas, ...next },
      })),

      addJarvisItem: (item) => set((state) => ({
        jarvisCanvas: {
          ...state.jarvisCanvas,
          items: [
            ...state.jarvisCanvas.items,
            { id: item.id || crypto.randomUUID(), ...item, createdAt: item.createdAt || Date.now() },
          ],
        },
      })),

      removeJarvisItem: (id) => set((state) => ({
        jarvisCanvas: {
          ...state.jarvisCanvas,
          items: state.jarvisCanvas.items.filter((i) => i.id !== id),
        },
      })),

      updateJarvisItem: (id, updates) => set((state) => ({
        jarvisCanvas: {
          ...state.jarvisCanvas,
          items: state.jarvisCanvas.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        },
      })),

      setJarvisTransform: (transform) => set((state) => ({
        jarvisCanvas: { ...state.jarvisCanvas, transform },
      })),

      addJarvisLog: (entry) => set((state) => ({
        jarvisCanvas: {
          ...state.jarvisCanvas,
          conversationLog: [
            ...state.jarvisCanvas.conversationLog,
            { id: crypto.randomUUID(), ...entry, timestamp: Date.now() },
          ].slice(-100),
        },
      })),

      // ─── DRAWING BOARD ─────────────────────────
      drawingBoards: {},

      saveDrawingBoard: (boardId, data) => set((state) => ({
        drawingBoards: {
          ...state.drawingBoards,
          [boardId]: { ...data, updatedAt: Date.now() },
        },
      })),

      // ─── BOM ───────────────────────────────────
      bom: { items: [], lastChecked: null, alerts: [] },

      setBOMItems: (items) => set((state) => ({ bom: { ...state.bom, items } })),

      // ─── CIRCUIT SIM ───────────────────────────
      circuitSim: {
        netlist: '',
        components: [],
        results: null,
        lastSimulation: null,
      },

      setCircuitSimState: (simState) => set({ circuitSim: simState }),

      // ─── DEBUG CONSOLE ─────────────────────────
      debugConsole: {
        files: [],
        activeFileId: null,
        terminalOutput: [],
        serialHistory: [],
      },

      setDebugFiles: (files) => set((state) => ({
        debugConsole: { ...state.debugConsole, files },
      })),

      addTerminalOutput: (line) => set((state) => ({
        debugConsole: {
          ...state.debugConsole,
          terminalOutput: [
            ...state.debugConsole.terminalOutput,
            { id: crypto.randomUUID(), ...line, timestamp: Date.now() },
          ].slice(-500),
        },
      })),

      // ─── LIVE DOCS ─────────────────────────────
      liveDocs: {
        sections: {},
        observations: [],
        title: null,
        lastGenerated: null,
      },

      addDocObservation: (obs) => set((state) => ({
        liveDocs: {
          ...state.liveDocs,
          observations: [
            ...state.liveDocs.observations,
            { id: crypto.randomUUID(), ...obs, timestamp: Date.now() },
          ],
        },
      })),

      setDocSection: (sectionKey, content) => set((state) => ({
        liveDocs: {
          ...state.liveDocs,
          sections: { ...state.liveDocs.sections, [sectionKey]: content },
        },
      })),

      // ─── FORMULA LAB ────────────────────────────
      formulaLab: {
        activeTab: 'calculator',
        sidebarTab: 'library',
        query: '',
        calculation: null,
        librarySearch: '',
      },

      setFormulaLabState: (next) => set((state) => ({
        formulaLab: { ...state.formulaLab, ...next },
      })),

      // ─── TEST HARNESS ───────────────────────────
      testHarness: {
        language: 'python',
        code: '',
        context: '',
        paramTypes: {},
        focusAreas: ['Zero values', 'Negative values', 'Boundary conditions'],
        count: 20,
        framework: 'pytest',
        testCases: [],
        selected: [],
        filterPriority: 'all',
        filterCategory: '',
        search: '',
        results: [],
        summary: null,
      },

      setTestHarnessState: (next) => set((state) => ({
        testHarness: { ...state.testHarness, ...next },
      })),

      // ─── FOOTPRINT GEN ──────────────────────────
      footprintGen: {
        search: '',
        category: 'All',
        selectedKey: null,
        customCfg: null,
        customName: 'Custom_Package',
        customTab: false,
        density: 'nominal',
        layers: { cu: true, paste: false, mask: false, silk: true, fab: false, courtyard: true },
        filename: '',
        editedCfg: null,
      },

      setFootprintGenState: (next) => set((state) => ({
        footprintGen: { ...state.footprintGen, ...next },
      })),
    }),
    {
      name: 'enginguity-store',
      version: 1,
      // hybridStorage speaks the plain string-based storage contract (like
      // localStorage); wrap it so zustand's persist gets the {state,version}
      // object contract it actually expects. Without this wrapper, setItem
      // receives an object, hybridStorage.setItem coerces it to the literal
      // string "[object Object]", and nothing survives a reload.
      storage: createJSONStorage(() => hybridStorage),
      // Strip large binaries before serializing. Full content lives in IndexedDB via blobStore.
      partialize: (state) => ({
        assetGen: {
          ...state.assetGen,
          generatedAssets: state.assetGen.generatedAssets.map((a) => ({
            ...a,
            svgContent: a.svgContent && a.svgContent.length > 50000 ? null : a.svgContent,
            dataURL: null,
          })),
        },
        moduleChats: state.moduleChats,
        fileHistory: state.fileHistory.map((f) => ({
          ...f,
          dataURL: null,
          svgContent: f.svgContent && f.svgContent.length > 50000 ? null : f.svgContent,
        })),
        playground: state.playground,
        jarvisCanvas: {
          ...state.jarvisCanvas,
          items: state.jarvisCanvas.items.map((i) => ({
            ...i,
            // Full image payloads live in blobStore (content.blobId points
            // there); only strip the heavy fields from the persisted copy.
            content:
              i.type === 'photo' || i.type === 'image'
                ? { ...(i.content || {}), dataURL: null, base64: null }
                : i.content,
          })),
        },
        bom: state.bom,
        circuitSim: state.circuitSim,
        debugConsole: {
          ...state.debugConsole,
          terminalOutput: [],
        },
        liveDocs: state.liveDocs,
        drawingBoards: state.drawingBoards,
        formulaLab: state.formulaLab,
        testHarness: state.testHarness,
        footprintGen: state.footprintGen,
      }),
    },
  ),
)
