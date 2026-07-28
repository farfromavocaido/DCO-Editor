export type BlurConfig = {
  /** When false, the layer stays fully off (no backdrop blur / no fade). */
  enabled: boolean;
  /** Blur strength in px (single editor control; maps 1:1 to backdrop-filter). */
  strength: number;
};

export const BG_BLUR_LAYER_ID = 'bg-blur';
export const BG_BLUR_CSS_CLASS = 'bg-blur';

export const isBlurLayer = (layer: Record<string, unknown> | null | undefined) => (
  String(layer?.kind || '') === 'blur'
);

const clampStrength = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(40, Math.max(0, numeric));
};

export const normalizeBlurConfig = (raw: unknown): BlurConfig | null => {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as Record<string, unknown>;
  return {
    enabled: config.enabled !== false,
    strength: clampStrength(config.strength),
  };
};

export const validateBlurConfig = (raw: unknown, layerId: string): BlurConfig => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Blur layer ${layerId} requires a blur config`);
  }
  const config = raw as Record<string, unknown>;
  if (typeof config.enabled !== 'boolean') {
    throw new Error(`Blur layer ${layerId} enabled must be a boolean`);
  }
  const strength = Number(config.strength);
  if (!Number.isFinite(strength) || strength < 0 || strength > 40) {
    throw new Error(`Blur layer ${layerId} strength must be 0–40`);
  }
  return { enabled: config.enabled, strength };
};

export const blurIsActive = (raw: unknown) => {
  const config = normalizeBlurConfig(raw);
  return Boolean(config?.enabled && config.strength > 0);
};

export const blurBackdropFilter = (raw: unknown) => {
  const config = normalizeBlurConfig(raw);
  if (!config?.enabled || config.strength <= 0) return 'none';
  return `blur(${config.strength}px)`;
};

/** Profile-specific fade: in with roundel (frames-4) or CTA (frames-3); out with blue wave. */
export const buildBgBlurClips = (ctaStartBeat = 'cta_in') => ([
  {
    id: 'bg-blur-fade-frames-4',
    label: 'Background blur fade (roundel)',
    preset: 'fade',
    start: 'roundel_in',
    end: 'end',
    profiles: ['frames-4'],
    params: {
      enter_duration_pct: 2,
      fade_pct: 2,
    },
  },
  {
    id: 'bg-blur-fade-frames-3',
    label: 'Background blur fade (CTA)',
    preset: 'fade',
    start: ctaStartBeat,
    end: 'end',
    profiles: ['frames-3'],
    params: {
      enter_duration_pct: 2,
      fade_pct: 2,
    },
  },
]);

export const buildBgBlurLayer = (
  canvas: { width: number; height: number },
  options: { ctaStartBeat?: string } = {},
) => ({
  id: BG_BLUR_LAYER_ID,
  label: 'Background blur',
  group: 'Waves / background',
  kind: 'blur',
  zIndex: 1,
  base: {
    left: 0,
    top: 0,
    width: canvas.width,
    height: canvas.height,
    cssClass: BG_BLUR_CSS_CLASS,
    visibility: 'hidden',
  },
  blur: {
    enabled: true,
    strength: 3,
  } satisfies BlurConfig,
  clips: buildBgBlurClips(options.ctaStartBeat || 'cta_in'),
});

export const bgBlurVisibilityRule = () => ({
  id: 'offers-0|bg-blur|visibility',
  scope: 'offers-0',
  layerId: BG_BLUR_LAYER_ID,
  cssClass: BG_BLUR_CSS_CLASS,
  when: { offer_count_num: 0 },
  props: { visibility: 'visible' },
  editable: true,
});
