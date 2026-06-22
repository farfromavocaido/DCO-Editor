// @ts-nocheck
const deepClone = (value) => JSON.parse(JSON.stringify(value ?? null));

const fieldFor = (fields, name) => fields.find((field) => field.name === name) || { name, type: 'string' };

const normalizeCtaShape = (value) => (
  ['rectangle', 'rect'].includes(String(value || '')) ? 'rectangle' : 'roundel'
);

/** Canonical T&C enum values used by runtime, exporter, and top-bar controls. */
export const normalizeTcTypeEnum = (value) => {
  const normalized = String(value ?? '');
  if (normalized === 'solo' || normalized === 'prices') {
    return normalized === 'solo' ? 'tcs_only' : 'tcs_units';
  }
  return normalized;
};

const ctaRectangleFieldValue = (fields) => {
  const field = fieldFor(fields, 'cta_type_enum');
  if (field.type !== 'enum') return 'rectangle';
  return field.options?.includes('rectangle') ? 'rectangle' : 'rect';
};

const coerceBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return Boolean(value);
};

const clampInteger = (value, field) => {
  const parsed = Number.parseInt(value, 10);
  const fallback = field.name === 'offer_count_num' ? 1 : 0;
  const finite = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(field.max ?? finite, Math.max(field.min ?? finite, finite));
};

const coerceFieldValue = (field, value) => {
  if (field.type === 'boolean') return coerceBoolean(value);
  if (field.type === 'integer') return clampInteger(value, field);
  if (field.type === 'image' || field.type === 'url') return { Url: String(value?.Url ?? value ?? '') };
  if (field.type === 'enum') {
    if (field.name === 'tc_type_enum') {
      const canonical = normalizeTcTypeEnum(value);
      if (canonical !== 'tcs_only' && canonical !== 'tcs_units') {
        throw new Error(`${field.name} must be one of tcs_only, tcs_units`);
      }
      return canonical;
    }
    const options = field.options || [];
    const normalized = String(value ?? '');
    const aliased = field.name === 'cta_type_enum' && normalized === 'rectangle' && options.includes('rect')
      ? 'rect'
      : field.name === 'cta_type_enum' && normalized === 'rect' && options.includes('rectangle')
        ? 'rectangle'
        : normalized;
    if (!options.includes(aliased)) {
      throw new Error(`${field.name} must be one of ${options.join(', ')}`);
    }
    return aliased;
  }
  return String(value ?? '');
};

export const createFeedDraft = (rows = [], options = {}) => ({
  rows: deepClone(rows) || [],
  selectedIndex: Number(options.selectedIndex) || 0,
  dirty: Boolean(options.dirty),
  layoutDirty: Boolean(options.layoutDirty),
});

export const selectedFeedDraftRow = (draft) => draft.rows[draft.selectedIndex] || draft.rows[0] || {};

export const fieldInputValue = (row, field) => {
  const value = row?.[field.name];
  if ((field.type === 'url' || field.type === 'image') && value && typeof value === 'object') return value.Url || '';
  if (value === undefined || value === null) return '';
  return String(value);
};

export const updateFeedDraftField = (draft, fields, fieldName, value) => {
  const field = fieldFor(fields, fieldName);
  const rows = deepClone(draft.rows) || [];
  const selectedIndex = Math.min(rows.length - 1, Math.max(0, Number(draft.selectedIndex) || 0));
  const coerced = coerceFieldValue(field, value);
  rows[selectedIndex] = {
    ...(rows[selectedIndex] || {}),
    [fieldName]: coerced,
  };
  if (fieldName === 'include_roundel_frame_bool' && coerceBoolean(coerced)) {
    rows[selectedIndex].cta_type_enum = ctaRectangleFieldValue(fields);
  }
  return {
    ...draft,
    rows,
    selectedIndex,
    dirty: true,
  };
};

export const controlsFromFeedRow = (row = {}) => {
  const includeRoundelFrame = coerceBoolean(row.include_roundel_frame_bool);
  return {
    offerCount: Math.min(3, Math.max(1, Number.parseInt(row.offer_count_num, 10) || 1)),
    tcMode: normalizeTcTypeEnum(row.tc_type_enum) === 'tcs_units' ? 'tcs_units' : 'tcs_only',
    ctaShape: includeRoundelFrame ? 'rectangle' : normalizeCtaShape(row.cta_type_enum),
    includeRoundelFrame,
    frameCount: includeRoundelFrame ? 4 : 3,
    roundelMode: includeRoundelFrame && String(row.roundel_value_text || '').trim()
      ? 'split'
      : 'copy-only',
  };
};

export const activeScopesFromControls = (controls = {}) => {
  const offerCount = Math.min(3, Math.max(1, Number(controls.offerCount) || 1));
  const tcScope = controls.tcMode === 'tcs_units' ? 'tc-prices' : 'tc-solo';
  const includeRoundelFrame = Boolean(controls.includeRoundelFrame || Number(controls.frameCount) === 4);
  const ctaScope = includeRoundelFrame || normalizeCtaShape(controls.ctaShape) === 'rectangle' ? 'cta-rect' : 'cta-roundel';
  return [
    `offers-${offerCount}`,
    tcScope,
    ctaScope,
    includeRoundelFrame ? 'frames-4' : 'frames-3',
    includeRoundelFrame ? 'roundel-frame-on' : 'roundel-frame-off',
    controls.roundelMode === 'split' ? 'roundel-split' : 'roundel-copy-only',
  ];
};

const controlKeyForField = {
  offer_count_num: 'offerCount',
  tc_type_enum: 'tcMode',
  cta_type_enum: 'ctaShape',
  include_roundel_frame_bool: 'includeRoundelFrame',
};

export const selectFeedDraftVariant = (draft, fields, fieldName, value) => {
  const controlKey = controlKeyForField[fieldName];
  if (!controlKey) return updateFeedDraftField(draft, fields, fieldName, value);

  const field = fieldFor(fields, fieldName);
  const coerced = coerceFieldValue(field, value);
  const selected = selectedFeedDraftRow(draft);
  const desired = {
    ...controlsFromFeedRow(selected),
    [controlKey]: controlKey === 'offerCount' ? Number(coerced) : coerced,
  };
  const rows = draft.rows || [];
  const exactIndex = rows.findIndex((row) => {
    const controls = controlsFromFeedRow(row);
    return controls.offerCount === desired.offerCount
      && controls.tcMode === desired.tcMode
      && controls.ctaShape === desired.ctaShape
      && controls.includeRoundelFrame === desired.includeRoundelFrame;
  });
  if (exactIndex >= 0) return { ...draft, selectedIndex: exactIndex };

  if (controlKey !== 'includeRoundelFrame') {
    const controlIndex = rows.findIndex((row) => controlsFromFeedRow(row)[controlKey] === desired[controlKey]);
    if (controlIndex >= 0) return { ...draft, selectedIndex: controlIndex };
  }

  return updateFeedDraftField(draft, fields, fieldName, value);
};

export const rowLabel = (row, index = 0) => {
  const count = controlsFromFeedRow(row).offerCount;
  const offerLabel = count === 1 ? 'Single' : count === 2 ? 'Dual' : 'Triple';
  return `${offerLabel} · ${row.Unique_ID || `Row ${index + 1}`}`;
};
