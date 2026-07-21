/**
 * Brand typeface: Museo (slab) — Museo700-Regular.otf.
 * Never alias this family to Museo Sans (different widths; breaks text-fit).
 *
 * Live editor, /view renders, and Studio CDN packages all load the Studio CDN
 * file so measurement, preview, and serve share one glyph set. Offline client
 * ZIPs still package the OTF from campaign/assets/fonts.
 */

export const MUSEO_FONT_FILENAME = 'Museo700-Regular.otf';

/** Studio-hosted Museo slab — the single source for live preview + CDN exports. */
export const MUSEO_CDN_URL =
  'https://s0.2mdn.net/creatives/assets/5627648/Museo700-Regular.otf';

export const CDN_FONT_URLS: Record<string, string> = {
  [MUSEO_FONT_FILENAME]: MUSEO_CDN_URL,
};

/** @font-face block; local("☺") blocks installed fonts from masking the CDN file. */
export const museoFontFaceCss = (url: string = MUSEO_CDN_URL) => `@font-face {
  font-family: "Museo";
  src: local("☺"), url("${url}") format("opentype");
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}`;

export const museoFontPreloadTag = (url: string = MUSEO_CDN_URL) => (
  `<link rel="preload" href="${url}" as="font" type="font/otf" crossorigin>`
);
