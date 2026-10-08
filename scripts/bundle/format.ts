/**
 * Kilobytes to one decimal, cut rather than rounded so that a size just under
 * a label never reads as the label itself.
 */
export function formatKilobytes(bytes: number): string {
  return `${(Math.floor((bytes * 10) / 1024) / 10).toFixed(1)} KB`;
}
