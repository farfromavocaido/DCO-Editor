// @ts-nocheck
import { findCreativeTarget } from './creative-model';

export const findCanvasGroup = (document, size, id) => document?.sizes?.[size]?.canvasGroups?.find((group) => group.id === id);
export const canvasGroupForMember = (document, size, targetId) => document?.sizes?.[size]?.canvasGroups?.find((group) => group.members.includes(targetId) || group.members.includes(String(targetId).split('::')[0]));

export const validateCanvasGroups = (document) => {
  for (const [size, creative] of Object.entries(document.sizes || {})) {
    const ids = new Set(); const members = new Set();
    for (const group of creative.canvasGroups || []) {
      if (!String(group.id || '').startsWith('canvas-group:') || ids.has(group.id) || !group.name || !Array.isArray(group.members) || group.members.length < 2) throw new Error('Canvas groups require a unique ID, name and at least two members');
      ids.add(group.id);
      for (const member of group.members) {
        if (!findCreativeTarget(document,size,member,[])) throw new Error(`Unknown canvas group member: ${member}`);
        if (members.has(member)) throw new Error(`Target ${member} is already in a canvas group`);
        const overlapping = [...members].find((other) => member.startsWith(`${other}::`) || other.startsWith(`${member}::`));
        if (overlapping) throw new Error(`Canvas group members overlap: ${overlapping} and ${member}`);
        if (group.members.some((other) => other !== member && member.startsWith(`${other}::`))) throw new Error('A group cannot contain both a parent and its nested child');
        members.add(member);
      }
    }
  }
};

/** Virtual grouping never changes coordinate systems, DOM parents, clips or sharing. */
export const createCanvasGroup = (document, size, group) => {
  const next = JSON.parse(JSON.stringify(document));
  if (!next.sizes?.[size]) throw new Error(`Unknown size: ${size}`);
  next.sizes[size].canvasGroups = [...(next.sizes[size].canvasGroups || []), {...group,members:[...new Set(group.members)]}];
  validateCanvasGroups(next);
  return next;
};
export const removeCanvasGroup = (document, size, groupId) => {
  const next = JSON.parse(JSON.stringify(document));
  next.sizes[size].canvasGroups = (next.sizes[size].canvasGroups || []).filter((group) => group.id !== groupId);
  return next;
};
