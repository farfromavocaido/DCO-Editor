import { describe, it, expect } from 'vitest';
import { selectionHierarchy, dragTargetIdsForSelection, resolveSelectionMeta, resolveLayerIdForSelection } from './selection-groups';
import { nextSelectionForCanvasClick, nextSelectionForDrillIn, nextSelectionForEscape } from './selection-state';
import { selectionChromeKind, resizeHandlesForSelection } from './selection-chrome';
const fixture = () => ({
  variantModel: { dimensions: [] },
  componentDefinitions: [{ id: 'component:badge', name: 'Badge', resize: 'proportional', frameTargetId: 'disc', parts: [{ role: 'frame', targetId: 'disc' }, { role: 'copy', targetId: 'copy' }] }],
  sizes: { square: { canvas: { width: 200, height: 200 }, layers: [
    { id: 'disc', kind: 'shape', base: { left: 10, top: 20, width: 100, height: 100 }, clips: [] },
    { id: 'copy', kind: 'text', base: { left: 20, top: 40, width: 80, height: 20 }, clips: [] },
    { id: 'other', kind: 'shape', base: { left: 150, top: 20, width: 20, height: 20 }, clips: [] },
  ] } },
});
describe('component selection', () => {
  it('selects an assembly on click, enters its clicked part on double click, and escapes to the assembly', () => {
    const doc = fixture(), before = structuredClone(doc);
    const path = selectionHierarchy('copy', 0, doc, 'square');
    expect(path).toEqual(['component:badge', 'copy']);
    const click = nextSelectionForCanvasClick({ currentTargetId: '', isolationPath: [], hitPath: path, modifier: false });
    expect(click?.selectedTargetId).toBe('component:badge');
    const drill = nextSelectionForDrillIn({ currentTargetId: click!.selectedTargetId, isolationPath: [], hitPath: path });
    expect(drill).toMatchObject({ selectedTargetId: 'copy', isolationPath: ['component:badge'] });
    expect(nextSelectionForEscape({ selectedTargetId: 'copy', isolationPath: drill!.isolationPath })?.selectedTargetId).toBe('component:badge');
    expect(doc).toEqual(before);
  });
  it('uses component bounds and all parts for manipulation without creating canvas groups', () => {
    const doc = fixture();
    const selected = resolveSelectionMeta(doc, 'square', 'component:badge', ['component:badge'], 0);
    expect(selected).toMatchObject({ id: 'component:badge', componentId: 'component:badge', kind: 'component', values: { left: 10, top: 20, width: 100, height: 100 }, fit: {} });
    expect(dragTargetIdsForSelection('component:badge', ['component:badge'], 0, doc, 'square')).toEqual(['disc', 'copy']);
    expect(dragTargetIdsForSelection('other', ['component:badge', 'other'], 0, doc, 'square')).toEqual(['disc', 'copy', 'other']);
    expect(resolveLayerIdForSelection('component:badge', doc, 'square')).toBe('disc');
    expect(selectionChromeKind(selected)).toBe('selection-group');
    expect(resizeHandlesForSelection(selected)).toEqual(['nw', 'ne', 'se', 'sw']);
    expect(doc.sizes.square).not.toHaveProperty('canvasGroups');
  });
  it('retains independent canvas move group ancestry around components', () => {
    const doc = fixture();
    Object.assign(doc.sizes.square, { canvasGroups: [{ id: 'canvas-group:layout', name: 'Layout', members: ['disc', 'copy', 'other'] }] });
    expect(selectionHierarchy('copy', 0, doc, 'square')).toEqual(['canvas-group:layout', 'component:badge', 'copy']);
  });
});

import { useEditorStore } from '../store/editor-store';
it('store enters and exits a component and blocks manipulation of linked internal parts', () => {
  const doc = fixture();
  Object.assign(doc, { componentLinks: [{ id: 'linked', name: 'Shared badge', componentId: 'component:badge', source: { size: 'source', scope: '' }, destinations: [{ size: 'square', scope: '' }], sizing: 'destination' }] });
  Object.assign(doc.sizes, { source: structuredClone(doc.sizes.square) });
  useEditorStore.setState({ creativeDocument: doc, size: 'square', selectedTargetId: '', selectedTargetIds: [], selectedLayerId: '', isolationPath: [], offerCount: 0 });
  useEditorStore.getState().handleCanvasTargetClick({ shiftKey: false, metaKey: false, ctrlKey: false }, 'copy');
  expect(useEditorStore.getState().selectedTargetId).toBe('component:badge');
  expect(useEditorStore.getState().selectionDragTargetIds()).toEqual(['disc', 'copy']);
  useEditorStore.getState().drillIntoCanvasTarget('copy');
  expect(useEditorStore.getState().selectedTargetId).toBe('copy');
  expect(useEditorStore.getState().selectionDragTargetIds()).toEqual([]);
  useEditorStore.getState().exitGroupIsolation();
  expect(useEditorStore.getState().selectedTargetId).toBe('component:badge');
});

import { findCreativeTarget } from './creative-model';
it('component bounds updates and keyboard nudges transform hidden arrangements without changing other versions', () => {
  const doc: any = fixture();
  doc.variantModel.dimensions = [
    { id: 'version', field: 'version', defaultValue: 'a', options: [{ value: 'a', scope: 'version-a' }, { value: 'b', scope: 'version-b' }] },
    { id: 'arrangement', field: 'arrangement', defaultValue: 'split', options: [{ value: 'split', scope: 'split' }, { value: 'copy', scope: 'copy-only' }] },
  ];
  doc.componentDefinitions[0].stateDimensions = ['arrangement'];
  doc.sizes.square.variantRules = [{ id: 'copy-layout', scope: 'copy-only', layerId: 'copy', props: { left: 30, top: 60, height: 40 } }];
  useEditorStore.setState({ creativeDocument: doc, size: 'square', selectedTargetId: 'component:badge', selectedTargetIds: ['component:badge'], selectedLayerId: 'disc', isolationPath: [], offerCount: 0,
    feedDraft: { rows: [{ version: 'a', arrangement: 'split' }], selectedIndex: 0, dirty: false }, history: [], historyIndex: -1 });
  useEditorStore.getState().nudgeSelectedTarget(5, 7);
  let next = useEditorStore.getState().creativeDocument;
  expect(findCreativeTarget(next, 'square', 'copy', ['version-a', 'split']).values).toMatchObject({ left: 25, top: 47 });
  expect(findCreativeTarget(next, 'square', 'copy', ['version-a', 'copy-only']).values).toMatchObject({ left: 35, top: 67 });
  useEditorStore.getState().updateSelectedComponentBounds({ left: 15, top: 27, width: 200, height: 200 });
  next = useEditorStore.getState().creativeDocument;
  expect(findCreativeTarget(next, 'square', 'copy', ['version-a', 'split']).values).toMatchObject({ left: 35, top: 67, width: 160, height: 40 });
  expect(findCreativeTarget(next, 'square', 'copy', ['version-a', 'copy-only']).values).toMatchObject({ left: 55, top: 107, width: 160, height: 80 });
  for (const arrangement of ['split', 'copy-only']) expect(findCreativeTarget(next, 'square', 'copy', ['version-b', arrangement]).values).toEqual(findCreativeTarget(doc, 'square', 'copy', ['version-b', arrangement]).values);
  expect(useEditorStore.getState().history).toHaveLength(2);
});
