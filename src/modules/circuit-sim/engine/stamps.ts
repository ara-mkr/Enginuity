import type { Complex } from './complex';
import { DEFAULT_BETA, diodeCompanionModel, mosfetCompanionModel } from './deviceModels';
import { ComplexMatrix, Matrix } from './matrix';
import type { BJTParams, Component, DiodeParams, MOSFETParams, Netlist } from './types';

const GROUND_NODE = 0;

export interface NodeMap {
  /** netlist node number -> matrix row/col index (ground is absent) */
  nodeToIndex: Map<number, number>;
  /**
   * component id -> matrix row/col index for its branch current unknown.
   * Populated for voltage sources (always) and inductors (only relevant
   * for transient analysis, the only context that stamps them).
   */
  branchToIndex: Map<string, number>;
  /** total matrix size (n + m) */
  size: number;
}

/**
 * Ground (node 0) never gets a row/column. Every other referenced node
 * number gets a sequential index starting at 0. Voltage sources and
 * inductors each get an extra index for their branch current unknown,
 * continuing the sequence after all node indices.
 */
export function buildNodeMap(netlist: Netlist): NodeMap {
  const nodeToIndex = new Map<number, number>();
  const branchToIndex = new Map<string, number>();

  let nextIndex = 0;
  for (const comp of netlist.components) {
    for (const node of comp.nodes) {
      if (node === GROUND_NODE) continue;
      if (!nodeToIndex.has(node)) {
        nodeToIndex.set(node, nextIndex++);
      }
    }
  }

  for (const comp of netlist.components) {
    if (comp.type === 'vsource' || comp.type === 'inductor' || comp.type === 'vcvs') {
      branchToIndex.set(comp.id, nextIndex++);
    }
    if (comp.type === 'bjt') {
      // The base-emitter junction's current-sensing branch, so the
      // collector current-controlled current source (see stampBJT) has a
      // matrix column to reference.
      branchToIndex.set(`${comp.id}:ib`, nextIndex++);
    }
    if (comp.type === 'timer555') {
      // The output stage stamps as a VCVS (see stampTimestep), which needs
      // its own branch-current unknown — it doubles as the reported output
      // current.
      branchToIndex.set(`${comp.id}:out`, nextIndex++);
    }
  }

  return { nodeToIndex, branchToIndex, size: nextIndex };
}

function indexOf(nodeMap: NodeMap, node: number): number {
  if (node === GROUND_NODE) return -1;
  const idx = nodeMap.nodeToIndex.get(node);
  if (idx === undefined) {
    throw new Error(`Node ${node} was not found in the node map.`);
  }
  return idx;
}

export function stampResistor(A: Matrix, nodeMap: NodeMap, comp: Component): void {
  const g = 1 / comp.value;
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);

  if (i !== -1) A.addTo(i, i, g);
  if (j !== -1) A.addTo(j, j, g);
  if (i !== -1 && j !== -1) {
    A.addTo(i, j, -g);
    A.addTo(j, i, -g);
  }
}

export function stampIndependentCurrentSource(z: number[], nodeMap: NodeMap, comp: Component): void {
  const I = comp.value;
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);

  if (i !== -1) z[i] -= I;
  if (j !== -1) z[j] += I;
}

export function stampIndependentVoltageSource(
  A: Matrix,
  z: number[],
  nodeMap: NodeMap,
  comp: Component,
  branchIndex: number
): void {
  const V = comp.value;
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);
  const k = branchIndex;

  if (i !== -1) {
    A.addTo(i, k, 1);
    A.addTo(k, i, 1);
  }
  if (j !== -1) {
    A.addTo(j, k, -1);
    A.addTo(k, j, -1);
  }
  z[k] += V;
}

/**
 * Voltage-controlled voltage source (SPICE E element): the output branch
 * nodes[0]/nodes[1] gets its own current unknown exactly like an
 * independent voltage source, but the branch equation constrains the
 * output voltage to gain * the controlling node-pair's voltage instead of
 * a constant: V(out+) - V(out-) - gain*(V(ctrl+) - V(ctrl-)) = 0. The
 * controlling nodes are pure voltage senses — they get matrix
 * coefficients on the branch row only, never KCL current contributions.
 */
export function stampVCVS(A: Matrix, nodeMap: NodeMap, comp: Component, branchIndex: number): void {
  const gain = comp.value;
  const outP = indexOf(nodeMap, comp.nodes[0]);
  const outN = indexOf(nodeMap, comp.nodes[1]);
  const ctrlP = indexOf(nodeMap, comp.nodes[2]);
  const ctrlN = indexOf(nodeMap, comp.nodes[3]);
  const k = branchIndex;

  if (outP !== -1) {
    A.addTo(outP, k, 1);
    A.addTo(k, outP, 1);
  }
  if (outN !== -1) {
    A.addTo(outN, k, -1);
    A.addTo(k, outN, -1);
  }
  if (ctrlP !== -1) A.addTo(k, ctrlP, -gain);
  if (ctrlN !== -1) A.addTo(k, ctrlN, gain);
}

