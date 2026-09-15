/** Browser authoring smoke test; backend document storage is intercepted in memory. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.argv[2] || 'http://localhost:5184';
const output = path.resolve('output/playwright/ownership');

async function main() {
  await fs.mkdir(output,{recursive:true});
  const original = await fs.readFile('campaign/sse-dco-creative.json','utf8');
  let saved = JSON.parse(original), latest = saved;
  const browser = await chromium.launch({headless:true});
  try {
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
    assert.equal(await maxLines.inputValue(),'2');
    await maxLines.fill('4'); await ready();
    const termsRule = () => latest.sizes['300x250'].variantRules.find((rule:any)=>rule.id==='offers-0.tc-solo|terms-prices');
    assert.equal(Number(termsRule().fit.maxLines),4);
    assert.equal(latest.sizes['300x250'].layers.find((layer:any)=>layer.id==='terms-prices').fit.maxLines,4);
    await page.getByRole('button',{name:'Undo',exact:true}).click(); await ready();
    assert.equal(await maxLines.inputValue(),'2');
    await maxLines.fill('4'); await ready();
    await page.getByRole('button',{name:'Save creative',exact:true}).click();
    await page.reload(); await zeroMpu();
    await page.getByRole('button',{name:'Terms Prices layer',exact:true}).click();
    assert.equal(await page.getByLabel(/^Max lines/).inputValue(),'4');

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
    await page.locator('summary').filter({hasText:'Ownership and sharing'}).click();
    const sharing = page.locator('details').filter({has:page.locator('summary').filter({hasText:'Ownership and sharing'})}).first();
    await sharing.getByRole('checkbox',{name:'160x600',exact:true}).check();
    await sharing.getByLabel('New shared name',{exact:true}).fill('Zero-offer roundel type');
    await sharing.getByRole('button',{name:'Create shared source',exact:true}).click(); await ready();
    let definition = latest.sharedDefinitions.find((item:any)=>item.name==='Zero-offer roundel type');
    assert.equal(definition.members.length,2);
    assert.ok(definition.members.every((member:any)=>member.scope==='offers-0'));
    await sharing.getByLabel('New value',{exact:true}).fill('17');
    await sharing.getByRole('button',{name:'Edit shared source',exact:true}).click(); await ready();
    definition = latest.sharedDefinitions.find((item:any)=>item.name==='Zero-offer roundel type');
    assert.equal(definition.values.fontSize,17);
    await sharing.getByLabel('New value',{exact:true}).fill('18');
    await sharing.getByRole('button',{name:'Set local value',exact:true}).click(); await ready();
    await sharing.getByRole('button',{name:'Detach this membership',exact:true}).click(); await ready();
    definition = latest.sharedDefinitions.find((item:any)=>item.name==='Zero-offer roundel type');
    assert.equal(definition.members.length,1);
    const locals=latest.sizes['300x250'].localOverrides.filter((item:any)=>item.targetId==='roundel-copy');
    assert.ok(locals.some((item:any)=>item.values.fontSize===18 && !item.detached),'detaching preserves local value');
    await page.getByRole('button',{name:'Save creative',exact:true}).click();
    await page.reload(); await zeroMpu();
    assert.equal(saved.sharedDefinitions.find((item:any)=>item.name==='Zero-offer roundel type').members.length,1);
    assert.equal(saved.sizes['300x250'].canvasGroups[0].name,'Roundel assembly');
    assert.deepEqual(errors,[]);
    assert.equal(await fs.readFile('campaign/sse-dco-creative.json','utf8'),original,'test must not edit real campaign');
    await page.screenshot({path:path.join(output,'editor.png')});
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify({result:'pass',checks:['active fit','unrelated baseline','undo','save/reload','modifier multiselect','group/ungroup preserves child motion','group undo','cross-format offer-scoped sharing','shared edit','local exception','detach preserves local value'],errors},null,2));
    console.log('PASS ownership editing workflows; campaign file unchanged');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
