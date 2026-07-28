export type GradientDirection = 'to-bottom' | 'to-right';

export type GradientConfig = {
  direction: GradientDirection;
  endPct: number;
  startOpacity: number;
  midpoint: number;
};

export const HEADLINE_SCRIM_LAYER_ID = 'headline-scrim';
export const HEADLINE_SCRIM_CSS_CLASS = 'headline-scrim';

export const GRADIENT_DIRECTIONS = ['to-bottom', 'to-right'] as const;

export const isGradientLayer = (layer: Record<string, unknown> | null | undefined) => (
  String(layer?.kind || '') === 'gradient'
);

export const cssGradientDirection = (direction: GradientDirection | string) => (
  direction === 'to-right' ? 'to right' : 'to bottom'
);

const clampNumber = (value: unknown, min: number, max: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
};

/** Mid-stop position as a percent of the canvas axis (endPct × midpoint). */
export const gradientMidStopPct = (endPct: number, midpoint: number) => (
  Number((clampNumber(endPct, 0, 100) * clampNumber(midpoint, 0, 1)).toFixed(4))
);

export const normalizeGradientConfig = (raw: unknown): GradientConfig | null => {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as Record<string, unknown>;
  const direction = String(config.direction || '');
  if (!GRADIENT_DIRECTIONS.includes(direction as GradientDirection)) return null;
  return {
    direction: direction as GradientDirection,
    endPct: clampNumber(config.endPct, 0, 100),
    startOpacity: clampNumber(config.startOpacity, 0, 1),
    midpoint: clampNumber(config.midpoint, 0, 1),
  };
};

export const validateGradientConfig = (raw: unknown, layerId: string) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Gradient layer ${layerId} requires a gradient config`);
  }
  const config = raw as Record<string, unknown>;
  const direction = String(config.direction || '');
  if (!GRADIENT_DIRECTIONS.includes(direction as GradientDirection)) {
    throw new Error(`Gradient layer ${layerId} has invalid direction`);
  }
  const endPct = Number(config.endPct);
  const startOpacity = Number(config.startOpacity);
  const midpoint = Number(config.midpoint);
  if (!Number.isFinite(endPct) || endPct < 0 || endPct > 100) {
    throw new Error(`Gradient layer ${layerId} endPct must be 0–100`);
  }
  if (!Number.isFinite(startOpacity) || startOpacity < 0 || startOpacity > 1) {
    throw new Error(`Gradient layer ${layerId} startOpacity must be 0–1`);
  }
  if (!Number.isFinite(midpoint) || midpoint < 0 || midpoint > 1) {
    throw new Error(`Gradient layer ${layerId} midpoint must be 0–1`);
  }
  return {
    direction: direction as GradientDirection,
    endPct,
    startOpacity,
    midpoint,
  } satisfies GradientConfig;
};

export const gradientBackgroundImage = (raw: GradientConfig | Record<string, unknown>) => {
  const config = normalizeGradientConfig(raw);
  if (!config) return '';
  const midPct = gradientMidStopPct(config.endPct, config.midpoint);
  const midOpacity = Number((config.startOpacity / 2).toFixed(6));
  return [
    `linear-gradient(${cssGradientDirection(config.direction)},`,
    `rgba(0, 0, 0, ${config.startOpacity}) 0%,`,
    `rgba(0, 0, 0, ${midOpacity}) ${midPct}%,`,
    `rgba(0, 0, 0, 0) ${config.endPct}%)`,
  ].join(' ');
};

/** Defaults for the offers-0 headline scrim by size. */
export const headlineScrimDefaultsForSize = (size: string): GradientConfig => {
  if (size === '300x250' || size === '160x600' || size === '300x600') {
    return {
      direction: 'to-bottom',
      endPct: 25,
      startOpacity: 0.15,
      midpoint: 0.5,
    };
  }
  return {
    direction: 'to-right',
    endPct: 30,
    startOpacity: 0.15,
    midpoint: 0.5,
  };
};

export const buildHeadlineScrimLayer = (
  size: string,
  canvas: { width: number; height: number },
) => {
  const gradient = headlineScrimDefaultsForSize(size);
  return {
    id: HEADLINE_SCRIM_LAYER_ID,
    label: 'Headline scrim',
    group: 'Waves / background',
    kind: 'gradient',
    zIndex: 1,
    base: {
      left: 0,
      top: 0,
      width: canvas.width,
      height: canvas.height,
      cssClass: HEADLINE_SCRIM_CSS_CLASS,
      visibility: 'hidden',
    },
    gradient,
    clips: [],
  };
};

export const headlineScrimVisibilityRule = () => ({
  id: 'offers-0|headline-scrim|visibility',
  scope: 'offers-0',
  layerId: HEADLINE_SCRIM_LAYER_ID,
  cssClass: HEADLINE_SCRIM_CSS_CLASS,
  when: { offer_count_num: 0 },
  props: { visibility: 'visible' },
  editable: true,
});