/**
 * Diode companion model for one Newton-Raphson iteration: linearizes the
 * Shockley equation around V_guess into g_eq (stamped like a resistor
 * conductance) + I_eq (stamped like a current source), both between the
 * anode (nodes[0]) and cathode (nodes[1]) — same convention as
 * stampIndependentCurrentSource, since that's exactly what this reduces to
 * once linearized.
 */
export function stampDiode(
  A: Matrix,
  z: number[],
  nodeMap: NodeMap,
  comp: Component,
  V_guess: number
): void {
  const { g_eq, I_eq } = diodeCompanionModel(V_guess, comp.params as DiodeParams | undefined);
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);

  if (i !== -1) A.addTo(i, i, g_eq);
  if (j !== -1) A.addTo(j, j, g_eq);
  if (i !== -1 && j !== -1) {
    A.addTo(i, j, -g_eq);
    A.addTo(j, i, -g_eq);
  }

  if (i !== -1) z[i] -= I_eq;
  if (j !== -1) z[j] += I_eq;
}

/**
 * Simplified Ebers-Moll NPN bjt companion model for one Newton-Raphson
 * iteration. nodes[0]/[1]/[2] are collector/base/emitter.
 *
 * The base-emitter junction is linearized with the same
 * diodeCompanionModel used by the plain diode component, but — unlike
 * stampDiode — it's given its own branch-current unknown (ibBranchIndex,
 * assigned in buildNodeMap), because the collector current source below
 * needs to reference "the current through the BE junction" as a matrix
 * column, not just a pair of node voltages. The branch equation enforces
 * Ib - g_eq*(Vb - Ve) = I_eq, i.e. Ib equal to the linearized BE diode
 * current, using the same +1/-1 node-row convention as
 * stampIndependentVoltageSource's branch current.
 *
 * The base-collector junction reuses the identical diode linearization
 * (same function, same parameters) stamped directly with stampDiode,
 * since nothing downstream needs its current as a controlling variable —
 * in forward-active operation it's reverse-biased and contributes
 * negligible current, which is what keeps Ic/Ib close to beta.
 *
 * Ic = beta * Ib is a current-controlled current source (CCCS): current
 * flows collector -> emitter inside the device (the real NPN's internal
 * path), stamped as a matrix coefficient on the BE branch's current
 * column (ibBranchIndex) instead of a constant RHS term. Because Ib is
 * now a matrix unknown rather than a known value, its coefficient carries
 * the OPPOSITE sign convention from stampIndependentCurrentSource's z[i]
 * -= I / z[j] += I (that RHS form already has the sign flip baked in from
 * moving a known quantity across the equals sign) — the un-flipped LHS
 * coefficients are +1 at the source node (collector) and -1 at the sink
 * node (emitter), matching stampIndependentVoltageSource's branch-current
 * KCL stamp (A[i][k] = +1, A[j][k] = -1), which is the correct pattern to
 * copy for any branch current that's a live unknown, not a constant.
 */
export function stampBJT(
  A: Matrix,
  z: number[],
  nodeMap: NodeMap,
  comp: Component,
  ibBranchIndex: number,
  Vbe_guess: number,
  Vbc_guess: number
): void {
  const params = comp.params as BJTParams | undefined;
  const beta = params?.beta ?? DEFAULT_BETA;
  const junctionParams: DiodeParams = { Is: params?.Is, Vt: params?.Vt };

  const [c, b, e] = comp.nodes;
  const bi = indexOf(nodeMap, b);
  const ei = indexOf(nodeMap, e);
  const ci = indexOf(nodeMap, c);
  const k = ibBranchIndex;

  const { g_eq: gBe, I_eq: iBe } = diodeCompanionModel(Vbe_guess, junctionParams);
  if (bi !== -1) {
    A.addTo(bi, k, 1);
    A.addTo(k, bi, -gBe);
  }
  if (ei !== -1) {
    A.addTo(ei, k, -1);
    A.addTo(k, ei, gBe);
  }
  A.addTo(k, k, 1);
  z[k] += iBe;

  stampDiode(A, z, nodeMap, { ...comp, nodes: [b, c], params: junctionParams }, Vbc_guess);

  if (ci !== -1) A.addTo(ci, k, beta);
  if (ei !== -1) A.addTo(ei, k, -beta);
}

/**
 * NMOS square-law companion model for one Newton-Raphson iteration.
 * nodes[0]/[1]/[2] are drain/gate/source. Linearizes Id(Vgs, Vds) around
 * the current guesses into gm (VCCS controlled by Vgs, current flowing
 * drain -> source), gds (an ordinary drain-source conductance, stamped
 * like a resistor), and Ieq (a constant current source correction term
 * making the linearization exact at the operating point, the two-voltage
 * analog of the diode's I_eq).
 */
