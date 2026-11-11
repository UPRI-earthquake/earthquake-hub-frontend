import { toFiniteNumber } from "@/shared/utils/earthquakeFormat";


export function formatCoordinatePart(value: number | string, positiveLabel: string, negativeLabel: string) {
  const num = toFiniteNumber(value);
  if (num == null) return '—';
  return `${Math.abs(num).toFixed(3)}°${num >= 0 ? positiveLabel : negativeLabel}`;
}