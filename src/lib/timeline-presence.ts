/** Presence is read from the settled production DOM, never reinterpreted from presets. */
export type PresenceSpan = { start: number; end: number };
export function unionPresence(spans: PresenceSpan[]): PresenceSpan[] {
  const out: PresenceSpan[] = [];
  for (const span of [...spans].sort((a,b)=>a.start-b.start)) {
    const last=out[out.length-1];
    if(last&&span.start<=last.end+.00001)last.end=Math.max(last.end,span.end);
    else out.push({...span});
  }
  return out;
}
export function productionElementPresent(stage: HTMLElement, element: HTMLElement | null): boolean {
  const win=stage.ownerDocument.defaultView;if(!element||!win)return false;
  if(['hidden','collapse'].includes(win.getComputedStyle(element).visibility))return false;
  let node: HTMLElement|null=element, opacity=1;
  while(node){const style=win.getComputedStyle(node);
    if(style.display==='none')return false;
    opacity*=Number(style.opacity);if(opacity<=0)return false;
    if(node===stage)break;node=node.parentElement;
  }
  const box=element.getBoundingClientRect(),canvas=stage.getBoundingClientRect();
  return box.width>0&&box.height>0&&box.right>canvas.left&&box.left<canvas.right&&box.bottom>canvas.top&&box.top<canvas.bottom;
}
