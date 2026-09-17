// @ts-nocheck
import {responsiveLayoutSource} from '@/lib/responsive-layout';
import { textFitEngineSource } from '@/lib/text-fit';
import { campaignVariantModel, campaignStateRuntimeSource } from '@/lib/campaign-variants';
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
/** Generic campaigns use the production DOM/CSS and the same browser fit engine. */
export const campaignRuntimeScript = (document, fitRules, options = {}) => `
${options.layoutRules?.length ? `<script type="application/json" id="dco-layout-rules">${json(options.layoutRules)}</script>` : ''}
<script type="application/json" id="sse-production-fit-rules">${json(fitRules)}</script>
<script>(function(){
  var stateModel = ${json(campaignVariantModel(document))};
  var dimensions = stateModel.dimensions;
  ${campaignStateRuntimeSource()}
  var initialRow = ${json(document.feed?.sampleRows?.find(r=>r.Default) || document.feed?.sampleRows?.[0] || {})};
  var exitField = ${json(document.variantModel.exitField || '')};
  var assetUrls = ${json(options.assetUrlMap || {})};
  var assetBase = ${json(options.assetBasePath || '')};
  var root, currentRow = initialRow, generation = 0;
  var rules = JSON.parse(document.getElementById('sse-production-fit-rules').textContent);
  var engine = ${textFitEngineSource()}(window);
  ${options.layoutRules?.length ? `var responsiveLayout=${responsiveLayoutSource()}(window);var layoutRules=JSON.parse(document.getElementById('dco-layout-rules').textContent);window.updateSseDcoLayoutRules=function(next){layoutRules=next;};` : ''}
  window.updateSseDcoFitRules = function(next){rules=next;};
  function fit(){if(root){${options.layoutRules?.length ? 'responsiveLayout.reset();' : ''}engine.applyRules(root,rules);${options.layoutRules?.length ? 'responsiveLayout.run(root,layoutRules);' : ''}}}
  function apply(row){
    root = document.getElementById('page-content'); if(!root) return;
    currentRow = resolveCampaignState(stateModel,row || {}); window.__SSE_DCO_APPLIED_ROW__ = currentRow;
    dimensions.forEach(function(d){
      d.options.forEach(function(o){root.classList.remove(o.scope);});
      if(!evaluateConditions(currentRow,d.enabledWhen)) return;
      var value = currentRow[d.field] == null ? d.defaultValue : currentRow[d.field];
      var option = d.options.find(function(o){return o.value === value;}) || d.options.find(function(o){return o.value === d.defaultValue;});
      root.classList.add(option.scope);
    });
    root.querySelectorAll('[data-dco-field]').forEach(function(el){
      var value=currentRow[el.getAttribute('data-dco-field')];
      if(value && typeof value==='object') value=value.Url;
      value=value == null ? '' : String(value);
      if(el.tagName==='IMG') {var mapped=assetUrls[value.replace(/^\\/+/, '')];if(mapped)value=mapped;else if(value && assetBase && !/^(?:[a-z]+:|\\/)/i.test(value))value=assetBase.replace(/\\/?$/, '/')+value;el.setAttribute('src',value);} else el.textContent=value.replace(/<br\\s*\\/?>/gi,'\\n');
    });
    fit(); var run = ++generation;
    window.__SSE_DCO_SETTLED__ = Promise.all([document.fonts && document.fonts.ready${options.layoutRules?.length ? `,...Array.from(document.images).map(function(img){return img.complete?Promise.resolve():new Promise(function(resolve){img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});})` : ''}]).then(function(){return new Promise(function(resolve){
      requestAnimationFrame(function(){if(run===generation){fit();root.classList.add('motion-ready');}requestAnimationFrame(resolve);});
    });});
    window.__SSE_DCO_READY__ = true;
  }
  window.applyRuntimeState=window.applySseDcoRuntimeState=apply;
  ${options.includePreviewBridge !== false ? "window.addEventListener('message',function(event){if(event.data && event.data.type==='SSE_DCO_PREVIEW_STATE' && event.data.row)apply(event.data.row);});" : ''}
  function boot(){
    var row = ${options.includePreviewBridge !== false ? 'window.__SSE_DCO_PREVIEW__ || ' : ''}initialRow;
    if(window.dynamicContent) Object.keys(window.dynamicContent).some(function(key){var rows=window.dynamicContent[key];if(Array.isArray(rows)&&rows[0]){row=rows[0];return true;}return false;});
    apply(row);
    var clickbox=document.getElementById('clickbox');
    if(clickbox) clickbox.addEventListener('click',function(event){
      event.preventDefault();var url=currentRow[exitField];url=url && typeof url==='object' ? url.Url : url;
      if(typeof Enabler!=='undefined'){if(url&&Enabler.exitOverride) Enabler.exitOverride('Main Exit',String(url));else if(Enabler.exit)Enabler.exit('Main Exit');}
      else if(url) window.open(String(url),'_blank','noopener');
    });
  }
  function start(){${options.includePreviewBridge !== false ? 'boot();return;' : ''}if(typeof Enabler!=='undefined'&&Enabler.isInitialized&&!Enabler.isInitialized()&&typeof studio!=='undefined'){Enabler.addEventListener(studio.events.StudioEvent.INIT,boot);}else boot();}
  document.addEventListener('DOMContentLoaded',start);
})();</script>`;

/** Authored Studio profiles remain data; a local demo needs no production profile ID. */
export const campaignStudioDynamicContentScript = document => {
  const profileId = Number(document.feed?.studioProfileId);
  const element = String(document.feed?.studioProfileElement || 'Campaign');
  const row = document.feed?.sampleRows?.find(row=>row.Default) || document.feed?.sampleRows?.[0] || {};
  return `<script>var dynamicContent = {}; dynamicContent[${json(element)}]=[${json(row)}];${Number.isSafeInteger(profileId) && profileId > 0 ? `if(typeof Enabler!=='undefined'){Enabler.setProfileId(${profileId});Enabler.setDevDynamicContent(dynamicContent);}` : ''}</script>`;
};
