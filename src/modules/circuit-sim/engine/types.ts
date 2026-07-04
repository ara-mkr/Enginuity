export type ComponentType =
  | 'resistor'
  | 'vsource'
  | 'isource'
  | 'capacitor'
  | 'inductor'
  | 'diode'
  | 'bjt'
  | 'mosfet'
  | 'vcvs';

export interface DiodeParams {
  /** Saturation current (A). Defaults to 1e-14. */
  Is?: number;
  /** Thermal voltage (V). Defaults to 0.026 (room temperature). */
  Vt?: number;
  /** Ideality factor. Defaults to 1. */
  n?: number;
}

export interface BJTParams {
  /** Forward current gain Ic/Ib. Defaults to 100. */
  beta?: number;
  /** Base-emitter/base-collector junction saturation current (A). Defaults to the diode default, 1e-14. */
  Is?: number;
  /** Junction thermal voltage (V). Defaults to the diode default, 0.026. */
  Vt?: number;
}

export interface MOSFETParams {
  /** Transconductance parameter (A/V^2). Defaults to 0.001. */
  k?: number;
  /** Threshold voltage (V). Defaults to 1. */
  Vth?: number;
  /** Channel-length modulation coefficient (1/V). Defaults to 0.01. */
  lambda?: number;
}

/**
 * Time-varying value descriptor for independent sources during transient
 * analysis. DC and AC analyses ignore it: DC uses `value` as the operating
 * point, AC uses the source only as a unit-magnitude stimulus.
 */
export type SourceWaveform =
  | {
      kind: 'sine';
      /** Peak amplitude (V or A). */
      amplitude: number;
      /** Frequency (Hz). */
      frequency: number;
      /** Phase at t=0 (degrees). */
      phaseDeg: number;
      /** DC offset added to the sinusoid. */
      offset: number;
    }
  | {
      /** SPICE-style PULSE: v1 → v2 with linear rise/fall edges, repeating every period. */
      kind: 'pulse';
      v1: number;
      v2: number;
      /** Time before the first rising edge (s). */
      delay: number;
      /** Rise time (s); 0 means an instant edge. */
      rise: number;
      /** Fall time (s); 0 means an instant edge. */
      fall: number;
      /** Time spent at v2 after the rise completes (s). */
      width: number;
      /** Repetition period (s). */
      period: number;
    };

export interface Component {
  id: string;
  type: ComponentType;
  /**
   * For vsource: nodes[0] is + terminal, nodes[1] is -.
   * For resistor/isource: the two connection points; isource current
   * flows from nodes[0] to nodes[1] inside the source.
   * For capacitor/inductor: the two connection points (polarity only
   * matters for the sign of the tracked branch current/voltage).
   * For diode: nodes[0] is the anode, nodes[1] is the cathode; forward
   * current flows from anode to cathode.
   * For bjt (NPN): nodes[0] is the collector, nodes[1] is the base,
   * nodes[2] is the emitter.
   * For mosfet (NMOS): nodes[0] is the drain, nodes[1] is the gate,
   * nodes[2] is the source.
   * For vcvs (SPICE E element): nodes[0]/[1] are the output + and -
   * terminals, nodes[2]/[3] are the controlling + and - sense nodes
   * (which carry no current); V(out+ - out-) = value * V(ctrl+ - ctrl-).
   */
  nodes: number[];
  /** Resistance (Ω), source value (V or A), capacitance (F), inductance (H), or vcvs gain (V/V). Unused for diode/bjt/mosfet. */
  value: number;
  /** Only used when type === 'diode' | 'bjt' | 'mosfet'. */
  params?: DiodeParams | BJTParams | MOSFETParams;
  /**
   * Optional time-varying value for vsource/isource; transient analysis
   * evaluates it at every timestep via sourceValueAt. Absent → the source
   * holds `value` for all t.
   */
  waveform?: SourceWaveform;
}

export interface Netlist {
  components: Component[];
}

export interface SolveResult {
  nodeVoltages: Record<number, number>;
  branchCurrents: Record<string, number>;
  /**
   * Populated only when a Newton-Raphson solve (nonlinear devices present)
   * fails to converge within the iteration cap. Its presence means the
   * returned values may not represent a valid operating point.
   */
  warnings?: string[];
}

/**
 * Per-component trapezoidal companion-model state, carried between
 * timesteps. Keyed by component id. Capacitors track their terminal
 * voltage and branch current; inductors track their branch current and
 * terminal voltage — both quantities are needed each step to build the
 * next companion model's Ieq.
 */
export interface ReactiveState {
  capacitorVoltage: Map<string, number>;
  capacitorCurrent: Map<string, number>;
  inductorCurrent: Map<string, number>;
  inductorVoltage: Map<string, number>;
}

export function createInitialReactiveState(netlist: Netlist): ReactiveState {
  const capacitorVoltage = new Map<string, number>();
  const capacitorCurrent = new Map<string, number>();
  const inductorCurrent = new Map<string, number>();
  const inductorVoltage = new Map<string, number>();
  for (const comp of netlist.components) {
    if (comp.type === 'capacitor') {
      capacitorVoltage.set(comp.id, 0);
      capacitorCurrent.set(comp.id, 0);
    }
    if (comp.type === 'inductor') {
      inductorCurrent.set(comp.id, 0);
      inductorVoltage.set(comp.id, 0);
    }
  }
  return { capacitorVoltage, capacitorCurrent, inductorCurrent, inductorVoltage };
}

export interface TransientOptions {
  startTime: number;
  stopTime: number;
  timestep: number;
}

export interface TransientResult {
  time: number[];
  nodeVoltages: Record<number, number[]>;
  /**
   * Populated when any timestep's Newton-Raphson solve failed to converge
   * or the t=0 initial-condition solve had to be skipped — the waveform
   * may not be trustworthy where flagged.
   */
  warnings?: string[];
}
