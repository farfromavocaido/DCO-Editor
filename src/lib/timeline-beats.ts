// @ts-nocheck
/** Labels are separate from stable timing IDs, keeping existing clip and layout references intact. */
export const beatLabel = (document, id) => document.clock.beatLabels?.[id] || id.replaceAll('_', ' ');
export function renameTimelineBeat(document, id, label) {
  if (!label.trim()) throw new Error('Enter a beat name');
  const next = structuredClone(document);
  next.clock.beatLabels = { ...next.clock.beatLabels, [id]: label.trim() };
  return next;
}
export function addTimelineBeat(document, label, seconds) {
  if (!label.trim()) throw new Error('Enter a beat name');
  const duration = document.clock.durationS;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) throw new Error('Choose a time inside the ad');
  const next = structuredClone(document);
  const used = new Set([...Object.keys(next.clock.beats), ...Object.values(next.clock.profiles || {}).flatMap(p => Object.keys(p))]);
  let n = 1; while (used.has(`custom_beat_${n}`)) n++;
  const id = `custom_beat_${n}`;
  next.clock.beats[id] = seconds / duration * 100;
  next.clock.beatLabels = { ...next.clock.beatLabels, [id]: label.trim() };
  return { document: next, id };
}
