// Evaluates a source's instantaneous value at time t for transient analysis.
// Pure math, no state: the transient loop calls this once per source per
// timestep and stamps the returned value like a constant source.

import type { Component, SourceWaveform } from './types';

export function waveformValueAt(waveform: SourceWaveform, t: number): number {
  switch (waveform.kind) {
    case 'sine':
      return (
        waveform.offset +
        waveform.amplitude * Math.sin(2 * Math.PI * waveform.frequency * t + (waveform.phaseDeg * Math.PI) / 180)
      );
    case 'pulse': {
      const { v1, v2, delay, rise, fall, width, period } = waveform;
      if (t < delay) return v1;
      // Guard a non-positive period (validated upstream, but never divide by 0).
      const tp = period > 0 ? (t - delay) % period : t - delay;
      if (tp < rise) {
        // rise === 0 can't reach here (tp < 0 is impossible), so the ramp is safe.
        return v1 + ((v2 - v1) * tp) / rise;
      }
      if (tp < rise + width) return v2;
      if (tp < rise + width + fall) {
        return v2 - ((v2 - v1) * (tp - rise - width)) / fall;
      }
      return v1;
    }
  }
}

/** The value an independent source drives at time t (its DC value when no waveform is set). */
export function sourceValueAt(comp: Component, t: number): number {
  if (!comp.waveform) return comp.value;
  return waveformValueAt(comp.waveform, t);
}
