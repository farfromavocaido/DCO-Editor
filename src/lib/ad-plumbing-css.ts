/**
 * Group chrome that is not per-layer type or box.
 * Type defaults live on classRules / layer bases so editor writes own the paint.
 */
export const adPlumbingCss = `
    [data-gwd-group="OfferSlot"] {
      width: 100%;
      height: 100%;
    }

    [data-gwd-group="OfferSlot"] .gwd-grp-offer {
      position: absolute;
      visibility: inherit;
    }

    .tc-prices-group,
    .tc-solo-group {
      position: absolute;
    }
`.trim();
