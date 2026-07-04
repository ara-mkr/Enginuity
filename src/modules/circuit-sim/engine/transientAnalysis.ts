import { DEFAULT_BETA, diodeCurrent, mosfetCompanionModel } from './deviceModels';
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
  type BJTParams,
  type Component,
  type DiodeParams,
  type MOSFETParams,
  type Netlist,
  type ReactiveState,
  type Timer555Params,
  type TransientOptions,
  type TransientResult,
} from './types';
import {
  evaluateTimer555Latch,
  resolveTimer555Params,
  stampTimer555,
  timer555Primitives,
} from './timer555';
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
      case 'timer555': {
        // Behavioral: stamped from the previous step's latch state (fixed
        // within this step, so it's linear here — the comparators re-read
        // the solved voltages afterward to produce the next state).
        const branchIndex = nodeMap.branchToIndex.get(`${comp.id}:out`);
        if (branchIndex === undefined) {
          throw new Error(`555 timer "${comp.id}" is missing its output branch index.`);
        }
        const Q = state.timer555Q.get(comp.id) ?? false;
        stampTimer555(A, nodeMap, comp, branchIndex, Q, resolveTimer555Params(comp.params as Timer555Params | undefined));
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
 * future enhancement, not implemented here. The timestep is fixed unless
 * options.adaptive turns on step-doubling LTE control.
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
  let state = createInitialReactiveState(netlist);
  const warnings: string[] = [];

  const capacitors = netlist.components.filter((c) => c.type === 'capacitor');
  const inductors = netlist.components.filter((c) => c.type === 'inductor');

  const time: number[] = [];
  const nodeVoltages: Record<number, number[]> = {};
  for (const node of nodeMap.nodeToIndex.keys()) {
    nodeVoltages[node] = [];
  }
  const componentCurrents: Record<string, number[]> = {};
  for (const comp of netlist.components) {
    for (const key of currentKeysOf(comp)) componentCurrents[key] = [];
  }

  // t = startTime: exact initial conditions. Pinning each capacitor to 0 V
  // (a 0 V source) and opening each inductor (a 0 A source) and solving DC
  // yields the true t=0+ node voltages plus the CONSISTENT initial
  // capacitor currents / inductor voltages the first trapezoidal step
  // needs — without them the whole waveform lands about half a step early.
  let solvedInitialConditions = false;
  try {
    const icNetlist: Netlist = {
      components: netlist.components.flatMap((c) => {
        if (c.type === 'capacitor') return [{ ...c, type: 'vsource' as const, value: 0 }];
        if (c.type === 'inductor') return [{ ...c, type: 'isource' as const, value: 0 }];
        // The 555 has no DC operating point; expand it into primitives at its
        // power-up latch state (output low) so solveDC can find t=0.
        if (c.type === 'timer555') return timer555Primitives(c, false, resolveTimer555Params(c.params as Timer555Params | undefined));
        // Time-varying sources sit at their t=startTime value for the IC solve.
        if ((c.type === 'vsource' || c.type === 'isource') && c.waveform) {
          return [{ ...c, value: sourceValueAt(c, startTime), waveform: undefined }];
        }
        return [c];
      }),
    };
    const ic = solveDC(icNetlist);
    time.push(startTime);
    for (const node of nodeMap.nodeToIndex.keys()) {
      nodeVoltages[node].push(ic.nodeVoltages[node] ?? 0);
    }
    // The t=0 current sample: resistors from Ohm's law, isources from their
    // waveform, inductors 0 by the cold-start definition; everything else —
    // including each capacitor via its 0V-source stand-in — landed in the IC
    // solve's branchCurrents under its own key.
    const vIC = (n: number) => (n === 0 ? 0 : ic.nodeVoltages[n] ?? 0);
    for (const comp of netlist.components) {
      switch (comp.type) {
        case 'resistor':
          componentCurrents[comp.id].push((vIC(comp.nodes[0]) - vIC(comp.nodes[1])) / comp.value);
          break;
        case 'isource':
          componentCurrents[comp.id].push(sourceValueAt(comp, startTime));
          break;
        case 'inductor':
          componentCurrents[comp.id].push(0);
          break;
        case 'bjt':
          componentCurrents[`${comp.id}:ib`].push(ic.branchCurrents[`${comp.id}:ib`] ?? 0);
          componentCurrents[`${comp.id}:ic`].push(ic.branchCurrents[`${comp.id}:ic`] ?? 0);
          break;
        case 'timer555':
          // Output current is the expanded VCVS's branch current in the IC
          // solve, negated so sourcing into a load reads positive (matching
          // the op-amp's output-current sign convention).
          componentCurrents[comp.id].push(-(ic.branchCurrents[`${comp.id}#OUT`] ?? 0));
          break;
        default:
          componentCurrents[comp.id].push(ic.branchCurrents[comp.id] ?? 0);
      }
    }
    for (const cap of capacitors) {
      state.capacitorCurrent.set(cap.id, ic.branchCurrents[cap.id] ?? 0);
    }
    // The comparators re-read the t=0 solve so the first real step runs with
    // the correct latch state (an astable starts output-high and charging).
    for (const comp of netlist.components) {
      if (comp.type !== 'timer555') continue;
      state.timer555Q.set(
        comp.id,
        evaluateTimer555Latch(vIC(comp.nodes[0]), vIC(comp.nodes[2]), vIC(comp.nodes[3]), state.timer555Q.get(comp.id) ?? false)
      );
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

  let totalSteps = 0;
  let nonConvergedSteps = 0;
  let firstNonConvergedT: number | null = null;

  // Records an accepted step's sample and advances the loop-shared state.
  const acceptStep = (t: number, step: StepSolution) => {
    totalSteps++;
    if (!step.converged) {
      nonConvergedSteps++;
      if (firstNonConvergedT === null) firstNonConvergedT = t;
    }
    time.push(t);
    for (const [node, idx] of nodeMap.nodeToIndex) {
      nodeVoltages[node].push(step.x[idx]);
    }
    pushStepCurrents(netlist, nodeMap, step.x, t, step.state.capacitorCurrent, componentCurrents);
    state = step.state;
  };

  if (options.adaptive) {
    const reltol = options.reltol ?? 1e-3;
    const abstol = options.abstol ?? 1e-6;
    const hMax = h;
    // Refinement floor: 1024× below the requested step, but never so fine
    // that the run could exceed the sample cap.
    const hMin = Math.max(hMax / 1024, (stopTime - startTime) / MAX_ADAPTIVE_SAMPLES);
    const tEnd = stopTime - (stopTime - startTime) * 1e-12;

    let t = startTime;
    if (!solvedInitialConditions) {
      // Same fallback as fixed stepping: a first companion-model step (at
      // the floor size, for accuracy) stands in for the t=startTime sample.
      acceptStep(startTime, advanceStep(netlist, nodeMap, capacitors, inductors, state, hMin, startTime));
    }

    let hStep = hMax;
    while (t < tEnd && time.length <= MAX_ADAPTIVE_SAMPLES) {
      hStep = Math.min(hStep, stopTime - t);

      // Step-doubling: one full step vs two half steps from the same state.
      // Their disagreement estimates the local truncation error.
      const full = advanceStep(netlist, nodeMap, capacitors, inductors, state, hStep, t + hStep);
      const half1 = advanceStep(netlist, nodeMap, capacitors, inductors, state, hStep / 2, t + hStep / 2);
      const half2 = advanceStep(netlist, nodeMap, capacitors, inductors, half1.state, hStep / 2, t + hStep);

      let err = full.converged && half1.converged && half2.converged ? 0 : Infinity;
      for (const idx of nodeMap.nodeToIndex.values()) {
        const a = full.x[idx];
        const b = half2.x[idx];
        const e = Math.abs(a - b) / (abstol + reltol * Math.max(Math.abs(a), Math.abs(b)));
        err = Number.isFinite(e) ? Math.max(err, e) : Infinity;
      }

      if (err > 1 && hStep > hMin * 1.0000001) {
        hStep = Math.max(hStep / 2, hMin);
        continue;
      }

      // Accept the two-half-step solution — it's the more accurate of the
      // pair. (At the floor size a failing step is accepted and counted as
      // non-converged rather than looping forever.)
      t += hStep;
      const converged = half1.converged && half2.converged;
      acceptStep(t, { ...half2, converged });
      if (err < 0.25) hStep = Math.min(2 * hStep, hMax);
    }

    if (t < tEnd) {
      warnings.push(
        `Adaptive stepping hit the ${MAX_ADAPTIVE_SAMPLES}-sample cap — the waveform is truncated at t=${t}s. Loosen the tolerance or shorten the stop time.`
      );
    }
  } else {
    const numSteps = Math.round((stopTime - startTime) / h);
    for (let step = solvedInitialConditions ? 1 : 0; step <= numSteps; step++) {
      const t = startTime + step * h;
      acceptStep(t, advanceStep(netlist, nodeMap, capacitors, inductors, state, h, t));
    }
  }

  if (nonConvergedSteps > 0) {
    warnings.push(
      `Newton-Raphson failed to converge at ${nonConvergedSteps} of ${totalSteps} timesteps (first at t=${firstNonConvergedT}s) — the waveform may be inaccurate there.`
    );
  }

  const result: TransientResult = { time, nodeVoltages, componentCurrents };
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

/** Hard cap on adaptive-run samples so a pathological circuit can't grow the buffers unboundedly. */
export const MAX_ADAPTIVE_SAMPLES = 100_000;

interface StepSolution {
  /** Full MNA solution vector at the step's end time. */
  x: number[];
  /** Reactive state consistent with `x`, ready to seed the next step. */
  state: ReactiveState;
  converged: boolean;
}

/**
 * Solves a single trapezoidal step of size h ending at time t from the
 * given reactive state, WITHOUT mutating it — the caller decides whether
 * to commit the returned state (fixed stepping always does; adaptive
 * stepping solves trial steps it may reject).
 */
function advanceStep(
  netlist: Netlist,
  nodeMap: NodeMap,
  capacitors: Component[],
  inductors: Component[],
  state: ReactiveState,
  h: number,
  t: number
): StepSolution {
  const { x, warnings } = runNewtonRaphson(netlist, nodeMap, (A, z) =>
    stampTimestep(netlist, nodeMap, state, h, t, A, z)
  );

  const capacitorVoltage = new Map<string, number>();
  const capacitorCurrent = new Map<string, number>();
  for (const cap of capacitors) {
    const Vc = nodeVoltageOf(x, nodeMap, cap.nodes[0]) - nodeVoltageOf(x, nodeMap, cap.nodes[1]);
    // Ic = C * dV/dt, reconstructed from this step's companion model:
    // Ic_new = Geq*Vc_new - Ieq_prev, but simpler to derive directly from
    // the trapezoidal identity Ic_new = (2C/h)*(Vc_new - Vc_prev) - Ic_prev.
    const Vc_prev = state.capacitorVoltage.get(cap.id) ?? 0;
    const Ic_prev = state.capacitorCurrent.get(cap.id) ?? 0;
    const Ic = (2 * cap.value * (Vc - Vc_prev)) / h - Ic_prev;
    capacitorVoltage.set(cap.id, Vc);
    capacitorCurrent.set(cap.id, Ic);
  }

  const inductorCurrent = new Map<string, number>();
  const inductorVoltage = new Map<string, number>();
  for (const ind of inductors) {
    const branchIndex = nodeMap.branchToIndex.get(ind.id);
    if (branchIndex === undefined) {
      throw new Error(`Inductor "${ind.id}" is missing a branch index.`);
    }
    const Il = x[branchIndex];
    const Vl = nodeVoltageOf(x, nodeMap, ind.nodes[0]) - nodeVoltageOf(x, nodeMap, ind.nodes[1]);
    inductorCurrent.set(ind.id, Il);
    inductorVoltage.set(ind.id, Vl);
  }

  // The one-step-delay comparator re-read: this step was stamped from the
  // incoming latch state; now the freshly-solved voltages set the next one.
  const timer555Q = new Map(state.timer555Q);
  for (const comp of netlist.components) {
    if (comp.type !== 'timer555') continue;
    timer555Q.set(
      comp.id,
      evaluateTimer555Latch(
        nodeVoltageOf(x, nodeMap, comp.nodes[0]),
        nodeVoltageOf(x, nodeMap, comp.nodes[2]),
        nodeVoltageOf(x, nodeMap, comp.nodes[3]),
        state.timer555Q.get(comp.id) ?? false
      )
    );
  }

  return {
    x,
    state: { capacitorVoltage, capacitorCurrent, inductorCurrent, inductorVoltage, timer555Q },
    converged: !warnings,
  };
}

/** The componentCurrents keys a component records: one per device, except BJTs' split base/collector pair. */
function currentKeysOf(comp: Component): string[] {
  return comp.type === 'bjt' ? [`${comp.id}:ib`, `${comp.id}:ic`] : [comp.id];
}

/**
 * Appends every component's current at the just-solved timestep: branch
 * unknowns straight from the solution (sources, inductors, VCVS), resistors
 * via Ohm's law, capacitors from the trapezoidal identity computed for the
 * state update, and nonlinear devices from their exact device equations at
 * the solved voltages (matching solveDC's branchCurrents derivation).
 */
function pushStepCurrents(
  netlist: Netlist,
  nodeMap: NodeMap,
  x: number[],
  t: number,
  capacitorCurrent: Map<string, number>,
  componentCurrents: Record<string, number[]>
): void {
  const v = (n: number) => nodeVoltageOf(x, nodeMap, n);
  for (const comp of netlist.components) {
    switch (comp.type) {
      case 'resistor':
        componentCurrents[comp.id].push((v(comp.nodes[0]) - v(comp.nodes[1])) / comp.value);
        break;
      case 'capacitor':
        componentCurrents[comp.id].push(capacitorCurrent.get(comp.id) ?? 0);
        break;
      case 'isource':
        componentCurrents[comp.id].push(sourceValueAt(comp, t));
        break;
      case 'vsource':
      case 'inductor':
      case 'vcvs': {
        const branchIndex = nodeMap.branchToIndex.get(comp.id);
        componentCurrents[comp.id].push(branchIndex === undefined ? 0 : x[branchIndex]);
        break;
      }
      case 'diode':
        componentCurrents[comp.id].push(
          diodeCurrent(v(comp.nodes[0]) - v(comp.nodes[1]), comp.params as DiodeParams | undefined)
        );
        break;
      case 'bjt': {
        const branchIndex = nodeMap.branchToIndex.get(`${comp.id}:ib`);
        const ib = branchIndex === undefined ? 0 : x[branchIndex];
        const beta = (comp.params as BJTParams | undefined)?.beta ?? DEFAULT_BETA;
        componentCurrents[`${comp.id}:ib`].push(ib);
        componentCurrents[`${comp.id}:ic`].push(beta * ib);
        break;
      }
      case 'mosfet': {
        const Vgs = v(comp.nodes[1]) - v(comp.nodes[2]);
        const Vds = v(comp.nodes[0]) - v(comp.nodes[2]);
        componentCurrents[comp.id].push(
          mosfetCompanionModel(Vgs, Vds, comp.params as MOSFETParams | undefined).Id
        );
        break;
      }
      case 'timer555': {
        // Output current = the timer's own VCVS branch unknown, negated so
        // sourcing into a load reads positive (see the IC-solve note above).
        const branchIndex = nodeMap.branchToIndex.get(`${comp.id}:out`);
        componentCurrents[comp.id].push(branchIndex === undefined ? 0 : -x[branchIndex]);
        break;
      }
    }
  }
}
