import { describe, expect, it, vi } from 'vitest';
import { createRenderGeneration, productionTargetId, seekProductionAnimations, unionProductionBounds } from './production-stage';

describe('production editing bridge', () => {
  it('only the latest render request owns the stage, including after cancellation', () => {
    const requests = createRenderGeneration();
    const first = requests.next();
    const second = requests.next();
    expect(requests.isCurrent(first)).toBe(false);
    expect(requests.isCurrent(second)).toBe(true);
    requests.next();
    expect(requests.isCurrent(second)).toBe(false);
  });
  it('maps production offer DOM ids to stable authoring targets', () => {
    expect(productionTargetId('offer2')).toBe('offer-slot-2');
    expect(productionTargetId('offer2', 'offer-subline')).toBe('offer-slot-2::offer-subline');
    expect(productionTargetId('roundel-value')).toBe('roundel-value');
    expect(productionTargetId('TC_Solo', 'terms-solo')).toBe('terms-solo');
  });
  it('seeks every browser animation to exact elapsed milliseconds without interpreting keyframes', () => {
    const animations = [ { pause: vi.fn(), currentTime: 0 }, { pause: vi.fn(), currentTime: 0 } ];
    const doc = { getAnimations: () => animations } as unknown as Document;
    seekProductionAnimations(doc, 37.5, 15);
    animations.forEach(animation => {
      expect(animation.pause).toHaveBeenCalledOnce();
      expect(animation.currentTime).toBe(5625);
    });
    seekProductionAnimations(doc, 100, 15);
    expect(animations[0].currentTime).toBe(15000);
  });
  it('uses browser rectangles for group selection bounds', () => {
    expect(unionProductionBounds([{left: 10, top: 20, width: 30, height: 40}, {left: 70, top: 5, width: 10, height: 20}])).toEqual({left:10, top:5, width:70, height:55});
    expect(unionProductionBounds([])).toBeNull();
  });
});

it('keeps overflowing descendant hit regions from stealing another target', async () => {
  const { resolveProductionHit } = await import('./production-stage');
  const span = {} as Element;
  const offer = {contains: (element: Element) => element === span} as HTMLElement;
  const headline = {contains: () => false} as unknown as HTMLElement;
  const result = resolveProductionHit([
    {id:'offer-slot-1::offer-value',element:offer,left:0,top:100,width:200,height:80},
    {id:'headline-act1',element:headline,left:0,top:20,width:200,height:30},
  ], [span,headline], 80, 35);
  expect(result).toBe('headline-act1');
});

it('rest snapshot restores the paused browser pose even if the collector fails', async () => {
  const { withProductionRestPose } = await import('./production-stage');
  const target = {};
  let disabled = false;
  const animation = {effect:{target},animationName:'slide',currentTime:5625,playState:'paused',pause:vi.fn()};
  const restored = {...animation,currentTime:0,pause:vi.fn()};
  let initial = true;
  const hidden = {textContent:'#bg-image {visibility:hidden}'};
  const doc = {
    querySelector: () => hidden,
    getAnimations: () => { if (initial) { initial=false; return [animation]; } return disabled ? [] : [restored]; },
    createElement: () => ({textContent:'',remove:()=>{disabled=false;}}),
    head:{append:()=>{disabled=true;}},
  };
  const stage = {ownerDocument:doc,getBoundingClientRect:vi.fn()} as unknown as HTMLElement;
  expect(() => withProductionRestPose(stage, () => {
    expect(disabled).toBe(true);
    expect(hidden.textContent).toBe('');
    throw new Error('collector failed');
  })).toThrow('collector failed');
  expect(hidden.textContent).toContain('visibility:hidden');
  expect(restored.currentTime).toBe(5625);
  expect(restored.pause).toHaveBeenCalledOnce();
});

it('selected clipping diagnostics prefer the selected object over later family members', async () => {
  const { productionTargetClipped } = await import('./production-stage');
  const flags = new Map([['offer-slot-1::offer-subline', true], ['offer-slot-2::offer-subline', false], ['offer-subline', false]]);
  expect(productionTargetClipped(flags, 'offer-slot-1::offer-subline', 'offer-subline')).toBe(true);
  flags.set('offer-subline', true);
  expect(productionTargetClipped(flags, 'offer-slot-2::offer-subline', 'offer-subline')).toBe(false);
});

it('mode-specific readiness cannot resolve with a same-size frame from another rendition', async () => {
  const {beginProductionStage,publishProductionStage,waitForProductionStage} = await import('./production-stage');
  beginProductionStage('300x250');
  const font = {dataset:{size:'300x250',previewRenderMode:'font'},isConnected:true} as unknown as HTMLElement;
  const outline = {dataset:{size:'300x250',previewRenderMode:'outline'},isConnected:true} as unknown as HTMLElement;
  publishProductionStage(font);
  setTimeout(()=>publishProductionStage(outline),10);
  expect(await waitForProductionStage('300x250',100,'outline')).toBe(outline);
});

it('same-mode readiness also waits for the exact source document and row', async () => {
  const {beginProductionStage,publishProductionStage,waitForProductionStage} = await import('./production-stage');
  const documentA = {}, documentB = {}, row = {};
  const stageA = {dataset:{size:'300x250',previewRenderMode:'font'},isConnected:true} as unknown as HTMLElement;
  const stageB = {...stageA} as HTMLElement;
  beginProductionStage('300x250');
  publishProductionStage(stageA,{document:documentA,row});
  setTimeout(()=>publishProductionStage(stageB,{document:documentB,row}),10);
  expect(await waitForProductionStage('300x250',100,'font',{document:documentB,row})).toBe(stageB);
});

it('readiness accepts an intentional blank image source but rejects a broken authored source', async () => {
  const {waitForProductionDocument} = await import('./production-stage');
  const stage = {} as HTMLElement;
  let rawSource = '';
  const doc = {querySelector:()=>stage,images:[{complete:true,src:'http://preview.local/current.html',naturalWidth:0,getAttribute:()=>rawSource}]} as unknown as Document;
  expect(await waitForProductionDocument(doc,100)).toBe(stage);
  rawSource = '/assets/missing.jpg';
  await expect(waitForProductionDocument(doc,100)).rejects.toThrow('image failed to load');
});
