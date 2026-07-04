import { DEFAULT_BETA, mosfetCompanionModel } from './deviceModels';
import { Matrix, solve } from './matrix';
import {
  buildNodeMap,
  stampBJT,
  stampDiode,
  stampIndependentCurrentSource,
  stampIndependentVoltageSource,
  stampMOSFET,
  stampResistor,
  stampVCVS,
  type NodeMap,
} from './stamps';
import type { BJTParams, Component, DiodeParams, MOSFETParams, Netlist, SolveResult } from './types';
import { validateNetlist } from './validate';

const DEFAULT_TOLERANCE = 1e-6;
const DEFAULT_MAX_ITERATIONS = 100;

export interface SolveDCOptions {
  /** Newton-Raphson convergence tolerance (max voltage change across nonlinear devices). */
  tolerance?: number;
  /** Newton-Raphson iteration cap before giving up and flagging non-convergence. */
  maxIterations?: number;
}

export function nodeVoltageOf(x: number[], nodeMap: NodeMap, node: number): number {
  if (node === 0) return 0;
  const idx = nodeMap.nodeToIndex.get(node);
  return idx === undefined ? 0 : x[idx];
}

interface MOSFETGuess {
  vgs: number;
  vds: number;
}

function bjtBranchIndex(nodeMap: NodeMap, comp: Component): number {
  const branchIndex = nodeMap.branchToIndex.get(`${comp.id}:ib`);
  if (branchIndex === undefined) {
    throw new Error(`Bjt "${comp.id}" is missing its base-emitter branch index.`);
  }
  return branchIndex;
}

/**
 * Runs the Newton-Raphson loop that linearizes every nonlinear device
 * (diodes, bjts, mosfets) around its previous-iteration voltage guess(es)
 * until convergence or the iteration cap. `stampLinear` stamps every
 * linear/companion-model component for the timestep/operating-point being
 * solved (resistors, sources, and — for transient analysis — capacitor/
 * inductor companion models); it's called fresh on every iteration since
 * A/z must be rebuilt each time a nonlinear device's linearization point
 * changes.
 *
 * Shared by dcAnalysis (operating point) and transientAnalysis (each
 * timestep) so the iteration logic exists in exactly one place.
 */
export function runNewtonRaphson(
  netlist: Netlist,
  nodeMap: NodeMap,
  stampLinear: (A: Matrix, z: number[]) => void,
  options: SolveDCOptions = {}
): { x: number[]; warnings?: string[] } {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  const diodes = netlist.components.filter((c) => c.type === 'diode');
  const bjts = netlist.components.filter((c) => c.type === 'bjt');
  const mosfets = netlist.components.filter((c) => c.type === 'mosfet');
  const hasNonlinear = diodes.length > 0 || bjts.length > 0 || mosfets.length > 0;

  const buildAndSolve = (
    diodeVoltages: Map<string, number>,
    bjtVbe: Map<string, number>,
    bjtVbc: Map<string, number>,
    mosfetGuess: Map<string, MOSFETGuess>
  ): number[] => {
    const A = new Matrix(nodeMap.size);
    const z = new Array(nodeMap.size).fill(0);

    stampLinear(A, z);
    for (const d of diodes) {
      const V_guess = diodeVoltages.get(d.id) ?? 0;
      stampDiode(A, z, nodeMap, d, V_guess);
    }
    for (const q of bjts) {
      const Vbe_guess = bjtVbe.get(q.id) ?? 0;
      const Vbc_guess = bjtVbc.get(q.id) ?? 0;
      stampBJT(A, z, nodeMap, q, bjtBranchIndex(nodeMap, q), Vbe_guess, Vbc_guess);
    }
    for (const m of mosfets) {
      const guess = mosfetGuess.get(m.id) ?? { vgs: 0, vds: 0 };
      stampMOSFET(A, z, nodeMap, m, guess.vgs, guess.vds);
    }

    return solve(A.toArray(), z);
  };

  if (!hasNonlinear) {
    // No nonlinear devices — a single linear solve, zero iteration overhead.
    return { x: buildAndSolve(new Map(), new Map(), new Map(), new Map()) };
  }

  const diodeVoltages = new Map<string, number>(diodes.map((d) => [d.id, 0]));
  const bjtVbe = new Map<string, number>(bjts.map((q) => [q.id, 0]));
  const bjtVbc = new Map<string, number>(bjts.map((q) => [q.id, 0]));
  const mosfetGuess = new Map<string, MOSFETGuess>(mosfets.map((m) => [m.id, { vgs: 0, vds: 0 }]));
  let x: number[] = [];
  let converged = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    x = buildAndSolve(diodeVoltages, bjtVbe, bjtVbc, mosfetGuess);

    let maxDelta = 0;
    for (const d of diodes) {
      const newV = nodeVoltageOf(x, nodeMap, d.nodes[0]) - nodeVoltageOf(x, nodeMap, d.nodes[1]);
      const oldV = diodeVoltages.get(d.id) as number;
      maxDelta = Math.max(maxDelta, Math.abs(newV - oldV));
      diodeVoltages.set(d.id, newV);
    }
    for (const q of bjts) {
      // nodes: [collector, base, emitter]
      const newVbe = nodeVoltageOf(x, nodeMap, q.nodes[1]) - nodeVoltageOf(x, nodeMap, q.nodes[2]);
      const newVbc = nodeVoltageOf(x, nodeMap, q.nodes[1]) - nodeVoltageOf(x, nodeMap, q.nodes[0]);
      const oldVbe = bjtVbe.get(q.id) as number;
      const oldVbc = bjtVbc.get(q.id) as number;
      maxDelta = Math.max(maxDelta, Math.abs(newVbe - oldVbe), Math.abs(newVbc - oldVbc));
      bjtVbe.set(q.id, newVbe);
      bjtVbc.set(q.id, newVbc);
    }
    for (const m of mosfets) {
      // nodes: [drain, gate, source]
      const newVgs = nodeVoltageOf(x, nodeMap, m.nodes[1]) - nodeVoltageOf(x, nodeMap, m.nodes[2]);
      const newVds = nodeVoltageOf(x, nodeMap, m.nodes[0]) - nodeVoltageOf(x, nodeMap, m.nodes[2]);
      const old = mosfetGuess.get(m.id) as MOSFETGuess;
      maxDelta = Math.max(maxDelta, Math.abs(newVgs - old.vgs), Math.abs(newVds - old.vds));
      mosfetGuess.set(m.id, { vgs: newVgs, vds: newVds });
    }

    if (maxDelta < tolerance) {
      converged = true;
      break;
    }
  }

  const warnings = converged
    ? undefined
    : [`Solve did not converge after ${maxIterations} iterations`];
  return { x, warnings };
}

