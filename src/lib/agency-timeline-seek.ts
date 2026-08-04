/**
 * Seek + pause the agency CSS timeline (same technique as qa:dco capture).
 * Shared by Playwright capture and the /qa iframe bridge.
 */

/** Pause every CSS animation under root and jump to timeMs. Returns animation count. */
export const seekAgencyTimeline = (
  root: Element | null | undefined,
  timeMs: number,
): number => {
  if (!root) return 0;
  const t = Number(timeMs) || 0;
  if (!root.classList.contains('motion-ready')) {
    root.classList.add('motion-ready');
  }
  const getAnimations = (root as Element & {
    getAnimations?: (opts?: { subtree?: boolean }) => Animation[];
  }).getAnimations;
  if (typeof getAnimations !== 'function') return 0;
  const animations = getAnimations.call(root, { subtree: true });
  for (const anim of animations) {
    try {
      anim.pause();
      anim.currentTime = t;
    } catch {
      // ignore animations that reject seeking
    }
  }
  return animations.length;
};

/**
 * ES5 source for Playwright `page.evaluate` / iframe Function ctor.
 * Expects `timeMs` and looks up `#page-content`.
 */
export const agencyTimelineSeekEvaluateSource = (timeMs: number) => (
  `(() => {
    var t = ${Number(timeMs)};
    var root = document.getElementById('page-content');
    if (!root) return 0;
    if (!root.classList.contains('motion-ready')) {
      root.classList.add('motion-ready');
    }
    var animations = root.getAnimations ? root.getAnimations({ subtree: true }) : [];
    for (var i = 0; i < animations.length; i += 1) {
      try {
        animations[i].pause();
        animations[i].currentTime = t;
      } catch (e) {}
    }
    return animations.length;
  })()`
);