export function stampMOSFET(
  A: Matrix,
  z: number[],
  nodeMap: NodeMap,
  comp: Component,
  Vgs_guess: number,
  Vds_guess: number
): void {
  const params = comp.params as MOSFETParams | undefined;
  const { Id, gm, gds } = mosfetCompanionModel(Vgs_guess, Vds_guess, params);
  const Ieq = Id - gm * Vgs_guess - gds * Vds_guess;

  const [d, g, s] = comp.nodes;
  const di = indexOf(nodeMap, d);
  const gi = indexOf(nodeMap, g);
  const si = indexOf(nodeMap, s);

  if (di !== -1) {
    if (gi !== -1) A.addTo(di, gi, gm);
    if (si !== -1) A.addTo(di, si, -gm);
  }
  if (si !== -1) {
    if (gi !== -1) A.addTo(si, gi, -gm);
    A.addTo(si, si, gm);
  }

  if (di !== -1) A.addTo(di, di, gds);
  if (si !== -1) A.addTo(si, si, gds);
  if (di !== -1 && si !== -1) {
    A.addTo(di, si, -gds);
    A.addTo(si, di, -gds);
  }

  if (di !== -1) z[di] -= Ieq;
  if (si !== -1) z[si] += Ieq;
}

/**
 * Trapezoidal companion model for a capacitor: an equivalent conductance
 * Geq_C = 2*C/h in parallel with a current source Ieq_C = Ic_prev +
 * (2*C/h) * Vc_prev, stamped exactly like a resistor + current source.
 * Vc_prev/Ic_prev are the capacitor's voltage/current from the PREVIOUS
 * timestep (0/0 at cold-start, t=0).
 */
export function stampCapacitor(
  A: Matrix,
  z: number[],
  nodeMap: NodeMap,
  comp: Component,
  h: number,
  Vc_prev: number,
  Ic_prev: number
): void {
  const geq = (2 * comp.value) / h;
  const ieq = Ic_prev + geq * Vc_prev;
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);

  if (i !== -1) A.addTo(i, i, geq);
  if (j !== -1) A.addTo(j, j, geq);
  if (i !== -1 && j !== -1) {
    A.addTo(i, j, -geq);
    A.addTo(j, i, -geq);
  }

  // Norton current source oriented nodes[1]->nodes[0] (opposite of the
  // capacitor's own i->j current convention): it injects Ieq into node i
  // so that the physical branch current comes out to Geq*Vij - Ieq, per
  // the trapezoidal derivation Ic_new = Geq*(Vc_new - Vc_prev) - Ic_prev.
  if (i !== -1) z[i] += ieq;
  if (j !== -1) z[j] -= ieq;
}

/**
 * Trapezoidal companion model for an inductor: an equivalent resistance
 * Req_L = 2*L/h in series with a voltage source Veq_L = Req_L *
 * (Il_prev + (h/(2*L)) * Vl_prev), given its own branch-current unknown
 * (same pattern as stampIndependentVoltageSource) so the branch current
 * is available directly from the solution rather than reconstructed from
 * terminal voltages. Il_prev/Vl_prev are the inductor's PREVIOUS
 * timestep's branch current/terminal voltage.
 */
export function stampInductor(
  A: Matrix,
  z: number[],
  nodeMap: NodeMap,
  comp: Component,
  h: number,
  branchIndex: number,
  Il_prev: number,
  Vl_prev: number
): void {
  const req = (2 * comp.value) / h;
  const ieq = Il_prev + (h / (2 * comp.value)) * Vl_prev;
  const veq = req * ieq;
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);
  const k = branchIndex;

  if (i !== -1) {
    A.addTo(i, k, 1);
    A.addTo(k, i, 1);
  }
  if (j !== -1) {
    A.addTo(j, k, -1);
    A.addTo(k, j, -1);
  }
  // Branch equation: Vi - Vj - Req_L*IL = -Req_L*ieq (trapezoidal
  // rearranged so IL is on the LHS with the other unknowns).
  A.addTo(k, k, -req);
  z[k] -= veq;
}

// --- AC (frequency-domain) stamps ---
// Same stamping positions/patterns as the DC versions above, but every
// matrix entry is Complex-typed so resistors/sources (whose values are
// real) can share a solver with reactive components (whose admittances
// are purely imaginary).

function negate(c: Complex): Complex {
  return { re: -c.re, im: -c.im };
}

export function stampResistorAC(A: ComplexMatrix, nodeMap: NodeMap, comp: Component): void {
  const g: Complex = { re: 1 / comp.value, im: 0 };
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);

  if (i !== -1) A.addTo(i, i, g);
  if (j !== -1) A.addTo(j, j, g);
  if (i !== -1 && j !== -1) {
    const negG = negate(g);
    A.addTo(i, j, negG);
    A.addTo(j, i, negG);
  }
}

