// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { applyProductionUpdate, describeProductionUpdate } from './production-update';
const html = (css='p {left:10px}', fit=1, row=1, body='<p id="copy">Template</p>', runtime='window.runtime=1') => `<html><head><style>${css}</style><script type="application/json" id="sse-production-fit-rules">[{"maxLines":${fit}}]</script><script id="sse-dco-preview-feed">window.row=${row}</script><script>${runtime}</script></head><body><main class="stage page-content offers-${row}">${body}</main></body></html>`;
it('reuses the generated production structure for CSS, fitting and feed changes',()=>{
 const a=describeProductionUpdate(html(),new DOMParser())!;
 const b=describeProductionUpdate(html('p {left:25px}',2,3),new DOMParser())!;
 expect(a.signature).toBe(b.signature);
 document.head.innerHTML='<style data-production-style>p {left:10px}</style>';
 const fit=vi.fn(), apply=vi.fn();
 Object.assign(window,{updateSseDcoFitRules:fit,applySseDcoRuntimeState:apply});
 expect(applyProductionUpdate(document,a,b,{offer_count_num:3})).toBe(true);
 expect(document.querySelector('style')?.textContent).toBe('p {left:25px}');
 expect(fit).toHaveBeenCalledWith([{maxLines:2}]);
 expect(apply).toHaveBeenCalledWith({offer_count_num:3});
});
it('reloads rather than patching changed runtime, assets or structure',()=>{
 const a=describeProductionUpdate(html(),new DOMParser())!;
 for(const source of [html('p {left:1px}',1,1,'<img src="new.jpg">'),html('p {left:1px}',1,1,undefined,'window.runtime=2')]) {
  expect(applyProductionUpdate(document,a,describeProductionUpdate(source,new DOMParser()),{})).toBe(false);
 }
 expect(describeProductionUpdate('<html><body>Outline</body></html>',new DOMParser())).toBeNull();
});
