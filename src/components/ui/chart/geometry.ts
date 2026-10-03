/** A finite sum, including values close to the numeric limits. */
export const finiteSum = (a: number, b: number) =>
  Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, a + b));

/** A sector, or an annular sector, starting at the top of the circle. */
export function sectorPath(
  cx: number,
  cy: number,
  radius: number,
  inner: number,
  start: number,
  fraction: number,
) {
  const point = (r: number, angle: number) =>
    `${cx + r * Math.sin(angle)},${cy - r * Math.cos(angle)}`;
  const end = start + Math.min(1, fraction) * Math.PI * 2;
  if (fraction >= 1 - 1e-12) {
    const circle = `M${point(radius, 0)} A${radius},${radius} 0 1 1 ${point(radius, Math.PI)} A${radius},${radius} 0 1 1 ${point(radius, 0)} Z`;
    return inner
      ? `${circle} M${point(inner, 0)} A${inner},${inner} 0 1 0 ${point(inner, Math.PI)} A${inner},${inner} 0 1 0 ${point(inner, 0)} Z`
      : circle;
  }
  const large = fraction > 0.5 ? 1 : 0;
  return inner
    ? `M${point(radius, start)} A${radius},${radius} 0 ${large} 1 ${point(radius, end)} L${point(inner, end)} A${inner},${inner} 0 ${large} 0 ${point(inner, start)} Z`
    : `M${cx},${cy} L${point(radius, start)} A${radius},${radius} 0 ${large} 1 ${point(radius, end)} Z`;
}
