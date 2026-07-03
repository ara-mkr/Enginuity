import type { DiodeParams, MOSFETParams } from './types';

const DEFAULT_IS = 1e-14;
const DEFAULT_VT = 0.026;
const DEFAULT_N = 1;

/** Default forward current gain (Ic/Ib) for a bjt when params.beta is omitted. */
export const DEFAULT_BETA = 100;

const DEFAULT_K = 0.001;
const DEFAULT_VTH = 1;
const DEFAULT_LAMBDA = 0.01;

/**
 * Practical clamp on the linearization point for the diode's exponential.
 * Without this, a bad Newton-Raphson guess (e.g. an early iteration
 * overshooting to several volts forward) makes e^(V/Vt) overflow to
 * Infinity/NaN and the solver diverges. Clamping the point at which we
 * linearize — not the actual solved node voltages — keeps every iteration
 * numerically finite while still letting the solution converge to the
 * true (unclamped) operating point once V_guess settles near it.
 */
const MAX_LINEARIZATION_VOLTAGE = 0.8;

export interface CompanionModel {
  g_eq: number;
  I_eq: number;
}

/**
 * Linearizes the Shockley diode equation I = Is * (e^(V/(n*Vt)) - 1)
 * around V_guess into an equivalent conductance + current source, per one
 * step of Newton-Raphson.
 */
export function diodeCompanionModel(V_guess: number, params?: DiodeParams): CompanionModel {
  const Is = params?.Is ?? DEFAULT_IS;
  const Vt = params?.Vt ?? DEFAULT_VT;
  const n = params?.n ?? DEFAULT_N;
  const nVt = n * Vt;

  const V = Math.min(V_guess, MAX_LINEARIZATION_VOLTAGE);
  const expTerm = Math.exp(V / nVt);

  const g_eq = (Is / nVt) * expTerm;
  const I_eq = Is * (expTerm - 1) - g_eq * V;

  return { g_eq, I_eq };
}

export interface MOSFETCompanionModel {
  /** Drain current (A) at the linearization point (Vgs_guess, Vds_guess). */
  Id: number;
  /** dId/dVgs at the linearization point. */
  gm: number;
  /** dId/dVds at the linearization point. */
  gds: number;
}

/**
 * Evaluates the NMOS square-law model (cutoff / triode / saturation) and its
 * partial derivatives at one Newton-Raphson iteration's voltage guesses, for
 * linearization into a gm + gds + Ieq companion model (same role as
 * diodeCompanionModel, but a function of two voltages instead of one).
 */
export function mosfetCompanionModel(
  Vgs_guess: number,
  Vds_guess: number,
  params?: MOSFETParams
): MOSFETCompanionModel {
  const k = params?.k ?? DEFAULT_K;
  const Vth = params?.Vth ?? DEFAULT_VTH;
  const lambda = params?.lambda ?? DEFAULT_LAMBDA;

  const Vov = Vgs_guess - Vth;

  if (Vov <= 0) {
    // Cutoff: no channel, so no current and no dependence on either
    // terminal voltage.
    return { Id: 0, gm: 0, gds: 0 };
  }

  if (Vds_guess >= Vov) {
    // Saturation.
    const Id = (k / 2) * Vov * Vov * (1 + lambda * Vds_guess);
    const gm = k * Vov * (1 + lambda * Vds_guess);
    const gds = (k / 2) * Vov * Vov * lambda;
    return { Id, gm, gds };
  }

  // Triode/linear.
  const Id = k * (Vov * Vds_guess - (Vds_guess * Vds_guess) / 2);
  const gm = k * Vds_guess;
  const gds = k * (Vov - Vds_guess);
  return { Id, gm, gds };
}
