export interface Variable {
  symbol: string
  name: string
  value: number
  unit: string
  description: string
}

export interface CalculationResult {
  value: number
  unit: string
  formatted: string
}

export interface CalculationStep {
  description: string
  equation: string
  result: string
}

export interface RelatedFormula {
  name: string
  formula_latex: string
  use_case: string
}

export interface PlaygroundParameter {
  name: string
  label: string
  min: number
  max: number
  default: number
  unit: string
}

export interface PlaygroundEquation {
  outputName: string
  label: string
  formula_js: string
  unit: string
}

export interface ParameterPlaygroundConfig {
  parameters: PlaygroundParameter[]
  equations: PlaygroundEquation[]
}

export interface FormulaCalculation {
  interpreted_as: string
  formula: string
  variables: Variable[]
  result: CalculationResult
  steps: CalculationStep[]
  related_formulas: RelatedFormula[]
  can_make_interactive: boolean
  parameter_playground_config: ParameterPlaygroundConfig | null
}

export interface EngineeringConstant {
  symbol: string
  name: string
  value: number
  unit: string
}

export interface FormulaLibraryItem {
  name: string
  description: string
  category: string
  formula_latex: string
  variables: Variable[]
  can_make_interactive: boolean
  parameter_playground_config: ParameterPlaygroundConfig | null
}
