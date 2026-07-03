import { GRID } from '../types'
import type { Point, Rotation } from '../types'

export function snap(v: number, grid = GRID): number {
  return Math.round(v / grid) * grid
}

export function snapPoint(p: Point, grid = GRID): Point {
  return { x: snap(p.x, grid), y: snap(p.y, grid) }
}

/** Canonical string key for a grid-snapped point — exact match, no epsilon. */
export function pointKey(p: Point): string {
  return `${Math.round(p.x)},${Math.round(p.y)}`
}

export function pointsEqual(a: Point, b: Point): boolean {
  return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y)
}

/** Rotate a local pin offset by the component rotation. */
export function rotateOffset(offset: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 0: return { x: offset.x, y: offset.y }
    case 90: return { x: -offset.y, y: offset.x }
    case 180: return { x: -offset.x, y: -offset.y }
    case 270: return { x: offset.y, y: -offset.x }
  }
}

/** World position of a pin given component position/rotation and the pin's local offset. */
export function pinWorldPosition(componentPos: Point, rotation: Rotation, pinOffset: Point): Point {
  const r = rotateOffset(pinOffset, rotation)
  return { x: componentPos.x + r.x, y: componentPos.y + r.y }
}

/**
 * True when point p lies ON the closed segment a→b, which must be axis-aligned
 * (all schematic wires are orthogonal). Includes the endpoints.
 */
export function pointOnOrthoSegment(p: Point, a: Point, b: Point): boolean {
  const px = Math.round(p.x), py = Math.round(p.y)
  const ax = Math.round(a.x), ay = Math.round(a.y)
  const bx = Math.round(b.x), by = Math.round(b.y)
  if (ax === bx) {
    return px === ax && py >= Math.min(ay, by) && py <= Math.max(ay, by)
  }
  if (ay === by) {
    return py === ay && px >= Math.min(ax, bx) && px <= Math.max(ax, bx)
  }
  // Non-orthogonal segment: fall back to endpoint equality only.
  return (px === ax && py === ay) || (px === bx && py === by)
}

/** True when p is strictly inside segment a→b (not one of its endpoints). */
export function pointInteriorToOrthoSegment(p: Point, a: Point, b: Point): boolean {
  return pointOnOrthoSegment(p, a, b) && !pointsEqual(p, a) && !pointsEqual(p, b)
}

/**
 * Orthogonal L-route from `from` toward `to`: corner placed so the longer axis
 * runs first. Returns intermediate corner + endpoint (or just endpoint when the
 * points are already axis-aligned).
 */
export function orthoRoute(from: Point, to: Point): Point[] {
  if (pointsEqual(from, to)) return []
  if (Math.round(from.x) === Math.round(to.x) || Math.round(from.y) === Math.round(to.y)) {
    return [to]
  }
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const corner: Point = dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
  return [corner, to]
}

/**
 * Clean up a polyline: drop consecutive duplicates and merge collinear runs.
 * Keeps the wire's electrical shape identical while minimizing vertices.
 */
export function normalizePolyline(points: Point[]): Point[] {
  const deduped: Point[] = []
  for (const p of points) {
    const prev = deduped[deduped.length - 1]
    if (!prev || !pointsEqual(prev, p)) deduped.push({ x: Math.round(p.x), y: Math.round(p.y) })
  }
  if (deduped.length < 3) return deduped
  const out: Point[] = [deduped[0]]
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = out[out.length - 1]
    const b = deduped[i]
    const c = deduped[i + 1]
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
    if (!collinear) out.push(b)
  }
  out.push(deduped[deduped.length - 1])
  return out
}

/** Shortest distance from p to the axis-aligned segment a→b (for hit-testing wires). */
export function distToOrthoSegment(p: Point, a: Point, b: Point): number {
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y)
  const cx = Math.max(minX, Math.min(p.x, maxX))
  const cy = Math.max(minY, Math.min(p.y, maxY))
  return Math.hypot(p.x - cx, p.y - cy)
}