/** Admittance stamp Y = j*omega*C, same position as a resistor's conductance. */
export function stampCapacitorAC(A: ComplexMatrix, nodeMap: NodeMap, comp: Component, omega: number): void {
  const y: Complex = { re: 0, im: omega * comp.value };
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);

  if (i !== -1) A.addTo(i, i, y);
  if (j !== -1) A.addTo(j, j, y);
  if (i !== -1 && j !== -1) {
    const negY = negate(y);
    A.addTo(i, j, negY);
    A.addTo(j, i, negY);
  }
}

/**
 * Inductor impedance Z = j*omega*L, stamped with the same branch-current
 * pattern as a voltage source (MNA can't stamp an impedance directly — it
 * needs a branch current unknown), except the branch equation is
 * V = j*omega*L*I instead of V = constant, so the (k,k) diagonal gets
 * -j*omega*L instead of 0 and there's no z[k] forcing term.
 */
export function stampInductorAC(
  A: ComplexMatrix,
  nodeMap: NodeMap,
  comp: Component,
  omega: number,
  branchIndex: number
): void {
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);
  const k = branchIndex;
  const one: Complex = { re: 1, im: 0 };

  if (i !== -1) {
    A.addTo(i, k, one);
    A.addTo(k, i, one);
  }
  if (j !== -1) {
    A.addTo(j, k, negate(one));
    A.addTo(k, j, negate(one));
  }
  A.addTo(k, k, { re: 0, im: -omega * comp.value });
}

export function stampVoltageSourceAC(
  A: ComplexMatrix,
  z: Complex[],
  nodeMap: NodeMap,
  comp: Component,
  branchIndex: number,
  acMagnitude: number
): void {
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);
  const k = branchIndex;
  const one: Complex = { re: 1, im: 0 };

  if (i !== -1) {
    A.addTo(i, k, one);
    A.addTo(k, i, one);
  }
  if (j !== -1) {
    A.addTo(j, k, negate(one));
    A.addTo(k, j, negate(one));
  }
  z[k] = { re: z[k].re + acMagnitude, im: z[k].im };
}

export function stampCurrentSourceAC(
  z: Complex[],
  nodeMap: NodeMap,
  comp: Component,
  acMagnitude: number
): void {
  const i = indexOf(nodeMap, comp.nodes[0]);
  const j = indexOf(nodeMap, comp.nodes[1]);

  if (i !== -1) z[i] = { re: z[i].re - acMagnitude, im: z[i].im };
  if (j !== -1) z[j] = { re: z[j].re + acMagnitude, im: z[j].im };
}

/**
 * Complex-valued twin of stampVCVS. The gain is real and
 * frequency-independent, so the stamp is identical at every sweep point —
 * only the matrix element type changes.
 */
export function stampVCVSAC(A: ComplexMatrix, nodeMap: NodeMap, comp: Component, branchIndex: number): void {
  const gain = comp.value;
  const outP = indexOf(nodeMap, comp.nodes[0]);
  const outN = indexOf(nodeMap, comp.nodes[1]);
  const ctrlP = indexOf(nodeMap, comp.nodes[2]);
  const ctrlN = indexOf(nodeMap, comp.nodes[3]);
  const k = branchIndex;
  const one: Complex = { re: 1, im: 0 };

  if (outP !== -1) {
    A.addTo(outP, k, one);
    A.addTo(k, outP, one);
  }
  if (outN !== -1) {
    A.addTo(outN, k, negate(one));
    A.addTo(k, outN, negate(one));
  }
  if (ctrlP !== -1) A.addTo(k, ctrlP, { re: -gain, im: 0 });
  if (ctrlN !== -1) A.addTo(k, ctrlN, { re: gain, im: 0 });
}

/**
 * Stamps a fixed real-valued conductance between two nodes — used for a
 * nonlinear device's (e.g. diode) small-signal g_eq during AC analysis,
 * which is held constant across the whole frequency sweep (computed once
 * at the DC operating point). Same stamping pattern as stampResistorAC.
 */
export function stampConductanceAC(
  A: ComplexMatrix,
  nodeMap: NodeMap,
  nodes: [number, number],
  g: number
): void {
  const G: Complex = { re: g, im: 0 };
  const i = indexOf(nodeMap, nodes[0]);
  const j = indexOf(nodeMap, nodes[1]);

  if (i !== -1) A.addTo(i, i, G);
  if (j !== -1) A.addTo(j, j, G);
  if (i !== -1 && j !== -1) {
    const negG = negate(G);
    A.addTo(i, j, negG);
    A.addTo(j, i, negG);
  }
}
