import type { Complex } from './complex';
import { magnitude, multiply, phaseDegrees, subtract } from './complex';
import { diodeCompanionModel } from './deviceModels';
import { solveDC } from './dcAnalysis';
import { ComplexMatrix, solveComplex } from './matrix';
import {
  buildNodeMap,
  stampCapacitorAC,
  stampConductanceAC,
  stampCurrentSourceAC,
  stampInductorAC,
  stampResistorAC,
  stampVCVSAC,
  stampVoltageSourceAC,
} from './stamps';
import type { DiodeParams, Netlist } from './types';

export interface ACOptions {
  startFreq: number;
  stopFreq: number;
  pointsPerDecade: number;
  /** Frequency spacing: 'log' (default) spaces by pointsPerDecade, 'linear' spaces numPoints evenly. */
  sweepType?: 'log' | 'linear';
  /** Total point count for a linear sweep (default 200). Ignored for log sweeps. */
  numPoints?: number;
  /** Component id of the single independent source treated as the AC stimulus (magnitude 1); all other independent sources are held at 0. */
  acSourceId: string;
}

export interface ACResult {
  frequency: number[];
  magnitude_db: Record<number, number[]>;
  phase_deg: Record<number, number[]>;
  /**
   * Component id → branch-current phasor per frequency point, positive from
   * nodes[0] to nodes[1] through the device, as dB(A) relative to the
   * unit-magnitude stimulus (floored at −600 dB so an exactly-zero current
   * stays finite) plus phase in degrees.
   */
  current_mag_db: Record<string, number[]>;
  current_phase_deg: Record<string, number[]>;
}

function logSpacedFrequencies(startFreq: number, stopFreq: number, pointsPerDecade: number): number[] {
  const decades = Math.log10(stopFreq / startFreq);
  const numPoints = Math.max(2, Math.round(decades * pointsPerDecade) + 1);
  const frequencies: number[] = [];
  for (let k = 0; k < numPoints; k++) {
    const exponent = Math.log10(startFreq) + (k / (numPoints - 1)) * decades;
    frequencies.push(Math.pow(10, exponent));
  }
  return frequencies;
}

function linearSpacedFrequencies(startFreq: number, stopFreq: number, numPoints: number): number[] {
  const n = Math.max(2, Math.round(numPoints));
  const frequencies: number[] = [];
  for (let k = 0; k < n; k++) {
    frequencies.push(startFreq + (k / (n - 1)) * (stopFreq - startFreq));
  }
  return frequencies;
}

/**
 * Runs a frequency-domain (AC) sweep: solves the DC operating point once
 * to linearize any nonlinear devices, then re-solves a complex-valued MNA
 * system at each swept frequency to get magnitude/phase per node relative
 * to a single unit-magnitude AC stimulus source.
 */
