// @ts-nocheck
import { backgroundImageFieldDefinitions } from '@/lib/feed-background';
import { readCreativeDocument, writeCreativeDocument } from './creative-document';
import { normalizeTcTypeEnum } from '@/lib/feed-model';

export const FEED_SCHEMA_FIELDS = [
  { name: '_id', label: 'Row ID', type: 'integer', group: 'Meta', description: 'Studio row index.' },
  { name: 'Unique_ID', label: 'Unique ID', type: 'string', group: 'Meta', description: 'Stable row identifier.' },
  { name: 'Reporting_label', label: 'Reporting label', type: 'string', group: 'Meta', description: 'Pipe-delimited reporting label for DV360.' },
  { name: 'Active', label: 'Active', type: 'boolean', group: 'Meta', description: 'Whether this row is eligible to serve.' },
  { name: 'Default', label: 'Default', type: 'boolean', group: 'Meta', description: 'Fallback row when targeting matches nothing.' },
  { name: 'heading1_text', label: 'Heading 1', type: 'multiline', group: 'Copy', description: 'Act 1 headline copy; line breaks are preserved when the layer wraps.' },
  { name: 'heading2_text', label: 'Heading 2', type: 'multiline', group: 'Copy', description: 'Act 2 headline copy; line breaks are preserved when the layer wraps.' },
  { name: 'heading3_text', label: 'Heading 3', type: 'multiline', group: 'Copy', description: 'Act 3 headline copy over the offer roundel (when enabled); line breaks are preserved when the layer wraps.' },
  { name: 'heading4_text', label: 'Heading 4', type: 'multiline', group: 'Copy', description: 'Act 4 headline copy over the CTA/endframe; line breaks are preserved when the layer wraps.' },
  { name: 'offer_count_num', label: 'Offer count', type: 'integer', group: 'Creative State', description: 'Number of visible offer slots.', min: 1, max: 3 },
  { name: 'offer1_value_text', label: 'Offer 1 value', type: 'string', group: 'Offers', description: 'Primary value in offer slot 1.' },
  { name: 'offer1_sub_text', label: 'Offer 1 subline', type: 'string', group: 'Offers', description: 'Subline in offer slot 1.' },
  { name: 'offer2_value_text', label: 'Offer 2 value', type: 'string', group: 'Offers', description: 'Primary value in offer slot 2.' },
  { name: 'offer2_sub_text', label: 'Offer 2 subline', type: 'string', group: 'Offers', description: 'Subline in offer slot 2.' },
  { name: 'offer3_value_text', label: 'Offer 3 value', type: 'string', group: 'Offers', description: 'Primary value in offer slot 3.' },
  { name: 'offer3_sub_text', label: 'Offer 3 subline', type: 'string', group: 'Offers', description: 'Subline in offer slot 3.' },
  { name: 'tc_type_enum', label: 'T&C format', type: 'enum', group: 'Creative State', description: 'Terms display mode.', options: ['tcs_only', 'tcs_units'] as const },
  { name: 'tc_terms_text', label: 'T&Cs text', type: 'multiline', group: 'Copy', description: 'Terms and conditions line; line breaks are preserved when the layer wraps.' },
  { name: 'tc_units_text', label: 'Unit-rate text', type: 'multiline', group: 'Copy', description: 'Unit-rate text; line breaks are preserved.' },
  { name: 'cta_type_enum', label: 'CTA shape', type: 'enum', group: 'Creative State', description: 'CTA button shape (circle or rectangle).', options: ['roundel', 'rectangle'] as const },
  { name: 'cta_text', label: 'CTA text', type: 'string', group: 'Copy', description: 'CTA label.' },
  { name: 'include_roundel_frame_bool', label: 'Offer roundel frame', type: 'boolean', group: 'Creative State', description: 'Whether the optional Act 3 offer roundel frame is shown.' },
  { name: 'roundel_text_text', label: 'Roundel text', type: 'string', group: 'Copy', description: 'Text shown inside the optional roundel frame.' },
  { name: 'roundel_value_text', label: 'Roundel value', type: 'string', group: 'Copy', description: 'Optional large value shown inside the roundel frame.' },
  ...backgroundImageFieldDefinitions(),
] as const;

export type FeedField = (typeof FEED_SCHEMA_FIELDS)[number];
export type FeedFieldType = FeedField['type'];

const fieldByName = new Map(FEED_SCHEMA_FIELDS.map((field) => [field.name, field]));

const coerceBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

const coerceInteger = (value: unknown, field: FeedField) => {
  const numeric = Number.parseInt(String(value), 10);
  const fallback = field.name === 'offer_count_num' ? 1 : 0;
  const finite = Number.isFinite(numeric) ? numeric : fallback;
  if (field.min !== undefined || field.max !== undefined) {
    return Math.min(field.max ?? finite, Math.max(field.min ?? finite, finite));
  }
  return finite;
};

const coerceUrl = (value: unknown) => {
  if (value && typeof value === 'object' && 'Url' in value) {
    return { Url: String((value as { Url?: string }).Url || '') };
  }
  return { Url: String(value ?? '') };
};

const coerceField = (field: FeedField, value: unknown) => {
  if (field.type === 'boolean') return coerceBoolean(value);
  if (field.type === 'integer') return coerceInteger(value, field);
  if (field.type === 'image' || field.type === 'url') return coerceUrl(value);
  if (field.type === 'enum') {
    if (field.name === 'tc_type_enum') {
      const canonical = normalizeTcTypeEnum(value);
      if (canonical !== 'tcs_only' && canonical !== 'tcs_units') {
        throw new Error(`${field.name} must be one of tcs_only, tcs_units`);
      }
      return canonical;
    }
    const normalized = String(value ?? '');
    const options = field.options as readonly string[];
    if (!options.includes(normalized)) {
      throw new Error(`${field.name} must be one of ${options.join(', ')}`);
    }
    return normalized;
  }
  return String(value ?? '');
};

export const validateFeedRows = (rows: Record<string, unknown>[]) => rows.map((row, index) => {
  const out: Record<string, unknown> = {};
  for (const field of FEED_SCHEMA_FIELDS) {
    out[field.name] = coerceField(field, row[field.name]);
  }
  if (!Object.prototype.hasOwnProperty.call(row, '_id')) out._id = index;
  return out;
});

const normalizeFeedFields = (fields) => fields.map((field) => (
  field.name === 'tc_type_enum'
    ? { ...field, options: ['tcs_only', 'tcs_units'] }
    : field
));

export const readFeedSchema = async (documentPath?: string) => {
  const document = await readCreativeDocument(documentPath);
  const feed = document.feed || {};
  const rawFields = Array.isArray(feed.fields) && feed.fields.length
    ? feed.fields
    : FEED_SCHEMA_FIELDS.map((field) => ({ ...field }));
  return {
    profileName: feed.profileName,
    studioProfileId: feed.studioProfileId,
    studioProfileElement: feed.studioProfileElement,
    fields: normalizeFeedFields(rawFields),
    rows: feed.sampleRows || [],
  };
};

export const writeFeedSchemaRows = async (rows: Record<string, unknown>[], documentPath?: string) => {
  const document = await readCreativeDocument(documentPath);
  const nextRows = validateFeedRows(rows);
  const nextDocument = {
    ...document,
    feed: {
      ...document.feed,
      sampleRows: nextRows,
    },
  };
  await writeCreativeDocument(nextDocument, documentPath);
  return readFeedSchema(documentPath);
};

export const fieldMetadata = (name: string) => fieldByName.get(name as FeedField['name']);
