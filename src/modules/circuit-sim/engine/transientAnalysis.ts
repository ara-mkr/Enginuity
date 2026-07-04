import { Matrix } from './matrix';
import { nodeVoltageOf, runNewtonRaphson, solveDC } from './dcAnalysis';
import {
  buildNodeMap,
  stampCapacitor,
  stampIndependentCurrentSource,
  stampIndependentVoltageSource,
  stampInductor,
  stampResistor,
  stampVCVS,
  type NodeMap,
} from './stamps';
import {
  createInitialReactiveState,
  type Netlist,
  type ReactiveState,
  type TransientOptions,
  type TransientResult,
} from './types';
import { validateNetlist } from './validate';
import { sourceValueAt } from './waveforms';

/**
 * Stamps every component whose contribution is "linear at this timestep":
 * resistors and sources as usual (sources evaluated at time t so sine/pulse
 * waveforms drive the step), plus capacitors/inductors via their
 * trapezoidal companion model built from the PREVIOUS timestep's stored
 * state. Diodes are intentionally skipped here — runNewtonRaphson stamps
 * those itself, once per iteration, since their linearization point moves
 * within a single timestep.
 */
function stampTimestep(
  netlist: Netlist,
  nodeMap: NodeMap,
  state: ReactiveState,
  h: number,
  t: number,
  A: Matrix,
  z: number[]
): void {
  for (const comp of netlist.components) {
    switch (comp.type) {
      case 'resistor':
        stampResistor(A, nodeMap, comp);
        break;
      case 'isource':
        stampIndependentCurrentSource(z, nodeMap, { ...comp, value: sourceValueAt(comp, t) });
        break;
      case 'vsource': {
        const branchIndex = nodeMap.branchToIndex.get(comp.id);
        if (branchIndex === undefined) {
          throw new Error(`Voltage source "${comp.id}" is missing a branch index.`);
        }
        stampIndependentVoltageSource(A, z, nodeMap, { ...comp, value: sourceValueAt(comp, t) }, branchIndex);
        break;
      }
      case 'capacitor': {
        const Vc_prev = state.capacitorVoltage.get(comp.id) ?? 0;
        const Ic_prev = state.capacitorCurrent.get(comp.id) ?? 0;
        stampCapacitor(A, z, nodeMap, comp, h, Vc_prev, Ic_prev);
        break;
      }
      case 'inductor': {
        const branchIndex = nodeMap.branchToIndex.get(comp.id);
        if (branchIndex === undefined) {
          throw new Error(`Inductor "${comp.id}" is missing a branch index.`);
        }
        const Il_prev = state.inductorCurrent.get(comp.id) ?? 0;
        const Vl_prev = state.inductorVoltage.get(comp.id) ?? 0;
        stampInductor(A, z, nodeMap, comp, h, branchIndex, Il_prev, Vl_prev);
        break;
      }
      case 'vcvs': {
        // Instantaneous and time-invariant — the same stamp every step.
        const branchIndex = nodeMap.branchToIndex.get(comp.id);
        if (branchIndex === undefined) {
          throw new Error(`VCVS "${comp.id}" is missing a branch index.`);
        }
        stampVCVS(A, nodeMap, comp, branchIndex);
        break;
      }
      case 'diode':
      case 'bjt':
      case 'mosfet':
        // Stamped per-Newton-Raphson-iteration, not here.
        break;
      default:
        throw new Error(`Unknown component type: ${comp.type}`);
    }
  }
}

/**
 * Runs a fixed-timestep transient (time-domain) simulation using
 * trapezoidal integration for capacitors/inductors, reusing the same
 * Newton-Raphson loop dcAnalysis uses for any nonlinear devices present
 * at each timestep.
 *
 * Limitation: all reactive elements cold-start at zero (Vc=0, Il=0) at
 * startTime — specifying nonzero initial conditions is a reasonable
 * future enhancement, not implemented here. Timestep is fixed (no
 * adaptive stepping).
 */
