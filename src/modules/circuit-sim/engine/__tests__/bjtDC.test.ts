import { describe, expect, it } from 'vitest';
import { solveDC } from '../dcAnalysis';
import type { Netlist } from '../types';

describe('solveDC — bjt (simplified Ebers-Moll, Newton-Raphson)', () => {
  it('biases a common-emitter amplifier with Ic/Ib close to beta and Vce in the active region', () => {
    // 10V rail -> Rb (100k) -> base; 10V rail -> Rc (100) -> collector;
    // emitter grounded. beta = 100 (default).
    const VCC = 10;
    const Rb = 100_000;
    const Rc = 100;
    const netlist: Netlist = {
      components: [
        { id: 'VCC', type: 'vsource', nodes: [1, 0], value: VCC },
        { id: 'Rb', type: 'resistor', nodes: [1, 2], value: Rb },
        { id: 'Rc', type: 'resistor', nodes: [1, 3], value: Rc },
        { id: 'Q1', type: 'bjt', nodes: [3, 2, 0], value: 0 },
      ],
    };

    const result = solveDC(netlist);
    expect(result.warnings).toBeUndefined();

    // Measure Ib/Ic independently from the resistor voltage drops (not
    // from the engine's own beta*Ib bookkeeping) so this actually checks
    // that the CCCS stamp enforced the relationship in the solved KCL
    // equations, rather than trusting the post-processing formula.
    const Vb = result.nodeVoltages[2];
    const Vc = result.nodeVoltages[3];
    const IbMeasured = (VCC - Vb) / Rb;
    const IcMeasured = (VCC - Vc) / Rc;

    expect(IbMeasured).toBeGreaterThan(0);
    expect(IcMeasured / IbMeasured).toBeCloseTo(100, 0);

    // Base-emitter drop should look like silicon.
    expect(Vb).toBeGreaterThan(0.5);
    expect(Vb).toBeLessThan(0.8);

    // Vce = Vc - Ve, Ve = 0 (grounded emitter). Should be comfortably in
    // forward-active — not saturated (near 0V) and not cut off (near VCC).
    const Vce = Vc - 0;
    expect(Vce).toBeGreaterThan(0.3);
    expect(Vce).toBeLessThan(VCC - 0.1);

    // Reported branch currents (`${id}:ib` / `${id}:ic`) should agree with
    // the independently measured values.
    expect(result.branchCurrents['Q1:ib']).toBeCloseTo(IbMeasured, 6);
    expect(result.branchCurrents['Q1:ic']).toBeCloseTo(IcMeasured, 3);
  });

  it('honors a custom beta parameter', () => {
    const VCC = 10;
    const Rb = 200_000;
    const Rc = 220;
    const netlist: Netlist = {
      components: [
        { id: 'VCC', type: 'vsource', nodes: [1, 0], value: VCC },
        { id: 'Rb', type: 'resistor', nodes: [1, 2], value: Rb },
        { id: 'Rc', type: 'resistor', nodes: [1, 3], value: Rc },
        { id: 'Q1', type: 'bjt', nodes: [3, 2, 0], value: 0, params: { beta: 50 } },
      ],
    };

    const result = solveDC(netlist);
    expect(result.warnings).toBeUndefined();

    const Vb = result.nodeVoltages[2];
    const Vc = result.nodeVoltages[3];
    const IbMeasured = (VCC - Vb) / Rb;
    const IcMeasured = (VCC - Vc) / Rc;

    expect(IcMeasured / IbMeasured).toBeCloseTo(50, 0);
  });

  it('sits near cutoff (negligible Ic) when the base is left unbiased at 0V', () => {
    const netlist: Netlist = {
      components: [
        { id: 'VCC', type: 'vsource', nodes: [1, 0], value: 10 },
        { id: 'Rc', type: 'resistor', nodes: [1, 3], value: 1000 },
        // Base tied directly to ground: Vbe = 0, junction off.
        { id: 'Rb', type: 'resistor', nodes: [2, 0], value: 100_000 },
        { id: 'Q1', type: 'bjt', nodes: [3, 2, 0], value: 0 },
      ],
    };

    const result = solveDC(netlist);
    expect(result.warnings).toBeUndefined();

    // Collector should sit near the rail (no current pulled through Rc).
    expect(result.nodeVoltages[3]).toBeGreaterThan(9.9);
    expect(Math.abs(result.branchCurrents['Q1:ic'])).toBeLessThan(1e-6);
  });
});
