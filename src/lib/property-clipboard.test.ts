import {expect,test} from 'vitest';
import {captureProperties,pasteProperties} from './property-clipboard';
import {findCreativeTarget} from './creative-model';
import demo from '../test/fixtures/campaign/product-demo-creative.json';
test('property clipboard freezes appearance and fitting without copy, animation or live links',()=>{
 const source:any={id:'source',kind:'text',values:{left:14,fontFamily:'Example',fontWeight:700,text:'Do not copy',cssClass:'private'},fit:{mode:'shrink',maxLines:2},clips:[{id:'motion'}]};
 const clipboard=captureProperties(source)!;source.values.left=99;expect(clipboard.values).toEqual({left:14,fontFamily:'Example',fontWeight:700});expect(clipboard.fit.maxLines).toBe(2);
 const document:any=structuredClone(demo),target=findCreativeTarget(document,'300x250','title',['theme-light','product-lamp','language-en']);
 const next=pasteProperties(document,'300x250',target,['theme-light','product-lamp','language-en'],clipboard);
 const pasted=findCreativeTarget(next,'300x250','title',['theme-light','product-lamp','language-en']);expect(pasted.values.left).toBe(14);expect(pasted.fit.maxLines).toBe(2);expect(next.feed).toEqual(document.feed);expect(next.sizes['300x250'].layers).toEqual(document.sizes['300x250'].layers);
 expect(captureProperties({kind:'component'})).toBeNull();
});
