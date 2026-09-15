import { expect, test } from 'vitest';
import { readCreativeDocument } from '../creative-document';
import { renderStudioReadyHtml } from '../creative-exporter';

test('production CSS resolves authored relative distances for each canvas and timing in seconds', async () => {
  const document = await readCreativeDocument() as Record<string, any>;
  for (const size of ['300x250','970x250']) {
    const layer = document.sizes[size].layers.find((item: {id:string})=>item.id==='headline-act1');
    layer.clips = [{id:'relative-test',preset:'custom',start:0,keyframes:[{at:0,translate:[{value:10,unit:'canvas'},{value:20,unit:'parent'}],opacity:0},{at:{value:1.5,unit:'seconds'},translate:[0,0],opacity:1}]}];
    const html = await renderStudioReadyHtml(document,size);
    expect(html).toContain(`translate3d(${size==='300x250'?30:97}px, 50px, 0px)`);
    const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n');
    expect(css.includes('[object Object]')).toBe(false);
    expect(html).toContain('10% {');
  }
});
