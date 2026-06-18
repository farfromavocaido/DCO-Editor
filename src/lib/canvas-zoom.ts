// @ts-nocheck
export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export const zoomScale = (zoom: 'auto' | number, autoScale: number) => (
  zoom === 'auto' ? autoScale : zoom
);

export const nextZoomLevel = (zoom: 'auto' | number, direction: -1 | 1) => {
  const current = zoom === 'auto' ? 1 : Number(zoom);
  const fallbackIndex = ZOOM_LEVELS.findIndex((level) => level >= current);
  const index = fallbackIndex < 0 ? ZOOM_LEVELS.length - 1 : fallbackIndex;
  const nextIndex = direction > 0
    ? Math.min(ZOOM_LEVELS.length - 1, current >= ZOOM_LEVELS[index] ? index + 1 : index)
    : Math.max(0, current <= ZOOM_LEVELS[index] ? index - 1 : index);
  return ZOOM_LEVELS[nextIndex];
};

export const zoomLabel = (zoom: 'auto' | number) => {
  if (zoom === 'auto') return 'Auto';
  if (zoom === 1) return '1x';
  if (zoom === 2) return '2x';
  return `${Math.round(Number(zoom) * 100)}%`;
};
