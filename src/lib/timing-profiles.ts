// @ts-nocheck

/** Headline act 4 entry when the offer roundel frame is off (frames-3). */
export const FRAMES_3_ACT4_IN_OFFSET_FROM_SWAP = 0.1;

export const frames3Act4In = (swap = 65) => Number((swap + FRAMES_3_ACT4_IN_OFFSET_FROM_SWAP).toFixed(1));

export const FOUR_ACT_BEATS = {
  start: 0,
  act1_begin: 6,
  // ~75–90% through greenwave enter (start+7 / act1_begin + sweep 6–7).
  act1_in: 12.5,
  offer1_in: 16.7,
  offer2_in: 17.8,
  offer3_in: 18.9,
  plus1_in: 19.1,
  plus2_in: 19.1,
  terms_in: 19.1,
  act2_in: 32.5,
  act1_out: 32.5,
  act2_out: 45,
  act3_in: 45,
  act3_out: 55,
  wave2_in: 54.7,
  swap: 56.7,
  roundel_in: 56.7,
  offers_exit: 57.7,
  cta_in: 80,
  act4_in: 80,
  tc_exit: 80,
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
