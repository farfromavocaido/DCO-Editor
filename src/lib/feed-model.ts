// @ts-nocheck
const deepClone = (value) => JSON.parse(JSON.stringify(value ?? null));

const fieldFor = (fields, name) => fields.find((field) => field.name === name) || { name, type: 'string' };

const clampInteger = (value, field) => {
  const parsed = Number.parseInt(value, 10);
  const fallback = field.name === 'offer_count_num' ? 1 : 0;
  const finite = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(field.max ?? finite, Math.max(field.min ?? finite, finite));
};

const coerceFieldValue = (field, value) => {
  if (field.type === 'boolean') return Boolean(value);
  if (field.type === 'integer') return clampInteger(value, field);
  if (field.type === 'url') return { Url: String(value?.Url ?? value ?? '') };
  if (field.type === 'enum') {
    const normalized = String(value ?? '');
    if (!field.options.includes(normalized)) {
      throw new Error(`${field.name} must be one of ${field.options.join(', ')}`);
    }
    return normalized;
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
  if (field.type === 'url' && value && typeof value === 'object') return value.Url || '';
  if (value === undefined || value === null) return '';
  return String(value);
};

export const updateFeedDraftField = (draft, fields, fieldName, value) => {
  const field = fieldFor(fields, fieldName);
  const rows = deepClone(draft.rows) || [];
  const selectedIndex = Math.min(rows.length - 1, Math.max(0, Number(draft.selectedIndex) || 0));
  rows[selectedIndex] = {
    ...(rows[selectedIndex] || {}),
    [fieldName]: coerceFieldValue(field, value),
  };
  return {
    ...draft,
    rows,
    selectedIndex,
    dirty: true,
  };
};

export const controlsFromFeedRow = (row = {}) => ({
  offerCount: Math.min(3, Math.max(1, Number.parseInt(row.offer_count_num, 10) || 1)),
  tcMode: row.tc_type_enum === 'tcs_units' ? 'tcs_units' : 'tcs_only',
  ctaShape: row.cta_type_enum === 'rectangle' ? 'rectangle' : 'roundel',
});

const controlKeyForField = {
  offer_count_num: 'offerCount',
  tc_type_enum: 'tcMode',
  cta_type_enum: 'ctaShape',
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
      && controls.ctaShape === desired.ctaShape;
  });
  if (exactIndex >= 0) return { ...draft, selectedIndex: exactIndex };

  const controlIndex = rows.findIndex((row) => controlsFromFeedRow(row)[controlKey] === desired[controlKey]);
  if (controlIndex >= 0) return { ...draft, selectedIndex: controlIndex };

  return updateFeedDraftField(draft, fields, fieldName, value);
};

export const rowLabel = (row, index = 0) => {
  const count = controlsFromFeedRow(row).offerCount;
  const offerLabel = count === 1 ? 'Single' : count === 2 ? 'Dual' : 'Triple';
  return `${offerLabel} · ${row.Unique_ID || `Row ${index + 1}`}`;
};
