export interface PinDef {
  pin: number | string
  name: string
  type: string
  description: string
}

export interface AbsMax {
  parameter: string
  min: number | null
  max: number | null
  unit: string
}

export interface ElecChar {
  parameter: string
  symbol: string
  min: number | null
  typ: number | null
  max: number | null
  unit: string
  conditions: string
}

export interface AppCircuit {
  title: string
  description: string
  components: Array<{ name: string; value: string }>
  notes: string
}

export interface ComponentData {
  component: {
    partNumber: string
    manufacturer: string
    description: string
    category: string
    package: string[]
    rohs: boolean | null
  }
  pinout: PinDef[]
  absoluteMaximums: AbsMax[]
  electricalCharacteristics: ElecChar[]
  applicationCircuits: AppCircuit[]
  features: string[]
  applications: string[]
  orderingInfo: Array<{ partNumber: string; package: string; notes: string }>
  resources: { productPage: string | null; evalBoard: string | null }
}

export interface SavedComponent {
  id: string
  data: ComponentData
  fileName: string
  dateAdded: string
  pinnedNotes: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  pinned?: boolean
}
