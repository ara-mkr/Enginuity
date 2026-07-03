import type { Complex } from './complex';
import { magnitude, phaseDegrees } from './complex';
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
  stampVoltageSourceAC,
} from './stamps';
import type { DiodeParams, Netlist } from './types';

export interface ACOptions {
  startFreq: number;
  stopFreq: number;
  pointsPerDecade: number;
  /** Component id of the single independent source treated as the AC stimulus (magnitude 1); all other independent sources are held at 0. */
  acSourceId: string;
}

export interface ACResult {
  frequency: number[];
  magnitude_db: Record<number, number[]>;
  phase_deg: Record<number, number[]>;
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
  const frequency = logSpacedFrequencies(startFreq, stopFreq, pointsPerDecade);

  const magnitude_db: Record<number, number[]> = {};
  const phase_deg: Record<number, number[]> = {};
  for (const node of nodeMap.nodeToIndex.keys()) {
    magnitude_db[node] = [];
    phase_deg[node] = [];
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
        case 'diode':
          stampConductanceAC(A, nodeMap, comp.nodes as [number, number], diodeGEq.get(comp.id) ?? 0);
          break;
        case 'bjt':
        case 'mosfet':
          throw new Error(
            `AC analysis does not support ${comp.type} devices yet ("${comp.id}"). Remove it or run a transient/operating-point analysis instead.`
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
  }

  return { frequency, magnitude_db, phase_deg };
}
