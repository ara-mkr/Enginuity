import type { KokoroVoiceId } from './voice/kokoroTts'

export type WakeState = 'sleeping' | 'listening' | 'processing'

export type ItemType =
  | 'text'
  | 'image'
  | 'video'
  | 'link'
  | 'calculation'
  | 'code'
  | 'note'
  | 'camera'
  | 'photo'
  | 'search_suggestion'
  | 'data_doc'
  | 'measurement'
  | 'component_id'
  | 'scope_analysis'
  | 'datasheet_card'
  | 'quick_spice'
  | 'timer'
  | 'notebook_confirm'
  | 'guided_steps'
  | 'order_list'
  | 'search_results'
  | 'session_diff'

export interface CanvasItem {
  id: string
  type: ItemType
  x: number
  y: number
  width: number
  height: number
  content: any
  title: string | null
  createdAt: number
  fromCommand: string
  flash?: boolean
}

/** Input accepted by placeItem: position/size/provenance are optional and defaulted. */
export type PlaceItemInput = Omit<
  CanvasItem,
  'id' | 'x' | 'y' | 'width' | 'height' | 'createdAt' | 'fromCommand'
> & {
  fromCommand?: string
  x?: number
  y?: number
  width?: number
  height?: number
  autoRemoveAfter?: number
}

export interface CanvasGroup {
  id: string
  itemIds: string[]
  title: string
  createdAt: number
}

export interface LogEntry {
  id: string
  role: 'user' | 'jarvis' | 'system'
  text: string
  timestamp: number
}

export interface CanvasTransform {
  x: number
  y: number
  scale: number
}

export interface JarvisSettings {
  wakeSensitivity: 'low' | 'normal' | 'high'
  speechRate: number
  speechPitch: number
  autoSleepTimeout: number // seconds; 0 = never
  canvasBackground: 'dark' | 'darker' | 'pure'
  selectedVoice: string
  dailyLimit: number
  ttsEngine?: 'kokoro' | 'browser'
  kokoroVoice?: KokoroVoiceId
  deliveryStyle?: 'deadpan' | 'measured' | 'crisp'
  pauseIntensity?: 'minimal' | 'natural' | 'dramatic'
}

export const DEFAULT_SETTINGS: JarvisSettings = {
  wakeSensitivity: 'normal',
  speechRate: 0.92,
  speechPitch: 0.85,
  autoSleepTimeout: 45,
  canvasBackground: 'dark',
  selectedVoice: '',
  dailyLimit: 2.00,
  ttsEngine: 'kokoro',
  kokoroVoice: 'am_puck',
  deliveryStyle: 'measured',
  pauseIntensity: 'natural',
}

export const BG_COLORS: Record<JarvisSettings['canvasBackground'], string> = {
  dark: '#111111',
  darker: '#080808',
  pure: '#000000',
}
