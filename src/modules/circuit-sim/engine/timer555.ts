// Behavioral NE555 timer model for transient analysis. A 555 has no single
// DC operating point — its internal SR latch makes it bistable — so it lives
// only in the time domain, re-evaluated once per timestep with a one-step
// delay: each step is stamped from the latch state left by the previous step,
// then the comparators re-read the freshly-solved node voltages to produce
// the next state. Node order everywhere is [vcc, gnd, trig, thr, dis, out].

import type { Matrix } from './matrix';
import { stampResistor, stampVCVS, type NodeMap } from './stamps';
import type { Component, Timer555Params } from './types';

export interface Timer555Config {
  rDischargeOn: number;
  rDischargeOff: number;
  rDivider: number;
  outputHighFraction: number;
}

export function resolveTimer555Params(params?: Timer555Params): Timer555Config {
  return {
    rDischargeOn: params?.rDischargeOn ?? 10,
    rDischargeOff: params?.rDischargeOff ?? 1e9,
    rDivider: params?.rDivider ?? 15000,
    outputHighFraction: params?.outputHighFraction ?? 1,
  };
}

/**
 * The SR-latch update from the two comparators, referenced to the internal
 * 1/3·Vcc (trigger) and 2/3·Vcc (threshold) taps computed from the live Vcc
 * node. TRIG below 1/3·Vcc sets the latch (output high); THR above 2/3·Vcc
 * resets it (output low); otherwise it holds. Reset is dominant, matching the
 * common NE555 convention — irrelevant for astable/monostable circuits where
 * TRIG and THR share a node and can never trip together.
 */
export function evaluateTimer555Latch(
  vVcc: number,
  vTrig: number,
  vThr: number,
  prevQ: boolean
): boolean {
  const lower = vVcc / 3;
  const upper = (2 * vVcc) / 3;
  const set = vTrig < lower;
  const reset = vThr > upper;
  if (reset) return false;
  if (set) return true;
  return prevQ;
}

/**
 * Stamps the timer at a fixed latch state Q for one timestep: the output
 * stage as a Vcc-referenced VCVS (gain outputHighFraction when high, 0 —
 * a hard pull to ground — when low), the discharge pin as a switch resistor
 * to ground (on-resistance when low, open when high), and the constant
 * comparator-divider load across Vcc. The VCVS reuses the timer's own
 * `${id}:out` branch unknown, which doubles as its reported output current.
 */
export function stampTimer555(
  A: Matrix,
  nodeMap: NodeMap,
  comp: Component,
  branchIndex: number,
  Q: boolean,
  cfg: Timer555Config
): void {
  const [vcc, gnd, , , dis, out] = comp.nodes;

  // Output VCVS: V(out) - V(gnd) = gain · (V(vcc) - V(gnd)).
  stampVCVS(
    A,
    nodeMap,
    { ...comp, nodes: [out, gnd, vcc, gnd], value: Q ? cfg.outputHighFraction : 0 },
    branchIndex
  );

  // Discharge switch to ground, and the always-present divider load.
  stampResistor(A, nodeMap, { ...comp, nodes: [dis, gnd], value: Q ? cfg.rDischargeOff : cfg.rDischargeOn });
  stampResistor(A, nodeMap, { ...comp, nodes: [vcc, gnd], value: cfg.rDivider });
}

/**
 * The primitive engine components an initial-condition (DC) solve sees in
 * place of the timer at a fixed latch state Q — the same three elements
 * stampTimer555 stamps, expressed as ordinary parts (`${id}#OUT` VCVS,
 * `${id}#DIS` / `${id}#DIV` resistors) so solveDC, which has no notion of a
 * 555, can solve the t=0 operating point.
 */
export function timer555Primitives(comp: Component, Q: boolean, cfg: Timer555Config): Component[] {
  const [vcc, gnd, , , dis, out] = comp.nodes;
  return [
    { id: `${comp.id}#OUT`, type: 'vcvs', nodes: [out, gnd, vcc, gnd], value: Q ? cfg.outputHighFraction : 0 },
    { id: `${comp.id}#DIS`, type: 'resistor', nodes: [dis, gnd], value: Q ? cfg.rDischargeOff : cfg.rDischargeOn },
    { id: `${comp.id}#DIV`, type: 'resistor', nodes: [vcc, gnd], value: cfg.rDivider },
  ];
}
