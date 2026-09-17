// @vitest-environment jsdom
import {afterEach,expect,test} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const css=fs.readFileSync(path.join(__dirname,'editor.css'),'utf8');
afterEach(()=>{document.head.innerHTML='';document.body.innerHTML='';});
test('selection decoration allows hits through while resize handles remain interactive',()=>{
 document.head.innerHTML=`<style>${css}</style>`;
 document.body.innerHTML='<main class="app-shell"><div class="selection-box"><button class="resize-handle"></button></div></main>';
 expect(getComputedStyle(document.querySelector('.selection-box')!).pointerEvents).toBe('none');
 expect(getComputedStyle(document.querySelector('.resize-handle')!).pointerEvents).toBe('auto');
});