function stampLinearComponents(netlist: Netlist, nodeMap: NodeMap, A: Matrix, z: number[]): void {
  for (const comp of netlist.components) {
    switch (comp.type) {
      case 'resistor':
        stampResistor(A, nodeMap, comp);
        break;
      case 'isource':
        stampIndependentCurrentSource(z, nodeMap, comp);
        break;
      case 'vsource': {
        const branchIndex = nodeMap.branchToIndex.get(comp.id);
        if (branchIndex === undefined) {
          throw new Error(`Voltage source "${comp.id}" is missing a branch index.`);
        }
        stampIndependentVoltageSource(A, z, nodeMap, comp, branchIndex);
        break;
      }
      case 'vcvs': {
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
        // Stamped per-iteration by runNewtonRaphson, not here.
        break;
      case 'capacitor':
        // DC steady state: a capacitor is fully charged and draws no
        // current — an open circuit, so it contributes no stamp at all.
        break;
      case 'inductor': {
        // DC steady state: an inductor has zero volts across it — a
        // short, i.e. the same MNA pattern as a 0V independent source.
        const branchIndex = nodeMap.branchToIndex.get(comp.id);
        if (branchIndex === undefined) {
          throw new Error(`Inductor "${comp.id}" is missing a branch index.`);
        }
        stampIndependentVoltageSource(A, z, nodeMap, { ...comp, value: 0 }, branchIndex);
        break;
      }
      default:
        throw new Error(`Unknown component type: ${comp.type}`);
    }
  }
}

export function solveDC(netlist: Netlist, options: SolveDCOptions = {}): SolveResult {
  const validation = validateNetlist(netlist);
  if (validation.errors.length > 0) {
    throw new Error(
      `Cannot solve circuit — invalid netlist:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  const nodeMap = buildNodeMap(netlist);
  const diodes: Component[] = netlist.components.filter((c) => c.type === 'diode');
  const bjts: Component[] = netlist.components.filter((c) => c.type === 'bjt');
  const mosfets: Component[] = netlist.components.filter((c) => c.type === 'mosfet');

  const { x, warnings } = runNewtonRaphson(
    netlist,
    nodeMap,
    (A, z) => stampLinearComponents(netlist, nodeMap, A, z),
    options
  );

  const nodeVoltages: Record<number, number> = {};
  for (const [node, idx] of nodeMap.nodeToIndex) {
    nodeVoltages[node] = x[idx];
  }

  const branchCurrents: Record<string, number> = {};
  for (const [id, idx] of nodeMap.branchToIndex) {
    branchCurrents[id] = x[idx];
  }
  for (const d of diodes) {
    const Vd = nodeVoltageOf(x, nodeMap, d.nodes[0]) - nodeVoltageOf(x, nodeMap, d.nodes[1]);
    const params = d.params as DiodeParams | undefined;
    const Is = params?.Is ?? 1e-14;
    const Vt = params?.Vt ?? 0.026;
    const n = params?.n ?? 1;
    branchCurrents[d.id] = Is * (Math.exp(Vd / (n * Vt)) - 1);
  }
  for (const q of bjts) {
    // branchCurrents already has `${q.id}:ib` from the branchToIndex loop
    // above (the bjt's own current-sensing branch unknown).
    const branchIndex = nodeMap.branchToIndex.get(`${q.id}:ib`) as number;
    const Ib = x[branchIndex];
    const beta = (q.params as BJTParams | undefined)?.beta ?? DEFAULT_BETA;
    branchCurrents[`${q.id}:ic`] = beta * Ib;
  }
  for (const m of mosfets) {
    const Vgs = nodeVoltageOf(x, nodeMap, m.nodes[1]) - nodeVoltageOf(x, nodeMap, m.nodes[2]);
    const Vds = nodeVoltageOf(x, nodeMap, m.nodes[0]) - nodeVoltageOf(x, nodeMap, m.nodes[2]);
    branchCurrents[m.id] = mosfetCompanionModel(Vgs, Vds, m.params as MOSFETParams | undefined).Id;
  }

  const result: SolveResult = { nodeVoltages, branchCurrents };
  if (warnings) result.warnings = warnings;
  return result;
}
