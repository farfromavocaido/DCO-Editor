// @ts-nocheck
import { compileAnimationClips, frameAtPercent } from './creative-compiler';
import { editableKeyframes, keyframeClip, editKeyframe } from './keyframe-editing';

const channels = ['translate', 'opacity', 'scale', 'left', 'top', 'width', 'height', 'color'];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A read-only view of consecutive frames. Holds keep their frames but need no action bar. */
export function motionTransitions(clip, beats, context) {
  const frames = editableKeyframes(clip, beats, context);
  const compiled = compileAnimationClips([clip], beats, context);
  return frames.slice(0, -1).flatMap((frame, i) => {
    const next = frames[i + 1];
    if (next.at <= frame.at) return [];
    const from = frameAtPercent(compiled, frame.at), to = frameAtPercent(compiled, next.at);
    const changed = channels.filter(key => !equal(from[key], to[key]));
    if (!changed.length) return [];
    const labels = [];
    if (changed.includes('translate') || changed.some(k => ['left', 'top'].includes(k))) labels.push('Move');
    if (changed.includes('scale') || changed.some(k => ['width', 'height'].includes(k))) labels.push('Resize');
    if (changed.includes('opacity')) labels.push(to.opacity > from.opacity ? 'Fade in' : 'Fade out');
    if (changed.includes('color')) labels.push('Colour');
    return [{ id: `${frame.index}:${next.index}`, fromIndex: frame.index, toIndex: next.index,
      start: frame.at, end: next.at, from, to, channels: changed,
      label: labels.join(' + '), easing: frame.frame.easing || 'linear' }];
  });
}

/** Retimes the two existing endpoints atomically; never moves neighbouring frames or shared beats. */
export function retimeTransition(clip, transition, start, end, beats, context) {
  const next = keyframeClip(clip, beats, context);
  const frames = editableKeyframes(next, beats, context);
  const i = frames.findIndex(f => f.index === transition.fromIndex);
  if (i < 0 || frames[i + 1]?.index !== transition.toIndex) throw new Error('Select the transition again');
  const lower = i ? frames[i - 1].at : -0.001;
  const upper = i + 2 < frames.length ? frames[i + 2].at : 100.001;
  if (![start, end].every(Number.isFinite) || start < 0 || end > 100 || start >= end || start <= lower || end >= upper)
    throw new Error('Keep this transition inside the ad and between its neighbouring keyframes');
  next.keyframes[transition.fromIndex].at = start;
  next.keyframes[transition.toIndex].at = end;
  return next;
}

export function editTransitionEndpoint(clip, transition, endpoint, patch, beats, context) {
  return editKeyframe(clip, endpoint === 'from' ? transition.fromIndex : transition.toIndex, patch, beats, context);
}

export function animationLabel(clip) {
  const names = { popPulse: 'Appear, pulse and disappear', waveSweep: 'Wave movement', slideInRight: 'Slide and fade', fadeUp: 'Rise and fade', fade: 'Fade in and out', custom: 'Custom animation' };
  const label = clip.label || '';
  const generatedPreset = Object.keys(names).find(preset => label.endsWith(` ${preset}`));
  return generatedPreset ? names[generatedPreset] : label || names[clip.preset] || clip.id;
}
