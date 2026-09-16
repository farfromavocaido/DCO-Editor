/** Browser authoring smoke test; backend document storage is intercepted in memory. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { replaceOwnershipDestinationLocals, ownershipDestinations } from '../src/lib/ownership-ui';
import { materializeCreativeOwnership } from '../src/lib/creative-ownership';
import { selectorForVariantRule, renderCssRule } from '../src/lib/creative-css';
const origin = process.argv[2] || 'http://localhost:5184';
const output = path.resolve('output/playwright/ownership');

async function main() {
  await fs.mkdir(output,{recursive:true});
  const original = await fs.readFile('campaign/sse-dco-creative.json','utf8');
  let saved = JSON.parse(original), latest = saved;
  const browser = await chromium.launch({headless:true});
  try {
    const cascadePage = await browser.newPage();
    const cascadeDoc = {sizes:{'300x250':{layers:[{id:'title',kind:'text',base:{fontSize:20},clips:[]}],variantRules:[],localOverrides:[{targetId:'title',scope:'',values:{fontSize:55}},{targetId:'title',scope:'offers-0',values:{fontSize:30}}]}}};
    let partitioned = replaceOwnershipDestinationLocals(cascadeDoc,ownershipDestinations('title',['300x250'],[1],['cta-rect']),{values:['fontSize']});
    partitioned = replaceOwnershipDestinationLocals(partitioned,ownershipDestinations('title',['300x250'],[2],['cta-rect']),{values:['fontSize']});
    const rules = materializeCreativeOwnership(partitioned).sizes['300x250'].variantRules;
    await cascadePage.setContent(`<style>${rules.map((rule:any)=>renderCssRule(selectorForVariantRule(rule),rule.props)).join('')}</style><div class="stage offers-0 cta-rect"><div id="title">Test</div></div>`);
    assert.equal(await cascadePage.locator('#title').evaluate(node=>getComputedStyle(node).fontSize),'30px','partitioning preserves browser cascade outside destination');
    await cascadePage.close();
    const page = await browser.newPage({viewport:{width:1600,height:1100}});
    const errors: string[] = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route(url => url.pathname === '/api/creative', async route => {
      if (route.request().method() === 'POST') saved = route.request().postDataJSON();
      await route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});
    });
    page.on('request', request => {
      if (request.method()==='POST' && /\/creative\/[^/]+\/view/.test(request.url())) latest=request.postDataJSON().document;
    });
    const ready = async () => { await page.waitForTimeout(100); await page.locator('[data-production-frame][data-ready="true"]').waitFor({timeout:30000}); };
    const openLayers = async () => {
      if (!(await page.getByRole('button',{name:'Terms Prices layer',exact:true}).count())) await page.locator('[data-section="layers"] .sidebar-section-toggle').click();
    };
    const zeroMpu = async () => {
      await page.getByLabel('Ad size',{exact:true}).selectOption('300x250');
      await page.getByRole('button',{name:'No offers (brand / awareness)',exact:true}).click();
      await page.getByRole('button',{name:'T&Cs only',exact:true}).click();
      await ready(); await openLayers();
    };
    await page.goto(origin); await zeroMpu();
    await page.getByRole('button',{name:'Terms Prices layer',exact:true}).click();
    const maxLines = page.getByLabel(/^Max lines/);
    const beforeMaxLines = await maxLines.inputValue();
    const changedMaxLines = Number(beforeMaxLines || 2) + 1;
    const beforeTerms = structuredClone(latest.sizes['300x250']);
    await maxLines.fill(String(changedMaxLines)); await ready();
    assert.ok(latest.sizes['300x250'].localOverrides.some((local:any)=>local.targetId==='terms-prices' && Number(local.fit.maxLines)===changedMaxLines));
    assert.deepEqual(latest.sizes['300x250'].layers,beforeTerms.layers);
    assert.deepEqual(latest.sizes['300x250'].variantRules,beforeTerms.variantRules);
    await page.getByRole('button',{name:'Undo',exact:true}).click(); await ready();
    assert.equal(await maxLines.inputValue(),beforeMaxLines);
    await maxLines.fill(String(changedMaxLines)); await ready();
    await page.getByRole('button',{name:'Save creative',exact:true}).click();
    await page.reload(); await zeroMpu();
    await page.getByRole('button',{name:'Terms Prices layer',exact:true}).click();
    assert.equal(await page.getByLabel(/^Max lines/).inputValue(),String(changedMaxLines));

    const beforeGroup = structuredClone(latest.sizes['300x250'].layers.filter((layer:any)=>/^roundel-/.test(layer.id)));
    await page.getByRole('button',{name:'Roundel Frame layer',exact:true}).click();
    await page.getByRole('button',{name:'Roundel Text layer',exact:true}).click({modifiers:['Shift']});
    await page.getByRole('button',{name:'Roundel Value layer',exact:true}).click({modifiers:['Shift']});
    await page.getByLabel('Group name',{exact:true}).fill('Roundel assembly');
    await page.getByRole('button',{name:'Group selected items',exact:true}).click(); await ready();
    assert.equal(latest.sizes['300x250'].canvasGroups[0].members.length,3);
    assert.deepEqual(latest.sizes['300x250'].layers.filter((layer:any)=>/^roundel-/.test(layer.id)),beforeGroup,'grouping preserves child geometry and motion');
    await page.getByRole('button',{name:/^Ungroup selected group/}).click(); await ready();
    assert.equal(latest.sizes['300x250'].canvasGroups.length,0);
    await page.getByRole('button',{name:'Undo',exact:true}).click(); await ready();
    assert.equal(latest.sizes['300x250'].canvasGroups[0].members.length,3);

    await page.getByRole('button',{name:'Roundel Text layer',exact:true}).click();
    await page.locator('.ownership-controls > summary').click();
    const sharing = page.locator('.ownership-controls');
    await sharing.getByRole('checkbox',{name:'1 offer',exact:true}).check();
    await sharing.getByRole('checkbox',{name:'2 offers',exact:true}).check();
    await sharing.getByRole('button',{name:'Copy selected properties',exact:true}).click(); await ready();
    const copies = latest.sizes['300x250'].localOverrides.filter((item:any)=>item.targetId==='roundel-copy');
    assert.ok([0,1,2].every(count=>copies.some((item:any)=>item.scope===`offers-${count}` && item.values.fontSize!==undefined)));
    await page.getByRole('button',{name:'Undo',exact:true}).click(); await ready();
    await sharing.getByRole('checkbox',{name:'2 offers',exact:true}).uncheck();
    await sharing.getByRole('button',{name:'Share with',exact:true}).click();
    await sharing.getByRole('checkbox',{name:'160x600',exact:true}).check();
    await sharing.getByLabel('Shared style name',{exact:true}).fill('Roundel typography');
    await sharing.getByRole('button',{name:'Create live link',exact:true}).click(); await ready();
    let definition = latest.sharedDefinitions.find((item:any)=>item.name==='Roundel typography');
    assert.equal(definition.members.length,4);
    assert.ok(definition.members.every((member:any)=>['offers-0','offers-1'].includes(member.scope)));
    await sharing.locator('summary').filter({hasText:'Property inheritance'}).click();
    await sharing.getByLabel('Property',{exact:true}).selectOption('fontSize');
    await sharing.getByLabel('New value',{exact:true}).fill('17');
    await sharing.getByRole('button',{name:'Edit linked value',exact:true}).click(); await ready();
    definition = latest.sharedDefinitions.find((item:any)=>item.name==='Roundel typography');
    assert.equal(definition.values.fontSize,17);
    await sharing.getByLabel('New value',{exact:true}).fill('18');
    await sharing.getByRole('button',{name:'Edit this version',exact:true}).click(); await ready();
    await sharing.locator('summary').filter({hasText:'Make independent'}).click();
    await sharing.getByRole('button',{name:'Make all independent',exact:true}).click(); await ready();
    definition = latest.sharedDefinitions.find((item:any)=>item.name==='Roundel typography');
    assert.equal(definition.members.length,3);
    const locals=latest.sizes['300x250'].localOverrides.filter((item:any)=>item.targetId==='roundel-copy');
    assert.ok(locals.some((item:any)=>item.values.fontSize===18 && !item.detached),'detaching preserves local value');
    await page.getByRole('button',{name:'Save creative',exact:true}).click();
    await page.reload(); await zeroMpu();
    assert.equal(saved.sharedDefinitions.find((item:any)=>item.name==='Roundel typography').members.length,3);
    assert.equal(saved.sizes['300x250'].canvasGroups[0].name,'Roundel assembly');
    await page.getByRole('button',{name:'Roundel Text layer',exact:true}).click();
    await page.locator('.ownership-controls > summary').click();
    await sharing.locator('summary').filter({hasText:'Property inheritance'}).click();
    await sharing.getByLabel('Property',{exact:true}).selectOption('fontSize');
    await page.getByRole('button',{name:'Roundel Frame layer',exact:true}).click();
    await page.locator('.ownership-controls > summary').click();
    await sharing.locator('summary').filter({hasText:'Property inheritance'}).click();
    const property = sharing.getByLabel('Property',{exact:true});
    assert.ok(await property.inputValue(),'shape inherits an available property selection');
    assert.notEqual(await property.inputValue(),'fontSize','shape does not retain text field');
    assert.deepEqual(errors,[]);
    assert.equal(await fs.readFile('campaign/sse-dco-creative.json','utf8'),original,'test must not edit real campaign');
    await page.screenshot({path:path.join(output,'editor.png')});
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify({result:'pass',checks:['partitioned browser CSS specificity','active fit','unrelated baseline','undo','save/reload','modifier multiselect','group/ungroup preserves child motion','group undo','multi-count copy', 'multi-count cross-format sharing', 'text-to-shape field validation','shared edit','local exception','detach preserves local value'],errors},null,2));
    console.log('PASS ownership editing workflows; campaign file unchanged');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
