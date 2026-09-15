import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { findCreativeTarget, updateCreativeTargetFit, updateCreativeTargetValue } from './creative-model';
import { validateCreativeDocument } from '../server/creative-document';
const fixture = () => ({ version: 1, campaign: { id: 'sse-dco' }, clock: { durationS: 15, beats: {} }, feed: { profileName: 'test', sampleRows: [] }, sizes: { '300x250': { canvas: { width: 300, height: 250 }, layers: [{ id: 'terms', kind: 'text', base: { width: 102, fontSize: 6 }, fit: { mode: 'shrink', maxLines: 4, minFontSize: 10 }, clips: [] }], variantRules: [{ id: 'compound', layerId: 'terms', scope: 'offers-0.tc-standard', props: { width: 100 }, fit: { maxLines: 2 } }, { id: 'plain', layerId: 'terms', scope: 'offers-0', props: { height: 43 }, fit: { minFontSize: 8 } }] } } });
const scopes = ['offers-0', 'tc-standard'];
describe('effective ownership', () => {
 it('merges each effective fit field and writes its controlling source', () => {
  const doc = fixture();
  const target = findCreativeTarget(doc, '300x250', 'terms', scopes);
  expect(target.fit).toEqual({ mode: 'shrink', maxLines: 2, minFontSize: 8 });
  expect(target.fitProvenance.maxLines.ruleId).toBe('compound');
  const next = updateCreativeTargetFit(doc, '300x250', 'terms', scopes, 'maxLines', 3);
  expect(findCreativeTarget(next, '300x250', 'terms', scopes).fit.maxLines).toBe(3);
  expect(findCreativeTarget(next, '300x250', 'terms', ['offers-1']).fit.maxLines).toBe(4);
  expect(next.sizes['300x250'].layers[0].fit).toEqual(doc.sizes['300x250'].layers[0].fit);
  expect(findCreativeTarget(JSON.parse(JSON.stringify(next)), '300x250', 'terms', scopes).fit.maxLines).toBe(3);
 });
 it('uses browser specificity and unscoped rules for effective property edits', () => {
  const doc = fixture();
  doc.sizes['300x250'].variantRules.push({ id: 'global', layerId: 'terms', scope: '', props: { width: 120, left: 6 }, fit: { mode: 'wrap' } });
  const target = findCreativeTarget(doc, '300x250', 'terms', scopes);
  expect(target.values.width).toBe(100);
  expect(target.values.left).toBe(6);
  expect(target.fit.mode).toBe('wrap');
  const next = updateCreativeTargetValue(doc, '300x250', 'terms', scopes, 'width', 88);
  expect(findCreativeTarget(next, '300x250', 'terms', scopes).values.width).toBe(88);
 });
 it('validates without adding, removing, or changing authored rules', () => {
  const doc = JSON.parse(fs.readFileSync('campaign/sse-dco-creative.json', 'utf8'));
  doc.sizes['300x250'].variantRules.push({id:'custom-roundel',scope:'offers-2',layerId:'roundel-copy',props:{left:27}});
  const before = structuredClone(doc);
  validateCreativeDocument(doc);
  expect(doc).toEqual(before);
 });
});
