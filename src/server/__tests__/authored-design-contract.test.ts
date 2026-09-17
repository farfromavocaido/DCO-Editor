import {expect,test} from 'vitest';
import {validateCreativeDocument} from '../creative-document';
import fixture from '../../test/fixtures/campaign/product-demo-creative.json';

// Deliberately vary artistic choices. Validation must preserve authored data;
// it must not enforce one approved campaign's dimensions, timing or typography.
for(const [duration,maxLines,fontSize,top] of [[4,1,12,0],[12.5,3,27,-8],[30,8,48,91]]){
 test(`valid design choices remain authored (${duration}s, ${maxLines} lines, ${fontSize}px)`,()=>{
  const document:any=structuredClone(fixture);
  document.clock.durationS=duration;document.clock.loop=true;
  for(const size of Object.values(document.sizes) as any[])for(const layer of size.layers){
   if(layer.kind!=='text')continue;
   layer.base={...layer.base,top,fontSize};layer.fit={...layer.fit,maxLines,mode:'wrap'};
   if(layer.binding?.field)for(const row of document.feed.sampleRows)row[layer.binding.field]='Different copy\nWith a second line';
  }
  const before=structuredClone(document);
  expect(()=>validateCreativeDocument(document)).not.toThrow();
  expect(document).toEqual(before);
 });
}
