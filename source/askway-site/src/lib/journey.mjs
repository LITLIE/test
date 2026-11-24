/** @param {number} progress */
export function stepFromProgress(progress) {
  return Math.min(3, Math.floor(Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * 4));
}
