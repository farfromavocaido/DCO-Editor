const cornerHandles = ['nw', 'ne', 'se', 'sw'];

const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const selectionChromeKind = (
  selectedTarget: { kind?: string; boundsMode?: string; coordinateScope?: string } | null,
  boundsMode = '',
) => {
  if (!selectedTarget) return 'none';
  if (boundsMode === 'logical' || selectedTarget.boundsMode === 'logical') return 'logical-group';
  if (selectedTarget.kind === 'group' || selectedTarget.kind === 'multi') return 'selection-group';
  if (selectedTarget.kind === 'nested') return 'text-box';
  if (selectedTarget.kind === 'text') return 'text-box';
  if (selectedTarget.kind === 'image') return 'image-box';
  if (selectedTarget.kind === 'shape') return 'shape-box';
  return selectedTarget.coordinateScope === 'group' ? 'text-box' : 'element-box';
};

export const resizeHandlesForSelection = (
  selectedTarget: { kind?: string; id?: string } | null,
  selectedTargetId = '',
) => {
  if (!selectedTarget) return [];
  if (selectedTarget.kind === 'group' || selectedTarget.kind === 'multi') return cornerHandles;
  if (selectedTarget.kind === 'nested') return cornerHandles;
  if (String(selectedTargetId || selectedTarget.id || '').startsWith('plus-')) return [];
  return cornerHandles;
};

export const fitSizeStatus = (requested: unknown, fitted: unknown) => {
  const requestedNumber = asNumber(requested);
  const fittedNumber = asNumber(fitted);
  if (requestedNumber === null) {
    return {
      requested: requestedNumber,
      fitted: fittedNumber,
      state: 'unknown',
    };
  }
  if (fittedNumber === null) {
    return {
      requested: requestedNumber,
      fitted: requestedNumber,
      state: 'stated',
    };
  }
  return {
    requested: requestedNumber,
    fitted: fittedNumber,
    state: Math.abs(requestedNumber - fittedNumber) > 0.25 ? 'scaled' : 'stated',
  };
};

/** Format an em tracking value for the inspector (e.g. −0.05em). */
export const formatTrackingEm = (value: unknown) => {
  const numeric = asNumber(value);
  if (numeric === null) return null;
  if (Math.abs(numeric) < 0.0005) return '0em';
  const rounded = Math.round(numeric * 1000) / 1000;
  return `${rounded}em`;
};

/**
 * Effective letter-spacing after fit. `fitted` is the runtime squeeze in em
 * (usually ≤ 0). Authored `letterSpacing` is shown only as context — fit owns
 * the final inline value when tracking ran.
 */
export const fitTrackingStatus = (fittedEm: unknown) => {
  const fitted = asNumber(fittedEm);
  if (fitted === null) {
    return { fitted: null, label: null, state: 'unknown' as const };
  }
  const label = formatTrackingEm(fitted);
  return {
    fitted,
    label,
    state: Math.abs(fitted) > 0.0005 ? 'squeezed' as const : 'stated' as const,
  };
};