export function runAC(netlist: Netlist, options: ACOptions): ACResult {
  const { startFreq, stopFreq, pointsPerDecade, acSourceId } = options;

  // Step 1/2: DC operating point, then fix each diode's small-signal
  // conductance at that point for the entire sweep (it does not change
  // per frequency point).
  const dc = solveDC(netlist);
  const diodeGEq = new Map<string, number>();
  for (const comp of netlist.components) {
    if (comp.type !== 'diode') continue;
    const vAnode = comp.nodes[0] === 0 ? 0 : dc.nodeVoltages[comp.nodes[0]];
    const vCathode = comp.nodes[1] === 0 ? 0 : dc.nodeVoltages[comp.nodes[1]];
    diodeGEq.set(comp.id, diodeCompanionModel(vAnode - vCathode, comp.params as DiodeParams | undefined).g_eq);
  }

  const nodeMap = buildNodeMap(netlist);
  const frequency =
    options.sweepType === 'linear'
      ? linearSpacedFrequencies(startFreq, stopFreq, options.numPoints ?? 200)
      : logSpacedFrequencies(startFreq, stopFreq, pointsPerDecade);

  const magnitude_db: Record<number, number[]> = {};
  const phase_deg: Record<number, number[]> = {};
  for (const node of nodeMap.nodeToIndex.keys()) {
    magnitude_db[node] = [];
    phase_deg[node] = [];
  }
  const current_mag_db: Record<string, number[]> = {};
  const current_phase_deg: Record<string, number[]> = {};
  for (const comp of netlist.components) {
    current_mag_db[comp.id] = [];
    current_phase_deg[comp.id] = [];
  }

  for (const freq of frequency) {
    const omega = 2 * Math.PI * freq;
    const A = new ComplexMatrix(nodeMap.size);
    const z: Complex[] = Array.from({ length: nodeMap.size }, () => ({ re: 0, im: 0 }));

    for (const comp of netlist.components) {
      switch (comp.type) {
        case 'resistor':
          stampResistorAC(A, nodeMap, comp);
          break;
        case 'capacitor':
          stampCapacitorAC(A, nodeMap, comp, omega);
          break;
        case 'inductor': {
          const branchIndex = nodeMap.branchToIndex.get(comp.id);
          if (branchIndex === undefined) {
            throw new Error(`Inductor "${comp.id}" is missing a branch index.`);
          }
          stampInductorAC(A, nodeMap, comp, omega, branchIndex);
          break;
        }
        case 'vsource': {
          const branchIndex = nodeMap.branchToIndex.get(comp.id);
          if (branchIndex === undefined) {
            throw new Error(`Voltage source "${comp.id}" is missing a branch index.`);
          }
          stampVoltageSourceAC(A, z, nodeMap, comp, branchIndex, comp.id === acSourceId ? 1 : 0);
          break;
        }
        case 'isource':
          stampCurrentSourceAC(z, nodeMap, comp, comp.id === acSourceId ? 1 : 0);
          break;
        case 'vcvs': {
          const branchIndex = nodeMap.branchToIndex.get(comp.id);
          if (branchIndex === undefined) {
            throw new Error(`VCVS "${comp.id}" is missing a branch index.`);
          }
          stampVCVSAC(A, nodeMap, comp, branchIndex);
          break;
        }
        case 'diode':
          stampConductanceAC(A, nodeMap, comp.nodes as [number, number], diodeGEq.get(comp.id) ?? 0);
          break;
        case 'bjt':
        case 'mosfet':
          throw new Error(
            `AC analysis does not support ${comp.type} devices yet ("${comp.id}"). Remove it or run a transient/operating-point analysis instead.`
          );
        case 'timer555':
          throw new Error(
            `AC analysis does not support the 555 timer ("${comp.id}") — its switching behavior has no small-signal model. Run a transient analysis instead.`
          );
        default:
          throw new Error(`Unknown component type: ${comp.type}`);
      }
    }

    const x = solveComplex(A.toArray(), z);

    for (const [node, idx] of nodeMap.nodeToIndex) {
      const v = x[idx];
      magnitude_db[node].push(20 * Math.log10(magnitude(v)));
      phase_deg[node].push(phaseDegrees(v));
    }

    // Branch-current phasors: branch unknowns straight from the solution,
    // resistors/diodes through their (small-signal) conductance, capacitors
    // through their admittance, current sources by definition.
    const nodePhasor = (n: number): Complex =>
      n === 0 ? { re: 0, im: 0 } : x[nodeMap.nodeToIndex.get(n) as number];
    for (const comp of netlist.components) {
      let current: Complex;
      switch (comp.type) {
        case 'resistor':
          current = multiply(subtract(nodePhasor(comp.nodes[0]), nodePhasor(comp.nodes[1])), {
            re: 1 / comp.value,
            im: 0,
          });
          break;
        case 'capacitor':
          current = multiply(subtract(nodePhasor(comp.nodes[0]), nodePhasor(comp.nodes[1])), {
            re: 0,
            im: omega * comp.value,
          });
          break;
        case 'diode':
          current = multiply(subtract(nodePhasor(comp.nodes[0]), nodePhasor(comp.nodes[1])), {
            re: diodeGEq.get(comp.id) ?? 0,
            im: 0,
          });
          break;
        case 'isource':
          current = { re: comp.id === acSourceId ? 1 : 0, im: 0 };
          break;
        default:
          // vsource, inductor, vcvs — all carry a branch-current unknown.
          current = x[nodeMap.branchToIndex.get(comp.id) as number];
      }
      current_mag_db[comp.id].push(20 * Math.log10(Math.max(magnitude(current), 1e-30)));
      current_phase_deg[comp.id].push(phaseDegrees(current));
    }
  }

  return { frequency, magnitude_db, phase_deg, current_mag_db, current_phase_deg };
}
