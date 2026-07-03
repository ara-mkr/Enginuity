export interface BOMItem {
  id: string
  quantity: number
  part_number: string | null
  description: string
  manufacturer: string | null
  value: string | null
  package: string | null
  reference_designators: string | null
  // Availability results
  unitPrice: number | null
  extendedPrice: number | null
  stockStatus: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown' | null
  leadTimeWeeks: number | null
  altAvailable: boolean | null
  warnings?: string[]
}

export interface PriceBreak {
  qty: number
  price: number
}

export interface AvailabilityResult {
  unitPrice: number | null
  priceQtyBreaks: PriceBreak[]
  stockStatus: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'
  leadTimeWeeks: number | null
  alternatives: Array<{ partNumber: string; manufacturer: string; notes: string }>
  warnings: string[]
}

export interface RiskItem {
  partNumber: string
  riskType: 'single_source' | 'eol' | 'shortage' | 'other'
  description: string
  suggestion: string
}

export interface RiskAnalysisResult {
  overallRating: 'LOW' | 'MEDIUM' | 'HIGH'
  riskItems: RiskItem[]
  reportSummary: string
}

export interface AlternativePart {
  partNumber: string
  manufacturer: string
  differences: string
  dropInCompatible: boolean
  notes: string
}