export function runTransient(netlist: Netlist, options: TransientOptions): TransientResult {
  const validation = validateNetlist(netlist);
  if (validation.errors.length > 0) {
    throw new Error(
      `Cannot run transient analysis — invalid netlist:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  const { startTime, stopTime, timestep: h } = options;
  const nodeMap = buildNodeMap(netlist);
  const state = createInitialReactiveState(netlist);
  const warnings: string[] = [];

  const capacitors = netlist.components.filter((c) => c.type === 'capacitor');
  const inductors = netlist.components.filter((c) => c.type === 'inductor');

  const time: number[] = [];
  const nodeVoltages: Record<number, number[]> = {};
  for (const node of nodeMap.nodeToIndex.keys()) {
    nodeVoltages[node] = [];
  }

  // t = startTime: exact initial conditions. Pinning each capacitor to 0 V
  // (a 0 V source) and opening each inductor (a 0 A source) and solving DC
  // yields the true t=0+ node voltages plus the CONSISTENT initial
  // capacitor currents / inductor voltages the first trapezoidal step
  // needs — without them the whole waveform lands about half a step early.
  let solvedInitialConditions = false;
  try {
    const icNetlist: Netlist = {
      components: netlist.components.map((c) => {
        if (c.type === 'capacitor') return { ...c, type: 'vsource' as const, value: 0 };
        if (c.type === 'inductor') return { ...c, type: 'isource' as const, value: 0 };
        // Time-varying sources sit at their t=startTime value for the IC solve.
        if ((c.type === 'vsource' || c.type === 'isource') && c.waveform) {
          return { ...c, value: sourceValueAt(c, startTime), waveform: undefined };
        }
        return c;
      }),
    };
    const ic = solveDC(icNetlist);
    time.push(startTime);
    for (const node of nodeMap.nodeToIndex.keys()) {
      nodeVoltages[node].push(ic.nodeVoltages[node] ?? 0);
    }
    for (const cap of capacitors) {
      state.capacitorCurrent.set(cap.id, ic.branchCurrents[cap.id] ?? 0);
    }
    for (const ind of inductors) {
      const v0 =
        (ind.nodes[0] === 0 ? 0 : ic.nodeVoltages[ind.nodes[0]] ?? 0) -
        (ind.nodes[1] === 0 ? 0 : ic.nodeVoltages[ind.nodes[1]] ?? 0);
      state.inductorVoltage.set(ind.id, v0);
    }
    if (ic.warnings) warnings.push(...ic.warnings.map((w) => `Initial-condition solve: ${w}`));
    solvedInitialConditions = true;
  } catch {
    // Degenerate at t=0 (e.g. a capacitor directly across a source has an
    // impulsive charging current). Fall back to the first companion-model
    // step standing in for t=0, as before.
    warnings.push(
      'Initial conditions could not be solved exactly; the first timestep stands in for t=0.'
    );
  }

  const numSteps = Math.round((stopTime - startTime) / h);
  let nonConvergedSteps = 0;
  let firstNonConvergedT: number | null = null;

  for (let step = solvedInitialConditions ? 1 : 0; step <= numSteps; step++) {
    const t = startTime + step * h;

    // a. Build A/z for this timestep and, if nonlinear devices are
    // present, run Newton-Raphson at this timestep too.
    const { x, warnings: stepWarnings } = runNewtonRaphson(netlist, nodeMap, (A, z) =>
      stampTimestep(netlist, nodeMap, state, h, t, A, z)
    );
    if (stepWarnings) {
      nonConvergedSteps++;
      if (firstNonConvergedT === null) firstNonConvergedT = t;
    }

    // c. Extract this timestep's results BEFORE mutating state — state
    // must reflect the CURRENT step's solution, not be updated early.
    time.push(t);
    for (const [node, idx] of nodeMap.nodeToIndex) {
      nodeVoltages[node].push(x[idx]);
    }

    const newCapacitorVoltage = new Map<string, number>();
    const newCapacitorCurrent = new Map<string, number>();
    for (const cap of capacitors) {
      const Vc = nodeVoltageOf(x, nodeMap, cap.nodes[0]) - nodeVoltageOf(x, nodeMap, cap.nodes[1]);
      // Ic = C * dV/dt, reconstructed from this step's companion model:
      // Ic_new = Geq*Vc_new - Ieq_prev, but simpler to derive directly from
      // the trapezoidal identity Ic_new = (2C/h)*(Vc_new - Vc_prev) - Ic_prev.
      const Vc_prev = state.capacitorVoltage.get(cap.id) ?? 0;
      const Ic_prev = state.capacitorCurrent.get(cap.id) ?? 0;
      const Ic = (2 * cap.value * (Vc - Vc_prev)) / h - Ic_prev;
      newCapacitorVoltage.set(cap.id, Vc);
      newCapacitorCurrent.set(cap.id, Ic);
    }

    const newInductorCurrent = new Map<string, number>();
    const newInductorVoltage = new Map<string, number>();
    for (const ind of inductors) {
      const branchIndex = nodeMap.branchToIndex.get(ind.id);
      if (branchIndex === undefined) {
        throw new Error(`Inductor "${ind.id}" is missing a branch index.`);
      }
      const Il = x[branchIndex];
      const Vl = nodeVoltageOf(x, nodeMap, ind.nodes[0]) - nodeVoltageOf(x, nodeMap, ind.nodes[1]);
      newInductorCurrent.set(ind.id, Il);
      newInductorVoltage.set(ind.id, Vl);
    }

    // d. THEN update state for the next iteration.
    state.capacitorVoltage = newCapacitorVoltage;
    state.capacitorCurrent = newCapacitorCurrent;
    state.inductorCurrent = newInductorCurrent;
    state.inductorVoltage = newInductorVoltage;
  }

  if (nonConvergedSteps > 0) {
    warnings.push(
      `Newton-Raphson failed to converge at ${nonConvergedSteps} of ${numSteps} timesteps (first at t=${firstNonConvergedT}s) — the waveform may be inaccurate there.`
    );
  }

  const result: TransientResult = { time, nodeVoltages };
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}
