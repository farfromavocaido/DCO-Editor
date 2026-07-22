// Derive edit/layout box height from fit.maxLines when height is unset, so the
// selection frame and CSS height match the line budget. Explicit authored
// height always wins. Vertical alignment keeps the visual anchor when growing:
//   flex-start / top  → grow down (top unchanged)
//   flex-end / bottom → grow up (top moves up)
//   center            → grow both ways

const numberValue = (value: unknown, fallback = NaN) => {
  // Empty string must not become 0 — Number("") === 0 and that made flex-end
  // + maxLines treat "unset height" as a zero box and yank top up by the full budget.
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Authored box height: empty / non-positive → unset (use line-box fallback). */
export const authoredHeightPx = (value: unknown, fallback = NaN) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Line box height in px from authored fontSize + lineHeight (ratio or px). */
export const lineBoxPx = (values: Record<string, unknown> = {}) => {
  const fontSize = numberValue(values.fontSize, 0);
  if (fontSize <= 0) return null;
  const lineHeight = numberValue(values.lineHeight, 1.15);
  // Authored lineHeight is usually a unitless ratio; rare px values are > 4.
  return lineHeight > 4 ? lineHeight : fontSize * lineHeight;
};

/** Height implied by fit.maxLines, or null when maxLines is unset. */
export const fitBudgetHeight = (
  values: Record<string, unknown> = {},
  fit: Record<string, unknown> | null | undefined = {},
) => {
  const maxLines = numberValue(fit?.maxLines, NaN);
  if (!Number.isFinite(maxLines) || maxLines <= 0) return null;
  const lineBox = lineBoxPx(values);
  if (lineBox == null) return null;
  return lineBox * maxLines;
};

export const verticalAlignFromValues = (values: Record<string, unknown> = {}) => {
  const align = String(values.alignItems || values.justifyContent || '').toLowerCase();
  if (align === 'flex-end' || align === 'end' || align === 'bottom') return 'bottom';
  if (align === 'center') return 'center';
  return 'top';
};

/**
 * Apply maxLines budget to a box. Returns new top/height (and localTop when
 * provided) so the alignment edge stays put when the box grows or shrinks.
 *
 * Explicit authored `values.height` always wins — maxLines is then only a
 * text-fit constraint. Expanding chrome from maxLines fought canvas drags on
 * tight offer-subline variants (e.g. 728x90 offers-3 height: 11 + maxLines: 2).
 */
export const applyFitBudgetToBox = ({
  top,
  height,
  localTop,
  values = {},
  fit = {},
}: {
  top: number;
  height: number;
  localTop?: number;
  values?: Record<string, unknown>;
  fit?: Record<string, unknown> | null;
}) => {
  const budget = fitBudgetHeight(values, fit);
  if (budget == null) {
    return {
      top,
      height,
      localTop,
      budgetApplied: false,
    };
  }

  const authored = authoredHeightPx(values.height, NaN);
  if (Number.isFinite(authored)) {
    return {
      top,
      height: authored,
      localTop,
      budgetApplied: false,
    };
  }

  const nextHeight = Math.max(4, budget);
  const delta = nextHeight - height;
  const anchor = verticalAlignFromValues(values);
  let nextTop = top;
  let nextLocalTop = localTop;
  if (delta !== 0) {
    if (anchor === 'bottom') {
      nextTop = top - delta;
      if (Number.isFinite(localTop as number)) nextLocalTop = (localTop as number) - delta;
    } else if (anchor === 'center') {
      nextTop = top - delta / 2;
      if (Number.isFinite(localTop as number)) nextLocalTop = (localTop as number) - delta / 2;
    }
  }

  return {
    top: nextTop,
    height: nextHeight,
    localTop: nextLocalTop,
    budgetApplied: true,
    anchor,
  };
};

/** Merge fit-budget height/top into CSS props for class/variant rules. */
export const propsWithFitBudget = (
  props: Record<string, unknown> = {},
  fit: Record<string, unknown> | null | undefined = {},
) => {
  const fallbackHeight = lineBoxPx(props) || 16;
  const height = authoredHeightPx(props.height, fallbackHeight);
  const top = numberValue(props.top, 0);
  const next = applyFitBudgetToBox({
    top,
    height,
    values: props,
    fit,
  });
  if (!next.budgetApplied) return props;
  return {
    ...props,
    height: next.height,
    ...(props.top !== undefined && props.top !== null && props.top !== ''
      ? { top: next.top }
      : {}),
  };
};
