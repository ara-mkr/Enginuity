export interface ParameterDef {
  name: string      // JS identifier, e.g. "voltage"
  label: string     // Human label, e.g. "Supply Voltage"
  min: number
  max: number
  default: number
  unit: string
}

export interface EquationDef {
  outputName: string  // JS identifier, e.g. "current"
  label: string       // Human label, e.g. "Motor Current"
  formula: string     // JS expression string, e.g. "(voltage - back_emf) / resistance"
  unit: string
  color: string       // Hex or CSS color for chart line
}

export interface PlaygroundSchema {
  parameters: ParameterDef[]
  equations: EquationDef[]
}

export type ParamValues = Record<string, number>
export type OutputValues = Record<string, number | null>  // null = eval error
