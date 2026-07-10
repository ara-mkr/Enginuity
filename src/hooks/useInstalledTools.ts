/**
 * Tracks which tools the user has installed in their sidebar.
 *
 * Built-in tools start from `defaultInstalledIds()`. Custom (uploaded) tools
 * live in a separate localStorage slot and are always installed once added —
 * removing a custom tool deletes its manifest entirely.
 *
 * Both stores are reactive across components via a single window event so the
 * Sidebar and Marketplace stay in sync without prop drilling.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  BUILTIN_TOOLS,
  defaultInstalledIds,
  getBuiltinById,
  isValidManifest,
  type CustomTool,
  type CustomToolManifest,
  type Tool,
} from '../config/toolRegistry'
import { logEvent } from '../engine/eventLog'

const INSTALLED_KEY = 'enginguity_installed_tools'
const CUSTOM_KEY = 'enginguity_custom_tools'
const CHANGE_EVENT = 'enginguity_tools_changed'

function loadInstalledIds(): Set<string> {
  try {
    const raw = localStorage.getItem(INSTALLED_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* fall through */ }
  return new Set(defaultInstalledIds())
}

function loadCustomTools(): CustomTool[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as CustomToolManifest[]
    return arr
      .filter(isValidManifest)
      .map((m) => ({ ...m, kind: 'custom', defaultInstalled: true, to: `/custom/${m.id}` }))
  } catch {
    return []
  }
}

function persistInstalled(ids: Set<string>) {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify(Array.from(ids)))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// Drop the runtime-only kind/defaultInstalled/to fields before persisting.
function toManifest(tool: CustomTool): CustomToolManifest {
  const rest = { ...tool } as Partial<CustomTool>
  delete rest.kind
  delete rest.defaultInstalled
  delete rest.to
  return rest as CustomToolManifest
}

function persistCustom(tools: CustomTool[]) {
  const manifests: CustomToolManifest[] = tools.map(toManifest)
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(manifests))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useInstalledTools() {
  const [installedIds, setInstalledIds] = useState<Set<string>>(loadInstalledIds)
  const [customTools, setCustomTools] = useState<CustomTool[]>(loadCustomTools)

  useEffect(() => {
    const sync = () => {
      setInstalledIds(loadInstalledIds())
      setCustomTools(loadCustomTools())
    }
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const isInstalled = useCallback(
    (id: string) => {
      if (installedIds.has(id)) return true
      return customTools.some((t) => t.id === id)
    },
    [installedIds, customTools]
  )

  const install = useCallback((id: string) => {
    const tool = getBuiltinById(id)
    if (!tool) return
    const next = new Set(loadInstalledIds())
    next.add(id)
    persistInstalled(next)
    logEvent('TOOL_INSTALLED', { toolId: id, toolLabel: tool.label, module: 'marketplace' })
  }, [])

  const uninstall = useCallback((id: string) => {
    const tool = getBuiltinById(id)
    if (tool?.pinned) return
    const custom = loadCustomTools().find((t) => t.id === id)
    if (custom) {
      persistCustom(loadCustomTools().filter((t) => t.id !== id))
      logEvent('TOOL_UNINSTALLED', { toolId: id, toolLabel: custom.label, module: 'marketplace' })
      return
    }
    const next = new Set(loadInstalledIds())
    next.delete(id)
    persistInstalled(next)
    logEvent('TOOL_UNINSTALLED', { toolId: id, toolLabel: tool?.label ?? id, module: 'marketplace' })
  }, [])

  const addCustomTool = useCallback((manifest: CustomToolManifest): { ok: true } | { ok: false; error: string } => {
    if (!isValidManifest(manifest)) {
      return { ok: false, error: 'Manifest is missing required fields (id, label, description, and either url or html).' }
    }
    if (getBuiltinById(manifest.id)) {
      return { ok: false, error: `A built-in tool with id "${manifest.id}" already exists.` }
    }
    const existing = loadCustomTools()
    if (existing.some((t) => t.id === manifest.id)) {
      return { ok: false, error: `A custom tool with id "${manifest.id}" is already installed.` }
    }
    const next: CustomTool = { ...manifest, kind: 'custom', defaultInstalled: true, to: `/custom/${manifest.id}` }
    persistCustom([...existing, next])
    return { ok: true }
  }, [])

  const resetToDefaults = useCallback(() => {
    persistInstalled(new Set(defaultInstalledIds()))
  }, [])

  const installedTools: Tool[] = [
    ...BUILTIN_TOOLS.filter((t) => installedIds.has(t.id) || t.pinned),
    ...customTools,
  ]

  return {
    installedIds,
    installedTools,
    customTools,
    isInstalled,
    install,
    uninstall,
    addCustomTool,
    resetToDefaults,
  }
}

export function getCustomToolById(id: string): CustomTool | undefined {
  return loadCustomTools().find((t) => t.id === id)
}
