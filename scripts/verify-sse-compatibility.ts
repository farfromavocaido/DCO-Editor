/** Compare this branch with an explicit, read-only pre-change SSE HTML snapshot. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readCreativeDocument} from '../src/server/creative-document';
import {renderStudioReadyHtml} from '../src/server/creative-exporter';
async function main(){
 const baseline=process.argv[2]; if(!baseline)throw new Error('Pass the pre-change snapshot directory');
 const document:any=await readCreativeDocument();
 for(const size of Object.keys(document.sizes)) {
  assert.equal(await renderStudioReadyHtml(document,size),await fs.readFile(path.join(baseline,`${size}.html`),'utf8'),`${size}: SSE production HTML changed`);
 }
 console.log(`PASS ${Object.keys(document.sizes).length} SSE production documents unchanged byte-for-byte`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
