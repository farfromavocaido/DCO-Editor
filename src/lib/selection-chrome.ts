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
