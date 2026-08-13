/** CSS animation shorthand shared by HTML export and headline skip overrides. */

export const clockLoops = (clock?: { loop?: unknown } | null) => clock?.loop === true;

export const layerAnimationShorthand = (
  durationS: number,
  name: string,
  { loop = false, important = false }: { loop?: boolean; important?: boolean } = {},
) => {
  const duration = Number(durationS) || 15;
  const iteration = loop ? 'infinite' : 1;
  const value = `${duration}s linear 0s ${iteration} normal forwards running ${name}`;
  return important ? `${value} !important` : value;
};
