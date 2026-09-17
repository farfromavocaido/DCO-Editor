// Suites which launch Chromium directly or request a browser-backed outline.
// Keep the default suite comprehensive; these lists only enable focused runs.
export const browserTests = [
 'src/lib/offer-arrangement.test.ts',
 'src/lib/offer-layout-history.test.ts',
 'src/lib/text-fit-policy.test.ts',
 'src/server/__tests__/api.test.ts',
 'src/server/__tests__/campaign-runtime.test.ts',
 'src/server/__tests__/creative-exporter.test.ts',
 'src/server/__tests__/motion-layout.test.ts',
 'src/server/__tests__/outline-headline-motion.test.ts',
 'src/server/__tests__/production-snapshot.test.ts',
 'src/server/__tests__/render-creative-preview.test.ts',
 'src/server/__tests__/responsive-layout.test.ts',
 'src/server/__tests__/runtime-background.test.ts',
 'src/server/__tests__/text-outline.test.ts',
];
export const exclusions=['**/*.creative.test.ts','**/node_modules/**','**/.worktrees/**'];
