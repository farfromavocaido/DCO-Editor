// @ts-nocheck
/** One runtime body for previews, QA and delivery. Measures ink, never line-box spacing. */
const SOURCE=String.raw`(function(win){
 var doc=win.document,writes=new Map(),imageCache=new WeakMap(),ctx=doc.createElement('canvas').getContext('2d'),diagnostics=[];
 function element(id){var p=id.split('::'),parent=p[0]==='terms-solo'?'TC_Solo':p[0].replace(/^offer-slot-(\d+)$/,'offer$1');var el=doc.getElementById(parent);return p[0]==='terms-solo'?el&&el.querySelector('.terms-solo'):p[1]?el&&el.querySelector('.'+p[1]):el;}
 function box(r){return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.left+r.width,bottom:r.top+r.height};}
 function union(items){if(!items.length)return null;var x=Math.min.apply(null,items.map(r=>r.left)),y=Math.min.apply(null,items.map(r=>r.top)),right=Math.max.apply(null,items.map(r=>r.right)),bottom=Math.max.apply(null,items.map(r=>r.bottom));return box({left:x,top:y,width:right-x,height:bottom-y});}
 function present(el){if(!el||win.getComputedStyle(el).visibility==='hidden')return false;for(var n=el;n&&n!==doc.documentElement;n=n.parentElement){var s=win.getComputedStyle(n);if(s.display==='none')return false;}return true;}
 function clipInk(r,owner,stop){for(var n=owner;n&&n!==stop;n=n.parentElement){var s=win.getComputedStyle(n),b=n.getBoundingClientRect(),left=r.left,top=r.top,right=r.right,bottom=r.bottom;if(s.overflowX!=='visible'){left=Math.max(left,b.left+n.clientLeft);right=Math.min(right,b.left+n.clientLeft+n.clientWidth);}if(s.overflowY!=='visible'){top=Math.max(top,b.top+n.clientTop);bottom=Math.min(bottom,b.top+n.clientTop+n.clientHeight);}if(right<=left||bottom<=top)return null;r=box({left:left,top:top,width:right-left,height:bottom-top});}return r;}
 function font(s){return s.fontStyle+' '+s.fontWeight+' '+s.fontSize+' '+s.fontFamily;}
 function textInk(el){
  var ink=[],walker=doc.createTreeWalker(el,win.NodeFilter.SHOW_TEXT),node;
  while(node=walker.nextNode()){
   var owner=node.parentElement;if(!present(owner))continue;var s=win.getComputedStyle(owner),groups=[],offset=0,current=null;
   // Ranges locate the actual wrapped lines; full runs retain kerning and ligatures.
   for(var ch of Array.from(node.textContent||'')){
    var length=ch.length,range=doc.createRange();range.setStart(node,offset);range.setEnd(node,offset+length);var rect=range.getBoundingClientRect();
    if(ch.trim()&&(rect.width||rect.height)){
     if(!current||Math.abs(current.top-rect.top)>.25){current={start:offset,end:offset+length,top:rect.top};groups.push(current);}else current.end=offset+length;
    }
    offset+=length;
   }
   groups.forEach(function(group){
    var range=doc.createRange();range.setStart(node,group.start);range.setEnd(node,group.end);var rect=range.getBoundingClientRect();
    var sample=node.textContent.slice(group.start,group.end);if(['normal','nowrap','pre-line'].includes(s.whiteSpace))sample=sample.replace(/\s+/g,' ');
    if(s.textTransform==='uppercase')sample=sample.toUpperCase();else if(s.textTransform==='lowercase')sample=sample.toLowerCase();
    ctx.font=font(s);if('fontKerning' in ctx)ctx.fontKerning=s.fontKerning;if('letterSpacing' in ctx)ctx.letterSpacing=s.letterSpacing==='normal'?'0px':s.letterSpacing;
    var m=ctx.measureText(sample);if(!Number.isFinite(m.actualBoundingBoxAscent))throw new Error('Font ink metrics unavailable');
    var fa=m.fontBoundingBoxAscent,fd=m.fontBoundingBoxDescent;if(!Number.isFinite(fa)||!Number.isFinite(fd))throw new Error('Font baseline metrics unavailable');
    var baseline=rect.top+Math.max(0,rect.height-fa-fd)/2+fa;
    var left=rect.left-m.actualBoundingBoxLeft,right=rect.right-(m.width-m.actualBoundingBoxRight);
    var painted=clipInk(box({left:left,top:baseline-m.actualBoundingBoxAscent,width:Math.max(0,right-left),height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent}),owner,el.parentElement);if(painted)ink.push(painted);
   });
  }
  return union(ink);
 }
 function imageInk(el){
  if(!present(el)||!el.getAttribute('src'))return null;if(!el.complete||!el.naturalWidth)throw new Error('Image not ready for ink measurement');
  var cached=imageCache.get(el),src=el.currentSrc||el.src;
  if(!cached||cached.src!==src){
   var canvas=doc.createElement('canvas');canvas.width=el.naturalWidth;canvas.height=el.naturalHeight;
   var c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(el,0,0);var pixels;
   try{pixels=c.getImageData(0,0,canvas.width,canvas.height).data;}catch(error){throw new Error('Image ink unavailable: use a same-origin or CORS-enabled image');}
   var minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
   for(var y=0;y<canvas.height;y++)for(var x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>0){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   cached={src:src,empty:maxX<0,left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};imageCache.set(el,cached);
  }
  if(cached.empty)return null;
  var r=el.getBoundingClientRect(),s=win.getComputedStyle(el),w=r.width,h=r.height,nw=el.naturalWidth,nh=el.naturalHeight;
  if(s.objectFit==='contain'||s.objectFit==='cover'){var scale=s.objectFit==='cover'?Math.max(w/nw,h/nh):Math.min(w/nw,h/nh);w=nw*scale;h=nh*scale;}
  var position=(s.objectPosition||'50% 50%').split(' '),px=position[0].endsWith('%')?parseFloat(position[0])/100:.5,py=(position[1]||'50%').endsWith('%')?parseFloat(position[1]||'50')/100:.5;
  var left=r.left+(r.width-w)*px+cached.left/nw*w,top=r.top+(r.height-h)*py+cached.top/nh*h;
  var result=box({left:left,top:top,width:cached.width/nw*w,height:cached.height/nh*h});
  var right=Math.min(result.right,r.right),bottom=Math.min(result.bottom,r.bottom);result.left=Math.max(result.left,r.left);result.top=Math.max(result.top,r.top);return box({left:result.left,top:result.top,width:Math.max(0,right-result.left),height:Math.max(0,bottom-result.top)});
 }
 function ink(el){
  if(!present(el))return null;
  if(el.tagName==='IMG')return imageInk(el);
  if(el.namespaceURI==='http://www.w3.org/2000/svg'){var b=el.getBBox({stroke:true}),matrix=el.getScreenCTM();if(!matrix||!b.width||!b.height)return null;var points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(function(p){return new win.DOMPoint(p[0],p[1]).matrixTransform(matrix);});return union(points.map(function(p){return box({left:p.x,top:p.y,width:0,height:0});}));}
  var style=win.getComputedStyle(el),rect=el.getBoundingClientRect();
  var painted=style.backgroundColor!=='rgba(0, 0, 0, 0)'&&style.backgroundColor!=='transparent'||style.backgroundImage!=='none'||parseFloat(style.borderWidth)>0;
  if(painted)return rect.width&&rect.height?box(rect):null;
  var texts=textInk(el),images=Array.from(el.querySelectorAll('img')).map(imageInk).filter(Boolean);
  return union([texts].concat(images,Array.from(el.querySelectorAll('svg')).map(ink)).filter(Boolean));
 }
 function write(el,key,value){var entry=writes.get(el);if(!entry){entry={};writes.set(el,entry);}if(!entry[key])entry[key]={value:el.style.getPropertyValue(key),priority:el.style.getPropertyPriority(key)};el.style.setProperty(key,value,'important');entry[key].last=el.style.getPropertyValue(key);}
 function reset(){if(conditionalStyle){conditionalStyle.remove();conditionalStyle=null;}writes.forEach(function(entry,el){Object.keys(entry).forEach(function(key){if(el.style.getPropertyValue(key)===entry[key].last)el.style.setProperty(key,entry[key].value,entry[key].priority);});});writes.clear();}
 function active(rule,root){return rule.enabled&&(rule.when||[]).concat((rule.scope||'').split('.').filter(Boolean)).every(s=>root.classList.contains(s));}
 function authored(el){var s=win.getComputedStyle(el);return {left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,width:parseFloat(s.width)||0,height:parseFloat(s.height)||0};}
 function edge(r,e,axis){return axis==='x'?(e==='start'?r.left:e==='end'?r.right:r.left+r.width/2):(e==='start'?r.top:e==='end'?r.bottom:r.top+r.height/2);}
 function local(r,root){if(!r)return null;var b=root.getBoundingClientRect();return box({left:r.left-b.left,top:r.top-b.top,width:r.width,height:r.height});}
 function facts(el){
  var text=el?String(el.textContent||'').trim():'',shown=present(el),paint=shown?ink(el):null,tops=[];
  if(shown&&text){var walker=doc.createTreeWalker(el,win.NodeFilter.SHOW_TEXT),node;while(node=walker.nextNode()){if(!present(node.parentElement))continue;var offset=0;for(var ch of Array.from(node.textContent||'')){var range=doc.createRange();range.setStart(node,offset);range.setEnd(node,offset+ch.length);offset+=ch.length;if(!ch.trim())continue;var r=range.getBoundingClientRect();if(r.width&&r.height&&!tops.some(line=>Math.abs(line.top-r.top)<1||Math.abs(line.height-r.height)>1&&Math.min(line.bottom,r.bottom)-Math.max(line.top,r.top)>=Math.min(line.height,r.height)*.6))tops.push({top:r.top,bottom:r.bottom,height:r.height});}}}
  return {hasText:!!text,shown:!!paint,lines:tops.length,height:paint?paint.height:0};
 }
 function matches(c,f){return c.test==='has-text'?f.hasText:c.test==='empty'?!f.hasText:c.test==='shown'?f.shown:c.test==='hidden'?!f.shown:c.test==='lines-at-least'?f.lines>=c.value:c.test==='lines-at-most'?f.lines<=c.value:c.test==='lines-equal'?f.lines===c.value:f.height>=c.value;}
 var conditionalStyle=null;
 function run(root,rules,refit){
  diagnostics=[];var neutral=doc.createElement('style');neutral.textContent='.stage,.stage *,.stage *::before,.stage *::after{animation:none!important;transition:none!important}';doc.head.append(neutral);
  var css=[],records=rules.map(function(rule,index){var ids=rule.members||[rule.targetId];return {rule:rule,index:index,ids:ids,done:false,visiting:false};});
  function diagnostic(rule,id,status){var item={id:rule.id,name:rule.name,targetId:id,size:rule.size,status:status};diagnostics.push(item);return item;}
  function process(record){
   if(record.done)return;if(record.visiting)throw new Error('Circular layout dependency');record.visiting=true;
   var rule=record.rule,enabled=active(rule,root),measurement=rule.condition&&!['has-text','empty'].includes(rule.condition.test);
   if(enabled)records.filter(function(other){if(other===record)return false;if(rule.type==='spacing')return other.ids.includes(rule.reference.targetId);if(rule.type==='distribute')return other.rule.type==='conditional'&&other.ids.some(id=>record.ids.includes(id));return measurement&&other.ids.includes(rule.condition.targetId)&&other.rule.type==='conditional'&&Object.keys(Object.assign({},other.rule.values,other.rule.otherwise)).some(k=>['width','height','visibility','fontSize','lineHeight','letterSpacing'].includes(k));}).forEach(process);
   if(!enabled){record.ids.forEach(id=>diagnostic(rule,id,rule.enabled?'inactive':'disabled'));record.done=true;record.visiting=false;return;}
   if(rule.type==='distribute'){
    var items=record.ids.map(function(id){var el=element(id),item=diagnostic(rule,id,'active');item.area=rule.area;item.kind='distribute';item.before=el?authored(el):null;return {el:el,item:item,paint:el&&(!(rule.textMembers||[]).includes(id)||String(el.textContent||'').trim())?ink(el):null};});
    var visible=items.filter(x=>x.paint);items.filter(x=>!x.paint).forEach(x=>{x.item.status='inactive';x.item.message='Empty or hidden — left out';});
    var length=rule.axis==='x'?rule.area.width:rule.area.height,extent=visible.reduce((n,x)=>n+(rule.axis==='x'?x.paint.width:x.paint.height),0),gap=visible.length>1?(length-extent)/(visible.length-1):0;
    if(extent>length||visible.length>1&&gap<rule.minGap){if(rule.overflow==='authored'){visible.forEach(x=>{x.item.status='error';x.item.message='Not enough room. Enlarge the area or reduce the minimum gap.';});record.done=true;record.visiting=false;return;}gap=rule.minGap;visible.forEach(x=>x.item.message='Minimum gap kept; artwork extends beyond the area');}
    var origin=root.getBoundingClientRect(),cursor=(rule.axis==='x'?origin.left+rule.area.left:origin.top+rule.area.top);
    if(visible.length===1)cursor+=(length-extent)*(rule.single==='end'?1:rule.single==='center'?.5:0);
    visible.forEach(function(x){var key=rule.axis==='x'?'left':'top';write(x.el,key,(x.item.before[key]+cursor-edge(x.paint,'start',rule.axis))+'px');if(rule.crossAlign&&rule.crossAlign!=='keep'){var cross=rule.axis==='x'?'y':'x',crossKey=cross==='x'?'left':'top',crossStart=cross==='x'?origin.left+rule.area.left:origin.top+rule.area.top,crossLength=cross==='x'?rule.area.width:rule.area.height,fraction=rule.crossAlign==='end'?1:rule.crossAlign==='center'?.5:0;write(x.el,crossKey,(x.item.before[crossKey]+crossStart+crossLength*fraction-edge(x.paint,rule.crossAlign,cross))+'px');}x.item.after=authored(x.el);x.item.targetInk=local(ink(x.el),root);cursor+=(rule.axis==='x'?x.paint.width:x.paint.height)+gap;});
   }else{
    var target=element(rule.targetId),item=diagnostic(rule,rule.targetId,'active');item.before=target?authored(target):null;
    if(rule.type==='conditional'){
     if(rule.condition){var measured=facts(element(rule.condition.targetId)),pass=matches(rule.condition,measured),values=pass?rule.values:rule.otherwise;item.facts=measured;item.branch=pass?'when':'otherwise';item.values=values||{};
      if(!values||!Object.keys(values).length){item.status='inactive';item.message=pass?'Condition met — original placement':'Condition not met — original placement';}
      else if(target){target.setAttribute('data-layout-rule-node',rule.targetId);var declarations=Object.keys(values).map(function(key){return key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+values[key]+(['left','top','width','height'].includes(key)?'px':'')+'!important';});css.push('[data-layout-rule-node="'+win.CSS.escape(rule.targetId)+'"]{'+declarations.join(';')+'}');if(!conditionalStyle){conditionalStyle=doc.createElement('style');doc.head.append(conditionalStyle);}conditionalStyle.textContent=css.join('\n');if(refit)refit();}
     }
     item.after=target?authored(target):null;
    }else{
     if(!target||!present(target)){item.status='inactive';}
     else{var targetInk=ink(target);if(!targetInk){item.status='missing';item.message='Target has no visible ink';}
      else{var reference=rule.reference.targetId==='canvas'?box(root.getBoundingClientRect()):ink(element(rule.reference.targetId)),refEdge=rule.reference.edge,gap=rule.gap||0;
       var fontSize=parseFloat(win.getComputedStyle(target).fontSize)||0,canvasBox=root.getBoundingClientRect(),gapScale=rule.gapUnit==='em'?fontSize:rule.gapUnit==='percent'?(rule.axis==='x'?canvasBox.width:canvasBox.height)/100:1;
       if(!reference){item.message='Reference has no visible ink';if(rule.onMissing==='canvas'){reference=box(root.getBoundingClientRect());refEdge=rule.fallbackEdge;gap=rule.fallbackGap||0;item.message='Using canvas fallback';item.usingFallback=true;}else item.status='missing';}
       if(reference){gap*=gapScale;var delta=edge(reference,refEdge,rule.axis)+gap-edge(targetInk,rule.targetEdge,rule.axis),property=rule.axis==='x'?'left':'top';write(target,property,(item.before[property]+delta)+'px');item.after=authored(target);item.axis=rule.axis;item.targetEdge=rule.targetEdge;item.referenceEdge=refEdge;item.targetInk=local(ink(target),root);item.referenceInk=local(reference,root);item.gap=gap;item.gapScale=gapScale;}
      }
     }
    }
   }
   record.done=true;record.visiting=false;
  }
  try{records.forEach(function(record){try{process(record);}catch(error){record.ids.forEach(function(id){var item=diagnostics.find(d=>d.id===record.rule.id&&d.targetId===id)||diagnostic(record.rule,id,'error');item.status='error';item.message=error.message;});record.done=true;record.visiting=false;}});
   diagnostics.filter(item=>item.status==='active').forEach(function(item){var target=element(item.targetId);if(target){item.after=authored(target);if(item.axis||item.kind==='distribute')item.targetInk=local(ink(target),root);}});
  }finally{neutral.remove();}
  win.__DCO_LAYOUT_DIAGNOSTICS__=diagnostics;return diagnostics;
 }
 return {reset:reset,run:run,ink:ink,facts:facts,element:element,getDiagnostics:function(){return diagnostics;}};
})`;
export const responsiveLayoutSource=()=>SOURCE;
export const createResponsiveLayoutRuntime=new Function(`return ${SOURCE}`)();
