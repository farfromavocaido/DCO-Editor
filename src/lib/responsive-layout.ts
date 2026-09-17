// @ts-nocheck
/** One runtime body for previews, QA and delivery. Measures ink, never line-box spacing. */
const SOURCE=String.raw`(function(win){
 var doc=win.document,writes=new Map(),imageCache=new WeakMap(),ctx=doc.createElement('canvas').getContext('2d'),diagnostics=[];
 function element(id){var p=id.split('::'),parent=p[0]==='terms-solo'?'TC_Solo':p[0].replace(/^offer-slot-(\d+)$/,'offer$1');var el=doc.getElementById(parent);return p[0]==='terms-solo'?el&&el.querySelector('.terms-solo'):p[1]?el&&el.querySelector('.'+p[1]):el;}
 function box(r){return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.left+r.width,bottom:r.top+r.height};}
 function union(items){if(!items.length)return null;var x=Math.min.apply(null,items.map(r=>r.left)),y=Math.min.apply(null,items.map(r=>r.top)),right=Math.max.apply(null,items.map(r=>r.right)),bottom=Math.max.apply(null,items.map(r=>r.bottom));return box({left:x,top:y,width:right-x,height:bottom-y});}
 function present(el){if(!el)return false;for(var n=el;n&&n!==doc.documentElement;n=n.parentElement){var s=win.getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden')return false;}return true;}
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
 function reset(){writes.forEach(function(entry,el){Object.keys(entry).forEach(function(key){if(el.style.getPropertyValue(key)===entry[key].last)el.style.setProperty(key,entry[key].value,entry[key].priority);});});writes.clear();}
 function active(rule,root){return rule.enabled&&(rule.when||[]).concat((rule.scope||'').split('.').filter(Boolean)).every(s=>root.classList.contains(s));}
 function authored(el){var s=win.getComputedStyle(el);return {left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,width:parseFloat(s.width)||0,height:parseFloat(s.height)||0};}
 function edge(r,e,axis){return axis==='x'?(e==='start'?r.left:e==='end'?r.right:r.left+r.width/2):(e==='start'?r.top:e==='end'?r.bottom:r.top+r.height/2);}
 function local(r,root){if(!r)return null;var b=root.getBoundingClientRect();return box({left:r.left-b.left,top:r.top-b.top,width:r.width,height:r.height});}
 function run(root,rules){
  diagnostics=[];var neutral=doc.createElement('style');neutral.textContent='.stage,.stage *,.stage *::before,.stage *::after{animation:none!important;transition:none!important}';doc.head.append(neutral);
  try{
   var pending=[];
   rules.forEach(function(rule){var status=!rule.enabled?'disabled':active(rule,root)?'active':'inactive';var item={id:rule.id,name:rule.name,targetId:rule.targetId,size:rule.size,status:status};diagnostics.push(item);if(status!=='active')return;
    var target=element(rule.targetId);if(rule.type==='conditional'){item.before=target?authored(target):null;item.after=item.before;return;}
    pending.push({rule:rule,item:item,target:target});
   });
   var done=new Set(),visiting=new Set();
   function place(record){var rule=record.rule,item=record.item,target=record.target;if(done.has(record))return;if(visiting.has(record))throw new Error('Circular responsive spacing');visiting.add(record);
    pending.filter(other=>other.rule.targetId===rule.reference.targetId).forEach(place);
    try{
     item.before=target?authored(target):null;if(!target||!present(target)){item.status='inactive';return;}
     var targetInk=ink(target);if(!targetInk){item.status='missing';item.message='Target has no visible ink';return;}
     var reference=rule.reference.targetId==='canvas'?box(root.getBoundingClientRect()):ink(element(rule.reference.targetId)),refEdge=rule.reference.edge,gap=rule.gap||0;
     var fontSize=parseFloat(win.getComputedStyle(target).fontSize)||0,canvasBox=root.getBoundingClientRect();
     var gapScale=rule.gapUnit==='em'?fontSize:rule.gapUnit==='percent'?(rule.axis==='x'?canvasBox.width:canvasBox.height)/100:1;
     if(!reference){item.message='Reference has no visible ink';if(rule.onMissing!=='canvas'){item.status='missing';return;}reference=box(root.getBoundingClientRect());refEdge=rule.fallbackEdge;gap=rule.fallbackGap||0;item.message='Using canvas fallback';item.usingFallback=true;}
     gap*=gapScale;
     var delta=edge(reference,refEdge,rule.axis)+gap-edge(targetInk,rule.targetEdge,rule.axis),property=rule.axis==='x'?'left':'top';
     write(target,property,(item.before[property]+delta)+'px');
     item.after=authored(target);item.axis=rule.axis;item.targetEdge=rule.targetEdge;item.referenceEdge=refEdge;item.targetInk=local(ink(target),root);item.referenceInk=local(reference,root);item.gap=gap;item.gapScale=gapScale;
    }catch(error){item.status='error';item.message=error.message;}finally{visiting.delete(record);done.add(record);}
   }
   pending.forEach(place);
   diagnostics.filter(item=>item.status==='active').forEach(function(item){var target=element(item.targetId);if(target){item.after=authored(target);if(item.axis)item.targetInk=local(ink(target),root);}});
  }finally{neutral.remove();}
  win.__DCO_LAYOUT_DIAGNOSTICS__=diagnostics;return diagnostics;
 }
 return {reset:reset,run:run,ink:ink,getDiagnostics:function(){return diagnostics;}};
})`;
export const responsiveLayoutSource=()=>SOURCE;
export const createResponsiveLayoutRuntime=new Function(`return ${SOURCE}`)();
