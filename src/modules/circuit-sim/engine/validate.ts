import type { Netlist } from './types';

const GROUND_NODE = 0;
const VALUE_TOLERANCE = 1e-9;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateNetlist(netlist: Netlist): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const groundReferenced = netlist.components.some((c) =>
    c.nodes.includes(GROUND_NODE)
  );
  if (!groundReferenced) {
    errors.push(
      'No ground node (node 0) is referenced anywhere in the netlist. Every circuit needs a reference node.'
    );
  }

  const terminalCounts = new Map<number, number>();
  for (const comp of netlist.components) {
    for (const node of comp.nodes) {
      if (node === GROUND_NODE) continue;
      terminalCounts.set(node, (terminalCounts.get(node) ?? 0) + 1);
    }
  }
  for (const [node, count] of terminalCounts) {
    if (count === 1) {
      warnings.push(
        `Node ${node} only connects to a single component terminal (floating/dead-end node). This is usually a mistake.`
      );
    }
  }

  const vsources = netlist.components.filter((c) => c.type === 'vsource');

  for (const vs of vsources) {
    if (vs.nodes[0] === vs.nodes[1]) {
      errors.push(
        `Voltage source "${vs.id}" has both terminals on node ${vs.nodes[0]} (short to itself, degenerate).`
      );
    }
  }

  const pairGroups = new Map<string, { id: string; normalizedValue: number }[]>();
  for (const vs of vsources) {
    if (vs.nodes[0] === vs.nodes[1]) continue;
    const [a, b] = vs.nodes;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const normalizedValue = a < b ? vs.value : -vs.value;
    const group = pairGroups.get(key) ?? [];
    group.push({ id: vs.id, normalizedValue });
    pairGroups.set(key, group);
  }

  for (const [key, group] of pairGroups) {
    if (group.length < 2) continue;
    const [first, ...rest] = group;
    for (const other of rest) {
      if (Math.abs(other.normalizedValue - first.normalizedValue) > VALUE_TOLERANCE) {
        errors.push(
          `Voltage sources "${first.id}" and "${other.id}" are in parallel between nodes ${key.replace('-', ' and ')} with conflicting values — physically unsolvable contradiction.`
        );
      }
    }
  }

  return { errors, warnings };
}
