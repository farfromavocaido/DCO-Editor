// @ts-nocheck
'use client';
import { useState } from 'react';
import { componentLinkForTarget, unlinkComponent } from '@/lib/creative-components';
import { campaignRowForScopes, campaignScopes } from '@/lib/campaign-variants';
import { selectPreviewFeedRow, useEditorStore } from '@/store/editor-store';

export function ComponentLinkControls({ document, size, targetId, scopes }) {
  const [error, setError] = useState('');
  const link = componentLinkForTarget(document, size, targetId, scopes);
  if (!link) return null;
  const sourceScopes = link.source.scope.split('.').filter(Boolean);
  const editSource = async () => {
    try {
      const state = useEditorStore.getState();
      const rows = state.feedDraft.rows;
      const index = rows.findIndex(row => sourceScopes.every(scope => campaignScopes(document, row).includes(scope)));
      if (index >= 0) state.setFeedRowIndex(index);
      else {
        const row = campaignRowForScopes(document, selectPreviewFeedRow(state), sourceScopes);
        const draftRow = { ...row, ...(row.Unique_ID !== undefined ? { Unique_ID: `${row.Unique_ID}-${crypto.randomUUID()}` } : {}), ...(row.Default !== undefined ? { Default: false } : {}) };
        useEditorStore.setState({ feedDraft: { ...state.feedDraft, rows: [...rows, draftRow], selectedIndex: rows.length, dirty: true }, saveFeedDisabled: false });
        useEditorStore.getState().syncControlsFromFeedRow(draftRow);
      }
      await useEditorStore.getState().loadSize(link.source.size);
      useEditorStore.getState().setCanvasSelection(link.componentId, [link.componentId]);
    } catch (cause) { setError(cause.message); }
  };
  const unlink = () => {
    try {
      const destinations = link.destinations.filter(destination => destination.size === size && destination.scope.split('.').filter(Boolean).every(scope => scopes.includes(scope)));
      let next = useEditorStore.getState().creativeDocument;
      for (const destination of destinations) next = unlinkComponent(next, link.id, destination);
      useEditorStore.getState().applyCreativeOwnershipDocument(next, 'Unlinked component; appearance kept');
    } catch (cause) { setError(cause.message); }
  };
  return <section className="inspector-section ownership-controls"><h3>Linked component</h3><div className="ownership-body">
    <strong>{link.name}</strong><p className="inspector-note">Design comes from {link.source.size.replace('x', ' × ')}. Position and size stay local.</p>
    <div className="inspector-actions"><button onClick={editSource}>Edit source</button><button onClick={unlink}>Unlink — keep appearance</button></div>
    {error && <p role="alert">{error}</p>}
  </div></section>;
}
