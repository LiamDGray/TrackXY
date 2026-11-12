/**
 * Orientation of a planar marker.
 *
 * A marker on the circumference is tracked as a *point*, so rotation is
 * inferred from a chord projection and the angle is never measured. A marker on
 * the axis, viewed from above, rotates in place: its orientation is observable
 * directly, the feature never leaves the field of view, and nothing is
 * foreshortened.
 *
 * These helpers turn a set of marker pixels into an angle. They are
 * direction-ambiguous by π unless the marker is asymmetric (a fiducial, an
 * L-shape, or a dot offset from the centroid) — the `signed` variant takes a
 * reference point to resolve it.
 */

export function centroid(points) {
  if (points.length === 0) throw new Error('need at least one point')
  let cx = 0
  let cy = 0
  for (const [x, y] of points) {
    cx += x
    cy += y
  }
  return [cx / points.length, cy / points.length]
}

/** Principal axis of the point set, in radians, wrapped to (−π/2, π/2]. */
export function principalAngle(points) {
  if (points.length < 3) throw new Error('need at least three points to define an axis')
  const [cx, cy] = centroid(points)
  let m20 = 0
  let m02 = 0
  let m11 = 0
  for (const [x, y] of points) {
    const dx = x - cx
    const dy = y - cy
    m20 += dx * dx
    m02 += dy * dy
    m11 += dx * dy
  }
  const angle = 0.5 * Math.atan2(2 * m11, m20 - m02)
  return wrapHalfTurn(angle)
}

export function wrapHalfTurn(angle) {
  let value = angle
  const half = Math.PI / 2
  while (value > half) value -= Math.PI
  while (value <= -half) value += Math.PI
  return value
}

export function wrapFullTurn(angle) {
  let value = angle
  while (value > Math.PI) value -= 2 * Math.PI
  while (value < -Math.PI) value += 2 * Math.PI
  return value
}

/**
 * Unwrap a sequence of half-turn-ambiguous angles into a continuous track.
 * Steps larger than a quarter turn are treated as the π-wrapped neighbour.
 */
export function unwrapAngles(angles) {
  if (angles.length === 0) return []
  const out = [wrapHalfTurn(angles[0])]
  for (let i = 1; i < angles.length; i += 1) {
    let current = angles[i]
    let delta = current - out[i - 1]
    while (delta > Math.PI / 2) {
      current -= Math.PI
      delta = current - out[i - 1]
    }
    while (delta < -Math.PI / 2) {
      current += Math.PI
      delta = current - out[i - 1]
    }
    out.push(current)
  }
  return out
}

/** Angle of the vector from `origin` to `reference`, in radians. */
export function angleFromPair(origin, reference) {
  return Math.atan2(reference[1] - origin[1], reference[0] - origin[0])
}

/** Signed orientation for an asymmetric marker: a body axis plus a reference dot. */
export function signedAngle(points, reference) {
  const axis = principalAngle(points)
  const [cx, cy] = centroid(points)
  const angle = angleFromPair([cx, cy], reference)
  // Choose the body-axis direction (axis or axis+π) closest to the reference.
  const candidate = wrapFullTurn(axis)
  const delta = Math.abs(wrapFullTurn(angle - candidate))
  return delta <= Math.PI / 2 ? candidate : wrapFullTurn(candidate + Math.PI)
}

/** Least-squares angular rate (rad/s) over (time, angle) samples. */
export function angularRate(times, angles) {
  if (times.length !== angles.length) throw new Error('time and angle lengths differ')
  if (times.length < 3) throw new Error('need at least three samples')
  const unwrapped = unwrapAngles(angles)
  const n = times.length
  const meanT = times.reduce((a, b) => a + b, 0) / n
  const meanA = unwrapped.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    num += (times[i] - meanT) * (unwrapped[i] - meanA)
    den += (times[i] - meanT) ** 2
  }
  if (den === 0) throw new Error('degenerate time base')
  return { rate: num / den, meanAngle: meanA, unwrapped }
}
