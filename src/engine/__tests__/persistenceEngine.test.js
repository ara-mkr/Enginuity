import { describe, it, expect, beforeEach } from 'vitest'
import { useEnginguityStore } from '../persistenceEngine'

const initialState = useEnginguityStore.getState()

beforeEach(() => {
  useEnginguityStore.setState(initialState, true)
  localStorage.clear()
})

describe('persistenceEngine: assetGen', () => {
  it('caps generatedAssets at 200 and history at 50', () => {
    const { addAssetGenResult } = useEnginguityStore.getState()
    for (let i = 0; i < 210; i++) {
      addAssetGenResult({ id: `asset-${i}`, url: 'x' })
    }
    const state = useEnginguityStore.getState()
    expect(state.assetGen.generatedAssets).toHaveLength(200)
    expect(state.assetGen.history).toHaveLength(50)
    // Most recent goes to the front.
    expect(state.assetGen.generatedAssets[0].id).toBe('asset-209')
  })

})

describe('persistenceEngine: module chats', () => {
  it('appends a message with generated id/timestamp, falling back to an empty slot for unknown moduleIds', () => {
    const { addChatMessage, getChatHistory } = useEnginguityStore.getState()
    addChatMessage('bom', { role: 'user', content: 'hello' })
    addChatMessage('totally-unknown-module', { role: 'user', content: 'hi' })

    const history = getChatHistory('bom')
    expect(history).toHaveLength(1)
    expect(history[0].content).toBe('hello')
    expect(history[0].id).toBeTruthy()
    expect(typeof history[0].timestamp).toBe('number')
    expect(getChatHistory('totally-unknown-module')).toHaveLength(1)
  })

  it('clearModuleChat resets only the targeted module', () => {
    const { addChatMessage, clearModuleChat, getChatHistory } = useEnginguityStore.getState()
    addChatMessage('bom', { role: 'user', content: 'a' })
    addChatMessage('notebook', { role: 'user', content: 'b' })
    clearModuleChat('bom')
    expect(getChatHistory('bom')).toHaveLength(0)
    expect(getChatHistory('notebook')).toHaveLength(1)
  })
})

describe('persistenceEngine: fileHistory', () => {
  it('de-dupes by name + sourceModule (keeping the newest) and caps at 100 entries', () => {
    const { addToFileHistory } = useEnginguityStore.getState()
    addToFileHistory({ name: 'part.step', sourceModule: 'cad-viewer', sizeBytes: 100 })
    addToFileHistory({ name: 'part.step', sourceModule: 'cad-viewer', sizeBytes: 200 })
    for (let i = 0; i < 110; i++) {
      addToFileHistory({ name: `f${i}.step`, sourceModule: 'cad-viewer' })
    }
    const history = useEnginguityStore.getState().fileHistory
    expect(history).toHaveLength(100)
    expect(history.find((f) => f.name === 'part.step')).toBeUndefined()
  })

  it('removeFromFileHistory removes only the matching id', () => {
    const { addToFileHistory, removeFromFileHistory } = useEnginguityStore.getState()
    addToFileHistory({ id: 'keep', name: 'a.step', sourceModule: 'cad-viewer' })
    addToFileHistory({ id: 'drop', name: 'b.step', sourceModule: 'cad-viewer' })
    removeFromFileHistory('drop')
    const history = useEnginguityStore.getState().fileHistory
    expect(history).toHaveLength(1)
    expect(history[0].id).toBe('keep')
  })
})

describe('persistenceEngine: pendingFileLoad handoff', () => {
  it('consumePendingFileLoad returns the payload once, then clears it', () => {
    const { setPendingFileLoad } = useEnginguityStore.getState()
    setPendingFileLoad({ moduleId: 'bom', payload: { foo: 'bar' } })

    const first = useEnginguityStore.getState().consumePendingFileLoad()
    expect(first).toEqual({ moduleId: 'bom', payload: { foo: 'bar' } })

    const second = useEnginguityStore.getState().consumePendingFileLoad()
    expect(second).toBeNull()
  })
})

describe('persistenceEngine: jarvisCanvas log cap', () => {
  it('addJarvisLog trims conversationLog to the last 100 entries', () => {
    const { addJarvisLog } = useEnginguityStore.getState()
    for (let i = 0; i < 110; i++) {
      addJarvisLog({ text: `entry-${i}` })
    }
    const log = useEnginguityStore.getState().jarvisCanvas.conversationLog
    expect(log).toHaveLength(100)
    expect(log[log.length - 1].text).toBe('entry-109')
    expect(log[0].text).toBe('entry-10')
  })
})
