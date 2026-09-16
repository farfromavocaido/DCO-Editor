// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
const {settle,seek} = vi.hoisted(() => ({settle:vi.fn(),seek:vi.fn()}));
vi.mock('@/lib/production-stage', async importOriginal => ({...await importOriginal<object>(),waitForProductionDocument:settle,seekProductionAnimations:seek}));
import { OwnershipProductionPreview } from './OwnershipProductionPreview';
let root:Root, container:HTMLDivElement;
afterEach(async () => {if(root)await act(async()=>root.unmount());container?.remove();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('isolated production relationship previews', () => {
 it('ignores stale requests and stale iframe settlement, and seeks the current frame without refetching', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  const requests:Array<(value:any)=>void>=[];
  const fetcher=vi.fn(()=>new Promise(resolve=>requests.push(resolve)));
  vi.stubGlobal('fetch',fetcher);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  const doc={clock:{durationS:15}}, first={audience:'home'},second={audience:'business'};
  const render=async(row:any,percent=20)=>act(async()=>root.render(React.createElement(OwnershipProductionPreview,{document:doc,row,size:'300x250',percent,label:'Production'})));
  await render(first);
  await render(second);
  await act(async()=>requests[0]({ok:true,text:async()=>'<body>stale</body>'}));
  expect(container.querySelector('iframe')).toBeNull();
  let settled:()=>void = ()=>{};
  settle.mockImplementation(()=>new Promise<void>(resolve=>{settled=resolve;}));
  await act(async()=>requests[1]({ok:true,text:async()=>'<body>current</body>'}));
  const old=container.querySelector('iframe')!;
  await act(async()=>old.dispatchEvent(new Event('load')));
  await render(first);
  await act(async()=>settled());
  expect(seek).not.toHaveBeenCalled();
  settle.mockResolvedValue({});
  await act(async()=>requests[2]({ok:true,text:async()=>'<body>latest</body>'}));
  await act(async()=>container.querySelector('iframe')!.dispatchEvent(new Event('load')));
  expect(seek).toHaveBeenLastCalledWith(expect.anything(),20,15);
  await render(first,70);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(seek).toHaveBeenLastCalledWith(expect.anything(),70,15);
 });
});
