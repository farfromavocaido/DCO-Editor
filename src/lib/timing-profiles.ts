// @ts-nocheck

export const FOUR_ACT_BEATS = {
  start: 0,
  act1_begin: 6,
  act1_in: 8,
  offer2_in: 11,
  offer3_in: 14,
  plus1_in: 16,
  plus2_in: 19,
  terms_in: 16,
  act2_in: 33.3,
  act1_out: 34.3,
  wave2_in: 54.7,
  swap: 56.7,
  roundel_in: 56.7,
  offers_exit: 57.7,
  cta_in: 80,
  cta_pulse_start: 91,
  cta_pulse_peak: 93,
  cta_pulse_end: 94,
  act3_exit: 96,
  end: 100,
};

export const activeFrameScope = (activeScopes: string[] = []) => (
  activeScopes.includes('frames-4') ? 'frames-4' : 'frames-3'
);

export const beatsForFrameScope = (
  document: Record<string, unknown> | null,
  frameScope = 'frames-3',
) => {
  const clock = document?.clock || {};
  const base = clock.beats || {};
  const profile = clock.profiles?.[frameScope];
  const beats = frameScope === 'frames-4'
    ? { ...base, ...FOUR_ACT_BEATS, ...(profile || {}) }
    : { ...base, ...(profile || {}) };
  return {
    ...beats,
    roundel_in: beats.roundel_in ?? beats.swap ?? 0,
  };
};

export const beatsForScopes = (
  document: Record<string, unknown> | null,
  activeScopes: string[] = [],
) => beatsForFrameScope(document, activeFrameScope(activeScopes));
