import type { Complex } from './complex';
import { divide, multiply, subtract } from './complex';

export class Matrix {
  readonly size: number;
  private data: number[][];

  constructor(size: number) {
    this.size = size;
    this.data = Array.from({ length: size }, () => new Array(size).fill(0));
  }

  get(row: number, col: number): number {
    return this.data[row][col];
  }

  set(row: number, col: number, value: number): void {
    this.data[row][col] = value;
  }

  addTo(row: number, col: number, value: number): void {
    this.data[row][col] += value;
  }

  toArray(): number[][] {
    return this.data;
  }
}

/**
 * Solves A x = z via Gaussian elimination with partial pivoting.
 * Without partial pivoting, near-zero pivots (e.g. from small resistor
 * values or certain topologies) produce silently wrong results.
 */
export function solve(A: number[][], z: number[]): number[] {
  const n = z.length;
  const PIVOT_TOLERANCE = 1e-12;

  // Work on copies so callers' inputs are untouched.
  const M = A.map((row) => [...row]);
  const b = [...z];

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const abs = Math.abs(M[row][col]);
      if (abs > maxAbs) {
        maxAbs = abs;
        pivotRow = row;
      }
    }

    if (maxAbs < PIVOT_TOLERANCE) {
      throw new Error(
        `Singular matrix: no pivot found for column ${col} (max magnitude ${maxAbs.toExponential(3)} below tolerance ${PIVOT_TOLERANCE}). The circuit as described has no unique solution.`
      );
    }

    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      if (factor === 0) continue;
      for (let j = col; j < n; j++) {
        M[row][j] -= factor * M[col][j];
      }
      b[row] -= factor * b[col];
    }
  }

  // Back substitution.
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let col = row + 1; col < n; col++) {
      sum -= M[row][col] * x[col];
    }
    x[row] = sum / M[row][row];
  }

  return x;
}

export class ComplexMatrix {
  readonly size: number;
  private data: Complex[][];

  constructor(size: number) {
    this.size = size;
    this.data = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ re: 0, im: 0 }))
    );
  }

  get(row: number, col: number): Complex {
    return this.data[row][col];
  }

  set(row: number, col: number, value: Complex): void {
    this.data[row][col] = value;
  }

  addTo(row: number, col: number, value: Complex): void {
    this.data[row][col] = { re: this.data[row][col].re + value.re, im: this.data[row][col].im + value.im };
  }

  toArray(): Complex[][] {
    return this.data;
  }
}

/**
 * Complex-valued counterpart to solve() — identical Gaussian elimination
 * with partial pivoting, but every arithmetic op goes through the Complex
 * helpers. Duplicated rather than shared via a generic numeric-type
 * abstraction: a solver this size doesn't earn the abstraction, and having
 * two plain, readable implementations is easier to verify than one clever
 * one.
 */
export function solveComplex(A: Complex[][], z: Complex[]): Complex[] {
  const n = z.length;
  const PIVOT_TOLERANCE = 1e-12;
  const cAbs = (c: Complex) => Math.sqrt(c.re * c.re + c.im * c.im);

  const M = A.map((row) => row.map((c) => ({ ...c })));
  const b = z.map((c) => ({ ...c }));

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = cAbs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const abs = cAbs(M[row][col]);
      if (abs > maxAbs) {
        maxAbs = abs;
        pivotRow = row;
      }
    }

    if (maxAbs < PIVOT_TOLERANCE) {
      throw new Error(
        `Singular matrix: no pivot found for column ${col} (max magnitude ${maxAbs.toExponential(3)} below tolerance ${PIVOT_TOLERANCE}). The circuit as described has no unique solution.`
      );
    }

    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }

    for (let row = col + 1; row < n; row++) {
      const factor = divide(M[row][col], M[col][col]);
      if (factor.re === 0 && factor.im === 0) continue;
      for (let j = col; j < n; j++) {
        M[row][j] = subtract(M[row][j], multiply(factor, M[col][j]));
      }
      b[row] = subtract(b[row], multiply(factor, b[col]));
    }
  }

  const x: Complex[] = new Array(n).fill(null).map(() => ({ re: 0, im: 0 }));
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let col = row + 1; col < n; col++) {
      sum = subtract(sum, multiply(M[row][col], x[col]));
    }
    x[row] = divide(sum, M[row][row]);
  }

  return x;
}
